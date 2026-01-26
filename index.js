import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data', 'users.json');
const NODES_FILE = path.join(__dirname, 'data', 'nodes.json');
const SERVERS_FILE = path.join(__dirname, 'data', 'servers.json');
const NESTS_FILE = path.join(__dirname, 'data', 'nests.json');
const EGGS_FILE = path.join(__dirname, 'data', 'eggs.json');
const LOCATIONS_FILE = path.join(__dirname, 'data', 'locations.json');
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');

function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;')
    .replace(/\\/g, '&#92;');
}

function sanitizeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (parsed.hostname.includes('<') || parsed.hostname.includes('>')) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function validateUsername(username) {
  if (typeof username !== 'string') return false;
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function sanitizeLinks(links) {
  if (!links || typeof links !== 'object') return {};
  const allowed = ['website', 'twitter', 'github', 'discord', 'instagram'];
  const sanitized = {};
  for (const key of allowed) {
    if (links[key]) {
      sanitized[key] = sanitizeUrl(links[key]);
    }
  }
  return sanitized;
}

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2));
}

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { users: [] };
  }
}

function saveUsers(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadNodes() {
  try { return JSON.parse(fs.readFileSync(NODES_FILE, 'utf8')); }
  catch { return { nodes: [] }; }
}
function saveNodes(data) { fs.writeFileSync(NODES_FILE, JSON.stringify(data, null, 2)); }

function loadServers() {
  try { return JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8')); }
  catch { return { servers: [] }; }
}
function saveServers(data) { fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2)); }

function loadNests() {
  try { return JSON.parse(fs.readFileSync(NESTS_FILE, 'utf8')); }
  catch { return { nests: [] }; }
}
function saveNests(data) { fs.writeFileSync(NESTS_FILE, JSON.stringify(data, null, 2)); }

function loadEggs() {
  try { return JSON.parse(fs.readFileSync(EGGS_FILE, 'utf8')); }
  catch { return { eggs: [] }; }
}
function saveEggs(data) { fs.writeFileSync(EGGS_FILE, JSON.stringify(data, null, 2)); }

function loadLocations() {
  try { return JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8')); }
  catch { return { locations: [] }; }
}
function saveLocations(data) { fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(data, null, 2)); }

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return { panel: { name: 'Sodium Panel' }, defaults: {} }; }
}

function isAdmin(username) {
  const data = loadUsers();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  return user && user.isAdmin === true;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

async function wingsRequest(node, method, endpoint, data = null) {
  const url = `${node.scheme}://${node.fqdn}:${node.daemon_port}${endpoint}`;
  console.log(`[WINGS OUT] ${method} ${url}`);
  
  const headers = {
    'Authorization': `Bearer ${node.daemon_token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  const options = { method, headers };
  if (data) options.body = JSON.stringify(data);
  
  try {
    const response = await fetch(url, options);
    console.log(`[WINGS OUT] Response: ${response.status}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json().catch(() => ({}));
  } catch (error) {
    console.log(`[WINGS OUT] Error: ${error.message}`);
    throw error;
  }
}

app.use(express.json({ strict: false }));
app.use(express.text({ type: 'application/json' }));
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
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscore only)' });
  }
  
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
  }
  
  const data = loadUsers();
  const existingUser = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now().toString(),
    username: sanitizeText(username),
    password: hashedPassword,
    displayName: sanitizeText(username),
    bio: '',
    avatar: '',
    links: {},
    createdAt: new Date().toISOString(),
    settings: {
      theme: 'dark',
      notifications: true,
      privacy: 'public'
    }
  };
  
  data.users.push(newUser);
  saveUsers(data);
  
  const { password: _, ...userWithoutPassword } = newUser;
  res.json({ success: true, user: userWithoutPassword });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ success: true, user: userWithoutPassword });
});

app.get('/api/user/profile', (req, res) => {
  const { username, viewer } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Invalid username format' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { password: _, ...userWithoutPassword } = user;
  
  const isOwner = viewer && viewer.toLowerCase() === username.toLowerCase();
  const isPublic = user.settings?.privacy === 'public';
  
  if (!isOwner && !isPublic) {
    return res.json({ 
      user: {
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isPrivate: true
      }
    });
  }
  
  res.json({ user: userWithoutPassword });
});

