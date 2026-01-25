import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';

export default function() {
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('allocations')}
      <main class="admin-content">
        <div class="admin-header">
          <div>
            <h1>Allocations</h1>
            <p class="text-secondary">Manage IP and port allocations</p>
          </div>
          <button class="btn btn-primary" id="create-btn">${icon('plus', 18)} Add Allocations</button>
        </div>

        <div class="filters-bar">
          <select id="node-filter" class="input"><option value="">All Nodes</option></select>
          <select id="status-filter" class="input">
            <option value="">All Status</option>
            <option value="free">Available</option>
            <option value="assigned">Assigned</option>
          </select>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr><th>Node</th><th>IP</th><th>Port</th><th>Assigned To</th><th></th></tr>
            </thead>
            <tbody id="tbody"><tr><td colspan="5" class="text-center">Loading...</td></tr></tbody>
          </table>
        </div>

        <div class="modal" id="modal">
          <div class="modal-backdrop"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h2>Add Allocations</h2>
              <button class="btn btn-ghost modal-close">${icon('x', 20)}</button>
            </div>
            <form id="form">
              <div class="modal-body">
                <div class="form-group">
                  <label>Node</label>
                  <select id="node_id" name="node_id" class="input" required></select>
                </div>
                <div class="form-group">
                  <label>IP Address</label>
                  <input type="text" id="ip" name="ip" class="input" required placeholder="0.0.0.0">
                </div>
                <div class="form-group">
                  <label>Ports</label>
                  <input type="text" id="ports" name="ports" class="input" required placeholder="25565, 25566-25570">
                  <small class="text-secondary">Comma-separated or ranges</small>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-ghost modal-close">Cancel</button>
                <button type="submit" class="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  `;
}

export async function mount() {
  const tbody = document.getElementById('tbody');
  const modal = document.getElementById('modal');
  const form = document.getElementById('form');
  const nodeFilter = document.getElementById('node-filter');
  const statusFilter = document.getElementById('status-filter');
  const nodeSelect = document.getElementById('node_id');
  
  let allocations = [], nodes = [];

  async function load() {
    try {
      const [aRes, nRes] = await Promise.all([api.get('/allocations'), api.get('/nodes')]);
      allocations = aRes.data || [];
      nodes = nRes.data || [];
      const opts = nodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
      nodeFilter.innerHTML = '<option value="">All Nodes</option>' + opts;
      nodeSelect.innerHTML = '<option value="">Select...</option>' + opts;
      const params = new URLSearchParams(window.location.search);
      if (params.get('node')) nodeFilter.value = params.get('node');
      render();
    } catch (err) {
      toast.error('Failed to load');
    }
  }

  function render() {
    let filtered = allocations;
    if (nodeFilter.value) filtered = filtered.filter(a => a.node_id == nodeFilter.value);
    if (statusFilter.value === 'free') filtered = filtered.filter(a => !a.server_id);
    else if (statusFilter.value === 'assigned') filtered = filtered.filter(a => a.server_id);

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">No allocations</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(a => `
      <tr>
        <td>${a.node_name || '—'}</td>
        <td><code>${a.ip}</code></td>
        <td><code>${a.port}</code></td>
        <td>${a.server_id ? a.server_name : '<span class="text-secondary">Available</span>'}</td>
        <td>${!a.server_id ? `<button class="btn btn-ghost btn-sm btn-danger" data-del="${a.id}">${icon('trash', 16)}</button>` : ''}</td>
      </tr>
    `).join('');
  }

  function parsePorts(input) {
    const ports = [];
    input.split(',').forEach(p => {
      p = p.trim();
      if (p.includes('-')) {
        const [a, b] = p.split('-').map(Number);
        for (let i = a; i <= b; i++) ports.push(i);
      } else {
        ports.push(Number(p));
      }
    });
    return [...new Set(ports)].filter(p => p > 0 && p <= 65535);
  }

  document.getElementById('create-btn').addEventListener('click', () => { form.reset(); modal.classList.add('open'); });
  modal.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => el.addEventListener('click', () => modal.classList.remove('open')));
  nodeFilter.addEventListener('change', render);
  statusFilter.addEventListener('change', render);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ports = parsePorts(form.ports.value);
    if (!ports.length) { toast.error('Invalid ports'); return; }
    try {
      await api.post(`/nodes/${form.node_id.value}/allocations`, { ip: form.ip.value, ports });
      toast.success(`Created ${ports.length} allocations`);
      modal.classList.remove('open');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del]');
    if (btn && confirm('Delete this allocation?')) {
      try {
        await api.delete(`/allocations/${btn.dataset.del}`);
        toast.success('Deleted');
        await load();
      } catch (err) {
        toast.error(err.message);
      }
    }
  });

  await load();
}
