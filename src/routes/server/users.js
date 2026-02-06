import { api } from '../../utils/api.js';
import { PERMISSIONS, PERMISSION_GROUPS } from '../../utils/permissions.js';
import * as toast from '../../utils/toast.js';
import * as modal from '../../utils/modal.js';
import { escapeHtml } from '../../utils/security.js';

let currentServerId = null;
let subusers = [];

export function renderUsersTab() {
  return `
    <div class="users-tab">
      <div class="users-header">
        <h3>Subusers</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-subuser">
          <span class="material-icons-outlined">person_add</span>
          Add User
        </button>
      </div>
      <div class="subusers-list" id="subusers-list">
        <div class="loading-spinner"></div>
      </div>
    </div>
    
    <div class="modal" id="subuser-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3 id="modal-title">Add Subuser</h3>
          <button class="modal-close">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group" id="username-group">
            <label>Username</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">person</span>
              <input type="text" id="subuser-username" placeholder="Enter username" />
            </div>
          </div>
          <div class="permissions-editor">
            <h4>Permissions</h4>
            <div class="permissions-grid" id="permissions-grid"></div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-subuser">Cancel</button>
          <button class="btn btn-primary" id="save-subuser">Save</button>
        </div>
      </div>
    </div>
  `;
}

export async function initUsersTab(serverId) {
  currentServerId = serverId;
  await loadSubusers();
  
  document.getElementById('btn-add-subuser').onclick = () => openModal();
  
  const modal = document.getElementById('subuser-modal');
  modal.querySelector('.modal-close').onclick = closeModal;
  modal.querySelector('.modal-backdrop').onclick = closeModal;
  document.getElementById('cancel-subuser').onclick = closeModal;
}

async function loadSubusers() {
  const username = localStorage.getItem('username');
  const list = document.getElementById('subusers-list');
  
  try {
    const res = await api(`/api/servers/${currentServerId}/subusers`);
    const data = await res.json();
    
    if (data.error) {
      list.innerHTML = `<div class="error-message">${escapeHtml(data.error)}</div>`;
      return;
    }
    
    subusers = data.subusers || [];
    renderSubusers();
  } catch (e) {
    list.innerHTML = '<div class="error-message">Failed to load subusers</div>';
  }
}

function renderSubusers() {
  const list = document.getElementById('subusers-list');
  
  if (subusers.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-outlined">group</span>
        <p>No subusers added yet</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = subusers.map(sub => `
    <div class="subuser-item">
      <div class="subuser-info">
        <span class="subuser-name">${escapeHtml(sub.username)}</span>
        <span class="subuser-perms">${sub.permissions.length} permissions</span>
      </div>
      <div class="subuser-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${sub.id}" title="Edit">
          <span class="material-icons-outlined">edit</span>
        </button>
        <button class="btn btn-ghost btn-sm btn-danger-hover" data-delete="${sub.id}" title="Remove">
          <span class="material-icons-outlined">person_remove</span>
        </button>
      </div>
    </div>
  `).join('');
  
  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => openModal(btn.dataset.edit);
  });
  
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.onclick = () => deleteSubuser(btn.dataset.delete);
  });
}

function openModal(editId = null) {
  const modal = document.getElementById('subuser-modal');
  const title = document.getElementById('modal-title');
  const usernameGroup = document.getElementById('username-group');
  const usernameInput = document.getElementById('subuser-username');
  const saveBtn = document.getElementById('save-subuser');
  
  let editingSubuser = null;
  
  if (editId) {
    editingSubuser = subusers.find(s => s.id === editId);
    title.textContent = 'Edit Subuser';
    usernameGroup.style.display = 'none';
  } else {
    title.textContent = 'Add Subuser';
    usernameGroup.style.display = 'block';
    usernameInput.value = '';
  }
  
  renderPermissionsGrid(editingSubuser?.permissions || []);
  
  saveBtn.onclick = () => saveSubuser(editId);
  
  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('subuser-modal').classList.remove('active');
}

function renderPermissionsGrid(selectedPerms = []) {
  const grid = document.getElementById('permissions-grid');
  
  grid.innerHTML = Object.entries(PERMISSION_GROUPS).map(([group, perms]) => `
    <div class="permission-group">
      <div class="permission-group-header">
        <label class="checkbox-label">
          <input type="checkbox" class="group-checkbox" data-group="${group}" 
            ${perms.every(p => selectedPerms.includes(p)) ? 'checked' : ''} />
          <span>${group}</span>
        </label>
      </div>
      <div class="permission-items">
        ${perms.map(p => `
          <label class="checkbox-label">
            <input type="checkbox" class="perm-checkbox" value="${p}" 
              ${selectedPerms.includes(p) ? 'checked' : ''} />
            <span>${PERMISSIONS[p] || p}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');
  
  grid.querySelectorAll('.group-checkbox').forEach(cb => {
    cb.onchange = () => {
      const group = cb.dataset.group;
      const perms = PERMISSION_GROUPS[group];
      perms.forEach(p => {
        const permCb = grid.querySelector(`input[value="${p}"]`);
        if (permCb) permCb.checked = cb.checked;
      });
    };
  });
  
  grid.querySelectorAll('.perm-checkbox').forEach(cb => {
    cb.onchange = () => updateGroupCheckbox(grid);
  });
}

function updateGroupCheckbox(grid) {
  Object.entries(PERMISSION_GROUPS).forEach(([group, perms]) => {
    const groupCb = grid.querySelector(`[data-group="${group}"]`);
    if (groupCb) {
      const allChecked = perms.every(p => {
        const cb = grid.querySelector(`input[value="${p}"]`);
        return cb?.checked;
      });
      groupCb.checked = allChecked;
    }
  });
}

function getSelectedPermissions() {
  const checkboxes = document.querySelectorAll('.perm-checkbox:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

async function saveSubuser(editId) {
  const username = localStorage.getItem('username');
  const permissions = getSelectedPermissions();
  const saveBtn = document.getElementById('save-subuser');
  
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
  
  try {
    if (editId) {
      const res = await api(`/api/servers/${currentServerId}/subusers/${editId}`, {
        method: 'PUT',
        
        body: JSON.stringify({ permissions })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    } else {
      const targetUsername = document.getElementById('subuser-username').value.trim();
      if (!targetUsername) throw new Error('Username required');
      
      const res = await api(`/api/servers/${currentServerId}/subusers`, {
        method: 'POST',
        
        body: JSON.stringify({ target_username: targetUsername, permissions })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    }
    
    closeModal();
    toast.success(editId ? 'Subuser updated' : 'Subuser added');
    await loadSubusers();
  } catch (e) {
    toast.error(e.message);
  }
  
  saveBtn.disabled = false;
  saveBtn.innerHTML = 'Save';
}

async function deleteSubuser(id) {
  const confirmed = await modal.confirm({ title: 'Remove Subuser', message: 'Remove this subuser?', danger: true });
  if (!confirmed) return;
  
  const username = localStorage.getItem('username');
  
  try {
    const res = await api(`/api/servers/${currentServerId}/subusers/${id}`, {
      method: 'DELETE',
      
      body: JSON.stringify({})
    });
    
    if (res.ok) {
      toast.success('Subuser removed');
      await loadSubusers();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  } catch (e) {
    toast.error('Failed to remove subuser');
  }
}

export function cleanupUsersTab() {
  currentServerId = null;
  subusers = [];
}
