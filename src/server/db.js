import fs from 'fs';
import path from 'path';
import { DATA_DIR, CONFIG_FILE, DEFAULT_CONFIG } from './config.js';
import logger from './utils/logger.js';

const DB_FILE = path.join(DATA_DIR, 'sodium.db');
const MAGIC = Buffer.from('SODIUM01');

const DB_TYPE = process.env.DB_TYPE || 'file';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_NAME = process.env.DB_NAME || 'sodium';
const DB_USER = process.env.DB_USER || 'sodium';
const DB_PASS = process.env.DB_PASS || '';

const COLLECTIONS = {
  users: 1,
  nodes: 2,
  servers: 3,
  nests: 4,
  eggs: 5,
  locations: 6,
  apiKeys: 7,
  announcements: 8,
  auditLogs: 9,
  activityLogs: 10
};

let cache = {
  users: [],
  nodes: [],
  servers: [],
  nests: [],
  eggs: [],
  locations: [],
  apiKeys: [],
  announcements: [],
  auditLogs: [],
  activityLogs: []
};

let dbConnection = null;
let dbDriver = null;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function initExternalDb() {
  if (DB_TYPE === 'file') return false;
  
  try {
    if (DB_TYPE === 'mysql' || DB_TYPE === 'mariadb') {
      const mysql = await import('mysql2/promise');
      dbDriver = 'mysql';
      dbConnection = await mysql.default.createPool({
        host: DB_HOST,
        port: parseInt(DB_PORT),
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASS,
        waitForConnections: true,
        connectionLimit: 10
      });
      await createMysqlTables();
      console.log(`Connected to ${DB_TYPE.toUpperCase()} database`);
      return true;
    } else if (DB_TYPE === 'postgresql' || DB_TYPE === 'postgres') {
      const pg = await import('pg');
      dbDriver = 'postgres';
      dbConnection = new pg.default.Pool({
        host: DB_HOST,
        port: parseInt(DB_PORT),
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASS,
        max: 10
      });
      await createPostgresTables();
      console.log('Connected to PostgreSQL database');
      return true;
    } else if (DB_TYPE === 'sqlite') {
      const sqlite = await import('better-sqlite3');
      dbDriver = 'sqlite';
      const sqliteFile = process.env.DB_FILE || path.join(DATA_DIR, 'sodium.sqlite');
      dbConnection = new sqlite.default(sqliteFile);
      await createSqliteTables();
      console.log('Connected to SQLite database');
      return true;
    }
  } catch (err) {
    console.warn(`External DB (${DB_TYPE}) unavailable, falling back to file DB:`, err.message);
    return false;
  }
  return false;
}

async function createMysqlTables() {
  const tables = Object.keys(COLLECTIONS);
  for (const table of tables) {
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id VARCHAR(255) PRIMARY KEY,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }
}

