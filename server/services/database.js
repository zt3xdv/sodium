import initSqlJs from 'sql.js';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class PreparedStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  run(...params) {
    this.db.run(this.sql, params);
    return {
      changes: this.db.getRowsModified(),
      lastInsertRowid: this.db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0
    };
  }

  get(...params) {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params);
    if (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      stmt.free();
      const row = {};
      columns.forEach((col, i) => row[col] = values[i]);
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...params) {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params);
    const rows = [];
    const columns = stmt.getColumnNames();
    while (stmt.step()) {
      const values = stmt.get();
      const row = {};
      columns.forEach((col, i) => row[col] = values[i]);
      rows.push(row);
    }
    stmt.free();
    return rows;
  }
}

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = config.database.sqlite.path;
    this.initialized = false;
    this._initPromise = null;
  }

  async init() {
    if (this.initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    await this._initPromise;
  }

  async _doInit() {
    const dbDir = dirname(this.dbPath);
    
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const SQL = await initSqlJs();

    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initialized = true;
  }

  _ensureInit() {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call await db.init() first.');
    }
  }

  save() {
    this._ensureInit();
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  migrate() {
    this._ensureInit();
    const migrationsDir = join(__dirname, '..', 'migrations');
    
    if (!existsSync(migrationsDir)) {
      console.log('No migrations directory found');
      return;
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const executed = this.prepare('SELECT name FROM migrations').all().map(r => r.name);
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (executed.includes(file)) continue;

      console.log(`Running migration: ${file}`);
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      
      this.exec(sql);
      this.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    }

    this.save();
    console.log('Migrations complete');
  }

  prepare(sql) {
    this._ensureInit();
    return new PreparedStatement(this.db, sql);
  }

  transaction(fn) {
    this._ensureInit();
    return () => {
      this.db.run('BEGIN TRANSACTION');
      try {
        fn();
        this.db.run('COMMIT');
        this.save();
      } catch (e) {
        this.db.run('ROLLBACK');
        throw e;
      }
    };
  }

  exec(sql) {
    this._ensureInit();
    this.db.run(sql);
    this.save();
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

const db = new DatabaseService();
export default db;
