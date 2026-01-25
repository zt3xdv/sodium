import { Router } from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import Server from '../models/Server.js';
import Allocation from '../models/Allocation.js';
import Node from '../models/Node.js';
import Egg from '../models/Egg.js';
import limits from '../services/limits.js';
import daemonManager from '../services/daemon-manager.js';

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
      servers = Server.findAllWithDetails();
    } else {
      servers = Server.findByOwnerWithDetails(req.user.id);
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

    // Get server's allocation to find the node
    const allocation = Allocation.findByServer(server.id)?.[0];
    if (!allocation) {
      return res.status(400).json({ error: 'Server has no allocation assigned' });
    }

    const node = Node.findById(allocation.node_id);
    if (!node) {
      return res.status(400).json({ error: 'Node not found for server' });
    }

    // Check if daemon is connected
    if (!daemonManager.isDaemonConnected(node.uuid)) {
      return res.status(503).json({ error: 'Daemon is not connected' });
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

    // Send power action to daemon
    const sent = daemonManager.sendServerPowerAction(node.uuid, server.uuid, action);
    if (!sent) {
      return res.status(503).json({ error: 'Failed to send command to daemon' });
    }

    const updated = Server.updateStatus(server.id, newStatus);

    res.json({ data: updated, message: `Power action '${action}' sent to daemon` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send command to server console
router.post('/:id/command', auth, (req, res) => {
  try {
    const server = resolveServer(req.params.id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (req.user.role !== 'admin' && server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const allocation = Allocation.findByServer(server.id)?.[0];
    if (!allocation) {
      return res.status(400).json({ error: 'Server has no allocation assigned' });
    }

    const node = Node.findById(allocation.node_id);
    if (!node) {
      return res.status(400).json({ error: 'Node not found for server' });
    }

    if (!daemonManager.isDaemonConnected(node.uuid)) {
      return res.status(503).json({ error: 'Daemon is not connected' });
    }

    const sent = daemonManager.sendServerCommand(node.uuid, server.uuid, command);
    if (!sent) {
      return res.status(503).json({ error: 'Failed to send command to daemon' });
    }

    res.json({ success: true, message: 'Command sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Install/reinstall server
router.post('/:id/install', auth, async (req, res) => {
  try {
    const server = resolveServer(req.params.id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (req.user.role !== 'admin' && server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!server.egg_id) {
      return res.status(400).json({ error: 'Server has no egg assigned' });
    }

    const egg = Egg.findById(server.egg_id);
    if (!egg) {
      return res.status(400).json({ error: 'Egg not found' });
    }

    const allocation = Allocation.findByServer(server.id)?.[0];
    if (!allocation) {
      return res.status(400).json({ error: 'Server has no allocation assigned' });
    }

    const node = Node.findById(allocation.node_id);
    if (!node) {
      return res.status(400).json({ error: 'Node not found for server' });
    }

    if (!daemonManager.isDaemonConnected(node.uuid)) {
      return res.status(503).json({ error: 'Daemon is not connected' });
    }

    // Prepare server data for daemon
    const serverData = {
      uuid: server.uuid,
      name: server.name,
      memory: server.memory,
      disk: server.disk,
      cpu: server.cpu,
      port: allocation.port,
      ip: allocation.ip,
      docker_image: server.docker_image,
      startup_command: server.startup_command
    };

    // Egg data is already parsed by the model
    const eggData = {
      startup: egg.startup,
      docker_images: egg.docker_images,
      variables: egg.variables,
      scripts: egg.scripts
    };

    const sent = daemonManager.sendServerInstall(node.uuid, server.uuid, serverData, eggData);
    if (!sent) {
      return res.status(503).json({ error: 'Failed to send install request to daemon' });
    }

    Server.updateStatus(server.id, 'installing');

    res.json({ success: true, message: 'Installation started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