async function createPostgresTables() {
  const tables = Object.keys(COLLECTIONS);
  for (const table of tables) {
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

function createSqliteTables() {
  const tables = Object.keys(COLLECTIONS);
  for (const table of tables) {
    dbConnection.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

async function loadFromExternalDb() {
  const tables = Object.keys(COLLECTIONS);
  for (const table of tables) {
    try {
      let rows;
      if (dbDriver === 'mysql') {
        [rows] = await dbConnection.execute(`SELECT id, data FROM ${table}`);
      } else if (dbDriver === 'postgres') {
        const result = await dbConnection.query(`SELECT id, data FROM ${table}`);
        rows = result.rows;
      } else if (dbDriver === 'sqlite') {
        rows = dbConnection.prepare(`SELECT id, data FROM ${table}`).all();
      }
      cache[table] = rows.map(r => {
        const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        return { id: r.id, ...data };
      });
    } catch (err) {
      logger.warn(`Failed to load table ${table}: ${err.message}`);
      cache[table] = [];
    }
  }
}

async function saveToExternalDb(collection, record) {
  const { id, ...rest } = record;
  const data = JSON.stringify(rest);
  
  if (dbDriver === 'mysql') {
    await dbConnection.execute(
      `INSERT INTO ${collection} (id, data) VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE data = ?, updated_at = CURRENT_TIMESTAMP`,
      [id, data, data]
    );
  } else if (dbDriver === 'postgres') {
    await dbConnection.query(
      `INSERT INTO ${collection} (id, data) VALUES ($1, $2) 
       ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
      [id, data]
    );
  } else if (dbDriver === 'sqlite') {
    dbConnection.prepare(
      `INSERT OR REPLACE INTO ${collection} (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`
    ).run(id, data);
  }
}

async function deleteFromExternalDb(collection, id) {
  if (dbDriver === 'mysql') {
    await dbConnection.execute(`DELETE FROM ${collection} WHERE id = ?`, [id]);
  } else if (dbDriver === 'postgres') {
    await dbConnection.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
  } else if (dbDriver === 'sqlite') {
    dbConnection.prepare(`DELETE FROM ${collection} WHERE id = ?`).run(id);
  }
}

async function syncCollectionToExternalDb(collection) {
  if (!dbConnection) return;
  
  if (dbDriver === 'mysql') {
    await dbConnection.execute(`DELETE FROM ${collection}`);
  } else if (dbDriver === 'postgres') {
    await dbConnection.query(`DELETE FROM ${collection}`);
  } else if (dbDriver === 'sqlite') {
    dbConnection.prepare(`DELETE FROM ${collection}`).run();
  }
  
  for (const record of cache[collection]) {
    await saveToExternalDb(collection, record);
  }
}

function encodeRecord(record) {
  const json = JSON.stringify(record);
  const data = Buffer.from(json, 'utf8');
  const buf = Buffer.alloc(4 + data.length);
  buf.writeUInt32LE(data.length, 0);
  data.copy(buf, 4);
  return buf;
}

function encodeCollection(collectionId, records) {
  const encoded = records.map(encodeRecord);
  const totalDataSize = encoded.reduce((sum, b) => sum + b.length, 0);
  const header = Buffer.alloc(5);
  header.writeUInt8(collectionId, 0);
  header.writeUInt32LE(records.length, 1);
  return Buffer.concat([header, ...encoded], 5 + totalDataSize);
}

function saveDatabase() {
  if (dbConnection) return;
  const collections = Object.entries(COLLECTIONS).map(([name, id]) => 
    encodeCollection(id, cache[name] || [])
  );
  const collectionCount = Buffer.alloc(1);
  collectionCount.writeUInt8(collections.length, 0);
  const data = Buffer.concat([MAGIC, collectionCount, ...collections]);
  fs.writeFileSync(DB_FILE, data);
}

function loadDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    migrateFromJson();
    return;
  }

  const data = fs.readFileSync(DB_FILE);
  if (data.length < 9 || !data.subarray(0, 8).equals(MAGIC)) {
    migrateFromJson();
    return;
  }

  let offset = 8;
  const collectionCount = data.readUInt8(offset++);
  const expectedCollectionCount = Object.keys(COLLECTIONS).length;
  const idToName = Object.fromEntries(
    Object.entries(COLLECTIONS).map(([k, v]) => [v, k])
  );

  for (let i = 0; i < collectionCount; i++) {
    const collectionId = data.readUInt8(offset++);
    const recordCount = data.readUInt32LE(offset);
    offset += 4;
    const name = idToName[collectionId];
    if (!name) continue;
    cache[name] = [];

    for (let j = 0; j < recordCount; j++) {
      const len = data.readUInt32LE(offset);
      offset += 4;
      const json = data.subarray(offset, offset + len).toString('utf8');
      offset += len;
      try {
        cache[name].push(JSON.parse(json));
      } catch (err) {
        logger.warn(`Failed to parse record in ${name}: ${err.message}`);
      }
    }
  }
  
  if (collectionCount < expectedCollectionCount) {
    saveDatabase();
  }
}

function migrateFromJson() {
  const files = {
    users: 'users.json',
    nodes: 'nodes.json',
    servers: 'servers.json',
    nests: 'nests.json',
    eggs: 'eggs.json',
    locations: 'locations.json'
  };

  for (const [name, file] of Object.entries(files)) {
    const filePath = path.join(DATA_DIR, file);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        cache[name] = data[name] || [];
        fs.unlinkSync(filePath);
      } catch (err) {
        logger.warn(`Failed to migrate ${file}: ${err.message}`);
        cache[name] = [];
      }
    }
  }
  saveDatabase();
}

let dbReady = false;
const dbReadyPromise = (async () => {
  const useExternal = await initExternalDb();
  if (useExternal) {
    await loadFromExternalDb();
  } else {
    loadDatabase();
  }
  dbReady = true;
})();

export async function waitForDb() {
  await dbReadyPromise;
}

function createCollectionAccessors(name) {
  return {
    load: () => ({ [name]: cache[name] }),
    save: (data) => {
      cache[name] = data[name] || [];
      if (dbConnection) syncCollectionToExternalDb(name);
      else saveDatabase();
    }
  };
}

const usersAccessors = createCollectionAccessors('users');
const nodesAccessors = createCollectionAccessors('nodes');
const serversAccessors = createCollectionAccessors('servers');
const nestsAccessors = createCollectionAccessors('nests');
const eggsAccessors = createCollectionAccessors('eggs');
const locationsAccessors = createCollectionAccessors('locations');
const apiKeysAccessors = createCollectionAccessors('apiKeys');
const announcementsAccessors = createCollectionAccessors('announcements');
const auditLogsAccessors = createCollectionAccessors('auditLogs');
const activityLogsAccessors = createCollectionAccessors('activityLogs');

export const loadUsers = usersAccessors.load;
export const saveUsers = usersAccessors.save;
export const loadNodes = nodesAccessors.load;
export const saveNodes = nodesAccessors.save;
export const loadServers = serversAccessors.load;
export const saveServers = serversAccessors.save;
export const loadNests = nestsAccessors.load;
export const saveNests = nestsAccessors.save;
export const loadEggs = eggsAccessors.load;
export const saveEggs = eggsAccessors.save;
export const loadLocations = locationsAccessors.load;
export const saveLocations = locationsAccessors.save;
export const loadApiKeys = apiKeysAccessors.load;
export const saveApiKeys = apiKeysAccessors.save;
export const loadAnnouncements = announcementsAccessors.load;
export const saveAnnouncements = announcementsAccessors.save;
export const loadAuditLogs = auditLogsAccessors.load;
export const saveAuditLogs = auditLogsAccessors.save;
export const loadActivityLogs = activityLogsAccessors.load;
export const saveActivityLogs = activityLogsAccessors.save;

export function loadConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return {
      panel: { ...DEFAULT_CONFIG.panel, ...config.panel },
      registration: { ...DEFAULT_CONFIG.registration, ...config.registration },
      defaults: { ...DEFAULT_CONFIG.defaults, ...config.defaults },
      features: { ...DEFAULT_CONFIG.features, ...config.features }
    };
  } catch {
    // Config file missing or corrupted, recreate with defaults
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

export function findById(collection, id) {
  return cache[collection]?.find(r => r.id === id);
}

export function findByField(collection, field, value) {
  return cache[collection]?.filter(r => r[field] === value) || [];
}

export function insert(collection, record) {
  if (!cache[collection]) cache[collection] = [];
  cache[collection].push(record);
  if (dbConnection) saveToExternalDb(collection, record);
  else saveDatabase();
  return record;
}

export function updateById(collection, id, updates) {
  const idx = cache[collection]?.findIndex(r => r.id === id);
  if (idx === -1 || idx === undefined) return null;
  cache[collection][idx] = { ...cache[collection][idx], ...updates };
  if (dbConnection) saveToExternalDb(collection, cache[collection][idx]);
  else saveDatabase();
  return cache[collection][idx];
}

export function deleteById(collection, id) {
  if (!cache[collection]) return false;
  const idx = cache[collection].findIndex(r => r.id === id);
  if (idx === -1) return false;
  cache[collection].splice(idx, 1);
  if (dbConnection) deleteFromExternalDb(collection, id);
  else saveDatabase();
  return true;
}

export function count(collection) {
  return cache[collection]?.length || 0;
}

export function getAll(collection) {
  return cache[collection] || [];
}

export function getDbInfo() {
  return {
    type: dbConnection ? DB_TYPE : 'file',
    connected: !!dbConnection,
    driver: dbDriver
  };
}
