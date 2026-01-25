import { Router } from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import Node from '../models/Node.js';
import Allocation from '../models/Allocation.js';
import daemonManager from '../services/daemon-manager.js';

const router = Router();

router.use(auth);

// Get all nodes (users can see node list for server creation)
router.get('/', (req, res) => {
  try {
    const nodes = req.user.role === 'admin' 
      ? Node.getAllWithStats() 
      : Node.findAll();
    res.json({ data: nodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single node
router.get('/:id', (req, res) => {
  try {
    const node = req.user.role === 'admin'
      ? Node.getWithStats(req.params.id)
      : Node.findById(req.params.id);
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json({ data: node });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin only routes
router.post('/', admin, (req, res) => {
  try {
    const { name, fqdn, memory, disk } = req.body;

    if (!name || !fqdn || !memory || !disk) {
      return res.status(400).json({ error: 'Missing required fields: name, fqdn, memory, disk' });
    }

    const node = Node.create(req.body);
    res.status(201).json({ data: node });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', admin, (req, res) => {
  try {
    const node = Node.findById(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const updated = Node.update(req.params.id, req.body);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', admin, (req, res) => {
  try {
    const node = Node.findById(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Check if node has servers
    const stats = Node.getWithStats(req.params.id);
    if (stats.server_count > 0) {
      return res.status(400).json({ error: 'Cannot delete node with active servers' });
    }

    // Delete allocations first
    Allocation.deleteByNode(req.params.id);
    Node.delete(req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get node allocations
router.get('/:id/allocations', admin, (req, res) => {
  try {
    const allocations = Allocation.findByNode(req.params.id);
    res.json({ data: allocations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create allocations for node
router.post('/:id/allocations', admin, (req, res) => {
  try {
    const { ip, ports } = req.body;

    if (!ip || !ports || !Array.isArray(ports)) {
      return res.status(400).json({ error: 'IP and ports array required' });
    }

    const created = Allocation.createBulk(req.params.id, ip, ports);
    res.status(201).json({ data: created, count: created.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get load balancing suggestion
router.get('/suggest/best', auth, (req, res) => {
  try {
    const { memory = 1024, disk = 10240 } = req.query;
    const nodes = Node.getAllWithStats();
    
    if (nodes.length === 0) {
      return res.status(404).json({ error: 'No nodes available' });
    }

    const scored = nodes
      .filter(n => !n.maintenance_mode)
      .map(node => {
        const memOveralloc = 1 + (node.memory_overallocate / 100);
        const diskOveralloc = 1 + (node.disk_overallocate / 100);
        
        const usedMem = (node.server_count || 0) * 1024;
        const usedDisk = (node.server_count || 0) * 10240;
        
        const availableMem = (node.memory * memOveralloc) - usedMem;
        const availableDisk = (node.disk * diskOveralloc) - usedDisk;
        const availableAllocs = node.allocation_count - node.allocated_count;
        
        const canFit = availableMem >= memory && availableDisk >= disk && availableAllocs > 0;
        
        const memScore = availableMem / node.memory;
        const diskScore = availableDisk / node.disk;
        const allocScore = availableAllocs / Math.max(node.allocation_count, 1);
        const loadScore = 1 - ((node.server_count || 0) / Math.max(node.allocation_count, 1));
        
        const score = canFit ? (memScore * 0.3 + diskScore * 0.2 + allocScore * 0.2 + loadScore * 0.3) : 0;
        
        return {
          ...node,
          available_memory: availableMem,
          available_disk: availableDisk,
          available_allocations: availableAllocs,
          can_fit: canFit,
          score
        };
      })
      .filter(n => n.can_fit)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return res.status(404).json({ error: 'No nodes have sufficient resources' });
    }

    res.json({ 
      data: scored[0],
      alternatives: scored.slice(1, 3)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get node configuration for daemon
router.get('/:id/config', admin, (req, res) => {
  try {
    const node = Node.findById(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const daemonConfig = {
      uuid: node.uuid,
      token: node.daemon_token,
      panel_url: `${req.protocol}://${req.get('host')}`,
      host: '0.0.0.0',
      port: node.daemon_port,
      ssl: { enabled: node.scheme === 'https', cert: '', key: '' },
      servers_path: './servers',
      backups_path: './backups',
      logs_path: './logs',
      debug: false,
      auto_connect_panel: true
    };

    res.json({ data: daemonConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get daemon connection status for a node
router.get('/:id/status', admin, (req, res) => {
  try {
    const node = Node.findById(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const connected = daemonManager.isDaemonConnected(node.uuid);
    const stats = daemonManager.getDaemonStats(node.uuid);

    res.json({
      data: {
        uuid: node.uuid,
        name: node.name,
        connected,
        status: node.status,
        last_seen_at: node.last_seen_at,
        stats
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all connected daemons
router.get('/daemons/connected', admin, (req, res) => {
  try {
    const uuids = daemonManager.getConnectedDaemons();
    const daemons = uuids.map(uuid => {
      const node = Node.findByUuid(uuid);
      const stats = daemonManager.getDaemonStats(uuid);
      return {
        uuid,
        name: node?.name || 'Unknown',
        stats
      };
    });
    res.json({ data: daemons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
