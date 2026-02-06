import { api, getUser } from '../utils/api.js';
import { escapeHtml } from '../utils/security.js';
import * as toast from '../utils/toast.js';
import * as modal from '../utils/modal.js';

let billingConfig = null;

export async function renderBilling() {
  const app = document.getElementById('app');
  const user = getUser();
  
  if (!user) {
    window.location.href = '/auth';
    return;
  }
  
  app.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const [configRes, requirementsRes, subscriptionRes, plansRes] = await Promise.all([
      api('/api/billing/config'),
      api('/api/billing/requirements'),
      api('/api/billing/my/subscription'),
      api('/api/billing/plans')
    ]);
    
    billingConfig = await configRes.json();
    const requirements = await requirementsRes.json();
    const { subscription } = await subscriptionRes.json();
    const { plans } = await plansRes.json();
    
    if (!billingConfig.enabled) {
      app.innerHTML = `
        <div class="page-container">
          <div class="empty-state">
            <span class="material-icons-outlined">payments_off</span>
            <h2>Billing Not Available</h2>
            <p>Billing is currently disabled on this panel.</p>
            <a href="/dashboard" class="btn btn-primary">Back to Dashboard</a>
          </div>
        </div>
      `;
      return;
    }
    
    const symbol = billingConfig.currencySymbol || '$';
    
    app.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <h1>Billing</h1>
          <p>Manage your subscription and payments</p>
        </div>
        
        ${!requirements.met ? `
          <div class="alert alert-warning">
            <span class="material-icons-outlined">warning</span>
            <div>
              <strong>Requirements Not Met</strong>
              <ul>
                ${requirements.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
              </ul>
              <a href="/settings" class="btn btn-sm btn-primary" style="margin-top: 0.5rem;">Update Profile</a>
            </div>
          </div>
        ` : ''}
        
        <div class="billing-layout">
          <div class="billing-main">
            ${subscription ? renderCurrentSubscription(subscription, symbol) : renderNoSubscription()}
            
            ${!subscription ? `
              <div class="detail-card">
                <h2>Available Plans</h2>
                
                <div class="coupon-input" style="margin-bottom: 1.5rem;">
                  <label>Have a coupon code?</label>
                  <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="coupon-code" placeholder="Enter code" style="flex: 1; text-transform: uppercase;" />
                    <button class="btn btn-secondary" id="apply-coupon-btn">Apply</button>
                  </div>
                  <div id="coupon-result" style="margin-top: 0.5rem;"></div>
                </div>
                
                <div class="plans-grid">
                  ${plans.length === 0 ? `
                    <p class="text-muted">No plans available at this time.</p>
                  ` : plans.sort((a, b) => a.sortOrder - b.sortOrder).map(plan => `
                    <div class="plan-card" data-plan-id="${plan.id}" data-plan-price="${plan.price}">
                      <div class="plan-header">
                        <h3>${escapeHtml(plan.name)}</h3>
                      </div>
                      <div class="plan-price">
                        <span class="price-amount">${symbol}${plan.price.toFixed(2)}</span>
                        <span class="price-cycle">/${plan.billingCycle}</span>
                      </div>
                      <p class="plan-description">${escapeHtml(plan.description || '')}</p>
                      <ul class="plan-features">
                        <li><span class="material-icons-outlined">dns</span> ${plan.limits?.servers || 0} Servers</li>
                        <li><span class="material-icons-outlined">memory</span> ${plan.limits?.memory || 0} MB RAM</li>
                        <li><span class="material-icons-outlined">storage</span> ${plan.limits?.disk || 0} MB Disk</li>
                        <li><span class="material-icons-outlined">speed</span> ${plan.limits?.cpu || 0}% CPU</li>
                      </ul>
                      <button class="btn btn-primary btn-block subscribe-btn" 
                              data-plan-id="${plan.id}" 
                              ${!requirements.met ? 'disabled' : ''}>
                        ${plan.price === 0 ? 'Activate Free Plan' : 'Subscribe'}
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
          
          <aside class="billing-sidebar">
            <div class="detail-card">
              <h3>Payment History</h3>
              <div id="payment-history">
                <div class="loading-spinner"></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;
    
    loadPaymentHistory(symbol);
    setupEventListeners(requirements.met);
    
  } catch (e) {
    app.innerHTML = `<div class="error">Failed to load billing information</div>`;
  }
}

