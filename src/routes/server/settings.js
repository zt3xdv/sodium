let currentServerId = null;
let serverData = null;

export function renderSettingsTab() {
  return `
    <div class="settings-tab">
      <div class="settings-grid">
        <div class="card">
          <div class="card-header">
            <h3>Server Details</h3>
          </div>
          <div class="card-content" id="settings-details">
            <div class="loading-spinner"></div>
          </div>
        </div>
        
        <div class="card danger-zone">
          <div class="card-header">
            <h3>Danger Zone</h3>
          </div>
          <div class="card-content">
            <div class="danger-action">
              <div class="danger-info">
                <h4>Reinstall Server</h4>
                <p>This will delete all server files and reinstall the server from scratch.</p>
              </div>
              <button class="btn btn-warning" id="btn-reinstall">
                <span class="material-icons-outlined">refresh</span>
                Reinstall
              </button>
            </div>
            
            <div class="danger-action">
              <div class="danger-info">
                <h4>Delete Server</h4>
                <p>This will permanently delete the server and all its data. This action cannot be undone.</p>
              </div>
              <button class="btn btn-danger" id="btn-delete">
                <span class="material-icons-outlined">delete_forever</span>
                Delete Server
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function initSettingsTab(serverId) {
  currentServerId = serverId;
  await loadServerDetails(serverId);
  
  document.getElementById('btn-reinstall').onclick = () => confirmReinstall();
  document.getElementById('btn-delete').onclick = () => confirmDelete();
}

async function loadServerDetails(serverId) {
  const username = localStorage.getItem('username');
  const content = document.getElementById('settings-details');
  
  try {
    const res = await fetch(`/api/servers/${serverId}?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.error) {
      content.innerHTML = `<div class="error">${escapeHtml(data.error)}</div>`;
      return;
    }
    
    serverData = data.server;
    renderDetailsForm(serverData);
  } catch (e) {
    console.error('Failed to load server details:', e);
    content.innerHTML = '<div class="error">Failed to load server details</div>';
  }
}

function renderDetailsForm(server) {
  const content = document.getElementById('settings-details');
  
  content.innerHTML = `
    <form id="details-form" class="settings-form">
      <div class="form-group">
        <label for="server-name">Server Name</label>
        <input type="text" id="server-name" name="name" value="${escapeHtml(server.name)}" maxlength="50" required />
      </div>
      
      <div class="form-group">
        <label for="server-description">Description</label>
        <textarea id="server-description" name="description" rows="3" maxlength="200" placeholder="Optional server description...">${escapeHtml(server.description || '')}</textarea>
      </div>
      
      <div class="form-info">
        <div class="info-row">
          <span class="info-label">Server ID</span>
          <code class="info-value">${escapeHtml(server.id)}</code>
        </div>
        <div class="info-row">
          <span class="info-label">Created</span>
          <span class="info-value">${formatDate(server.created_at)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Address</span>
          <span class="info-value">${escapeHtml(server.allocation?.ip || '0.0.0.0')}:${server.allocation?.port || 25565}</span>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="save-details">
          <span class="material-icons-outlined">save</span>
          Save Changes
        </button>
      </div>
    </form>
  `;
  
  document.getElementById('details-form').onsubmit = (e) => {
    e.preventDefault();
    saveDetails();
  };
}

async function saveDetails() {
  const username = localStorage.getItem('username');
  const saveBtn = document.getElementById('save-details');
  
  const name = document.getElementById('server-name').value.trim();
  const description = document.getElementById('server-description').value.trim();
  
  if (!name) {
    alert('Server name is required');
    return;
  }
  
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Saving...';
  
  try {
    const res = await fetch(`/api/servers/${currentServerId}/details`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, name, description })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      saveBtn.innerHTML = '<span class="material-icons-outlined">check</span> Saved';
      
      const serverNameEl = document.getElementById('server-name-header');
      if (serverNameEl) serverNameEl.textContent = name;
      
      const headerNameEl = document.querySelector('.server-title h1');
      if (headerNameEl) headerNameEl.textContent = name;
      
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save Changes';
      }, 1500);
    } else {
      alert(data.error || 'Failed to save');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save Changes';
    }
  } catch (e) {
    console.error('Failed to save details:', e);
    alert('Failed to save server details');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save Changes';
  }
}

function confirmReinstall() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>Reinstall Server</h3>
        <button class="modal-close">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <div class="warning-box">
        <span class="material-icons-outlined">warning</span>
        <p>This will delete all server files and reinstall the server from scratch. This action cannot be undone!</p>
      </div>
      <p style="margin-bottom: 12px; color: var(--text-secondary);">Type <strong style="color: var(--text-primary);">REINSTALL</strong> to confirm:</p>
      <input type="text" class="text-input" id="confirm-reinstall-input" placeholder="REINSTALL" style="width: 100%; text-align: center;" />
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cancel-reinstall">Cancel</button>
        <button class="btn btn-warning" id="do-reinstall" disabled>Reinstall Server</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('active'), 10);
  
  const input = document.getElementById('confirm-reinstall-input');
  const doBtn = document.getElementById('do-reinstall');
  
  const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 150);
  };
  
  input.oninput = () => {
    doBtn.disabled = input.value !== 'REINSTALL';
  };
  
  modal.querySelector('.modal-close').onclick = closeModal;
  modal.querySelector('.modal-backdrop').onclick = closeModal;
  document.getElementById('cancel-reinstall').onclick = closeModal;
  
  doBtn.onclick = async () => {
    doBtn.disabled = true;
    doBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Reinstalling...';
    await reinstallServer();
    closeModal();
  };
}

async function reinstallServer() {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${currentServerId}/reinstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert('Server reinstall initiated. The server will be reinstalled shortly.');
      window.router.navigateTo('/servers');
    } else {
      alert(data.error || 'Failed to reinstall server');
    }
  } catch (e) {
    console.error('Failed to reinstall server:', e);
    alert('Failed to reinstall server');
  }
}

function confirmDelete() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>Delete Server</h3>
        <button class="modal-close">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <div class="warning-box danger">
        <span class="material-icons-outlined">error</span>
        <p>This will permanently delete the server and all its data. This action cannot be undone!</p>
      </div>
      <p style="margin-bottom: 12px; color: var(--text-secondary);">Type <strong style="color: var(--text-primary);">DELETE</strong> to confirm:</p>
      <input type="text" class="text-input" id="confirm-delete-input" placeholder="DELETE" style="width: 100%; text-align: center;" />
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cancel-delete">Cancel</button>
        <button class="btn btn-danger" id="do-delete" disabled>Delete Server</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('active'), 10);
  
  const input = document.getElementById('confirm-delete-input');
  const doBtn = document.getElementById('do-delete');
  
  const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 150);
  };
  
  input.oninput = () => {
    doBtn.disabled = input.value !== 'DELETE';
  };
  
  modal.querySelector('.modal-close').onclick = closeModal;
  modal.querySelector('.modal-backdrop').onclick = closeModal;
  document.getElementById('cancel-delete').onclick = closeModal;
  
  doBtn.onclick = async () => {
    doBtn.disabled = true;
    doBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Deleting...';
    await deleteServer();
    closeModal();
  };
}

async function deleteServer() {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${currentServerId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert('Server deleted successfully');
      window.router.navigateTo('/servers');
    } else {
      alert(data.error || 'Failed to delete server');
    }
  } catch (e) {
    console.error('Failed to delete server:', e);
    alert('Failed to delete server');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function cleanupSettingsTab() {
  currentServerId = null;
  serverData = null;
}
