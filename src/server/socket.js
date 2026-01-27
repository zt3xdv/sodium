import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { loadUsers, loadServers, loadNodes } from './db.js';
import { generateUUID } from './utils/helpers.js';
import { hasPermission } from './utils/permissions.js';

export function setupWebSocket(server) {
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
    
    // Check if server is suspended
    if (serverData.suspended) {
      clientWs.close(4007, 'Server is suspended');
      return;
    }
    
    // Check access: admin, owner, or subuser with console permission
    let hasAccess = user.isAdmin || serverData.user_id === user.id;
    if (!hasAccess) {
      const subuser = (serverData.subusers || []).find(s => s.user_id === user.id);
      if (subuser && hasPermission(subuser, 'control.console')) {
        hasAccess = true;
      }
    }
    
    if (!hasAccess) {
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
}
