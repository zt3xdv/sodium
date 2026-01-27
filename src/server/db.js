import fs from 'fs';
import path from 'path';
import { DATA_DIR, CONFIG_FILE, DEFAULT_CONFIG } from './config.js';

const DB_FILE = path.join(DATA_DIR, 'sodium.db');
const MAGIC = Buffer.from('SODIUM01');

const COLLECTIONS = {
  users: 1,
  nodes: 2,
  servers: 3,
  nests: 4,
  eggs: 5,
  locations: 6
};

let cache = {
  users: [],
  nodes: [],
  servers: [],
  nests: [],
  eggs: [],
  locations: []
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
      } catch {}
    }
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
      } catch {
        cache[name] = [];
      }
    }
  }
  saveDatabase();
}

loadDatabase();

export function loadUsers() { return { users: cache.users }; }
export function saveUsers(data) { cache.users = data.users || []; saveDatabase(); }

export function loadNodes() { return { nodes: cache.nodes }; }
export function saveNodes(data) { cache.nodes = data.nodes || []; saveDatabase(); }

export function loadServers() { return { servers: cache.servers }; }
export function saveServers(data) { cache.servers = data.servers || []; saveDatabase(); }

export function loadNests() { return { nests: cache.nests }; }
export function saveNests(data) { cache.nests = data.nests || []; saveDatabase(); }

export function loadEggs() { return { eggs: cache.eggs }; }
export function saveEggs(data) { cache.eggs = data.eggs || []; saveDatabase(); }

export function loadLocations() { return { locations: cache.locations }; }
export function saveLocations(data) { cache.locations = data.locations || []; saveDatabase(); }

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
  saveDatabase();
  return record;
}

export function updateById(collection, id, updates) {
  const idx = cache[collection]?.findIndex(r => r.id === id);
  if (idx === -1 || idx === undefined) return null;
  cache[collection][idx] = { ...cache[collection][idx], ...updates };
  saveDatabase();
  return cache[collection][idx];
}

export function deleteById(collection, id) {
  if (!cache[collection]) return false;
  const idx = cache[collection].findIndex(r => r.id === id);
  if (idx === -1) return false;
  cache[collection].splice(idx, 1);
  saveDatabase();
  return true;
}

export function count(collection) {
  return cache[collection]?.length || 0;
}

export function getAll(collection) {
  return cache[collection] || [];
}
