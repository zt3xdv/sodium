#!/usr/bin/env node
/**
 * Sodium gVisor Daemon
 * Lightweight container isolation using gVisor/Bubblewrap
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';

import Sandbox from './sandbox.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'config.json');

const defaultConfig = {
  host: '0.0.0.0',
  port: 8081,
  token: 'sodium-gvisor-token',
  isolation: 'bubblewrap',
  sandboxes_path: './sandboxes',
  runtimes_path: './runtimes',
  default_limits: {
    memory_mb: 512,
    cpu_percent: 100,
    disk_mb: 1024,
    timeout_seconds: 300,
    max_processes: 64,
    max_files: 1024
  },
  network: {
    enabled: false,
    allowed_hosts: []
  }
};

function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    return { ...defaultConfig, ...data };
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  console.log('Created default config.json');
  return defaultConfig;
}

const config = loadConfig();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const sandbox = new Sandbox(config);

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== config.token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    isolation: sandbox.isolation,
    uptime: process.uptime()
  });
});

// List sandboxes
app.get('/sandboxes', auth, async (req, res) => {
  try {
    const list = await sandbox.list();
    res.json({ data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create sandbox
app.post('/sandboxes', auth, async (req, res) => {
  try {
    const id = uuid();
    const meta = await sandbox.create(id, req.body);
    res.json({ data: meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sandbox status
app.get('/sandboxes/:id', auth, async (req, res) => {
  try {
    const status = await sandbox.getStatus(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    const stats = sandbox.getStats(req.params.id);
    res.json({ data: { ...status, stats } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start/run in sandbox
app.post('/sandboxes/:id/start', auth, async (req, res) => {
  try {
    const { command, args = [] } = req.body;
    if (!command) return res.status(400).json({ error: 'Command required' });
    
    await sandbox.start(req.params.id, command, args);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop sandbox
app.post('/sandboxes/:id/stop', auth, async (req, res) => {
  try {
    await sandbox.stop(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kill sandbox
app.post('/sandboxes/:id/kill', auth, async (req, res) => {
  try {
    await sandbox.kill(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete sandbox
app.delete('/sandboxes/:id', auth, async (req, res) => {
  try {
    await sandbox.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send input to sandbox
app.post('/sandboxes/:id/input', auth, async (req, res) => {
  try {
    await sandbox.sendInput(req.params.id, req.body.input);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WebSocket for console streaming
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');

  if (token !== config.token) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sandboxId = url.pathname.split('/').filter(Boolean).pop();

  if (!sandboxId) {
    ws.close(4001, 'No sandbox ID');
    return;
  }

  console.log(`📺 Console connected: ${sandboxId}`);

  // Output handler
  const outputHandler = (id, data) => {
    if (id === sandboxId && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'output', content: data }));
    }
  };

  // Stats handler
  const statsHandler = (id, stats) => {
    if (id === sandboxId && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'stats', ...stats }));
    }
  };

  // Exit handler
  const exitHandler = (id, code) => {
    if (id === sandboxId && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'exit', code }));
    }
  };

  sandbox.on('output', outputHandler);
  sandbox.on('stats', statsHandler);
  sandbox.on('exit', exitHandler);

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      
      switch (msg.type) {
        case 'input':
          await sandbox.sendInput(sandboxId, msg.content);
          break;
        case 'start':
          await sandbox.start(sandboxId, msg.command, msg.args || []);
          break;
        case 'stop':
          await sandbox.stop(sandboxId);
          break;
        case 'kill':
          await sandbox.kill(sandboxId);
          break;
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    sandbox.off('output', outputHandler);
    sandbox.off('stats', statsHandler);
    sandbox.off('exit', exitHandler);
    console.log(`📺 Console disconnected: ${sandboxId}`);
  });
});

async function start() {
  console.log('🔧 Initializing Sodium gVisor Daemon...\n');
  
  await sandbox.init();

  server.listen(config.port, config.host, () => {
    console.log(`\n🪶 Sodium gVisor Daemon running on http://${config.host}:${config.port}`);
    console.log(`🔒 Isolation: ${sandbox.isolation}`);
    console.log(`📁 Sandboxes: ${sandbox.sandboxesPath}\n`);
  });
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  
  // Stop all sandboxes
  const list = await sandbox.list();
  for (const s of list) {
    if (s.status === 'running') {
      await sandbox.stop(s.uuid);
    }
  }
  
  server.close();
  process.exit(0);
});

start();
