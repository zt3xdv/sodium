import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', 'config.json');

const defaults = {
  port: 3000,
  host: '0.0.0.0',
  jwt: {
    secret: 'change-me-in-production',
    expiresIn: '7d'
  },
  database: {
    driver: 'sqlite',
    sqlite: {
      path: './data/sodium.db',
      wal_mode: true,
      busy_timeout: 5000,
      cache_size: 2000
    }
  },
  cors: {
    origin: '*'
  },
  debug: false
};

function loadConfig() {
  let fileConfig = {};
  
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(content);
    } catch (err) {
      console.error('Failed to parse config.json:', err.message);
    }
  }

  const config = {
    ...defaults,
    ...fileConfig,
    jwt: { ...defaults.jwt, ...fileConfig.jwt },
    database: {
      ...defaults.database,
      ...fileConfig.database,
      sqlite: { ...defaults.database.sqlite, ...fileConfig.database?.sqlite }
    },
    cors: { ...defaults.cors, ...fileConfig.cors }
  };

  if (process.env.PORT) config.port = parseInt(process.env.PORT, 10);
  if (process.env.HOST) config.host = process.env.HOST;
  if (process.env.JWT_SECRET) config.jwt.secret = process.env.JWT_SECRET;
  if (process.env.JWT_EXPIRES_IN) config.jwt.expiresIn = process.env.JWT_EXPIRES_IN;
  if (process.env.DATABASE_PATH) config.database.sqlite.path = process.env.DATABASE_PATH;
  if (process.env.DEBUG) config.debug = process.env.DEBUG === 'true';

  return config;
}

export const config = loadConfig();
export default config;