function renderCurrentSubscription(subscription, symbol) {
  const plan = subscription.plan;
  const expiresDate = new Date(subscription.currentPeriodEnd);
  const isExpiringSoon = expiresDate - new Date() < 7 * 24 * 60 * 60 * 1000;
  
  return `
    <div class="detail-card subscription-card">
      <div class="subscription-header">
        <div>
          <h2>Current Subscription</h2>
          <span class="badge badge-${subscription.status === 'active' ? 'success' : 'warning'}">${subscription.status}</span>
        </div>
      </div>
      
      <div class="subscription-details">
        <div class="subscription-plan">
          <h3>${escapeHtml(plan?.name || 'Unknown Plan')}</h3>
          <p class="plan-price">${symbol}${(plan?.price || 0).toFixed(2)}/${plan?.billingCycle || 'month'}</p>
        </div>
        
        <div class="subscription-info">
          <div class="info-item">
            <span class="info-label">Started</span>
            <span class="info-value">${formatDate(subscription.currentPeriodStart)}</span>
          </div>
          <div class="info-item ${isExpiringSoon ? 'expiring-soon' : ''}">
            <span class="info-label">Expires</span>
            <span class="info-value">${formatDate(subscription.currentPeriodEnd)}</span>
          </div>
        </div>
        
        <div class="subscription-limits">
          <h4>Your Limits</h4>
          <div class="limits-grid">
            <div class="limit-item">
              <span class="limit-value">${plan?.limits?.servers || 0}</span>
              <span class="limit-label">Servers</span>
            </div>
            <div class="limit-item">
              <span class="limit-value">${plan?.limits?.memory || 0}</span>
              <span class="limit-label">MB RAM</span>
            </div>
            <div class="limit-item">
              <span class="limit-value">${plan?.limits?.disk || 0}</span>
              <span class="limit-label">MB Disk</span>
            </div>
            <div class="limit-item">
              <span class="limit-value">${plan?.limits?.cpu || 0}%</span>
              <span class="limit-label">CPU</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="subscription-actions">
        <button class="btn btn-danger" id="cancel-subscription-btn">Cancel Subscription</button>
      </div>
    </div>
  `;
}

function renderNoSubscription() {
  return `
    <div class="detail-card">
      <div class="empty-subscription">
        <span class="material-icons-outlined">card_membership</span>
        <h3>No Active Subscription</h3>
        <p>Choose a plan below to get started.</p>
      </div>
    </div>
  `;
}

