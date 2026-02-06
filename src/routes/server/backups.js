import { api } from '../../utils/api.js';
import * as toast from '../../utils/toast.js';
import * as modal from '../../utils/modal.js';
import { formatBytes, formatDate } from '../../utils/format.js';

let currentServerId = null;
let autoRefreshInterval = null;
let isModalOpen = false;

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

export function renderBackupsTab() {
  return `
    <div class="backups-tab">
      <div class="card">
        <div class="card-header">
          <h3>Backups</h3>
          <div class="card-header-actions">
            <button class="btn btn-ghost btn-sm" id="btn-refresh-backups" title="Refresh">
              <span class="material-icons-outlined">refresh</span>
            </button>
            <button class="btn btn-primary btn-sm" id="btn-create-backup">
              <span class="material-icons-outlined">add</span>
              Create Backup
            </button>
          </div>
        </div>
        <div class="backups-list" id="backups-list">
          <div class="loading">Loading backups...</div>
        </div>
      </div>
    </div>
  `;
}

export async function initBackupsTab(serverId) {
  currentServerId = serverId;
  
  document.getElementById('btn-create-backup').onclick = () => createBackup(serverId);
  document.getElementById('btn-refresh-backups').onclick = () => refreshBackups();
  
  await loadBackups(serverId);
  startAutoRefresh();
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshInterval = setInterval(() => {
    if (!isModalOpen && currentServerId) {
      loadBackups(currentServerId);
    }
  }, AUTO_REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

async function refreshBackups() {
  if (!currentServerId) return;
  
  const btn = document.getElementById('btn-refresh-backups');
  if (btn) {
    btn.disabled = true;
    btn.querySelector('.material-icons-outlined').classList.add('spinning');
  }
  
  await loadBackups(currentServerId);
  
  if (btn) {
    btn.disabled = false;
    btn.querySelector('.material-icons-outlined').classList.remove('spinning');
  }
}

async function loadBackups(serverId) {
  const container = document.getElementById('backups-list');
  
  try {
    const res = await api(`/api/servers/${serverId}/backups`);
    const data = await res.json();
    
    if (!res.ok) {
      container.innerHTML = `<div class="error">${data.error || 'Failed to load backups'}</div>`;
      return;
    }
    
    const backups = data.backups || [];
    
    if (backups.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined">cloud_off</span>
          <p>No backups yet</p>
          <p class="hint">Create a backup to save your server files</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = backups.map(backup => `
      <div class="backup-item ${backup.is_successful ? '' : 'pending'}" data-id="${backup.id}">
        <div class="backup-icon">
          <span class="material-icons-outlined ${backup.is_successful ? '' : 'spinning'}">
            ${backup.is_successful ? 'cloud_done' : 'cloud_sync'}
          </span>
        </div>
        <div class="backup-info">
          <div class="backup-name">
            ${backup.name}
            ${backup.is_locked ? '<span class="material-icons-outlined locked-icon">lock</span>' : ''}
          </div>
          <div class="backup-meta">
            ${backup.is_successful ? formatBytes(backup.bytes || 0) : '<span class="backup-progress">Creating backup...</span>'}
            <span class="separator">•</span>
            ${formatDate(backup.created_at)}
          </div>
          ${backup.checksum ? `<div class="backup-checksum" title="SHA256 Checksum">Checksum: ${backup.checksum}</div>` : ''}
        </div>
        <div class="backup-actions">
          ${backup.is_successful ? `
            <button class="btn btn-xs btn-ghost" title="Download" data-action="download">
              <span class="material-icons-outlined">download</span>
            </button>
            <button class="btn btn-xs btn-ghost" title="Restore" data-action="restore">
              <span class="material-icons-outlined">restore</span>
            </button>
          ` : `
            <div class="backup-pending-indicator">
              <div class="progress-bar-mini">
                <div class="progress-bar-mini-fill"></div>
              </div>
            </div>
          `}
          <button class="btn btn-xs btn-ghost" title="${backup.is_locked ? 'Unlock' : 'Lock'}" data-action="lock">
            <span class="material-icons-outlined">${backup.is_locked ? 'lock_open' : 'lock'}</span>
          </button>
          <button class="btn btn-xs btn-ghost btn-danger" title="Delete" data-action="delete" ${backup.is_locked ? 'disabled' : ''}>
            <span class="material-icons-outlined">delete</span>
          </button>
        </div>
      </div>
    `).join('');
    
    // Attach event listeners
    container.querySelectorAll('.backup-item').forEach(item => {
      const backupId = item.dataset.id;
      
      item.querySelector('[data-action="download"]')?.addEventListener('click', () => {
        downloadBackup(serverId, backupId);
      });
      
      item.querySelector('[data-action="restore"]')?.addEventListener('click', () => {
        restoreBackup(serverId, backupId);
      });
      
      item.querySelector('[data-action="lock"]')?.addEventListener('click', () => {
        toggleLock(serverId, backupId);
      });
      
      item.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        deleteBackup(serverId, backupId);
      });
    });
    
  } catch (e) {
    console.error('Failed to load backups:', e);
    container.innerHTML = `<div class="error">Failed to load backups</div>`;
  }
}

function validateBackupName(name) {
  if (!name) return true;
  if (name.length > 100) return 'Name must be 100 characters or less';
  if (/[<>:"/\\|?*]/.test(name)) return 'Name contains invalid characters';
  return true;
}

async function createBackup(serverId) {
  isModalOpen = true;
  
  const content = `
    <div class="form-group">
      <label>Backup Name (optional)</label>
      <input type="text" id="backup-name" placeholder="My Backup" maxlength="100" />
      <p class="hint error-hint" id="backup-name-error"></p>
    </div>
    <div class="form-group">
      <label>Ignored Files (optional)</label>
      <textarea id="backup-ignored" placeholder="*.log&#10;cache/*" rows="3"></textarea>
      <p class="hint">One pattern per line. These files will be excluded from the backup.</p>
    </div>
  `;
  
  modal.show({
    title: 'Create Backup',
    content,
    confirmText: 'Create',
    onConfirm: async () => {
      const name = document.getElementById('backup-name').value.trim();
      const errorEl = document.getElementById('backup-name-error');
      
      const validation = validateBackupName(name);
      if (validation !== true) {
        errorEl.textContent = validation;
        return false;
      }
      
      const ignoredText = document.getElementById('backup-ignored').value.trim();
      const ignored = ignoredText ? ignoredText.split('\n').map(s => s.trim()).filter(Boolean) : [];
      
      try {
        const res = await api(`/api/servers/${serverId}/backups`, {
          method: 'POST',
          body: JSON.stringify({ name, ignored })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          toast.error(data.error || 'Failed to create backup');
          return;
        }
        
        toast.success('Backup started');
        loadBackups(serverId);
      } catch (e) {
        toast.error('Failed to create backup');
      }
    },
    onClose: () => {
      isModalOpen = false;
    }
  });
  
  const nameInput = document.getElementById('backup-name');
  const errorEl = document.getElementById('backup-name-error');
  
  nameInput?.addEventListener('input', () => {
    const validation = validateBackupName(nameInput.value.trim());
    errorEl.textContent = validation === true ? '' : validation;
  });
}

async function downloadBackup(serverId, backupId) {
  try {
    const res = await api(`/api/servers/${serverId}/backups/${backupId}/download`);
    const data = await res.json();
    
    if (!res.ok) {
      toast.error(data.error || 'Failed to get download URL');
      return;
    }
    
    if (data.url) {
      window.open(data.url, '_blank');
    } else {
      toast.error('Download URL not available');
    }
  } catch (e) {
    toast.error('Failed to download backup');
  }
}

async function restoreBackup(serverId, backupId) {
  modal.confirm({
    title: 'Restore Backup',
    message: 'Are you sure you want to restore this backup? This will overwrite current server files.',
    confirmText: 'Restore',
    danger: true,
    onConfirm: async () => {
      try {
        const res = await api(`/api/servers/${serverId}/backups/${backupId}/restore`, {
          method: 'POST'
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          toast.error(data.error || 'Failed to restore backup');
          return;
        }
        
        toast.success('Backup restore started');
      } catch (e) {
        toast.error('Failed to restore backup');
      }
    }
  });
}

async function toggleLock(serverId, backupId) {
  try {
    const res = await api(`/api/servers/${serverId}/backups/${backupId}/lock`, {
      method: 'POST'
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      toast.error(data.error || 'Failed to toggle lock');
      return;
    }
    
    toast.success(data.is_locked ? 'Backup locked' : 'Backup unlocked');
    loadBackups(serverId);
  } catch (e) {
    toast.error('Failed to toggle lock');
  }
}

async function deleteBackup(serverId, backupId) {
  modal.confirm({
    title: 'Delete Backup',
    message: 'Are you sure you want to delete this backup? This action cannot be undone.',
    confirmText: 'Delete',
    danger: true,
    onConfirm: async () => {
      try {
        const res = await api(`/api/servers/${serverId}/backups/${backupId}`, {
          method: 'DELETE'
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          toast.error(data.error || 'Failed to delete backup');
          return;
        }
        
        toast.success('Backup deleted');
        loadBackups(serverId);
      } catch (e) {
        toast.error('Failed to delete backup');
      }
    }
  });
}

export function cleanupBackupsTab() {
  stopAutoRefresh();
  currentServerId = null;
  isModalOpen = false;
}
