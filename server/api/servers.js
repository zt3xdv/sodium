import { Router } from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import Server from '../models/Server.js';
import Allocation from '../models/Allocation.js';

const router = Router();

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
    const server = Server.getWithDetails(parseInt(req.params.id));

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (req.user.role !== 'admin' && server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allocations = Allocation.findByServer(server.id);

    res.json({ data: { ...server, allocations } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', admin, (req, res) => {
  try {
    const { name, owner_id, node_id, egg_id, memory, disk, cpu, allocation_id, startup_command, docker_image } = req.body;

    if (!name || !owner_id || !node_id || !egg_id || !allocation_id) {
      return res.status(400).json({ error: 'Missing required fields: name, owner_id, node_id, egg_id, allocation_id' });
    }

    const server = Server.create({
      name,
      owner_id,
      node_id,
      egg_id,
      memory,
      disk,
      cpu,
      allocation_id,
      startup_command,
      docker_image
    });

    Allocation.assign(allocation_id, server.id);
    Allocation.setPrimary(allocation_id, server.id);

    res.status(201).json({ data: server });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, (req, res) => {
  try {
    const server = Server.findById(parseInt(req.params.id));

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (req.user.role !== 'admin' && server.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allowedFields = req.user.role === 'admin'
      ? ['name', 'owner_id', 'node_id', 'egg_id', 'memory', 'disk', 'cpu', 'allocation_id', 'startup_command', 'docker_image']
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
    const server = Server.findById(parseInt(req.params.id));

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const allocations = Allocation.findByServer(server.id);
    for (const alloc of allocations) {
      Allocation.unassign(alloc.id);
    }

    Server.delete(server.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/power', auth, (req, res) => {
  try {
    const server = Server.findById(parseInt(req.params.id));

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
