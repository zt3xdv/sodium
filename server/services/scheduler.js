import db from './database.js';
import backup from './backup.js';
import daemonManager from './daemon-manager.js';
import Server from '../models/Server.js';
import Allocation from '../models/Allocation.js';
import Node from '../models/Node.js';

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.interval = null;
  }

  start() {
    this.loadJobs();
    this.interval = setInterval(() => this.tick(), 60000);
    console.log('Scheduler service started');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  loadJobs() {
    try {
      const schedules = db.prepare(`
        SELECT s.*, srv.uuid as server_uuid 
        FROM schedules s
        JOIN servers srv ON s.server_id = srv.id
        WHERE s.is_active = 1
      `).all();

      for (const schedule of schedules) {
        this.jobs.set(schedule.id, schedule);
      }

      console.log(`Loaded ${this.jobs.size} scheduled tasks`);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    }
  }

  async tick() {
    const now = new Date();
    
    for (const [id, job] of this.jobs) {
      if (this.shouldRun(job, now)) {
        await this.executeJob(job);
      }
    }
  }

  shouldRun(job, now) {
    if (!job.cron) return false;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = job.cron.split(' ');
    
    if (!this.matchCronField(minute, now.getMinutes())) return false;
    if (!this.matchCronField(hour, now.getHours())) return false;
    if (!this.matchCronField(dayOfMonth, now.getDate())) return false;
    if (!this.matchCronField(month, now.getMonth() + 1)) return false;
    if (!this.matchCronField(dayOfWeek, now.getDay())) return false;

    return true;
  }

  matchCronField(field, value) {
    if (field === '*') return true;
    
    if (field.includes('/')) {
      const [, step] = field.split('/');
      return value % parseInt(step) === 0;
    }

    if (field.includes(',')) {
      return field.split(',').map(Number).includes(value);
    }

    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return value >= start && value <= end;
    }

    return parseInt(field) === value;
  }

  async executeJob(job) {
    console.log(`Executing scheduled task: ${job.name} for server ${job.server_uuid}`);

    try {
      switch (job.action) {
        case 'power':
          await this.executePowerAction(job);
          break;
        case 'command':
          await this.executeCommand(job);
          break;
        case 'backup':
          await this.executeBackup(job);
          break;
      }

      db.prepare(`
        UPDATE schedules 
        SET last_run = datetime('now'), run_count = run_count + 1
        WHERE id = ?
      `).run(job.id);

    } catch (err) {
      console.error(`Scheduled task failed: ${job.name}`, err);
      
      db.prepare(`
        UPDATE schedules 
        SET last_error = ?, last_run = datetime('now')
        WHERE id = ?
      `).run(err.message, job.id);
    }
  }

  async executePowerAction(job) {
    const payload = JSON.parse(job.payload || '{}');
    const action = payload.action || 'restart';

    // Get node for the server
    const nodeUuid = this.getNodeForServer(job.server_uuid);
    if (!nodeUuid) {
      throw new Error('Server has no node assigned');
    }

    if (!daemonManager.isDaemonConnected(nodeUuid)) {
      throw new Error('Daemon not connected');
    }

    const sent = daemonManager.sendServerPowerAction(nodeUuid, job.server_uuid, action);
    if (!sent) {
      throw new Error('Failed to send power action to daemon');
    }
  }

  async executeCommand(job) {
    const payload = JSON.parse(job.payload || '{}');
    if (!payload.command) return;

    const nodeUuid = this.getNodeForServer(job.server_uuid);
    if (!nodeUuid) {
      throw new Error('Server has no node assigned');
    }

    if (!daemonManager.isDaemonConnected(nodeUuid)) {
      throw new Error('Daemon not connected');
    }

    const sent = daemonManager.sendServerCommand(nodeUuid, job.server_uuid, payload.command);
    if (!sent) {
      throw new Error('Failed to send command to daemon');
    }
  }

  getNodeForServer(serverUuid) {
    const server = Server.findByUuid(serverUuid);
    if (!server) return null;
    
    const allocations = Allocation.findByServer(server.id);
    if (!allocations || allocations.length === 0) return null;
    
    const node = Node.findById(allocations[0].node_id);
    return node?.uuid || null;
  }

  async executeBackup(job) {
    const server = Server.findByUuid(job.server_uuid);
    if (!server) {
      throw new Error('Server not found');
    }
    
    const payload = JSON.parse(job.payload || '{}');
    const result = await backup.createBackup(server, {
      name: payload.name || `Scheduled backup`,
      ignore: payload.ignore || []
    });
    
    console.log(`Backup created for ${job.server_uuid}: ${result.uuid}`);
  }

  addJob(schedule) {
    this.jobs.set(schedule.id, schedule);
  }

  removeJob(scheduleId) {
    this.jobs.delete(scheduleId);
  }

  updateJob(schedule) {
    if (schedule.is_active) {
      this.jobs.set(schedule.id, schedule);
    } else {
      this.jobs.delete(schedule.id);
    }
  }
}

export default new SchedulerService();
