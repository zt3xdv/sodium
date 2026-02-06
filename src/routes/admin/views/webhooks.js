import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import * as modal from '../../../utils/modal.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { renderBreadcrumb, setupBreadcrumbListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

const WEBHOOK_TYPES = [
  { id: 'discord', label: 'Discord', icon: 'smart_toy' },
  { id: 'slack', label: 'Slack', icon: 'tag' },
  { id: 'generic', label: 'Generic', icon: 'webhook' }
];

const EVENT_CATEGORIES = {
  'Server Events': [
    { id: 'server.created', label: 'Server Created' },
    { id: 'server.deleted', label: 'Server Deleted' },
    { id: 'server.started', label: 'Server Started' },
    { id: 'server.stopped', label: 'Server Stopped' },
    { id: 'server.crashed', label: 'Server Crashed' },
    { id: 'server.suspended', label: 'Server Suspended' },
    { id: 'server.unsuspended', label: 'Server Unsuspended' }
  ],
  'User Events': [
    { id: 'user.created', label: 'User Created' },
    { id: 'user.deleted', label: 'User Deleted' },
    { id: 'user.login', label: 'User Login' }
  ],
  'Admin Events': [
    { id: 'node.created', label: 'Node Created' },
    { id: 'node.deleted', label: 'Node Deleted' },
    { id: 'announcement.created', label: 'Announcement Created' }
  ]
};

