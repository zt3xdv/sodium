import { Router } from 'express';
import admin from '../middleware/admin.js';
import Node from '../models/Node.js';
import Allocation from '../models/Allocation.js';

const router = Router();

router.get('/', admin, (req, res) => {
  try {
    const nodes = Node.findAll();
    res.json({ data: nodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', admin, (req, res) => {
  try {
    const node = Node.getStats(parseInt(req.params.id));

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({ data: node });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', admin, (req, res) => {
  try {
    const { name, fqdn, scheme, daemon_port, memory, memory_overallocate, disk, disk_overallocate, upload_size } = req.body;

    if (!name || !fqdn) {
      return res.status(400).json({ error: 'Missing required fields: name, fqdn' });
    }

    const node = Node.create({
      name,
      fqdn,
      scheme,
      daemon_port,
      memory,
      memory_overallocate,
      disk,
      disk_overallocate,
      upload_size
    });

    res.status(201).json({ data: node });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', admin, (req, res) => {
  try {
    const node = Node.findById(parseInt(req.params.id));

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const updated = Node.update(node.id, req.body);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', admin, (req, res) => {
  try {
    const node = Node.findById(parseInt(req.params.id));

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const allocations = Allocation.findByNode(node.id);
    const assignedCount = allocations.filter(a => a.server_id).length;

    if (assignedCount > 0) {
      return res.status(400).json({ error: `Cannot delete node with ${assignedCount} active server(s)` });
    }

    for (const alloc of allocations) {
      Allocation.delete(alloc.id);
    }

    Node.delete(node.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/allocations', admin, (req, res) => {
  try {
    const node = Node.findById(parseInt(req.params.id));

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const allocations = Allocation.findByNode(node.id);
    res.json({ data: allocations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/allocations', admin, (req, res) => {
  try {
    const node = Node.findById(parseInt(req.params.id));

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const { ip, port, ports, notes } = req.body;

    if (!ip) {
      return res.status(400).json({ error: 'Missing required field: ip' });
    }

    const created = [];

    if (ports && Array.isArray(ports)) {
      for (const p of ports) {
        try {
          const alloc = Allocation.create({ node_id: node.id, ip, port: p, notes });
          created.push(alloc);
        } catch (e) {
        }
      }
    } else if (port) {
      const alloc = Allocation.create({ node_id: node.id, ip, port, notes });
      created.push(alloc);
    } else {
      return res.status(400).json({ error: 'Missing required field: port or ports' });
    }

    res.status(201).json({ data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
