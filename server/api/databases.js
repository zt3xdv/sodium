import { Router } from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import Server from '../models/Server.js';
import db from '../services/database.js';
import limits from '../services/limits.js';
import { randomUUID, randomBytes } from 'crypto';

const router = Router();

function generatePassword(length = 16) {
  return randomBytes(length).toString('base64').slice(0, length).replace(/[+/=]/g, 'x');
}

function generateUsername(serverUuid) {
  return 's' + serverUuid.replace(/-/g, '').slice(0, 15);
}

async function checkOwnership(req, serverUuid) {
  const server = Server.findByUuid(serverUuid);
  if (!server) throw { status: 404, message: 'Server not found' };
  if (server.owner_id !== req.user.id && req.user.role !== 'admin') {
    throw { status: 403, message: 'Access denied' };
  }
  return server;
}

// Database hosts management (admin only)
router.get('/hosts', auth, admin, (req, res) => {
  try {
    const hosts = db.prepare(`
      SELECT h.*, 
        (SELECT COUNT(*) FROM server_databases WHERE host_id = h.id) as database_count
      FROM database_hosts h
      ORDER BY h.name
    `).all();
    
    const safeHosts = hosts.map(({ password, ...h }) => h);
    res.json({ data: safeHosts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/hosts', auth, admin, (req, res) => {
  try {
    const { name, host, port = 3306, username, password, max_databases = 0, node_id } = req.body;

    if (!name || !host || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const uuid = randomUUID();
    db.prepare(`
      INSERT INTO database_hosts (uuid, name, host, port, username, password, max_databases, node_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(uuid, name, host, port, username, password, max_databases, node_id || null);

    const created = db.prepare('SELECT * FROM database_hosts WHERE uuid = ?').get(uuid);
    const { password: _, ...safeHost } = created;
    res.status(201).json({ data: safeHost });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/hosts/:id', auth, admin, (req, res) => {
  try {
    const dbCount = db.prepare('SELECT COUNT(*) as count FROM server_databases WHERE host_id = ?')
      .get(req.params.id);
    
    if (dbCount?.count > 0) {
      return res.status(400).json({ error: 'Cannot delete host with existing databases' });
    }

    db.prepare('DELETE FROM database_hosts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server databases
router.get('/:serverId/databases', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);

    const databases = db.prepare(`
      SELECT d.*, h.name as host_name, h.host, h.port
      FROM server_databases d
      JOIN database_hosts h ON d.host_id = h.id
      WHERE d.server_id = ?
      ORDER BY d.created_at DESC
    `).all(server.id);

    res.json({ data: databases });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:serverId/databases', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    const { host_id, database_name, remote = '%' } = req.body;

    const canCreate = limits.canCreateDatabase(server.id, req.user.id);
    if (!canCreate.allowed) {
      return res.status(403).json({ error: canCreate.reason });
    }

    if (!host_id) {
      return res.status(400).json({ error: 'Database host is required' });
    }

    const host = db.prepare('SELECT * FROM database_hosts WHERE id = ?').get(host_id);
    if (!host) {
      return res.status(404).json({ error: 'Database host not found' });
    }

    if (host.max_databases > 0) {
      const dbCount = db.prepare('SELECT COUNT(*) as count FROM server_databases WHERE host_id = ?')
        .get(host_id);
      if (dbCount.count >= host.max_databases) {
        return res.status(400).json({ error: 'Database host limit reached' });
      }
    }

    const uuid = randomUUID();
    const dbName = database_name || `s${server.id}_${randomBytes(4).toString('hex')}`;
    const username = generateUsername(server.uuid);
    const password = generatePassword();

    db.prepare(`
      INSERT INTO server_databases (uuid, server_id, host_id, database_name, username, password, remote, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(uuid, server.id, host_id, dbName, username, password, remote);

    const created = db.prepare(`
      SELECT d.*, h.name as host_name, h.host, h.port
      FROM server_databases d
      JOIN database_hosts h ON d.host_id = h.id
      WHERE d.uuid = ?
    `).get(uuid);

    res.status(201).json({ data: created });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Database name already exists' });
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:serverId/databases/:dbUuid/rotate-password', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);

    const database = db.prepare('SELECT * FROM server_databases WHERE uuid = ? AND server_id = ?')
      .get(req.params.dbUuid, server.id);

    if (!database) {
      return res.status(404).json({ error: 'Database not found' });
    }

    const newPassword = generatePassword();
    db.prepare('UPDATE server_databases SET password = ? WHERE uuid = ?')
      .run(newPassword, req.params.dbUuid);

    res.json({ data: { password: newPassword } });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:serverId/databases/:dbUuid', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);

    const database = db.prepare('SELECT * FROM server_databases WHERE uuid = ? AND server_id = ?')
      .get(req.params.dbUuid, server.id);

    if (!database) {
      return res.status(404).json({ error: 'Database not found' });
    }

    db.prepare('DELETE FROM server_databases WHERE uuid = ?').run(req.params.dbUuid);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
