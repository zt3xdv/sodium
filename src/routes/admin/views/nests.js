import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import * as modal from '../../../utils/modal.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { renderBreadcrumb, setupBreadcrumbListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

function renderAdminEggIcon(egg) {
  if (!egg.icon) {
    return '<span class="material-icons-outlined">egg_alt</span>';
  }
  
  // Check if it's a Material Icon name (no slashes, no dots)
  if (!egg.icon.includes('/') && !egg.icon.includes('.')) {
    return `<span class="material-icons-outlined">${escapeHtml(egg.icon)}</span>`;
  }
  
  // It's a URL (image)
  if (egg.icon.startsWith('http') || egg.icon.startsWith('/') || egg.icon.includes('.')) {
    return `<img src="${escapeHtml(egg.icon)}" alt="${escapeHtml(egg.name)}" onerror="this.outerHTML='<span class=\\'material-icons-outlined\\'>egg_alt</span>'" />`;
  }
  
  return '<span class="material-icons-outlined">egg_alt</span>';
}

export async function renderNestsList(container, username, loadView) {
  try {
    const res = await api('/api/admin/nests');
    const data = await res.json();
    const nests = data.nests || [];
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Nests & Eggs' }])}
        <div class="admin-header-actions">
          <button class="btn btn-ghost" id="create-nest-btn">
            <span class="material-icons-outlined">create_new_folder</span>
            Create Nest
          </button>
          ${nests.length > 0 ? `
            <button class="btn btn-ghost" id="create-egg-btn">
              <span class="material-icons-outlined">add</span>
              New Egg
            </button>
            <button class="btn btn-primary" id="import-egg-btn">
              <span class="material-icons-outlined">upload</span>
              Import Egg
            </button>
          ` : ''}
        </div>
      </div>
      
      <div class="admin-list">
        ${nests.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">egg</span>
            <p>No nests yet. Create one to organize your eggs.</p>
          </div>
        ` : `
          <div class="nests-list">
            ${nests.map(nest => `
              <div class="nest-card">
                <div class="nest-header">
                  <div class="nest-info">
                    <h3>${escapeHtml(nest.name)}</h3>
                    <p>${escapeHtml(nest.description || 'No description')}</p>
                  </div>
                  <div class="nest-actions">
                    <button class="btn btn-sm btn-ghost" onclick="editNestAdmin('${nest.id}')" title="Edit Nest">
                      <span class="material-icons-outlined">edit</span>
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="addEggToNestAdmin('${nest.id}')" title="Add Egg">
                      <span class="material-icons-outlined">add</span>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteNestAdmin('${nest.id}')" title="Delete Nest">
                      <span class="material-icons-outlined">delete</span>
                    </button>
                  </div>
                </div>
                <div class="eggs-grid">
                  ${(nest.eggs || []).length === 0 ? `
                    <div class="empty-eggs">No eggs in this nest</div>
                  ` : (nest.eggs || []).map(egg => `
                    <div class="egg-card clickable" data-egg-id="${egg.id}">
                      <div class="egg-icon">
                        ${renderAdminEggIcon(egg)}
                      </div>
                      <div class="egg-info">
                        <h4>${escapeHtml(egg.name)}${egg.admin_only ? '<span class="admin-badge">Admin</span>' : ''}</h4>
                        <span class="egg-author">${escapeHtml(egg.author || 'Unknown')}</span>
                      </div>
                      <div class="egg-meta">
                        <span class="egg-vars-count" title="Variables">${(egg.variables || []).length} vars</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
    document.getElementById('create-nest-btn').onclick = () => showNestModal(username, null, loadView);
    
    const createEggBtn = document.getElementById('create-egg-btn');
    if (createEggBtn) {
      createEggBtn.onclick = () => createNewEgg();
    }
    
    const importBtn = document.getElementById('import-egg-btn');
    if (importBtn) {
      importBtn.onclick = () => showImportEggModal(username, nests, loadView);
    }
    
    // Click on egg card to open detail view
    document.querySelectorAll('.egg-card.clickable').forEach(card => {
      card.onclick = () => navigateTo('eggs', card.dataset.eggId);
    });
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load nests</div>`;
  }
}

function showNestModal(username, nest = null, loadView) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>${nest ? 'Edit Nest' : 'Create Nest'}</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="nest-form" class="modal-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${nest ? escapeHtml(nest.name) : ''}" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3">${nest ? escapeHtml(nest.description || '') : ''}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">${nest ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('nest-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const nestData = {
      name: form.get('name'),
      description: form.get('description')
    };
    
    try {
      if (nest) {
        await api(`/api/admin/nests/${nest.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nest: nestData })
        });
      } else {
        await api('/api/admin/nests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nest: nestData })
        });
      }
      modal.remove();
      // If loadView is passed, use it, otherwise assume global loadView works via window or we are in a context where reload happens
      if (typeof loadView === 'function') loadView();
      else if (typeof window.adminNavigate === 'function') window.adminNavigate(state.currentView.tab);
    } catch (e) {
      toast.error('Failed to save nest');
    }
  };
}

