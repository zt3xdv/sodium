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

    try {
      await api.post('/admin/users', data);
      router.navigate('/admin/users');
    } catch (err) {
      alert('Failed to create user: ' + (err.message || 'Unknown error'));
    }
  });
}
