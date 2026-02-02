import { Router } from 'express';
import { authenticateUser, requireAdmin } from '../utils/auth.js';
import { generateUUID } from '../utils/helpers.js';
import { 
  loadConfig, 
  getAll, 
  findById, 
  insert, 
  updateById, 
  deleteById,
  findByField
} from '../db.js';

const router = Router();

function isBillingEnabled() {
  const config = loadConfig();
  return config.billing?.enabled === true;
}

function getBillingConfig() {
  const config = loadConfig();
  return config.billing || { enabled: false, currency: 'USD', gateways: {} };
}

router.get('/config', authenticateUser, (req, res) => {
  const billing = getBillingConfig();
  res.json({
    enabled: billing.enabled || false,
    currency: billing.currency || 'USD',
    currencySymbol: billing.currencySymbol || '$'
  });
});

router.get('/plans', (req, res) => {
  if (!isBillingEnabled()) {
    return res.json({ plans: [], enabled: false });
  }
  
  const plans = getAll('billingPlans').filter(p => p.active !== false);
  res.json({ 
    plans: plans.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      period: p.period,
      features: p.features,
      limits: p.limits,
      popular: p.popular
    })),
    enabled: true
  });
});

router.get('/plans/:id', (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(404).json({ error: 'Billing is disabled' });
  }
  
  const plan = findById('billingPlans', req.params.id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  res.json({ plan });
});

router.get('/subscription', authenticateUser, (req, res) => {
  if (!isBillingEnabled()) {
    return res.json({ subscription: null, enabled: false });
  }
  
  const subscriptions = findByField('subscriptions', 'user_id', req.user.id);
  const active = subscriptions.find(s => s.status === 'active');
  
  if (!active) {
    return res.json({ subscription: null, enabled: true });
  }
  
  const plan = findById('billingPlans', active.plan_id);
  res.json({ 
    subscription: {
      ...active,
      plan
    },
    enabled: true
  });
});

router.post('/subscribe/:planId', authenticateUser, async (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(400).json({ error: 'Billing is disabled' });
  }
  
  const plan = findById('billingPlans', req.params.planId);
  if (!plan || plan.active === false) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  const existingSubs = findByField('subscriptions', 'user_id', req.user.id);
  const activeSub = existingSubs.find(s => s.status === 'active');
  if (activeSub) {
    return res.status(400).json({ error: 'You already have an active subscription' });
  }
  
  const billing = getBillingConfig();
  const gateway = req.body.gateway || 'manual';
  
  if (plan.price > 0 && gateway === 'manual') {
    const subscription = {
      id: generateUUID(),
      user_id: req.user.id,
      plan_id: plan.id,
      status: 'pending',
      gateway: 'manual',
      created_at: new Date().toISOString(),
      expires_at: null
    };
    insert('subscriptions', subscription);
    return res.json({ 
      subscription,
      message: 'Subscription created. Awaiting admin approval.',
      requiresPayment: false
    });
  }
  
  if (plan.price === 0) {
    const now = new Date();
    let expiresAt = null;
    if (plan.period === 'monthly') {
      expiresAt = new Date(now.setMonth(now.getMonth() + 1)).toISOString();
    } else if (plan.period === 'yearly') {
      expiresAt = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
    }
    
    const subscription = {
      id: generateUUID(),
      user_id: req.user.id,
      plan_id: plan.id,
      status: 'active',
      gateway: 'free',
      created_at: new Date().toISOString(),
      expires_at: expiresAt
    };
    insert('subscriptions', subscription);
    
    applyPlanLimitsToUser(req.user.id, plan);
    
    return res.json({ subscription, requiresPayment: false });
  }
  
  res.status(400).json({ error: 'Payment gateway not configured' });
});

router.post('/cancel', authenticateUser, (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(400).json({ error: 'Billing is disabled' });
  }
  
  const subscriptions = findByField('subscriptions', 'user_id', req.user.id);
  const activeSub = subscriptions.find(s => s.status === 'active');
  
  if (!activeSub) {
    return res.status(404).json({ error: 'No active subscription' });
  }
  
  updateById('subscriptions', activeSub.id, { 
    status: 'cancelled',
    cancelled_at: new Date().toISOString()
  });
  
  res.json({ success: true });
});

