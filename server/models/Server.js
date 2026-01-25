import { randomUUID } from 'crypto';
import db from '../services/database.js';

class Server {
  static create(data) {
    const uuid = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO servers (
        uuid, name, owner_id, egg_id, memory, disk, cpu, status, 
        startup_command, docker_image, 
        limit_databases, limit_backups, limit_allocations,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      uuid,
      data.name,
      data.owner_id,
      data.egg_id,
      data.memory || 1024,
      data.disk || 10240,
      data.cpu || 100,
      data.status || 'offline',
      data.startup_command || '',
      data.docker_image || '',
      data.limit_databases ?? 0,
      data.limit_backups ?? 0,
      data.limit_allocations ?? 1,
      now,
      now
    );

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM servers WHERE id = ?');
    return stmt.get(id) || null;
  }

  static findByUuid(uuid) {
    const stmt = db.prepare('SELECT * FROM servers WHERE uuid = ?');
    return stmt.get(uuid) || null;
  }

  static findByOwner(userId) {
    const stmt = db.prepare('SELECT * FROM servers WHERE owner_id = ? ORDER BY created_at DESC');
    return stmt.all(userId);
  }

  static findAll() {
    const stmt = db.prepare('SELECT * FROM servers ORDER BY created_at DESC');
    return stmt.all();
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'name', 'egg_id', 'memory', 'disk', 'cpu', 'status', 
      'startup_command', 'docker_image',
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

    const stmt = db.prepare(`UPDATE servers SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM servers WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static updateStatus(id, status) {
    const stmt = db.prepare('UPDATE servers SET status = ?, updated_at = ? WHERE id = ?');
    stmt.run(status, new Date().toISOString(), id);
    return this.findById(id);
  }

  static getWithDetails(id) {
    const stmt = db.prepare(`
      SELECT 
        s.*,
        e.name as egg_name,
        e.docker_images as egg_docker_images,
        u.username as owner_username
      FROM servers s
      LEFT JOIN eggs e ON s.egg_id = e.id
      LEFT JOIN users u ON s.owner_id = u.id
      WHERE s.id = ?
    `);
    return stmt.get(id) || null;
  }
}

export default Server;
