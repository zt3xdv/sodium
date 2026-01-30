import express from 'express';
import { loadNodes, loadLocations, loadServers, loadUsers } from '../db.js';
import { wingsRequest } from '../utils/helpers.js';
import { getNodeAvailableResources } from '../utils/node-resources.js';

const router = express.Router();

router.get('/status/nodes', async (req, res) => {
  const data = loadNodes();
  const locations = loadLocations();
  const publicNodes = await Promise.all(data.nodes.map(async node => {
    let status = 'offline';
    let stats = { memory: 0, disk: 0 };
    try {
      const info = await wingsRequest(node, 'GET', '/api/system');
      status = 'online';
      stats = info;
    } catch {
      // Node offline, use default values
    }
    
    const servers = loadServers();
    const nodeServers = servers.servers.filter(s => s.node_id === node.id);
    const serverCount = nodeServers.length;
    
    // Calculate allocated resources
    const allocatedMemory = nodeServers.reduce((sum, s) => sum + (s.limits?.memory || 0), 0);
    const allocatedDisk = nodeServers.reduce((sum, s) => sum + (s.limits?.disk || 0), 0);
    
    const location = locations.locations.find(l => l.id === node.location_id);
    
    return {
      id: node.id,
      name: node.name,
      location: location?.short || 'Unknown',
      status,
      memory: { 
        total: node.memory, 
        used: stats.memory_bytes || 0,
        allocated: allocatedMemory
      },
      disk: { 
        total: node.disk, 
        used: stats.disk_bytes || 0,
        allocated: allocatedDisk
      },
      servers: serverCount
    };
  }));
  res.json({ nodes: publicNodes });
});

router.get('/nodes/available', (req, res) => {
  const nodes = loadNodes();
  const availableNodes = nodes.nodes
    .filter(n => !n.maintenance_mode)
    .map(n => {
      const resources = getNodeAvailableResources(n.id);
      return {
        id: n.id,
        name: n.name,
        fqdn: n.fqdn,
        location_id: n.location_id,
        available_memory: resources?.available_memory || 0,
        available_disk: resources?.available_disk || 0,
        available_ports: resources?.available_ports?.length || 0
      };
    })
    .filter(n => n.available_ports > 0);
  
  res.json({ nodes: availableNodes });
});

router.get('/nodes/:id/ports', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username required' });
  
  const users = loadUsers();
  const user = users.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const resources = getNodeAvailableResources(req.params.id);
  if (!resources) return res.status(404).json({ error: 'Node not found' });
  
  res.json({ 
    ports: resources.available_ports,
    allocation_start: resources.allocation_start,
    allocation_end: resources.allocation_end
  });
});

export default router;
