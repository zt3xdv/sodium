import db from './database.js';
import User from '../models/User.js';

class LimitsService {
  getSetting(key, defaultValue = null) {
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      if (!row) return defaultValue;
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    } catch {
      return defaultValue;
    }
  }

  isAdminOnlyServerCreation() {
    return this.getSetting('admin_only_server_creation', false);
  }

  canUserCreateServer(userId, serverData = {}) {
    const user = User.findByIdWithPassword(userId);
    if (!user) return { allowed: false, reason: 'User not found' };

    if (user.role === 'admin') return { allowed: true };

    if (this.isAdminOnlyServerCreation()) {
      return { allowed: false, reason: 'Only administrators can create servers' };
    }

    const serverCheck = User.checkLimit(userId, 'servers', 1);
    if (!serverCheck.allowed) return serverCheck;

    if (serverData.memory) {
      const memoryCheck = User.checkLimit(userId, 'memory', serverData.memory);
      if (!memoryCheck.allowed) return memoryCheck;
    }

    if (serverData.disk) {
      const diskCheck = User.checkLimit(userId, 'disk', serverData.disk);
      if (!diskCheck.allowed) return diskCheck;
    }

    if (serverData.cpu) {
      const cpuCheck = User.checkLimit(userId, 'cpu', serverData.cpu);
      if (!cpuCheck.allowed) return cpuCheck;
    }

    return { allowed: true };
  }

  canCreateBackup(serverId, userId) {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return { allowed: false, reason: 'Server not found' };

    const currentBackups = db.prepare('SELECT COUNT(*) as count FROM backups WHERE server_id = ?').get(serverId);
    const serverLimit = server.limit_backups || 0;

    if (serverLimit > 0 && (currentBackups?.count || 0) >= serverLimit) {
      return {
        allowed: false,
        reason: `Server backup limit reached (${currentBackups.count}/${serverLimit})`,
        current: currentBackups.count,
        limit: serverLimit
      };
    }

    const userCheck = User.checkLimit(userId, 'backups', 1);
    if (!userCheck.allowed) return userCheck;

    return { allowed: true };
  }

  canCreateDatabase(serverId, userId) {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return { allowed: false, reason: 'Server not found' };

    const currentDatabases = db.prepare('SELECT COUNT(*) as count FROM server_databases WHERE server_id = ?').get(serverId);
    const serverLimit = server.limit_databases || 0;

    if (serverLimit > 0 && (currentDatabases?.count || 0) >= serverLimit) {
      return {
        allowed: false,
        reason: `Server database limit reached (${currentDatabases.count}/${serverLimit})`,
        current: currentDatabases.count,
        limit: serverLimit
      };
    }

    const userCheck = User.checkLimit(userId, 'databases', 1);
    if (!userCheck.allowed) return userCheck;

    return { allowed: true };
  }

  canCreateAllocation(serverId, userId) {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return { allowed: false, reason: 'Server not found' };

    const currentAllocations = db.prepare('SELECT COUNT(*) as count FROM allocations WHERE server_id = ?').get(serverId);
    const serverLimit = server.limit_allocations || 1;

    if (serverLimit > 0 && (currentAllocations?.count || 0) >= serverLimit) {
      return {
        allowed: false,
        reason: `Server allocation limit reached (${currentAllocations.count}/${serverLimit})`,
        current: currentAllocations.count,
        limit: serverLimit
      };
    }

    const userCheck = User.checkLimit(userId, 'allocations', 1);
    if (!userCheck.allowed) return userCheck;

    return { allowed: true };
  }

  getServerLimitsUsage(serverId) {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return null;

    const backups = db.prepare('SELECT COUNT(*) as count FROM backups WHERE server_id = ?').get(serverId);
    const databases = db.prepare('SELECT COUNT(*) as count FROM server_databases WHERE server_id = ?').get(serverId);
    const allocations = db.prepare('SELECT COUNT(*) as count FROM allocations WHERE server_id = ?').get(serverId);

    return {
      backups: {
        current: backups?.count || 0,
        limit: server.limit_backups || 0
      },
      databases: {
        current: databases?.count || 0,
        limit: server.limit_databases || 0
      },
      allocations: {
        current: allocations?.count || 0,
        limit: server.limit_allocations || 1
      }
    };
  }

  getUserLimitsWithUsage(userId) {
    const user = User.findByIdWithPassword(userId);
    if (!user) return null;

    const usage = User.getResourceUsage(userId);

    return {
      servers: { current: usage.servers, limit: user.limit_servers || 0 },
      memory: { current: usage.memory, limit: user.limit_memory || 0 },
      disk: { current: usage.disk, limit: user.limit_disk || 0 },
      cpu: { current: usage.cpu, limit: user.limit_cpu || 0 },
      databases: { current: usage.databases, limit: user.limit_databases || 0 },
      backups: { current: usage.backups, limit: user.limit_backups || 0 },
      allocations: { current: usage.allocations, limit: user.limit_allocations || 0 }
    };
  }
}

export default new LimitsService();
