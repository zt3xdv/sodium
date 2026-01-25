import { Router } from 'express';
import auth from '../middleware/auth.js';
import Server from '../models/Server.js';
import backup from '../services/backup.js';
import limits from '../services/limits.js';
import db from '../services/database.js';
import path from 'path';

const router = Router();

async function checkOwnership(req, serverUuid) {
  const server = await Server.findByUuid(serverUuid);
  if (!server) {
    throw { status: 404, message: 'Server not found' };
  }
  if (server.owner_id !== req.user.id && req.user.role !== 'admin') {
    throw { status: 403, message: 'Access denied' };
  }
  return server;
}

// List backups for a server
router.get('/:serverId/backups', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    const backups = await backup.getBackups(server.id);
    const totalSize = await backup.getBackupSize(server.id);
    
    res.json({ 
      data: backups,
      meta: { totalSize }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Create backup
router.post('/:serverId/backups', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const canCreate = limits.canCreateBackup(server.id, req.user.id);
    if (!canCreate.allowed) {
      return res.status(403).json({ error: canCreate.reason });
    }
    
    const result = await backup.createBackup(server, {
      name: req.body.name,
      ignore: req.body.ignore || ['*.log', 'logs/', 'cache/']
    });

    res.status(201).json({ data: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Download backup
router.get('/:serverId/backups/:backupId/download', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const backupRecord = db.prepare('SELECT * FROM backups WHERE uuid = ? AND server_id = ?')
      .get(req.params.backupId, server.id);
    
    if (!backupRecord) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backupPath = backup.getBackupPath(backupRecord);
    res.download(backupPath, backupRecord.file_name);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Restore backup
router.post('/:serverId/backups/:backupId/restore', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    if (server.status === 'online') {
      return res.status(400).json({ error: 'Stop the server before restoring' });
    }

    await backup.restoreBackup(req.params.backupId, server);
    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Delete backup
router.delete('/:serverId/backups/:backupId', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const backupRecord = db.prepare('SELECT * FROM backups WHERE uuid = ? AND server_id = ?')
      .get(req.params.backupId, server.id);
    
    if (!backupRecord) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    await backup.deleteBackup(req.params.backupId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
