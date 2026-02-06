import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import * as modal from '../../../utils/modal.js';
import { api } from '../../../utils/api.js';
import { renderBreadcrumb, setupBreadcrumbListeners, renderPagination } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

let currentBillingTab = 'overview';

const BILLING_TABS = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'plans', label: 'Plans', icon: 'inventory_2' },
  { id: 'coupons', label: 'Coupons', icon: 'local_offer' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'card_membership' },
  { id: 'invoices', label: 'Invoices', icon: 'receipt_long' },
  { id: 'payments', label: 'Payments', icon: 'payments' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
];

export async function renderBillingPage(container, username, loadView) {
  const urlParams = new URLSearchParams(window.location.search);
  currentBillingTab = urlParams.get('tab') || 'overview';
  
  container.innerHTML = `
    <div class="admin-header">
      ${renderBreadcrumb([{ label: 'Billing' }])}
    </div>
    
    <div class="settings-layout">
      <aside class="settings-sidebar">
        <nav class="settings-nav">
          ${BILLING_TABS.map(tab => `
            <button class="settings-nav-item ${currentBillingTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
              <span class="material-icons-outlined">${tab.icon}</span>
              <span>${tab.label}</span>
            </button>
          `).join('')}
        </nav>
      </aside>
      
      <div class="settings-content" id="billing-content">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
  
  setupBreadcrumbListeners(navigateTo);
  
  container.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.onclick = () => {
      currentBillingTab = btn.dataset.tab;
      container.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      history.replaceState(null, '', `/admin/billing?tab=${currentBillingTab}`);
      renderBillingContent();
    };
  });
  
  renderBillingContent();
}

async function renderBillingContent() {
  const content = document.getElementById('billing-content');
  if (!content) return;
  
  content.innerHTML = '<div class="loading-spinner"></div>';
  
  switch (currentBillingTab) {
    case 'overview':
      await renderBillingOverview(content);
      break;
    case 'plans':
      await renderPlansTab(content);
      break;
    case 'coupons':
      await renderCouponsTab(content);
      break;
    case 'subscriptions':
      await renderSubscriptionsTab(content);
      break;
    case 'invoices':
      await renderInvoicesTab(content);
      break;
    case 'payments':
      await renderPaymentsTab(content);
      break;
    case 'settings':
      await renderBillingSettings(content);
      break;
  }
}

async function renderBillingOverview(content) {
  try {
    const [statsRes, configRes] = await Promise.all([
      api('/api/billing/admin/stats'),
      api('/api/billing/admin/settings')
    ]);
    
    const stats = await statsRes.json();
    const { billing } = await configRes.json();
    
    const symbol = billing?.currencySymbol || '$';
    
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <h2>Billing Overview</h2>
          <p>Summary of billing activity and revenue.</p>
        </div>
        
        ${!billing?.enabled ? `
          <div class="alert alert-warning">
            <span class="material-icons-outlined">warning</span>
            <div>
              <strong>Billing is disabled</strong>
              <p>Enable billing in settings to start accepting payments.</p>
            </div>
          </div>
        ` : ''}
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon"><span class="material-icons-outlined">inventory_2</span></div>
            <div class="stat-info">
              <span class="stat-value">${stats.activePlans || 0}</span>
              <span class="stat-label">Active Plans</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><span class="material-icons-outlined">card_membership</span></div>
            <div class="stat-info">
              <span class="stat-value">${stats.activeSubscriptions || 0}</span>
              <span class="stat-label">Active Subscriptions</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><span class="material-icons-outlined">attach_money</span></div>
            <div class="stat-info">
              <span class="stat-value">${symbol}${(stats.totalRevenue || 0).toFixed(2)}</span>
              <span class="stat-label">Total Revenue</span>
            </div>
          </div>
          <div class="stat-card ${stats.overdueInvoices > 0 ? 'stat-warning' : ''}">
            <div class="stat-icon"><span class="material-icons-outlined">receipt_long</span></div>
            <div class="stat-info">
              <span class="stat-value">${stats.pendingInvoices || 0}</span>
              <span class="stat-label">Pending Invoices</span>
            </div>
          </div>
        </div>
        
        ${stats.overdueInvoices > 0 ? `
          <div class="alert alert-danger" style="margin-top: 1.5rem;">
            <span class="material-icons-outlined">error</span>
            <div>
              <strong>${stats.overdueInvoices} overdue invoice(s)</strong>
              <p>Some invoices are past their due date and require attention.</p>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load billing overview</div>';
  }
}

