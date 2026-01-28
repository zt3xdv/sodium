import express from 'express';
import { loadUsers, loadServers, saveServers, loadNodes, loadEggs, loadNests, loadConfig } from '../db.js';
import { wingsRequest, sanitizeText, generateUUID, validateVariableValue } from '../utils/helpers.js';
import { getNodeAvailableResources } from '../utils/node-resources.js';
import { hasPermission } from '../utils/permissions.js';
import { authenticateUser } from '../utils/auth.js';
import logger from '../utils/logger.js';

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

// Helper privado para este router - ahora recibe el user del middleware
async function getServerAndNode(serverId, user, requiredPermission = null) {
  const data = loadServers();
  const server = data.servers.find(s => s.id === serverId);
  if (!server) return { error: 'Server not found', status: 404 };
  
  if (server.suspended) {
    return { error: 'Server is suspended', status: 403 };
  }
  
  if (!user) return { error: 'User not found', status: 404 };
  
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === server.node_id);
  
  // Admin or owner has full access
  if (user.isAdmin || server.user_id === user.id) {
    if (!node) return { error: 'Node not available', status: 400 };
    return { server, node, user, isOwner: true };
  }
  
  // Check if subuser
  const subuser = (server.subusers || []).find(s => s.user_id === user.id);
  if (!subuser) return { error: 'Forbidden', status: 403 };
  
  // Verify specific permission if required
  if (requiredPermission && !hasPermission(subuser, requiredPermission)) {
    return { error: 'Permission denied', status: 403 };
  }
  
  if (!node) return { error: 'Node not available', status: 400 };
  return { server, node, user, isOwner: false, subuser };
}

// Lista de servidores del usuario
router.get('/', authenticateUser, (req, res) => {
  const user = req.user;
  const users = loadUsers();
  const fullUser = users.users.find(u => u.id === user.id);
  if (!fullUser) return res.status(404).json({ error: 'User not found' });
  
  const data = loadServers();
  const nodes = loadNodes();
  
  // Servers owned by user
  const ownedServers = data.servers
    .filter(s => s.user_id === fullUser.id)
    .map(server => {
      const node = nodes.nodes.find(n => n.id === server.node_id);
      const primary = (server.allocations || []).find(a => a.primary) || server.allocation;
      return {
        ...server,
        node_address: node && primary ? `${node.fqdn}:${primary.port}` : null,
        node_name: node?.name || null,
        is_owner: true
      };
    });
  
  // Servers where user is subuser
  const subuserServers = data.servers
    .filter(s => (s.subusers || []).some(sub => sub.user_id === fullUser.id))
    .map(server => {
      const node = nodes.nodes.find(n => n.id === server.node_id);
      const primary = (server.allocations || []).find(a => a.primary) || server.allocation;
      const subuser = server.subusers.find(s => s.user_id === fullUser.id);
      return {
        ...server,
        node_address: node && primary ? `${node.fqdn}:${primary.port}` : null,
        node_name: node?.name || null,
        is_owner: false,
        permissions: subuser?.permissions || []
      };
    });
  
  res.json({ servers: [...ownedServers, ...subuserServers] });
});