function showImportEggModal(username, nests, loadView) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h2>Import Egg</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="import-egg-form" class="modal-form">
        <div class="form-group">
          <label>Target Nest</label>
          <select name="nest_id" required>
            ${nests.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label>Import Method</label>
          <div class="import-method-tabs">
            <button type="button" class="import-tab active" data-method="file">
              <span class="material-icons-outlined">upload_file</span>
              Upload File
            </button>
            <button type="button" class="import-tab" data-method="paste">
              <span class="material-icons-outlined">content_paste</span>
              Paste JSON
            </button>
          </div>
        </div>
        
        <div id="import-file-section" class="form-group">
          <label>Egg File (.json)</label>
          <div class="file-upload-area" id="file-upload-area">
            <input type="file" name="eggFile" id="egg-file-input" accept=".json" hidden />
            <span class="material-icons-outlined">cloud_upload</span>
            <p>Click to select or drag & drop egg file</p>
            <span class="file-name" id="selected-file-name"></span>
          </div>
        </div>
        
        <div id="import-paste-section" class="form-group" style="display: none;">
          <label>Egg JSON</label>
          <textarea name="eggJson" rows="12" placeholder="Paste Pterodactyl egg JSON here..."></textarea>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Import</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  const fileSection = modal.querySelector('#import-file-section');
  const pasteSection = modal.querySelector('#import-paste-section');
  const fileInput = modal.querySelector('#egg-file-input');
  const uploadArea = modal.querySelector('#file-upload-area');
  const fileNameSpan = modal.querySelector('#selected-file-name');
  const tabs = modal.querySelectorAll('.import-tab');
  
  let currentMethod = 'file';
  let fileContent = null;
  
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMethod = tab.dataset.method;
      
      if (currentMethod === 'file') {
        fileSection.style.display = '';
        pasteSection.style.display = 'none';
      } else {
        fileSection.style.display = 'none';
        pasteSection.style.display = '';
      }
    };
  });
  
  uploadArea.onclick = () => fileInput.click();
  
  uploadArea.ondragover = (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  };
  
  uploadArea.ondragleave = () => {
    uploadArea.classList.remove('dragover');
  };
  
  uploadArea.ondrop = (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      handleFileSelect(file);
    } else {
      toast.error('Please select a .json file');
    }
  };
  
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleFileSelect(file);
  };
  
  function handleFileSelect(file) {
    fileNameSpan.textContent = file.name;
    uploadArea.classList.add('has-file');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      fileContent = e.target.result;
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
      fileContent = null;
    };
    reader.readAsText(file);
  }
  
  document.getElementById('import-egg-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    let eggJson;
    if (currentMethod === 'file') {
      if (!fileContent) {
        toast.error('Please select a file');
        return;
      }
      eggJson = fileContent;
    } else {
      eggJson = form.get('eggJson');
      if (!eggJson || !eggJson.trim()) {
        toast.error('Please paste egg JSON');
        return;
      }
    }
    
    try {
      JSON.parse(eggJson);
    } catch {
      toast.error('Invalid JSON format');
      return;
    }
    
    try {
      const res = await api('/api/admin/eggs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          nest_id: form.get('nest_id'),
          eggJson
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        modal.remove();
        if (typeof loadView === 'function') loadView();
        else if (typeof window.adminNavigate === 'function') window.adminNavigate(state.currentView.tab);
        toast.success('Egg imported successfully');
      } else {
        toast.error(data.error || 'Failed to import egg');
      }
    } catch (e) {
      toast.error('Failed to import egg');
    }
  };
}

