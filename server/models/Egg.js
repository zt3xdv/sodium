import { randomUUID } from 'crypto';
import db from '../services/database.js';

class Egg {
  static create(data) {
    const uuid = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO eggs (uuid, nest_id, name, description, docker_images, startup, config, scripts, variables, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      uuid,
      data.nest_id,
      data.name,
      data.description || '',
      JSON.stringify(data.docker_images || []),
      data.startup || '',
      JSON.stringify(data.config || {}),
      JSON.stringify(data.scripts || {}),
      JSON.stringify(data.variables || []),
      now
    );

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM eggs WHERE id = ?');
    const egg = stmt.get(id);
    return egg ? this.parse(egg) : null;
  }

  static findByUuid(uuid) {
    const stmt = db.prepare('SELECT * FROM eggs WHERE uuid = ?');
    const egg = stmt.get(uuid);
    return egg ? this.parse(egg) : null;
  }

  static findByNest(nestId) {
    const stmt = db.prepare('SELECT * FROM eggs WHERE nest_id = ? ORDER BY name');
    return stmt.all(nestId).map(e => this.parse(e));
  }

  static findAll() {
    const stmt = db.prepare('SELECT * FROM eggs ORDER BY name');
    return stmt.all().map(e => this.parse(e));
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    if (data.nest_id !== undefined) {
      fields.push('nest_id = ?');
      values.push(data.nest_id);
    }
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.docker_images !== undefined) {
      fields.push('docker_images = ?');
      values.push(JSON.stringify(data.docker_images));
    }
    if (data.startup !== undefined) {
      fields.push('startup = ?');
      values.push(data.startup);
    }
    if (data.config !== undefined) {
      fields.push('config = ?');
      values.push(JSON.stringify(data.config));
    }
    if (data.scripts !== undefined) {
      fields.push('scripts = ?');
      values.push(JSON.stringify(data.scripts));
    }
    if (data.variables !== undefined) {
      fields.push('variables = ?');
      values.push(JSON.stringify(data.variables));
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);

    const stmt = db.prepare(`UPDATE eggs SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM eggs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static parse(egg) {
    if (!egg) return null;
    return {
      ...egg,
      docker_images: JSON.parse(egg.docker_images || '[]'),
      config: JSON.parse(egg.config || '{}'),
      scripts: JSON.parse(egg.scripts || '{}'),
      variables: JSON.parse(egg.variables || '[]')
    };
  }
}

export default Egg;
