import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Rutas
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import statusRoutes from './routes/status.js';
import adminRoutes from './routes/admin.js';
import serverRoutes from './routes/servers.js';
import remoteRoutes from './routes/remote.js';
import { setupWebSocket } from './socket.js';

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

// Assets estáticos (asumiendo que dist y assets están al nivel raíz del proyecto)
// Ajustamos las rutas para subir dos niveles desde src/server
app.use(express.static(path.join(__dirname, '../../dist')));
app.use(express.static(path.join(__dirname, '../../assets')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', statusRoutes); // Contiene /api/status/nodes y /api/nodes/available
app.use('/api/admin', adminRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/remote', remoteRoutes);

// Fallback para SPA
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
});

// Inicializar WebSocket
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`\x1b[36m┌──────────────────────────────────────────────\x1b[0m`);
  console.log(`\x1b[36m│ \x1b[37mSodium Server\x1b[0m`);
  console.log(`\x1b[36m├──────────────────────────────────────────────\x1b[0m`);
  console.log(`\x1b[36m│ \x1b[37mRunning on port \x1b[1m${PORT}\x1b[0m`);
  console.log(`\x1b[36m│ \x1b[37mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[36m└──────────────────────────────────────────────\x1b[0m`);
});