window.editNestAdmin = async function(nestId) {
  const res = await api('/api/admin/nests');
  const data = await res.json();
  const nest = data.nests.find(n => n.id === nestId);
  if (nest) {
    // We need to trigger showNestModal. Since we don't have loadView reference here easily,
    // we rely on the modal's save function using adminNavigate or we pass a dummy.
    showNestModal(localStorage.getItem('username'), nest, () => navigateTo('nests'));
  }
};

window.deleteNestAdmin = async function(nestId) {
  const confirmed = await modal.confirm({ title: 'Delete Nest', message: 'Delete this nest and all its eggs?', danger: true });
  if (!confirmed) return;
  
  try {
    await api(`/api/admin/nests/${nestId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    navigateTo('nests');
  } catch (e) {
    toast.error('Failed to delete nest');
  }
};

window.addEggToNestAdmin = async function(nestId) {
  await createNewEgg(nestId);
};

async function createNewEgg(nestId = null) {
  try {
    const res = await api('/api/admin/nests');
    const data = await res.json();
    
    if (!data.nests?.length) {
      toast.error('Create a nest first');
      return;
    }
    
    const targetNestId = nestId || data.nests[0].id;
    
    const egg = {
      name: 'Untitled Egg',
      nest_id: targetNestId,
      description: '',
      author: 'admin@sodium.local',
      docker_images: { 'Default': 'ghcr.io/pterodactyl/yolks:java_17' },
      docker_image: 'ghcr.io/pterodactyl/yolks:java_17',
      startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar',
      config: { stop: 'stop' }
    };
    
    const createRes = await api('/api/admin/eggs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ egg })
    });
    
    const createData = await createRes.json();
    if (createData.egg?.id) {
      navigateTo('eggs', createData.egg.id, 'about');
      toast.info('Configure your new egg');
    } else {
      toast.error(createData.error || 'Failed to create egg');
    }
  } catch (e) {
    toast.error('Failed to create egg');
  }
}

window.editEggAdmin = function(eggId) {
  navigateTo('eggs', eggId);
};

window.deleteEggAdmin = async function(eggId) {
  const confirmed = await modal.confirm({ title: 'Delete Egg', message: 'Delete this egg?', danger: true });
  if (!confirmed) return;
  
  try {
    await api(`/api/admin/eggs/${eggId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    navigateTo('nests');
  } catch (e) {
    toast.error('Failed to delete egg');
  }
};

export async function renderEggDetail(container, username, eggId) {
  try {
    const res = await api(`/api/admin/eggs/${eggId}`);
    const data = await res.json();
    const egg = data.egg;
    
    if (!egg) {
      container.innerHTML = `<div class="error">Egg not found</div>`;
      return;
    }
    
    const nestsRes = await api('/api/admin/nests');
    const nestsData = await nestsRes.json();
    const nests = nestsData.nests || [];
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([
          { label: 'Nests & Eggs', onClick: 'list-nests' },
          { label: egg.name }
        ])}
        <div class="admin-header-actions">
          <button class="btn btn-ghost" id="export-egg-btn">
            <span class="material-icons-outlined">download</span>
            Export
          </button>
          <button class="btn btn-danger" id="delete-egg-btn">
            <span class="material-icons-outlined">delete</span>
            Delete
          </button>
        </div>
      </div>
      
      <div class="detail-tabs">
        <button class="detail-tab ${state.currentView.subTab === 'about' ? 'active' : ''}" data-subtab="about">About</button>
        <button class="detail-tab ${state.currentView.subTab === 'configuration' ? 'active' : ''}" data-subtab="configuration">Configuration</button>
        <button class="detail-tab ${state.currentView.subTab === 'variables' ? 'active' : ''}" data-subtab="variables">Variables</button>
        <button class="detail-tab ${state.currentView.subTab === 'install' ? 'active' : ''}" data-subtab="install">Install Script</button>
      </div>
      
      <div class="detail-content" id="egg-detail-content"></div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.onclick = () => {
        state.currentView.subTab = tab.dataset.subtab;
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderEggSubTab(egg, nests, username);
      };
    });
    
    document.getElementById('delete-egg-btn').onclick = async () => {
      const confirmed = await modal.confirm({ title: 'Delete Egg', message: 'Are you sure you want to delete this egg? This cannot be undone.', danger: true });
      if (!confirmed) return;
      try {
        await api(`/api/admin/eggs/${eggId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        navigateTo('nests');
      } catch (e) {
        toast.error('Failed to delete egg');
      }
    };
    
    document.getElementById('export-egg-btn').onclick = () => {
      const exportData = {
        "_comment": "Exported from Sodium Panel",
        "meta": { "version": "PTDL_v2" },
        "exported_at": new Date().toISOString(),
        "name": egg.name,
        "author": egg.author || "admin@sodium.local",
        "description": egg.description || "",
        "docker_images": egg.docker_images || {},
        "startup": egg.startup,
        "config": egg.config || {},
        "scripts": {
          "installation": {
            "script": egg.install_script || "#!/bin/bash\necho 'No install script'",
            "container": egg.install_container || "alpine:3.18",
            "entrypoint": egg.install_entrypoint || "bash"
          }
        },
        "variables": (egg.variables || []).map(v => ({
          "name": v.name,
          "description": v.description || "",
          "env_variable": v.env_variable,
          "default_value": v.default_value || "",
          "user_viewable": v.user_viewable !== false,
          "user_editable": v.user_editable !== false,
          "rules": v.rules || "nullable|string"
        }))
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `egg-${egg.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Egg exported');
    };
    
    renderEggSubTab(egg, nests, username);
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load egg</div>`;
  }
}

function renderEggSubTab(egg, nests, username) {
  const content = document.getElementById('egg-detail-content');
  
  switch (state.currentView.subTab) {
    case 'about':
      renderEggAboutTab(content, egg, nests, username);
      break;
    case 'configuration':
      renderEggConfigTab(content, egg, username);
      break;
    case 'variables':
      renderEggVariablesTab(content, egg, username);
      break;
    case 'install':
      renderEggInstallTab(content, egg, username);
      break;
    default:
      renderEggAboutTab(content, egg, nests, username);
  }
}

function renderEggAboutTab(content, egg, nests, username) {
  const dockerImagesText = egg.docker_images && typeof egg.docker_images === 'object'
    ? Object.entries(egg.docker_images).map(([k, v]) => `${k}|${v}`).join('\n')
    : egg.docker_image || '';
  
  content.innerHTML = `
    <div class="detail-card detail-card-wide">
      <h3>Egg Information</h3>
      <form id="egg-about-form" class="settings-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${escapeHtml(egg.name)}" required />
          </div>
          <div class="form-group">
            <label>Nest</label>
            <select name="nest_id" required>
              ${nests.map(n => `<option value="${n.id}" ${n.id === egg.nest_id ? 'selected' : ''}>${escapeHtml(n.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3">${escapeHtml(egg.description || '')}</textarea>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Author</label>
            <input type="text" name="author" value="${escapeHtml(egg.author || '')}" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            <input type="text" name="icon" value="${escapeHtml(egg.icon || '')}" placeholder="egg_alt, terminal, or image URL" />
            <p class="form-hint">Material Icon name, image URL, or leave empty for default</p>
          </div>
        </div>
        <div class="form-group">
          <label>UUID</label>
          <input type="text" value="${egg.id}" readonly class="input-readonly" />
        </div>
        <div class="form-group">
          <label>Docker Images</label>
          <p class="form-hint">One per line. Format: Label|image:tag (e.g., Java 17|ghcr.io/pterodactyl/yolks:java_17)</p>
          <textarea name="docker_images" rows="4">${dockerImagesText}</textarea>
        </div>
        <div class="form-toggles">
          <label class="toggle-item">
            <input type="checkbox" name="admin_only" ${egg.admin_only ? 'checked' : ''} />
            <span class="toggle-content">
              <span class="toggle-title">Admin Only</span>
              <span class="toggle-desc">Only administrators can use this egg to create servers</span>
            </span>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('egg-about-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    const dockerImagesRaw = form.get('docker_images');
    const docker_images = {};
    dockerImagesRaw.split('\n').filter(l => l.trim()).forEach(line => {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 2) {
        docker_images[parts[0]] = parts[1];
      } else if (parts[0]) {
        docker_images[parts[0]] = parts[0];
      }
    });
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          egg: {
            name: form.get('name'),
            nest_id: form.get('nest_id'),
            description: form.get('description'),
            author: form.get('author'),
            icon: form.get('icon') || null,
            admin_only: form.get('admin_only') === 'on',
            docker_images,
            docker_image: Object.values(docker_images)[0] || egg.docker_image
          }
        })
      });
      toast.success('Egg updated');
      navigateTo('eggs', egg.id, 'about');
    } catch (e) {
      toast.error('Failed to update egg');
    }
  };
}

function renderEggConfigTab(content, egg, username) {
  const config = egg.config || {};
  const filesConfig = typeof config.files === 'string' ? config.files : JSON.stringify(config.files || {}, null, 2);
  const startupConfig = typeof config.startup === 'string' ? config.startup : JSON.stringify(config.startup || {}, null, 2);
  const logsConfig = typeof config.logs === 'string' ? config.logs : JSON.stringify(config.logs || {}, null, 2);
  
  content.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card detail-card-wide">
        <h3>Startup Configuration</h3>
        <form id="egg-startup-form" class="settings-form">
          <div class="form-group">
            <label>Startup Command</label>
            <p class="form-hint">Use {{VARIABLE}} syntax for environment variables</p>
            <textarea name="startup" rows="3" class="code-textarea">${escapeHtml(egg.startup || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Stop Command</label>
            <p class="form-hint">Command sent to stop the server (e.g., ^C, stop, quit)</p>
            <input type="text" name="stop" value="${escapeHtml(config.stop || '^C')}" />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Startup Config</button>
          </div>
        </form>
      </div>
      
      <div class="detail-card detail-card-wide">
        <h3>Advanced Configuration (JSON)</h3>
        <form id="egg-advanced-form" class="settings-form">
          <div class="form-group">
            <label>Files Configuration</label>
            <p class="form-hint">Configuration file parsing rules</p>
            <textarea name="files" rows="6" class="code-textarea">${escapeHtml(filesConfig)}</textarea>
          </div>
          <div class="form-group">
            <label>Startup Detection</label>
            <p class="form-hint">Pattern to detect when server has started</p>
            <textarea name="startup_config" rows="4" class="code-textarea">${escapeHtml(startupConfig)}</textarea>
          </div>
          <div class="form-group">
            <label>Logs Configuration</label>
            <textarea name="logs" rows="4" class="code-textarea">${escapeHtml(logsConfig)}</textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Advanced Config</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('egg-startup-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          egg: {
            startup: form.get('startup'),
            config: { ...egg.config, stop: form.get('stop') }
          }
        })
      });
      toast.success('Startup config updated');
      navigateTo('eggs', egg.id, 'configuration');
    } catch (e) {
      toast.error('Failed to update config');
    }
  };
  
  document.getElementById('egg-advanced-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    let files, startup_config, logs;
    try {
      files = JSON.parse(form.get('files') || '{}');
      startup_config = JSON.parse(form.get('startup_config') || '{}');
      logs = JSON.parse(form.get('logs') || '{}');
    } catch (err) {
      toast.error('Invalid JSON in configuration');
      return;
    }
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          egg: {
            config: {
              ...egg.config,
              files: JSON.stringify(files),
              startup: JSON.stringify(startup_config),
              logs: JSON.stringify(logs)
            }
          }
        })
      });
      toast.success('Advanced config updated');
      navigateTo('eggs', egg.id, 'configuration');
    } catch (e) {
      toast.error('Failed to update config');
    }
  };
}

function renderEggVariablesTab(content, egg, username) {
  const variables = egg.variables || [];
  
  content.innerHTML = `
    <div class="detail-card detail-card-wide">
      <div class="card-header-flex">
        <h3>Environment Variables</h3>
        <button class="btn btn-primary btn-sm" id="add-variable-btn">
          <span class="material-icons-outlined">add</span>
          Add Variable
        </button>
      </div>
      <p class="card-description">Variables are passed to the server as environment variables and can be used in the startup command with {{VARIABLE}} syntax.</p>
      
      <div class="variables-list" id="variables-list">
        ${variables.length === 0 ? `
          <div class="empty-state small">
            <span class="material-icons-outlined">code</span>
            <p>No variables defined</p>
          </div>
        ` : variables.map((v, idx) => `
          <div class="variable-card" data-index="${idx}">
            <div class="variable-header">
              <div class="variable-title">
                <span class="variable-name">${escapeHtml(v.name)}</span>
                <code class="variable-env">\${${escapeHtml(v.env_variable)}}</code>
              </div>
              <div class="variable-actions">
                <button class="btn btn-xs btn-ghost edit-var-btn" data-index="${idx}">
                  <span class="material-icons-outlined">edit</span>
                </button>
                <button class="btn btn-xs btn-danger delete-var-btn" data-index="${idx}">
                  <span class="material-icons-outlined">delete</span>
                </button>
              </div>
            </div>
            <div class="variable-details">
              <p class="variable-desc">${escapeHtml(v.description || 'No description')}</p>
              <div class="variable-meta">
                <span><strong>Default:</strong> ${escapeHtml(v.default_value || '(empty)')}</span>
                <span><strong>Rules:</strong> ${escapeHtml(v.rules || 'nullable|string')}</span>
              </div>
              <div class="variable-flags">
                ${v.user_viewable !== false ? '<span class="flag success">Viewable</span>' : '<span class="flag">Hidden</span>'}
                ${v.user_editable !== false ? '<span class="flag success">Editable</span>' : '<span class="flag">Locked</span>'}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.getElementById('add-variable-btn').onclick = () => showVariableModal(egg, null, username);
  
  document.querySelectorAll('.edit-var-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      showVariableModal(egg, idx, username);
    };
  });
  
  document.querySelectorAll('.delete-var-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const confirmed = await modal.confirm({ title: 'Delete Variable', message: 'Delete this variable?', danger: true });
      if (!confirmed) return;
      const idx = parseInt(btn.dataset.index);
      const newVars = [...variables];
      newVars.splice(idx, 1);
      
      try {
        await api(`/api/admin/eggs/${egg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ egg: { variables: newVars } })
        });
        toast.success('Variable deleted');
        navigateTo('eggs', egg.id, 'variables');
      } catch (e) {
        toast.error('Failed to delete variable');
      }
    };
  });
}