app.put('/api/user/profile', (req, res) => {
  const { username, password, displayName, bio, avatar, links } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Authentication required' });
  }
  
  const data = loadUsers();
  const userIndex = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = data.users[userIndex];
  const isValidPassword = bcrypt.compareSync(password, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  if (displayName !== undefined) {
    user.displayName = sanitizeText(displayName.slice(0, 50));
  }
  
  if (bio !== undefined) {
    user.bio = sanitizeText(bio.slice(0, 500));
  }
  
  if (avatar !== undefined) {
    user.avatar = sanitizeUrl(avatar);
  }
  
  if (links !== undefined) {
    user.links = sanitizeLinks(links);
  }
  
  data.users[userIndex] = user;
  saveUsers(data);
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ success: true, user: userWithoutPassword });
});

app.put('/api/user/settings', (req, res) => {
  const { username, password, settings } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Authentication required' });
  }
  
  const data = loadUsers();
  const userIndex = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = data.users[userIndex];
  const isValidPassword = bcrypt.compareSync(password, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  user.settings = { ...user.settings, ...settings };
  data.users[userIndex] = user;
  saveUsers(data);
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ success: true, user: userWithoutPassword });
});

app.put('/api/user/password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  
  const data = loadUsers();
  const userIndex = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = data.users[userIndex];
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  
  user.password = await bcrypt.hash(newPassword, 10);
  data.users[userIndex] = user;
  saveUsers(data);
  
  res.json({ success: true, message: 'Password updated successfully' });
});

// ==================== USER SESSION ====================
app.get('/api/auth/me', async (req, res) => {
  const { username, password } = req.query;
  
  if (!username || !password) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword });
});

// ==================== STATUS PAGE (PUBLIC) ====================
app.get('/api/status/nodes', async (req, res) => {
  const data = loadNodes();
  const publicNodes = await Promise.all(data.nodes.map(async node => {
    let status = 'offline';
    let stats = { memory: 0, disk: 0 };
    try {
      const info = await wingsRequest(node, 'GET', '/api/system');
      status = 'online';
      stats = info;
    } catch {}
    
    const servers = loadServers();
    const serverCount = servers.servers.filter(s => s.node_id === node.id).length;
    
    return {
      id: node.id,
      name: node.name,
      location: node.location_id,
      status,
      memory: { total: node.memory, used: stats.memory_bytes || 0 },
      disk: { total: node.disk, used: stats.disk_bytes || 0 },
      servers: serverCount
    };
  }));
  res.json({ nodes: publicNodes });
});

// ==================== ADMIN: NODES ====================
app.get('/api/admin/nodes', (req, res) => {
  const { username } = req.query;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  res.json(loadNodes());
});

app.post('/api/admin/nodes', (req, res) => {
  const { username, node } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadNodes();
  const newNode = {
    id: generateUUID(),
    name: sanitizeText(node.name),
    description: sanitizeText(node.description || ''),
    location_id: node.location_id,
    fqdn: node.fqdn,
    scheme: node.scheme || 'https',
    memory: parseInt(node.memory) || 1024,
    disk: parseInt(node.disk) || 10240,
    daemon_port: parseInt(node.daemon_port) || 8080,
    daemon_sftp_port: parseInt(node.daemon_sftp_port) || 2022,
    daemon_token: generateToken(),
    daemon_token_id: generateToken().substring(0, 16),
    upload_size: parseInt(node.upload_size) || 100,
    behind_proxy: node.behind_proxy || false,
    maintenance_mode: false,
    created_at: new Date().toISOString()
  };
  
  data.nodes.push(newNode);
  saveNodes(data);
  res.json({ success: true, node: newNode });
});

