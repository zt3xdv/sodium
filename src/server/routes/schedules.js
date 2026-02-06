import express from 'express';
import { loadSchedules, saveSchedules, loadServers, loadNodes } from '../db.js';
import { authenticateUser } from '../utils/auth.js';
import { generateUUID, wingsRequest } from '../utils/helpers.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.use(authenticateUser);

function getServerAccess(req, serverId) {
  const servers = loadServers();
  const server = servers.servers.find(s => s.id === serverId || s.uuid === serverId);
  if (!server) return null;
  
  if (req.user.isAdmin) return server;
  if (server.user_id === req.user.id) return server;
  
  const subuser = server.subusers?.find(su => su.user_id === req.user.id);
  if (subuser && subuser.permissions.includes('schedule.read')) return server;
  
  return null;
}

function hasSchedulePermission(req, server, permission) {
  if (req.user.isAdmin) return true;
  if (server.user_id === req.user.id) return true;
  
  const subuser = server.subusers?.find(su => su.user_id === req.user.id);
  return subuser?.permissions.includes(permission);
}

// List schedules for a server
router.get('/servers/:serverId/schedules', (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const data = loadSchedules();
  const schedules = data.schedules.filter(s => s.server_id === server.id);
  
  res.json({ schedules });
});

// Get single schedule
router.get('/servers/:serverId/schedules/:scheduleId', (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const data = loadSchedules();
  const schedule = data.schedules.find(s => s.id === req.params.scheduleId && s.server_id === server.id);
  
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  
  res.json({ schedule });
});

