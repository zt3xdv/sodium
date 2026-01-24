import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

class DockerService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.dataDir = config.dataDir || './data/servers';
    this.networkName = config.networkName || 'sodium_network';
    this.containers = new Map();
  }

  async init() {
    try {
      await execAsync('docker info');
      await this.ensureNetwork();
      console.log('Docker service initialized');
    } catch (err) {
      console.error('Docker not available:', err.message);
      throw new Error('Docker is required but not available');
    }
  }

  async ensureNetwork() {
    try {
      await execAsync(`docker network inspect ${this.networkName}`);
    } catch {
      await execAsync(`docker network create ${this.networkName}`);
    }
  }

  getContainerName(serverUuid) {
    return `sodium_${serverUuid.substring(0, 12)}`;
  }

  getServerPath(serverUuid) {
    return path.resolve(this.dataDir, serverUuid);
  }

  async createContainer(server, egg) {
    const containerName = this.getContainerName(server.uuid);
    const serverPath = this.getServerPath(server.uuid);

    await fs.mkdir(serverPath, { recursive: true });

    const env = this.buildEnvironment(server, egg);
    const startup = this.parseStartup(egg.startup, env);

    const args = [
      'create',
      '--name', containerName,
      '--network', this.networkName,
      '-m', `${server.memory}m`,
      '--cpus', (server.cpu / 100).toString(),
      '-v', `${serverPath}:/home/container`,
      '-w', '/home/container',
      '--user', '1000:1000',
      '-p', `${server.port}:${server.port}`,
      '-p', `${server.port}:${server.port}/udp`,
      '--restart', 'unless-stopped'
    ];

    for (const [key, value] of Object.entries(env)) {
      args.push('-e', `${key}=${value}`);
    }

    args.push(server.docker_image || egg.docker_images?.[Object.keys(egg.docker_images)[0]]);
    args.push('/bin/sh', '-c', startup);

    const { stdout } = await execAsync(`docker ${args.join(' ')}`);
    return stdout.trim();
  }

  async startContainer(serverUuid) {
    const containerName = this.getContainerName(serverUuid);
    await execAsync(`docker start ${containerName}`);
    this.attachToContainer(serverUuid);
  }

  async stopContainer(serverUuid, timeout = 30) {
    const containerName = this.getContainerName(serverUuid);
    await execAsync(`docker stop -t ${timeout} ${containerName}`);
    this.containers.delete(serverUuid);
  }

  async restartContainer(serverUuid) {
    const containerName = this.getContainerName(serverUuid);
    await execAsync(`docker restart ${containerName}`);
  }

  async killContainer(serverUuid) {
    const containerName = this.getContainerName(serverUuid);
    await execAsync(`docker kill ${containerName}`);
    this.containers.delete(serverUuid);
  }

  async removeContainer(serverUuid) {
    const containerName = this.getContainerName(serverUuid);
    try {
      await execAsync(`docker rm -f ${containerName}`);
    } catch {
      // Container might not exist
    }
    this.containers.delete(serverUuid);
  }

  async getContainerStatus(serverUuid) {
    const containerName = this.getContainerName(serverUuid);
    try {
      const { stdout } = await execAsync(
        `docker inspect --format '{{.State.Status}}' ${containerName}`
      );
      return stdout.trim();
    } catch {
      return 'not_found';
    }
  }

  async getContainerStats(serverUuid) {
    const containerName = this.getContainerName(serverUuid);
    try {
      const { stdout } = await execAsync(
        `docker stats ${containerName} --no-stream --format '{"cpu":"{{.CPUPerc}}","memory":"{{.MemUsage}}","network":"{{.NetIO}}"}'`
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

  attachToContainer(serverUuid) {
    const containerName = this.getContainerName(serverUuid);
    
    if (this.containers.has(serverUuid)) {
      return this.containers.get(serverUuid);
    }

    const proc = spawn('docker', ['logs', '-f', '--tail', '100', containerName]);
    
    proc.stdout.on('data', (data) => {
      this.emit('output', serverUuid, data.toString());
    });

    proc.stderr.on('data', (data) => {
      this.emit('output', serverUuid, data.toString());
    });

    proc.on('close', () => {
      this.containers.delete(serverUuid);
    });

    this.containers.set(serverUuid, proc);
    return proc;
  }

  async sendCommand(serverUuid, command) {
    const containerName = this.getContainerName(serverUuid);
    const status = await this.getContainerStatus(serverUuid);
    
    if (status !== 'running') {
      throw new Error('Container is not running');
    }

    await execAsync(`docker exec ${containerName} sh -c "echo '${command.replace(/'/g, "\\'")}' > /proc/1/fd/0"`);
  }

  async installServer(server, egg) {
    const serverPath = this.getServerPath(server.uuid);
    await fs.mkdir(serverPath, { recursive: true });

    if (!egg.scripts?.install) {
      return;
    }

    const { container, entrypoint, script } = egg.scripts.install;
    const scriptPath = path.join(serverPath, '.sodium_install.sh');
    
    await fs.writeFile(scriptPath, script, { mode: 0o755 });

    const args = [
      'run', '--rm',
      '-v', `${serverPath}:/mnt/server`,
      '-w', '/mnt/server',
      '--entrypoint', entrypoint,
      container,
      '/mnt/server/.sodium_install.sh'
    ];

    const env = this.buildEnvironment(server, egg);
    for (const [key, value] of Object.entries(env)) {
      args.splice(2, 0, '-e', `${key}=${value}`);
    }

    return new Promise((resolve, reject) => {
      const proc = spawn('docker', args);
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
        this.emit('install_output', server.uuid, data.toString());
      });

      proc.stderr.on('data', (data) => {
        output += data.toString();
        this.emit('install_output', server.uuid, data.toString());
      });

      proc.on('close', async (code) => {
        try {
          await fs.unlink(scriptPath);
        } catch {}

        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Install failed with code ${code}`));
        }
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
    let cmd = startup;
    for (const [key, value] of Object.entries(env)) {
      cmd = cmd.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return cmd;
  }

  parseMemory(memStr) {
    const match = memStr.match(/([\d.]+)([A-Za-z]+)/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3 };
    return value * (multipliers[unit] || 1);
  }

  parseNetwork(netStr) {
    const [rx, tx] = netStr.split('/').map(s => {
      const match = s.trim().match(/([\d.]+)([A-Za-z]+)/);
      if (!match) return 0;
      return this.parseMemory(match[0]);
    });
    return { rx, tx };
  }

  async cleanup() {
    for (const [uuid, proc] of this.containers) {
      proc.kill();
    }
    this.containers.clear();
  }
}

export default new DockerService();
