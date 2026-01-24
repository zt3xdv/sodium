import db from '../services/database.js';

class Allocation {
  static create(data) {
    const stmt = db.prepare(`
      INSERT INTO allocations (node_id, ip, port, server_id, is_primary, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.node_id,
      data.ip,
      data.port,
      data.server_id || null,
      data.is_primary || 0,
      data.notes || null
    );

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM allocations WHERE id = ?');
    return stmt.get(id) || null;
  }

  static findByNode(nodeId) {
    const stmt = db.prepare('SELECT * FROM allocations WHERE node_id = ? ORDER BY ip, port');
    return stmt.all(nodeId);
  }

  static findAvailable(nodeId) {
    const stmt = db.prepare('SELECT * FROM allocations WHERE node_id = ? AND server_id IS NULL ORDER BY ip, port');
    return stmt.all(nodeId);
  }

  static findByServer(serverId) {
    const stmt = db.prepare('SELECT * FROM allocations WHERE server_id = ? ORDER BY is_primary DESC, ip, port');
    return stmt.all(serverId);
  }

  static assign(id, serverId) {
    const stmt = db.prepare('UPDATE allocations SET server_id = ? WHERE id = ?');
    stmt.run(serverId, id);
    return this.findById(id);
  }

  static unassign(id) {
    const stmt = db.prepare('UPDATE allocations SET server_id = NULL, is_primary = 0 WHERE id = ?');
    stmt.run(id);
    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM allocations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static setPrimary(id, serverId) {
    const transaction = db.transaction(() => {
      db.prepare('UPDATE allocations SET is_primary = 0 WHERE server_id = ?').run(serverId);
      db.prepare('UPDATE allocations SET is_primary = 1 WHERE id = ? AND server_id = ?').run(id, serverId);
    });
    transaction();
    return this.findById(id);
  }
}

export default Allocation;