function generateNodeConfig(node) {
  return {
    debug: false,
    uuid: node.id,
    token_id: node.daemon_token_id,
    token: node.daemon_token,
    api: {
      host: '0.0.0.0',
      port: node.daemon_port,
      ssl: { enabled: node.scheme === 'https', cert: '/etc/letsencrypt/live/node/fullchain.pem', key: '/etc/letsencrypt/live/node/privkey.pem' },
      upload_limit: node.upload_size
    },
    system: { data: '/var/lib/pterodactyl/volumes', sftp: { bind_port: node.daemon_sftp_port } },
    docker: {
      network: {
        name: 'pterodactyl_nw',
        interfaces: {
          v4: {
            subnet: '172.50.0.0/16',
            gateway: '172.50.0.1'
          }
        }
      }
    },
    remote: loadConfig().panel?.url || 'http://localhost:3000'
  };
}

function configToYaml(obj, indent = 0) {
  let yaml = '';
  const spaces = '  '.repeat(indent);
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n${configToYaml(value, indent + 1)}`;
    } else if (typeof value === 'boolean') {
      yaml += `${spaces}${key}: ${value}\n`;
    } else if (typeof value === 'number') {
      yaml += `${spaces}${key}: ${value}\n`;
    } else {
      yaml += `${spaces}${key}: "${value}"\n`;
    }
  }
  return yaml;
}

app.get('/api/admin/nodes/:id/config', (req, res) => {
  const { username } = req.query;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadNodes();
  const node = data.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  
  res.json({ config: generateNodeConfig(node) });
});

app.get('/api/admin/nodes/:id/deploy', (req, res) => {
  const { username } = req.query;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadNodes();
  const node = data.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  
  const config = generateNodeConfig(node);
  const yamlConfig = configToYaml(config);
  const escapedYaml = yamlConfig.replace(/'/g, "'\\''");
  
  const command = `mkdir -p /etc/pterodactyl && echo '${escapedYaml}' > /etc/pterodactyl/config.yml && systemctl restart wings`;
  
  res.json({ command });
});

app.put('/api/admin/nodes/:id', (req, res) => {
  const { username, node } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadNodes();
  const idx = data.nodes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Node not found' });
  
  const current = data.nodes[idx];
  Object.assign(current, {
    name: sanitizeText(node.name) || current.name,
    description: sanitizeText(node.description) ?? current.description,
    location_id: node.location_id || current.location_id,
    fqdn: node.fqdn || current.fqdn,
    scheme: node.scheme || current.scheme,
    memory: parseInt(node.memory) || current.memory,
    disk: parseInt(node.disk) || current.disk,
    daemon_port: parseInt(node.daemon_port) || current.daemon_port,
    daemon_sftp_port: parseInt(node.daemon_sftp_port) || current.daemon_sftp_port,
    upload_size: parseInt(node.upload_size) || current.upload_size,
    behind_proxy: node.behind_proxy ?? current.behind_proxy,
    maintenance_mode: node.maintenance_mode ?? current.maintenance_mode
  });
  
  saveNodes(data);
  res.json({ success: true, node: current });
});

app.delete('/api/admin/nodes/:id', (req, res) => {
  const { username } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadNodes();
  const servers = loadServers();
  
  if (servers.servers.some(s => s.node_id === req.params.id)) {
    return res.status(400).json({ error: 'Node has servers, delete them first' });
  }
  
  data.nodes = data.nodes.filter(n => n.id !== req.params.id);
  saveNodes(data);
  res.json({ success: true });
});

// ==================== ADMIN: LOCATIONS ====================
app.get('/api/admin/locations', (req, res) => {
  res.json(loadLocations());
});

app.post('/api/admin/locations', (req, res) => {
  const { username, location } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadLocations();
  const newLocation = {
    id: (data.locations.length + 1).toString(),
    short: sanitizeText(location.short),
    long: sanitizeText(location.long)
  };
  data.locations.push(newLocation);
  saveLocations(data);
  res.json({ success: true, location: newLocation });
});

app.delete('/api/admin/locations/:id', (req, res) => {
  const { username } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadLocations();
  data.locations = data.locations.filter(l => l.id !== req.params.id);
  saveLocations(data);
  res.json({ success: true });
});

// ==================== ADMIN: USERS ====================
app.get('/api/admin/users', (req, res) => {
  const { username } = req.query;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadUsers();
  const users = data.users.map(({ password, ...u }) => u);
  res.json({ users });
});

app.put('/api/admin/users/:id', (req, res) => {
  const { username, updates } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadUsers();
  const idx = data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  
  if (updates.isAdmin !== undefined) data.users[idx].isAdmin = updates.isAdmin;
  if (updates.limits) data.users[idx].limits = updates.limits;
  
  saveUsers(data);
  const { password, ...user } = data.users[idx];
  res.json({ success: true, user });
});

// ==================== ADMIN: NESTS & EGGS ====================
app.get('/api/admin/nests', (req, res) => {
  const nests = loadNests();
  const eggs = loadEggs();
  nests.nests.forEach(nest => {
    nest.eggs = eggs.eggs.filter(e => e.nest_id === nest.id);
  });
  res.json(nests);
});

app.post('/api/admin/nests', (req, res) => {
  const { username, nest } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadNests();
  const newNest = {
    id: (data.nests.length + 1).toString(),
    name: sanitizeText(nest.name),
    description: sanitizeText(nest.description || '')
  };
  data.nests.push(newNest);
  saveNests(data);
  res.json({ success: true, nest: newNest });
});

app.get('/api/admin/eggs', (req, res) => {
  res.json(loadEggs());
});

app.post('/api/admin/eggs', (req, res) => {
  const { username, egg } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadEggs();
  const newEgg = {
    id: (data.eggs.length + 1).toString(),
    nest_id: egg.nest_id,
    name: sanitizeText(egg.name),
    description: sanitizeText(egg.description || ''),
    author: sanitizeText(egg.author || ''),
    docker_image: egg.docker_image,
    startup: egg.startup,
    config: egg.config || {},
    variables: egg.variables || []
  };
  data.eggs.push(newEgg);
  saveEggs(data);
  res.json({ success: true, egg: newEgg });
});

app.post('/api/admin/eggs/import', (req, res) => {
  const { username, eggJson } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  try {
    const imported = typeof eggJson === 'string' ? JSON.parse(eggJson) : eggJson;
    const data = loadEggs();
    const newEgg = {
      id: (data.eggs.length + 1).toString(),
      nest_id: imported.nest_id || '3',
      name: imported.name,
      description: imported.description || '',
      author: imported.author || '',
      docker_image: imported.docker_image || imported.docker_images?.[0] || '',
      startup: imported.startup,
      config: imported.config || {},
      variables: (imported.variables || []).map(v => ({
        name: v.name,
        description: v.description,
        env_variable: v.env_variable,
        default_value: v.default_value,
        rules: v.rules
      }))
    };
    data.eggs.push(newEgg);
    saveEggs(data);
    res.json({ success: true, egg: newEgg });
  } catch (e) {
    res.status(400).json({ error: 'Invalid egg JSON' });
  }
});

// ==================== ADMIN: SERVERS ====================
app.get('/api/admin/servers', (req, res) => {
  const { username } = req.query;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  res.json(loadServers());
});

app.post('/api/admin/servers', async (req, res) => {
  const { username, server } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  if (!node) return res.status(400).json({ error: 'Invalid node' });
  
  const eggs = loadEggs();
  const egg = eggs.eggs.find(e => e.id === server.egg_id);
  if (!egg) return res.status(400).json({ error: 'Invalid egg' });
  
  const data = loadServers();
  const uuid = generateUUID();
  const newServer = {
    id: uuid,
    uuid,
    name: sanitizeText(server.name),
    description: sanitizeText(server.description || ''),
    user_id: server.user_id,
    node_id: server.node_id,
    egg_id: server.egg_id,
    docker_image: server.docker_image || egg.docker_image,
    startup: server.startup || egg.startup,
    limits: {
      memory: parseInt(server.memory) || 1024,
      disk: parseInt(server.disk) || 5120,
      cpu: parseInt(server.cpu) || 100,
      io: 500,
      swap: 0
    },
    feature_limits: {
      databases: parseInt(server.databases) || 0,
      backups: parseInt(server.backups) || 0,
      allocations: 1
    },
    environment: server.environment || {},
    allocation: { ip: server.allocation_ip || '0.0.0.0', port: parseInt(server.allocation_port) || 25565 },
    status: 'installing',
    suspended: false,
    created_at: new Date().toISOString()
  };
  
  try {
    await wingsRequest(node, 'POST', '/api/servers', {
      uuid: newServer.uuid,
      start_on_completion: false,
      suspended: false,
      environment: newServer.environment,
      invocation: newServer.startup,
      skip_egg_scripts: false,
      build: {
        memory_limit: newServer.limits.memory,
        swap: newServer.limits.swap,
        io_weight: newServer.limits.io,
        cpu_limit: newServer.limits.cpu,
        disk_space: newServer.limits.disk
      },
      container: { image: newServer.docker_image },
      allocations: { default: { ip: newServer.allocation.ip, port: newServer.allocation.port }, mappings: {} }
    });
    newServer.status = 'offline';
  } catch (e) {
    newServer.status = 'install_failed';
    newServer.install_error = e.message;
  }
  
  data.servers.push(newServer);
  saveServers(data);
  res.json({ success: true, server: newServer });
});

app.delete('/api/admin/servers/:id', async (req, res) => {
  const { username } = req.body;
  if (!isAdmin(username)) return res.status(403).json({ error: 'Forbidden' });
  
  const data = loadServers();
  const server = data.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  
  if (node) {
    try { await wingsRequest(node, 'DELETE', `/api/servers/${server.uuid}`); } catch {}
  }
  
  data.servers = data.servers.filter(s => s.id !== req.params.id);
  saveServers(data);
  res.json({ success: true });
});

// ==================== USER: SERVERS ====================
app.get('/api/servers', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username required' });
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const data = loadServers();
  const userServers = data.servers.filter(s => s.user_id === user.id);
  res.json({ servers: userServers });
});

app.get('/api/servers/:id', async (req, res) => {
  const { username } = req.query;
  
  const data = loadServers();
  const server = data.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username?.toLowerCase());
  
  if (!user || (server.user_id !== user.id && !user.isAdmin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  res.json({ server });
});

app.post('/api/servers/:id/power', async (req, res) => {
  const { username, action } = req.body;
  if (!['start', 'stop', 'restart', 'kill'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  
  const data = loadServers();
  const server = data.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username?.toLowerCase());
  if (!user || (server.user_id !== user.id && !user.isAdmin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  if (!node) return res.status(400).json({ error: 'Node not available' });
  
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/power`, { action });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/servers/:id/command', async (req, res) => {
  const { username, command } = req.body;
  
  const data = loadServers();
  const server = data.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username?.toLowerCase());
  if (!user || (server.user_id !== user.id && !user.isAdmin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  if (!node) return res.status(400).json({ error: 'Node not available' });
  
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/commands`, { command });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/servers/:id/websocket', async (req, res) => {
  const { username } = req.query;
  
  const data = loadServers();
  const server = data.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username?.toLowerCase());
  if (!user || (server.user_id !== user.id && !user.isAdmin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  if (!node) return res.status(400).json({ error: 'Node not available' });
  
  const wsScheme = node.scheme === 'https' ? 'wss' : 'ws';
  const wsUrl = `${wsScheme}://${node.fqdn}:${node.daemon_port}/api/servers/${server.uuid}/ws`;
  
  res.json({
    data: {
      token: node.daemon_token,
      socket: wsUrl
    }
  });
});

