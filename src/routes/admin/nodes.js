import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { formatBytes } from '../../utils/format.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function() {
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('nodes')}
      <main class="admin-content">
        <div class="admin-header">
          <div>
            <h1>Nodes</h1>
            <p class="text-secondary">Manage server nodes</p>
          </div>
          <button class="btn btn-primary" id="btn-new-node">
            ${icon('plus', 18)} New Node
          </button>
        </div>

        <div class="nodes-grid" id="nodes-grid">
          <div class="loading">Loading nodes...</div>
        </div>
      </main>
    </div>
  `;
}

export async function mount() {
  const nodesGrid = document.getElementById('nodes-grid');
  let nodes = [];

  async function loadNodes() {
    try {
      const res = await api.get('/nodes');
      nodes = res.data || [];
      renderNodes();
    } catch (err) {
      toast.error('Failed to load nodes');
      nodesGrid.innerHTML = '<div class="empty-state">Failed to load nodes</div>';
    }
  }

  function renderNodes() {
    if (nodes.length === 0) {
      nodesGrid.innerHTML = `
        <div class="empty-state">
          ${icon('hard-drive', 48)}
          <h3>No nodes configured</h3>
          <p class="text-secondary">Create a node to start deploying servers</p>
          <button class="btn btn-primary" id="empty-new-node">${icon('plus', 18)} New Node</button>
        </div>
      `;
      document.getElementById('empty-new-node')?.addEventListener('click', showNodeModal);
      return;
    }

    nodesGrid.innerHTML = nodes.map(node => {
      const memPercent = node.total_memory ? (node.used_memory / node.total_memory * 100) : 0;
      const diskPercent = node.total_disk ? (node.used_disk / node.total_disk * 100) : 0;

      return `
        <div class="node-card card" data-id="${node.id}">
          <div class="node-header">
            <span class="status-indicator status-${node.online ? 'online' : 'offline'}"></span>
            <h3>${node.name}</h3>
            <div class="node-actions">
              <button class="btn btn-ghost btn-sm edit-btn" title="Edit">${icon('edit', 14)}</button>
              <button class="btn btn-ghost btn-sm delete-btn" title="Delete">${icon('trash', 14)}</button>
            </div>
          </div>
          <div class="node-info">
            <p class="font-mono text-secondary">${node.fqdn}:${node.daemon_port}</p>
            <p class="text-sm">${node.server_count || 0} servers</p>
          </div>
          <div class="node-resources">
            <div class="resource-bar">
              <div class="resource-header">
                <span>Memory</span>
                <span>${formatBytes(node.used_memory * 1024 * 1024)} / ${formatBytes(node.total_memory * 1024 * 1024)}</span>
              </div>
              <div class="progress">
                <div class="progress-bar ${memPercent > 90 ? 'danger' : memPercent > 70 ? 'warning' : ''}" 
                     style="width: ${memPercent}%"></div>
              </div>
            </div>
            <div class="resource-bar">
              <div class="resource-header">
                <span>Disk</span>
                <span>${formatBytes(node.used_disk * 1024 * 1024)} / ${formatBytes(node.total_disk * 1024 * 1024)}</span>
              </div>
              <div class="progress">
                <div class="progress-bar ${diskPercent > 90 ? 'danger' : diskPercent > 70 ? 'warning' : ''}" 
                     style="width: ${diskPercent}%"></div>
              </div>
            </div>
          </div>
          <div class="node-footer">
            <a href="#/admin/nodes/${node.id}/allocations" class="btn btn-ghost btn-sm">
              ${icon('list', 14)} Allocations
            </a>
          </div>
        </div>
      `;
    }).join('');

    attachListeners();
  }

  function attachListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.node-card').dataset.id;
        const node = nodes.find(n => n.id == id);
        showNodeModal(node);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.closest('.node-card').dataset.id;
        const node = nodes.find(n => n.id == id);
        await deleteNode(node);
      });
    });
  }

  function showNodeModal(node = null) {
    const isEdit = !!node;

    openModal({
      title: isEdit ? 'Edit Node' : 'New Node',
      content: `
        <form id="node-form">
          <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" class="input" value="${node?.name || ''}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="fqdn">FQDN / IP</label>
              <input type="text" id="fqdn" class="input" value="${node?.fqdn || ''}" 
                     placeholder="node.example.com" required>
            </div>
            <div class="form-group">
              <label for="scheme">Scheme</label>
              <select id="scheme" class="input">
                <option value="https" ${node?.scheme === 'https' ? 'selected' : ''}>HTTPS</option>
                <option value="http" ${node?.scheme === 'http' ? 'selected' : ''}>HTTP</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="daemon_port">Daemon Port</label>
            <input type="number" id="daemon_port" class="input" value="${node?.daemon_port || 8080}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="memory">Memory (MB)</label>
              <input type="number" id="memory" class="input" value="${node?.memory || 8192}" min="1024" required>
            </div>
            <div class="form-group">
              <label for="memory_overallocate">Overallocate (%)</label>
              <input type="number" id="memory_overallocate" class="input" value="${node?.memory_overallocate || 0}" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="disk">Disk (MB)</label>
              <input type="number" id="disk" class="input" value="${node?.disk || 102400}" min="1024" required>
            </div>
            <div class="form-group">
              <label for="disk_overallocate">Overallocate (%)</label>
              <input type="number" id="disk_overallocate" class="input" value="${node?.disk_overallocate || 0}" min="0">
            </div>
          </div>
        </form>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: isEdit ? 'Save' : 'Create', class: 'btn-primary', action: async () => {
          const data = {
            name: document.getElementById('name').value,
            fqdn: document.getElementById('fqdn').value,
            scheme: document.getElementById('scheme').value,
            daemon_port: parseInt(document.getElementById('daemon_port').value),
            memory: parseInt(document.getElementById('memory').value),
            memory_overallocate: parseInt(document.getElementById('memory_overallocate').value),
            disk: parseInt(document.getElementById('disk').value),
            disk_overallocate: parseInt(document.getElementById('disk_overallocate').value)
          };

          try {
            if (isEdit) {
              await api.put(`/nodes/${node.id}`, data);
              toast.success('Node updated');
            } else {
              await api.post('/nodes', data);
              toast.success('Node created');
            }
            closeModal();
            loadNodes();
          } catch (err) {
            toast.error(err.message || 'Failed to save node');
          }
        }}
      ]
    });
  }

  async function deleteNode(node) {
    if (node.server_count > 0) {
      toast.error('Cannot delete node with active servers');
      return;
    }

    const confirmed = await confirmModal('Delete Node', `Are you sure you want to delete "${node.name}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`/nodes/${node.id}`);
      toast.success('Node deleted');
      loadNodes();
    } catch (err) {
      toast.error('Failed to delete node');
    }
  }

  document.getElementById('btn-new-node').addEventListener('click', () => showNodeModal());

  await loadNodes();
}
