import { api } from '../../utils/api.js';
import { router } from '../../router.js';

export default function render() {
  return `
    <div class="page admin-page">
      <div class="page-header">
        <h1>Create Node</h1>
      </div>

      <div class="card">
        <div class="card__body">
          <form id="create-node-form">
            <div class="form-group">
              <label for="name">Node Name</label>
              <input type="text" id="name" name="name" placeholder="Node 01" required>
            </div>

            <div class="form-group">
              <label for="fqdn">FQDN / IP Address</label>
              <input type="text" id="fqdn" name="fqdn" placeholder="node01.example.com" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="scheme">Scheme</label>
                <select id="scheme" name="scheme">
                  <option value="https">HTTPS</option>
                  <option value="http">HTTP</option>
                </select>
              </div>
              <div class="form-group">
                <label for="daemon_port">Daemon Port</label>
                <input type="number" id="daemon_port" name="daemon_port" value="8080">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="memory">Memory (MB)</label>
                <input type="number" id="memory" name="memory" value="8192">
              </div>
              <div class="form-group">
                <label for="memory_overallocate">Overallocate (%)</label>
                <input type="number" id="memory_overallocate" name="memory_overallocate" value="0">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="disk">Disk (MB)</label>
                <input type="number" id="disk" name="disk" value="102400">
              </div>
              <div class="form-group">
                <label for="disk_overallocate">Overallocate (%)</label>
                <input type="number" id="disk_overallocate" name="disk_overallocate" value="0">
              </div>
            </div>

            <div class="form-actions">
              <a href="/admin/nodes" class="btn btn--secondary">Cancel</a>
              <button type="submit" class="btn btn--primary">Create Node</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function mount() {
  const form = document.getElementById('create-node-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
      await api.post('/nodes', data);
      router.navigate('/admin/nodes');
    } catch (err) {
      alert('Failed to create node: ' + (err.message || 'Unknown error'));
    }
  });
}
