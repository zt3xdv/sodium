import { randomUUID } from 'crypto';
import db from '../services/database.js';

class User {
  static create(data) {
    const uuid = randomUUID();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO users (uuid, username, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      uuid,
      data.username,
      data.email,
      data.password_hash,
      data.role || 'user',
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

    if (data.username !== undefined) {
      fields.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email);
    }
    if (data.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(data.password_hash);
    }
    if (data.role !== undefined) {
      fields.push('role = ?');
      values.push(data.role);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
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
