import { Router } from 'express';
import auth from '../middleware/auth.js';
import Server from '../models/Server.js';
import scheduler from '../services/scheduler.js';
import db from '../services/database.js';
import { v4 as uuidv4 } from 'uuid';

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

// List schedules
router.get('/:serverId/schedules', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const schedules = db.prepare(`
      SELECT * FROM schedules WHERE server_id = ? ORDER BY created_at DESC
    `).all(server.id);

    res.json({ data: schedules });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get schedule
router.get('/:serverId/schedules/:scheduleId', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const schedule = db.prepare(`
      SELECT * FROM schedules WHERE uuid = ? AND server_id = ?
    `).get(req.params.scheduleId, server.id);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const tasks = db.prepare(`
      SELECT * FROM schedule_tasks WHERE schedule_id = ? ORDER BY sequence
    `).all(schedule.id);

    res.json({ data: { ...schedule, tasks } });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Create schedule
router.post('/:serverId/schedules', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const { name, cron, action, payload, is_active } = req.body;

    if (!name || !cron || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!isValidCron(cron)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    const uuid = uuidv4();
    
    db.prepare(`
      INSERT INTO schedules (uuid, server_id, name, cron, action, payload, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(uuid, server.id, name, cron, action, JSON.stringify(payload || {}), is_active !== false ? 1 : 0);

    const schedule = db.prepare('SELECT * FROM schedules WHERE uuid = ?').get(uuid);
    
    if (schedule.is_active) {
      schedule.server_uuid = server.uuid;
      scheduler.addJob(schedule);
    }

    res.status(201).json({ data: schedule });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Update schedule
router.put('/:serverId/schedules/:scheduleId', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const schedule = db.prepare(`
      SELECT * FROM schedules WHERE uuid = ? AND server_id = ?
    `).get(req.params.scheduleId, server.id);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const { name, cron, action, payload, is_active } = req.body;

    if (cron && !isValidCron(cron)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    db.prepare(`
      UPDATE schedules SET
        name = COALESCE(?, name),
        cron = COALESCE(?, cron),
        action = COALESCE(?, action),
        payload = COALESCE(?, payload),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
      WHERE uuid = ?
    `).run(
      name, cron, action, 
      payload !== undefined ? JSON.stringify(payload) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      req.params.scheduleId
    );

    const updated = db.prepare('SELECT * FROM schedules WHERE uuid = ?').get(req.params.scheduleId);
    updated.server_uuid = server.uuid;
    scheduler.updateJob(updated);

    res.json({ data: updated });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Delete schedule
router.delete('/:serverId/schedules/:scheduleId', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const schedule = db.prepare(`
      SELECT * FROM schedules WHERE uuid = ? AND server_id = ?
    `).get(req.params.scheduleId, server.id);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    db.prepare('DELETE FROM schedules WHERE uuid = ?').run(req.params.scheduleId);
    scheduler.removeJob(schedule.id);

    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Execute schedule now
router.post('/:serverId/schedules/:scheduleId/execute', auth, async (req, res) => {
  try {
    const server = await checkOwnership(req, req.params.serverId);
    
    const schedule = db.prepare(`
      SELECT * FROM schedules WHERE uuid = ? AND server_id = ?
    `).get(req.params.scheduleId, server.id);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    schedule.server_uuid = server.uuid;
    await scheduler.executeJob(schedule);

    res.json({ success: true, message: 'Schedule executed' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

function isValidCron(cron) {
  const parts = cron.split(' ');
  if (parts.length !== 5) return false;
  
  const patterns = [
    /^(\*|([0-9]|[1-5][0-9])(,([0-9]|[1-5][0-9]))*|([0-9]|[1-5][0-9])-([0-9]|[1-5][0-9])|\*\/[0-9]+)$/,  // minute
    /^(\*|([0-9]|1[0-9]|2[0-3])(,([0-9]|1[0-9]|2[0-3]))*|([0-9]|1[0-9]|2[0-3])-([0-9]|1[0-9]|2[0-3])|\*\/[0-9]+)$/,  // hour
    /^(\*|([1-9]|[12][0-9]|3[01])(,([1-9]|[12][0-9]|3[01]))*|([1-9]|[12][0-9]|3[01])-([1-9]|[12][0-9]|3[01])|\*\/[0-9]+)$/,  // day of month
    /^(\*|([1-9]|1[0-2])(,([1-9]|1[0-2]))*|([1-9]|1[0-2])-([1-9]|1[0-2])|\*\/[0-9]+)$/,  // month
    /^(\*|[0-6](,[0-6])*|[0-6]-[0-6]|\*\/[0-9]+)$/  // day of week
  ];

  return parts.every((part, i) => patterns[i].test(part));
}

export default router;
