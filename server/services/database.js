import Database from 'better-sqlite3';
import { readdirSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class DatabaseService {
  constructor() {
    const dbPath = config.database.sqlite.path;
    const dbDir = dirname(dbPath);
    
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath, {
      verbose: config.debug ? console.log : null
    });

    if (config.database.sqlite.wal_mode) {
      this.db.pragma('journal_mode = WAL');
    }
    this.db.pragma(`busy_timeout = ${config.database.sqlite.busy_timeout}`);
    this.db.pragma(`cache_size = ${config.database.sqlite.cache_size}`);
  }

  migrate() {
    const migrationsDir = join(__dirname, '..', 'migrations');
    
    if (!existsSync(migrationsDir)) {
      console.log('No migrations directory found');
      return;
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const executed = this.db.prepare('SELECT name FROM migrations').all().map(r => r.name);
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (executed.includes(file)) continue;

      console.log(`Running migration: ${file}`);
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      
      this.db.exec(sql);
      this.db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    }

    console.log('Migrations complete');
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  transaction(fn) {
    return this.db.transaction(fn);
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  close() {
    this.db.close();
  }
}

const db = new DatabaseService();
export default db;
