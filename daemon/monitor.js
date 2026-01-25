import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default class Monitor {
  constructor(docker) {
    this.docker = docker;
    this.interval = null;
    this.stats = {
      cpu: { usage: 0, cores: os.cpus().length },
      memory: { total: os.totalmem(), used: 0, free: 0 },
      disk: { total: 0, used: 0, free: 0 },
      network: { rx: 0, tx: 0 },
      uptime: 0,
      load: [0, 0, 0]
    };
  }

  async getSystemStats() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();

    let cpuUsage = 0;
    for (const cpu of cpus) {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      cpuUsage += ((total - idle) / total) * 100;
    }
    cpuUsage /= cpus.length;

    let disk = { total: 0, used: 0, free: 0 };
    try {
      const { stdout } = await execAsync("df -B1 / | tail -1 | awk '{print $2,$3,$4}'");
      const [total, used, free] = stdout.trim().split(' ').map(Number);
      disk = { total, used, free };
    } catch {}

    let network = { rx: 0, tx: 0 };
    try {
      const { stdout } = await execAsync("cat /proc/net/dev | grep -E 'eth0|ens|enp' | head -1 | awk '{print $2,$10}'");
      const parts = stdout.trim().split(' ');
      if (parts.length >= 2) {
        network = { rx: Number(parts[0]) || 0, tx: Number(parts[1]) || 0 };
      }
    } catch {}

    this.stats = {
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100,
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown'
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percent: Math.round((usedMem / totalMem) * 100 * 100) / 100
      },
      disk,
      network,
      uptime: os.uptime(),
      load: loadAvg,
      platform: os.platform(),
      hostname: os.hostname()
    };

    return this.stats;
  }

  async getContainersStats() {
    const containers = await this.docker.listContainers();
    const stats = [];

    for (const container of containers) {
      const uuid = container.name.replace('sodium_', '');
      try {
        const containerStats = await this.docker.getContainerStats(uuid);
        stats.push({
          uuid,
          name: container.name,
          state: container.state,
          ...containerStats
        });
      } catch {}
    }

    return stats;
  }

  start(intervalMs = 5000) {
    if (this.interval) return;
    
    this.interval = setInterval(async () => {
      try {
        await this.getSystemStats();
      } catch (err) {
        console.error('Monitor error:', err.message);
      }
    }, intervalMs);

    this.getSystemStats();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getStats() {
    return this.stats;
  }
}
