import express from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import DockerController from './docker.js';
import FileSystem from './filesystem.js';
import Monitor from './monitor.js';
import PanelConnector from './panel-connector.js';
import TransferService from './transfer.js';
import Logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'config.json');

const defaultConfig = {
  uuid: '',
  token: '',
  panel_url: 'http://localhost:3000',
  host: '0.0.0.0',
  port: 8080,
  ssl: { enabled: false, cert: '', key: '' },
  servers_path: './servers',
  backups_path: './backups',
  logs_path: './logs',
  debug: false,
  auto_connect_panel: true
};

function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    return { ...defaultConfig, ...data };
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  console.log('Created default config.json - please configure and restart');
  process.exit(1);
}

const config = loadConfig();
const app = express();

let server;
if (config.ssl.enabled && config.ssl.cert && config.ssl.key) {
  const sslOptions = {
    cert: readFileSync(config.ssl.cert),
    key: readFileSync(config.ssl.key)
  };
  server = createHttpsServer(sslOptions, app);
  console.log('SSL/TLS enabled');
} else {
  server = createHttpServer(app);
}

const wss = new WebSocketServer({ noServer: true });

const docker = new DockerController(config);
const filesystem = new FileSystem(config);
const monitor = new Monitor(docker);
const logger = new Logger(config);
const panelConnector = new PanelConnector(config, monitor);
const transfer = new TransferService(config, docker, filesystem);

logger.panelConnector = panelConnector;

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], config.token);
    req.auth = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    ssl: config.ssl.enabled,
    panelConnected: panelConnector.isConnected(),
    timestamp: new Date().toISOString()
  });
});

