import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import logger from './utils/logger.js';

// Rutas
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import statusRoutes from './routes/status.js';
import adminRoutes from './routes/admin.js';
import serverRoutes from './routes/servers.js';
import remoteRoutes from './routes/remote.js';
import apiKeysRoutes from './routes/api-keys.js';
import announcementsRoutes from './routes/announcements.js';
import auditLogsRoutes from './routes/audit-logs.js';
import activityLogsRoutes from './routes/activity-logs.js';
import webhooksRoutes from './routes/webhooks.js';
import backupsRoutes from './routes/backups.js';
import schedulesRoutes, { startScheduler } from './routes/schedules.js';
import setupRoutes from './routes/setup.js';
import healthRoutes from './routes/health.js';
import metricsRoutes, { recordRequest } from './routes/metrics.js';
import applicationApiRoutes from './routes/application-api.js';
import { setupWebSocket } from './socket.js';
import { isInstalled, loadFullConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Security middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ strict: false }));
app.use(express.text({ type: 'application/json' }));
app.use(cookieParser());

// Middleware global de limpieza
app.use((req, res, next) => {
  if (req.body === 'null' || req.body === null || req.body === '') {
    req.body = {};
  }
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      // Invalid JSON body, use empty object
      req.body = {};
    }
  }
  next();
});

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    recordRequest(Date.now() - start);
  });
  next();
});

// Assets estáticos
app.use(express.static(path.join(__dirname, '../../dist')));
app.use(express.static(path.join(__dirname, '../../assets')));

// Health & Metrics (always available, no auth)
app.use('/api', healthRoutes);
app.use(metricsRoutes);

// Setup routes (always available)
app.use('/api/setup', setupRoutes);

// Middleware to check if installed
app.use('/api', (req, res, next) => {
  if (!isInstalled() && !req.path.startsWith('/setup')) {
    return res.status(503).json({ error: 'Panel not configured', needsSetup: true });
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', statusRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/remote', remoteRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/admin/audit-logs', auditLogsRoutes);
app.use('/api/activity', activityLogsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/servers', backupsRoutes);
app.use('/api', schedulesRoutes);
app.use('/api/application', applicationApiRoutes);

// Fallback para SPA
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
});

async function startServer() {
  setupWebSocket(server);
  
  // Start schedule runner if installed
  if (isInstalled()) {
    startScheduler();
  }
  
  server.listen(PORT, () => {
    logger.startup(PORT, !isInstalled());
  });
}

startServer().catch(err => {
  logger.error(`Server startup failed: ${err.message}`);
  process.exit(1);
});