async function renderPlansTab(content) {
  try {
    const res = await api('/api/billing/admin/plans');
    const { plans } = await res.json();
    
    const configRes = await api('/api/billing/admin/settings');
    const { billing } = await configRes.json();
    const symbol = billing?.currencySymbol || '$';
    
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <h2>Billing Plans</h2>
            <p>Manage subscription plans and pricing.</p>
          </div>
          <button class="btn btn-primary" id="create-plan-btn">
            <span class="material-icons-outlined">add</span>
            Create Plan
          </button>
        </div>
        
        <div class="plans-grid">
          ${plans.length === 0 ? `
            <div class="empty-state">
              <span class="material-icons-outlined">inventory_2</span>
              <p>No plans created yet</p>
            </div>
          ` : plans.map(plan => `
            <div class="plan-card ${!plan.active ? 'plan-inactive' : ''}">
              <div class="plan-header">
                <h3>${escapeHtml(plan.name)}</h3>
                ${!plan.active ? '<span class="badge badge-warning">Inactive</span>' : ''}
                ${!plan.visible ? '<span class="badge badge-secondary">Hidden</span>' : ''}
              </div>
              <div class="plan-price">
                <span class="price-amount">${symbol}${plan.price.toFixed(2)}</span>
                <span class="price-cycle">/${plan.billingCycle}</span>
              </div>
              <p class="plan-description">${escapeHtml(plan.description || 'No description')}</p>
              <div class="plan-limits">
                <div class="limit-item">
                  <span class="material-icons-outlined">dns</span>
                  <span>${plan.limits?.servers || 0} Servers</span>
                </div>
                <div class="limit-item">
                  <span class="material-icons-outlined">memory</span>
                  <span>${plan.limits?.memory || 0} MB RAM</span>
                </div>
                <div class="limit-item">
                  <span class="material-icons-outlined">storage</span>
                  <span>${plan.limits?.disk || 0} MB Disk</span>
                </div>
              </div>
              <div class="plan-actions">
                <button class="btn btn-sm btn-secondary edit-plan-btn" data-id="${plan.id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-plan-btn" data-id="${plan.id}">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    document.getElementById('create-plan-btn').onclick = () => showPlanModal();
    
    content.querySelectorAll('.edit-plan-btn').forEach(btn => {
      btn.onclick = () => {
        const plan = plans.find(p => p.id === btn.dataset.id);
        if (plan) showPlanModal(plan);
      };
    });
    
    content.querySelectorAll('.delete-plan-btn').forEach(btn => {
      btn.onclick = async () => {
        const confirmed = await modal.confirm({ 
          title: 'Delete Plan', 
          message: 'Are you sure? This cannot be undone.',
          danger: true 
        });
        if (!confirmed) return;
        
        try {
          const res = await api(`/api/billing/admin/plans/${btn.dataset.id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('Plan deleted');
            renderBillingContent();
          } else {
            const data = await res.json();
            toast.error(data.error || 'Failed to delete plan');
          }
        } catch (e) {
          toast.error('Failed to delete plan');
        }
      };
    });
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load plans</div>';
  }
}