export async function renderWebhooksList(container, username, loadView) {
  try {
    const res = await api('/api/webhooks/admin/all');
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      container.innerHTML = `<div class="error">${escapeHtml(errData.error || 'Failed to load webhooks')}</div>`;
      return;
    }
    
    const data = await res.json();
    const webhooks = data.webhooks || [];
    
    const globalWebhooks = webhooks.filter(w => w.global || !w.user_id);
    const userWebhooks = webhooks.filter(w => w.user_id && !w.global);
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Webhooks' }])}
        <div class="admin-header-actions">
          <button class="btn btn-primary" id="create-webhook-btn">
            <span class="material-icons-outlined">add</span>
            Create Global Webhook
          </button>
        </div>
      </div>
      
      <div class="admin-list">
        <div class="webhooks-section">
          <h3 class="section-title">
            <span class="material-icons-outlined">public</span>
            Global Webhooks
          </h3>
          ${globalWebhooks.length === 0 ? `
            <div class="empty-state small">
              <span class="material-icons-outlined">webhook</span>
              <p>No global webhooks configured</p>
            </div>
          ` : `
            <div class="webhook-cards">
              ${globalWebhooks.map(w => renderWebhookCard(w, true)).join('')}
            </div>
          `}
        </div>
        
        <div class="webhooks-section">
          <h3 class="section-title">
            <span class="material-icons-outlined">person</span>
            User Webhooks
          </h3>
          ${userWebhooks.length === 0 ? `
            <div class="empty-state small">
              <span class="material-icons-outlined">webhook</span>
              <p>No user webhooks</p>
            </div>
          ` : `
            <div class="webhook-cards">
              ${userWebhooks.map(w => renderWebhookCard(w, false)).join('')}
            </div>
          `}
        </div>
      </div>
      
      ${renderWebhookModal()}
    `;
    
    setupBreadcrumbListeners(navigateTo);
    setupWebhookListeners(webhooks, loadView);
    
  } catch (e) {
    container.innerHTML = '<div class="error">Failed to load webhooks</div>';
  }
}

function renderWebhookCard(webhook, isGlobal) {
  const typeInfo = WEBHOOK_TYPES.find(t => t.id === webhook.type) || WEBHOOK_TYPES[2];
  const eventsDisplay = webhook.events.includes('*') 
    ? 'All Events' 
    : `${webhook.events.length} event${webhook.events.length !== 1 ? 's' : ''}`;
  
  return `
    <div class="webhook-card ${!webhook.enabled ? 'disabled' : ''}">
      <div class="webhook-card-header">
        <div class="webhook-info">
          <span class="webhook-type-icon material-icons-outlined">${typeInfo.icon}</span>
          <div class="webhook-details">
            <span class="webhook-name">${escapeHtml(webhook.name)}</span>
            <span class="webhook-url">${escapeHtml(webhook.url)}</span>
          </div>
        </div>
        <div class="webhook-status">
          <span class="status-badge ${webhook.enabled ? 'active' : 'inactive'}">
            ${webhook.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>
      <div class="webhook-card-body">
        <div class="webhook-meta">
          <span class="meta-item">
            <span class="material-icons-outlined">category</span>
            ${typeInfo.label}
          </span>
          <span class="meta-item">
            <span class="material-icons-outlined">notifications</span>
            ${eventsDisplay}
          </span>
          ${!isGlobal && webhook.user_id ? `
            <span class="meta-item">
              <span class="material-icons-outlined">person</span>
              User: ${escapeHtml(webhook.user_id.substring(0, 8))}
            </span>
          ` : ''}
        </div>
      </div>
      <div class="webhook-card-footer">
        <button class="btn btn-xs btn-ghost" onclick="testWebhook('${webhook.id}')">
          <span class="material-icons-outlined">send</span>
          Test
        </button>
        ${isGlobal ? `
          <button class="btn btn-xs btn-ghost" onclick="editWebhook('${webhook.id}')">
            <span class="material-icons-outlined">edit</span>
            Edit
          </button>
        ` : ''}
        <button class="btn btn-xs btn-danger-ghost" onclick="deleteWebhook('${webhook.id}')">
          <span class="material-icons-outlined">delete</span>
          Delete
        </button>
      </div>
    </div>
  `;
}

function renderWebhookModal() {
  return `
    <div class="modal" id="webhook-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3 id="webhook-modal-title">Create Global Webhook</h3>
          <button class="modal-close" onclick="closeWebhookModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Name</label>
              <input type="text" id="webhook-name" class="form-control" placeholder="My Webhook">
            </div>
            <div class="form-group">
              <label>Type</label>
              <select id="webhook-type" class="form-control">
                ${WEBHOOK_TYPES.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label>Webhook URL</label>
            <input type="url" id="webhook-url" class="form-control" placeholder="https://discord.com/api/webhooks/...">
            <small class="form-hint">For Discord, use the webhook URL from channel settings</small>
          </div>
          
          <div class="form-group">
            <label>Secret (optional)</label>
            <input type="password" id="webhook-secret" class="form-control" placeholder="Leave blank for no secret">
            <small class="form-hint">Sent as X-Webhook-Secret header (not used for Discord/Slack)</small>
          </div>
          
          <div class="form-group">
            <label>Events</label>
            <div class="events-selector">
              <label class="toggle-item all-events">
                <input type="checkbox" id="webhook-all-events">
                <span class="toggle-content">
                  <span class="toggle-title">All Events</span>
                  <span class="toggle-desc">Subscribe to all current and future events</span>
                </span>
              </label>
              
              <div class="events-grid" id="events-grid">
                ${Object.entries(EVENT_CATEGORIES).map(([category, events]) => `
                  <div class="event-category">
                    <h4>${category}</h4>
                    ${events.map(e => `
                      <label class="event-checkbox">
                        <input type="checkbox" name="webhook-event" value="${e.id}">
                        <span>${e.label}</span>
                      </label>
                    `).join('')}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label class="toggle-item">
              <input type="checkbox" id="webhook-enabled" checked>
              <span class="toggle-content">
                <span class="toggle-title">Enabled</span>
                <span class="toggle-desc">Webhook will receive events when enabled</span>
              </span>
            </label>
          </div>
          
          <div class="message" id="webhook-message"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeWebhookModal()">Cancel</button>
          <button class="btn btn-primary" id="save-webhook-btn">Save Webhook</button>
        </div>
      </div>
    </div>
  `;
}

function setupWebhookListeners(webhooks, loadView) {
  let editingId = null;
  
  document.getElementById('create-webhook-btn').onclick = () => {
    editingId = null;
    document.getElementById('webhook-modal-title').textContent = 'Create Global Webhook';
    document.getElementById('webhook-name').value = '';
    document.getElementById('webhook-type').value = 'discord';
    document.getElementById('webhook-url').value = '';
    document.getElementById('webhook-secret').value = '';
    document.getElementById('webhook-enabled').checked = true;
    document.getElementById('webhook-all-events').checked = false;
    document.querySelectorAll('input[name="webhook-event"]').forEach(cb => cb.checked = false);
    document.getElementById('events-grid').classList.remove('disabled');
    document.getElementById('webhook-modal').classList.add('active');
  };
  
  document.getElementById('webhook-all-events').onchange = (e) => {
    const eventsGrid = document.getElementById('events-grid');
    if (e.target.checked) {
      eventsGrid.classList.add('disabled');
      document.querySelectorAll('input[name="webhook-event"]').forEach(cb => cb.checked = false);
    } else {
      eventsGrid.classList.remove('disabled');
    }
  };
  
  window.closeWebhookModal = () => {
    document.getElementById('webhook-modal').classList.remove('active');
  };
  
  window.editWebhook = (id) => {
    const webhook = webhooks.find(w => w.id === id);
    if (!webhook) return;
    
    editingId = id;
    document.getElementById('webhook-modal-title').textContent = 'Edit Webhook';
    document.getElementById('webhook-name').value = webhook.name;
    document.getElementById('webhook-type').value = webhook.type;
    document.getElementById('webhook-url').value = '';
    document.getElementById('webhook-secret').value = '';
    document.getElementById('webhook-enabled').checked = webhook.enabled;
    
    const allEvents = webhook.events.includes('*');
    document.getElementById('webhook-all-events').checked = allEvents;
    document.getElementById('events-grid').classList.toggle('disabled', allEvents);
    
    document.querySelectorAll('input[name="webhook-event"]').forEach(cb => {
      cb.checked = webhook.events.includes(cb.value);
    });
    
    document.getElementById('webhook-modal').classList.add('active');
  };
  
  window.deleteWebhook = async (id) => {
    const confirmed = await modal.confirm({ title: 'Delete Webhook', message: 'Are you sure you want to delete this webhook?', danger: true });
    if (!confirmed) return;
    
    try {
      const res = await api(`/api/webhooks/admin/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Webhook deleted');
        if (typeof loadView === 'function') loadView();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete webhook');
      }
    } catch (e) {
      toast.error('Failed to delete webhook');
    }
  };
  
  window.testWebhook = async (id) => {
    toast.info('Sending test webhook...');
    try {
      const res = await api(`/api/webhooks/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Test webhook sent');
      } else {
        toast.error(data.error || 'Test failed');
      }
    } catch (e) {
      toast.error('Failed to send test webhook');
    }
  };
  
  document.getElementById('save-webhook-btn').onclick = async () => {
    const name = document.getElementById('webhook-name').value.trim();
    const type = document.getElementById('webhook-type').value;
    const url = document.getElementById('webhook-url').value.trim();
    const secret = document.getElementById('webhook-secret').value;
    const enabled = document.getElementById('webhook-enabled').checked;
    const allEvents = document.getElementById('webhook-all-events').checked;
    const messageEl = document.getElementById('webhook-message');
    
    const selectedEvents = allEvents 
      ? ['*'] 
      : Array.from(document.querySelectorAll('input[name="webhook-event"]:checked')).map(cb => cb.value);
    
    if (!name) {
      messageEl.textContent = 'Name is required';
      messageEl.className = 'message error';
      return;
    }
    
    if (!editingId && !url) {
      messageEl.textContent = 'URL is required';
      messageEl.className = 'message error';
      return;
    }
    
    if (selectedEvents.length === 0) {
      messageEl.textContent = 'Select at least one event';
      messageEl.className = 'message error';
      return;
    }
    
    try {
      const body = { name, type, events: selectedEvents, enabled };
      if (url) body.url = url;
      if (secret) body.secret = secret;
      
      const method = editingId ? 'PUT' : 'POST';
      const endpoint = editingId ? `/api/webhooks/${editingId}` : '/api/webhooks/admin';
      
      const res = await api(endpoint, {
        method,
        body: JSON.stringify(body)
      });
      
      const result = await res.json();
      
      if (result.error) {
        messageEl.textContent = result.error;
        messageEl.className = 'message error';
      } else {
        closeWebhookModal();
        if (typeof loadView === 'function') loadView();
        toast.success(editingId ? 'Webhook updated' : 'Webhook created');
      }
    } catch (e) {
      messageEl.textContent = 'Failed to save webhook';
      messageEl.className = 'message error';
    }
  };
}
