import { randomUUID } from 'crypto';
import db from '../services/database.js';

class Node {
  static create(data) {
    const uuid = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO nodes (uuid, name, fqdn, scheme, daemon_port, memory, memory_overallocate, disk, disk_overallocate, upload_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      uuid,
      data.name,
      data.fqdn,
      data.scheme || 'https',
      data.daemon_port || 8080,
      data.memory || 0,
      data.memory_overallocate || 0,
      data.disk || 0,
      data.disk_overallocate || 0,
      data.upload_size || 100,
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
    const stmt = db.prepare('SELECT * FROM nodes ORDER BY created_at DESC');
    return stmt.all();
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = ['name', 'fqdn', 'scheme', 'daemon_port', 'memory', 'memory_overallocate', 'disk', 'disk_overallocate', 'upload_size'];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) return this.findById(id);

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

  static getStats(id) {
    const node = this.findById(id);
    if (!node) return null;

    const serversStmt = db.prepare('SELECT COUNT(*) as count, SUM(memory) as memory_used, SUM(disk) as disk_used FROM servers WHERE node_id = ?');
    const stats = serversStmt.get(id);

    return {
      ...node,
      servers_count: stats.count || 0,
      memory_used: stats.memory_used || 0,
      disk_used: stats.disk_used || 0,
      memory_available: node.memory + (node.memory * node.memory_overallocate / 100) - (stats.memory_used || 0),
      disk_available: node.disk + (node.disk * node.disk_overallocate / 100) - (stats.disk_used || 0)
    };
  }

  static getAvailableAllocations(id) {
    const stmt = db.prepare('SELECT * FROM allocations WHERE node_id = ? AND server_id IS NULL ORDER BY ip, port');
    return stmt.all(id);
  }
}

export default Node;
