import express from 'express';
import { loadUsers, loadServers, saveServers, loadNodes, loadEggs, loadNests } from '../db.js';
import { wingsRequest, sanitizeText, generateUUID, validateVariableValue } from '../utils/helpers.js';
import { getNodeAvailableResources } from '../utils/node-resources.js';

const router = express.Router();

// Ruta pública para obtener nests con eggs (para crear servidores)
router.get('/nests', (req, res) => {
  const nests = loadNests();
  const eggs = loadEggs();
  nests.nests.forEach(nest => {
    nest.eggs = eggs.eggs.filter(e => e.nest_id === nest.id);
  });
  res.json(nests);
});

// Helper privado para este router
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

// Lista de servidores del usuario
router.get('/', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username required' });
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const data = loadServers();
  const nodes = loadNodes();
  
  const userServers = data.servers
    .filter(s => s.user_id === user.id)
    .map(server => {
      const node = nodes.nodes.find(n => n.id === server.node_id);
      return {
        ...server,
        node_address: node ? `${node.fqdn}:${server.allocation?.port || 25565}` : null,
        node_name: node?.name || null
      };
    });
  
  res.json({ servers: userServers });
});

// Crear Servidor (Usuario)
router.post('/', async (req, res) => {
  const { username, name, egg_id, memory, disk, cpu } = req.body;
  
  if (!username) return res.status(400).json({ error: 'Username required' });
  if (!name) return res.status(400).json({ error: 'Server name required' });
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const userLimits = user.limits || { servers: 2, memory: 2048, disk: 10240, cpu: 200 };
  const servers = loadServers();
  const userServers = servers.servers.filter(s => s.user_id === user.id);
  
  const usedResources = userServers.reduce((acc, s) => ({
    servers: acc.servers + 1,
    memory: acc.memory + (s.limits?.memory || 0),
    disk: acc.disk + (s.limits?.disk || 0),
    cpu: acc.cpu + (s.limits?.cpu || 0)
  }), { servers: 0, memory: 0, disk: 0, cpu: 0 });
  
  const requestedMemory = parseInt(memory) || 512;
  const requestedDisk = parseInt(disk) || 1024;
  const requestedCpu = parseInt(cpu) || 100;
  
  if (usedResources.servers + 1 > userLimits.servers) {
    return res.status(400).json({ error: 'Server limit reached' });
  }
  if (usedResources.memory + requestedMemory > userLimits.memory) {
    return res.status(400).json({ error: 'Memory limit exceeded' });
  }
  if (usedResources.disk + requestedDisk > userLimits.disk) {
    return res.status(400).json({ error: 'Disk limit exceeded' });
  }
  if (usedResources.cpu + requestedCpu > userLimits.cpu) {
    return res.status(400).json({ error: 'CPU limit exceeded' });
  }
  
  const eggs = loadEggs();
  const egg = eggs.eggs.find(e => e.id === egg_id);
  if (!egg) return res.status(400).json({ error: 'Invalid egg' });
  
  const nodes = loadNodes();
  let bestNode = null;
  let bestNodeResources = null;
  let lowestUsage = Infinity;
  
  for (const n of nodes.nodes) {
    if (n.maintenance_mode) continue;
    
    const resources = getNodeAvailableResources(n.id);
    if (!resources) continue;
    
    if (resources.available_memory < requestedMemory) continue;
    if (resources.available_disk < requestedDisk) continue;
    if (resources.available_ports.length === 0) continue;
    
    const memoryUsage = 1 - (resources.available_memory / n.memory);
    const diskUsage = 1 - (resources.available_disk / n.disk);
    const avgUsage = (memoryUsage + diskUsage) / 2;
    
    if (avgUsage < lowestUsage) {
      lowestUsage = avgUsage;
      bestNode = n;
      bestNodeResources = resources;
    }
  }
  
  if (!bestNode || !bestNodeResources) {
    return res.status(400).json({ error: 'No available nodes with enough resources' });
  }
  
  const availablePorts = bestNodeResources.available_ports;
  const randomPort = availablePorts[Math.floor(Math.random() * availablePorts.length)];
  
  const uuid = generateUUID();
  const newServer = {
    id: uuid,
    uuid,
    name: sanitizeText(name),
    description: '',
    user_id: user.id,
    node_id: bestNode.id,
    egg_id: egg_id,
    docker_image: egg.docker_image,
    startup: egg.startup,
    limits: {
      memory: requestedMemory,
      disk: requestedDisk,
      cpu: requestedCpu,
      io: 500,
      swap: 0
    },
    feature_limits: {
      databases: 0,
      backups: 0,
      allocations: 1
    },
    environment: {},
    allocation: { ip: '0.0.0.0', port: randomPort },
    status: 'installing',
    suspended: false,
    created_at: new Date().toISOString()
  };
  
  const node = bestNode;
  
  let startupConfig = { done: ['Done'] };
  let stopConfig = { type: 'command', value: 'stop' };
  
  try {
    if (egg.config?.startup) {
      const parsed = JSON.parse(egg.config.startup);
      if (parsed.done) {
        startupConfig.done = Array.isArray(parsed.done) ? parsed.done : [parsed.done];
      }
    }
    if (egg.config?.stop) {
      if (egg.config.stop === '^C') {
        stopConfig = { type: 'signal', value: 'SIGINT' };
      } else {
        stopConfig = { type: 'command', value: egg.config.stop };
      }
    }
  } catch (e) {
    console.log('[SERVER CREATE] Error parsing egg config:', e.message);
  }
  
  const defaultEnv = {};
  if (egg.variables && Array.isArray(egg.variables)) {
    for (const v of egg.variables) {
      defaultEnv[v.env_variable] = v.default_value || '';
    }
  }
  
  try {
    const wingsPayload = {
      uuid: newServer.uuid,
      start_on_completion: false,
      suspended: false,
      environment: { ...defaultEnv, ...newServer.environment },
      invocation: newServer.startup,
      skip_egg_scripts: false,
      build: {
        memory_limit: newServer.limits.memory,
        swap: newServer.limits.swap,
        io_weight: newServer.limits.io,
        cpu_limit: newServer.limits.cpu,
        disk_space: newServer.limits.disk,
        threads: null
      },
      container: { 
        image: newServer.docker_image 
      },
      allocations: {
        default: { 
          ip: newServer.allocation.ip, 
          port: newServer.allocation.port 
        },
        mappings: { 
          [newServer.allocation.ip]: [newServer.allocation.port] 
        }
      },
      mounts: [],
      egg: {
        id: egg.id || '',
        file_denylist: []
      },
      process_configuration: {
        startup: {
          done: startupConfig.done,
          user_interaction: [],
          strip_ansi: false
        },
        stop: stopConfig,
        configs: []
      }
    };
    
    newServer.environment = { ...defaultEnv, ...newServer.environment };
    servers.servers.push(newServer);
    saveServers(servers);
    
    await wingsRequest(node, 'POST', '/api/servers', wingsPayload);
    
    const updatedServers = loadServers();
    const idx = updatedServers.servers.findIndex(s => s.id === newServer.id);
    if (idx !== -1) {
      updatedServers.servers[idx].status = 'installing';
      saveServers(updatedServers);
    }
    
    res.json({ success: true, server: newServer });
  } catch (e) {
    console.error('[SERVER CREATE] Wings error:', e.message);
    const updatedServers = loadServers();
    const idx = updatedServers.servers.findIndex(s => s.id === newServer.id);
    if (idx !== -1) {
      updatedServers.servers[idx].status = 'install_failed';
      updatedServers.servers[idx].install_error = e.message;
      saveServers(updatedServers);
    }
    res.json({ success: true, server: { ...newServer, status: 'install_failed', install_error: e.message } });
  }
});

