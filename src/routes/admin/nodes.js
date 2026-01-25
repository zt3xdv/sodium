import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router.js';
import { formatBytes } from '../../utils/format.js';

export default function() {
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('nodes')}
      <main class="admin-content">
        <div class="admin-header">
          <div>
            <h1>Nodes</h1>
            <p class="text-secondary">Manage daemon nodes</p>
          </div>
          <button class="btn btn-primary" id="create-node-btn">
            ${icon('plus', 18)} Add Node
          </button>
        </div>

        <div class="table-container">
          <table class="table" id="nodes-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>FQDN</th>
                <th>Memory</th>
                <th>Disk</th>
                <th>Servers</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="nodes-tbody">
              <tr><td colspan="7" class="text-center text-secondary">Loading...</td></tr>
            </tbody>
          </table>
        </div>

        <div class="modal" id="node-modal">
          <div class="modal-backdrop"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h2 id="modal-title">Add Node</h2>
              <button class="btn btn-ghost modal-close">${icon('x', 20)}</button>
            </div>
            <form id="node-form">
              <div class="modal-body">
                <div class="form-group">
                  <label for="name">Name</label>
                  <input type="text" id="name" name="name" class="input" required placeholder="Node-1">
                </div>
                <div class="form-group">
                  <label for="description">Description</label>
                  <textarea id="description" name="description" class="input" rows="2"></textarea>
                </div>
                <div class="form-group">
                  <label for="fqdn">FQDN / IP Address</label>
                  <input type="text" id="fqdn" name="fqdn" class="input" required placeholder="node1.example.com">
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="scheme">Scheme</label>
                    <select id="scheme" name="scheme" class="input">
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="daemon_port">Daemon Port</label>
                    <input type="number" id="daemon_port" name="daemon_port" class="input" value="8080">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="memory">Memory (MB)</label>
                    <input type="number" id="memory" name="memory" class="input" required value="4096">
                  </div>
                  <div class="form-group">
                    <label for="disk">Disk (MB)</label>
                    <input type="number" id="disk" name="disk" class="input" required value="51200">
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-ghost modal-close">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Node</button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  `;
}

export async function mount() {
  const tbody = document.getElementById('nodes-tbody');
  const modal = document.getElementById('node-modal');
  const form = document.getElementById('node-form');
  const modalTitle = document.getElementById('modal-title');
  
  let nodes = [];
  let editingId = null;

  async function loadNodes() {
    try {
      const res = await api.get('/nodes');
      nodes = res.data || [];
      renderNodes();
    } catch (err) {
      toast.error('Failed to load nodes');
    }
  }

  function renderNodes() {
    if (nodes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">No nodes configured</td></tr>';
      return;
    }

    tbody.innerHTML = nodes.map(node => `
      <tr data-id="${node.id}">
        <td><div class="cell-title">${node.name}</div></td>
        <td>${node.scheme}://${node.fqdn}:${node.daemon_port}</td>
        <td>${formatBytes(node.memory * 1024 * 1024)}</td>
        <td>${formatBytes(node.disk * 1024 * 1024)}</td>
        <td>${node.server_count || 0}</td>
        <td><span class="badge ${node.maintenance_mode ? 'badge-warning' : 'badge-success'}">${node.maintenance_mode ? 'Maintenance' : 'Online'}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-sm" data-action="allocations" data-id="${node.id}">${icon('globe', 16)}</button>
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${node.id}">${icon('edit', 16)}</button>
            <button class="btn btn-ghost btn-sm btn-danger" data-action="delete" data-id="${node.id}">${icon('trash', 16)}</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function openModal(node = null) {
    editingId = node?.id || null;
    modalTitle.textContent = node ? 'Edit Node' : 'Add Node';
    form.reset();
    if (node) {
      form.name.value = node.name;
      form.description.value = node.description || '';
      form.fqdn.value = node.fqdn;
      form.scheme.value = node.scheme;
      form.daemon_port.value = node.daemon_port;
      form.memory.value = node.memory;
      form.disk.value = node.disk;
    }
    modal.classList.add('open');
  }

  function closeModal() {
    modal.classList.remove('open');
    editingId = null;
  }

  document.getElementById('create-node-btn').addEventListener('click', () => openModal());
  modal.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => el.addEventListener('click', closeModal));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      if (editingId) {
        await api.put(`/nodes/${editingId}`, data);
        toast.success('Node updated');
      } else {
        await api.post('/nodes', data);
        toast.success('Node created');
      }
      closeModal();
      await loadNodes();
    } catch (err) {
      toast.error(err.message || 'Failed to save node');
    }
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const node = nodes.find(n => n.id == id);

    if (action === 'edit') openModal(node);
    else if (action === 'allocations') navigate(`/admin/allocations?node=${id}`);
    else if (action === 'delete') {
      if (node.server_count > 0) {
        toast.error('Cannot delete node with active servers');
        return;
      }
      if (confirm(`Delete node "${node.name}"?`)) {
        try {
          await api.delete(`/nodes/${id}`);
          toast.success('Node deleted');
          await loadNodes();
        } catch (err) {
          toast.error(err.message);
        }
      }
    }
  });

  await loadNodes();
}
