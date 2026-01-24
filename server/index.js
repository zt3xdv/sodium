import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import config from './config.js';
import db from './services/database.js';
import docker from './services/docker.js';
import scheduler from './services/scheduler.js';
import backup from './services/backup.js';
import authRoutes from './api/auth.js';
import serverRoutes from './api/servers.js';
import nodeRoutes from './api/nodes.js';
import filesRoutes from './api/files.js';
import adminRoutes from './api/admin.js';
import backupRoutes from './api/backups.js';
import scheduleRoutes from './api/schedules.js';
import { setupConsoleWebSocket } from './websocket/console.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

async function startServer() {
  await db.init();
  db.migrate();

  try {
    await docker.init();
    await backup.init();
    scheduler.start();
  } catch (err) {
    console.warn('Some services failed to initialize:', err.message);
  }

  app.use(cors(config.cors));
  app.use(express.json());
  app.use(express.static(join(__dirname, '..', 'dist')));

  app.use('/api/auth', authRoutes);
  app.use('/api/servers', serverRoutes);
  app.use('/api/nodes', nodeRoutes);
  app.use('/api/servers', filesRoutes);
  app.use('/api/servers', backupRoutes);
  app.use('/api/servers', scheduleRoutes);
  app.use('/api/admin', adminRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const wss = new WebSocketServer({ noServer: true });
  const consoleWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url.split('?')[0];

    if (pathname.startsWith('/ws/console/')) {
      consoleWss.handleUpgrade(request, socket, head, (ws) => {
        consoleWss.emit('connection', ws, request);
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
  scheduler.stop();
  docker.cleanup();
  db.close();
  server.close(() => {
    process.exit(0);
  });
});

export { app, server, wss };