function showVariableModal(egg, editIndex, username) {
  const isEdit = editIndex !== null;
  const variable = isEdit ? egg.variables[editIndex] : {};
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h2>${isEdit ? 'Edit Variable' : 'Add Variable'}</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="variable-form" class="modal-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${escapeHtml(variable.name || '')}" placeholder="Server Memory" required />
          </div>
          <div class="form-group">
            <label>Environment Variable</label>
            <input type="text" name="env_variable" value="${escapeHtml(variable.env_variable || '')}" placeholder="SERVER_MEMORY" required pattern="[A-Z0-9_]+" title="Uppercase letters, numbers and underscores only" />
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="2" placeholder="Memory allocated to the server in MB">${escapeHtml(variable.description || '')}</textarea>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Default Value</label>
            <input type="text" name="default_value" value="${escapeHtml(variable.default_value || '')}" placeholder="1024" />
          </div>
          <div class="form-group">
            <label>Validation Rules</label>
            <input type="text" name="rules" value="${escapeHtml(variable.rules || 'nullable|string')}" placeholder="required|integer|min:128" />
          </div>
        </div>
        <div class="form-toggles">
          <label class="toggle-item">
            <input type="checkbox" name="user_viewable" ${variable.user_viewable !== false ? 'checked' : ''} />
            <span class="toggle-content">
              <span class="toggle-title">User Viewable</span>
              <span class="toggle-desc">Users can see this variable's value</span>
            </span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" name="user_editable" ${variable.user_editable !== false ? 'checked' : ''} />
            <span class="toggle-content">
              <span class="toggle-title">User Editable</span>
              <span class="toggle-desc">Users can modify this variable's value</span>
            </span>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('variable-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    const newVar = {
      name: form.get('name'),
      env_variable: form.get('env_variable').toUpperCase(),
      description: form.get('description'),
      default_value: form.get('default_value'),
      rules: form.get('rules') || 'nullable|string',
      user_viewable: form.get('user_viewable') === 'on',
      user_editable: form.get('user_editable') === 'on'
    };
    
    const newVars = [...(egg.variables || [])];
    if (isEdit) {
      newVars[editIndex] = newVar;
    } else {
      newVars.push(newVar);
    }
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ egg: { variables: newVars } })
      });
      modal.remove();
      toast.success(isEdit ? 'Variable updated' : 'Variable added');
      navigateTo('eggs', egg.id, 'variables');
    } catch (e) {
      toast.error('Failed to save variable');
    }
  };
}

