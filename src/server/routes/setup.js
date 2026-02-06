import { Router } from 'express';
import { isInstalled, loadFullConfig, saveFullConfig, generateJwtSecret, DEFAULT_CONFIG } from '../config.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ installed: isInstalled() });
});

router.get('/config', (req, res) => {
  if (isInstalled()) {
    return res.status(403).json({ error: 'Already installed' });
  }
  
  const config = loadFullConfig();
  // Don't expose sensitive data
  res.json({
    panel: config.panel,
    database: {
      type: config.database.type,
      host: config.database.host,
      port: config.database.port,
      name: config.database.name,
      user: config.database.user
    },
    redis: {
      enabled: config.redis.enabled,
      host: config.redis.host,
      port: config.redis.port
    },
    registration: config.registration,
    defaults: config.defaults
  });
});

router.post('/complete', async (req, res) => {
  if (isInstalled()) {
    return res.status(403).json({ error: 'Already installed' });
  }
  
  const { panel, database, redis, registration, defaults, admin } = req.body;
  
  if (!admin?.username || !admin?.email || !admin?.password) {
    return res.status(400).json({ error: 'Admin account details required' });
  }
  
  if (admin.password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  try {
    // Build config
    const config = {
      ...DEFAULT_CONFIG,
      installed: true,
      panel: {
        name: panel?.name || 'Sodium',
        url: panel?.url || 'http://localhost:3000',
        port: parseInt(panel?.port) || 3000
      },
      jwt: {
        secret: generateJwtSecret()
      },
      database: {
        type: database?.type || 'file',
        host: database?.host || 'localhost',
        port: parseInt(database?.port) || 3306,
        name: database?.name || 'sodium',
        user: database?.user || 'sodium',
        password: database?.password || ''
      },
      redis: {
        enabled: redis?.enabled || false,
        host: redis?.host || 'localhost',
        port: parseInt(redis?.port) || 6379,
        password: redis?.password || ''
      },
      registration: {
        enabled: registration?.enabled !== false
      },
      defaults: {
        servers: parseInt(defaults?.servers) || 2,
        memory: parseInt(defaults?.memory) || 2048,
        disk: parseInt(defaults?.disk) || 10240,
        cpu: parseInt(defaults?.cpu) || 200,
        allocations: parseInt(defaults?.allocations) || 5,
        backups: parseInt(defaults?.backups) || 3
      }
    };
    
    // Save config
    saveFullConfig(config);
    
    // Create admin user
    const bcrypt = await import('bcryptjs');
    const crypto = await import('crypto');
    const { insert } = await import('../db.js');
    
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    const adminUser = {
      id: crypto.randomUUID(),
      username: admin.username,
      email: admin.email,
      password: hashedPassword,
      role: 'admin',
      isAdmin: true,
      createdAt: new Date().toISOString()
    };
    
    insert('users', adminUser);
    
    res.json({ success: true, message: 'Setup complete. Please restart the server.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-database', async (req, res) => {
  const { type, host, port, name, user, password } = req.body;
  
  if (type === 'file') {
    return res.json({ success: true, message: 'File database requires no connection' });
  }
  
  try {
    if (type === 'mysql' || type === 'mariadb') {
      let mysql;
      try {
        mysql = await import('mysql2/promise');
      } catch {
        return res.status(400).json({ 
          error: 'MySQL driver not installed. Run: npm install mysql2' 
        });
      }
      const conn = await mysql.default.createConnection({
        host,
        port: parseInt(port),
        database: name,
        user,
        password,
        connectTimeout: 5000
      });
      await conn.ping();
      await conn.end();
      return res.json({ success: true, message: 'MySQL connection successful' });
    }
    
    if (type === 'postgresql' || type === 'postgres') {
      let pg;
      try {
        pg = await import('pg');
      } catch {
        return res.status(400).json({ 
          error: 'PostgreSQL driver not installed. Run: npm install pg' 
        });
      }
      const client = new pg.default.Client({
        host,
        port: parseInt(port),
        database: name,
        user,
        password,
        connectionTimeoutMillis: 5000
      });
      await client.connect();
      await client.end();
      return res.json({ success: true, message: 'PostgreSQL connection successful' });
    }
    
    if (type === 'sqlite') {
      let Database;
      try {
        const sqlite = await import('better-sqlite3');
        Database = sqlite.default;
      } catch {
        return res.status(400).json({ 
          error: 'SQLite driver not installed. Run: npm install better-sqlite3' 
        });
      }
      return res.json({ success: true, message: 'SQLite driver installed' });
    }
    
    res.status(400).json({ error: 'Unknown database type' });
  } catch (err) {
    res.status(400).json({ error: `Connection failed: ${err.message}` });
  }
});

router.post('/test-redis', async (req, res) => {
  const { host, port, password } = req.body;
  
  try {
    let redis;
    try {
      redis = await import('redis');
    } catch {
      return res.status(400).json({ 
        error: 'Redis package not installed. Run: npm install redis' 
      });
    }
    
    const client = redis.createClient({
      socket: { host, port: parseInt(port) },
      password: password || undefined
    });
    
    await client.connect();
    await client.ping();
    await client.disconnect();
    
    res.json({ success: true, message: 'Redis connection successful' });
  } catch (err) {
    res.status(400).json({ error: `Redis connection failed: ${err.message}` });
  }
});

export default router;
