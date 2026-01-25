/**
 * Sodium Sandbox - gVisor/Bubblewrap isolation layer
 * Provides container-like isolation with resource limits
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export default class Sandbox extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.sandboxesPath = path.resolve(config.sandboxes_path || './sandboxes');
    this.runtimesPath = path.resolve(config.runtimes_path || './runtimes');
    this.binPath = path.resolve('./bin');
    this.processes = new Map();
    this.stats = new Map();
    this.isolation = config.isolation || 'bubblewrap';
  }

  async init() {
    await fs.mkdir(this.sandboxesPath, { recursive: true });
    
    // Detect available isolation method
    if (this.isolation === 'gvisor') {
      const runscPath = path.join(this.binPath, 'runsc');
      if (!existsSync(runscPath)) {
        console.log('⚠️  gVisor not found, falling back to bubblewrap');
        this.isolation = 'bubblewrap';
      }
    }

    if (this.isolation === 'bubblewrap') {
      try {
        await execAsync('which bwrap');
      } catch {
        console.log('⚠️  Bubblewrap not found, using process isolation');
        this.isolation = 'process';
      }
    }

    console.log(`🔒 Isolation mode: ${this.isolation}`);
  }

  getSandboxPath(uuid) {
    return path.join(this.sandboxesPath, uuid);
  }

  async create(uuid, options = {}) {
    const sandboxPath = this.getSandboxPath(uuid);
    await fs.mkdir(sandboxPath, { recursive: true });
    await fs.mkdir(path.join(sandboxPath, 'home'), { recursive: true });
    await fs.mkdir(path.join(sandboxPath, 'tmp'), { recursive: true });

    const meta = {
      uuid,
      runtime: options.runtime || 'node',
      limits: {
        memory_mb: options.memory_mb || this.config.default_limits.memory_mb,
        cpu_percent: options.cpu_percent || this.config.default_limits.cpu_percent,
        disk_mb: options.disk_mb || this.config.default_limits.disk_mb,
        timeout_seconds: options.timeout_seconds || this.config.default_limits.timeout_seconds,
        max_processes: options.max_processes || this.config.default_limits.max_processes,
        max_files: options.max_files || this.config.default_limits.max_files
      },
      created_at: new Date().toISOString(),
      status: 'created'
    };

    await fs.writeFile(
      path.join(sandboxPath, 'meta.json'),
      JSON.stringify(meta, null, 2)
    );

    return meta;
  }

  async start(uuid, command, args = []) {
    const sandboxPath = this.getSandboxPath(uuid);
    const metaPath = path.join(sandboxPath, 'meta.json');
    
    if (!existsSync(metaPath)) {
      throw new Error('Sandbox not found');
    }

    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    const homePath = path.join(sandboxPath, 'home');

    let proc;
    
    switch (this.isolation) {
      case 'gvisor':
        proc = await this.startWithGvisor(uuid, meta, command, args, homePath);
        break;
      case 'bubblewrap':
        proc = await this.startWithBubblewrap(uuid, meta, command, args, homePath);
        break;
      default:
        proc = await this.startWithProcess(uuid, meta, command, args, homePath);
    }

    this.processes.set(uuid, proc);
    this.startStatsMonitor(uuid, proc.pid);

    meta.status = 'running';
    meta.pid = proc.pid;
    meta.started_at = new Date().toISOString();
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

    proc.on('close', async (code) => {
      meta.status = 'stopped';
      meta.exit_code = code;
      meta.stopped_at = new Date().toISOString();
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      this.processes.delete(uuid);
      this.stats.delete(uuid);
      this.emit('exit', uuid, code);
    });

    return proc;
  }

  async startWithGvisor(uuid, meta, command, args, homePath) {
    const runscPath = path.join(this.binPath, 'runsc');
    const configPath = path.join(this.getSandboxPath(uuid), 'oci-config.json');

    // Create OCI spec
    const ociSpec = this.createOCISpec(meta, command, args, homePath);
    await fs.writeFile(configPath, JSON.stringify(ociSpec, null, 2));

    const proc = spawn(runscPath, [
      '--rootless',
      '--network=none',
      'run',
      '-bundle', this.getSandboxPath(uuid),
      uuid
    ], {
      cwd: homePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupProcessHandlers(uuid, proc);
    return proc;
  }

  async startWithBubblewrap(uuid, meta, command, args, homePath) {
    const limits = meta.limits;

    // Build bubblewrap command
    const bwrapArgs = [
      '--unshare-all',
      '--die-with-parent',
      '--new-session',
      
      // Bind mounts
      '--ro-bind', '/usr', '/usr',
      '--ro-bind', '/lib', '/lib',
      '--ro-bind-try', '/lib64', '/lib64',
      '--ro-bind', '/bin', '/bin',
      '--ro-bind-try', '/sbin', '/sbin',
      '--proc', '/proc',
      '--dev', '/dev',
      '--tmpfs', '/tmp',
      '--bind', homePath, '/home/container',
      
      // Environment
      '--setenv', 'HOME', '/home/container',
      '--setenv', 'PATH', '/usr/local/bin:/usr/bin:/bin',
      '--setenv', 'TERM', 'xterm-256color',
      
      // Working directory
      '--chdir', '/home/container',
      
      // User namespace
      '--unshare-user',
      '--uid', '1000',
      '--gid', '1000',
    ];

    // Add network if enabled
    if (!this.config.network?.enabled) {
      bwrapArgs.push('--unshare-net');
    }

    // Add command
    bwrapArgs.push(command, ...args);

    const proc = spawn('bwrap', bwrapArgs, {
      cwd: homePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupProcessHandlers(uuid, proc);

    // Apply cgroup limits if possible
    this.applyCgroupLimits(proc.pid, limits).catch(() => {});

    return proc;
  }

  async startWithProcess(uuid, meta, command, args, homePath) {
    // Basic process isolation without containers
    const limits = meta.limits;

    const env = {
      HOME: homePath,
      PATH: '/usr/local/bin:/usr/bin:/bin',
      TERM: 'xterm-256color',
      NODE_ENV: 'production'
    };

    const proc = spawn(command, args, {
      cwd: homePath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      uid: 1000,
      gid: 1000
    });

    this.setupProcessHandlers(uuid, proc);
    
    // Set resource limits via prlimit if available
    this.applyPrlimit(proc.pid, limits).catch(() => {});

    return proc;
  }

  setupProcessHandlers(uuid, proc) {
    proc.stdout.on('data', (data) => {
      this.emit('output', uuid, data.toString());
    });

    proc.stderr.on('data', (data) => {
      this.emit('output', uuid, data.toString());
    });

    proc.on('error', (err) => {
      this.emit('error', uuid, err);
    });
  }

  async applyCgroupLimits(pid, limits) {
    try {
      // Try cgroups v2
      const cgroupPath = `/sys/fs/cgroup/sodium_${pid}`;
      await fs.mkdir(cgroupPath, { recursive: true });
      
      // Memory limit
      if (limits.memory_mb) {
        await fs.writeFile(
          path.join(cgroupPath, 'memory.max'),
          String(limits.memory_mb * 1024 * 1024)
        );
      }

      // CPU limit (as weight)
      if (limits.cpu_percent) {
        const weight = Math.round(limits.cpu_percent * 100);
        await fs.writeFile(
          path.join(cgroupPath, 'cpu.weight'),
          String(Math.max(1, Math.min(10000, weight)))
        );
      }

      // Add process to cgroup
      await fs.writeFile(path.join(cgroupPath, 'cgroup.procs'), String(pid));
    } catch {
      // Cgroups not available, try cgroups v1 or skip
    }
  }

  async applyPrlimit(pid, limits) {
    const commands = [];

    if (limits.memory_mb) {
      const bytes = limits.memory_mb * 1024 * 1024;
      commands.push(`prlimit --pid ${pid} --as=${bytes}`);
    }

    if (limits.max_processes) {
      commands.push(`prlimit --pid ${pid} --nproc=${limits.max_processes}`);
    }

    if (limits.max_files) {
      commands.push(`prlimit --pid ${pid} --nofile=${limits.max_files}`);
    }

    for (const cmd of commands) {
      try {
        await execAsync(cmd);
      } catch {}
    }
  }

  createOCISpec(meta, command, args, homePath) {
    return {
      ociVersion: '1.0.0',
      process: {
        terminal: false,
        user: { uid: 1000, gid: 1000 },
        args: [command, ...args],
        env: [
          'PATH=/usr/local/bin:/usr/bin:/bin',
          'HOME=/home/container',
          'TERM=xterm-256color'
        ],
        cwd: '/home/container',
        rlimits: [
          { type: 'RLIMIT_AS', hard: meta.limits.memory_mb * 1024 * 1024, soft: meta.limits.memory_mb * 1024 * 1024 },
          { type: 'RLIMIT_NPROC', hard: meta.limits.max_processes, soft: meta.limits.max_processes },
          { type: 'RLIMIT_NOFILE', hard: meta.limits.max_files, soft: meta.limits.max_files }
        ]
      },
      root: { path: homePath, readonly: false },
      mounts: [
        { destination: '/proc', type: 'proc', source: 'proc' },
        { destination: '/dev', type: 'tmpfs', source: 'tmpfs' },
        { destination: '/tmp', type: 'tmpfs', source: 'tmpfs' }
      ],
      linux: {
        namespaces: [
          { type: 'pid' },
          { type: 'mount' },
          { type: 'ipc' },
          { type: 'uts' },
          { type: 'network' }
        ],
        resources: {
          memory: { limit: meta.limits.memory_mb * 1024 * 1024 },
          cpu: { quota: meta.limits.cpu_percent * 1000, period: 100000 },
          pids: { limit: meta.limits.max_processes }
        }
      }
    };
  }

  startStatsMonitor(uuid, pid) {
    const interval = setInterval(async () => {
      if (!this.processes.has(uuid)) {
        clearInterval(interval);
        return;
      }

      try {
        const stats = await this.getProcessStats(pid);
        this.stats.set(uuid, stats);
        this.emit('stats', uuid, stats);
      } catch {}
    }, 1000);
  }

  async getProcessStats(pid) {
    try {
      // Read from /proc
      const stat = await fs.readFile(`/proc/${pid}/stat`, 'utf-8');
      const statm = await fs.readFile(`/proc/${pid}/statm`, 'utf-8');
      const io = await fs.readFile(`/proc/${pid}/io`, 'utf-8').catch(() => '');

      const statParts = stat.split(' ');
      const statmParts = statm.split(' ');

      const pageSize = 4096;
      const rss = parseInt(statmParts[1]) * pageSize;
      const utime = parseInt(statParts[13]);
      const stime = parseInt(statParts[14]);

      let diskRead = 0, diskWrite = 0;
      for (const line of io.split('\n')) {
        if (line.startsWith('read_bytes:')) diskRead = parseInt(line.split(':')[1]);
        if (line.startsWith('write_bytes:')) diskWrite = parseInt(line.split(':')[1]);
      }

      return {
        memory_bytes: rss,
        cpu_ticks: utime + stime,
        disk_read_bytes: diskRead,
        disk_write_bytes: diskWrite
      };
    } catch {
      return { memory_bytes: 0, cpu_ticks: 0, disk_read_bytes: 0, disk_write_bytes: 0 };
    }
  }

  async stop(uuid, timeout = 10) {
    const proc = this.processes.get(uuid);
    if (!proc) return;

    // Try graceful stop
    proc.kill('SIGTERM');

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, timeout * 1000);

      proc.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async kill(uuid) {
    const proc = this.processes.get(uuid);
    if (proc) proc.kill('SIGKILL');
  }

  async sendInput(uuid, input) {
    const proc = this.processes.get(uuid);
    if (proc && proc.stdin.writable) {
      proc.stdin.write(input + '\n');
    }
  }

  async delete(uuid) {
    await this.kill(uuid);
    const sandboxPath = this.getSandboxPath(uuid);
    await fs.rm(sandboxPath, { recursive: true, force: true });
  }

  async getStatus(uuid) {
    const sandboxPath = this.getSandboxPath(uuid);
    const metaPath = path.join(sandboxPath, 'meta.json');
    
    if (!existsSync(metaPath)) return null;
    
    return JSON.parse(await fs.readFile(metaPath, 'utf-8'));
  }

  async list() {
    try {
      const entries = await fs.readdir(this.sandboxesPath, { withFileTypes: true });
      const sandboxes = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const status = await this.getStatus(entry.name);
          if (status) sandboxes.push(status);
        }
      }

      return sandboxes;
    } catch {
      return [];
    }
  }

  getStats(uuid) {
    return this.stats.get(uuid) || { memory_bytes: 0, cpu_ticks: 0, disk_read_bytes: 0, disk_write_bytes: 0 };
  }
}
