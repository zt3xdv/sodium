import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function() {
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('allocations')}
      <main class="admin-content">
        <div class="admin-header">
          <div>
            <h1>Allocations</h1>
            <p class="text-secondary">Manage ports and IPs</p>
          </div>
          <button class="btn btn-primary" id="btn-new-allocation">
            ${icon('plus', 18)} New Allocation
          </button>
        </div>

        <div class="filter-bar">
          <div class="form-group">
            <label for="filter-node">Filter by Node</label>
            <select id="filter-node" class="input">
              <option value="">All Nodes</option>
            </select>
          </div>
        </div>

        <div class="table-container">
          <table class="table" id="allocations-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>Port</th>
                <th>Node</th>
                <th>Server</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="allocations-list">
              <tr><td colspan="6" class="loading">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  `;
}

export async function mount() {
  const allocationsList = document.getElementById('allocations-list');
  const filterNode = document.getElementById('filter-node');
  let nodes = [];
  let allocations = [];
  let selectedNodeId = '';

  async function loadNodes() {
    try {
      const res = await api.get('/nodes');
      nodes = res.data || [];
      renderNodeFilter();
    } catch (err) {
      toast.error('Failed to load nodes');
    }
  }

  function renderNodeFilter() {
    filterNode.innerHTML = `
      <option value="">All Nodes</option>
      ${nodes.map(node => `<option value="${node.id}">${node.name}</option>`).join('')}
    `;
  }

  async function loadAllocations() {
    try {
      allocations = [];
      
      if (selectedNodeId) {
        const res = await api.get(`/nodes/${selectedNodeId}/allocations`);
        const nodeAllocations = res.data || [];
        const node = nodes.find(n => n.id == selectedNodeId);
        allocations = nodeAllocations.map(a => ({ ...a, node_name: node?.name || 'Unknown' }));
      } else {
        for (const node of nodes) {
          try {
            const res = await api.get(`/nodes/${node.id}/allocations`);
            const nodeAllocations = res.data || [];
            allocations.push(...nodeAllocations.map(a => ({ ...a, node_id: node.id, node_name: node.name })));
          } catch (err) {
            // Skip failed nodes
          }
        }
      }
      
      renderAllocations();
    } catch (err) {
      toast.error('Failed to load allocations');
      allocationsList.innerHTML = '<tr><td colspan="6" class="empty">Failed to load allocations</td></tr>';
    }
  }

  function renderAllocations() {
    if (allocations.length === 0) {
      allocationsList.innerHTML = '<tr><td colspan="6" class="empty">No allocations found</td></tr>';
      return;
    }

    allocationsList.innerHTML = allocations.map(alloc => `
      <tr data-id="${alloc.id}" data-node-id="${alloc.node_id}">
        <td class="font-mono">${alloc.ip}</td>
        <td class="font-mono">${alloc.port}</td>
        <td>${alloc.node_name}</td>
        <td>
          ${alloc.server_id 
            ? `<a href="#/admin/servers/${alloc.server_id}" class="link">${alloc.server_name || `Server #${alloc.server_id}`}</a>` 
            : '<span class="text-secondary">Unassigned</span>'}
        </td>
        <td class="text-secondary">${alloc.notes || '-'}</td>
        <td class="actions-cell">
          <button class="btn btn-ghost btn-sm edit-btn" title="Edit">
            ${icon('edit', 14)}
          </button>
          <button class="btn btn-ghost btn-sm delete-btn" title="Delete" ${alloc.server_id ? 'disabled' : ''}>
            ${icon('trash', 14)}
          </button>
        </td>
      </tr>
    `).join('');

    attachListeners();
  }

  function attachListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        const alloc = allocations.find(a => a.id == row.dataset.id);
        showEditModal(alloc);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('tr');
        const alloc = allocations.find(a => a.id == row.dataset.id);
        await deleteAllocation(alloc);
      });
    });
  }

  function showCreateModal() {
    if (nodes.length === 0) {
      toast.error('No nodes available. Create a node first.');
      return;
    }

    openModal({
      title: 'New Allocation',
      content: `
        <form id="allocation-form">
          <div class="form-group">
            <label for="node_id">Node</label>
            <select id="node_id" class="input" required>
              ${nodes.map(node => `<option value="${node.id}">${node.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="ip">IP Address</label>
            <input type="text" id="ip" class="input" placeholder="0.0.0.0" required>
          </div>
          <div class="form-group">
            <label for="port_type">Port Type</label>
            <select id="port_type" class="input">
              <option value="single">Single Port</option>
              <option value="range">Port Range</option>
            </select>
          </div>
          <div class="form-group" id="single-port-group">
            <label for="port">Port</label>
            <input type="number" id="port" class="input" min="1" max="65535" placeholder="25565">
          </div>
          <div class="form-row" id="port-range-group" style="display: none;">
            <div class="form-group">
              <label for="port_start">Start Port</label>
              <input type="number" id="port_start" class="input" min="1" max="65535" placeholder="25565">
            </div>
            <div class="form-group">
              <label for="port_end">End Port</label>
              <input type="number" id="port_end" class="input" min="1" max="65535" placeholder="25575">
            </div>
          </div>
          <div class="form-group">
            <label for="notes">Notes (optional)</label>
            <input type="text" id="notes" class="input" placeholder="Description">
          </div>
        </form>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Create', class: 'btn-primary', action: async () => {
          const nodeId = document.getElementById('node_id').value;
          const ip = document.getElementById('ip').value;
          const portType = document.getElementById('port_type').value;
          const notes = document.getElementById('notes').value;

          let data = { ip, notes };

          if (portType === 'single') {
            data.port = parseInt(document.getElementById('port').value);
            if (!data.port) {
              toast.error('Please enter a valid port');
              return;
            }
          } else {
            const start = parseInt(document.getElementById('port_start').value);
            const end = parseInt(document.getElementById('port_end').value);
            if (!start || !end || start > end) {
              toast.error('Please enter a valid port range');
              return;
            }
            if (end - start > 100) {
              toast.error('Port range cannot exceed 100 ports');
              return;
            }
            data.ports = [];
            for (let p = start; p <= end; p++) {
              data.ports.push(p);
            }
          }

          try {
            await api.post(`/nodes/${nodeId}/allocations`, data);
            toast.success('Allocation(s) created');
            closeModal();
            loadAllocations();
          } catch (err) {
            toast.error(err.message || 'Failed to create allocation');
          }
        }}
      ]
    });

    document.getElementById('port_type').addEventListener('change', (e) => {
      const isSingle = e.target.value === 'single';
      document.getElementById('single-port-group').style.display = isSingle ? 'block' : 'none';
      document.getElementById('port-range-group').style.display = isSingle ? 'none' : 'flex';
    });
  }

  function showEditModal(alloc) {
    openModal({
      title: 'Edit Allocation',
      content: `
        <form id="allocation-form">
          <div class="form-group">
            <label>IP Address</label>
            <input type="text" class="input" value="${alloc.ip}" disabled>
          </div>
          <div class="form-group">
            <label>Port</label>
            <input type="number" class="input" value="${alloc.port}" disabled>
          </div>
          <div class="form-group">
            <label for="notes">Notes</label>
            <input type="text" id="notes" class="input" value="${alloc.notes || ''}" placeholder="Description">
          </div>
        </form>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Save', class: 'btn-primary', action: async () => {
          const notes = document.getElementById('notes').value;

          try {
            await api.put(`/nodes/${alloc.node_id}/allocations/${alloc.id}`, { notes });
            toast.success('Allocation updated');
            closeModal();
            loadAllocations();
          } catch (err) {
            toast.error(err.message || 'Failed to update allocation');
          }
        }}
      ]
    });
  }

  async function deleteAllocation(alloc) {
    if (alloc.server_id) {
      toast.error('Cannot delete allocation assigned to a server');
      return;
    }

    const confirmed = await confirmModal('Delete Allocation', `Are you sure you want to delete ${alloc.ip}:${alloc.port}?`);
    if (!confirmed) return;

    try {
      await api.delete(`/admin/allocations/${alloc.id}`);
      toast.success('Allocation deleted');
      loadAllocations();
    } catch (err) {
      toast.error('Failed to delete allocation');
    }
  }

  filterNode.addEventListener('change', (e) => {
    selectedNodeId = e.target.value;
    loadAllocations();
  });

  document.getElementById('btn-new-allocation').addEventListener('click', showCreateModal);

  await loadNodes();
  await loadAllocations();
}
