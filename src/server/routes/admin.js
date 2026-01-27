import express from 'express';
import { 
  loadNodes, saveNodes, loadLocations, saveLocations, 
  loadUsers, saveUsers, loadNests, saveNests, 
  loadEggs, saveEggs, loadServers, saveServers,
  loadConfig, saveConfig
} from '../db.js';
import { 
  isAdmin, sanitizeText, generateUUID, generateToken, 
  wingsRequest, generateNodeConfig, configToYaml, sanitizeUrl
} from '../utils/helpers.js';

const router = express.Router();

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
    allocation_end: parseInt(node.allocation_end) || current.allocation_end || 25665
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
  const { page = 1, per_page = 10 } = req.query;
  const data = loadUsers();
  const allUsers = data.users.map(({ password, ...u }) => u);
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

router.put('/users/:id', (req, res) => {
  const { updates } = req.body;
  const data = loadUsers();
  const idx = data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  
  if (updates.isAdmin !== undefined) data.users[idx].isAdmin = updates.isAdmin;
  if (updates.limits) data.users[idx].limits = updates.limits;
  
  saveUsers(data);
  const { password, ...user } = data.users[idx];
  res.json({ success: true, user });
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
  res.json(loadEggs());
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
    docker_images: egg.docker_images || {},
    docker_image: egg.docker_image || Object.values(egg.docker_images || {})[0] || '',
    startup: egg.startup,
    config: egg.config || {},
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
    
    const newEgg = {
      id: generateUUID(),
      nest_id: nest_id || imported.nest_id || '1',
      name: imported.name,
      description: imported.description || '',
      author: imported.author || '',
      docker_images,
      docker_image,
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
    console.error('[EGG IMPORT] Error:', e.message);
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
    name: sanitizeText(egg.name),
    description: sanitizeText(egg.description || ''),
    author: sanitizeText(egg.author || ''),
    docker_images: egg.docker_images || data.eggs[idx].docker_images || {},
    docker_image: egg.docker_image || Object.values(egg.docker_images || {})[0] || data.eggs[idx].docker_image,
    startup: egg.startup || data.eggs[idx].startup,
    config: egg.config || data.eggs[idx].config
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
  const total = data.servers.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const servers = data.servers.slice(start, start + parseInt(per_page));
  
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
  const { server } = req.body;
  
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

router.delete('/servers/:id', async (req, res) => {
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

// ==================== SETTINGS ====================
router.get('/settings', (req, res) => {
  const config = loadConfig();
  res.json({ config });
});

router.put('/settings', (req, res) => {
  const { config: newConfig } = req.body;
  const config = loadConfig();
  
  if (newConfig.panel) {
    config.panel.name = sanitizeText(newConfig.panel.name || config.panel.name);
    config.panel.url = sanitizeUrl(newConfig.panel.url) || config.panel.url;
  }
  
  if (newConfig.registration !== undefined) {
    config.registration = {
      enabled: Boolean(newConfig.registration.enabled)
    };
  }
  
  if (newConfig.defaults) {
    config.defaults = {
      servers: parseInt(newConfig.defaults.servers) || 2,
      memory: parseInt(newConfig.defaults.memory) || 2048,
      disk: parseInt(newConfig.defaults.disk) || 10240,
      cpu: parseInt(newConfig.defaults.cpu) || 200
    };
  }
  
  saveConfig(config);
  res.json({ success: true, config });
});

export default router;
