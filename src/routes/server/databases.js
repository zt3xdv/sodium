import { renderNav } from '../../components/nav.js';
import { renderServerSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function(params) {
  const serverId = params.id;
  
  return `
    ${renderNav()}
    <div class="server-layout">
      ${renderServerSidebar(serverId, 'databases')}
      <main class="server-content">
        <div class="page-container">
          <div class="page-header">
            <div>
              <h1>Databases</h1>
              <p class="text-secondary">Manage MySQL/MariaDB databases</p>
            </div>
            <button class="btn btn-primary" id="btn-create-db">
              ${icon('plus', 18)} New Database
            </button>
          </div>

          <div class="databases-list" id="databases-list">
            <div class="loading">Loading databases...</div>
          </div>
        </div>
      </main>
    </div>
  `;
}

export async function mount(params) {
  const serverId = params.id;
  const dbList = document.getElementById('databases-list');
  let databases = [];
  let hosts = [];

  async function loadData() {
    try {
      const [dbRes, hostsRes] = await Promise.all([
        api.get(`/databases/${serverId}/databases`),
        api.get('/databases/hosts').catch(() => ({ data: [] }))
      ]);
      databases = dbRes.data || [];
      hosts = hostsRes.data || [];
      renderDatabases();
    } catch (err) {
      toast.error('Failed to load databases');
      dbList.innerHTML = '<div class="empty-state">Failed to load</div>';
    }
  }

  function renderDatabases() {
    if (databases.length === 0) {
      dbList.innerHTML = `
        <div class="empty-state">
          ${icon('database', 48)}
          <h3>No databases</h3>
          <p class="text-secondary">Create a database to store your server data</p>
        </div>
      `;
      return;
    }

    dbList.innerHTML = databases.map(db => `
      <div class="database-item card" data-id="${db.uuid}">
        <div class="db-header">
          <div class="db-icon">${icon('database', 24)}</div>
          <div class="db-info">
            <h4>${db.database_name}</h4>
            <p class="text-secondary">${db.host_name} (${db.host}:${db.port})</p>
          </div>
        </div>
        <div class="db-credentials">
          <div class="credential">
            <span class="label">Host</span>
            <code>${db.host}:${db.port}</code>
          </div>
          <div class="credential">
            <span class="label">Database</span>
            <code>${db.database_name}</code>
          </div>
          <div class="credential">
            <span class="label">Username</span>
            <code>${db.username}</code>
          </div>
          <div class="credential password-field">
            <span class="label">Password</span>
            <code class="password-hidden">••••••••</code>
            <code class="password-visible" style="display:none">${db.password}</code>
            <button class="btn btn-ghost btn-xs toggle-pass" data-id="${db.uuid}">${icon('eye', 14)}</button>
          </div>
        </div>
        <div class="db-actions">
          <button class="btn btn-ghost btn-sm rotate-btn" data-id="${db.uuid}">
            ${icon('refresh', 14)} Rotate Password
          </button>
          <button class="btn btn-ghost btn-sm delete-btn" data-id="${db.uuid}">
            ${icon('trash', 14)} Delete
          </button>
        </div>
      </div>
    `).join('');

    attachListeners();
  }

  function attachListeners() {
    document.querySelectorAll('.toggle-pass').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.password-field');
        const hidden = item.querySelector('.password-hidden');
        const visible = item.querySelector('.password-visible');
        if (hidden.style.display === 'none') {
          hidden.style.display = '';
          visible.style.display = 'none';
        } else {
          hidden.style.display = 'none';
          visible.style.display = '';
        }
      });
    });

    document.querySelectorAll('.rotate-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await confirmModal('Rotate Password', 'This will generate a new password. Update your server config after this.');
        if (!confirmed) return;

        try {
          const res = await api.post(`/databases/${serverId}/databases/${btn.dataset.id}/rotate-password`);
          toast.success('Password rotated');
          loadData();
        } catch (err) {
          toast.error('Failed to rotate password');
        }
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await confirmModal('Delete Database', 'This will permanently delete the database. This action cannot be undone.');
        if (!confirmed) return;

        try {
          await api.delete(`/databases/${serverId}/databases/${btn.dataset.id}`);
          toast.success('Database deleted');
          loadData();
        } catch (err) {
          toast.error('Failed to delete database');
        }
      });
    });
  }

  document.getElementById('btn-create-db').addEventListener('click', () => {
    if (hosts.length === 0) {
      toast.error('No database hosts available. Contact an administrator.');
      return;
    }

    openModal({
      title: 'Create Database',
      content: `
        <div class="form-group">
          <label for="host_id">Database Host</label>
          <select id="host_id" class="input">
            ${hosts.map(h => `<option value="${h.id}">${h.name} (${h.host})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="db_name">Database Name (optional)</label>
          <input type="text" id="db_name" class="input" placeholder="Auto-generated if empty">
        </div>
        <div class="form-group">
          <label for="remote">Remote Access</label>
          <select id="remote" class="input">
            <option value="%">Anywhere (%)</option>
            <option value="localhost">Localhost only</option>
          </select>
        </div>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Create', class: 'btn-primary', action: async () => {
          try {
            await api.post(`/databases/${serverId}/databases`, {
              host_id: document.getElementById('host_id').value,
              database_name: document.getElementById('db_name').value || undefined,
              remote: document.getElementById('remote').value
            });
            toast.success('Database created');
            closeModal();
            loadData();
          } catch (err) {
            toast.error(err.message || 'Failed to create database');
          }
        }}
      ]
    });
  });

  await loadData();
}
