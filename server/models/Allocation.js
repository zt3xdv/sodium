import db from '../services/database.js';

class Allocation {
  static create(data) {
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO allocations (node_id, ip, port, server_id, alias, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.node_id,
      data.ip,
      data.port,
      data.server_id || null,
      data.alias || null,
      data.notes || null,
      now
    );

    return this.findById(result.lastInsertRowid);
  }

  static createBulk(nodeId, ip, ports) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO allocations (node_id, ip, port, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const created = [];
    for (const port of ports) {
      try {
        const result = stmt.run(nodeId, ip, port, now);
        if (result.changes > 0) {
          created.push(this.findById(result.lastInsertRowid));
        }
      } catch (e) {
        // Ignore duplicates
      }
    }
    return created;
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM allocations WHERE id = ?');
    return stmt.get(id) || null;
  }

  static findByNode(nodeId) {
    const stmt = db.prepare('SELECT * FROM allocations WHERE node_id = ? ORDER BY ip, port');
    return stmt.all(nodeId);
  }

  static findByServer(serverId) {
    const stmt = db.prepare('SELECT * FROM allocations WHERE server_id = ?');
    return stmt.all(serverId);
  }

  static findAvailable(nodeId) {
    const stmt = db.prepare('SELECT * FROM allocations WHERE node_id = ? AND server_id IS NULL ORDER BY ip, port');
    return stmt.all(nodeId);
  }

  static findAll() {
    const stmt = db.prepare(`
      SELECT 
        a.*,
        n.name as node_name,
        s.name as server_name
      FROM allocations a
      LEFT JOIN nodes n ON a.node_id = n.id
      LEFT JOIN servers s ON a.server_id = s.id
      ORDER BY n.name, a.ip, a.port
    `);
    return stmt.all();
  }

  static assign(id, serverId) {
    const stmt = db.prepare('UPDATE allocations SET server_id = ? WHERE id = ?');
    stmt.run(serverId, id);
    return this.findById(id);
  }

  static unassign(id) {
    const stmt = db.prepare('UPDATE allocations SET server_id = NULL WHERE id = ?');
    stmt.run(id);
    return this.findById(id);
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    if (data.alias !== undefined) {
      fields.push('alias = ?');
      values.push(data.alias);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      values.push(data.notes);
    }
    if (data.server_id !== undefined) {
      fields.push('server_id = ?');
      values.push(data.server_id);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const stmt = db.prepare(`UPDATE allocations SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM allocations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static deleteByNode(nodeId) {
    const stmt = db.prepare('DELETE FROM allocations WHERE node_id = ? AND server_id IS NULL');
    const result = stmt.run(nodeId);
    return result.changes;
  }
}

export default Allocation;
