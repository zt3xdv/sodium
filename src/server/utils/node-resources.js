import { loadNodes, loadServers } from '../db.js';

export function getNodeAvailableResources(nodeId) {
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === nodeId);
  if (!node) return null;
  
  const servers = loadServers();
  const nodeServers = servers.servers.filter(s => s.node_id === nodeId);
  
  const usedMemory = nodeServers.reduce((sum, s) => sum + (s.limits?.memory || 0), 0);
  const usedDisk = nodeServers.reduce((sum, s) => sum + (s.limits?.disk || 0), 0);
  const usedPorts = nodeServers.map(s => s.allocation?.port).filter(p => p);
  
  const allocationStart = node.allocation_start || 25565;
  const allocationEnd = node.allocation_end || 25665;
  
  const availablePorts = [];
  for (let port = allocationStart; port <= allocationEnd; port++) {
    if (!usedPorts.includes(port)) {
      availablePorts.push(port);
    }
  }
  
  return {
    available_memory: node.memory - usedMemory,
    available_disk: node.disk - usedDisk,
    available_ports: availablePorts,
    allocation_start: allocationStart,
    allocation_end: allocationEnd
  };
}
