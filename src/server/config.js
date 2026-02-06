import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../../');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

export const DEFAULT_CONFIG = {
  installed: false,
  panel: {
    name: 'Sodium',
    url: 'http://localhost:3000',
    port: 3000
  },
  jwt: {
    secret: ''
  },
  database: {
    type: 'file',
    host: 'localhost',
    port: 3306,
    name: 'sodium',
    user: 'sodium',
    password: ''
  },
  redis: {
    enabled: false,
    host: 'localhost',
    port: 6379,
    password: ''
  },
  registration: {
    enabled: true
  },
  defaults: {
    servers: 2,
    memory: 2048,
    disk: 10240,
    cpu: 200,
    allocations: 5,
    backups: 3
  },
  features: {
    subusers: true
  }
};

let configCache = null;

export function loadFullConfig() {
  if (configCache) return configCache;
  
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      configCache = deepMerge(DEFAULT_CONFIG, data);
      return configCache;
    }
  } catch {}
  
  return DEFAULT_CONFIG;
}

export function saveFullConfig(config) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  configCache = config;
}

export function isInstalled() {
  const config = loadFullConfig();
  return config.installed === true;
}

export function generateJwtSecret() {
  return crypto.randomBytes(64).toString('base64url');
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function clearConfigCache() {
  configCache = null;
}

export function reloadConfig() {
  configCache = null;
  return loadFullConfig();
}
