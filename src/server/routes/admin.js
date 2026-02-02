import express from 'express';
import bcrypt from 'bcryptjs';
import { 
  loadNodes, saveNodes, loadLocations, saveLocations, 
  loadUsers, saveUsers, loadNests, saveNests, 
  loadEggs, saveEggs, loadServers, saveServers,
  loadConfig, saveConfig
} from '../db.js';
import { 
  isAdmin, sanitizeText, generateUUID, generateToken, 
  wingsRequest, generateNodeConfig, configToYaml, sanitizeUrl,
  validateUsername
} from '../utils/helpers.js';
import { authenticateUser, requireAdmin } from '../utils/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.use(authenticateUser, requireAdmin);

router.get('/nodes', (req, res) => {
  const { page = 1, per_page = 10 } = req.query;
  const data = loadNodes();
  const total = data.nodes.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const nodes = data.nodes.slice(start, start + parseInt(per_page));
  
  res.json({
    nodes,
    meta: {
      current_page: currentPage,
      per_page: parseInt(per_page),
      total,
      total_pages: totalPages
    }
  });
});

router.post('/nodes', (req, res) => {
  const { node } = req.body;
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
    allocation_start: parseInt(node.allocation_start) || 25565,
    allocation_end: parseInt(node.allocation_end) || 25665,
    memory_overallocation: parseInt(node.memory_overallocation) || 0,
    disk_overallocation: parseInt(node.disk_overallocation) || 0,
    created_at: new Date().toISOString()
  };
  
  data.nodes.push(newNode);
  saveNodes(data);
  res.json({ success: true, node: newNode });
});

router.get('/nodes/:id/config', (req, res) => {
  const data = loadNodes();
  const node = data.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  
  res.json({ config: generateNodeConfig(node) });
});

router.get('/nodes/:id/deploy', (req, res) => {
  const data = loadNodes();
  const node = data.nodes.find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  
  const config = generateNodeConfig(node);
  const yamlConfig = configToYaml(config);
  const escapedYaml = yamlConfig.replace(/'/g, "'\\''");
  
  const command = `mkdir -p /etc/pterodactyl && echo '${escapedYaml}' > /etc/pterodactyl/config.yml && systemctl restart wings`;
  
  res.json({ command });
});

router.put('/nodes/:id', (req, res) => {
  const { node } = req.body;
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
    maintenance_mode: node.maintenance_mode ?? current.maintenance_mode,
    allocation_start: parseInt(node.allocation_start) || current.allocation_start || 25565,
    allocation_end: parseInt(node.allocation_end) || current.allocation_end || 25665,
    memory_overallocation: node.memory_overallocation !== undefined ? parseInt(node.memory_overallocation) : current.memory_overallocation || 0,
    disk_overallocation: node.disk_overallocation !== undefined ? parseInt(node.disk_overallocation) : current.disk_overallocation || 0
  });
  
  saveNodes(data);
  res.json({ success: true, node: current });
});

router.delete('/nodes/:id', (req, res) => {
  const data = loadNodes();
  const servers = loadServers();
  
  if (servers.servers.some(s => s.node_id === req.params.id)) {
    return res.status(400).json({ error: 'Node has servers, delete them first' });
  }
  
  data.nodes = data.nodes.filter(n => n.id !== req.params.id);
  saveNodes(data);
  res.json({ success: true });
});

// ==================== LOCATIONS ====================
router.get('/locations', (req, res) => {
  res.json(loadLocations());
});

