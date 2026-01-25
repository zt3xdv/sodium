import { randomUUID } from 'crypto';
import db from '../services/database.js';

class Node {
  static create(data) {
    const uuid = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO nodes (uuid, name, description, fqdn, scheme, daemon_port, memory, memory_overallocate, disk, disk_overallocate, upload_size, daemon_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      uuid,
      data.name,
      data.description || '',
      data.fqdn,
      data.scheme || 'http',
      data.daemon_port || 8080,
      data.memory || 1024,
      data.memory_overallocate || 0,
      data.disk || 10240,
      data.disk_overallocate || 0,
      data.upload_size || 100,
      data.daemon_token || randomUUID(),
      now,
      now
    );

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM nodes WHERE id = ?');
    return stmt.get(id) || null;
  }

  static findByUuid(uuid) {
    const stmt = db.prepare('SELECT * FROM nodes WHERE uuid = ?');
    return stmt.get(uuid) || null;
  }

  static findAll() {
    const stmt = db.prepare('SELECT * FROM nodes ORDER BY name');
    return stmt.all();
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = ['name', 'description', 'fqdn', 'scheme', 'daemon_port', 'memory', 'memory_overallocate', 'disk', 'disk_overallocate', 'upload_size', 'maintenance_mode'];

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

    const stmt = db.prepare(`UPDATE nodes SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM nodes WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static updateStatus(uuid, status) {
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE nodes SET status = ?, last_seen_at = ?, updated_at = ? WHERE uuid = ?');
    stmt.run(status, now, now, uuid);
    return this.findByUuid(uuid);
  }

  static findByToken(token) {
    const stmt = db.prepare('SELECT * FROM nodes WHERE daemon_token = ?');
    return stmt.get(token) || null;
  }

  static getOnlineNodes() {
    const stmt = db.prepare("SELECT * FROM nodes WHERE status = 'online' ORDER BY name");
    return stmt.all();
  }

  static getWithStats(id) {
    const stmt = db.prepare(`
      SELECT 
        n.*,
        (SELECT COUNT(*) FROM allocations WHERE node_id = n.id) as allocation_count,
        (SELECT COUNT(*) FROM allocations WHERE node_id = n.id AND server_id IS NOT NULL) as allocated_count,
        (SELECT COUNT(*) FROM servers s 
         JOIN allocations a ON s.id = a.server_id 
         WHERE a.node_id = n.id) as server_count
      FROM nodes n
      WHERE n.id = ?
    `);
    return stmt.get(id) || null;
  }

  static getAllWithStats() {
    const stmt = db.prepare(`
      SELECT 
        n.*,
        (SELECT COUNT(*) FROM allocations WHERE node_id = n.id) as allocation_count,
        (SELECT COUNT(*) FROM allocations WHERE node_id = n.id AND server_id IS NOT NULL) as allocated_count,
        (SELECT COUNT(*) FROM servers s 
         JOIN allocations a ON s.id = a.server_id 
         WHERE a.node_id = n.id) as server_count
      FROM nodes n
      ORDER BY n.name
    `);
    return stmt.all();
  }
}

export default Node;
