import { loadNodes, loadServers } from '../db.js';

export function getNodeAvailableResources(nodeId) {
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === nodeId);
  if (!node) return null;
  
  const servers = loadServers();
  const nodeServers = servers.servers.filter(s => s.node_id === nodeId);
  
  const usedMemory = nodeServers.reduce((sum, s) => sum + (s.limits?.memory || 0), 0);
  const usedDisk = nodeServers.reduce((sum, s) => sum + (s.limits?.disk || 0), 0);
  const usedPorts = nodeServers.flatMap(s => {
    if (s.allocations && s.allocations.length > 0) {
      return s.allocations.map(a => a.port);
    }
    return s.allocation?.port ? [s.allocation.port] : [];
  });
  
  const allocationStart = node.allocation_start || 25565;
  const allocationEnd = node.allocation_end || 25665;
  
  const availablePorts = [];
  for (let port = allocationStart; port <= allocationEnd; port++) {
    if (!usedPorts.includes(port)) {
      availablePorts.push(port);
    }
  }
  
  // Apply overallocation percentages
  const memoryOverallocation = node.memory_overallocation || 0;
  const diskOverallocation = node.disk_overallocation || 0;
  
  const effectiveMemory = Math.floor(node.memory * (1 + memoryOverallocation / 100));
  const effectiveDisk = Math.floor(node.disk * (1 + diskOverallocation / 100));
  
  return {
    total_memory: node.memory,
    total_disk: node.disk,
    effective_memory: effectiveMemory,
    effective_disk: effectiveDisk,
    used_memory: usedMemory,
    used_disk: usedDisk,
    available_memory: effectiveMemory - usedMemory,
    available_disk: effectiveDisk - usedDisk,
    available_ports: availablePorts,
    allocation_start: allocationStart,
    allocation_end: allocationEnd,
    memory_overallocation: memoryOverallocation,
    disk_overallocation: diskOverallocation
  };
}
