import express from 'express';
import { loadSchedules, saveSchedules, loadServers, saveServers, loadNodes } from '../db.js';
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
  
  const cronConfig = {
    minute: minute || '*',
    hour: hour || '*',
    day_of_month: day_of_month || '*',
    day_of_week: day_of_week || '*',
    month: month || '*'
  };
  
  const cronValidation = validateCron(cronConfig);
  if (!cronValidation.valid) {
    return res.status(400).json({ error: cronValidation.error });
  }
  
  const data = loadSchedules();
  
  const schedule = {
    id: generateUUID(),
    server_id: server.id,
    name: name.substring(0, 100),
    cron: cronConfig,
    is_active: is_active !== false,
    only_when_online: only_when_online || false,
    tasks: [],
    last_run_at: null,
    next_run_at: calculateNextRun(cronConfig),
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
    const newCron = {
      minute: minute ?? data.schedules[idx].cron.minute,
      hour: hour ?? data.schedules[idx].cron.hour,
      day_of_month: day_of_month ?? data.schedules[idx].cron.day_of_month,
      day_of_week: day_of_week ?? data.schedules[idx].cron.day_of_week,
      month: month ?? data.schedules[idx].cron.month
    };
    
    const cronValidation = validateCron(newCron);
    if (!cronValidation.valid) {
      return res.status(400).json({ error: cronValidation.error });
    }
    
    data.schedules[idx].cron = newCron;
    data.schedules[idx].next_run_at = calculateNextRun(newCron);
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

// Get next run time (preview without modifying)
router.post('/servers/:serverId/schedules/preview-next-run', (req, res) => {
  const server = getServerAccess(req, req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const { minute, hour, day_of_month, day_of_week, month } = req.body;
  
  const cronConfig = {
    minute: minute || '*',
    hour: hour || '*',
    day_of_month: day_of_month || '*',
    day_of_week: day_of_week || '*',
    month: month || '*'
  };
  
  const cronValidation = validateCron(cronConfig);
  if (!cronValidation.valid) {
    return res.status(400).json({ error: cronValidation.error });
  }
  
  const nextRun = calculateNextRun(cronConfig);
  
  res.json({
    cron: cronConfig,
    next_run_at: nextRun,
    valid: nextRun !== null
  });
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

function validateCronField(value, min, max, fieldName) {
  if (value === '*') return { valid: true };
  
  const num = parseInt(value);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number or '*'` };
  }
  if (num < min || num > max) {
    return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }
  return { valid: true };
}

function validateCron(cron) {
  const validations = [
    validateCronField(cron.minute, 0, 59, 'minute'),
    validateCronField(cron.hour, 0, 23, 'hour'),
    validateCronField(cron.day_of_month, 1, 31, 'day_of_month'),
    validateCronField(cron.month, 1, 12, 'month'),
    validateCronField(cron.day_of_week, 0, 6, 'day_of_week')
  ];
  
  for (const v of validations) {
    if (!v.valid) return v;
  }
  return { valid: true };
}

function matchesCronField(value, cronField) {
  if (cronField === '*') return true;
  return value === parseInt(cronField);
}

function calculateNextRun(cron) {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(next.getMinutes() + 1);
  
  const maxIterations = 366 * 24 * 60;
  
  for (let i = 0; i < maxIterations; i++) {
    const minute = next.getMinutes();
    const hour = next.getHours();
    const dayOfMonth = next.getDate();
    const month = next.getMonth() + 1;
    const dayOfWeek = next.getDay();
    
    if (
      matchesCronField(minute, cron.minute) &&
      matchesCronField(hour, cron.hour) &&
      matchesCronField(dayOfMonth, cron.day_of_month) &&
      matchesCronField(month, cron.month) &&
      matchesCronField(dayOfWeek, cron.day_of_week)
    ) {
      return next.toISOString();
    }
    
    next.setMinutes(next.getMinutes() + 1);
  }
  
  return null;
}

async function executeSchedule(schedule, server) {
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  
  if (!node) {
    logger.error(`Schedule "${schedule.name}" failed: Node ${server.node_id} not found`);
    throw new Error('Node not found');
  }
  
  const sortedTasks = [...(schedule.tasks || [])].sort((a, b) => a.sequence_id - b.sequence_id);
  
  if (sortedTasks.length === 0) {
    logger.warn(`Schedule "${schedule.name}" has no tasks to execute`);
    return;
  }
  
  let executedCount = 0;
  let failedCount = 0;
  
  for (const task of sortedTasks) {
    if (task.time_offset > 0) {
      await new Promise(resolve => setTimeout(resolve, task.time_offset * 1000));
    }
    
    try {
      await executeTask(task, server, node);
      executedCount++;
    } catch (err) {
      failedCount++;
      logger.error(`Task ${task.id} (${task.action}) failed for server ${server.name}: ${err.message}`);
      if (!task.continue_on_failure) {
        throw new Error(`Task ${task.action} failed: ${err.message}`);
      }
    }
  }
  
  logger.info(`Schedule "${schedule.name}" completed: ${executedCount} succeeded, ${failedCount} failed`);
}

async function executeTask(task, server, node) {
  if (!task.action) {
    throw new Error('Task has no action defined');
  }
  
  try {
    switch (task.action) {
      case 'command':
        if (!task.payload) {
          throw new Error('Command payload is empty');
        }
        await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/commands`, {
          commands: [task.payload]
        });
        break;
        
      case 'power':
        const validPower = ['start', 'stop', 'restart', 'kill'];
        if (!validPower.includes(task.payload)) {
          throw new Error(`Invalid power action: ${task.payload}`);
        }
        await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/power`, {
          action: task.payload
        });
        break;
        
      case 'backup':
        const backupUuid = generateUUID();
        const serversData = loadServers();
        const serverIdx = serversData.servers.findIndex(s => s.id === server.id);
        if (serverIdx === -1) {
          throw new Error('Server not found in database');
        }
        if (!serversData.servers[serverIdx].backups) {
          serversData.servers[serverIdx].backups = [];
        }
        serversData.servers[serverIdx].backups.push({
          id: backupUuid,
          uuid: backupUuid,
          name: `Scheduled Backup ${new Date().toLocaleDateString()}`,
          ignored_files: [],
          bytes: 0,
          checksum: null,
          is_successful: false,
          is_locked: false,
          created_at: new Date().toISOString(),
          completed_at: null
        });
        saveServers(serversData);
        await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/backups`, {
          adapter: 'wings',
          uuid: backupUuid,
          ignore: ''
        });
        break;
        
      default:
        throw new Error(`Unknown task action: ${task.action}`);
    }
    
    logger.info(`Executed task: ${task.action} for server ${server.name}`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      throw new Error(`Node connection failed: ${err.code}`);
    }
    throw err;
  }
}