async function showPlanModal(existingPlan = null) {
  const isEdit = !!existingPlan;
  
  const html = `
    <form id="plan-form" class="modal-form">
      <div class="form-grid">
        <div class="form-group">
          <label>Plan Name *</label>
          <input type="text" name="name" value="${escapeHtml(existingPlan?.name || '')}" required />
        </div>
        <div class="form-group">
          <label>Price *</label>
          <input type="number" name="price" value="${existingPlan?.price || 0}" min="0" step="0.01" required />
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea name="description" rows="2">${escapeHtml(existingPlan?.description || '')}</textarea>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Billing Cycle</label>
          <select name="billingCycle">
            <option value="monthly" ${existingPlan?.billingCycle === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="yearly" ${existingPlan?.billingCycle === 'yearly' ? 'selected' : ''}>Yearly</option>
            <option value="weekly" ${existingPlan?.billingCycle === 'weekly' ? 'selected' : ''}>Weekly</option>
          </select>
        </div>
        <div class="form-group">
          <label>Sort Order</label>
          <input type="number" name="sortOrder" value="${existingPlan?.sortOrder || 0}" />
        </div>
      </div>
      <h4 style="margin: 1rem 0 0.5rem;">Resource Limits</h4>
      <div class="form-grid">
        <div class="form-group">
          <label>Servers</label>
          <input type="number" name="servers" value="${existingPlan?.limits?.servers || 2}" min="0" />
        </div>
        <div class="form-group">
          <label>Memory (MB)</label>
          <input type="number" name="memory" value="${existingPlan?.limits?.memory || 2048}" min="0" />
        </div>
        <div class="form-group">
          <label>Disk (MB)</label>
          <input type="number" name="disk" value="${existingPlan?.limits?.disk || 10240}" min="0" />
        </div>
        <div class="form-group">
          <label>CPU (%)</label>
          <input type="number" name="cpu" value="${existingPlan?.limits?.cpu || 200}" min="0" />
        </div>
        <div class="form-group">
          <label>Backups</label>
          <input type="number" name="backups" value="${existingPlan?.limits?.backups || 3}" min="0" />
        </div>
        <div class="form-group">
          <label>Allocations</label>
          <input type="number" name="allocations" value="${existingPlan?.limits?.allocations || 5}" min="0" />
        </div>
      </div>
      <div class="form-toggles" style="margin-top: 1rem;">
        <label class="toggle-item">
          <input type="checkbox" name="active" ${existingPlan?.active !== false ? 'checked' : ''} />
          <span class="toggle-content">
            <span class="toggle-title">Active</span>
          </span>
        </label>
        <label class="toggle-item">
          <input type="checkbox" name="visible" ${existingPlan?.visible !== false ? 'checked' : ''} />
          <span class="toggle-content">
            <span class="toggle-title">Visible to Users</span>
          </span>
        </label>
      </div>
    </form>
  `;
  
  const confirmed = await modal.custom({
    title: isEdit ? 'Edit Plan' : 'Create Plan',
    html,
    confirmText: isEdit ? 'Save Changes' : 'Create Plan',
    width: '600px'
  });
  
  if (!confirmed) return;
  
  const form = document.getElementById('plan-form');
  const planData = {
    name: form.name.value,
    description: form.description.value,
    price: parseFloat(form.price.value) || 0,
    billingCycle: form.billingCycle.value,
    sortOrder: parseInt(form.sortOrder.value) || 0,
    limits: {
      servers: parseInt(form.servers.value) || 0,
      memory: parseInt(form.memory.value) || 0,
      disk: parseInt(form.disk.value) || 0,
      cpu: parseInt(form.cpu.value) || 0,
      backups: parseInt(form.backups.value) || 0,
      allocations: parseInt(form.allocations.value) || 0
    },
    active: form.active.checked,
    visible: form.visible.checked
  };
  
  try {
    const url = isEdit ? `/api/billing/admin/plans/${existingPlan.id}` : '/api/billing/admin/plans';
    const method = isEdit ? 'PUT' : 'POST';
    
    const res = await api(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planData })
    });
    
    if (res.ok) {
      toast.success(isEdit ? 'Plan updated' : 'Plan created');
      renderBillingContent();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to save plan');
    }
  } catch (e) {
    toast.error('Failed to save plan');
  }
}

