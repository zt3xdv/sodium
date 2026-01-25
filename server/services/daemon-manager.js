import Node from '../models/Node.js';
import Server from '../models/Server.js';
import Allocation from '../models/Allocation.js';
import { broadcastToServer } from '../websocket/console.js';

// Connected daemons: nodeUuid -> { ws, info, stats }
const connectedDaemons = new Map();

// Node stats cache: nodeUuid -> { cpu, memory, disk, uptime, lastUpdated }
const nodeStats = new Map();

export function validateDaemonToken(uuid, token) {
  const node = Node.findByUuid(uuid);
  if (!node) return null;
  if (node.daemon_token !== token) return null;
  return node;
}

export function registerDaemon(uuid, ws, info) {
  connectedDaemons.set(uuid, { ws, info });
  Node.updateStatus(uuid, 'online');
  console.log(`Daemon registered: ${uuid}`);
}

export function unregisterDaemon(uuid) {
  connectedDaemons.delete(uuid);
  nodeStats.delete(uuid);
  Node.updateStatus(uuid, 'offline');
  console.log(`Daemon unregistered: ${uuid}`);
}

export function updateDaemonStats(uuid, stats) {
  nodeStats.set(uuid, {
    ...stats,
    lastUpdated: Date.now()
  });
  
  const daemon = connectedDaemons.get(uuid);
  if (daemon) {
    daemon.info.lastStats = stats;
    daemon.info.lastSeen = Date.now();
  }
}

export function getDaemonStats(uuid) {
  return nodeStats.get(uuid) || null;
}

export function getAllDaemonStats() {
  const result = {};
  for (const [uuid, stats] of nodeStats) {
    result[uuid] = stats;
  }
  return result;
}

export function isDaemonConnected(uuid) {
  return connectedDaemons.has(uuid);
}

export function getConnectedDaemons() {
  return Array.from(connectedDaemons.keys());
}

export function getDaemonConnection(uuid) {
  return connectedDaemons.get(uuid);
}

// Send command to a specific daemon
export function sendToDaemon(uuid, message) {
  const daemon = connectedDaemons.get(uuid);
  if (!daemon || daemon.ws.readyState !== 1) {
    return false;
  }
  daemon.ws.send(JSON.stringify(message));
  return true;
}

// Send server power action to daemon
export function sendServerPowerAction(nodeUuid, serverUuid, action) {
  return sendToDaemon(nodeUuid, {
    type: 'server_action',
    action,
    uuid: serverUuid
  });
}

// Send command to server via daemon
export function sendServerCommand(nodeUuid, serverUuid, command) {
  return sendToDaemon(nodeUuid, {
    type: 'command',
    uuid: serverUuid,
    command
  });
}

// Handle server output from daemon - forward to console clients
export function handleServerOutput(serverUuid, output) {
  broadcastToServer(serverUuid, {
    type: 'output',
    content: output
  });
}

// Handle server status update from daemon
export function handleServerStatus(serverUuid, status, stats = null) {
  // Update server status in database
  Server.updateStatusByUuid(serverUuid, status);
  
  // Broadcast to console clients
  broadcastToServer(serverUuid, {
    type: 'status',
    status,
    stats
  });
}

// Get node UUID for a server
export function getNodeForServer(serverUuid) {
  const server = Server.findByUuid(serverUuid);
  if (!server) return null;
  
  // Find allocation for this server to get node
  const allocations = Allocation.findByServer(server.id);
  if (!allocations || allocations.length === 0) return null;
  
  const node = Node.findById(allocations[0].node_id);
  return node?.uuid || null;
}

// Send server install request to daemon
export function sendServerInstall(nodeUuid, serverUuid, serverData, eggData) {
  return sendToDaemon(nodeUuid, {
    type: 'server_install',
    uuid: serverUuid,
    server: serverData,
    egg: eggData
  });
}

// Send server create container request to daemon
export function sendServerCreate(nodeUuid, serverUuid, serverData, eggData) {
  return sendToDaemon(nodeUuid, {
    type: 'server_create',
    uuid: serverUuid,
    server: serverData,
    egg: eggData
  });
}

// Send server delete request to daemon
export function sendServerDelete(nodeUuid, serverUuid) {
  return sendToDaemon(nodeUuid, {
    type: 'server_delete',
    uuid: serverUuid
  });
}

export default {
  validateDaemonToken,
  registerDaemon,
  unregisterDaemon,
  updateDaemonStats,
  getDaemonStats,
  getAllDaemonStats,
  isDaemonConnected,
  getConnectedDaemons,
  getDaemonConnection,
  sendToDaemon,
  sendServerPowerAction,
  sendServerCommand,
  sendServerInstall,
  sendServerCreate,
  sendServerDelete,
  handleServerOutput,
  handleServerStatus,
  getNodeForServer
};
