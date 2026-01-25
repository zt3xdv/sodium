import { randomUUID } from 'crypto';
import db from '../services/database.js';

class User {
  static create(data) {
    const uuid = randomUUID();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO users (
        uuid, username, email, password_hash, role, 
        display_name, bio, avatar,
        limit_servers, limit_memory, limit_disk, limit_cpu, 
        limit_databases, limit_backups, limit_allocations,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      uuid,
      data.username,
      data.email,
      data.password_hash,
      data.role || 'user',
      data.display_name || null,
      data.bio || null,
      data.avatar || null,
      data.limit_servers ?? 0,
      data.limit_memory ?? 0,
      data.limit_disk ?? 0,
      data.limit_cpu ?? 0,
      data.limit_databases ?? 0,
      data.limit_backups ?? 0,
      data.limit_allocations ?? 0,
      now,
      now
    );

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id);
    return user ? this.sanitize(user) : null;
  }

  static findByIdWithPassword(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) || null;
  }

  static findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) || null;
  }

  static findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) || null;
  }

  static findAll() {
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all().map(u => this.sanitize(u));
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'username', 'email', 'password_hash', 'role',
      'display_name', 'bio', 'avatar',
      'limit_servers', 'limit_memory', 'limit_disk', 'limit_cpu',
      'limit_databases', 'limit_backups', 'limit_allocations'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static getResourceUsage(userId) {
    const servers = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(memory), 0) as memory, COALESCE(SUM(disk), 0) as disk, COALESCE(SUM(cpu), 0) as cpu FROM servers WHERE owner_id = ?').get(userId);
    const databases = db.prepare('SELECT COUNT(*) as count FROM server_databases WHERE server_id IN (SELECT id FROM servers WHERE owner_id = ?)').get(userId);
    const backups = db.prepare('SELECT COUNT(*) as count FROM backups WHERE server_id IN (SELECT id FROM servers WHERE owner_id = ?)').get(userId);
    const allocations = db.prepare('SELECT COUNT(*) as count FROM allocations WHERE server_id IN (SELECT id FROM servers WHERE owner_id = ?)').get(userId);

    return {
      servers: servers?.count || 0,
      memory: servers?.memory || 0,
      disk: servers?.disk || 0,
      cpu: servers?.cpu || 0,
      databases: databases?.count || 0,
      backups: backups?.count || 0,
      allocations: allocations?.count || 0
    };
  }

  static checkLimit(userId, resource, additionalAmount = 0) {
    const user = this.findByIdWithPassword(userId);
    if (!user) return { allowed: false, reason: 'User not found' };

    const limitField = `limit_${resource}`;
    const limit = user[limitField] || 0;
    
    if (limit === 0) return { allowed: true };

    const usage = this.getResourceUsage(userId);
    const currentUsage = usage[resource] || 0;

    if (currentUsage + additionalAmount > limit) {
      return {
        allowed: false,
        reason: `${resource} limit exceeded (${currentUsage + additionalAmount}/${limit})`,
        current: currentUsage,
        limit: limit
      };
    }

    return { allowed: true, current: currentUsage, limit: limit };
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static sanitize(user) {
    if (!user) return null;
    const { password_hash, ...safe } = user;
    return safe;
  }
}

export default User;
