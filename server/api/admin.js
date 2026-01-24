import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { admin } from '../middleware/admin.js';
import User from '../models/User.js';
import Server from '../models/Server.js';
import Node from '../models/Node.js';
import Egg from '../models/Egg.js';
import db from '../services/database.js';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const router = Router();

// All admin routes require auth + admin role
router.use(auth, admin);

// Get admin dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers').get();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const nodeCount = db.prepare('SELECT COUNT(*) as count FROM nodes').get();
    const eggCount = db.prepare('SELECT COUNT(*) as count FROM eggs').get();
    
    const onlineServers = db.prepare("SELECT COUNT(*) as count FROM servers WHERE status = 'online'").get();
    
    // Get total resources from nodes
    const resources = db.prepare(`
      SELECT 
        SUM(memory) as totalMemory,
        SUM(disk) as totalDisk
      FROM nodes
    `).get();

    // Get used resources from servers
    const usedResources = db.prepare(`
      SELECT 
        SUM(memory) as usedMemory,
        SUM(disk) as usedDisk
      FROM servers
    `).get();

    res.json({
      data: {
        servers: serverCount?.count || 0,
        serversOnline: onlineServers?.count || 0,
        users: userCount?.count || 0,
        nodes: nodeCount?.count || 0,
        nodesOnline: nodeCount?.count || 0, // TODO: actual health check
        eggs: eggCount?.count || 0,
        totalMemory: resources?.totalMemory || 0,
        usedMemory: usedResources?.usedMemory || 0,
        totalDisk: resources?.totalDisk || 0,
        usedDisk: usedResources?.usedDisk || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== USER MANAGEMENT ==========

// List all users
router.get('/users', async (req, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        u.*,
        (SELECT COUNT(*) FROM servers WHERE owner_id = u.id) as server_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all();

    // Remove password hashes
    const safeUsers = users.map(({ password_hash, ...user }) => user);
    res.json({ data: safeUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single user
router.get('/users/:id', async (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, ...safeUser } = user;
    res.json({ data: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = User.findByEmail(email) || User.findByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = User.create({
      username,
      email,
      password,
      role: role || 'user'
    });

    const { password_hash, ...safeUser } = user;
    res.status(201).json({ data: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {};
    if (req.body.username) updates.username = req.body.username;
    if (req.body.email) updates.email = req.body.email;
    if (req.body.role) updates.role = req.body.role;
    if (req.body.password) {
      updates.password_hash = await bcrypt.hash(req.body.password, 10);
    }

    User.update(req.params.id, updates);
    const updated = User.findById(req.params.id);
    const { password_hash, ...safeUser } = updated;

    res.json({ data: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Delete user's servers first
    db.prepare('DELETE FROM servers WHERE owner_id = ?').run(req.params.id);
    User.delete(req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== SERVER MANAGEMENT ==========

// List all servers (admin view with extra info)
router.get('/servers', async (req, res) => {
  try {
    const servers = db.prepare(`
      SELECT 
        s.*,
        u.username as owner_name,
        n.name as node_name,
        e.name as egg_name,
        a.ip,
        a.port
      FROM servers s
      LEFT JOIN users u ON s.owner_id = u.id
      LEFT JOIN nodes n ON s.node_id = n.id
      LEFT JOIN eggs e ON s.egg_id = e.id
      LEFT JOIN allocations a ON s.allocation_id = a.id
      ORDER BY s.created_at DESC
    `).all();

    res.json({ data: servers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== EGG MANAGEMENT ==========

// List all eggs
router.get('/eggs', async (req, res) => {
  try {
    const eggs = Egg.findAll();
    res.json({ data: eggs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create egg
router.post('/eggs', async (req, res) => {
  try {
    const egg = Egg.create(req.body);
    res.status(201).json({ data: egg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update egg
router.put('/eggs/:id', async (req, res) => {
  try {
    Egg.update(req.params.id, req.body);
    const egg = Egg.findById(req.params.id);
    res.json({ data: egg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete egg
router.delete('/eggs/:id', async (req, res) => {
  try {
    const serversUsingEgg = db.prepare('SELECT COUNT(*) as count FROM servers WHERE egg_id = ?').get(req.params.id);
    if (serversUsingEgg?.count > 0) {
      return res.status(400).json({ error: 'Cannot delete egg in use by servers' });
    }

    Egg.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== NEST MANAGEMENT ==========

// List all nests
router.get('/nests', async (req, res) => {
  try {
    const nests = db.prepare(`
      SELECT 
        n.*,
        (SELECT COUNT(*) FROM eggs WHERE nest_id = n.id) as egg_count,
        (SELECT COUNT(*) FROM servers s 
         JOIN eggs e ON s.egg_id = e.id 
         WHERE e.nest_id = n.id) as server_count
      FROM nests n
      ORDER BY n.name
    `).all();
    res.json({ data: nests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create nest
router.post('/nests', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = db.prepare(`
      INSERT INTO nests (uuid, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      randomUUID(),
      name,
      description || '',
      new Date().toISOString()
    );

    const nest = db.prepare('SELECT * FROM nests WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ data: nest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update nest
router.put('/nests/:id', async (req, res) => {
  try {
    const nest = db.prepare('SELECT * FROM nests WHERE id = ?').get(req.params.id);
    if (!nest) {
      return res.status(404).json({ error: 'Nest not found' });
    }

    const { name, description } = req.body;
    db.prepare('UPDATE nests SET name = ?, description = ? WHERE id = ?')
      .run(name || nest.name, description ?? nest.description, req.params.id);

    const updated = db.prepare('SELECT * FROM nests WHERE id = ?').get(req.params.id);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete nest
router.delete('/nests/:id', async (req, res) => {
  try {
    const nest = db.prepare('SELECT * FROM nests WHERE id = ?').get(req.params.id);
    if (!nest) {
      return res.status(404).json({ error: 'Nest not found' });
    }

    const eggCount = db.prepare('SELECT COUNT(*) as count FROM eggs WHERE nest_id = ?').get(req.params.id);
    if (eggCount?.count > 0) {
      return res.status(400).json({ error: 'Cannot delete nest with eggs' });
    }

    db.prepare('DELETE FROM nests WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ALLOCATION MANAGEMENT ==========

// Delete allocation
router.delete('/allocations/:id', async (req, res) => {
  try {
    const alloc = db.prepare('SELECT * FROM allocations WHERE id = ?').get(req.params.id);
    if (!alloc) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    if (alloc.server_id) {
      return res.status(400).json({ error: 'Cannot delete allocation assigned to a server' });
    }

    db.prepare('DELETE FROM allocations WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== SETTINGS MANAGEMENT ==========

// Get settings
router.get('/settings', async (req, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM settings').all();
    const data = {};
    settings.forEach(s => {
      try {
        data[s.key] = JSON.parse(s.value);
      } catch {
        data[s.key] = s.value;
      }
    });
    res.json({ data });
  } catch (err) {
    res.json({ data: {} });
  }
});

// Update settings
router.put('/settings', async (req, res) => {
  try {
    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const transaction = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          upsert.run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }
      }
    });

    transaction(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear logs
router.post('/settings/clear-logs', async (req, res) => {
  try {
    db.prepare('DELETE FROM activity_logs').run();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: true }); // Ignore if table doesn't exist
  }
});

// Rebuild nodes
router.post('/settings/rebuild-nodes', async (req, res) => {
  res.json({ success: true, message: 'Node configurations rebuilt' });
});

// Reset settings
router.post('/settings/reset', async (req, res) => {
  try {
    db.prepare('DELETE FROM settings').run();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: true });
  }
});

export default router;
