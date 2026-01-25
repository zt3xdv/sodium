import { Router } from 'express';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import Allocation from '../models/Allocation.js';

const router = Router();

router.use(auth, admin);

// Get all allocations
router.get('/', (req, res) => {
  try {
    const allocations = Allocation.findAll();
    res.json({ data: allocations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single allocation
router.get('/:id', (req, res) => {
  try {
    const allocation = Allocation.findById(req.params.id);
    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }
    res.json({ data: allocation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create single allocation
router.post('/', (req, res) => {
  try {
    const { node_id, ip, port } = req.body;

    if (!node_id || !ip || !port) {
      return res.status(400).json({ error: 'node_id, ip, and port are required' });
    }

    const allocation = Allocation.create(req.body);
    res.status(201).json({ data: allocation });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Allocation already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update allocation
router.put('/:id', (req, res) => {
  try {
    const allocation = Allocation.findById(req.params.id);
    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    const updated = Allocation.update(req.params.id, req.body);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete allocation
router.delete('/:id', (req, res) => {
  try {
    const allocation = Allocation.findById(req.params.id);
    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    if (allocation.server_id) {
      return res.status(400).json({ error: 'Cannot delete allocation assigned to a server' });
    }

    Allocation.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign allocation to server
router.post('/:id/assign', (req, res) => {
  try {
    const { server_id } = req.body;
    if (!server_id) {
      return res.status(400).json({ error: 'server_id is required' });
    }

    const allocation = Allocation.assign(req.params.id, server_id);
    res.json({ data: allocation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unassign allocation from server
router.post('/:id/unassign', (req, res) => {
  try {
    const allocation = Allocation.unassign(req.params.id);
    res.json({ data: allocation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
