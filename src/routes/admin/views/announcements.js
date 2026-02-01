import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { renderBreadcrumb, setupBreadcrumbListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

export async function renderAnnouncementsList(container, username, loadView) {
  try {
    const res = await api('/api/announcements');
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      container.innerHTML = `<div class="error">${escapeHtml(errData.error || 'Failed to load announcements')}</div>`;
      return;
    }
    
    const data = await res.json();
    const announcements = data.announcements || [];
    
    const tableRows = announcements.map(a => {
      const content = a.content || '';
      const title = a.title || 'Untitled';
      const type = a.type || 'info';
      const createdAt = a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '--';
      return `
        <tr>
          <td>
            <div class="cell-main">${escapeHtml(title)}</div>
            <div class="cell-sub">${escapeHtml(content.substring(0, 50))}${content.length > 50 ? '...' : ''}</div>
          </td>
          <td><span class="type-badge type-${type}">${type}</span></td>
          <td><span class="status-badge ${a.active ? 'active' : 'inactive'}">${a.active ? 'Active' : 'Inactive'}</span></td>
          <td>${createdAt}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-xs btn-ghost" onclick="editAnnouncement('${a.id}')">Edit</button>
              <button class="btn btn-xs btn-danger-ghost" onclick="deleteAnnouncement('${a.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Announcements' }])}
        <div class="admin-header-actions">
          <button class="btn btn-primary" id="create-announcement-btn">
            <span class="material-icons-outlined">add</span>
            Create Announcement
          </button>
        </div>
      </div>
      
      <div class="admin-list">
        ${announcements.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">campaign</span>
            <p>No announcements yet</p>
          </div>
        ` : `
          <div class="list-table">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
          
          <div class="list-cards">
            ${announcements.map(a => {
              const content = a.content || '';
              const title = a.title || 'Untitled';
              const type = a.type || 'info';
              return `
              <div class="list-card">
                <div class="list-card-header">
                  <div class="list-card-title">${escapeHtml(title)}</div>
                  <span class="type-badge type-${type}">${type}</span>
                </div>
                <div class="list-card-body">
                  <p>${escapeHtml(content.substring(0, 100))}${content.length > 100 ? '...' : ''}</p>
                </div>
                <div class="list-card-footer">
                  <span class="status-badge ${a.active ? 'active' : 'inactive'}">${a.active ? 'Active' : 'Inactive'}</span>
                  <div class="action-buttons">
                    <button class="btn btn-xs btn-ghost" onclick="editAnnouncement('${a.id}')">Edit</button>
                    <button class="btn btn-xs btn-danger-ghost" onclick="deleteAnnouncement('${a.id}')">Delete</button>
                  </div>
                </div>
              </div>
            `}).join('')}
          </div>
        `}
      </div>
      
      <div class="modal" id="announcement-modal">
        <div class="modal-backdrop"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="announcement-modal-title">Create Announcement</h3>
            <button class="modal-close" onclick="closeAnnouncementModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Title</label>
              <input type="text" id="announcement-title" class="form-control" placeholder="Announcement title">
            </div>
            <div class="form-group">
              <label>Content</label>
              <textarea id="announcement-content" class="form-control" rows="4" placeholder="Announcement content"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Type</label>
                <select id="announcement-type" class="form-control">
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                  <option value="danger">Danger</option>
                </select>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select id="announcement-active" class="form-control">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Expires At (optional)</label>
              <input type="datetime-local" id="announcement-expires" class="form-control">
            </div>
            <div class="message" id="announcement-message"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeAnnouncementModal()">Cancel</button>
            <button class="btn btn-primary" id="save-announcement-btn">Save</button>
          </div>
        </div>
      </div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
    let editingId = null;
    
    document.getElementById('create-announcement-btn').onclick = () => {
      editingId = null;
      document.getElementById('announcement-modal-title').textContent = 'Create Announcement';
      document.getElementById('announcement-title').value = '';
      document.getElementById('announcement-content').value = '';
      document.getElementById('announcement-type').value = 'info';
      document.getElementById('announcement-active').value = 'true';
      document.getElementById('announcement-expires').value = '';
      document.getElementById('announcement-modal').classList.add('active');
    };
    
    window.closeAnnouncementModal = () => {
      document.getElementById('announcement-modal').classList.remove('active');
    };
    
    window.editAnnouncement = (id) => {
      const announcement = announcements.find(a => a.id === id);
      if (!announcement) return;
      
      editingId = id;
      document.getElementById('announcement-modal-title').textContent = 'Edit Announcement';
      document.getElementById('announcement-title').value = announcement.title;
      document.getElementById('announcement-content').value = announcement.content;
      document.getElementById('announcement-type').value = announcement.type;
      document.getElementById('announcement-active').value = String(announcement.active);
      document.getElementById('announcement-expires').value = announcement.expiresAt ? announcement.expiresAt.slice(0, 16) : '';
      document.getElementById('announcement-modal').classList.add('active');
    };
    
    window.deleteAnnouncement = async (id) => {
      if (!confirm('Are you sure you want to delete this announcement?')) return;
      
      try {
        await api(`/api/announcements/${id}`, { method: 'DELETE' });
        // We assume loadView refreshes or adminNavigate does
        if (typeof loadView === 'function') loadView();
        else if (typeof window.adminNavigate === 'function') window.adminNavigate(state.currentView.tab);
        toast.success('Announcement deleted');
      } catch (e) {
        toast.error('Failed to delete announcement');
      }
    };
    
    document.getElementById('save-announcement-btn').onclick = async () => {
      const title = document.getElementById('announcement-title').value.trim();
      const content = document.getElementById('announcement-content').value.trim();
      const type = document.getElementById('announcement-type').value;
      const active = document.getElementById('announcement-active').value === 'true';
      const expiresAt = document.getElementById('announcement-expires').value || null;
      const messageEl = document.getElementById('announcement-message');
      
      if (!title || !content) {
        messageEl.textContent = 'Title and content are required';
        messageEl.className = 'message error';
        return;
      }
      
      try {
        const method = editingId ? 'PUT' : 'POST';
        const url = editingId ? `/api/announcements/${editingId}` : '/api/announcements';
        
        const res = await api(url, {
          method,
          body: JSON.stringify({ title, content, type, active, expiresAt })
        });
        
        const result = await res.json();
        
        if (result.error) {
          messageEl.textContent = result.error;
          messageEl.className = 'message error';
        } else {
          closeAnnouncementModal();
          if (typeof loadView === 'function') loadView();
          else if (typeof window.adminNavigate === 'function') window.adminNavigate(state.currentView.tab);
          toast.success(editingId ? 'Announcement updated' : 'Announcement created');
        }
      } catch (e) {
        messageEl.textContent = 'Failed to save announcement';
        messageEl.className = 'message error';
      }
    };
    
  } catch (e) {
    container.innerHTML = '<div class="error">Failed to load announcements</div>';
  }
}
