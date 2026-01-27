import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Subimos dos niveles para llegar a la raíz del proyecto (desde src/server)
export const ROOT_DIR = path.resolve(__dirname, '../../');
export const DATA_DIR = path.join(ROOT_DIR, 'data');

export const DB_FILE = path.join(DATA_DIR, 'sodium.db');
export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

export const DEFAULT_CONFIG = {
  panel: { name: 'Sodium Panel', url: 'http://localhost:3000' },
  registration: { enabled: true },
  defaults: { servers: 2, memory: 2048, disk: 10240, cpu: 200, allocations: 5 },
  features: { subusers: true }
};