async function renderCouponsTab(content) {
  try {
    const res = await api('/api/billing/admin/coupons');
    const { coupons } = await res.json();
    
    const configRes = await api('/api/billing/admin/settings');
    const { billing } = await configRes.json();
    const symbol = billing?.currencySymbol || '$';
    
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <h2>Discount Coupons</h2>
            <p>Create and manage discount codes for subscriptions.</p>
          </div>
          <button class="btn btn-primary" id="create-coupon-btn">
            <span class="material-icons-outlined">add</span>
            Create Coupon
          </button>
        </div>
        
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Uses</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${coupons.length === 0 ? `
                <tr><td colspan="6" class="empty-cell">No coupons created yet</td></tr>
              ` : coupons.map(coupon => `
                <tr>
                  <td>
                    <strong class="coupon-code">${escapeHtml(coupon.code)}</strong>
                    ${coupon.description ? `<br><small class="text-muted">${escapeHtml(coupon.description)}</small>` : ''}
                  </td>
                  <td>
                    ${coupon.type === 'percentage' 
                      ? `${coupon.value}%` 
                      : `${symbol}${coupon.value.toFixed(2)}`}
                  </td>
                  <td>${coupon.usedCount || 0}${coupon.maxUses ? ` / ${coupon.maxUses}` : ''}</td>
                  <td>${coupon.expiresAt ? formatDate(coupon.expiresAt) : 'Never'}</td>
                  <td>
                    <span class="badge badge-${coupon.active ? 'success' : 'secondary'}">
                      ${coupon.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-sm btn-secondary edit-coupon-btn" data-id="${coupon.id}">Edit</button>
                      <button class="btn btn-sm btn-danger delete-coupon-btn" data-id="${coupon.id}">Delete</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.getElementById('create-coupon-btn').onclick = () => showCouponModal();
    
    content.querySelectorAll('.edit-coupon-btn').forEach(btn => {
      btn.onclick = () => {
        const coupon = coupons.find(c => c.id === btn.dataset.id);
        if (coupon) showCouponModal(coupon);
      };
    });
    
    content.querySelectorAll('.delete-coupon-btn').forEach(btn => {
      btn.onclick = async () => {
        const confirmed = await modal.confirm({ 
          title: 'Delete Coupon', 
          message: 'Are you sure you want to delete this coupon?',
          danger: true 
        });
        if (!confirmed) return;
        
        try {
          const res = await api(`/api/billing/admin/coupons/${btn.dataset.id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('Coupon deleted');
            renderBillingContent();
          } else {
            toast.error('Failed to delete coupon');
          }
        } catch (e) {
          toast.error('Failed to delete coupon');
        }
      };
    });
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load coupons</div>';
  }
}

async function showCouponModal(existingCoupon = null) {
  const isEdit = !!existingCoupon;
  
  const plansRes = await api('/api/billing/admin/plans');
  const { plans } = await plansRes.json();
  
  const html = `
    <form id="coupon-form" class="modal-form">
      <div class="form-grid">
        <div class="form-group">
          <label>Coupon Code *</label>
          <input type="text" name="code" value="${escapeHtml(existingCoupon?.code || '')}" 
                 style="text-transform: uppercase" required ${isEdit ? 'readonly' : ''} />
        </div>
        <div class="form-group">
          <label>Discount Type</label>
          <select name="type">
            <option value="percentage" ${existingCoupon?.type === 'percentage' ? 'selected' : ''}>Percentage (%)</option>
            <option value="fixed" ${existingCoupon?.type === 'fixed' ? 'selected' : ''}>Fixed Amount</option>
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Discount Value *</label>
          <input type="number" name="value" value="${existingCoupon?.value || 0}" min="0" step="0.01" required />
        </div>
        <div class="form-group">
          <label>Max Uses</label>
          <input type="number" name="maxUses" value="${existingCoupon?.maxUses || ''}" min="0" placeholder="Unlimited" />
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" name="description" value="${escapeHtml(existingCoupon?.description || '')}" />
      </div>
      <div class="form-group">
        <label>Expires At</label>
        <input type="date" name="expiresAt" value="${existingCoupon?.expiresAt ? existingCoupon.expiresAt.split('T')[0] : ''}" />
      </div>
      <div class="form-group">
        <label>Applicable Plans</label>
        <select name="planIds" multiple style="height: 100px;">
          ${plans.map(p => `
            <option value="${p.id}" ${existingCoupon?.planIds?.includes(p.id) ? 'selected' : ''}>
              ${escapeHtml(p.name)}
            </option>
          `).join('')}
        </select>
        <small class="form-hint">Leave empty to apply to all plans</small>
      </div>
      <div class="form-toggles">
        <label class="toggle-item">
          <input type="checkbox" name="active" ${existingCoupon?.active !== false ? 'checked' : ''} />
          <span class="toggle-content">
            <span class="toggle-title">Active</span>
          </span>
        </label>
      </div>
    </form>
  `;
  
  const confirmed = await modal.custom({
    title: isEdit ? 'Edit Coupon' : 'Create Coupon',
    html,
    confirmText: isEdit ? 'Save Changes' : 'Create Coupon',
    width: '500px'
  });
  
  if (!confirmed) return;
  
  const form = document.getElementById('coupon-form');
  const selectedPlans = Array.from(form.planIds.selectedOptions).map(o => o.value);
  
  const couponData = {
    code: form.code.value.toUpperCase(),
    description: form.description.value,
    type: form.type.value,
    value: parseFloat(form.value.value) || 0,
    maxUses: form.maxUses.value ? parseInt(form.maxUses.value) : null,
    planIds: selectedPlans,
    expiresAt: form.expiresAt.value ? new Date(form.expiresAt.value).toISOString() : null,
    active: form.active.checked
  };
  
  try {
    const url = isEdit ? `/api/billing/admin/coupons/${existingCoupon.id}` : '/api/billing/admin/coupons';
    const method = isEdit ? 'PUT' : 'POST';
    
    const res = await api(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupon: couponData })
    });
    
    if (res.ok) {
      toast.success(isEdit ? 'Coupon updated' : 'Coupon created');
      renderBillingContent();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to save coupon');
    }
  } catch (e) {
    toast.error('Failed to save coupon');
  }
}

