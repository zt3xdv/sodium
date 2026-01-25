import { Router } from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import Server from '../models/Server.js';
import limits from '../services/limits.js';

const router = Router();

function resolveServer(idOrUuid) {
  if (idOrUuid.includes('-')) {
    return Server.findByUuid(idOrUuid);
  }
  return Server.findById(parseInt(idOrUuid));
}

router.get('/', auth, (req, res) => {
  try {
    let servers;
    if (req.user.role === 'admin') {
      servers = Server.findAll();
    } else {
      servers = Server.findByOwner(req.user.id);
    }
    res.json({ data: servers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, (req, res) => {
  try {
    const base = resolveServer(req.params.id);
    if (!base) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    const server = Server.getWithDetails(base.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (req.user.role !== 'admin' && server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ data: server });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, (req, res) => {
  try {
    const { 
      name, owner_id, egg_id, memory, disk, cpu, 
      startup_command, docker_image,
      limit_databases, limit_backups, limit_allocations
    } = req.body;

    const targetOwnerId = req.user.role === 'admin' && owner_id ? owner_id : req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }

    const canCreate = limits.canUserCreateServer(targetOwnerId, { memory, disk, cpu });
    if (!canCreate.allowed) {
      return res.status(403).json({ error: canCreate.reason });
    }

    const serverData = {
      name,
      owner_id: targetOwnerId,
      egg_id,
      memory,
      disk,
      cpu,
      startup_command,
      docker_image
    };

    if (req.user.role === 'admin') {
      serverData.limit_databases = limit_databases;
      serverData.limit_backups = limit_backups;
      serverData.limit_allocations = limit_allocations;
    }

    const server = Server.create(serverData);
    res.status(201).json({ data: server });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, (req, res) => {
  try {
    const server = resolveServer(req.params.id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (req.user.role !== 'admin' && server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allowedFields = req.user.role === 'admin'
      ? ['name', 'owner_id', 'egg_id', 'memory', 'disk', 'cpu', 'startup_command', 'docker_image', 'limit_databases', 'limit_backups', 'limit_allocations']
      : ['name', 'startup_command'];

    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const updated = Server.update(server.id, updateData);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', admin, (req, res) => {
  try {
    const server = resolveServer(req.params.id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    Server.delete(server.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/limits', auth, (req, res) => {
  try {
    const server = resolveServer(req.params.id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (req.user.role !== 'admin' && server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const serverLimits = limits.getServerLimitsUsage(server.id);
    res.json({ data: serverLimits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/power', auth, (req, res) => {
  try {
    const server = resolveServer(req.params.id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (req.user.role !== 'admin' && server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { action } = req.body;
    const validActions = ['start', 'stop', 'restart', 'kill'];

    if (!action || !validActions.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` });
    }

    let newStatus;
    switch (action) {
      case 'start':
        newStatus = 'starting';
        break;
      case 'stop':
        newStatus = 'stopping';
        break;
      case 'restart':
        newStatus = 'restarting';
        break;
      case 'kill':
        newStatus = 'offline';
        break;
    }

    const updated = Server.updateStatus(server.id, newStatus);

    res.json({ data: updated, message: `Power action '${action}' sent` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