router.get('/:id', async (req, res) => {
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
  
  const serverWithNode = {
    ...server,
    node_address: node ? `${node.fqdn}:${server.allocation?.port || 25565}` : null,
    node_name: node?.name || null
  };
  
  res.json({ server: serverWithNode });
});

router.post('/:id/power', async (req, res) => {
  const { username, action } = req.body;
  if (!['start', 'stop', 'restart', 'kill'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/power`, { action });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/command', async (req, res) => {
  const { username, command } = req.body;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/commands`, { command });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/websocket', async (req, res) => {
  const { username } = req.query;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  
  const wsScheme = node.scheme === 'https' ? 'wss' : 'ws';
  const wsUrl = `${wsScheme}://${node.fqdn}:${node.daemon_port}/api/servers/${server.uuid}/ws`;
  
  res.json({
    data: {
      token: node.daemon_token,
      socket: wsUrl
    }
  });
});

// Detalles y Settings del Server
router.put('/:id/details', async (req, res) => {
  const { username, name, description } = req.body;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Server name is required' });
  }
  if (name.length > 50) {
    return res.status(400).json({ error: 'Server name must be 50 characters or less' });
  }
  
  const data = loadServers();
  const serverIndex = data.servers.findIndex(s => s.id === req.params.id);
  
  data.servers[serverIndex].name = sanitizeText(name.trim());
  data.servers[serverIndex].description = sanitizeText((description || '').slice(0, 200));
  saveServers(data);
  
  try {
    const eggs = loadEggs();
    const egg = eggs.eggs.find(e => e.id === server.egg_id) || {};
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/sync`, {
      uuid: server.uuid,
      suspended: server.suspended || false,
      environment: server.environment || {},
      invocation: server.startup || egg.startup || '',
      skip_egg_scripts: false,
      build: {
        memory_limit: server.limits?.memory || 1024,
        swap: server.limits?.swap || 0,
        io_weight: server.limits?.io || 500,
        cpu_limit: server.limits?.cpu || 100,
        disk_space: server.limits?.disk || 5120
      },
      container: {
        image: server.docker_image || egg.docker_image || ''
      }
    });
  } catch (e) {
    console.log('[SETTINGS] Failed to sync with Wings:', e.message);
  }
  res.json({ success: true, server: data.servers[serverIndex] });
});

router.post('/:id/reinstall', async (req, res) => {
  const { username } = req.body;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  
  const data = loadServers();
  const serverIndex = data.servers.findIndex(s => s.id === req.params.id);
  data.servers[serverIndex].status = 'installing';
  saveServers(data);
  
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/reinstall`);
    res.json({ success: true });
  } catch (e) {
    console.log('[REINSTALL] Failed to reinstall:', e.message);
    data.servers[serverIndex].status = 'offline';
    saveServers(data);
    res.status(500).json({ error: 'Failed to reinstall server: ' + e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { username } = req.body;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    await wingsRequest(node, 'DELETE', `/api/servers/${server.uuid}`);
  } catch (e) {
    console.log('[DELETE] Failed to delete from Wings:', e.message);
  }
  const data = loadServers();
  data.servers = data.servers.filter(s => s.id !== req.params.id);
  saveServers(data);
  res.json({ success: true });
});

// Startup
router.get('/:id/startup', async (req, res) => {
  const { username } = req.query;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server } = result;
  const eggs = loadEggs();
  const egg = eggs.eggs.find(e => e.id === server.egg_id) || {};
  res.json({
    startup: server.startup,
    docker_image: server.docker_image,
    environment: server.environment || {},
    egg: {
      id: egg.id,
      name: egg.name,
      startup: egg.startup,
      docker_image: egg.docker_image,
      docker_images: egg.docker_images || {},
      variables: egg.variables || []
    }
  });
});