async function renderSubscriptionsTab(content) {
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get('page')) || 1;
  const status = urlParams.get('status') || '';
  
  try {
    let url = `/api/billing/admin/subscriptions?page=${page}&per_page=20`;
    if (status) url += `&status=${status}`;
    
    const res = await api(url);
    const { subscriptions, meta } = await res.json();
    
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <h2>Subscriptions</h2>
          <div class="filter-group">
            <select id="status-filter" class="form-select">
              <option value="">All Status</option>
              <option value="active" ${status === 'active' ? 'selected' : ''}>Active</option>
              <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              <option value="expired" ${status === 'expired' ? 'selected' : ''}>Expired</option>
            </select>
          </div>
        </div>
        
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Started</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${subscriptions.length === 0 ? `
                <tr><td colspan="6" class="empty-cell">No subscriptions found</td></tr>
              ` : subscriptions.map(sub => `
                <tr>
                  <td>
                    <div class="user-cell">
                      <span class="username">${escapeHtml(sub.user?.username || 'Unknown')}</span>
                      <span class="email">${escapeHtml(sub.user?.email || '')}</span>
                    </div>
                  </td>
                  <td>${escapeHtml(sub.plan?.name || 'Unknown')}</td>
                  <td><span class="badge badge-${getStatusColor(sub.status)}">${sub.status}</span></td>
                  <td>${formatDate(sub.currentPeriodStart)}</td>
                  <td>${formatDate(sub.currentPeriodEnd)}</td>
                  <td>
                    <div class="action-btns">
                      <select class="form-select form-select-sm status-change" data-id="${sub.id}">
                        <option value="active" ${sub.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="pending" ${sub.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="cancelled" ${sub.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        <option value="expired" ${sub.status === 'expired' ? 'selected' : ''}>Expired</option>
                      </select>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        ${renderPagination(meta, (p) => {
          history.replaceState(null, '', `/admin/billing?tab=subscriptions&page=${p}${status ? `&status=${status}` : ''}`);
          renderBillingContent();
        })}
      </div>
    `;
    
    document.getElementById('status-filter').onchange = (e) => {
      history.replaceState(null, '', `/admin/billing?tab=subscriptions${e.target.value ? `&status=${e.target.value}` : ''}`);
      renderBillingContent();
    };
    
    content.querySelectorAll('.status-change').forEach(select => {
      select.onchange = async (e) => {
        try {
          const res = await api(`/api/billing/admin/subscriptions/${select.dataset.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: e.target.value })
          });
          if (res.ok) {
            toast.success('Subscription updated');
          } else {
            toast.error('Failed to update subscription');
            renderBillingContent();
          }
        } catch (e) {
          toast.error('Failed to update subscription');
        }
      };
    });
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load subscriptions</div>';
  }
}

async function renderInvoicesTab(content) {
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get('page')) || 1;
  const status = urlParams.get('status') || '';
  
  try {
    let url = `/api/billing/admin/invoices?page=${page}&per_page=20`;
    if (status) url += `&status=${status}`;
    
    const res = await api(url);
    const { invoices, meta } = await res.json();
    
    const configRes = await api('/api/billing/admin/settings');
    const { billing } = await configRes.json();
    const symbol = billing?.currencySymbol || '$';
    
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <h2>Invoices</h2>
          <div class="filter-group">
            <select id="invoice-status-filter" class="form-select">
              <option value="">All Status</option>
              <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="paid" ${status === 'paid' ? 'selected' : ''}>Paid</option>
              <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>
        
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.length === 0 ? `
                <tr><td colspan="6" class="empty-cell">No invoices found</td></tr>
              ` : invoices.map(inv => `
                <tr class="${inv.status === 'pending' && new Date(inv.dueDate) < new Date() ? 'row-danger' : ''}">
                  <td>
                    <div class="user-cell">
                      <span class="username">${escapeHtml(inv.user?.username || 'Unknown')}</span>
                      <span class="email">${escapeHtml(inv.user?.email || '')}</span>
                    </div>
                  </td>
                  <td><strong>${symbol}${inv.total.toFixed(2)}</strong></td>
                  <td><span class="badge badge-${getInvoiceStatusColor(inv.status)}">${inv.status}</span></td>
                  <td>${formatDate(inv.dueDate)}</td>
                  <td>${formatDate(inv.createdAt)}</td>
                  <td>
                    <div class="action-btns">
                      ${inv.status === 'pending' ? `
                        <button class="btn btn-sm btn-success mark-paid-btn" data-id="${inv.id}">Mark Paid</button>
                        <button class="btn btn-sm btn-danger cancel-invoice-btn" data-id="${inv.id}">Cancel</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        ${renderPagination(meta, (p) => {
          history.replaceState(null, '', `/admin/billing?tab=invoices&page=${p}${status ? `&status=${status}` : ''}`);
          renderBillingContent();
        })}
      </div>
    `;
    
    document.getElementById('invoice-status-filter').onchange = (e) => {
      history.replaceState(null, '', `/admin/billing?tab=invoices${e.target.value ? `&status=${e.target.value}` : ''}`);
      renderBillingContent();
    };
    
    content.querySelectorAll('.mark-paid-btn').forEach(btn => {
      btn.onclick = async () => {
        try {
          const res = await api(`/api/billing/admin/invoices/${btn.dataset.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paid' })
          });
          if (res.ok) {
            toast.success('Invoice marked as paid');
            renderBillingContent();
          } else {
            toast.error('Failed to update invoice');
          }
        } catch (e) {
          toast.error('Failed to update invoice');
        }
      };
    });
    
    content.querySelectorAll('.cancel-invoice-btn').forEach(btn => {
      btn.onclick = async () => {
        const confirmed = await modal.confirm({ title: 'Cancel Invoice', message: 'Are you sure?', danger: true });
        if (!confirmed) return;
        
        try {
          const res = await api(`/api/billing/admin/invoices/${btn.dataset.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
          });
          if (res.ok) {
            toast.success('Invoice cancelled');
            renderBillingContent();
          } else {
            toast.error('Failed to cancel invoice');
          }
        } catch (e) {
          toast.error('Failed to cancel invoice');
        }
      };
    });
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load invoices</div>';
  }
}

async function renderPaymentsTab(content) {
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get('page')) || 1;
  
  try {
    const res = await api(`/api/billing/admin/payments?page=${page}&per_page=20`);
    const { payments, meta } = await res.json();
    
    const configRes = await api('/api/billing/admin/settings');
    const { billing } = await configRes.json();
    const symbol = billing?.currencySymbol || '$';
    
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <h2>Payments</h2>
          <p>All payment transactions.</p>
        </div>
        
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length === 0 ? `
                <tr><td colspan="5" class="empty-cell">No payments found</td></tr>
              ` : payments.map(pay => `
                <tr>
                  <td>
                    <div class="user-cell">
                      <span class="username">${escapeHtml(pay.user?.username || 'Unknown')}</span>
                      <span class="email">${escapeHtml(pay.user?.email || '')}</span>
                    </div>
                  </td>
                  <td><strong>${symbol}${(pay.amount || 0).toFixed(2)}</strong></td>
                  <td>${pay.method || 'manual'}</td>
                  <td><span class="badge badge-${pay.status === 'completed' ? 'success' : 'warning'}">${pay.status}</span></td>
                  <td>${formatDate(pay.createdAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        ${renderPagination(meta, (p) => {
          history.replaceState(null, '', `/admin/billing?tab=payments&page=${p}`);
          renderBillingContent();
        })}
      </div>
    `;
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load payments</div>';
  }
}

async function renderBillingSettings(content) {
  try {
    const res = await api('/api/billing/admin/settings');
    const { billing, tickets } = await res.json();
    
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <h2>Billing Settings</h2>
          <p>Configure billing and payment options.</p>
        </div>
        
        <form id="billing-settings-form" class="settings-form">
          <div class="detail-card">
            <h3>General Settings</h3>
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="enabled" ${billing?.enabled ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Enable Billing</span>
                  <span class="toggle-desc">Allow users to subscribe to plans and make payments</span>
                </span>
              </label>
              <label class="toggle-item">
                <input type="checkbox" name="requireEmail" ${billing?.requireEmail ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Require Email</span>
                  <span class="toggle-desc">Users must have an email to use billing</span>
                </span>
              </label>
              <label class="toggle-item">
                <input type="checkbox" name="requireEmailVerification" ${billing?.requireEmailVerification ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Require Email Verification</span>
                  <span class="toggle-desc">Users must verify their email before billing</span>
                </span>
              </label>
              <label class="toggle-item">
                <input type="checkbox" name="autoSuspend" ${billing?.autoSuspend ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Auto-Suspend on Expiration</span>
                  <span class="toggle-desc">Automatically suspend servers when subscription expires</span>
                </span>
              </label>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Currency & Taxes</h3>
            <div class="form-grid">
              <div class="form-group">
                <label>Currency Code</label>
                <input type="text" name="currency" value="${escapeHtml(billing?.currency || 'USD')}" maxlength="3" />
              </div>
              <div class="form-group">
                <label>Currency Symbol</label>
                <input type="text" name="currencySymbol" value="${escapeHtml(billing?.currencySymbol || '$')}" maxlength="3" />
              </div>
              <div class="form-group">
                <label>Tax Rate (%)</label>
                <input type="number" name="taxRate" value="${billing?.taxRate || 0}" min="0" max="100" step="0.01" />
              </div>
              <div class="form-group">
                <label>Grace Period (Days)</label>
                <input type="number" name="gracePeriodDays" value="${billing?.gracePeriodDays || 3}" min="0" />
              </div>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Payment Methods</h3>
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="manualEnabled" ${billing?.paymentMethods?.manual?.enabled ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Manual Payments</span>
                  <span class="toggle-desc">Admin manually marks invoices as paid</span>
                </span>
              </label>
            </div>
            <div class="form-group" style="margin-top: 1rem;">
              <label>Manual Payment Instructions</label>
              <textarea name="manualInstructions" rows="3">${escapeHtml(billing?.paymentMethods?.manual?.instructions || '')}</textarea>
              <small class="form-hint">Shown to users when they need to pay manually</small>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Stripe</h3>
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="stripeEnabled" ${billing?.paymentMethods?.stripe?.enabled ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Enable Stripe</span>
                  <span class="toggle-desc">Accept credit card payments via Stripe</span>
                </span>
              </label>
            </div>
            <div class="form-grid" style="margin-top: 1rem;">
              <div class="form-group">
                <label>Public Key</label>
                <input type="text" name="stripePublicKey" value="${escapeHtml(billing?.paymentMethods?.stripe?.publicKey || '')}" placeholder="pk_..." />
              </div>
              <div class="form-group">
                <label>Secret Key</label>
                <input type="password" name="stripeSecretKey" value="${escapeHtml(billing?.paymentMethods?.stripe?.secretKey || '')}" placeholder="sk_..." />
              </div>
            </div>
            <div class="form-group">
              <label>Webhook Secret</label>
              <input type="password" name="stripeWebhookSecret" value="${escapeHtml(billing?.paymentMethods?.stripe?.webhookSecret || '')}" placeholder="whsec_..." />
              <small class="form-hint">From Stripe Dashboard → Webhooks</small>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>PayPal</h3>
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="paypalEnabled" ${billing?.paymentMethods?.paypal?.enabled ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Enable PayPal</span>
                  <span class="toggle-desc">Accept payments via PayPal</span>
                </span>
              </label>
              <label class="toggle-item">
                <input type="checkbox" name="paypalSandbox" ${billing?.paymentMethods?.paypal?.sandbox ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Sandbox Mode</span>
                  <span class="toggle-desc">Use PayPal sandbox for testing</span>
                </span>
              </label>
            </div>
            <div class="form-grid" style="margin-top: 1rem;">
              <div class="form-group">
                <label>Client ID</label>
                <input type="text" name="paypalClientId" value="${escapeHtml(billing?.paymentMethods?.paypal?.clientId || '')}" />
              </div>
              <div class="form-group">
                <label>Client Secret</label>
                <input type="password" name="paypalClientSecret" value="${escapeHtml(billing?.paymentMethods?.paypal?.clientSecret || '')}" />
              </div>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Email Notifications</h3>
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="notifyInvoiceCreated" ${billing?.notifications?.invoiceCreated ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Invoice Created</span>
                </span>
              </label>
              <label class="toggle-item">
                <input type="checkbox" name="notifyPaymentReceived" ${billing?.notifications?.paymentReceived ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Payment Received</span>
                </span>
              </label>
              <label class="toggle-item">
                <input type="checkbox" name="notifySubscriptionExpiring" ${billing?.notifications?.subscriptionExpiring ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Subscription Expiring</span>
                </span>
              </label>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">
              <span class="material-icons-outlined">save</span>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.getElementById('billing-settings-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      
      const settings = {
        billing: {
          enabled: form.enabled.checked,
          requireEmail: form.requireEmail.checked,
          requireEmailVerification: form.requireEmailVerification.checked,
          autoSuspend: form.autoSuspend.checked,
          currency: form.currency.value,
          currencySymbol: form.currencySymbol.value,
          taxRate: parseFloat(form.taxRate.value) || 0,
          gracePeriodDays: parseInt(form.gracePeriodDays.value) || 3,
          paymentMethods: {
            manual: {
              enabled: form.manualEnabled.checked,
              instructions: form.manualInstructions.value
            },
            stripe: {
              enabled: form.stripeEnabled.checked,
              publicKey: form.stripePublicKey.value,
              secretKey: form.stripeSecretKey.value,
              webhookSecret: form.stripeWebhookSecret.value
            },
            paypal: {
              enabled: form.paypalEnabled.checked,
              clientId: form.paypalClientId.value,
              clientSecret: form.paypalClientSecret.value,
              sandbox: form.paypalSandbox.checked
            }
          },
          notifications: {
            invoiceCreated: form.notifyInvoiceCreated.checked,
            paymentReceived: form.notifyPaymentReceived.checked,
            subscriptionExpiring: form.notifySubscriptionExpiring.checked
          }
        }
      };
      
      try {
        const res = await api('/api/billing/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        
        if (res.ok) {
          toast.success('Settings saved');
        } else {
          toast.error('Failed to save settings');
        }
      } catch (e) {
        toast.error('Failed to save settings');
      }
    };
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load settings</div>';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'active': return 'success';
    case 'pending': return 'warning';
    case 'cancelled': return 'danger';
    case 'expired': return 'secondary';
    default: return 'secondary';
  }
}

function getInvoiceStatusColor(status) {
  switch (status) {
    case 'paid': return 'success';
    case 'pending': return 'warning';
    case 'cancelled': return 'secondary';
    default: return 'secondary';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}