async function loadPaymentHistory(symbol) {
  const container = document.getElementById('payment-history');
  if (!container) return;
  
  try {
    const [invoicesRes, paymentsRes] = await Promise.all([
      api('/api/billing/my/invoices'),
      api('/api/billing/my/payments')
    ]);
    
    const { invoices } = await invoicesRes.json();
    const { payments } = await paymentsRes.json();
    
    if (invoices.length === 0 && payments.length === 0) {
      container.innerHTML = '<p class="text-muted">No payment history</p>';
      return;
    }
    
    const pendingInvoices = invoices.filter(i => i.status === 'pending');
    
    container.innerHTML = `
      ${pendingInvoices.length > 0 ? `
        <div class="pending-invoices">
          <h4>Pending Invoices</h4>
          ${pendingInvoices.map(inv => `
            <div class="invoice-item pending">
              <div class="invoice-info">
                <span class="invoice-amount">${symbol}${inv.total.toFixed(2)}</span>
                <span class="invoice-date">Due: ${formatDate(inv.dueDate)}</span>
              </div>
              <div class="invoice-actions">
                <button class="btn btn-sm btn-primary pay-invoice-btn" data-invoice='${JSON.stringify(inv)}'>Pay</button>
                <button class="btn btn-sm btn-secondary download-invoice-btn" data-id="${inv.id}" title="Download PDF">
                  <span class="material-icons-outlined" style="font-size: 16px;">download</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="payment-list">
        <h4>Recent Payments</h4>
        ${payments.slice(0, 5).map(pay => `
          <div class="payment-item">
            <div class="payment-info">
              <span class="payment-amount">${symbol}${(pay.amount || 0).toFixed(2)}</span>
              <span class="payment-date">${formatDate(pay.createdAt)}</span>
            </div>
            <span class="badge badge-${pay.status === 'completed' ? 'success' : 'secondary'}">${pay.status}</span>
          </div>
        `).join('')}
        ${payments.length === 0 ? '<p class="text-muted">No payments yet</p>' : ''}
      </div>
    `;
    
    container.querySelectorAll('.pay-invoice-btn').forEach(btn => {
      btn.onclick = () => {
        const invoice = JSON.parse(btn.dataset.invoice);
        showPaymentOptions(invoice);
      };
    });
    
    container.querySelectorAll('.download-invoice-btn').forEach(btn => {
      btn.onclick = () => downloadInvoice(btn.dataset.id);
    });
  } catch (e) {
    container.innerHTML = '<p class="text-muted">Failed to load history</p>';
  }
}

let appliedCoupon = null;

function setupEventListeners(requirementsMet) {
  const couponBtn = document.getElementById('apply-coupon-btn');
  const couponInput = document.getElementById('coupon-code');
  const couponResult = document.getElementById('coupon-result');
  
  if (couponBtn) {
    couponBtn.onclick = async () => {
      const code = couponInput.value.trim();
      if (!code) {
        couponResult.innerHTML = '<span class="text-danger">Please enter a code</span>';
        return;
      }
      
      try {
        const res = await api('/api/billing/validate-coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        
        const data = await res.json();
        
        if (data.valid) {
          appliedCoupon = data.coupon;
          const discountText = data.coupon.type === 'percentage' 
            ? `${data.coupon.value}% off` 
            : `${billingConfig.currencySymbol}${data.coupon.value} off`;
          couponResult.innerHTML = `<span class="text-success">✓ ${discountText} applied!</span>`;
          couponInput.disabled = true;
          couponBtn.textContent = 'Applied';
          couponBtn.disabled = true;
        } else {
          couponResult.innerHTML = `<span class="text-danger">${data.error}</span>`;
          appliedCoupon = null;
        }
      } catch (e) {
        couponResult.innerHTML = '<span class="text-danger">Failed to validate coupon</span>';
        appliedCoupon = null;
      }
    };
  }
  
  document.querySelectorAll('.subscribe-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!requirementsMet) {
        toast.error('Please complete your profile requirements first');
        return;
      }
      
      const planId = btn.dataset.planId;
      
      const confirmed = await modal.confirm({
        title: 'Subscribe to Plan',
        message: appliedCoupon 
          ? `Subscribe with coupon "${appliedCoupon.code}" applied?`
          : 'Are you sure you want to subscribe to this plan?'
      });
      
      if (!confirmed) return;
      
      btn.disabled = true;
      btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
      
      try {
        const payload = { planId };
        if (appliedCoupon) {
          payload.couponCode = appliedCoupon.code;
        }
        
        const res = await api('/api/billing/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (data.success) {
          if (data.invoice && billingConfig.paymentMethods?.stripe) {
            showPaymentOptions(data.invoice);
          } else {
            toast.success(data.message || 'Subscription created');
            setTimeout(() => window.location.reload(), 1000);
          }
        } else {
          toast.error(data.error || 'Failed to subscribe');
          btn.disabled = false;
          btn.textContent = 'Subscribe';
        }
      } catch (e) {
        toast.error('Failed to subscribe');
        btn.disabled = false;
        btn.textContent = 'Subscribe';
      }
    };
  });
  
  const cancelBtn = document.getElementById('cancel-subscription-btn');
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      const confirmed = await modal.confirm({
        title: 'Cancel Subscription',
        message: 'Are you sure you want to cancel your subscription? You will lose access to your current plan benefits.',
        danger: true
      });
      
      if (!confirmed) return;
      
      try {
        const res = await api('/api/billing/cancel', { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
          toast.success('Subscription cancelled');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          toast.error(data.error || 'Failed to cancel');
        }
      } catch (e) {
        toast.error('Failed to cancel subscription');
      }
    };
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

async function showPaymentOptions(invoice) {
  const symbol = billingConfig.currencySymbol || '$';
  
  const html = `
    <div class="payment-options">
      <p style="margin-bottom: 1.5rem;">
        <strong>Amount Due:</strong> ${symbol}${invoice.total.toFixed(2)}
      </p>
      
      ${billingConfig.paymentMethods?.stripe ? `
        <button class="btn btn-primary btn-block" id="pay-stripe-btn" style="margin-bottom: 0.75rem;">
          <span class="material-icons-outlined">credit_card</span>
          Pay with Card (Stripe)
        </button>
      ` : ''}
      
      ${billingConfig.paymentMethods?.paypal ? `
        <button class="btn btn-secondary btn-block" id="pay-paypal-btn" style="margin-bottom: 0.75rem;">
          Pay with PayPal
        </button>
      ` : ''}
      
      ${billingConfig.paymentMethods?.manual ? `
        <div class="manual-payment-info" style="margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
          <h4 style="margin: 0 0 0.5rem;">Manual Payment</h4>
          <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
            Contact admin or follow instructions to complete payment manually.
          </p>
        </div>
      ` : ''}
    </div>
  `;
  
  const confirmed = await modal.custom({
    title: 'Complete Payment',
    html,
    confirmText: 'Close',
    width: '400px'
  });
  
  setTimeout(() => {
    const stripeBtn = document.getElementById('pay-stripe-btn');
    const paypalBtn = document.getElementById('pay-paypal-btn');
    
    if (stripeBtn) {
      stripeBtn.onclick = async () => {
        stripeBtn.disabled = true;
        stripeBtn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
        
        try {
          const res = await api('/api/billing/stripe/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: invoice.id })
          });
          
          const data = await res.json();
          if (data.url) {
            window.location.href = data.url;
          } else {
            toast.error('Failed to create checkout session');
            stripeBtn.disabled = false;
            stripeBtn.innerHTML = '<span class="material-icons-outlined">credit_card</span> Pay with Card';
          }
        } catch (e) {
          toast.error('Payment failed');
          stripeBtn.disabled = false;
        }
      };
    }
    
    if (paypalBtn) {
      paypalBtn.onclick = async () => {
        paypalBtn.disabled = true;
        
        try {
          const res = await api('/api/billing/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: invoice.id })
          });
          
          const data = await res.json();
          if (data.orderId) {
            window.open(`https://www.paypal.com/checkoutnow?token=${data.orderId}`, '_blank');
          } else {
            toast.error('Failed to create PayPal order');
            paypalBtn.disabled = false;
          }
        } catch (e) {
          toast.error('Payment failed');
          paypalBtn.disabled = false;
        }
      };
    }
  }, 100);
}

function downloadInvoice(invoiceId) {
  window.open(`/api/billing/invoices/${invoiceId}/pdf`, '_blank');
}

export function cleanupBilling() {
  appliedCoupon = null;
}
