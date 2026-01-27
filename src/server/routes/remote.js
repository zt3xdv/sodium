import express from 'express';
import bcrypt from 'bcryptjs';
import { loadNodes, loadServers, saveServers, loadEggs, loadUsers } from '../db.js';

const router = express.Router();

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

router.get('/servers', (req, res) => {
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

router.post('/servers/reset', (req, res) => {
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

router.get('/servers/:uuid', (req, res) => {
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

router.get('/servers/:uuid/install', (req, res) => {
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

router.post('/servers/:uuid/install', (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  
  const data = loadServers();
  const serverIndex = data.servers.findIndex(s => s.uuid === req.params.uuid && s.node_id === node.id);
  if (serverIndex === -1) return res.status(404).json({ error: 'Server not found' });
  
  const successful = req.body.successful === true || req.body.successful === 'true';
  data.servers[serverIndex].status = successful ? 'offline' : 'install_failed';
  saveServers(data);
  res.json({ success: true });
});

router.post('/activity', (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  res.json({ success: true });
});

router.post('/sftp/auth', async (req, res) => {
  const node = authenticateNode(req);
  if (!node) return res.status(401).json({ error: 'Invalid token' });
  
  const { username, password } = req.body;
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

export default router;