app.get('/system', authMiddleware, async (req, res) => {
  try {
    const stats = await monitor.getSystemStats();
    res.json({ data: stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/servers', authMiddleware, async (req, res) => {
  try {
    const servers = await docker.listContainers();
    res.json({ data: servers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/servers/:uuid', authMiddleware, async (req, res) => {
  try {
    const status = await docker.getContainerStatus(req.params.uuid);
    const stats = await docker.getContainerStats(req.params.uuid);
    res.json({ data: { status, stats } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/servers/:uuid/power', authMiddleware, async (req, res) => {
  const { action } = req.body;
  const { uuid } = req.params;

  try {
    switch (action) {
      case 'start':
        await docker.startContainer(uuid);
        logger.info(`Server started: ${uuid}`);
        break;
      case 'stop':
        await docker.stopContainer(uuid);
        logger.info(`Server stopped: ${uuid}`);
        break;
      case 'restart':
        await docker.restartContainer(uuid);
        logger.info(`Server restarted: ${uuid}`);
        break;
      case 'kill':
        await docker.killContainer(uuid);
        logger.info(`Server killed: ${uuid}`);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    panelConnector.sendServerStatus(uuid, await docker.getContainerStatus(uuid));
    res.json({ success: true, action });
  } catch (err) {
    logger.error(`Power action failed: ${action}`, { uuid, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.post('/servers/:uuid/command', authMiddleware, async (req, res) => {
  try {
    await docker.sendCommand(req.params.uuid, req.body.command);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/servers/:uuid/install', authMiddleware, async (req, res) => {
  try {
    const { egg, server } = req.body;
    logger.info(`Installing server: ${req.params.uuid}`);
    await docker.installServer(server, egg);
    logger.info(`Server installed: ${req.params.uuid}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`Install failed: ${req.params.uuid}`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.post('/servers/:uuid/create', authMiddleware, async (req, res) => {
  try {
    const { server, egg } = req.body;
    await docker.createContainer(server, egg);
    logger.info(`Container created: ${req.params.uuid}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/servers/:uuid', authMiddleware, async (req, res) => {
  try {
    await docker.removeContainer(req.params.uuid);
    await filesystem.deleteServerFiles(req.params.uuid);
    logger.info(`Server deleted: ${req.params.uuid}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/servers/:uuid/files', authMiddleware, async (req, res) => {
  try {
    const path = req.query.path || '/';
    const files = await filesystem.listDirectory(req.params.uuid, path);
    res.json({ data: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/servers/:uuid/files/contents', authMiddleware, async (req, res) => {
  try {
    const content = await filesystem.readFile(req.params.uuid, req.query.path);
    res.json({ data: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/servers/:uuid/files/write', authMiddleware, async (req, res) => {
  try {
    await filesystem.writeFile(req.params.uuid, req.body.path, req.body.content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/servers/:uuid/files/delete', authMiddleware, async (req, res) => {
  try {
    await filesystem.deleteFile(req.params.uuid, req.body.path);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/servers/:uuid/backup', authMiddleware, async (req, res) => {
  try {
    const backup = await filesystem.createBackup(req.params.uuid, req.body.name);
    logger.info(`Backup created: ${req.params.uuid}`);
    res.json({ data: backup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transfer endpoints
app.post('/transfer/initiate', authMiddleware, async (req, res) => {
  try {
    const { uuid, targetNode } = req.body;
    const result = await transfer.initiateTransfer(uuid, targetNode);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/transfer/receive', authMiddleware, async (req, res) => {
  try {
    const uuid = req.headers['x-transfer-uuid'] || req.query.uuid;
    const result = await transfer.receiveTransfer(uuid, req);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/transfer/import', authMiddleware, async (req, res) => {
  try {
    const { uuid, tempPath } = req.body;
    const result = await transfer.completeImport(uuid, tempPath);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/transfers', authMiddleware, (req, res) => {
  res.json({ data: transfer.listTransfers() });
});

app.get('/transfers/:id', authMiddleware, (req, res) => {
  const status = transfer.getTransferStatus(req.params.id);
  if (!status) {
    return res.status(404).json({ error: 'Transfer not found' });
  }
  res.json({ data: status });
});

// Logs endpoints
app.get('/logs', authMiddleware, async (req, res) => {
  try {
    const logs = await logger.getLogs(req.query);
    res.json({ data: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/logs/files', authMiddleware, async (req, res) => {
  try {
    const files = await logger.getLogFiles();
    res.json({ data: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WebSocket handling
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    socket.destroy();
    return;
  }

  try {
    jwt.verify(token, config.token);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const serverUuid = url.pathname.split('/').pop();

  if (!serverUuid) {
    ws.close(4001, 'No server specified');
    return;
  }

  logger.debug(`Console connected: ${serverUuid}`);
  docker.attachToContainer(serverUuid);

  const outputHandler = (uuid, data) => {
    if (uuid === serverUuid && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'output', content: data }));
      panelConnector.sendServerOutput(uuid, data);
    }
  };

  docker.on('output', outputHandler);

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'command' && msg.command) {
        await docker.sendCommand(serverUuid, msg.command);
      } else if (msg.type === 'power') {
        switch (msg.action) {
          case 'start': await docker.startContainer(serverUuid); break;
          case 'stop': await docker.stopContainer(serverUuid); break;
          case 'restart': await docker.restartContainer(serverUuid); break;
          case 'kill': await docker.killContainer(serverUuid); break;
        }
        panelConnector.sendServerStatus(serverUuid, await docker.getContainerStatus(serverUuid));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    docker.off('output', outputHandler);
    logger.debug(`Console disconnected: ${serverUuid}`);
  });

  const statsInterval = setInterval(async () => {
    if (ws.readyState !== 1) {
      clearInterval(statsInterval);
      return;
    }
    try {
      const stats = await docker.getContainerStats(serverUuid);
      const status = await docker.getContainerStatus(serverUuid);
      ws.send(JSON.stringify({ type: 'stats', ...stats, status }));
    } catch {}
  }, 2000);

  ws.on('close', () => clearInterval(statsInterval));
});

// Panel connector event handlers
panelConnector.on('command', async (msg) => {
  const { uuid, action, command } = msg;
  try {
    if (action === 'command' && command) {
      await docker.sendCommand(uuid, command);
    } else if (['start', 'stop', 'restart', 'kill'].includes(action)) {
      switch (action) {
        case 'start': await docker.startContainer(uuid); break;
        case 'stop': await docker.stopContainer(uuid); break;
        case 'restart': await docker.restartContainer(uuid); break;
        case 'kill': await docker.killContainer(uuid); break;
      }
      panelConnector.sendServerStatus(uuid, await docker.getContainerStatus(uuid));
    }
  } catch (err) {
    logger.error(`Panel command failed: ${action}`, { uuid, error: err.message });
  }
});

panelConnector.on('connected', () => {
  logger.info('Connected to panel');
});

panelConnector.on('disconnected', ({ code, reason }) => {
  logger.warn(`Disconnected from panel: ${code} ${reason}`);
});

panelConnector.on('error', (err) => {
  logger.error('Panel connection error', { error: err.message });
});

async function start() {
  await logger.init();
  logger.info('Starting Sodium Daemon...');

  try {
    await docker.init();
    logger.info('Docker controller initialized');
  } catch (err) {
    logger.error('Docker init failed', { error: err.message });
  }

  monitor.start();

  if (config.auto_connect_panel && config.panel_url && config.token) {
    panelConnector.connect();
  }

  const protocol = config.ssl.enabled ? 'https' : 'http';
  server.listen(config.port, config.host, () => {
    logger.info(`Sodium Daemon running on ${protocol}://${config.host}:${config.port}`);
    console.log(`🪶 Sodium Daemon running on ${protocol}://${config.host}:${config.port}`);
  });
}

process.on('SIGINT', async () => {
  console.log('\nShutting down daemon...');
  logger.info('Daemon shutting down');
  monitor.stop();
  panelConnector.disconnect();
  await docker.cleanup();
  logger.close();
  server.close();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: String(reason) });
  console.error('Unhandled rejection:', reason);
});

start();