function renderEggInstallTab(content, egg, username) {
  content.innerHTML = `
    <div class="detail-card detail-card-wide">
      <h3>Install Script</h3>
      <p class="card-description">This script runs when a server is first created to set up the environment.</p>
      <form id="egg-install-form" class="settings-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Install Container</label>
            <p class="form-hint">Docker image used to run the install script</p>
            <input type="text" name="install_container" value="${escapeHtml(egg.install_container || 'alpine:3.18')}" />
          </div>
          <div class="form-group">
            <label>Install Entrypoint</label>
            <p class="form-hint">Command used to run the script (e.g., bash, ash, sh)</p>
            <input type="text" name="install_entrypoint" value="${escapeHtml(egg.install_entrypoint || 'bash')}" />
          </div>
        </div>
        <div class="form-group">
          <label>Install Script</label>
          <p class="form-hint">Shell script executed during server installation. Files are stored in /mnt/server</p>
          <textarea name="install_script" rows="20" class="code-textarea">${escapeHtml(egg.install_script || '#!/bin/bash\ncd /mnt/server\necho "No install script configured"')}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Install Script</button>
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('egg-install-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          egg: {
            install_container: form.get('install_container'),
            install_entrypoint: form.get('install_entrypoint'),
            install_script: form.get('install_script')
          }
        })
      });
      toast.success('Install script updated');
      navigateTo('eggs', egg.id, 'install');
    } catch (e) {
      toast.error('Failed to update install script');
    }
  };
}
