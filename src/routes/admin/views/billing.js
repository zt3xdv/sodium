import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { renderPagination, setupPaginationListeners, renderBreadcrumb, setupBreadcrumbListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

export async function renderBillingList(container, username, loadView) {
  try {
    const [configRes, plansRes] = await Promise.all([
      api('/api/billing/config'),
      api('/api/billing/admin/plans')
    ]);
    const config = await configRes.json();
    const plansData = await plansRes.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Billing' }])}
        <div class="admin-header-actions">
          <button class="btn btn-primary" id="create-plan-btn">
            <span class="material-icons-outlined">add</span>
            Create Plan
          </button>
        </div>
      </div>
      
      <div class="billing-status-card ${config.enabled ? 'enabled' : 'disabled'}">
        <div class="billing-status-icon">
          <span class="material-icons-outlined">${config.enabled ? 'payments' : 'money_off'}</span>
        </div>
        <div class="billing-status-info">
          <h3>Billing System</h3>
          <p>${config.enabled ? 'Billing is enabled. Users can subscribe to plans.' : 'Billing is disabled. Enable it in settings.'}</p>
        </div>
        <button class="btn btn-ghost" onclick="adminNavigate('billing', null, 'settings')">
          <span class="material-icons-outlined">settings</span>
          Settings
        </button>
      </div>
      
      <div class="detail-tabs">
        <button class="detail-tab ${state.currentView.subTab === 'plans' || !state.currentView.subTab ? 'active' : ''}" data-subtab="plans">Plans</button>
        <button class="detail-tab ${state.currentView.subTab === 'subscriptions' ? 'active' : ''}" data-subtab="subscriptions">Subscriptions</button>
        <button class="detail-tab ${state.currentView.subTab === 'payments' ? 'active' : ''}" data-subtab="payments">Payments</button>
        <button class="detail-tab ${state.currentView.subTab === 'settings' ? 'active' : ''}" data-subtab="settings">Settings</button>
      </div>
      
      <div class="billing-content" id="billing-content"></div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.onclick = () => {
        state.currentView.subTab = tab.dataset.subtab;
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderBillingSubTab(plansData.plans, config, loadView);
      };
    });
    
    document.getElementById('create-plan-btn').onclick = () => showPlanModal(null, loadView);
    
    if (!state.currentView.subTab) state.currentView.subTab = 'plans';
    renderBillingSubTab(plansData.plans, config, loadView);
    
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="error">Failed to load billing</div>`;
  }
}

async function renderBillingSubTab(plans, config, loadView) {
  const content = document.getElementById('billing-content');
  if (!content) return;
  
  switch (state.currentView.subTab) {
    case 'plans':
      content.innerHTML = `
        <div class="plans-grid">
          ${plans.length === 0 ? `
            <div class="empty-state">
              <span class="material-icons-outlined">shopping_cart</span>
              <p>No plans created yet</p>
            </div>
          ` : plans.map(plan => `
            <div class="plan-card ${plan.popular ? 'popular' : ''}" data-id="${plan.id}">
              ${plan.popular ? '<div class="popular-badge">Popular</div>' : ''}
              <div class="plan-header">
                <h3>${escapeHtml(plan.name)}</h3>
                <div class="plan-price">
                  <span class="currency">${config.currencySymbol || '$'}</span>
                  <span class="amount">${plan.price}</span>
                  <span class="period">/${plan.period}</span>
                </div>
              </div>
              <p class="plan-description">${escapeHtml(plan.description || '')}</p>
              <div class="plan-limits">
                <div class="limit-item"><span class="material-icons-outlined">dns</span> ${plan.limits?.servers || 0} Servers</div>
                <div class="limit-item"><span class="material-icons-outlined">memory</span> ${plan.limits?.memory || 0} MB RAM</div>
                <div class="limit-item"><span class="material-icons-outlined">storage</span> ${plan.limits?.disk || 0} MB Disk</div>
                <div class="limit-item"><span class="material-icons-outlined">speed</span> ${plan.limits?.cpu || 0}% CPU</div>
              </div>
              <div class="plan-features">
                ${(plan.features || []).map(f => `
                  <div class="feature-item"><span class="material-icons-outlined">check</span> ${escapeHtml(f)}</div>
                `).join('')}
              </div>
              <div class="plan-actions">
                <span class="status-badge ${plan.active !== false ? 'active' : 'inactive'}">${plan.active !== false ? 'Active' : 'Inactive'}</span>
                <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); editPlan('${plan.id}')">
                  <span class="material-icons-outlined">edit</span>
                </button>
                <button class="btn btn-sm btn-ghost btn-danger" onclick="event.stopPropagation(); deletePlan('${plan.id}')">
                  <span class="material-icons-outlined">delete</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
      window.editPlan = (id) => {
        const plan = plans.find(p => p.id === id);
        if (plan) showPlanModal(plan, loadView);
      };
      
      window.deletePlan = async (id) => {
        if (!confirm('Are you sure you want to delete this plan?')) return;
        try {
          await api(`/api/billing/admin/plans/${id}`, { method: 'DELETE' });
          toast.success('Plan deleted');
          loadView();
        } catch (e) {
          toast.error('Failed to delete plan');
        }
      };
      break;
      
    case 'subscriptions':
      try {
        const res = await api('/api/billing/admin/subscriptions');
        const data = await res.json();
        
        content.innerHTML = `
          <div class="subscriptions-list">
            ${data.subscriptions.length === 0 ? `
              <div class="empty-state">
                <span class="material-icons-outlined">card_membership</span>
                <p>No subscriptions yet</p>
              </div>
            ` : `
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.subscriptions.map(sub => `
                    <tr>
                      <td>${sub.user_id?.substring(0, 8) || '--'}</td>
                      <td>${escapeHtml(sub.plan?.name || 'Unknown')}</td>
                      <td><span class="status-badge status-${sub.status}">${sub.status}</span></td>
                      <td>${sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Never'}</td>
                      <td>
                        ${sub.status === 'pending' ? `
                          <button class="btn btn-xs btn-success" onclick="approveSubscription('${sub.id}')">Approve</button>
                          <button class="btn btn-xs btn-danger" onclick="rejectSubscription('${sub.id}')">Reject</button>
                        ` : sub.status === 'active' ? `
                          <button class="btn btn-xs btn-warning" onclick="cancelSubscription('${sub.id}')">Cancel</button>
                        ` : '-'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        `;
        
        window.approveSubscription = async (id) => {
          try {
            await api(`/api/billing/admin/subscriptions/${id}`, {
              method: 'PUT',
              body: JSON.stringify({ status: 'active' })
            });
            toast.success('Subscription approved');
            loadView();
          } catch (e) {
            toast.error('Failed to approve subscription');
          }
        };
        
        window.rejectSubscription = async (id) => {
          try {
            await api(`/api/billing/admin/subscriptions/${id}`, {
              method: 'PUT',
              body: JSON.stringify({ status: 'rejected' })
            });
            toast.success('Subscription rejected');
            loadView();
          } catch (e) {
            toast.error('Failed to reject subscription');
          }
        };
        
        window.cancelSubscription = async (id) => {
          if (!confirm('Cancel this subscription?')) return;
          try {
            await api(`/api/billing/admin/subscriptions/${id}`, {
              method: 'PUT',
              body: JSON.stringify({ status: 'cancelled' })
            });
            toast.success('Subscription cancelled');
            loadView();
          } catch (e) {
            toast.error('Failed to cancel subscription');
          }
        };
      } catch (e) {
        content.innerHTML = '<div class="error">Failed to load subscriptions</div>';
      }
      break;
      
    case 'payments':
      try {
        const res = await api('/api/billing/admin/payments');
        const data = await res.json();
        
        content.innerHTML = `
          <div class="payments-list">
            ${data.payments.length === 0 ? `
              <div class="empty-state">
                <span class="material-icons-outlined">receipt_long</span>
                <p>No payments yet</p>
              </div>
            ` : `
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Gateway</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.payments.map(p => `
                    <tr>
                      <td>${p.id.substring(0, 8)}</td>
                      <td>${p.user_id?.substring(0, 8) || '--'}</td>
                      <td>${config.currencySymbol || '$'}${p.amount}</td>
                      <td>${p.gateway || '-'}</td>
                      <td><span class="status-badge status-${p.status}">${p.status}</span></td>
                      <td>${new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        `;
      } catch (e) {
        content.innerHTML = '<div class="error">Failed to load payments</div>';
      }
      break;
      
    case 'settings':
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>Billing Settings</h3>
          <form id="billing-settings-form" class="settings-form">
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="enabled" ${config.enabled ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Enable Billing</span>
                  <span class="toggle-desc">Allow users to subscribe to plans and make payments</span>
                </span>
              </label>
            </div>
            
            <div class="form-section">
              <h4>Currency</h4>
              <div class="form-grid">
                <div class="form-group">
                  <label>Currency Code</label>
                  <input type="text" name="currency" value="${config.currency || 'USD'}" placeholder="USD" />
                </div>
                <div class="form-group">
                  <label>Currency Symbol</label>
                  <input type="text" name="currencySymbol" value="${config.currencySymbol || '$'}" placeholder="$" />
                </div>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save Settings</button>
            </div>
          </form>
        </div>
      `;
      
      document.getElementById('billing-settings-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        
        try {
          const fullConfig = await (await api('/api/admin/settings')).json();
          fullConfig.billing = {
            ...fullConfig.billing,
            enabled: form.get('enabled') === 'on',
            currency: form.get('currency') || 'USD',
            currencySymbol: form.get('currencySymbol') || '$'
          };
          
          await api('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(fullConfig)
          });
          
          toast.success('Billing settings saved');
          loadView();
        } catch (e) {
          toast.error('Failed to save settings');
        }
      };
      break;
  }
}

function showPlanModal(plan, loadView) {
  const isEdit = !!plan;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Plan' : 'Create Plan'}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="plan-form" class="modal-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${escapeHtml(plan?.name || '')}" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="2">${escapeHtml(plan?.description || '')}</textarea>
        </div>
        <div class="form-grid cols-3">
          <div class="form-group">
            <label>Price</label>
            <input type="number" name="price" value="${plan?.price || 0}" step="0.01" min="0" required />
          </div>
          <div class="form-group">
            <label>Period</label>
            <select name="period">
              <option value="monthly" ${plan?.period === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="yearly" ${plan?.period === 'yearly' ? 'selected' : ''}>Yearly</option>
              <option value="lifetime" ${plan?.period === 'lifetime' ? 'selected' : ''}>Lifetime</option>
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="active">
              <option value="true" ${plan?.active !== false ? 'selected' : ''}>Active</option>
              <option value="false" ${plan?.active === false ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>
        
        <h4>Resource Limits</h4>
        <div class="form-grid cols-4">
          <div class="form-group">
            <label>Servers</label>
            <input type="number" name="servers" value="${plan?.limits?.servers || 1}" min="0" required />
          </div>
          <div class="form-group">
            <label>Memory (MB)</label>
            <input type="number" name="memory" value="${plan?.limits?.memory || 1024}" min="0" required />
          </div>
          <div class="form-group">
            <label>Disk (MB)</label>
            <input type="number" name="disk" value="${plan?.limits?.disk || 5120}" min="0" required />
          </div>
          <div class="form-group">
            <label>CPU (%)</label>
            <input type="number" name="cpu" value="${plan?.limits?.cpu || 100}" min="0" required />
          </div>
        </div>
        
        <div class="form-group">
          <label>Features (one per line)</label>
          <textarea name="features" rows="4" placeholder="Feature 1&#10;Feature 2&#10;Feature 3">${(plan?.features || []).join('\n')}</textarea>
        </div>
        
        <label class="toggle-item">
          <input type="checkbox" name="popular" ${plan?.popular ? 'checked' : ''} />
          <span class="toggle-content">
            <span class="toggle-title">Mark as Popular</span>
          </span>
        </label>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Plan'}</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('plan-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    const planData = {
      name: form.get('name'),
      description: form.get('description'),
      price: parseFloat(form.get('price')),
      period: form.get('period'),
      active: form.get('active') === 'true',
      popular: form.get('popular') === 'on',
      limits: {
        servers: parseInt(form.get('servers')),
        memory: parseInt(form.get('memory')),
        disk: parseInt(form.get('disk')),
        cpu: parseInt(form.get('cpu'))
      },
      features: form.get('features').split('\n').map(f => f.trim()).filter(f => f)
    };
    
    try {
      if (isEdit) {
        await api(`/api/billing/admin/plans/${plan.id}`, {
          method: 'PUT',
          body: JSON.stringify({ updates: planData })
        });
        toast.success('Plan updated');
      } else {
        await api('/api/billing/admin/plans', {
          method: 'POST',
          body: JSON.stringify({ plan: planData })
        });
        toast.success('Plan created');
      }
      modal.remove();
      loadView();
    } catch (e) {
      toast.error('Failed to save plan');
    }
  };
}