// Schedule runner - checks every minute
let schedulerInterval = null;

function getSchedulesDueNow() {
  const data = loadSchedules();
  const now = new Date();
  
  return data.schedules.filter(schedule => {
    if (!schedule.is_active) return false;
    if (!schedule.next_run_at) return false;
    return new Date(schedule.next_run_at) <= now;
  });
}

export function startScheduler() {
  if (schedulerInterval) return;
  
  schedulerInterval = setInterval(async () => {
    const dueSchedules = getSchedulesDueNow();
    
    if (dueSchedules.length === 0) return;
    
    const servers = loadServers();
    const nodes = loadNodes();
    const now = new Date();
    
    for (const schedule of dueSchedules) {
      const server = servers.servers.find(s => s.id === schedule.server_id);
      if (!server) {
        logger.warn(`Schedule "${schedule.name}" skipped: server ${schedule.server_id} not found`);
        continue;
      }
      
      const node = nodes.nodes.find(n => n.id === server.node_id);
      if (!node) {
        logger.warn(`Schedule "${schedule.name}" skipped: node ${server.node_id} not found`);
        continue;
      }
      
      if (schedule.only_when_online) {
        try {
          const status = await wingsRequest(node, 'GET', `/api/servers/${server.uuid}`);
          if (status.state !== 'running') {
            logger.debug(`Schedule "${schedule.name}" skipped: server not running`);
            continue;
          }
        } catch (err) {
          logger.warn(`Schedule "${schedule.name}" skipped: failed to check server status - ${err.message}`);
          continue;
        }
      }
      
      try {
        await executeSchedule(schedule, server);
      } catch (err) {
        logger.error(`Schedule "${schedule.name}" failed: ${err.message}`);
      }
      
      const data = loadSchedules();
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
