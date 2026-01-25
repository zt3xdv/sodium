import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import Server from '../models/Server.js';
import Allocation from '../models/Allocation.js';
import Node from '../models/Node.js';
import daemonManager from '../services/daemon-manager.js';

const clients = new Map();

function getNodeForServer(serverUuid) {
  const server = Server.findByUuid(serverUuid);
  if (!server) return null;
  
  const allocations = Allocation.findByServer(server.id);
  if (!allocations || allocations.length === 0) return null;
  
  const node = Node.findById(allocations[0].node_id);
  return node?.uuid || null;
}

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

    const nodeUuid = getNodeForServer(serverUuid);
    const daemonConnected = nodeUuid && daemonManager.isDaemonConnected(nodeUuid);

    ws.send(JSON.stringify({
      type: 'connected',
      server: {
        uuid: server.uuid,
        name: server.name,
        status: server.status
      },
      daemonConnected
    }));

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);

        const nodeUuid = getNodeForServer(serverUuid);
        if (!nodeUuid) {
          ws.send(JSON.stringify({ type: 'error', message: 'Server has no node assigned' }));
          return;
        }

        if (!daemonManager.isDaemonConnected(nodeUuid)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Daemon not connected' }));
          return;
        }

        switch (message.type) {
          case 'command':
            if (message.command) {
              daemonManager.sendServerCommand(nodeUuid, serverUuid, message.command);
            }
            break;

          case 'power':
            await handlePowerAction(serverUuid, nodeUuid, message.action, ws);
            break;

          case 'stats':
            // Stats are received from daemon via handleServerStatus
            // Just acknowledge the request - stats will come via broadcast
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

  // Output and stats are received from daemon via daemon-manager
  // which calls broadcastToServer to forward to clients
}

async function handlePowerAction(serverUuid, nodeUuid, action, ws) {
  const validActions = ['start', 'stop', 'restart', 'kill'];
  if (!validActions.includes(action)) {
    throw new Error('Invalid power action');
  }

  broadcast(serverUuid, {
    type: 'status',
    status: action === 'start' ? 'starting' : 'stopping'
  });

  try {
    const sent = daemonManager.sendServerPowerAction(nodeUuid, serverUuid, action);
    if (!sent) {
      throw new Error('Failed to send power action to daemon');
    }

    // Status update will come from daemon via handleServerStatus
    // Update local status optimistically
    let newStatus;
    switch (action) {
      case 'start':
        newStatus = 'starting';
        break;
      case 'stop':
      case 'kill':
        newStatus = 'stopping';
        break;
      case 'restart':
        newStatus = 'restarting';
        break;
    }
    Server.updateStatusByUuid(serverUuid, newStatus);
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

export function getConnectedClients(serverUuid) {
  return clients.get(serverUuid)?.size || 0;
}

// Export broadcast for daemon manager to forward server output
export function broadcastToServer(serverUuid, message) {
  broadcast(serverUuid, message);
}
