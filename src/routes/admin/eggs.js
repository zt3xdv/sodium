import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function() {
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('eggs')}
      <main class="admin-content">
        <div class="admin-header">
          <div>
            <h1>Eggs</h1>
            <p class="text-secondary">Manage server configurations</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-ghost" id="btn-import">
              ${icon('upload', 18)} Import
            </button>
            <button class="btn btn-primary" id="btn-new-egg">
              ${icon('plus', 18)} New Egg
            </button>
          </div>
        </div>

        <div class="eggs-grid" id="eggs-grid">
          <div class="loading">Loading eggs...</div>
        </div>

        <input type="file" id="import-input" accept=".json" hidden>
      </main>
    </div>
  `;
}

export async function mount() {
  const eggsGrid = document.getElementById('eggs-grid');
  const importInput = document.getElementById('import-input');
  let eggs = [];

  async function loadEggs() {
    try {
      const res = await api.get('/admin/eggs');
      eggs = res.data || [];
      renderEggs();
    } catch (err) {
      toast.error('Failed to load eggs');
      eggsGrid.innerHTML = '<div class="empty-state">Failed to load eggs</div>';
    }
  }

  function renderEggs() {
    const headerActions = document.querySelector('.header-actions');
    
    if (eggs.length === 0) {
      if (headerActions) headerActions.style.display = 'none';
      eggsGrid.innerHTML = `
        <div class="empty-state">
          ${icon('package', 48)}
          <h3>No eggs configured</h3>
          <p class="text-secondary">Create or import an egg to get started</p>
          <div class="empty-actions">
            <button class="btn btn-ghost" id="empty-import">${icon('upload', 18)} Import</button>
            <button class="btn btn-primary" id="empty-new">${icon('plus', 18)} New Egg</button>
          </div>
        </div>
      `;
      document.getElementById('empty-import')?.addEventListener('click', () => importInput.click());
      document.getElementById('empty-new')?.addEventListener('click', () => showEggModal());
      return;
    }
    
    if (headerActions) headerActions.style.display = 'flex';

    eggsGrid.innerHTML = eggs.map(egg => `
      <div class="egg-card card" data-id="${egg.id}">
        <div class="egg-header">
          <div class="egg-icon">${icon('package', 24)}</div>
          <div class="egg-info">
            <h3>${escapeHtml(egg.name)}</h3>
            <p class="text-secondary text-sm">${escapeHtml(egg.description || 'No description')}</p>
          </div>
        </div>
        <div class="egg-details">
          <div class="egg-detail">
            <span class="label">Docker Images</span>
            <span class="value">${(egg.docker_images || []).length}</span>
          </div>
          <div class="egg-detail">
            <span class="label">Variables</span>
            <span class="value">${(egg.variables || []).length}</span>
          </div>
        </div>
        <div class="egg-startup font-mono text-xs">
          ${escapeHtml((egg.startup || '').substring(0, 80))}${(egg.startup || '').length > 80 ? '...' : ''}
        </div>
        <div class="egg-actions">
          <button class="btn btn-ghost btn-sm export-btn" title="Export">
            ${icon('download', 14)}
          </button>
          <button class="btn btn-ghost btn-sm edit-btn" title="Edit">
            ${icon('edit', 14)}
          </button>
          <button class="btn btn-ghost btn-sm delete-btn" title="Delete">
            ${icon('trash', 14)}
          </button>
        </div>
      </div>
    `).join('');

    attachListeners();
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function attachListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.egg-card').dataset.id;
        const egg = eggs.find(e => e.id == id);
        showEggModal(egg);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.closest('.egg-card').dataset.id;
        const egg = eggs.find(e => e.id == id);
        await deleteEgg(egg);
      });
    });

    document.querySelectorAll('.export-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.egg-card').dataset.id;
        const egg = eggs.find(e => e.id == id);
        exportEgg(egg);
      });
    });
  }

  function showEggModal(egg = null) {
    const isEdit = !!egg;
    const dockerImages = (egg?.docker_images || []).join('\n');
    const variables = JSON.stringify(egg?.variables || [], null, 2);

    openModal({
      title: isEdit ? `Edit: ${egg.name}` : 'New Egg',
      size: 'large',
      content: `
        <div class="tabs" id="egg-tabs">
          <button class="tab active" data-tab="basic">Basic</button>
          <button class="tab" data-tab="docker">Docker</button>
          <button class="tab" data-tab="startup">Startup</button>
          <button class="tab" data-tab="variables">Variables</button>
        </div>
        <form id="egg-form">
          <div class="tab-content active" data-tab="basic">
            <div class="form-group">
              <label for="name">Name</label>
              <input type="text" id="name" class="input" value="${escapeHtml(egg?.name || '')}" required>
            </div>
            <div class="form-group">
              <label for="description">Description</label>
              <textarea id="description" class="input" rows="3">${escapeHtml(egg?.description || '')}</textarea>
            </div>
          </div>
          <div class="tab-content" data-tab="docker">
            <div class="form-group">
              <label for="docker_images">Docker Images (one per line)</label>
              <textarea id="docker_images" class="input font-mono" rows="5" placeholder="ghcr.io/example/image:latest">${escapeHtml(dockerImages)}</textarea>
            </div>
          </div>
          <div class="tab-content" data-tab="startup">
            <div class="form-group">
              <label for="startup">Startup Command</label>
              <textarea id="startup" class="input font-mono" rows="4" placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar">${escapeHtml(egg?.startup || '')}</textarea>
              <p class="form-hint">Use {{VARIABLE_NAME}} for dynamic values</p>
            </div>
          </div>
          <div class="tab-content" data-tab="variables">
            <div class="form-group">
              <label for="variables">Variables (JSON)</label>
              <textarea id="variables" class="input font-mono" rows="10">${escapeHtml(variables)}</textarea>
              <p class="form-hint">Array of objects with: name, description, env_variable, default_value, rules</p>
            </div>
          </div>
        </form>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: isEdit ? 'Save' : 'Create', class: 'btn-primary', action: async () => {
          const dockerImagesText = document.getElementById('docker_images').value;
          let variablesJson = [];
          try {
            variablesJson = JSON.parse(document.getElementById('variables').value || '[]');
          } catch (e) {
            toast.error('Invalid JSON in variables');
            return;
          }

          const data = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            docker_images: dockerImagesText.split('\n').map(s => s.trim()).filter(Boolean),
            startup: document.getElementById('startup').value,
            variables: variablesJson
          };

          try {
            if (isEdit) {
              await api.put(`/admin/eggs/${egg.id}`, data);
              toast.success('Egg updated');
            } else {
              await api.post('/admin/eggs', data);
              toast.success('Egg created');
            }
            closeModal();
            loadEggs();
          } catch (err) {
            toast.error(err.message || 'Failed to save egg');
          }
        }}
      ]
    });

    setTimeout(() => {
      document.querySelectorAll('#egg-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('#egg-tabs .tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          document.querySelector(`.tab-content[data-tab="${tab.dataset.tab}"]`)?.classList.add('active');
        });
      });
    }, 100);
  }

  async function deleteEgg(egg) {
    const confirmed = await confirmModal('Delete Egg', `Delete "${egg.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await api.delete(`/admin/eggs/${egg.id}`);
      toast.success('Egg deleted');
      loadEggs();
    } catch (err) {
      toast.error(err.message || 'Failed to delete egg');
    }
  }

  function exportEgg(egg) {
    const data = JSON.stringify(egg, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${egg.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Egg exported');
  }

  async function importEgg(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      delete data.id;
      delete data.uuid;
      delete data.created_at;

      // Convertir docker_images de objeto a array si es necesario
      if (data.docker_images && typeof data.docker_images === 'object' && !Array.isArray(data.docker_images)) {
        data.docker_images = Object.values(data.docker_images);
      }

      await api.post('/admin/eggs', data);
      toast.success('Egg imported');
      loadEggs();
    } catch (err) {
      toast.error('Failed to import egg: ' + (err.message || String(err)));
    }
  }

  document.getElementById('btn-new-egg').addEventListener('click', () => showEggModal());
  document.getElementById('btn-import').addEventListener('click', () => importInput.click());
  
  importInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importEgg(e.target.files[0]);
      e.target.value = '';
    }
  });

  await loadEggs();
}
