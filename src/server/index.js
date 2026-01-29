import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';

// Rutas
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import statusRoutes from './routes/status.js';
import adminRoutes from './routes/admin.js';
import serverRoutes from './routes/servers.js';
import remoteRoutes from './routes/remote.js';
import pluginRoutes from './routes/plugins.js';
import apiKeysRoutes from './routes/api-keys.js';
import announcementsRoutes from './routes/announcements.js';
import auditLogsRoutes from './routes/audit-logs.js';
import activityLogsRoutes from './routes/activity-logs.js';
import { setupWebSocket } from './socket.js';
import pluginManager from './plugins/manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json({ strict: false }));
app.use(express.text({ type: 'application/json' }));

// Middleware global de limpieza
app.use((req, res, next) => {
  if (req.body === 'null' || req.body === null || req.body === '') {
    req.body = {};
  }
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      req.body = {};
    }
  }
  next();
});

// Assets estáticos
app.use(express.static(path.join(__dirname, '../../dist')));
app.use(express.static(path.join(__dirname, '../../assets')));
app.use('/plugins', express.static(path.join(__dirname, '../../plugins')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', statusRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/remote', remoteRoutes);
app.use('/api/plugins', pluginRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/admin/audit-logs', auditLogsRoutes);
app.use('/api/activity', activityLogsRoutes);

// Inicializar plugins
pluginManager.setApp(app);

async function startServer() {
  await pluginManager.loadPlugins();
  
  await pluginManager.executeHook('server:init', { app, server });
  
  pluginManager.applyMiddlewares(app);
  pluginManager.applyRoutes(app);
  
  await pluginManager.executeHook('server:routes', { app });
  
  // Fallback para SPA (debe ir después de las rutas de plugins)
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
  });
  
  setupWebSocket(server);
  
  await pluginManager.executeHook('server:ready', { app, server });
  
  server.listen(PORT, () => {
    logger.startup(PORT);
  });
}

startServer().catch(err => {
  logger.error(`Server startup failed: ${err.message}`);
  process.exit(1);
});