router.get('/payments', authenticateUser, (req, res) => {
  if (!isBillingEnabled()) {
    return res.json({ payments: [] });
  }
  
  const payments = findByField('payments', 'user_id', req.user.id);
  res.json({ payments: payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
});


router.get('/admin/plans', authenticateUser, requireAdmin, (req, res) => {
  const plans = getAll('billingPlans');
  res.json({ plans });
});

router.post('/admin/plans', authenticateUser, requireAdmin, (req, res) => {
  const { plan } = req.body;
  
  if (!plan?.name) {
    return res.status(400).json({ error: 'Plan name is required' });
  }
  
  const newPlan = {
    id: generateUUID(),
    name: plan.name,
    description: plan.description || '',
    price: parseFloat(plan.price) || 0,
    period: plan.period || 'monthly',
    features: plan.features || [],
    limits: {
      servers: parseInt(plan.limits?.servers) || 1,
      memory: parseInt(plan.limits?.memory) || 1024,
      disk: parseInt(plan.limits?.disk) || 5120,
      cpu: parseInt(plan.limits?.cpu) || 100
    },
    popular: plan.popular || false,
    active: plan.active !== false,
    created_at: new Date().toISOString()
  };
  
  insert('billingPlans', newPlan);
  res.json({ plan: newPlan });
});

router.put('/admin/plans/:id', authenticateUser, requireAdmin, (req, res) => {
  const plan = findById('billingPlans', req.params.id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  const { updates } = req.body;
  const updatedPlan = updateById('billingPlans', req.params.id, {
    ...updates,
    updated_at: new Date().toISOString()
  });
  
  res.json({ plan: updatedPlan });
});

router.delete('/admin/plans/:id', authenticateUser, requireAdmin, (req, res) => {
  const plan = findById('billingPlans', req.params.id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  const subs = findByField('subscriptions', 'plan_id', req.params.id);
  const activeSubs = subs.filter(s => s.status === 'active');
  if (activeSubs.length > 0) {
    return res.status(400).json({ error: 'Cannot delete plan with active subscriptions' });
  }
  
  deleteById('billingPlans', req.params.id);
  res.json({ success: true });
});

router.get('/admin/subscriptions', authenticateUser, requireAdmin, (req, res) => {
  const { status, page = 1, per_page = 20 } = req.query;
  let subscriptions = getAll('subscriptions');
  
  if (status) {
    subscriptions = subscriptions.filter(s => s.status === status);
  }
  
  subscriptions = subscriptions.map(sub => {
    const plan = findById('billingPlans', sub.plan_id);
    return { ...sub, plan };
  });
  
  const total = subscriptions.length;
  const start = (page - 1) * per_page;
  const paginated = subscriptions.slice(start, start + parseInt(per_page));
  
  res.json({
    subscriptions: paginated,
    meta: {
      total,
      current_page: parseInt(page),
      per_page: parseInt(per_page),
      total_pages: Math.ceil(total / per_page)
    }
  });
});

router.put('/admin/subscriptions/:id', authenticateUser, requireAdmin, (req, res) => {
  const sub = findById('subscriptions', req.params.id);
  if (!sub) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  
  const { status } = req.body;
  const updates = { status, updated_at: new Date().toISOString() };
  
  if (status === 'active' && sub.status === 'pending') {
    const plan = findById('billingPlans', sub.plan_id);
    if (plan) {
      const now = new Date();
      if (plan.period === 'monthly') {
        updates.expires_at = new Date(now.setMonth(now.getMonth() + 1)).toISOString();
      } else if (plan.period === 'yearly') {
        updates.expires_at = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
      }
      updates.activated_at = new Date().toISOString();
      applyPlanLimitsToUser(sub.user_id, plan);
    }
  }
  
  const updated = updateById('subscriptions', req.params.id, updates);
  res.json({ subscription: updated });
});

router.get('/admin/payments', authenticateUser, requireAdmin, (req, res) => {
  const { page = 1, per_page = 20 } = req.query;
  const payments = getAll('payments').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const total = payments.length;
  const start = (page - 1) * per_page;
  const paginated = payments.slice(start, start + parseInt(per_page));
  
  res.json({
    payments: paginated,
    meta: {
      total,
      current_page: parseInt(page),
      per_page: parseInt(per_page),
      total_pages: Math.ceil(total / per_page)
    }
  });
});

function applyPlanLimitsToUser(userId, plan) {
  if (!plan?.limits) return;
  
  const user = findById('users', userId);
  if (!user) return;
  
  updateById('users', userId, {
    limits: {
      servers: plan.limits.servers,
      memory: plan.limits.memory,
      disk: plan.limits.disk,
      cpu: plan.limits.cpu
    },
    plan_id: plan.id
  });
}

export default router;