router.put('/:id/startup', async (req, res) => {
  const { username, startup, docker_image, environment } = req.body;
  const result = await getServerAndNode(req.params.id, username);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  
  const data = loadServers();
  const serverIndex = data.servers.findIndex(s => s.id === req.params.id);
  const eggs = loadEggs();
  const egg = eggs.eggs.find(e => e.id === server.egg_id) || {};
  const variables = egg.variables || [];
  
  if (environment && typeof environment === 'object') {
    const validationErrors = {};
    for (const variable of variables) {
      const value = environment[variable.env_variable];
      const error = validateVariableValue(value, variable.rules);
      if (error) validationErrors[variable.env_variable] = error;
    }
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', validation_errors: validationErrors });
    }
  }
  
  if (docker_image && egg.docker_images) {
    const allowedImages = Object.values(egg.docker_images);
    if (allowedImages.length > 0 && !allowedImages.includes(docker_image)) {
      return res.status(400).json({ error: 'Invalid Docker image' });
    }
  }
  
  if (startup !== undefined) data.servers[serverIndex].startup = startup;
  if (docker_image !== undefined) data.servers[serverIndex].docker_image = docker_image;
  if (environment && typeof environment === 'object') {
    data.servers[serverIndex].environment = {
      ...data.servers[serverIndex].environment,
      ...environment
    };
  }
  saveServers(data);
  
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/sync`, {
      uuid: server.uuid,
      suspended: server.suspended || false,
      environment: data.servers[serverIndex].environment,
      invocation: data.servers[serverIndex].startup || egg.startup || '',
      skip_egg_scripts: false,
      build: {
        memory_limit: server.limits?.memory || 1024,
        swap: server.limits?.swap || 0,
        io_weight: server.limits?.io || 500,
        cpu_limit: server.limits?.cpu || 100,
        disk_space: server.limits?.disk || 5120
      },
      container: {
        image: data.servers[serverIndex].docker_image || egg.docker_image || ''
      }
    });
  } catch (e) {
    console.log('[STARTUP] Failed to sync with Wings:', e.message);
  }
  res.json({ success: true, server: data.servers[serverIndex] });
});

// Files
router.get('/:id/files/list', async (req, res) => {
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

router.post('/:id/files/folder', async (req, res) => {
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

router.post('/:id/files/write', async (req, res) => {
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

router.post('/:id/files/delete', async (req, res) => {
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

router.post('/:id/files/rename', async (req, res) => {
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

router.get('/:id/files/contents', async (req, res) => {
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

router.get('/:id/files/download', async (req, res) => {
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

export default router;
