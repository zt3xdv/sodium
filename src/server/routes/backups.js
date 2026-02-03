import express from 'express';
import { loadServers, saveServers, loadNodes, loadConfig } from '../db.js';
import { wingsRequest, generateUUID } from '../utils/helpers.js';
import { hasPermission } from '../utils/permissions.js';
import { authenticateUser } from '../utils/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

async function getServerAndNode(serverId, user, requiredPermission = null) {
  const data = loadServers();
  const server = data.servers.find(s => s.id === serverId);
  if (!server) return { error: 'Server not found', status: 404 };
  
  if (server.suspended) {
    return { error: 'Server is suspended', status: 403 };
  }
  
  if (!user) return { error: 'User not found', status: 404 };
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  
  if (user.isAdmin || server.user_id === user.id) {
    if (!node) return { error: 'Node not available', status: 400 };
    return { server, node, user, isOwner: true };
  }
  
  const subuser = (server.subusers || []).find(s => s.user_id === user.id);
  if (!subuser) return { error: 'Forbidden', status: 403 };
  
  if (requiredPermission && !hasPermission(subuser, requiredPermission)) {
    return { error: 'Permission denied', status: 403 };
  }
  
  if (!node) return { error: 'Node not available', status: 400 };
  return { server, node, user, isOwner: false, subuser };
}

// GET /:serverId/backups - List backups
router.get('/:serverId/backups', authenticateUser, async (req, res) => {
  const result = await getServerAndNode(req.params.serverId, req.user, 'backup.read');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server } = result;
  const backups = server.backups || [];
  
  res.json({ backups });
});

// POST /:serverId/backups - Create backup
router.post('/:serverId/backups', authenticateUser, async (req, res) => {
  const { name, ignored } = req.body;
  
  const result = await getServerAndNode(req.params.serverId, req.user, 'backup.create');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  
  // Check backup limit
  const backupLimit = server.feature_limits?.backups || 3;
  const currentBackups = server.backups || [];
  
  if (currentBackups.length >= backupLimit) {
    return res.status(400).json({ error: `Backup limit reached (${backupLimit})` });
  }
  
  const backupId = generateUUID();
  const backupName = name || `Backup ${new Date().toLocaleDateString()}`;
  
  const newBackup = {
    id: backupId,
    uuid: backupId,
    name: backupName,
    ignored_files: ignored || [],
    bytes: 0,
    checksum: null,
    is_successful: false,
    is_locked: false,
    created_at: new Date().toISOString(),
    completed_at: null
  };
  
  // Save backup to database first
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.serverId);
  
  if (!data.servers[serverIdx].backups) {
    data.servers[serverIdx].backups = [];
  }
  data.servers[serverIdx].backups.push(newBackup);
  saveServers(data);
  
  // Request backup from Wings
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/backup`, {
      backup_uuid: backupId,
      ignore: ignored || []
    });
  } catch (e) {
    logger.warn(`Backup request failed: ${e.message}`);
    // Keep backup in pending state, Wings might process it later
  }
  
  res.json({ success: true, backup: newBackup });
});

// GET /:serverId/backups/:backupId - Get backup details
router.get('/:serverId/backups/:backupId', authenticateUser, async (req, res) => {
  const result = await getServerAndNode(req.params.serverId, req.user, 'backup.read');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server } = result;
  const backup = (server.backups || []).find(b => b.id === req.params.backupId);
  
  if (!backup) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  res.json({ backup });
});

// DELETE /:serverId/backups/:backupId - Delete backup
router.delete('/:serverId/backups/:backupId', authenticateUser, async (req, res) => {
  const result = await getServerAndNode(req.params.serverId, req.user, 'backup.delete');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  const backupIdx = (server.backups || []).findIndex(b => b.id === req.params.backupId);
  
  if (backupIdx === -1) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  const backup = server.backups[backupIdx];
  
  if (backup.is_locked) {
    return res.status(400).json({ error: 'Backup is locked' });
  }
  
  // Delete from Wings
  try {
    await wingsRequest(node, 'DELETE', `/api/servers/${server.uuid}/backup/${backup.uuid}`);
  } catch (e) {
    logger.warn(`Backup delete from Wings failed: ${e.message}`);
  }
  
  // Remove from database
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.serverId);
  data.servers[serverIdx].backups = (data.servers[serverIdx].backups || [])
    .filter(b => b.id !== req.params.backupId);
  saveServers(data);
  
  res.json({ success: true });
});

// POST /:serverId/backups/:backupId/restore - Restore backup
router.post('/:serverId/backups/:backupId/restore', authenticateUser, async (req, res) => {
  const result = await getServerAndNode(req.params.serverId, req.user, 'backup.restore');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  const backup = (server.backups || []).find(b => b.id === req.params.backupId);
  
  if (!backup) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  if (!backup.is_successful) {
    return res.status(400).json({ error: 'Backup is not complete' });
  }
  
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/backup/${backup.uuid}/restore`);
    res.json({ success: true });
  } catch (e) {
    logger.error(`Backup restore failed: ${e.message}`);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// GET /:serverId/backups/:backupId/download - Get download URL
router.get('/:serverId/backups/:backupId/download', authenticateUser, async (req, res) => {
  const result = await getServerAndNode(req.params.serverId, req.user, 'backup.read');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  const backup = (server.backups || []).find(b => b.id === req.params.backupId);
  
  if (!backup) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  if (!backup.is_successful) {
    return res.status(400).json({ error: 'Backup is not complete' });
  }
  
  try {
    const response = await wingsRequest(node, 'GET', `/api/servers/${server.uuid}/backup/${backup.uuid}`);
    res.json({ url: response.download_url || response.url });
  } catch (e) {
    logger.error(`Backup download URL failed: ${e.message}`);
    res.status(500).json({ error: 'Failed to get download URL' });
  }
});

// POST /:serverId/backups/:backupId/lock - Toggle lock
router.post('/:serverId/backups/:backupId/lock', authenticateUser, async (req, res) => {
  const result = await getServerAndNode(req.params.serverId, req.user, 'backup.delete');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.serverId);
  const backupIdx = (data.servers[serverIdx].backups || []).findIndex(b => b.id === req.params.backupId);
  
  if (backupIdx === -1) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  data.servers[serverIdx].backups[backupIdx].is_locked = 
    !data.servers[serverIdx].backups[backupIdx].is_locked;
  saveServers(data);
  
  res.json({ 
    success: true, 
    is_locked: data.servers[serverIdx].backups[backupIdx].is_locked 
  });
});

export default router;