// Crear Servidor (Usuario)
router.post('/', authenticateUser, async (req, res) => {
  const { name, egg_id, memory, disk, cpu } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Server name required' });
  
  const users = loadUsers();
  const user = users.users.find(u => u.id === req.user.id);
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
  
  let allocations = [];
  let allocation = null;
  if (availablePorts.length > 0) {
    const randomPort = availablePorts[Math.floor(Math.random() * availablePorts.length)];
    allocations = [{
      id: generateUUID(),
      ip: '0.0.0.0',
      port: randomPort,
      primary: true
    }];
    allocation = { ip: '0.0.0.0', port: randomPort };
  }
  
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
      allocations: 5
    },
    environment: {},
    allocations,
    allocation,
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
    logger.debug(`Error parsing egg config: ${e.message}`);
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
      allocations: newServer.allocation ? {
        default: { 
          ip: newServer.allocation.ip, 
          port: newServer.allocation.port 
        },
        mappings: { 
          [newServer.allocation.ip]: [newServer.allocation.port] 
        }
      } : { default: { ip: '0.0.0.0', port: 25565 }, mappings: {} },
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
    logger.error(`Server create Wings error: ${e.message}`);
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

router.get('/:id', authenticateUser, async (req, res) => {
  const user = req.user;
  const data = loadServers();
  const server = data.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  if (server.user_id !== user.id && !user.isAdmin) {
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

router.post('/:id/power', authenticateUser, async (req, res) => {
  const { action } = req.body;
  if (!['start', 'stop', 'restart', 'kill'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/power`, { action });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/command', authenticateUser, async (req, res) => {
  const { command } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/commands`, { command });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/websocket', authenticateUser, async (req, res) => {
  const user = req.user;
  const result = await getServerAndNode(req.params.id, req.user);
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
router.put('/:id/details', authenticateUser, async (req, res) => {
  const { name, description } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
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
    logger.warn(`Settings sync failed: ${e.message}`);
  }
  res.json({ success: true, server: data.servers[serverIndex] });
});

router.post('/:id/reinstall', authenticateUser, async (req, res) => {
  const user = req.user;
  const result = await getServerAndNode(req.params.id, req.user);
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
    logger.error(`Reinstall failed: ${e.message}`);
    data.servers[serverIndex].status = 'offline';
    saveServers(data);
    res.status(500).json({ error: 'Failed to reinstall server: ' + e.message });
  }
});

router.delete('/:id', authenticateUser, async (req, res) => {
  const user = req.user;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    await wingsRequest(node, 'DELETE', `/api/servers/${server.uuid}`);
  } catch (e) {
    logger.warn(`Delete from Wings failed: ${e.message}`);
  }
  const data = loadServers();
  data.servers = data.servers.filter(s => s.id !== req.params.id);
  saveServers(data);
  res.json({ success: true });
});

// Startup
router.get('/:id/startup', authenticateUser, async (req, res) => {
  const user = req.user;
  const result = await getServerAndNode(req.params.id, req.user);
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

router.put('/:id/startup', authenticateUser, async (req, res) => {
  const { startup, docker_image, environment } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
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
    logger.warn(`Startup sync failed: ${e.message}`);
  }
  res.json({ success: true, server: data.servers[serverIndex] });
});

// Files
router.get('/:id/files/list', authenticateUser, async (req, res) => {
  const { path } = req.query;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    const files = await wingsRequest(node, 'GET', `/api/servers/${server.uuid}/files/list-directory?directory=${encodeURIComponent(path || '/')}`);
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/files/folder', authenticateUser, async (req, res) => {
  const { path } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/files/create-directory`, { name: path, path: '/' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/files/write', authenticateUser, async (req, res) => {
  const { path, content } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/files/write?file=${encodeURIComponent(path)}`, content, true);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/files/delete', authenticateUser, async (req, res) => {
  const { path, root, files } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    let filesToDelete;
    if (files && Array.isArray(files)) {
      filesToDelete = files;
    } else if (path) {
      filesToDelete = [path.replace(/^\//, '')];
    } else {
      return res.status(400).json({ error: 'No files specified' });
    }
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/files/delete`, { 
      root: root || '/', 
      files: filesToDelete 
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/files/rename', authenticateUser, async (req, res) => {
  const { from, to, root, files } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    let filesToRename;
    if (files && Array.isArray(files)) {
      filesToRename = files;
    } else if (from && to) {
      filesToRename = [{ from: from.replace(/^\//, ''), to: to.replace(/^\//, '') }];
    } else {
      return res.status(400).json({ error: 'No files specified' });
    }
    await wingsRequest(node, 'PUT', `/api/servers/${server.uuid}/files/rename`, { 
      root: root || '/', 
      files: filesToRename 
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/files/compress', authenticateUser, async (req, res) => {
  const { root, files } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    const response = await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/files/compress`, {
      root: root || '/',
      files: files || []
    });
    res.json({ success: true, file: response });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/files/contents', authenticateUser, async (req, res) => {
  const { path } = req.query;
  const result = await getServerAndNode(req.params.id, req.user);
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

router.get('/:id/files/download', authenticateUser, async (req, res) => {
  const { path } = req.query;
  const result = await getServerAndNode(req.params.id, req.user);
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

router.post('/:id/files/upload', authenticateUser, async (req, res) => {
  const { path } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node, user } = result;
  
  try {
    const jwt = await import('jsonwebtoken');
    const uniqueId = generateUUID();
    
    const token = jwt.default.sign({
      server_uuid: server.uuid,
      user_uuid: user.id,
      unique_id: uniqueId,
      exp: Math.floor(Date.now() / 1000) + 300
    }, node.daemon_token);
    
    const uploadUrl = `${node.scheme}://${node.fqdn}:${node.daemon_port}/upload/file?token=${encodeURIComponent(token)}`;
    res.json({ url: uploadUrl, path });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/files/decompress', authenticateUser, async (req, res) => {
  const { root, file, extractTo } = req.body;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  try {
    await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/files/decompress`, {
      root: extractTo || root || '/',
      file: (root === '/' ? '' : root.replace(/^\//, '') + '/') + file
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Allocations
async function syncAllocationsWithWings(node, server) {
  const allocations = server.allocations || [];
  const primary = allocations.find(a => a.primary) || allocations[0];
  
  const mappings = {};
  allocations.forEach(a => {
    if (!mappings[a.ip]) mappings[a.ip] = [];
    mappings[a.ip].push(a.port);
  });
  
  const eggs = loadEggs();
  const egg = eggs.eggs.find(e => e.id === server.egg_id) || {};
  
  await wingsRequest(node, 'POST', `/api/servers/${server.uuid}/sync`, {
    uuid: server.uuid,
    suspended: server.suspended || false,
    environment: server.environment || {},
    invocation: server.startup || egg.startup || '',
    build: {
      memory_limit: server.limits?.memory || 1024,
      swap: server.limits?.swap || 0,
      io_weight: server.limits?.io || 500,
      cpu_limit: server.limits?.cpu || 100,
      disk_space: server.limits?.disk || 5120
    },
    allocations: {
      default: { ip: primary?.ip || '0.0.0.0', port: primary?.port || 25565 },
      mappings
    },
    container: {
      image: server.docker_image || egg.docker_image || ''
    }
  });
}

router.get('/:id/allocations', authenticateUser, async (req, res) => {
  const user = req.user;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server } = result;
  res.json({ allocations: server.allocations || [] });
});

router.post('/:id/allocations', authenticateUser, async (req, res) => {
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node, user } = result;
  
  const servers = loadServers();
  const userServers = servers.servers.filter(s => s.user_id === user.id);
  const totalAllocations = userServers.reduce((sum, s) => sum + (s.allocations?.length || 1), 0);
  const allocationLimit = user.limits?.allocations || 5;
  
  if (totalAllocations >= allocationLimit) {
    return res.status(400).json({ error: 'Allocation limit reached' });
  }
  
  const serverAllocationLimit = server.feature_limits?.allocations || 5;
  if ((server.allocations?.length || 1) >= serverAllocationLimit) {
    return res.status(400).json({ error: 'Server allocation limit reached' });
  }
  
  const resources = getNodeAvailableResources(node.id);
  if (!resources || resources.available_ports.length === 0) {
    return res.status(400).json({ error: 'No available ports' });
  }
  
  const randomPort = resources.available_ports[Math.floor(Math.random() * resources.available_ports.length)];
  
  const newAllocation = {
    id: generateUUID(),
    ip: '0.0.0.0',
    port: randomPort,
    primary: false
  };
  
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  
  if (!data.servers[serverIdx].allocations) {
    const oldAlloc = data.servers[serverIdx].allocation;
    data.servers[serverIdx].allocations = [{
      id: generateUUID(),
      ip: oldAlloc?.ip || '0.0.0.0',
      port: oldAlloc?.port || 25565,
      primary: true
    }];
  }
  
  data.servers[serverIdx].allocations.push(newAllocation);
  saveServers(data);
  
  try {
    await syncAllocationsWithWings(node, data.servers[serverIdx]);
  } catch (e) {
    logger.warn(`Allocations sync failed: ${e.message}`);
  }
  
  res.json({ success: true, allocation: newAllocation });
});

router.put('/:id/allocations/:allocId/primary', authenticateUser, async (req, res) => {
  const user = req.user;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  const allocations = data.servers[serverIdx].allocations || [];
  
  const allocIdx = allocations.findIndex(a => a.id === req.params.allocId);
  if (allocIdx === -1) return res.status(404).json({ error: 'Allocation not found' });
  
  allocations.forEach(a => a.primary = false);
  allocations[allocIdx].primary = true;
  
  data.servers[serverIdx].allocation = {
    ip: allocations[allocIdx].ip,
    port: allocations[allocIdx].port
  };
  
  saveServers(data);
  
  try {
    await syncAllocationsWithWings(node, data.servers[serverIdx]);
  } catch (e) {
    logger.warn(`Allocations sync failed: ${e.message}`);
  }
  
  res.json({ success: true });
});

router.delete('/:id/allocations/:allocId', authenticateUser, async (req, res) => {
  const user = req.user;
  const result = await getServerAndNode(req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;
  
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  const allocations = data.servers[serverIdx].allocations || [];
  
  const allocIdx = allocations.findIndex(a => a.id === req.params.allocId);
  if (allocIdx === -1) return res.status(404).json({ error: 'Allocation not found' });
  
  if (allocations[allocIdx].primary) {
    return res.status(400).json({ error: 'Cannot delete primary allocation' });
  }
  
  allocations.splice(allocIdx, 1);
  data.servers[serverIdx].allocations = allocations;
  saveServers(data);
  
  try {
    await syncAllocationsWithWings(node, data.servers[serverIdx]);
  } catch (e) {
    logger.warn(`Allocations sync failed: ${e.message}`);
  }
  
  res.json({ success: true });
});

// ==================== SUBUSERS ====================

// GET /:id/subusers - List subusers
router.get('/:id/subusers', authenticateUser, async (req, res) => {
  const user = req.user;
  const result = await getServerAndNode(req.params.id, req.user, 'user.read');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server, isOwner } = result;
  if (!isOwner && !hasPermission(result.subuser, 'user.read')) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const users = loadUsers();
  const subusers = (server.subusers || []).map(s => {
    const u = users.users.find(user => user.id === s.user_id);
    return {
      id: s.id,
      user_id: s.user_id,
      username: u?.username || 'Unknown',
      email: u?.email || '',
      permissions: s.permissions,
      created_at: s.created_at
    };
  });
  
  res.json({ subusers });
});

// POST /:id/subusers - Create subuser
router.post('/:id/subusers', authenticateUser, async (req, res) => {
  const { target_username, permissions } = req.body;
  const result = await getServerAndNode(req.params.id, req.user, 'user.create');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const { server } = result;
  
  // Verify global config
  const config = loadConfig();
  if (!config.features?.subusers) {
    return res.status(400).json({ error: 'Subusers are disabled' });
  }
  
  // Verify owner can use subusers
  const users = loadUsers();
  const owner = users.users.find(u => u.id === server.user_id);
  if (owner && owner.allowSubusers === false) {
    return res.status(400).json({ error: 'Subusers not allowed for this account' });
  }
  
  // Find target user
  const targetUser = users.users.find(u => u.username.toLowerCase() === target_username?.toLowerCase());
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  
  if (targetUser.id === server.user_id) {
    return res.status(400).json({ error: 'Cannot add owner as subuser' });
  }
  
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  
  if (!data.servers[serverIdx].subusers) {
    data.servers[serverIdx].subusers = [];
  }
  
  // Check if already exists
  if (data.servers[serverIdx].subusers.some(s => s.user_id === targetUser.id)) {
    return res.status(400).json({ error: 'User is already a subuser' });
  }
  
  const newSubuser = {
    id: generateUUID(),
    user_id: targetUser.id,
    permissions: permissions || [],
    created_at: new Date().toISOString()
  };
  
  data.servers[serverIdx].subusers.push(newSubuser);
  saveServers(data);
  
  res.json({ 
    success: true, 
    subuser: {
      ...newSubuser,
      username: targetUser.username
    }
  });
});

// PUT /:id/subusers/:subId - Update permissions
router.put('/:id/subusers/:subId', authenticateUser, async (req, res) => {
  const { permissions } = req.body;
  const result = await getServerAndNode(req.params.id, req.user, 'user.update');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  const subusers = data.servers[serverIdx].subusers || [];
  
  const subIdx = subusers.findIndex(s => s.id === req.params.subId);
  if (subIdx === -1) return res.status(404).json({ error: 'Subuser not found' });
  
  data.servers[serverIdx].subusers[subIdx].permissions = permissions || [];
  saveServers(data);
  
  res.json({ success: true });
});

// DELETE /:id/subusers/:subId - Delete subuser
router.delete('/:id/subusers/:subId', authenticateUser, async (req, res) => {
  const user = req.user;
  const result = await getServerAndNode(req.params.id, req.user, 'user.delete');
  if (result.error) return res.status(result.status).json({ error: result.error });
  
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  
  data.servers[serverIdx].subusers = (data.servers[serverIdx].subusers || [])
    .filter(s => s.id !== req.params.subId);
  saveServers(data);
  
  res.json({ success: true });
});

// ==================== SUSPEND ====================

// POST /:id/suspend - Suspend server
router.post('/:id/suspend', authenticateUser, async (req, res) => {
  const user = req.user;
  
  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  if (serverIdx === -1) return res.status(404).json({ error: 'Server not found' });
  
  data.servers[serverIdx].suspended = true;
  saveServers(data);
  
  // Notify Wings
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === data.servers[serverIdx].node_id);
  if (node) {
    try {
      await wingsRequest(node, 'POST', `/api/servers/${data.servers[serverIdx].uuid}/suspend`);
    } catch (e) {
      logger.warn(`Suspend Wings error: ${e.message}`);
    }
  }
  
  res.json({ success: true });
});

// POST /:id/unsuspend - Unsuspend server
router.post('/:id/unsuspend', authenticateUser, async (req, res) => {
  const user = req.user;
  
  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const data = loadServers();
  const serverIdx = data.servers.findIndex(s => s.id === req.params.id);
  if (serverIdx === -1) return res.status(404).json({ error: 'Server not found' });
  
  data.servers[serverIdx].suspended = false;
  saveServers(data);
  
  // Notify Wings
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === data.servers[serverIdx].node_id);
  if (node) {
    try {
      await wingsRequest(node, 'POST', `/api/servers/${data.servers[serverIdx].uuid}/unsuspend`);
    } catch (e) {
      logger.warn(`Unsuspend Wings error: ${e.message}`);
    }
  }
  
  res.json({ success: true });
});

export default router;
