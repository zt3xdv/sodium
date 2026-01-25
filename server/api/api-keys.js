import { Router } from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import db from '../services/database.js';
import { randomUUID, randomBytes, createHash } from 'crypto';

const router = Router();

const API_PERMISSIONS = {
  SERVERS_READ: 'servers.read',
  SERVERS_CREATE: 'servers.create',
  SERVERS_UPDATE: 'servers.update',
  SERVERS_DELETE: 'servers.delete',
  SERVERS_POWER: 'servers.power',
  SERVERS_CONSOLE: 'servers.console',
  SERVERS_FILES: 'servers.files',
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  NODES_READ: 'nodes.read',
  NODES_CREATE: 'nodes.create',
  NODES_UPDATE: 'nodes.update',
  NODES_DELETE: 'nodes.delete',
  ALLOCATIONS_READ: 'allocations.read',
  ALLOCATIONS_CREATE: 'allocations.create',
  ALLOCATIONS_DELETE: 'allocations.delete'
};

function generateToken() {
  return 'sod_' + randomBytes(32).toString('hex');
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function generateIdentifier() {
  return randomBytes(8).toString('hex');
}

router.get('/permissions', auth, (req, res) => {
  res.json({ data: Object.values(API_PERMISSIONS) });
});

router.get('/', auth, (req, res) => {
  try {
    const keys = db.prepare(`
      SELECT id, uuid, identifier, description, allowed_ips, permissions, last_used_at, expires_at, created_at
      FROM api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user.id);

    const data = keys.map(k => ({
      ...k,
      permissions: JSON.parse(k.permissions || '[]'),
      allowed_ips: k.allowed_ips ? JSON.parse(k.allowed_ips) : null
    }));

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, (req, res) => {
  try {
    const { description, permissions = [], allowed_ips = null, expires_in_days = null } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const validPerms = permissions.filter(p => Object.values(API_PERMISSIONS).includes(p));

    const uuid = randomUUID();
    const identifier = generateIdentifier();
    const token = generateToken();
    const tokenHash = hashToken(token);

    let expiresAt = null;
    if (expires_in_days) {
      const expires = new Date();
      expires.setDate(expires.getDate() + parseInt(expires_in_days));
      expiresAt = expires.toISOString();
    }

    db.prepare(`
      INSERT INTO api_keys (uuid, user_id, identifier, token_hash, description, allowed_ips, permissions, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      uuid,
      req.user.id,
      identifier,
      tokenHash,
      description,
      allowed_ips ? JSON.stringify(allowed_ips) : null,
      JSON.stringify(validPerms),
      expiresAt
    );

    res.status(201).json({
      data: {
        uuid,
        identifier,
        token,
        description,
        permissions: validPerms,
        expires_at: expiresAt
      },
      warning: 'Save this token now. It will not be shown again.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:uuid', auth, (req, res) => {
  try {
    const key = db.prepare('SELECT * FROM api_keys WHERE uuid = ? AND user_id = ?')
      .get(req.params.uuid, req.user.id);

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const { description, permissions, allowed_ips } = req.body;

    const updates = [];
    const values = [];

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (permissions !== undefined) {
      const validPerms = permissions.filter(p => Object.values(API_PERMISSIONS).includes(p));
      updates.push('permissions = ?');
      values.push(JSON.stringify(validPerms));
    }
    if (allowed_ips !== undefined) {
      updates.push('allowed_ips = ?');
      values.push(allowed_ips ? JSON.stringify(allowed_ips) : null);
    }

    if (updates.length > 0) {
      values.push(req.params.uuid);
      db.prepare(`UPDATE api_keys SET ${updates.join(', ')} WHERE uuid = ?`).run(...values);
    }

    const updated = db.prepare(`
      SELECT id, uuid, identifier, description, allowed_ips, permissions, last_used_at, expires_at, created_at
      FROM api_keys WHERE uuid = ?
    `).get(req.params.uuid);

    updated.permissions = JSON.parse(updated.permissions || '[]');
    updated.allowed_ips = updated.allowed_ips ? JSON.parse(updated.allowed_ips) : null;

    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:uuid', auth, (req, res) => {
  try {
    const key = db.prepare('SELECT * FROM api_keys WHERE uuid = ? AND user_id = ?')
      .get(req.params.uuid, req.user.id);

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    db.prepare('DELETE FROM api_keys WHERE uuid = ?').run(req.params.uuid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export function apiKeyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer sod_')) {
    return next();
  }

  const token = authHeader.slice(7);
  const tokenHash = hashToken(token);

  const key = db.prepare(`
    SELECT k.*, u.id as user_id, u.uuid as user_uuid, u.username, u.role
    FROM api_keys k
    JOIN users u ON k.user_id = u.id
    WHERE k.token_hash = ?
  `).get(tokenHash);

  if (!key) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return res.status(401).json({ error: 'API key expired' });
  }

  if (key.allowed_ips) {
    const allowedIps = JSON.parse(key.allowed_ips);
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!allowedIps.includes(clientIp) && !allowedIps.includes('*')) {
      return res.status(403).json({ error: 'IP not allowed' });
    }
  }

  db.prepare('UPDATE api_keys SET last_used_at = datetime("now") WHERE id = ?').run(key.id);

  req.user = {
    id: key.user_id,
    uuid: key.user_uuid,
    username: key.username,
    role: key.role
  };
  req.apiKey = {
    id: key.id,
    permissions: JSON.parse(key.permissions || '[]')
  };

  next();
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.apiKey) return next();
    
    if (!req.apiKey.permissions.includes(permission) && !req.apiKey.permissions.includes('*')) {
      return res.status(403).json({ error: `Missing permission: ${permission}` });
    }
    next();
  };
}

export default router;
