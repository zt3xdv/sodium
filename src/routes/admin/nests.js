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
      ${renderAdminSidebar('nests')}
      <main class="admin-content">
        <div class="admin-header">
          <div>
            <h1>Nests</h1>
            <p class="text-secondary">Organize eggs into categories</p>
          </div>
          <button class="btn btn-primary" id="btn-new-nest">
            ${icon('plus', 18)} New Nest
          </button>
        </div>

        <div class="nests-grid" id="nests-grid">
          <div class="loading">Loading nests...</div>
        </div>
      </main>
    </div>
  `;
}

export async function mount() {
  const nestsGrid = document.getElementById('nests-grid');
  let nests = [];

  async function loadNests() {
    try {
      const res = await api.get('/admin/nests');
      nests = res.data || [];
      renderNests();
    } catch (err) {
      toast.error('Failed to load nests');
      nestsGrid.innerHTML = '<div class="empty-state">Failed to load nests</div>';
    }
  }

  function renderNests() {
    if (nests.length === 0) {
      nestsGrid.innerHTML = `
        <div class="empty-state">
          ${icon('folder', 48)}
          <h3>No nests configured</h3>
          <p class="text-secondary">Create a nest to organize your eggs</p>
          <button class="btn btn-primary" id="empty-new">${icon('plus', 18)} New Nest</button>
        </div>
      `;
      document.getElementById('empty-new')?.addEventListener('click', () => showNestModal());
      return;
    }

    nestsGrid.innerHTML = nests.map(nest => `
      <div class="nest-card card" data-id="${nest.id}">
        <div class="nest-header">
          <div class="nest-icon">${icon('folder', 24)}</div>
          <div class="nest-info">
            <h3>${escapeHtml(nest.name)}</h3>
            <p class="text-secondary text-sm">${escapeHtml(nest.description || 'No description')}</p>
          </div>
          <div class="nest-actions">
            <button class="btn btn-ghost btn-sm edit-btn" title="Edit">${icon('edit', 14)}</button>
            <button class="btn btn-ghost btn-sm delete-btn" title="Delete">${icon('trash', 14)}</button>
          </div>
        </div>
        <div class="nest-stats">
          <div class="nest-stat">
            <span class="stat-value">${nest.egg_count || 0}</span>
            <span class="stat-label">Eggs</span>
          </div>
          <div class="nest-stat">
            <span class="stat-value">${nest.server_count || 0}</span>
            <span class="stat-label">Servers</span>
          </div>
        </div>
        <div class="nest-footer">
          <a href="#/admin/eggs?nest=${nest.id}" class="btn btn-ghost btn-sm">
            ${icon('package', 14)} View Eggs
          </a>
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
        const id = btn.closest('.nest-card').dataset.id;
        const nest = nests.find(n => n.id == id);
        showNestModal(nest);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.closest('.nest-card').dataset.id;
        const nest = nests.find(n => n.id == id);
        await deleteNest(nest);
      });
    });
  }

  function showNestModal(nest = null) {
    const isEdit = !!nest;

    openModal({
      title: isEdit ? 'Edit Nest' : 'New Nest',
      content: `
        <form id="nest-form">
          <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" class="input" value="${escapeHtml(nest?.name || '')}" 
                   placeholder="e.g., Minecraft" required>
          </div>
          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" class="input" rows="3" 
                      placeholder="A collection of Minecraft-related eggs">${escapeHtml(nest?.description || '')}</textarea>
          </div>
        </form>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: isEdit ? 'Save' : 'Create', class: 'btn-primary', action: async () => {
          const data = {
            name: document.getElementById('name').value.trim(),
            description: document.getElementById('description').value.trim()
          };

          if (!data.name) {
            toast.error('Name is required');
            return;
          }

          try {
            if (isEdit) {
              await api.put(`/admin/nests/${nest.id}`, data);
              toast.success('Nest updated');
            } else {
              await api.post('/admin/nests', data);
              toast.success('Nest created');
            }
            closeModal();
            loadNests();
          } catch (err) {
            toast.error(err.message || 'Failed to save nest');
          }
        }}
      ]
    });
  }

  async function deleteNest(nest) {
    if (nest.egg_count > 0) {
      toast.error('Cannot delete nest with eggs. Move or delete eggs first.');
      return;
    }

    const confirmed = await confirmModal('Delete Nest', `Delete "${nest.name}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`/admin/nests/${nest.id}`);
      toast.success('Nest deleted');
      loadNests();
    } catch (err) {
      toast.error(err.message || 'Failed to delete nest');
    }
  }

  document.getElementById('btn-new-nest').addEventListener('click', () => showNestModal());

  await loadNests();
}
