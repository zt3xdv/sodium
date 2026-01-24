import { renderNav } from '../../components/nav.js';
import { renderServerSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { formatBytes, formatDate } from '../../utils/format.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function(params) {
  const serverId = params.id;
  
  return `
    ${renderNav()}
    <div class="server-layout">
      ${renderServerSidebar(serverId, 'backups')}
      <main class="server-content">
        <div class="page-container">
          <div class="page-header">
            <div>
              <h1>Backups</h1>
              <p class="text-secondary">Create and restore server backups</p>
            </div>
            <button class="btn btn-primary" id="btn-create-backup">
              ${icon('plus', 18)} Create Backup
            </button>
          </div>

          <div class="backup-info card" id="backup-info">
            <div class="info-item">
              <span class="info-label">Total Backups</span>
              <span class="info-value" id="total-backups">—</span>
            </div>
            <div class="info-item">
              <span class="info-label">Storage Used</span>
              <span class="info-value" id="storage-used">—</span>
            </div>
          </div>

          <div class="backups-list" id="backups-list">
            <div class="loading">Loading backups...</div>
          </div>
        </div>
      </main>
    </div>
  `;
}

export async function mount(params) {
  const serverId = params.id;
  const backupsList = document.getElementById('backups-list');
  let backups = [];

  async function loadBackups() {
    try {
      const res = await api.get(`/servers/${serverId}/backups`);
      backups = res.data || [];
      
      document.getElementById('total-backups').textContent = backups.length;
      document.getElementById('storage-used').textContent = formatBytes(res.meta?.totalSize || 0);
      
      renderBackups();
    } catch (err) {
      toast.error('Failed to load backups');
      backupsList.innerHTML = '<div class="empty-state">Failed to load backups</div>';
    }
  }

  function renderBackups() {
    if (backups.length === 0) {
      backupsList.innerHTML = `
        <div class="empty-state">
          ${icon('archive', 48)}
          <h3>No backups yet</h3>
          <p class="text-secondary">Create your first backup to protect your server data</p>
        </div>
      `;
      return;
    }

    backupsList.innerHTML = backups.map(backup => `
      <div class="backup-item card" data-id="${backup.uuid}">
        <div class="backup-info-row">
          <div class="backup-icon">
            ${icon(backup.status === 'completed' ? 'check-circle' : backup.status === 'creating' ? 'loader' : 'alert-circle', 20)}
          </div>
          <div class="backup-details">
            <h4>${backup.name}</h4>
            <p class="text-secondary">
              ${formatDate(backup.created_at)} • ${formatBytes(backup.size || 0)}
            </p>
          </div>
          <div class="backup-status">
            <span class="badge badge-${backup.status === 'completed' ? 'success' : backup.status === 'creating' ? 'warning' : 'danger'}">
              ${backup.status}
            </span>
          </div>
        </div>
        ${backup.status === 'completed' ? `
          <div class="backup-actions">
            <button class="btn btn-ghost btn-sm download-btn" data-id="${backup.uuid}">
              ${icon('download', 14)} Download
            </button>
            <button class="btn btn-ghost btn-sm restore-btn" data-id="${backup.uuid}">
              ${icon('refresh', 14)} Restore
            </button>
            <button class="btn btn-ghost btn-sm delete-btn" data-id="${backup.uuid}">
              ${icon('trash', 14)} Delete
            </button>
          </div>
        ` : ''}
        ${backup.error ? `<p class="backup-error text-danger">${backup.error}</p>` : ''}
      </div>
    `).join('');

    attachListeners();
  }

  function attachListeners() {
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.open(`/api/servers/${serverId}/backups/${btn.dataset.id}/download`, '_blank');
      });
    });

    document.querySelectorAll('.restore-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await confirmModal(
          'Restore Backup',
          'This will replace all server files with the backup. The server must be stopped. Are you sure?'
        );
        if (!confirmed) return;

        try {
          await api.post(`/servers/${serverId}/backups/${btn.dataset.id}/restore`);
          toast.success('Backup restored successfully');
        } catch (err) {
          toast.error(err.message || 'Failed to restore backup');
        }
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await confirmModal('Delete Backup', 'Are you sure you want to delete this backup?');
        if (!confirmed) return;

        try {
          await api.delete(`/servers/${serverId}/backups/${btn.dataset.id}`);
          toast.success('Backup deleted');
          loadBackups();
        } catch (err) {
          toast.error('Failed to delete backup');
        }
      });
    });
  }

  document.getElementById('btn-create-backup').addEventListener('click', () => {
    openModal({
      title: 'Create Backup',
      content: `
        <div class="form-group">
          <label for="backup-name">Backup Name</label>
          <input type="text" id="backup-name" class="input" placeholder="My Backup">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="ignore-logs" checked>
            Exclude log files
          </label>
        </div>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Create', class: 'btn-primary', action: async () => {
          const name = document.getElementById('backup-name').value || `Backup ${new Date().toLocaleString()}`;
          const ignoreLogs = document.getElementById('ignore-logs').checked;

          try {
            closeModal();
            toast.info('Creating backup...');
            
            await api.post(`/servers/${serverId}/backups`, {
              name,
              ignore: ignoreLogs ? ['*.log', 'logs/', 'cache/'] : []
            });
            
            toast.success('Backup created successfully');
            loadBackups();
          } catch (err) {
            toast.error(err.message || 'Failed to create backup');
          }
        }}
      ]
    });
  });

  await loadBackups();
}
