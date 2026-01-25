import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export default class DockerController extends EventEmitter {
  constructor(config) {
    super();
    this.serversPath = path.resolve(config.servers_path || './servers');
    this.networkName = 'sodium_network';
    this.containers = new Map();
  }

  async init() {
    await execAsync('docker info');
    await this.ensureNetwork();
    await fs.mkdir(this.serversPath, { recursive: true });
  }

  async ensureNetwork() {
    try {
      await execAsync(`docker network inspect ${this.networkName}`);
    } catch {
      await execAsync(`docker network create ${this.networkName}`);
    }
  }

  getContainerName(uuid) {
    return `sodium_${uuid.substring(0, 12)}`;
  }

  getServerPath(uuid) {
    return path.join(this.serversPath, uuid);
  }

  async listContainers() {
    try {
      const { stdout } = await execAsync(
        `docker ps -a --filter "name=sodium_" --format '{"id":"{{.ID}}","name":"{{.Names}}","status":"{{.Status}}","state":"{{.State}}"}'`
      );
      return stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  async createContainer(server, egg) {
    const containerName = this.getContainerName(server.uuid);
    const serverPath = this.getServerPath(server.uuid);

    await fs.mkdir(serverPath, { recursive: true });

    const env = this.buildEnvironment(server, egg);
    const startup = this.parseStartup(egg.startup, env);
    const image = server.docker_image || egg.docker_images?.[Object.keys(egg.docker_images || {})[0]] || 'alpine';

    const args = [
      'create',
      '--name', containerName,
      '--network', this.networkName,
      '-m', `${server.memory}m`,
      '--cpus', String(server.cpu / 100),
      '-v', `${serverPath}:/home/container`,
      '-w', '/home/container',
      '--user', '1000:1000',
      '-p', `${server.port}:${server.port}`,
      '-p', `${server.port}:${server.port}/udp`,
      '--restart', 'unless-stopped',
      '-e', 'HOME=/home/container'
    ];

    for (const [key, value] of Object.entries(env)) {
      args.push('-e', `${key}=${value}`);
    }

    args.push(image, '/bin/sh', '-c', startup);

    const { stdout } = await execAsync(`docker ${args.join(' ')}`);
    return stdout.trim();
  }

  async startContainer(uuid) {
    const name = this.getContainerName(uuid);
    await execAsync(`docker start ${name}`);
    this.attachToContainer(uuid);
  }

  async stopContainer(uuid, timeout = 30) {
    const name = this.getContainerName(uuid);
    await execAsync(`docker stop -t ${timeout} ${name}`);
    this.containers.delete(uuid);
  }

  async restartContainer(uuid) {
    const name = this.getContainerName(uuid);
    await execAsync(`docker restart ${name}`);
  }

  async killContainer(uuid) {
    const name = this.getContainerName(uuid);
    await execAsync(`docker kill ${name}`);
    this.containers.delete(uuid);
  }

  async removeContainer(uuid) {
    const name = this.getContainerName(uuid);
    try {
      await execAsync(`docker rm -f ${name}`);
    } catch {}
    this.containers.delete(uuid);
  }

  async getContainerStatus(uuid) {
    const name = this.getContainerName(uuid);
    try {
      const { stdout } = await execAsync(`docker inspect --format '{{.State.Status}}' ${name}`);
      const dockerStatus = stdout.trim();
      const statusMap = {
        running: 'online',
        exited: 'offline',
        created: 'offline',
        paused: 'offline',
        restarting: 'starting',
        removing: 'stopping',
        dead: 'offline'
      };
      return statusMap[dockerStatus] || 'offline';
    } catch {
      return 'offline';
    }
  }

  async getContainerStats(uuid) {
    const name = this.getContainerName(uuid);
    try {
      const { stdout } = await execAsync(
        `docker stats ${name} --no-stream --format '{"cpu":"{{.CPUPerc}}","memory":"{{.MemUsage}}","network":"{{.NetIO}}"}'`
      );
      const stats = JSON.parse(stdout.trim());
      return {
        cpu: parseFloat(stats.cpu) || 0,
        memory: this.parseMemory(stats.memory),
        network: this.parseNetwork(stats.network)
      };
    } catch {
      return { cpu: 0, memory: 0, network: { rx: 0, tx: 0 } };
    }
  }

  attachToContainer(uuid) {
    if (this.containers.has(uuid)) return this.containers.get(uuid);

    const name = this.getContainerName(uuid);
    const proc = spawn('docker', ['logs', '-f', '--tail', '100', name]);

    proc.stdout.on('data', (data) => {
      this.emit('output', uuid, data.toString());
    });

    proc.stderr.on('data', (data) => {
      this.emit('output', uuid, data.toString());
    });

    proc.on('close', () => {
      this.containers.delete(uuid);
    });

    this.containers.set(uuid, proc);
    return proc;
  }

  async sendCommand(uuid, command) {
    const name = this.getContainerName(uuid);
    const status = await this.getContainerStatus(uuid);
    if (status !== 'online') throw new Error('Container not running');
    
    const escaped = command.replace(/'/g, "'\\''");
    await execAsync(`docker exec ${name} sh -c "echo '${escaped}' > /proc/1/fd/0"`);
  }

  async installServer(server, egg) {
    const serverPath = this.getServerPath(server.uuid);
    await fs.mkdir(serverPath, { recursive: true });

    if (!egg.scripts?.install) return;

    const { container, entrypoint, script } = egg.scripts.install;
    const scriptPath = path.join(serverPath, '.sodium_install.sh');

    await fs.writeFile(scriptPath, script, { mode: 0o755 });

    const env = this.buildEnvironment(server, egg);
    const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);

    return new Promise((resolve, reject) => {
      const proc = spawn('docker', [
        'run', '--rm',
        ...envArgs,
        '-v', `${serverPath}:/mnt/server`,
        '-w', '/mnt/server',
        '--entrypoint', entrypoint,
        container,
        '/mnt/server/.sodium_install.sh'
      ]);

      let output = '';
      proc.stdout.on('data', (d) => {
        output += d.toString();
        this.emit('install_output', server.uuid, d.toString());
      });
      proc.stderr.on('data', (d) => {
        output += d.toString();
        this.emit('install_output', server.uuid, d.toString());
      });
      proc.on('close', async (code) => {
        try { await fs.unlink(scriptPath); } catch {}
        code === 0 ? resolve(output) : reject(new Error(`Install failed: ${code}`));
      });
    });
  }

  buildEnvironment(server, egg) {
    const env = {
      SERVER_MEMORY: server.memory,
      SERVER_PORT: server.port,
      SERVER_IP: server.ip || '0.0.0.0',
      TZ: process.env.TZ || 'UTC'
    };

    const variables = egg.variables || [];
    const serverVars = server.variables || {};
    for (const v of variables) {
      env[v.env_variable] = serverVars[v.env_variable] || v.default_value || '';
    }

    return env;
  }

  parseStartup(startup, env) {
    let cmd = startup || '';
    for (const [key, value] of Object.entries(env)) {
      cmd = cmd.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return cmd;
  }

  parseMemory(memStr) {
    const match = memStr?.match(/([\d.]+)([A-Za-z]+)/);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3 };
    return val * (mult[unit] || 1);
  }

  parseNetwork(netStr) {
    if (!netStr) return { rx: 0, tx: 0 };
    const [rx, tx] = netStr.split('/').map(s => this.parseMemory(s.trim()));
    return { rx, tx };
  }

  async cleanup() {
    for (const [, proc] of this.containers) {
      proc.kill();
    }
    this.containers.clear();
  }
}
