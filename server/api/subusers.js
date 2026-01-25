import { Router } from 'express';
import auth from '../middleware/auth.js';
import Server from '../models/Server.js';
import User from '../models/User.js';
import db from '../services/database.js';
import { randomUUID } from 'crypto';

const router = Router();

const PERMISSIONS = {
  CONTROL_CONSOLE: 'control.console',
  CONTROL_START: 'control.start',
  CONTROL_STOP: 'control.stop',
  CONTROL_RESTART: 'control.restart',
  USER_CREATE: 'user.create',
  USER_READ: 'user.read',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  FILE_READ: 'file.read',
  FILE_CREATE: 'file.create',
  FILE_UPDATE: 'file.update',
  FILE_DELETE: 'file.delete',
  FILE_ARCHIVE: 'file.archive',
  BACKUP_CREATE: 'backup.create',
  BACKUP_READ: 'backup.read',
  BACKUP_DELETE: 'backup.delete',
  BACKUP_RESTORE: 'backup.restore',
  SCHEDULE_CREATE: 'schedule.create',
  SCHEDULE_READ: 'schedule.read',
  SCHEDULE_UPDATE: 'schedule.update',
  SCHEDULE_DELETE: 'schedule.delete',
  DATABASE_CREATE: 'database.create',
  DATABASE_READ: 'database.read',
  DATABASE_DELETE: 'database.delete',
  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',
  STARTUP_READ: 'startup.read',
  STARTUP_UPDATE: 'startup.update'
};

async function checkOwnership(req, serverUuid) {
  const server = Server.findByUuid(serverUuid);
  if (!server) throw { status: 404, message: 'Server not found' };
  if (server.owner_id !== req.user.id && req.user.role !== 'admin') {
    throw { status: 403, message: 'Access denied' };
  }
  return server;
}

router.get('/permissions', auth, (req, res) => {
  res.json({ data: Object.values(PERMISSIONS) });
});

router.get('/:serverId/users', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const subusers = db.prepare(`
      SELECT s.*, u.username, u.email
      FROM subusers s
      JOIN users u ON s.user_id = u.id
      WHERE s.server_id = ?
      ORDER BY s.created_at DESC
    `).all(server.id);

    const data = subusers.map(s => ({
      ...s,
      permissions: JSON.parse(s.permissions || '[]')
    }));

    res.json({ data });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:serverId/users/:subuserUuid', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const subuser = db.prepare(`
      SELECT s.*, u.username, u.email
      FROM subusers s
      JOIN users u ON s.user_id = u.id
      WHERE s.uuid = ? AND s.server_id = ?
    `).get(req.params.subuserUuid, server.id);

    if (!subuser) {
      return res.status(404).json({ error: 'Subuser not found' });
    }

    subuser.permissions = JSON.parse(subuser.permissions || '[]');
    res.json({ data: subuser });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:serverId/users', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    const { email, permissions = [] } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found with that email' });
    }

    if (user.id === server.owner_id) {
      return res.status(400).json({ error: 'Cannot add server owner as subuser' });
    }

    const existing = db.prepare('SELECT id FROM subusers WHERE server_id = ? AND user_id = ?')
      .get(server.id, user.id);
    if (existing) {
      return res.status(409).json({ error: 'User is already a subuser' });
    }

    const validPerms = permissions.filter(p => Object.values(PERMISSIONS).includes(p));

    const uuid = randomUUID();
    db.prepare(`
      INSERT INTO subusers (uuid, server_id, user_id, permissions, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(uuid, server.id, user.id, JSON.stringify(validPerms));

    const subuser = db.prepare(`
      SELECT s.*, u.username, u.email
      FROM subusers s
      JOIN users u ON s.user_id = u.id
      WHERE s.uuid = ?
    `).get(uuid);

    subuser.permissions = validPerms;
    res.status(201).json({ data: subuser });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:serverId/users/:subuserUuid', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    const { permissions } = req.body;

    const subuser = db.prepare('SELECT * FROM subusers WHERE uuid = ? AND server_id = ?')
      .get(req.params.subuserUuid, server.id);

    if (!subuser) {
      return res.status(404).json({ error: 'Subuser not found' });
    }

    if (permissions !== undefined) {
      const validPerms = permissions.filter(p => Object.values(PERMISSIONS).includes(p));
      db.prepare(`
        UPDATE subusers SET permissions = ?, updated_at = datetime('now') WHERE uuid = ?
      `).run(JSON.stringify(validPerms), req.params.subuserUuid);
    }

    const updated = db.prepare(`
      SELECT s.*, u.username, u.email
      FROM subusers s
      JOIN users u ON s.user_id = u.id
      WHERE s.uuid = ?
    `).get(req.params.subuserUuid);

    updated.permissions = JSON.parse(updated.permissions || '[]');
    res.json({ data: updated });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:serverId/users/:subuserUuid', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);

    const subuser = db.prepare('SELECT * FROM subusers WHERE uuid = ? AND server_id = ?')
      .get(req.params.subuserUuid, server.id);

    if (!subuser) {
      return res.status(404).json({ error: 'Subuser not found' });
    }

    db.prepare('DELETE FROM subusers WHERE uuid = ?').run(req.params.subuserUuid);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
