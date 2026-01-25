import { api } from '../../utils/api.js';
import { router } from '../../router.js';

export default function render() {
  return `
    <div class="page admin-page">
      <div class="page-header">
        <h1>Create User</h1>
      </div>

      <div class="card">
        <div class="card__body">
          <form id="create-user-form">
            <div class="form-group">
              <label for="username">Username</label>
              <input type="text" id="username" name="username" placeholder="johndoe" required>
            </div>

            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" placeholder="john@example.com" required>
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" placeholder="••••••••" required minlength="8">
            </div>

            <div class="form-group">
              <label for="role">Role</label>
              <select id="role" name="role">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <fieldset class="form-section">
              <legend>Resource Limits <span class="text-muted">(0 = unlimited)</span></legend>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="limit_servers">Servers</label>
                  <input type="number" id="limit_servers" name="limit_servers" value="0" min="0">
                </div>
                <div class="form-group">
                  <label for="limit_cpu">CPU (%)</label>
                  <input type="number" id="limit_cpu" name="limit_cpu" value="0" min="0">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="limit_memory">Memory (MB)</label>
                  <input type="number" id="limit_memory" name="limit_memory" value="0" min="0">
                </div>
                <div class="form-group">
                  <label for="limit_disk">Disk (MB)</label>
                  <input type="number" id="limit_disk" name="limit_disk" value="0" min="0">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="limit_databases">Databases</label>
                  <input type="number" id="limit_databases" name="limit_databases" value="0" min="0">
                </div>
                <div class="form-group">
                  <label for="limit_backups">Backups</label>
                  <input type="number" id="limit_backups" name="limit_backups" value="0" min="0">
                </div>
                <div class="form-group">
                  <label for="limit_allocations">Allocations</label>
                  <input type="number" id="limit_allocations" name="limit_allocations" value="0" min="0">
                </div>
              </div>
            </fieldset>

            <div class="form-actions">
              <a href="/admin/users" class="btn btn--secondary">Cancel</a>
              <button type="submit" class="btn btn--primary">Create User</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function mount() {
  const form = document.getElementById('create-user-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    data.limit_servers = parseInt(data.limit_servers) || 0;
    data.limit_cpu = parseInt(data.limit_cpu) || 0;
    data.limit_memory = parseInt(data.limit_memory) || 0;
    data.limit_disk = parseInt(data.limit_disk) || 0;
    data.limit_databases = parseInt(data.limit_databases) || 0;
    data.limit_backups = parseInt(data.limit_backups) || 0;
    data.limit_allocations = parseInt(data.limit_allocations) || 0;

    try {
      await api.post('/admin/users', data);
      router.navigate('/admin/users');
    } catch (err) {
      alert('Failed to create user: ' + (err.message || 'Unknown error'));
    }
  });
}
