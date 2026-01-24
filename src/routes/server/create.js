import { api } from '../../utils/api.js';
import { router } from '../../router.js';

export default async function render() {
  let nodes = [];
  let eggs = [];

  try {
    const [nodesRes, eggsRes] = await Promise.all([
      api.get('/nodes'),
      api.get('/eggs')
    ]);
    nodes = nodesRes.data || [];
    eggs = eggsRes.data || [];
  } catch (err) {
    console.error('Failed to load data:', err);
  }

  return `
    <div class="page">
      <div class="page-header">
        <h1>Create Server</h1>
      </div>

      <div class="card">
        <div class="card__body">
          <form id="create-server-form">
            <div class="form-group">
              <label for="name">Server Name</label>
              <input type="text" id="name" name="name" placeholder="My Awesome Server" required>
            </div>

            <div class="form-group">
              <label for="node_id">Node</label>
              <select id="node_id" name="node_id" required>
                <option value="">Select a node...</option>
                ${nodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="egg_id">Game / Egg</label>
              <select id="egg_id" name="egg_id" required>
                <option value="">Select a game...</option>
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
            </div>

            <div class="form-actions">
              <a href="/servers" class="btn btn--secondary">Cancel</a>
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
      const res = await api.post('/servers', data);
      router.navigate(`/server/${res.data.uuid}/console`);
    } catch (err) {
      alert('Failed to create server: ' + (err.message || 'Unknown error'));
    }
  });
}