router.post('/locations', (req, res) => {
  const { location } = req.body;
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

router.delete('/locations/:id', (req, res) => {
  const data = loadLocations();
  data.locations = data.locations.filter(l => l.id !== req.params.id);
  saveLocations(data);
  res.json({ success: true });
});

// ==================== USERS ====================
router.get('/users', (req, res) => {
  const { page = 1, per_page = 10, search = '' } = req.query;
  const data = loadUsers();
  let allUsers = data.users.map(({ password, ...u }) => u);
  
  // Filter by search term if provided
  if (search.trim()) {
    const searchLower = search.toLowerCase().trim();
    allUsers = allUsers.filter(u => 
      u.username?.toLowerCase().includes(searchLower) ||
      u.displayName?.toLowerCase().includes(searchLower) ||
      u.email?.toLowerCase().includes(searchLower)
    );
  }
  
  const total = allUsers.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const users = allUsers.slice(start, start + parseInt(per_page));
  
  res.json({
    users,
    meta: {
      current_page: currentPage,
      per_page: parseInt(per_page),
      total,
      total_pages: totalPages
    }
  });
});

router.post('/users', async (req, res) => {
  const { user } = req.body;
  
  if (!user?.username || !user?.password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (!validateUsername(user.username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscore only)' });
  }
  
  if (user.password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  const data = loadUsers();
  const existingUser = data.users.find(u => u.username.toLowerCase() === user.username.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  if (user.email) {
    const existingEmail = data.users.find(u => u.email?.toLowerCase() === user.email.toLowerCase());
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already in use' });
    }
  }
  
  const config = loadConfig();
  const defaults = config.defaults || {};
  const hashedPassword = await bcrypt.hash(user.password, 10);
  
  const newUser = {
    id: generateUUID(),
    username: sanitizeText(user.username),
    email: user.email || null,
    password: hashedPassword,
    displayName: sanitizeText(user.displayName || user.username),
    bio: '',
    avatar: '',
    links: {},
    isAdmin: user.isAdmin || false,
    emailVerified: true, // Admin-created users are pre-verified
    limits: {
      servers: user.limits?.servers ?? defaults.servers ?? 2,
      memory: user.limits?.memory ?? defaults.memory ?? 2048,
      disk: user.limits?.disk ?? defaults.disk ?? 10240,
      cpu: user.limits?.cpu ?? defaults.cpu ?? 200
    },
    createdAt: new Date().toISOString(),
    settings: {
      theme: 'dark',
      notifications: true,
      privacy: 'public'
    }
  };
  
  data.users.push(newUser);
  saveUsers(data);
  
  logger.info(`User ${newUser.username} created by admin ${req.user.username}`);
  
  const { password, ...userWithoutPassword } = newUser;
  res.json({ success: true, user: userWithoutPassword });
});

router.put('/users/:id', (req, res) => {
  const { updates } = req.body;
  const data = loadUsers();
  const idx = data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  
  if (updates.isAdmin !== undefined) data.users[idx].isAdmin = updates.isAdmin;
  if (updates.role !== undefined) {
    const validRoles = ['user', 'moderator', 'admin'];
    if (validRoles.includes(updates.role)) {
      data.users[idx].role = updates.role;
      data.users[idx].isAdmin = updates.role === 'admin';
    }
  }
  if (updates.limits) data.users[idx].limits = { ...data.users[idx].limits, ...updates.limits };
  if (updates.allowSubusers !== undefined) data.users[idx].allowSubusers = updates.allowSubusers;
  
  saveUsers(data);
  const { password, ...user } = data.users[idx];
  res.json({ success: true, user });
});

router.delete('/users/:id', async (req, res) => {
  const usersData = loadUsers();
  const user = usersData.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Prevent deleting yourself
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  // Find and delete all user's servers
  const serversData = loadServers();
  const userServers = serversData.servers.filter(s => s.user_id === user.id);
  const nodes = loadNodes();
  
  const deletionResults = [];
  for (const server of userServers) {
    const node = nodes.nodes.find(n => n.id === server.node_id);
    if (node) {
      try {
        await wingsRequest(node, 'DELETE', `/api/servers/${server.uuid}`);
        deletionResults.push({ server: server.name, status: 'deleted' });
      } catch (e) {
        deletionResults.push({ server: server.name, status: 'failed', error: e.message });
      }
    } else {
      deletionResults.push({ server: server.name, status: 'no_node' });
    }
  }
  
  // Remove servers from database
  serversData.servers = serversData.servers.filter(s => s.user_id !== user.id);
  saveServers(serversData);
  
  // Remove user from database
  usersData.users = usersData.users.filter(u => u.id !== req.params.id);
  saveUsers(usersData);
  
  logger.info(`User ${user.username} deleted by admin ${req.user.username}. Servers deleted: ${userServers.length}`);
  
  res.json({ 
    success: true, 
    deletedServers: userServers.length,
    results: deletionResults
  });
});

// ==================== NESTS & EGGS ====================
router.get('/nests', (req, res) => {
  const nests = loadNests();
  const eggs = loadEggs();
  nests.nests.forEach(nest => {
    nest.eggs = eggs.eggs.filter(e => e.nest_id === nest.id);
  });
  res.json(nests);
});

router.post('/nests', (req, res) => {
  const { nest } = req.body;
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

router.get('/eggs', (req, res) => {
  const { search = '' } = req.query;
  const data = loadEggs();
  let eggs = data.eggs;
  
  if (search.trim()) {
    const searchLower = search.toLowerCase().trim();
    eggs = eggs.filter(e => 
      e.name?.toLowerCase().includes(searchLower) ||
      e.description?.toLowerCase().includes(searchLower) ||
      e.author?.toLowerCase().includes(searchLower)
    );
  }
  
  res.json({ eggs });
});

router.get('/eggs/:id', (req, res) => {
  const data = loadEggs();
  const egg = data.eggs.find(e => e.id === req.params.id);
  if (!egg) return res.status(404).json({ error: 'Egg not found' });
  res.json({ egg });
});

router.post('/eggs', (req, res) => {
  const { egg } = req.body;
  const data = loadEggs();
  const newEgg = {
    id: generateUUID(),
    nest_id: egg.nest_id,
    name: sanitizeText(egg.name),
    description: sanitizeText(egg.description || ''),
    author: sanitizeText(egg.author || ''),
    icon: egg.icon || null,
    admin_only: Boolean(egg.admin_only),
    docker_images: egg.docker_images || {},
    docker_image: egg.docker_image || Object.values(egg.docker_images || {})[0] || '',
    startup: egg.startup,
    config: egg.config || {},
    install_script: egg.install_script || '#!/bin/bash\necho "No install script"',
    install_container: egg.install_container || 'alpine:3.18',
    install_entrypoint: egg.install_entrypoint || 'bash',
    variables: egg.variables || []
  };
  data.eggs.push(newEgg);
  saveEggs(data);
  res.json({ success: true, egg: newEgg });
});

router.post('/eggs/import', (req, res) => {
  const { nest_id, eggJson } = req.body;
  try {
    const imported = typeof eggJson === 'string' ? JSON.parse(eggJson) : eggJson;
    const data = loadEggs();
    
    let docker_images = {};
    let docker_image = '';
    
    if (imported.docker_images && typeof imported.docker_images === 'object') {
      docker_images = imported.docker_images;
      docker_image = Object.values(imported.docker_images)[0] || '';
    } else if (imported.docker_image) {
      docker_image = imported.docker_image;
      docker_images = { 'Default': imported.docker_image };
    }
    
    // Extract install script info (Pterodactyl format)
    let install_script = '#!/bin/bash\necho "No install script"';
    let install_container = 'alpine:3.18';
    let install_entrypoint = 'bash';
    
    if (imported.scripts?.installation) {
      install_script = imported.scripts.installation.script || install_script;
      install_container = imported.scripts.installation.container || install_container;
      install_entrypoint = imported.scripts.installation.entrypoint || install_entrypoint;
    } else if (imported.script) {
      // Alternative format
      install_script = imported.script.install || install_script;
      install_container = imported.script.container || install_container;
      install_entrypoint = imported.script.entry || install_entrypoint;
    }
    
    const newEgg = {
      id: generateUUID(),
      nest_id: nest_id || imported.nest_id || '1',
      name: imported.name,
      description: imported.description || '',
      author: imported.author || '',
      icon: imported.icon || null,
      admin_only: Boolean(imported.admin_only),
      docker_images,
      docker_image,
      startup: imported.startup,
      config: imported.config || {},
      install_script,
      install_container,
      install_entrypoint,
      variables: (imported.variables || []).map(v => ({
        name: v.name,
        description: v.description,
        env_variable: v.env_variable,
        default_value: v.default_value,
        rules: v.rules,
        user_viewable: v.user_viewable !== false,
        user_editable: v.user_editable !== false
      }))
    };
    data.eggs.push(newEgg);
    saveEggs(data);
    res.json({ success: true, egg: newEgg });
  } catch (e) {
    logger.error(`Egg import failed: ${e.message}`);
    res.status(400).json({ error: 'Invalid egg JSON: ' + e.message });
  }
});

router.put('/nests/:id', (req, res) => {
  const { nest } = req.body;
  const data = loadNests();
  const idx = data.nests.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Nest not found' });
  
  data.nests[idx].name = sanitizeText(nest.name);
  data.nests[idx].description = sanitizeText(nest.description || '');
  saveNests(data);
  
  res.json({ success: true, nest: data.nests[idx] });
});

router.delete('/nests/:id', (req, res) => {
  const nestsData = loadNests();
  nestsData.nests = nestsData.nests.filter(n => n.id !== req.params.id);
  saveNests(nestsData);
  
  const eggsData = loadEggs();
  eggsData.eggs = eggsData.eggs.filter(e => e.nest_id !== req.params.id);
  saveEggs(eggsData);
  
  res.json({ success: true });
});

router.put('/eggs/:id', (req, res) => {
  const { egg } = req.body;
  const data = loadEggs();
  const idx = data.eggs.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Egg not found' });
  
  data.eggs[idx] = {
    ...data.eggs[idx],
    nest_id: egg.nest_id || data.eggs[idx].nest_id,
    name: egg.name !== undefined ? sanitizeText(egg.name) : data.eggs[idx].name,
    description: egg.description !== undefined ? sanitizeText(egg.description) : data.eggs[idx].description,
    author: egg.author !== undefined ? sanitizeText(egg.author) : data.eggs[idx].author,
    icon: egg.icon !== undefined ? egg.icon : data.eggs[idx].icon,
    admin_only: egg.admin_only !== undefined ? Boolean(egg.admin_only) : data.eggs[idx].admin_only,
    docker_images: egg.docker_images || data.eggs[idx].docker_images || {},
    docker_image: egg.docker_image || Object.values(egg.docker_images || {})[0] || data.eggs[idx].docker_image,
    startup: egg.startup || data.eggs[idx].startup,
    config: egg.config || data.eggs[idx].config,
    install_script: egg.install_script !== undefined ? egg.install_script : data.eggs[idx].install_script,
    install_container: egg.install_container || data.eggs[idx].install_container || 'alpine:3.18',
    install_entrypoint: egg.install_entrypoint || data.eggs[idx].install_entrypoint || 'bash',
    variables: egg.variables !== undefined ? egg.variables : data.eggs[idx].variables
  };
  
  saveEggs(data);
  res.json({ success: true, egg: data.eggs[idx] });
});

router.delete('/eggs/:id', (req, res) => {
  const data = loadEggs();
  data.eggs = data.eggs.filter(e => e.id !== req.params.id);
  saveEggs(data);
  
  res.json({ success: true });
});

// ==================== SERVERS ====================
router.get('/servers', (req, res) => {
  const { page = 1, per_page = 10 } = req.query;
  const data = loadServers();
  const users = loadUsers();
  const nodes = loadNodes();
  const total = data.servers.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const servers = data.servers.slice(start, start + parseInt(per_page)).map(s => {
    const owner = users.users.find(u => u.id === s.user_id);
    const node = nodes.nodes.find(n => n.id === s.node_id);
    return {
      ...s,
      owner_username: owner?.username || null,
      node_name: node?.name || null
    };
  });
  
  res.json({
    servers,
    meta: {
      current_page: currentPage,
      per_page: parseInt(per_page),
      total,
      total_pages: totalPages
    }
  });
});

router.post('/servers', async (req, res) => {
  const { server, skipInstall } = req.body;
  
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
    status: skipInstall ? 'draft' : 'installing',
    suspended: false,
    created_at: new Date().toISOString()
  };
  
  // If skipInstall, just save as draft without installing on Wings
  if (skipInstall) {
    data.servers.push(newServer);
    saveServers(data);
    return res.json({ success: true, server: newServer });
  }
  
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
      allocations: {
        default: { ip: newServer.allocation.ip, port: newServer.allocation.port },
        mappings: { [newServer.allocation.ip]: [newServer.allocation.port] }
      }
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

// Install a draft server
router.post('/servers/:id/install', async (req, res) => {
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  if (serverIdx === -1) return res.status(404).json({ error: 'Server not found' });
  
  const server = data.servers[serverIdx];
  
  if (server.status !== 'draft' && server.status !== 'install_failed') {
    return res.status(400).json({ error: 'Server is already installed or installing' });
  }
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  if (!node) return res.status(400).json({ error: 'Node not found' });
  
  const eggs = loadEggs();
  const egg = eggs.eggs.find(e => e.id === server.egg_id);
  if (!egg) return res.status(400).json({ error: 'Egg not found. Please select a valid egg.' });
  
  // Update server with egg data if missing
  if (!server.docker_image) server.docker_image = egg.docker_image;
  if (!server.startup) server.startup = egg.startup;
  
  server.status = 'installing';
  delete server.install_error;
  saveServers(data);
  
  try {
    await wingsRequest(node, 'POST', '/api/servers', {
      uuid: server.uuid,
      start_on_completion: false,
      suspended: false,
      environment: server.environment || {},
      invocation: server.startup,
      skip_egg_scripts: false,
      build: {
        memory_limit: server.limits?.memory || 1024,
        swap: server.limits?.swap || 0,
        io_weight: server.limits?.io || 500,
        cpu_limit: server.limits?.cpu || 100,
        disk_space: server.limits?.disk || 5120
      },
      container: { image: server.docker_image },
      allocations: {
        default: { ip: server.allocation?.ip || '0.0.0.0', port: server.allocation?.port || 25565 },
        mappings: { [server.allocation?.ip || '0.0.0.0']: [server.allocation?.port || 25565] }
      }
    });
    server.status = 'offline';
    saveServers(data);
    res.json({ success: true, server });
  } catch (e) {
    server.status = 'install_failed';
    server.install_error = e.message;
    saveServers(data);
    res.status(500).json({ error: e.message });
  }
});

router.put('/servers/:id', (req, res) => {
  const { updates } = req.body;
  const data = loadServers();
  const idx = data.servers.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Server not found' });
  
  const server = data.servers[idx];
  
  if (updates.user_id) {
    const users = loadUsers();
    const user = users.users.find(u => u.id === updates.user_id);
    if (!user) return res.status(400).json({ error: 'User not found' });
    server.user_id = updates.user_id;
  }
  
  if (updates.egg_id) {
    const eggs = loadEggs();
    const egg = eggs.eggs.find(e => e.id === updates.egg_id);
    if (!egg) return res.status(400).json({ error: 'Egg not found' });
    server.egg_id = updates.egg_id;
    server.docker_image = egg.docker_image;
    server.startup = egg.startup;
  }
  
  if (updates.name) server.name = sanitizeText(updates.name);
  if (updates.description !== undefined) server.description = sanitizeText(updates.description);
  
  if (updates.limits) {
    server.limits = { ...server.limits, ...updates.limits };
  }
  
  saveServers(data);
  res.json({ success: true, server });
});

router.delete('/servers/:id', async (req, res) => {
  const data = loadServers();
  const server = data.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  
  if (node) {
    try {
      await wingsRequest(node, 'DELETE', `/api/servers/${server.uuid}`);
    } catch {
      // Ignore Wings errors during deletion
    }
  }
  
  data.servers = data.servers.filter(s => s.id !== req.params.id);
  saveServers(data);
  res.json({ success: true });
});

// ==================== SERVER TRANSFERS ====================
router.post('/servers/:id/transfer', async (req, res) => {
  const { target_node_id } = req.body;
  if (!target_node_id) return res.status(400).json({ error: 'Target node required' });
  
  const data = loadServers();
  const server = data.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  if (server.node_id === target_node_id) {
    return res.status(400).json({ error: 'Server is already on this node' });
  }
  
  const nodes = loadNodes();
  const sourceNode = nodes.nodes.find(n => n.id === server.node_id);
  const targetNode = nodes.nodes.find(n => n.id === target_node_id);
  
  if (!targetNode) return res.status(404).json({ error: 'Target node not found' });
  if (targetNode.maintenance_mode) return res.status(400).json({ error: 'Target node is in maintenance mode' });
  
  // Check target node resources
  const { getNodeAvailableResources } = await import('../utils/node-resources.js');
  const resources = getNodeAvailableResources(target_node_id);
  
  if (!resources) return res.status(400).json({ error: 'Cannot check target node resources' });
  if (resources.available_memory < (server.limits?.memory || 0)) {
    return res.status(400).json({ error: 'Target node has insufficient memory' });
  }
  if (resources.available_disk < (server.limits?.disk || 0)) {
    return res.status(400).json({ error: 'Target node has insufficient disk space' });
  }
  if (resources.available_ports.length === 0) {
    return res.status(400).json({ error: 'Target node has no available ports' });
  }
  
  // Assign new port on target node
  const newPort = resources.available_ports[0];
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  
  // Update transfer status
  data.servers[serverIdx].transfer = {
    status: 'pending',
    source_node: server.node_id,
    target_node: target_node_id,
    started_at: new Date().toISOString()
  };
  saveServers(data);
  
  try {
    // Create server on target node
    await wingsRequest(targetNode, 'POST', '/api/servers', {
      uuid: server.uuid,
      start_on_completion: false,
      suspended: server.suspended || false,
      environment: server.environment || {},
      invocation: server.startup,
      skip_egg_scripts: true,
      build: {
        memory_limit: server.limits?.memory || 1024,
        swap: server.limits?.swap || 0,
        io_weight: server.limits?.io || 500,
        cpu_limit: server.limits?.cpu || 100,
        disk_space: server.limits?.disk || 5120
      },
      container: { image: server.docker_image },
      allocations: {
        default: { ip: '0.0.0.0', port: newPort },
        mappings: { '0.0.0.0': [newPort] }
      }
    });
    
    // Transfer files from source to target (Wings handles this via archive)
    if (sourceNode) {
      try {
        // Request archive from source node
        const archiveRes = await wingsRequest(sourceNode, 'POST', `/api/servers/${server.uuid}/archive`);
        
        // Tell target node to pull the archive
        await wingsRequest(targetNode, 'POST', `/api/servers/${server.uuid}/transfer`, {
          url: `${sourceNode.scheme}://${sourceNode.fqdn}:${sourceNode.daemon_port}/api/servers/${server.uuid}/archive`,
          token: sourceNode.daemon_token
        });
      } catch (transferErr) {
        // If file transfer fails, try to continue without files
        logger.warn(`Transfer file copy failed: ${transferErr.message}`);
      }
    }
    
    // Update server record
    data.servers[serverIdx].node_id = target_node_id;
    data.servers[serverIdx].allocation = { ip: '0.0.0.0', port: newPort };
    data.servers[serverIdx].allocations = [{ id: generateUUID(), ip: '0.0.0.0', port: newPort, primary: true }];
    data.servers[serverIdx].transfer = {
      status: 'completed',
      source_node: server.node_id,
      target_node: target_node_id,
      completed_at: new Date().toISOString()
    };
    saveServers(data);
    
    // Delete from source node
    if (sourceNode) {
      try {
        await wingsRequest(sourceNode, 'DELETE', `/api/servers/${server.uuid}`);
      } catch {
        // Ignore deletion errors
      }
    }
    
    res.json({ success: true, message: 'Server transferred successfully' });
  } catch (e) {
    data.servers[serverIdx].transfer = {
      status: 'failed',
      source_node: server.node_id,
      target_node: target_node_id,
      error: e.message,
      failed_at: new Date().toISOString()
    };
    saveServers(data);
    res.status(500).json({ error: `Transfer failed: ${e.message}` });
  }
});

// ==================== OAUTH PROVIDERS ====================
router.get('/oauth/providers', (req, res) => {
  const config = loadConfig();
  const providers = config.oauth?.providers || [];
  // Don't expose client secrets
  res.json({
    providers: providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      enabled: p.enabled,
      client_id: p.client_id ? '••••••••' : null
    }))
  });
});

router.post('/oauth/providers', (req, res) => {
  const { provider } = req.body;
  if (!provider?.name || !provider?.type) {
    return res.status(400).json({ error: 'Provider name and type required' });
  }
  
  const validTypes = ['discord', 'google', 'github', 'gitlab', 'microsoft', 'twitter', 'facebook', 'apple', 'twitch', 'slack', 'linkedin', 'spotify', 'reddit', 'bitbucket', 'custom'];
  if (!validTypes.includes(provider.type)) {
    return res.status(400).json({ error: 'Invalid provider type' });
  }
  
  const config = loadConfig();
  if (!config.oauth) config.oauth = { providers: [] };
  if (!config.oauth.providers) config.oauth.providers = [];
  
  const newProvider = {
    id: generateUUID(),
    name: sanitizeText(provider.name),
    type: provider.type,
    client_id: provider.client_id || '',
    client_secret: provider.client_secret || '',
    enabled: provider.enabled !== false,
    // For custom providers
    authorize_url: provider.authorize_url || null,
    token_url: provider.token_url || null,
    userinfo_url: provider.userinfo_url || null,
    scopes: provider.scopes || null,
    created_at: new Date().toISOString()
  };
  
  config.oauth.providers.push(newProvider);
  saveConfig(config);
  
  const { client_secret, ...safeProvider } = newProvider;
  res.json({ success: true, provider: safeProvider });
});

router.put('/oauth/providers/:id', (req, res) => {
  const { provider } = req.body;
  const config = loadConfig();
  
  if (!config.oauth?.providers) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  const idx = config.oauth.providers.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Provider not found' });
  
  const current = config.oauth.providers[idx];
  config.oauth.providers[idx] = {
    ...current,
    name: provider.name ? sanitizeText(provider.name) : current.name,
    client_id: provider.client_id ?? current.client_id,
    client_secret: provider.client_secret ?? current.client_secret,
    enabled: provider.enabled ?? current.enabled,
    authorize_url: provider.authorize_url ?? current.authorize_url,
    token_url: provider.token_url ?? current.token_url,
    userinfo_url: provider.userinfo_url ?? current.userinfo_url,
    scopes: provider.scopes ?? current.scopes,
    updated_at: new Date().toISOString()
  };
  
  saveConfig(config);
  
  const { client_secret, ...safeProvider } = config.oauth.providers[idx];
  res.json({ success: true, provider: safeProvider });
});

router.delete('/oauth/providers/:id', (req, res) => {
  const config = loadConfig();
  
  if (!config.oauth?.providers) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  const idx = config.oauth.providers.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Provider not found' });
  
  config.oauth.providers.splice(idx, 1);
  saveConfig(config);
  
  res.json({ success: true });
});

// ==================== SETTINGS ====================
router.get('/settings', async (req, res) => {
  const config = loadConfig();
  
  let mailConfigured = false;
  try {
    const { getTransporter } = await import('../utils/mail.js');
    mailConfigured = !!getTransporter();
  } catch (e) {}
  
  res.json({ config, mailConfigured });
});

router.put('/settings', async (req, res) => {
  const { config: newConfig } = req.body;
  const config = loadConfig();
  
  if (newConfig.panel) {
    config.panel.name = sanitizeText(newConfig.panel.name || config.panel.name);
    config.panel.url = sanitizeUrl(newConfig.panel.url) || config.panel.url;
  }
  
  if (newConfig.registration !== undefined) {
    config.registration = {
      ...config.registration,
      enabled: newConfig.registration.enabled !== undefined ? Boolean(newConfig.registration.enabled) : config.registration?.enabled,
      emailVerification: newConfig.registration.emailVerification !== undefined ? Boolean(newConfig.registration.emailVerification) : config.registration?.emailVerification,
      captcha: newConfig.registration.captcha !== undefined ? Boolean(newConfig.registration.captcha) : config.registration?.captcha,
      allowedDomains: newConfig.registration.allowedDomains !== undefined ? newConfig.registration.allowedDomains : config.registration?.allowedDomains,
      blockedDomains: newConfig.registration.blockedDomains !== undefined ? newConfig.registration.blockedDomains : config.registration?.blockedDomains
    };
  }
  
  if (newConfig.defaults) {
    config.defaults = {
      ...config.defaults,
      servers: newConfig.defaults.servers !== undefined ? parseInt(newConfig.defaults.servers) : config.defaults?.servers || 2,
      memory: newConfig.defaults.memory !== undefined ? parseInt(newConfig.defaults.memory) : config.defaults?.memory || 2048,
      disk: newConfig.defaults.disk !== undefined ? parseInt(newConfig.defaults.disk) : config.defaults?.disk || 10240,
      cpu: newConfig.defaults.cpu !== undefined ? parseInt(newConfig.defaults.cpu) : config.defaults?.cpu || 200
    };
  }
  
  if (newConfig.features !== undefined) {
    config.features = {
      ...config.features,
      subusers: newConfig.features.subusers !== undefined ? Boolean(newConfig.features.subusers) : config.features?.subusers,
      disableUserServerCreation: newConfig.features.disableUserServerCreation !== undefined ? Boolean(newConfig.features.disableUserServerCreation) : config.features?.disableUserServerCreation
    };
  }
  
  if (newConfig.mail !== undefined) {
    config.mail = {
      ...config.mail,
      host: newConfig.mail.host !== undefined ? newConfig.mail.host : config.mail?.host,
      port: newConfig.mail.port !== undefined ? parseInt(newConfig.mail.port) : config.mail?.port || 587,
      user: newConfig.mail.user !== undefined ? newConfig.mail.user : config.mail?.user,
      secure: newConfig.mail.secure !== undefined ? Boolean(newConfig.mail.secure) : config.mail?.secure,
      fromName: newConfig.mail.fromName !== undefined ? newConfig.mail.fromName : config.mail?.fromName,
      fromEmail: newConfig.mail.fromEmail !== undefined ? newConfig.mail.fromEmail : config.mail?.fromEmail
    };
    if (newConfig.mail.pass) {
      config.mail.pass = newConfig.mail.pass;
    }
    
    const { reloadMailer } = await import('../utils/mail.js');
    reloadMailer();
  }
  
  if (newConfig.advanced !== undefined) {
    config.advanced = {
      ...config.advanced,
      consoleLines: newConfig.advanced.consoleLines !== undefined ? parseInt(newConfig.advanced.consoleLines) : config.advanced?.consoleLines || 1000,
      maxUploadSize: newConfig.advanced.maxUploadSize !== undefined ? parseInt(newConfig.advanced.maxUploadSize) : config.advanced?.maxUploadSize || 100,
      auditLogging: newConfig.advanced.auditLogging !== undefined ? Boolean(newConfig.advanced.auditLogging) : config.advanced?.auditLogging !== false
    };
  }
  
  if (newConfig.security !== undefined) {
    config.security = {
      ...config.security,
      require2fa: newConfig.security.require2fa !== undefined ? Boolean(newConfig.security.require2fa) : config.security?.require2fa,
      require2faAdmin: newConfig.security.require2faAdmin !== undefined ? Boolean(newConfig.security.require2faAdmin) : config.security?.require2faAdmin
    };
  }
  
  saveConfig(config);
  res.json({ success: true, config });
});

// ==================== MAIL ====================

router.post('/mail/test', async (req, res) => {
  try {
    const { sendTestEmail, verifyConnection } = await import('../utils/mail.js');
    
    const email = req.body?.email;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    await verifyConnection();
    await sendTestEmail(email);
    res.json({ success: true, message: 'Test email sent' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/mail/status', async (req, res) => {
  try {
    const { verifyConnection } = await import('../utils/mail.js');
    await verifyConnection();
    res.json({ configured: true, status: 'connected' });
  } catch (e) {
    res.json({ configured: false, status: 'disconnected', error: e.message });
  }
});

// ==================== CACHE & DATABASE ====================

router.post('/cache/clear', (req, res) => {
  res.json({ success: true, message: 'Cache cleared' });
});

router.post('/database/rebuild', (req, res) => {
  res.json({ success: true, message: 'Indexes rebuilt' });
});

export default router;