// ==================== FILE MANAGER ====================
async function getServerAndNode(serverId, username) {
  const data = loadServers();
  const server = data.servers.find(s => s.id === serverId);
  if (!server) return { error: 'Server not found', status: 404 };
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username?.toLowerCase());
  if (!user || (server.user_id !== user.id && !user.isAdmin)) {
    return { error: 'Forbidden', status: 403 };
  }
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  if (!node) return { error: 'Node not available', status: 400 };
  
  return { server, node, user };
}

app.get('/api/servers/:id/files/list', async (req, res) => {
  const { username, path } = req.query;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  
  try {
    const files = await wingsRequest(node, 'GET', `/api/servers/${server.uuid}/files/list-directory?directory=${encodeURIComponent(path || '/')}`);
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/servers/:id/files/folder', async (req, res) => {
  const { username, path } = req.body;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/files/create-directory`, { name: path, path: '/' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/servers/:id/files/write', async (req, res) => {
  const { username, path, content } = req.body;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/files/write?file=${encodeURIComponent(path)}`, content, true);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/servers/:id/files/delete', async (req, res) => {
  const { username, path } = req.body;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/files/delete`, { root: '/', files: [path.replace(/^\//, '')] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/servers/:id/files/rename', async (req, res) => {
  const { username, from, to } = req.body;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  
  try {
    await wingsRequest(node, 'PUT', `/api/servers/${server.uuid}/files/rename`, { 
      root: '/', 
      files: [{ from: from.replace(/^\//, ''), to: to.replace(/^\//, '') }] 
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/servers/:id/files/contents', async (req, res) => {
  const { username, path } = req.query;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  
  try {
    const url = `${node.scheme}://${node.fqdn}:${node.daemon_port}/api/servers/${server.uuid}/files/contents?file=${encodeURIComponent(path)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${node.daemon_token}`,
        'Accept': 'text/plain'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.text();
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/servers/:id/files/download', async (req, res) => {
  const { username, path } = req.query;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, node } = result;
  
  try {
    const url = `${node.scheme}://${node.fqdn}:${node.daemon_port}/api/servers/${server.uuid}/files/contents?file=${encodeURIComponent(path)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${node.daemon_token}`
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const filename = path.split('/').pop();
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== WINGS REMOTE API ====================
function authenticateNode(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const credentials = authHeader.slice(7);
  const dotIndex = credentials.indexOf('.');
  if (dotIndex === -1) return null;
  const tokenId = credentials.substring(0, dotIndex);
  const token = credentials.substring(dotIndex + 1);
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.daemon_token_id === tokenId && n.daemon_token === token);
  return node;
}

app.get('/api/remote/servers', (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  
  const page = parseInt(req.query.page) || 0;
  const perPage = parseInt(req.query.per_page) || 50;
  
  const allServers = loadServers();
  const nodeServers = allServers.servers.filter(s => s.node_id === node.id);
  const eggs = loadEggs();
  const users = loadUsers();
  
  const start = page * perPage;
  const paginatedServers = nodeServers.slice(start, start + perPage);
  
  const data = paginatedServers.map(server => {
    const egg = eggs.eggs.find(e => e.id === server.egg_id) || {};
    const user = users.users.find(u => u.id === server.user_id) || {};
    
    return {
      uuid: server.uuid,
      settings: {
        uuid: server.uuid,
        meta: {
          name: server.name,
          description: server.description || ''
        },
        suspended: server.suspended || false,
        environment: server.environment || {},
        invocation: server.startup || egg.startup || '',
        skip_egg_scripts: false,
        build: {
          memory_limit: server.limits?.memory || 1024,
          swap: server.limits?.swap || 0,
          io_weight: server.limits?.io || 500,
          cpu_limit: server.limits?.cpu || 100,
          disk_space: server.limits?.disk || 5120,
          threads: null
        },
        container: {
          image: server.docker_image || egg.docker_image || ''
        },
        allocations: {
          default: {
            ip: server.allocation?.ip || '0.0.0.0',
            port: server.allocation?.port || 25565
          },
          mappings: {
            [server.allocation?.ip || '0.0.0.0']: [server.allocation?.port || 25565]
          }
        },
        mounts: [],
        egg: {
          id: egg.id || '',
          file_denylist: []
        }
      },
      process_configuration: {
        startup: {
          done: ['Done'],
          user_interaction: [],
          strip_ansi: false
        },
        stop: {
          type: 'command',
          value: 'stop'
        },
        configs: []
      }
    };
  });
  
  res.json({
    data,
    meta: {
      current_page: page,
      last_page: Math.max(0, Math.ceil(nodeServers.length / perPage) - 1),
      per_page: perPage,
      total: nodeServers.length
    }
  });
});

app.post('/api/remote/servers/reset', (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  
  const data = loadServers();
  data.servers = data.servers.map(s => {
    if (s.node_id === node.id && (s.status === 'installing' || s.status === 'restoring_backup')) {
      s.status = 'offline';
    }
    return s;
  });
  saveServers(data);
  res.json({ success: true });
});

app.get('/api/remote/servers/:uuid', (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  
  const data = loadServers();
  const server = data.servers.find(s => s.uuid === req.params.uuid && s.node_id === node.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const eggs = loadEggs();
  const egg = eggs.eggs.find(e => e.id === server.egg_id) || {};
  
  res.json({
    settings: {
      uuid: server.uuid,
      meta: { name: server.name, description: server.description || '' },
      suspended: server.suspended || false,
      environment: server.environment || {},
      invocation: server.startup || egg.startup || '',
      skip_egg_scripts: false,
      build: {
        memory_limit: server.limits?.memory || 1024,
        swap: server.limits?.swap || 0,
        io_weight: server.limits?.io || 500,
        cpu_limit: server.limits?.cpu || 100,
        disk_space: server.limits?.disk || 5120,
        threads: null
      },
      container: { image: server.docker_image || egg.docker_image || '' },
      allocations: {
        default: { ip: server.allocation?.ip || '0.0.0.0', port: server.allocation?.port || 25565 },
        mappings: { [server.allocation?.ip || '0.0.0.0']: [server.allocation?.port || 25565] }
      },
      mounts: [],
      egg: { id: egg.id || '', file_denylist: [] }
    },
    process_configuration: {
      startup: { done: ['Done'], user_interaction: [], strip_ansi: false },
      stop: { type: 'command', value: 'stop' },
      configs: []
    }
  });
});

app.get('/api/remote/servers/:uuid/install', (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  
  const data = loadServers();
  const server = data.servers.find(s => s.uuid === req.params.uuid && s.node_id === node.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const eggs = loadEggs();
  const egg = eggs.eggs.find(e => e.id === server.egg_id) || {};
  
  res.json({
    container_image: server.docker_image || egg.docker_image || '',
    entrypoint: 'bash',
    script: egg.install_script || '#!/bin/bash\necho "No install script"'
  });
});

app.post('/api/remote/servers/:uuid/install', (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  
  console.log('Install status received:', req.body);
  
  const data = loadServers();
  const serverIndex = data.servers.findIndex(s => s.uuid === req.params.uuid && s.node_id === node.id);
  if (serverIndex === -1) return res.status(404).json({ error: 'Server not found' });
  
  const successful = req.body.successful === true || req.body.successful === 'true';
  data.servers[serverIndex].status = successful ? 'offline' : 'install_failed';
  console.log('Server status set to:', data.servers[serverIndex].status);
  saveServers(data);
  res.json({ success: true });
});

app.post('/api/remote/activity', (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  res.json({ success: true });
});

app.post('/api/remote/sftp/auth', async (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  
  const { type, username, password } = req.body;
  const user = req.body.user || username;
  
  if (!user || !password) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  const parts = user.split('.');
  if (parts.length !== 2) {
    return res.status(403).json({ error: 'Invalid credentials' });
  }
  
  const [userName, serverIdent] = parts;
  const users = loadUsers();
  const userObj = users.users.find(u => u.username.toLowerCase() === userName.toLowerCase());
  if (!userObj) {
    return res.status(403).json({ error: 'Invalid credentials' });
  }
  
  const isValidPassword = await bcrypt.compare(password, userObj.password);
  if (!isValidPassword) {
    return res.status(403).json({ error: 'Invalid credentials' });
  }
  
  const servers = loadServers();
  const server = servers.servers.find(s => 
    (s.uuid === serverIdent || s.uuid.startsWith(serverIdent)) && 
    (s.user_id === userObj.id || userObj.isAdmin)
  );
  if (!server) {
    return res.status(403).json({ error: 'Invalid credentials' });
  }
  
  res.json({
    server: server.uuid,
    permissions: ['*'],
    user: userObj.id
  });
});

// ==================== USER LIMITS ====================
app.get('/api/user/limits', (req, res) => {
  const { username } = req.query;
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username?.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const servers = loadServers();
  const userServers = servers.servers.filter(s => s.user_id === user.id);
  
  const used = userServers.reduce((acc, s) => ({
    servers: acc.servers + 1,
    memory: acc.memory + (s.limits?.memory || 0),
    disk: acc.disk + (s.limits?.disk || 0),
    cpu: acc.cpu + (s.limits?.cpu || 0)
  }), { servers: 0, memory: 0, disk: 0, cpu: 0 });
  
  const limits = user.limits || { servers: 2, memory: 2048, disk: 10240, cpu: 200 };
  
  res.json({ limits, used });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const wss = new WebSocketServer({ server, path: '/ws/console' });

wss.on('connection', (clientWs, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const serverId = url.searchParams.get('server');
  const username = url.searchParams.get('username');
  
  if (!serverId || !username) {
    clientWs.close(4001, 'Missing parameters');
    return;
  }
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    clientWs.close(4002, 'User not found');
    return;
  }
  
  const servers = loadServers();
  const serverData = servers.servers.find(s => s.id === serverId);
  if (!serverData) {
    clientWs.close(4003, 'Server not found');
    return;
  }
  
  if (serverData.user_id !== user.id && !user.isAdmin) {
    clientWs.close(4004, 'Forbidden');
    return;
  }
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === serverData.node_id);
  if (!node) {
    clientWs.close(4005, 'Node not available');
    return;
  }
  
  const wsScheme = node.scheme === 'https' ? 'wss' : 'ws';
  const wingsWsUrl = `${wsScheme}://${node.fqdn}:${node.daemon_port}/api/servers/${serverData.uuid}/ws`;
  
  console.log(`[WS PROXY] Connecting to Wings: ${wingsWsUrl}`);
  
  const wsToken = jwt.sign({
    server_uuid: serverData.uuid,
    permissions: ['*'],
    user_uuid: user.id,
    user_id: user.id,
    unique_id: generateUUID()
  }, node.daemon_token, {
    expiresIn: '10m',
    issuer: node.fqdn,
    audience: [node.fqdn]
  });
  
  const wingsWs = new WebSocket(wingsWsUrl);
  
  wingsWs.on('open', () => {
    console.log('[WS PROXY] Connected to Wings, sending auth...');
    wingsWs.send(JSON.stringify({
      event: 'auth',
      args: [wsToken]
    }));
  });
  
  wingsWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      let message = data.toString();
      message = message.replace(/\[Pterodactyl Daemon\]:?/g, 'Sodium Daemon:');
      clientWs.send(message);
    }
  });
  
  wingsWs.on('close', () => {
    console.log('[WS PROXY] Wings connection closed');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });
  
  wingsWs.on('error', (err) => {
    console.error('[WS PROXY] Wings error:', err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(4006, 'Wings connection error');
    }
  });
  
  clientWs.on('message', (data) => {
    if (wingsWs.readyState === WebSocket.OPEN) {
      wingsWs.send(data.toString());
    }
  });
  
  clientWs.on('close', () => {
    console.log('[WS PROXY] Client disconnected');
    if (wingsWs.readyState === WebSocket.OPEN) {
      wingsWs.close();
    }
  });
});

server.listen(PORT, () => {
  console.log(`\x1b[36m┌──────────────────────────────────────────────\x1b[0m`);
  console.log(`\x1b[36m│ \x1b[37mSodium Server\x1b[0m`);
  console.log(`\x1b[36m├──────────────────────────────────────────────\x1b[0m`);
  console.log(`\x1b[36m│ \x1b[37mRunning on port \x1b[1m${PORT}\x1b[0m`);
  console.log(`\x1b[36m│ \x1b[37mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[36m└──────────────────────────────────────────────\x1b[0m`);
});
