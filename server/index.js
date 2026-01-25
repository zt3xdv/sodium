import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import config from './config.js';
import db from './services/database.js';
import scheduler from './services/scheduler.js';
import backup from './services/backup.js';
import authRoutes from './api/auth.js';
import serverRoutes from './api/servers.js';
import nodeRoutes from './api/nodes.js';
import allocationRoutes from './api/allocations.js';
import filesRoutes from './api/files.js';
import adminRoutes from './api/admin.js';
import backupRoutes from './api/backups.js';
import scheduleRoutes from './api/schedules.js';
import subuserRoutes from './api/subusers.js';
import databaseRoutes from './api/databases.js';
import apiKeyRoutes, { apiKeyAuth } from './api/api-keys.js';
import accountRoutes from './api/account.js';
import { setupConsoleWebSocket } from './websocket/console.js';
import daemonManager from './services/daemon-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

async function startServer() {
  await db.init();
  db.migrate();

  try {
    await backup.init();
    scheduler.start();
  } catch (err) {
    console.warn('Some services failed to initialize:', err.message);
  }

  app.use(cors(config.cors));
  app.use(express.json());
  app.use(apiKeyAuth);
  app.use(express.static(join(__dirname, '..', 'dist')));

  app.use('/api/auth', authRoutes);
  app.use('/api/servers', serverRoutes);
  app.use('/api/nodes', nodeRoutes);
  app.use('/api/allocations', allocationRoutes);
  app.use('/api/servers', filesRoutes);
  app.use('/api/servers', backupRoutes);
  app.use('/api/servers', scheduleRoutes);
  app.use('/api/servers', subuserRoutes);
  app.use('/api/databases', databaseRoutes);
  app.use('/api/account/api-keys', apiKeyRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/admin', adminRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const wss = new WebSocketServer({ noServer: true });
  const consoleWss = new WebSocketServer({ noServer: true });
  const daemonWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url.split('?')[0];

    if (pathname.startsWith('/ws/console/')) {
      consoleWss.handleUpgrade(request, socket, head, (ws) => {
        consoleWss.emit('connection', ws, request);
      });
    } else if (pathname === '/ws/daemon') {
      daemonWss.handleUpgrade(request, socket, head, (ws) => {
        daemonWss.emit('connection', ws, request);
      });
    } else if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  setupConsoleWebSocket(consoleWss);

  // Daemon WebSocket handler
  daemonWss.on('connection', (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    const uuid = url.searchParams.get('uuid');

    console.log(`Daemon connecting: ${uuid}`);

    let daemonInfo = { uuid, authenticated: false, node: null };
    ws.isAlive = true;

    // Authentication timeout - daemon must authenticate within 30 seconds
    const authTimeout = setTimeout(() => {
      if (!daemonInfo.authenticated) {
        console.log(`Daemon ${uuid} authentication timeout`);
        ws.close(4008, 'Authentication timeout');
      }
    }, 30000);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'auth':
            // Validate token against database
            const node = daemonManager.validateDaemonToken(uuid, msg.token || token);
            if (!node) {
              ws.send(JSON.stringify({ type: 'auth_failed', reason: 'Invalid token or node not found' }));
              ws.close(4003, 'Authentication failed');
              return;
            }
            
            daemonInfo.authenticated = true;
            daemonInfo.version = msg.version;
            daemonInfo.node = node;
            clearTimeout(authTimeout);
            daemonManager.registerDaemon(uuid, ws, daemonInfo);
            ws.send(JSON.stringify({ type: 'auth_success', node: { name: node.name, uuid: node.uuid } }));
            console.log(`Daemon authenticated: ${uuid} (${node.name})`);
            break;

          case 'heartbeat':
            if (daemonInfo.authenticated) {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
            break;

          case 'stats':
            if (daemonInfo.authenticated) {
              daemonManager.updateDaemonStats(uuid, msg.data);
            }
            break;

          case 'server_status':
            if (daemonInfo.authenticated) {
              daemonManager.handleServerStatus(msg.uuid, msg.status, msg.stats);
              console.log(`Server ${msg.uuid} status: ${msg.status}`);
            }
            break;

          case 'server_output':
            if (daemonInfo.authenticated) {
              daemonManager.handleServerOutput(msg.uuid, msg.output);
            }
            break;

          case 'log':
            if (daemonInfo.authenticated) {
              console.log(`[Daemon ${uuid}] [${msg.level}] ${msg.message}`);
            }
            break;
        }
      } catch (err) {
        console.error('Invalid daemon message:', err.message);
      }
    });

    ws.on('close', () => {
      console.log(`Daemon disconnected: ${uuid}`);
      clearTimeout(authTimeout);
      if (daemonInfo.authenticated) {
        daemonManager.unregisterDaemon(uuid);
      }
    });

    ws.on('error', (err) => {
      console.error(`Daemon ${uuid} error:`, err.message);
    });
  });

  // Heartbeat interval to detect dead daemon connections
  const daemonHeartbeatInterval = setInterval(() => {
    daemonWss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('Terminating inactive daemon connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 45000);

  // Store interval for cleanup
  server.daemonHeartbeatInterval = daemonHeartbeatInterval;

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('WS message:', message);
      } catch (err) {
        console.error('Invalid WS message:', err);
      }
    });
  });

  app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const status = err.status || err.statusCode || 500;
    const message = config.debug ? err.message : 'Internal server error';
    
    res.status(status).json({ error: message });
  });

  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
  });

  server.listen(config.port, config.host, () => {
    console.log(`🪶 Sodium server running at http://${config.host}:${config.port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (server.daemonHeartbeatInterval) {
    clearInterval(server.daemonHeartbeatInterval);
  }
  scheduler.stop();
  db.close();
  server.close();
  process.exit(0);
});

export { app, server };
