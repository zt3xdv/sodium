import fs from 'fs';
import path from 'path';
import {
  DATA_DIR, DATA_FILE, NODES_FILE, SERVERS_FILE, NESTS_FILE,
  EGGS_FILE, LOCATIONS_FILE, CONFIG_FILE, DEFAULT_CONFIG
} from './config.js';

// Inicialización de directorios y archivos
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2));
}

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

// Helpers de carga y guardado
export function loadUsers() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { users: [] }; }
}
export function saveUsers(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

export function loadNodes() {
  try { return JSON.parse(fs.readFileSync(NODES_FILE, 'utf8')); }
  catch { return { nodes: [] }; }
}
export function saveNodes(data) { fs.writeFileSync(NODES_FILE, JSON.stringify(data, null, 2)); }

export function loadServers() {
  try { return JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8')); }
  catch { return { servers: [] }; }
}
export function saveServers(data) { fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2)); }

export function loadNests() {
  try { return JSON.parse(fs.readFileSync(NESTS_FILE, 'utf8')); }
  catch { return { nests: [] }; }
}
export function saveNests(data) { fs.writeFileSync(NESTS_FILE, JSON.stringify(data, null, 2)); }

export function loadEggs() {
  try { return JSON.parse(fs.readFileSync(EGGS_FILE, 'utf8')); }
  catch { return { eggs: [] }; }
}
export function saveEggs(data) { fs.writeFileSync(EGGS_FILE, JSON.stringify(data, null, 2)); }

export function loadLocations() {
  try { return JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8')); }
  catch { return { locations: [] }; }
}
export function saveLocations(data) { fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(data, null, 2)); }

export function loadConfig() {
  try { 
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const merged = {
      panel: { ...DEFAULT_CONFIG.panel, ...config.panel },
      registration: { ...DEFAULT_CONFIG.registration, ...config.registration },
      defaults: { ...DEFAULT_CONFIG.defaults, ...config.defaults }
    };
    return merged;
  } catch { 
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}
export function saveConfig(data) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2)); }