// Create schedule
router.post('/servers/:serverId/schedules', (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  if (!hasSchedulePermission(req, server, 'schedule.create')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const { name, minute, hour, day_of_month, day_of_week, month, is_active, only_when_online } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Name is required' });
  
  const data = loadSchedules();
  
  const schedule = {
    id: generateUUID(),
    server_id: server.id,
    name: name.substring(0, 100),
    cron: {
      minute: minute || '*',
      hour: hour || '*',
      day_of_month: day_of_month || '*',
      day_of_week: day_of_week || '*',
      month: month || '*'
    },
    is_active: is_active !== false,
    only_when_online: only_when_online || false,
    tasks: [],
    last_run_at: null,
    next_run_at: calculateNextRun({ minute: minute || '*', hour: hour || '*', day_of_month: day_of_month || '*', day_of_week: day_of_week || '*', month: month || '*' }),
    created_at: new Date().toISOString()
  };
  
  data.schedules.push(schedule);
  saveSchedules(data);
  
  logger.info(`Schedule "${schedule.name}" created for server ${server.name}`);
  
  res.json({ success: true, schedule });
});

// Update schedule
router.put('/servers/:serverId/schedules/:scheduleId', (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  if (!hasSchedulePermission(req, server, 'schedule.update')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const data = loadSchedules();
  const idx = data.schedules.findIndex(s => s.id === req.params.scheduleId && s.server_id === server.id);
  
  if (idx === -1) return res.status(404).json({ error: 'Schedule not found' });
  
  const { name, minute, hour, day_of_month, day_of_week, month, is_active, only_when_online } = req.body;
  
  if (name !== undefined) data.schedules[idx].name = name.substring(0, 100);
  if (is_active !== undefined) data.schedules[idx].is_active = is_active;
  if (only_when_online !== undefined) data.schedules[idx].only_when_online = only_when_online;
  
  if (minute !== undefined || hour !== undefined || day_of_month !== undefined || day_of_week !== undefined || month !== undefined) {
    data.schedules[idx].cron = {
      minute: minute ?? data.schedules[idx].cron.minute,
      hour: hour ?? data.schedules[idx].cron.hour,
      day_of_month: day_of_month ?? data.schedules[idx].cron.day_of_month,
      day_of_week: day_of_week ?? data.schedules[idx].cron.day_of_week,
      month: month ?? data.schedules[idx].cron.month
    };
    data.schedules[idx].next_run_at = calculateNextRun(data.schedules[idx].cron);
  }
  
  saveSchedules(data);
  
  res.json({ success: true, schedule: data.schedules[idx] });
});

// Delete schedule
router.delete('/servers/:serverId/schedules/:scheduleId', (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  if (!hasSchedulePermission(req, server, 'schedule.delete')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const data = loadSchedules();
  const idx = data.schedules.findIndex(s => s.id === req.params.scheduleId && s.server_id === server.id);
  
  if (idx === -1) return res.status(404).json({ error: 'Schedule not found' });
  
  const schedule = data.schedules[idx];
  data.schedules.splice(idx, 1);
  saveSchedules(data);
  
  logger.info(`Schedule "${schedule.name}" deleted from server ${server.name}`);
  
  res.json({ success: true });
});

// Execute schedule now
router.post('/servers/:serverId/schedules/:scheduleId/execute', async (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  if (!hasSchedulePermission(req, server, 'schedule.update')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const data = loadSchedules();
  const schedule = data.schedules.find(s => s.id === req.params.scheduleId && s.server_id === server.id);
  
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  
  try {
    await executeSchedule(schedule, server);
    
    const idx = data.schedules.findIndex(s => s.id === schedule.id);
    data.schedules[idx].last_run_at = new Date().toISOString();
    data.schedules[idx].next_run_at = calculateNextRun(data.schedules[idx].cron);
    saveSchedules(data);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== TASKS ==========

// Create task
router.post('/servers/:serverId/schedules/:scheduleId/tasks', (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  if (!hasSchedulePermission(req, server, 'schedule.update')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const data = loadSchedules();
  const idx = data.schedules.findIndex(s => s.id === req.params.scheduleId && s.server_id === server.id);
  
  if (idx === -1) return res.status(404).json({ error: 'Schedule not found' });
  
  const { action, payload, time_offset, continue_on_failure } = req.body;
  
  const validActions = ['command', 'power', 'backup'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be: command, power, or backup' });
  }
  
  if (action === 'power') {
    const validPower = ['start', 'stop', 'restart', 'kill'];
    if (!validPower.includes(payload)) {
      return res.status(400).json({ error: 'Invalid power action. Must be: start, stop, restart, or kill' });
    }
  }
  
  const task = {
    id: generateUUID(),
    sequence_id: (data.schedules[idx].tasks?.length || 0) + 1,
    action,
    payload: payload || '',
    time_offset: parseInt(time_offset) || 0,
    continue_on_failure: continue_on_failure || false,
    created_at: new Date().toISOString()
  };
  
  if (!data.schedules[idx].tasks) data.schedules[idx].tasks = [];
  data.schedules[idx].tasks.push(task);
  saveSchedules(data);
  
  res.json({ success: true, task });
});

// Update task
router.put('/servers/:serverId/schedules/:scheduleId/tasks/:taskId', (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  if (!hasSchedulePermission(req, server, 'schedule.update')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const data = loadSchedules();
  const scheduleIdx = data.schedules.findIndex(s => s.id === req.params.scheduleId && s.server_id === server.id);
  
  if (scheduleIdx === -1) return res.status(404).json({ error: 'Schedule not found' });
  
  const taskIdx = data.schedules[scheduleIdx].tasks?.findIndex(t => t.id === req.params.taskId);
  
  if (taskIdx === -1 || taskIdx === undefined) return res.status(404).json({ error: 'Task not found' });
  
  const { action, payload, time_offset, continue_on_failure } = req.body;
  
  if (action !== undefined) {
    const validActions = ['command', 'power', 'backup'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    data.schedules[scheduleIdx].tasks[taskIdx].action = action;
  }
  
  if (payload !== undefined) data.schedules[scheduleIdx].tasks[taskIdx].payload = payload;
  if (time_offset !== undefined) data.schedules[scheduleIdx].tasks[taskIdx].time_offset = parseInt(time_offset) || 0;
  if (continue_on_failure !== undefined) data.schedules[scheduleIdx].tasks[taskIdx].continue_on_failure = continue_on_failure;
  
  saveSchedules(data);
  
  res.json({ success: true, task: data.schedules[scheduleIdx].tasks[taskIdx] });
});

// Delete task
router.delete('/servers/:serverId/schedules/:scheduleId/tasks/:taskId', (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  if (!hasSchedulePermission(req, server, 'schedule.update')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const data = loadSchedules();
  const scheduleIdx = data.schedules.findIndex(s => s.id === req.params.scheduleId && s.server_id === server.id);
  
  if (scheduleIdx === -1) return res.status(404).json({ error: 'Schedule not found' });
  
  const taskIdx = data.schedules[scheduleIdx].tasks?.findIndex(t => t.id === req.params.taskId);
  
  if (taskIdx === -1 || taskIdx === undefined) return res.status(404).json({ error: 'Task not found' });
  
  data.schedules[scheduleIdx].tasks.splice(taskIdx, 1);
  
  // Reorder sequence IDs
  data.schedules[scheduleIdx].tasks.forEach((t, i) => t.sequence_id = i + 1);
  
  saveSchedules(data);
  
  res.json({ success: true });
});

// ========== HELPERS ==========

function calculateNextRun(cron) {
  const now = new Date();
  const next = new Date(now);
  
  // Simple next run calculation - find next matching minute
  const minute = cron.minute === '*' ? now.getMinutes() : parseInt(cron.minute);
  const hour = cron.hour === '*' ? now.getHours() : parseInt(cron.hour);
  
  next.setSeconds(0);
  next.setMilliseconds(0);
  
  if (cron.minute !== '*') next.setMinutes(minute);
  if (cron.hour !== '*') next.setHours(hour);
  
  // If next is in the past, add appropriate time
  if (next <= now) {
    if (cron.minute !== '*' && cron.hour === '*') {
      next.setHours(next.getHours() + 1);
    } else if (cron.hour !== '*') {
      next.setDate(next.getDate() + 1);
    } else {
      next.setMinutes(next.getMinutes() + 1);
    }
  }
  
  return next.toISOString();
}

async function executeSchedule(schedule, server) {
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  
  if (!node) throw new Error('Node not found');
  
  const sortedTasks = [...(schedule.tasks || [])].sort((a, b) => a.sequence_id - b.sequence_id);
  
  for (const task of sortedTasks) {
    if (task.time_offset > 0) {
      await new Promise(resolve => setTimeout(resolve, task.time_offset * 1000));
    }
    
    try {
      await executeTask(task, server, node);
    } catch (err) {
      logger.error(`Task ${task.id} failed: ${err.message}`);
      if (!task.continue_on_failure) throw err;
    }
  }
}

async function executeTask(task, server, node) {
  switch (task.action) {
    case 'command':
      await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/commands`, {
        commands: [task.payload]
      });
      break;
      
    case 'power':
      await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/power`, {
        action: task.payload
      });
      break;
      
    case 'backup':
      await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/backup`, {});
      break;
  }
  
  logger.info(`Executed task: ${task.action} for server ${server.name}`);
}

// Schedule runner - checks every minute
let schedulerInterval = null;

export function startScheduler() {
  if (schedulerInterval) return;
  
  schedulerInterval = setInterval(async () => {
    const data = loadSchedules();
    const servers = loadServers();
    const nodes = loadNodes();
    const now = new Date();
    
    for (const schedule of data.schedules) {
      if (!schedule.is_active) continue;
      if (!schedule.next_run_at) continue;
      
      const nextRun = new Date(schedule.next_run_at);
      if (nextRun > now) continue;
      
      const server = servers.servers.find(s => s.id === schedule.server_id);
      if (!server) continue;
      
      const node = nodes.nodes.find(n => n.id === server.node_id);
      if (!node) continue;
      
      // Check only_when_online
      if (schedule.only_when_online) {
        try {
          const status = await wingsRequest(node, 'GET', `/api/servers/${server.uuid}`);
          if (status.state !== 'running') continue;
        } catch {
          continue;
        }
      }
      
      try {
        await executeSchedule(schedule, server);
        logger.info(`Schedule "${schedule.name}" executed successfully`);
      } catch (err) {
        logger.error(`Schedule "${schedule.name}" failed: ${err.message}`);
      }
      
      // Update last_run and next_run
      const idx = data.schedules.findIndex(s => s.id === schedule.id);
      if (idx !== -1) {
        data.schedules[idx].last_run_at = now.toISOString();
        data.schedules[idx].next_run_at = calculateNextRun(schedule.cron);
        saveSchedules(data);
      }
    }
  }, 60000); // Check every minute
  
  logger.info('Schedule runner started');
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

export default router;
