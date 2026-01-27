import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Subimos dos niveles para llegar a la raíz del proyecto (desde src/server)
export const ROOT_DIR = path.resolve(__dirname, '../../');
export const DATA_DIR = path.join(ROOT_DIR, 'data');

export const DATA_FILE = path.join(DATA_DIR, 'users.json');
export const NODES_FILE = path.join(DATA_DIR, 'nodes.json');
export const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
export const NESTS_FILE = path.join(DATA_DIR, 'nests.json');
export const EGGS_FILE = path.join(DATA_DIR, 'eggs.json');
export const LOCATIONS_FILE = path.join(DATA_DIR, 'locations.json');
export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

export const DEFAULT_CONFIG = {
  panel: { name: 'Sodium Panel', url: 'http://localhost:3000' },
  registration: { enabled: true },
  defaults: { servers: 2, memory: 2048, disk: 10240, cpu: 200 }
};
