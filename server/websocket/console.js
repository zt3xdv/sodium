import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import Server from '../models/Server.js';
import docker from '../services/docker.js';

const clients = new Map();

export function setupConsoleWebSocket(wss) {
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const pathParts = url.pathname.split('/');
    const serverUuid = pathParts[pathParts.length - 1];

    if (!token || !serverUuid) {
      ws.close(4001, 'Missing token or server ID');
      return;
    }

    let user;
    try {
      user = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      ws.close(4002, 'Invalid token');
      return;
    }

    const server = await Server.findByUuid(serverUuid);
    if (!server) {
      ws.close(4004, 'Server not found');
      return;
    }

    if (server.owner_id !== user.id && user.role !== 'admin') {
      ws.close(4003, 'Access denied');
      return;
    }

    if (!clients.has(serverUuid)) {
      clients.set(serverUuid, new Set());
    }
    clients.get(serverUuid).add(ws);

    ws.serverUuid = serverUuid;
    ws.user = user;

    ws.send(JSON.stringify({
      type: 'connected',
      server: {
        uuid: server.uuid,
        name: server.name,
        status: server.status
      }
    }));

    docker.attachToContainer(serverUuid);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);

        switch (message.type) {
          case 'command':
            if (message.command) {
              await docker.sendCommand(serverUuid, message.command);
            }
            break;

          case 'power':
            await handlePowerAction(serverUuid, message.action, ws);
            break;

          case 'stats':
            const stats = await docker.getContainerStats(serverUuid);
            ws.send(JSON.stringify({ type: 'stats', ...stats }));
            break;
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    ws.on('close', () => {
      const serverClients = clients.get(serverUuid);
      if (serverClients) {
        serverClients.delete(ws);
        if (serverClients.size === 0) {
          clients.delete(serverUuid);
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  docker.on('output', (serverUuid, output) => {
    broadcast(serverUuid, {
      type: 'output',
      content: output
    });
  });

  docker.on('install_output', (serverUuid, output) => {
    broadcast(serverUuid, {
      type: 'install',
      content: output
    });
  });

  setInterval(async () => {
    for (const [serverUuid, wsClients] of clients) {
      if (wsClients.size === 0) continue;

      try {
        const stats = await docker.getContainerStats(serverUuid);
        const status = await docker.getContainerStatus(serverUuid);
        
        broadcast(serverUuid, {
          type: 'stats',
          ...stats,
          status: mapDockerStatus(status)
        });
      } catch (err) {
        // Ignore stats errors
      }
    }
  }, 2000);
}

async function handlePowerAction(serverUuid, action, ws) {
  const validActions = ['start', 'stop', 'restart', 'kill'];
  if (!validActions.includes(action)) {
    throw new Error('Invalid power action');
  }

  broadcast(serverUuid, {
    type: 'status',
    status: action === 'start' ? 'starting' : 'stopping'
  });

  try {
    switch (action) {
      case 'start':
        await docker.startContainer(serverUuid);
        await Server.updateStatus(serverUuid, 'online');
        break;
      case 'stop':
        await docker.stopContainer(serverUuid);
        await Server.updateStatus(serverUuid, 'offline');
        break;
      case 'restart':
        await docker.restartContainer(serverUuid);
        break;
      case 'kill':
        await docker.killContainer(serverUuid);
        await Server.updateStatus(serverUuid, 'offline');
        break;
    }

    const status = await docker.getContainerStatus(serverUuid);
    broadcast(serverUuid, {
      type: 'status',
      status: mapDockerStatus(status)
    });
  } catch (err) {
    broadcast(serverUuid, {
      type: 'error',
      message: `Power action failed: ${err.message}`
    });
    throw err;
  }
}

function broadcast(serverUuid, message) {
  const serverClients = clients.get(serverUuid);
  if (!serverClients) return;

  const data = JSON.stringify(message);
  for (const ws of serverClients) {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  }
}

function mapDockerStatus(dockerStatus) {
  const statusMap = {
    running: 'online',
    exited: 'offline',
    created: 'offline',
    paused: 'offline',
    restarting: 'starting',
    removing: 'stopping',
    dead: 'offline',
    not_found: 'offline'
  };
  return statusMap[dockerStatus] || 'offline';
}

export function getConnectedClients(serverUuid) {
  return clients.get(serverUuid)?.size || 0;
}
