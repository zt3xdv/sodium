import { api } from '../../utils/api.js';
import { router } from '../../router.js';

export default async function render() {
  let nodes = [];
  let eggs = [];
  let users = [];

  try {
    const [nodesRes, eggsRes, usersRes] = await Promise.all([
      api.get('/api/admin/nodes'),
      api.get('/api/admin/eggs'),
      api.get('/api/admin/users')
    ]);
    nodes = nodesRes.data || [];
    eggs = eggsRes.data || [];
    users = usersRes.data || [];
  } catch (err) {
    console.error('Failed to load data:', err);
  }

  return `
    <div class="page admin-page">
      <div class="page-header">
        <h1>Create Server</h1>
      </div>

      <div class="card">
        <div class="card__body">
          <form id="create-server-form">
            <div class="form-group">
              <label for="name">Server Name</label>
              <input type="text" id="name" name="name" placeholder="My Server" required>
            </div>

            <div class="form-group">
              <label for="owner_id">Owner</label>
              <select id="owner_id" name="owner_id" required>
                <option value="">Select owner...</option>
                ${users.map(u => `<option value="${u.id}">${u.username} (${u.email})</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="node_id">Node</label>
              <select id="node_id" name="node_id" required>
                <option value="">Select node...</option>
                ${nodes.map(n => `<option value="${n.id}">${n.name} (${n.fqdn})</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="egg_id">Egg</label>
              <select id="egg_id" name="egg_id" required>
                <option value="">Select egg...</option>
                ${eggs.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="memory">Memory (MB)</label>
                <input type="number" id="memory" name="memory" value="1024" min="128">
              </div>
              <div class="form-group">
                <label for="disk">Disk (MB)</label>
                <input type="number" id="disk" name="disk" value="10240" min="256">
              </div>
              <div class="form-group">
                <label for="cpu">CPU (%)</label>
                <input type="number" id="cpu" name="cpu" value="100" min="1" max="400">
              </div>
            </div>

            <div class="form-actions">
              <a href="/admin/servers" class="btn btn--secondary">Cancel</a>
              <button type="submit" class="btn btn--primary">Create Server</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function mount() {
  const form = document.getElementById('create-server-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
      await api.post('/api/admin/servers', data);
      router.navigate('/admin/servers');
    } catch (err) {
      alert('Failed to create server: ' + (err.message || 'Unknown error'));
    }
  });
}
