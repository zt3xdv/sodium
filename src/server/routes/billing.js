import express from 'express';
import {
  loadBillingPlans, saveBillingPlans,
  loadBillingSubscriptions, saveBillingSubscriptions,
  loadBillingPayments, saveBillingPayments,
  loadBillingInvoices, saveBillingInvoices,
  loadBillingCoupons, saveBillingCoupons,
  loadUsers, saveUsers,
  loadServers, saveServers,
  loadNodes,
  loadConfig, saveConfig
} from '../db.js';
import { authenticateUser, requireAdmin } from '../utils/auth.js';
import { generateUUID, sanitizeText, wingsRequest } from '../utils/helpers.js';
import { logActivity, ACTIVITY_TYPES } from '../utils/activity.js';
import { 
  sendInvoiceCreatedEmail, 
  sendPaymentReceivedEmail,
  sendSubscriptionExpiringEmail
} from '../utils/mail.js';
import logger from '../utils/logger.js';

const router = express.Router();

function isBillingEnabled() {
  const config = loadConfig();
  return config.billing?.enabled || false;
}

function checkBillingRequirements(user) {
  const config = loadConfig();
  const errors = [];
  
  if (config.billing?.requireEmail && !user.email) {
    errors.push('Email address is required for billing');
  }
  
  if (config.billing?.requireEmailVerification && !user.emailVerified) {
    errors.push('Email verification is required for billing');
  }
  
  return errors;
}

function calculatePeriodEnd(startDate, billingCycle) {
  const periodEnd = new Date(startDate);
  if (billingCycle === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else if (billingCycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else if (billingCycle === 'weekly') {
    periodEnd.setDate(periodEnd.getDate() + 7);
  }
  return periodEnd;
}

function calculateProration(oldPlan, newPlan, subscription) {
  const now = new Date();
  const periodStart = new Date(subscription.currentPeriodStart);
  const periodEnd = new Date(subscription.currentPeriodEnd);
  const totalDays = (periodEnd - periodStart) / (1000 * 60 * 60 * 24);
  const remainingDays = Math.max(0, (periodEnd - now) / (1000 * 60 * 60 * 24));
  
  const dailyRateOld = oldPlan.price / totalDays;
  const unusedCredit = dailyRateOld * remainingDays;
  
  const newPeriodEnd = calculatePeriodEnd(now, newPlan.billingCycle);
  const newTotalDays = (newPeriodEnd - now) / (1000 * 60 * 60 * 24);
  const newAmount = (newPlan.price / (newPlan.billingCycle === 'monthly' ? 30 : newPlan.billingCycle === 'yearly' ? 365 : 7)) * newTotalDays;
  
  const proratedAmount = Math.max(0, newAmount - unusedCredit);
  
  return {
    unusedCredit: Math.round(unusedCredit * 100) / 100,
    newAmount: Math.round(newAmount * 100) / 100,
    proratedAmount: Math.round(proratedAmount * 100) / 100,
    remainingDays: Math.round(remainingDays),
    newPeriodEnd
  };
}

// ==================== PUBLIC ROUTES ====================

router.get('/config', (req, res) => {
  const config = loadConfig();
  res.json({
    enabled: config.billing?.enabled || false,
    currency: config.billing?.currency || 'USD',
    currencySymbol: config.billing?.currencySymbol || '$',
    requireEmail: config.billing?.requireEmail || false,
    requireEmailVerification: config.billing?.requireEmailVerification || false,
    paymentMethods: {
      stripe: config.billing?.paymentMethods?.stripe?.enabled || false,
      paypal: config.billing?.paymentMethods?.paypal?.enabled || false,
      manual: config.billing?.paymentMethods?.manual?.enabled || false
    }
  });
});

router.get('/plans', (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const data = loadBillingPlans();
  const activePlans = data.billingPlans.filter(p => p.active && p.visible);
  res.json({ plans: activePlans });
});

router.get('/plans/:id', (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const data = loadBillingPlans();
  const plan = data.billingPlans.find(p => p.id === req.params.id && p.active);
  
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  res.json({ plan });
});

// ==================== COUPON VALIDATION (PUBLIC) ====================

router.post('/validate-coupon', (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const { code, planId } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Coupon code is required' });
  }
  
  const coupons = loadBillingCoupons();
  const coupon = coupons.billingCoupons.find(c => 
    c.code.toUpperCase() === code.toUpperCase() && c.active
  );
  
  if (!coupon) {
    return res.status(404).json({ error: 'Invalid coupon code' });
  }
  
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'Coupon has expired' });
  }
  
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return res.status(400).json({ error: 'Coupon has reached maximum uses' });
  }
  
  if (coupon.planIds && coupon.planIds.length > 0 && planId) {
    if (!coupon.planIds.includes(planId)) {
      return res.status(400).json({ error: 'Coupon not valid for this plan' });
    }
  }
  
  res.json({
    valid: true,
    coupon: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      description: coupon.description
    }
  });
});

// ==================== USER ROUTES ====================

router.use(authenticateUser);

router.get('/requirements', (req, res) => {
  const users = loadUsers();
  const user = users.users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const errors = checkBillingRequirements(user);
  res.json({
    met: errors.length === 0,
    errors,
    email: user.email || null,
    emailVerified: user.emailVerified || false
  });
});

router.get('/my/subscription', (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const data = loadBillingSubscriptions();
  const subscription = data.billingSubscriptions.find(
    s => s.userId === req.user.id && (s.status === 'active' || s.status === 'pending')
  );
  
  if (!subscription) {
    return res.json({ subscription: null });
  }
  
  const plans = loadBillingPlans();
  const plan = plans.billingPlans.find(p => p.id === subscription.planId);
  
  res.json({ subscription: { ...subscription, plan } });
});

router.get('/my/invoices', (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const data = loadBillingInvoices();
  const invoices = data.billingInvoices
    .filter(i => i.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ invoices });
});

router.get('/my/payments', (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const data = loadBillingPayments();
  const payments = data.billingPayments
    .filter(p => p.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ payments });
});

router.post('/subscribe', async (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const { planId, paymentMethod, couponCode } = req.body;
  
  if (!planId) {
    return res.status(400).json({ error: 'Plan ID is required' });
  }
  
  const users = loadUsers();
  const user = users.users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const requirements = checkBillingRequirements(user);
  if (requirements.length > 0) {
    return res.status(400).json({ error: requirements[0], requirements });
  }
  
  const plans = loadBillingPlans();
  const plan = plans.billingPlans.find(p => p.id === planId && p.active);
  
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found or inactive' });
  }
  
  const subs = loadBillingSubscriptions();
  const existingSub = subs.billingSubscriptions.find(
    s => s.userId === req.user.id && (s.status === 'active' || s.status === 'pending')
  );
  
  if (existingSub) {
    return res.status(400).json({ error: 'You already have an active subscription' });
  }
  
  let discount = 0;
  let appliedCoupon = null;
  
  if (couponCode) {
    const coupons = loadBillingCoupons();
    const coupon = coupons.billingCoupons.find(c => 
      c.code.toUpperCase() === couponCode.toUpperCase() && c.active
    );
    
    if (coupon && (!coupon.expiresAt || new Date(coupon.expiresAt) >= new Date())) {
      if (!coupon.maxUses || coupon.usedCount < coupon.maxUses) {
        if (!coupon.planIds || coupon.planIds.length === 0 || coupon.planIds.includes(planId)) {
          if (coupon.type === 'percentage') {
            discount = plan.price * (coupon.value / 100);
          } else {
            discount = Math.min(coupon.value, plan.price);
          }
          appliedCoupon = coupon;
          
          const couponIdx = coupons.billingCoupons.findIndex(c => c.id === coupon.id);
          coupons.billingCoupons[couponIdx].usedCount = (coupon.usedCount || 0) + 1;
          saveBillingCoupons(coupons);
        }
      }
    }
  }
  
  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, plan.billingCycle);
  const finalPrice = Math.max(0, plan.price - discount);
  
  const subscription = {
    id: generateUUID(),
    userId: req.user.id,
    planId: plan.id,
    status: finalPrice === 0 ? 'active' : 'pending',
    paymentMethod: paymentMethod || 'manual',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    couponId: appliedCoupon?.id || null,
    discount: discount,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  
  subs.billingSubscriptions.push(subscription);
  saveBillingSubscriptions(subs);
  
  if (finalPrice > 0) {
    const invoices = loadBillingInvoices();
    const config = loadConfig();
    const taxAmount = finalPrice * (config.billing?.taxRate || 0) / 100;
    
    const invoice = {
      id: generateUUID(),
      invoiceNumber: `INV-${Date.now()}`,
      userId: req.user.id,
      subscriptionId: subscription.id,
      planId: plan.id,
      amount: plan.price,
      discount: discount,
      tax: taxAmount,
      total: finalPrice + taxAmount,
      currency: config.billing?.currency || 'USD',
      status: 'pending',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      couponId: appliedCoupon?.id || null,
      couponCode: appliedCoupon?.code || null,
      createdAt: now.toISOString()
    };
    
    invoices.billingInvoices.push(invoice);
    saveBillingInvoices(invoices);
    
    logActivity(req.user.id, ACTIVITY_TYPES.BILLING, { 
      action: 'invoice_created', 
      invoiceId: invoice.id,
      amount: invoice.total 
    }, req.ip);
    
    if (config.billing?.notifications?.invoiceCreated && user.email) {
      sendInvoiceCreatedEmail(user.email, user.username, invoice, plan).catch(e => 
        logger.warn(`Failed to send invoice email: ${e.message}`)
      );
    }
    
    res.json({ 
      success: true, 
      subscription, 
      invoice,
      discount: discount > 0 ? discount : undefined,
      message: 'Subscription created. Please complete payment.' 
    });
  } else {
    applyPlanLimits(user, plan);
    users.users = users.users.map(u => u.id === user.id ? user : u);
    saveUsers(users);
    
    logActivity(req.user.id, ACTIVITY_TYPES.BILLING, { 
      action: 'subscription_activated', 
      planId: plan.id 
    }, req.ip);
    
    res.json({ 
      success: true, 
      subscription,
      message: 'Free plan activated successfully' 
    });
  }
});

// Upgrade/Downgrade plan
router.post('/change-plan', async (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const { planId } = req.body;
  
  if (!planId) {
    return res.status(400).json({ error: 'Plan ID is required' });
  }
  
  const users = loadUsers();
  const user = users.users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const subs = loadBillingSubscriptions();
  const currentSub = subs.billingSubscriptions.find(
    s => s.userId === req.user.id && s.status === 'active'
  );
  
  if (!currentSub) {
    return res.status(404).json({ error: 'No active subscription found' });
  }
  
  const plans = loadBillingPlans();
  const currentPlan = plans.billingPlans.find(p => p.id === currentSub.planId);
  const newPlan = plans.billingPlans.find(p => p.id === planId && p.active);
  
  if (!newPlan) {
    return res.status(404).json({ error: 'New plan not found or inactive' });
  }
  
  if (newPlan.id === currentPlan.id) {
    return res.status(400).json({ error: 'Already on this plan' });
  }
  
  const proration = calculateProration(currentPlan, newPlan, currentSub);
  
  res.json({
    success: true,
    proration,
    currentPlan: { id: currentPlan.id, name: currentPlan.name, price: currentPlan.price },
    newPlan: { id: newPlan.id, name: newPlan.name, price: newPlan.price }
  });
});

router.post('/change-plan/confirm', async (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const { planId } = req.body;
  
  const users = loadUsers();
  const user = users.users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const subs = loadBillingSubscriptions();
  const subIdx = subs.billingSubscriptions.findIndex(
    s => s.userId === req.user.id && s.status === 'active'
  );
  
  if (subIdx === -1) {
    return res.status(404).json({ error: 'No active subscription found' });
  }
  
  const currentSub = subs.billingSubscriptions[subIdx];
  const plans = loadBillingPlans();
  const currentPlan = plans.billingPlans.find(p => p.id === currentSub.planId);
  const newPlan = plans.billingPlans.find(p => p.id === planId && p.active);
  
  if (!newPlan) {
    return res.status(404).json({ error: 'New plan not found' });
  }
  
  const proration = calculateProration(currentPlan, newPlan, currentSub);
  const now = new Date();
  const config = loadConfig();
  
  if (proration.proratedAmount > 0) {
    const invoices = loadBillingInvoices();
    const taxAmount = proration.proratedAmount * (config.billing?.taxRate || 0) / 100;
    
    const invoice = {
      id: generateUUID(),
      invoiceNumber: `INV-${Date.now()}`,
      userId: req.user.id,
      subscriptionId: currentSub.id,
      planId: newPlan.id,
      type: 'upgrade',
      amount: proration.newAmount,
      credit: proration.unusedCredit,
      discount: 0,
      tax: taxAmount,
      total: proration.proratedAmount + taxAmount,
      currency: config.billing?.currency || 'USD',
      status: 'pending',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString()
    };
    
    invoices.billingInvoices.push(invoice);
    saveBillingInvoices(invoices);
    
    subs.billingSubscriptions[subIdx].pendingPlanId = newPlan.id;
    subs.billingSubscriptions[subIdx].updatedAt = now.toISOString();
    saveBillingSubscriptions(subs);
    
    res.json({ 
      success: true, 
      invoice,
      message: 'Please complete payment to upgrade your plan'
    });
  } else {
    subs.billingSubscriptions[subIdx].planId = newPlan.id;
    subs.billingSubscriptions[subIdx].currentPeriodEnd = proration.newPeriodEnd.toISOString();
    subs.billingSubscriptions[subIdx].updatedAt = now.toISOString();
    saveBillingSubscriptions(subs);
    
    applyPlanLimits(user, newPlan);
    users.users = users.users.map(u => u.id === user.id ? user : u);
    saveUsers(users);
    
    logActivity(req.user.id, ACTIVITY_TYPES.BILLING, { 
      action: 'plan_changed',
      oldPlanId: currentPlan.id,
      newPlanId: newPlan.id
    }, req.ip);
    
    res.json({ 
      success: true, 
      message: 'Plan changed successfully. Credit applied.'
    });
  }
});

router.post('/cancel', (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const subs = loadBillingSubscriptions();
  const subIdx = subs.billingSubscriptions.findIndex(
    s => s.userId === req.user.id && s.status === 'active'
  );
  
  if (subIdx === -1) {
    return res.status(404).json({ error: 'No active subscription found' });
  }
  
  subs.billingSubscriptions[subIdx].status = 'cancelled';
  subs.billingSubscriptions[subIdx].cancelledAt = new Date().toISOString();
  subs.billingSubscriptions[subIdx].updatedAt = new Date().toISOString();
  saveBillingSubscriptions(subs);
  
  logActivity(req.user.id, ACTIVITY_TYPES.BILLING, { 
    action: 'subscription_cancelled' 
  }, req.ip);
  
  res.json({ success: true, message: 'Subscription cancelled' });
});

// Invoice PDF download
router.get('/invoices/:id/pdf', async (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const invoices = loadBillingInvoices();
  const invoice = invoices.billingInvoices.find(i => 
    i.id === req.params.id && i.userId === req.user.id
  );
  
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  const users = loadUsers();
  const user = users.users.find(u => u.id === invoice.userId);
  const plans = loadBillingPlans();
  const plan = plans.billingPlans.find(p => p.id === invoice.planId);
  const config = loadConfig();
  
  const pdfContent = generateInvoicePDF(invoice, user, plan, config);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber || invoice.id}.pdf"`);
  res.send(pdfContent);
});

function applyPlanLimits(user, plan) {
  if (plan.limits) {
    user.limits = {
      ...user.limits,
      servers: plan.limits.servers ?? user.limits?.servers,
      memory: plan.limits.memory ?? user.limits?.memory,
      disk: plan.limits.disk ?? user.limits?.disk,
      cpu: plan.limits.cpu ?? user.limits?.cpu,
      backups: plan.limits.backups ?? user.limits?.backups,
      allocations: plan.limits.allocations ?? user.limits?.allocations
    };
  }
}

function generateInvoicePDF(invoice, user, plan, config) {
  const symbol = config.billing?.currencySymbol || '$';
  const panelName = config.panel?.name || 'Sodium Panel';
  
  const pdfHeader = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
4 0 obj << /Length 6 0 R >>
stream
`;

  const content = `
BT
/F1 24 Tf
50 720 Td
(INVOICE) Tj
/F1 12 Tf
0 -30 Td
(${panelName}) Tj
0 -20 Td
(Invoice #: ${invoice.invoiceNumber || invoice.id.substring(0, 8)}) Tj
0 -15 Td
(Date: ${new Date(invoice.createdAt).toLocaleDateString()}) Tj
0 -15 Td
(Due: ${new Date(invoice.dueDate).toLocaleDateString()}) Tj
0 -15 Td
(Status: ${invoice.status.toUpperCase()}) Tj
0 -40 Td
(Bill To:) Tj
0 -15 Td
(${user?.username || 'Customer'}) Tj
0 -15 Td
(${user?.email || ''}) Tj
0 -40 Td
(Description) Tj
350 0 Td
(Amount) Tj
-350 -20 Td
(${plan?.name || 'Subscription'} - ${plan?.billingCycle || 'Monthly'}) Tj
350 0 Td
(${symbol}${invoice.amount?.toFixed(2) || '0.00'}) Tj
${invoice.discount > 0 ? `-350 -15 Td (Discount) Tj 350 0 Td (-${symbol}${invoice.discount.toFixed(2)}) Tj` : ''}
${invoice.tax > 0 ? `-350 -15 Td (Tax) Tj 350 0 Td (${symbol}${invoice.tax.toFixed(2)}) Tj` : ''}
-350 -25 Td
/F1 14 Tf
(TOTAL) Tj
350 0 Td
(${symbol}${invoice.total?.toFixed(2) || '0.00'}) Tj
ET
`;

  const pdfFooter = `
endstream
endobj
6 0 obj ${content.length} endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000214 00000 n 
trailer << /Size 7 /Root 1 0 R >>
startxref
%%EOF`;

  return Buffer.from(pdfHeader + content + pdfFooter);
}

// ==================== STRIPE INTEGRATION ====================

router.post('/stripe/create-checkout', async (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const config = loadConfig();
  const stripeConfig = config.billing?.paymentMethods?.stripe;
  
  if (!stripeConfig?.enabled || !stripeConfig?.secretKey) {
    return res.status(400).json({ error: 'Stripe is not configured' });
  }
  
  const { invoiceId } = req.body;
  
  const invoices = loadBillingInvoices();
  const invoice = invoices.billingInvoices.find(i => 
    i.id === invoiceId && i.userId === req.user.id && i.status === 'pending'
  );
  
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  const plans = loadBillingPlans();
  const plan = plans.billingPlans.find(p => p.id === invoice.planId);
  
  try {
    const stripe = (await import('stripe')).default(stripeConfig.secretKey);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: invoice.currency.toLowerCase(),
          product_data: {
            name: plan?.name || 'Subscription',
            description: `${plan?.billingCycle || 'Monthly'} subscription`
          },
          unit_amount: Math.round(invoice.total * 100)
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${config.panel?.url}/billing?payment=success&invoice=${invoice.id}`,
      cancel_url: `${config.panel?.url}/billing?payment=cancelled`,
      metadata: {
        invoiceId: invoice.id,
        userId: req.user.id
      }
    });
    
    const invIdx = invoices.billingInvoices.findIndex(i => i.id === invoice.id);
    invoices.billingInvoices[invIdx].stripeSessionId = session.id;
    saveBillingInvoices(invoices);
    
    res.json({ sessionId: session.id, url: session.url });
  } catch (e) {
    logger.error(`Stripe checkout error: ${e.message}`);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const config = loadConfig();
  const stripeConfig = config.billing?.paymentMethods?.stripe;
  
  if (!stripeConfig?.enabled || !stripeConfig?.secretKey) {
    return res.status(400).json({ error: 'Stripe not configured' });
  }
  
  const stripe = (await import('stripe')).default(stripeConfig.secretKey);
  const sig = req.headers['stripe-signature'];
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeConfig.webhookSecret);
  } catch (e) {
    logger.error(`Stripe webhook error: ${e.message}`);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoiceId;
    
    if (invoiceId) {
      await processPaymentSuccess(invoiceId, 'stripe', session.payment_intent);
    }
  }
  
  res.json({ received: true });
});

// ==================== PAYPAL INTEGRATION ====================

router.post('/paypal/create-order', async (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const config = loadConfig();
  const paypalConfig = config.billing?.paymentMethods?.paypal;
  
  if (!paypalConfig?.enabled || !paypalConfig?.clientId || !paypalConfig?.clientSecret) {
    return res.status(400).json({ error: 'PayPal is not configured' });
  }
  
  const { invoiceId } = req.body;
  
  const invoices = loadBillingInvoices();
  const invoice = invoices.billingInvoices.find(i => 
    i.id === invoiceId && i.userId === req.user.id && i.status === 'pending'
  );
  
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  try {
    const baseUrl = paypalConfig.sandbox 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';
    
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${paypalConfig.clientId}:${paypalConfig.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    const authData = await authResponse.json();
    
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: invoice.currency,
            value: invoice.total.toFixed(2)
          },
          custom_id: invoice.id
        }]
      })
    });
    
    const order = await orderResponse.json();
    
    const invIdx = invoices.billingInvoices.findIndex(i => i.id === invoice.id);
    invoices.billingInvoices[invIdx].paypalOrderId = order.id;
    saveBillingInvoices(invoices);
    
    res.json({ orderId: order.id });
  } catch (e) {
    logger.error(`PayPal order error: ${e.message}`);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
});

router.post('/paypal/capture-order', async (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(403).json({ error: 'Billing is not enabled' });
  }
  
  const config = loadConfig();
  const paypalConfig = config.billing?.paymentMethods?.paypal;
  
  if (!paypalConfig?.enabled) {
    return res.status(400).json({ error: 'PayPal is not configured' });
  }
  
  const { orderId } = req.body;
  
  try {
    const baseUrl = paypalConfig.sandbox 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';
    
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${paypalConfig.clientId}:${paypalConfig.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    const authData = await authResponse.json();
    
    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const captureData = await captureResponse.json();
    
    if (captureData.status === 'COMPLETED') {
      const invoiceId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id || 
                        captureData.purchase_units?.[0]?.custom_id;
      
      if (invoiceId) {
        await processPaymentSuccess(invoiceId, 'paypal', captureData.id);
      }
      
      res.json({ success: true, captureData });
    } else {
      res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (e) {
    logger.error(`PayPal capture error: ${e.message}`);
    res.status(500).json({ error: 'Failed to capture PayPal payment' });
  }
});

async function processPaymentSuccess(invoiceId, method, transactionId) {
  const invoices = loadBillingInvoices();
  const invIdx = invoices.billingInvoices.findIndex(i => i.id === invoiceId);
  
  if (invIdx === -1) return;
  
  const invoice = invoices.billingInvoices[invIdx];
  const now = new Date().toISOString();
  
  invoice.status = 'paid';
  invoice.paidAt = now;
  invoice.paymentMethod = method;
  invoice.transactionId = transactionId;
  saveBillingInvoices(invoices);
  
  const payments = loadBillingPayments();
  const payment = {
    id: generateUUID(),
    userId: invoice.userId,
    invoiceId: invoice.id,
    subscriptionId: invoice.subscriptionId,
    amount: invoice.total,
    currency: invoice.currency,
    method: method,
    transactionId: transactionId,
    status: 'completed',
    createdAt: now
  };
  payments.billingPayments.push(payment);
  saveBillingPayments(payments);
  
  if (invoice.subscriptionId) {
    const subs = loadBillingSubscriptions();
    const subIdx = subs.billingSubscriptions.findIndex(s => s.id === invoice.subscriptionId);
    
    if (subIdx !== -1) {
      const sub = subs.billingSubscriptions[subIdx];
      
      if (sub.pendingPlanId) {
        sub.planId = sub.pendingPlanId;
        delete sub.pendingPlanId;
      }
      
      sub.status = 'active';
      sub.updatedAt = now;
      saveBillingSubscriptions(subs);
      
      const plans = loadBillingPlans();
      const plan = plans.billingPlans.find(p => p.id === sub.planId);
      
      if (plan) {
        const users = loadUsers();
        const user = users.users.find(u => u.id === invoice.userId);
        
        if (user) {
          applyPlanLimits(user, plan);
          
          if (user.suspended && user.suspendReason === 'billing') {
            user.suspended = false;
            delete user.suspendReason;
            unsuspendUserServers(user.id);
          }
          
          users.users = users.users.map(u => u.id === user.id ? user : u);
          saveUsers(users);
          
          const config = loadConfig();
          if (config.billing?.notifications?.paymentReceived && user.email) {
            sendPaymentReceivedEmail(user.email, user.username, payment).catch(e => 
              logger.warn(`Failed to send payment email: ${e.message}`)
            );
          }
        }
      }
    }
  }
  
  logActivity(invoice.userId, ACTIVITY_TYPES.BILLING, { 
    action: 'payment_completed',
    invoiceId: invoice.id,
    amount: invoice.total,
    method: method
  });
}

// ==================== ADMIN ROUTES ====================

router.use('/admin', requireAdmin);

router.get('/admin/stats', (req, res) => {
  const plans = loadBillingPlans();
  const subs = loadBillingSubscriptions();
  const payments = loadBillingPayments();
  const invoices = loadBillingInvoices();
  const coupons = loadBillingCoupons();
  
  const activeSubs = subs.billingSubscriptions.filter(s => s.status === 'active').length;
  const totalRevenue = payments.billingPayments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingInvoices = invoices.billingInvoices.filter(i => i.status === 'pending').length;
  const overdueInvoices = invoices.billingInvoices.filter(i => 
    i.status === 'pending' && new Date(i.dueDate) < new Date()
  ).length;
  
  res.json({
    plans: plans.billingPlans.length,
    activePlans: plans.billingPlans.filter(p => p.active).length,
    subscriptions: subs.billingSubscriptions.length,
    activeSubscriptions: activeSubs,
    payments: payments.billingPayments.length,
    totalRevenue,
    pendingInvoices,
    overdueInvoices,
    activeCoupons: coupons.billingCoupons.filter(c => c.active).length
  });
});

router.get('/admin/plans', (req, res) => {
  const data = loadBillingPlans();
  res.json({ plans: data.billingPlans });
});

router.post('/admin/plans', (req, res) => {
  const { plan } = req.body;
  
  if (!plan?.name || plan.price === undefined) {
    return res.status(400).json({ error: 'Plan name and price are required' });
  }
  
  const data = loadBillingPlans();
  const newPlan = {
    id: generateUUID(),
    name: sanitizeText(plan.name),
    description: sanitizeText(plan.description || ''),
    price: parseFloat(plan.price) || 0,
    billingCycle: plan.billingCycle || 'monthly',
    features: plan.features || [],
    limits: {
      servers: parseInt(plan.limits?.servers) || 2,
      memory: parseInt(plan.limits?.memory) || 2048,
      disk: parseInt(plan.limits?.disk) || 10240,
      cpu: parseInt(plan.limits?.cpu) || 200,
      backups: parseInt(plan.limits?.backups) || 3,
      allocations: parseInt(plan.limits?.allocations) || 5
    },
    active: plan.active !== false,
    visible: plan.visible !== false,
    sortOrder: parseInt(plan.sortOrder) || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.billingPlans.push(newPlan);
  saveBillingPlans(data);
  
  res.json({ success: true, plan: newPlan });
});

router.put('/admin/plans/:id', (req, res) => {
  const { plan } = req.body;
  const data = loadBillingPlans();
  const idx = data.billingPlans.findIndex(p => p.id === req.params.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  const current = data.billingPlans[idx];
  data.billingPlans[idx] = {
    ...current,
    name: plan.name ? sanitizeText(plan.name) : current.name,
    description: plan.description !== undefined ? sanitizeText(plan.description) : current.description,
    price: plan.price !== undefined ? parseFloat(plan.price) : current.price,
    billingCycle: plan.billingCycle || current.billingCycle,
    features: plan.features || current.features,
    limits: plan.limits ? {
      servers: parseInt(plan.limits.servers) ?? current.limits?.servers,
      memory: parseInt(plan.limits.memory) ?? current.limits?.memory,
      disk: parseInt(plan.limits.disk) ?? current.limits?.disk,
      cpu: parseInt(plan.limits.cpu) ?? current.limits?.cpu,
      backups: parseInt(plan.limits.backups) ?? current.limits?.backups,
      allocations: parseInt(plan.limits.allocations) ?? current.limits?.allocations
    } : current.limits,
    active: plan.active !== undefined ? plan.active : current.active,
    visible: plan.visible !== undefined ? plan.visible : current.visible,
    sortOrder: plan.sortOrder !== undefined ? parseInt(plan.sortOrder) : current.sortOrder,
    updatedAt: new Date().toISOString()
  };
  
  saveBillingPlans(data);
  res.json({ success: true, plan: data.billingPlans[idx] });
});

router.delete('/admin/plans/:id', (req, res) => {
  const data = loadBillingPlans();
  const subs = loadBillingSubscriptions();
  
  const activeSubs = subs.billingSubscriptions.filter(
    s => s.planId === req.params.id && s.status === 'active'
  );
  
  if (activeSubs.length > 0) {
    return res.status(400).json({ 
      error: `Cannot delete plan with ${activeSubs.length} active subscriptions` 
    });
  }
  
  data.billingPlans = data.billingPlans.filter(p => p.id !== req.params.id);
  saveBillingPlans(data);
  
  res.json({ success: true });
});

// ==================== COUPON ADMIN ROUTES ====================

router.get('/admin/coupons', (req, res) => {
  const data = loadBillingCoupons();
  res.json({ coupons: data.billingCoupons });
});

router.post('/admin/coupons', (req, res) => {
  const { coupon } = req.body;
  
  if (!coupon?.code || !coupon?.type || coupon?.value === undefined) {
    return res.status(400).json({ error: 'Code, type, and value are required' });
  }
  
  const data = loadBillingCoupons();
  
  if (data.billingCoupons.some(c => c.code.toUpperCase() === coupon.code.toUpperCase())) {
    return res.status(400).json({ error: 'Coupon code already exists' });
  }
  
  const newCoupon = {
    id: generateUUID(),
    code: coupon.code.toUpperCase(),
    description: sanitizeText(coupon.description || ''),
    type: coupon.type === 'percentage' ? 'percentage' : 'fixed',
    value: parseFloat(coupon.value) || 0,
    maxUses: coupon.maxUses ? parseInt(coupon.maxUses) : null,
    usedCount: 0,
    planIds: coupon.planIds || [],
    expiresAt: coupon.expiresAt || null,
    active: coupon.active !== false,
    createdAt: new Date().toISOString()
  };
  
  data.billingCoupons.push(newCoupon);
  saveBillingCoupons(data);
  
  res.json({ success: true, coupon: newCoupon });
});

router.put('/admin/coupons/:id', (req, res) => {
  const { coupon } = req.body;
  const data = loadBillingCoupons();
  const idx = data.billingCoupons.findIndex(c => c.id === req.params.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: 'Coupon not found' });
  }
  
  const current = data.billingCoupons[idx];
  data.billingCoupons[idx] = {
    ...current,
    code: coupon.code ? coupon.code.toUpperCase() : current.code,
    description: coupon.description !== undefined ? sanitizeText(coupon.description) : current.description,
    type: coupon.type || current.type,
    value: coupon.value !== undefined ? parseFloat(coupon.value) : current.value,
    maxUses: coupon.maxUses !== undefined ? (coupon.maxUses ? parseInt(coupon.maxUses) : null) : current.maxUses,
    planIds: coupon.planIds || current.planIds,
    expiresAt: coupon.expiresAt !== undefined ? coupon.expiresAt : current.expiresAt,
    active: coupon.active !== undefined ? coupon.active : current.active,
    updatedAt: new Date().toISOString()
  };
  
  saveBillingCoupons(data);
  res.json({ success: true, coupon: data.billingCoupons[idx] });
});

router.delete('/admin/coupons/:id', (req, res) => {
  const data = loadBillingCoupons();
  data.billingCoupons = data.billingCoupons.filter(c => c.id !== req.params.id);
  saveBillingCoupons(data);
  res.json({ success: true });
});

// ==================== SUBSCRIPTION ADMIN ROUTES ====================

router.get('/admin/subscriptions', (req, res) => {
  const { page = 1, per_page = 20, status } = req.query;
  const data = loadBillingSubscriptions();
  const plans = loadBillingPlans();
  const users = loadUsers();
  
  let subs = data.billingSubscriptions.map(s => {
    const plan = plans.billingPlans.find(p => p.id === s.planId);
    const user = users.users.find(u => u.id === s.userId);
    return {
      ...s,
      plan: plan ? { id: plan.id, name: plan.name, price: plan.price } : null,
      user: user ? { id: user.id, username: user.username, email: user.email } : null
    };
  });
  
  if (status) {
    subs = subs.filter(s => s.status === status);
  }
  
  subs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const total = subs.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const paginatedSubs = subs.slice(start, start + parseInt(per_page));
  
  res.json({
    subscriptions: paginatedSubs,
    meta: { current_page: currentPage, per_page: parseInt(per_page), total, total_pages: totalPages }
  });
});

router.put('/admin/subscriptions/:id', (req, res) => {
  const { status } = req.body;
  const data = loadBillingSubscriptions();
  const idx = data.billingSubscriptions.findIndex(s => s.id === req.params.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  
  const oldStatus = data.billingSubscriptions[idx].status;
  data.billingSubscriptions[idx].status = status;
  data.billingSubscriptions[idx].updatedAt = new Date().toISOString();
  
  if (status === 'active' && oldStatus !== 'active') {
    const plans = loadBillingPlans();
    const plan = plans.billingPlans.find(p => p.id === data.billingSubscriptions[idx].planId);
    
    if (plan) {
      const users = loadUsers();
      const user = users.users.find(u => u.id === data.billingSubscriptions[idx].userId);
      if (user) {
        applyPlanLimits(user, plan);
        if (user.suspended && user.suspendReason === 'billing') {
          user.suspended = false;
          delete user.suspendReason;
          unsuspendUserServers(user.id);
        }
        users.users = users.users.map(u => u.id === user.id ? user : u);
        saveUsers(users);
      }
    }
  }
  
  if ((status === 'expired' || status === 'cancelled') && oldStatus === 'active') {
    const users = loadUsers();
    const user = users.users.find(u => u.id === data.billingSubscriptions[idx].userId);
    if (user) {
      suspendUserForBilling(user.id, 'Subscription expired');
    }
  }
  
  saveBillingSubscriptions(data);
  res.json({ success: true, subscription: data.billingSubscriptions[idx] });
});

router.get('/admin/invoices', (req, res) => {
  const { page = 1, per_page = 20, status } = req.query;
  const data = loadBillingInvoices();
  const users = loadUsers();
  
  let invoices = data.billingInvoices.map(i => {
    const user = users.users.find(u => u.id === i.userId);
    return {
      ...i,
      user: user ? { id: user.id, username: user.username, email: user.email } : null
    };
  });
  
  if (status) {
    invoices = invoices.filter(i => i.status === status);
  }
  
  invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const total = invoices.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const paginatedInvoices = invoices.slice(start, start + parseInt(per_page));
  
  res.json({
    invoices: paginatedInvoices,
    meta: { current_page: currentPage, per_page: parseInt(per_page), total, total_pages: totalPages }
  });
});

router.put('/admin/invoices/:id', (req, res) => {
  const { status } = req.body;
  const data = loadBillingInvoices();
  const idx = data.billingInvoices.findIndex(i => i.id === req.params.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  const invoice = data.billingInvoices[idx];
  invoice.status = status;
  invoice.updatedAt = new Date().toISOString();
  
  if (status === 'paid') {
    processPaymentSuccess(invoice.id, 'manual', null);
  }
  
  saveBillingInvoices(data);
  res.json({ success: true, invoice });
});

router.get('/admin/payments', (req, res) => {
  const { page = 1, per_page = 20 } = req.query;
  const data = loadBillingPayments();
  const users = loadUsers();
  
  let payments = data.billingPayments.map(p => {
    const user = users.users.find(u => u.id === p.userId);
    return {
      ...p,
      user: user ? { id: user.id, username: user.username, email: user.email } : null
    };
  });
  
  payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const total = payments.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const paginatedPayments = payments.slice(start, start + parseInt(per_page));
  
  res.json({
    payments: paginatedPayments,
    meta: { current_page: currentPage, per_page: parseInt(per_page), total, total_pages: totalPages }
  });
});

router.get('/admin/settings', (req, res) => {
  const config = loadConfig();
  res.json({ billing: config.billing || {}, tickets: config.tickets || {} });
});

router.put('/admin/settings', (req, res) => {
  const { billing, tickets } = req.body;
  const config = loadConfig();
  
  if (billing) {
    config.billing = {
      ...config.billing,
      enabled: billing.enabled !== undefined ? Boolean(billing.enabled) : config.billing?.enabled,
      requireEmail: billing.requireEmail !== undefined ? Boolean(billing.requireEmail) : config.billing?.requireEmail,
      requireEmailVerification: billing.requireEmailVerification !== undefined ? Boolean(billing.requireEmailVerification) : config.billing?.requireEmailVerification,
      currency: billing.currency || config.billing?.currency || 'USD',
      currencySymbol: billing.currencySymbol || config.billing?.currencySymbol || '$',
      taxRate: billing.taxRate !== undefined ? parseFloat(billing.taxRate) : config.billing?.taxRate || 0,
      gracePeriodDays: billing.gracePeriodDays !== undefined ? parseInt(billing.gracePeriodDays) : config.billing?.gracePeriodDays || 3,
      autoSuspend: billing.autoSuspend !== undefined ? Boolean(billing.autoSuspend) : config.billing?.autoSuspend
    };
    
    if (billing.paymentMethods) {
      config.billing.paymentMethods = {
        ...config.billing.paymentMethods,
        stripe: billing.paymentMethods.stripe ? {
          ...config.billing.paymentMethods?.stripe,
          ...billing.paymentMethods.stripe
        } : config.billing.paymentMethods?.stripe,
        paypal: billing.paymentMethods.paypal ? {
          ...config.billing.paymentMethods?.paypal,
          ...billing.paymentMethods.paypal
        } : config.billing.paymentMethods?.paypal,
        manual: billing.paymentMethods.manual ? {
          ...config.billing.paymentMethods?.manual,
          ...billing.paymentMethods.manual
        } : config.billing.paymentMethods?.manual
      };
    }
    
    if (billing.notifications) {
      config.billing.notifications = {
        ...config.billing.notifications,
        ...billing.notifications
      };
    }
  }
  
  if (tickets) {
    config.tickets = {
      ...config.tickets,
      enabled: tickets.enabled !== undefined ? Boolean(tickets.enabled) : config.tickets?.enabled,
      requireEmail: tickets.requireEmail !== undefined ? Boolean(tickets.requireEmail) : config.tickets?.requireEmail,
      maxOpenTickets: tickets.maxOpenTickets !== undefined ? parseInt(tickets.maxOpenTickets) : config.tickets?.maxOpenTickets || 5,
      categories: tickets.categories || config.tickets?.categories,
      priorities: tickets.priorities || config.tickets?.priorities
    };
  }
  
  saveConfig(config);
  res.json({ success: true, billing: config.billing, tickets: config.tickets });
});

// ==================== BILLING SCHEDULER (AUTO-SUSPEND) ====================

let billingSchedulerInterval = null;

function suspendUserForBilling(userId, reason) {
  const users = loadUsers();
  const userIdx = users.users.findIndex(u => u.id === userId);
  
  if (userIdx === -1) return;
  
  users.users[userIdx].suspended = true;
  users.users[userIdx].suspendReason = 'billing';
  saveUsers(users);
  
  suspendUserServers(userId);
  
  logActivity(userId, ACTIVITY_TYPES.BILLING, { 
    action: 'user_suspended',
    reason: reason
  });
}

function suspendUserServers(userId) {
  const servers = loadServers();
  const nodes = loadNodes();
  let updated = false;
  
  servers.servers.forEach((server, idx) => {
    if (server.user_id === userId && !server.suspended) {
      servers.servers[idx].suspended = true;
      servers.servers[idx].suspendReason = 'billing';
      updated = true;
      
      const node = nodes.nodes.find(n => n.id === server.node_id);
      if (node) {
        wingsRequest(node, 'POST', `/api/servers/${server.uuid}/power`, { action: 'kill' })
          .catch(e => logger.warn(`Failed to stop server ${server.uuid}: ${e.message}`));
      }
    }
  });
  
  if (updated) {
    saveServers(servers);
  }
}

function unsuspendUserServers(userId) {
  const servers = loadServers();
  let updated = false;
  
  servers.servers.forEach((server, idx) => {
    if (server.user_id === userId && server.suspended && server.suspendReason === 'billing') {
      servers.servers[idx].suspended = false;
      delete servers.servers[idx].suspendReason;
      updated = true;
    }
  });
  
  if (updated) {
    saveServers(servers);
  }
}



async function checkExpiredSubscriptions() {
  const config = loadConfig();
  if (!config.billing?.enabled || !config.billing?.autoSuspend) return;
  
  const graceDays = config.billing.gracePeriodDays || 3;
  const now = new Date();
  const subs = loadBillingSubscriptions();
  const users = loadUsers();
  
  for (const sub of subs.billingSubscriptions) {
    if (sub.status !== 'active') continue;
    
    const periodEnd = new Date(sub.currentPeriodEnd);
    const graceEnd = new Date(periodEnd);
    graceEnd.setDate(graceEnd.getDate() + graceDays);
    
    if (now > graceEnd) {
      const subIdx = subs.billingSubscriptions.findIndex(s => s.id === sub.id);
      subs.billingSubscriptions[subIdx].status = 'expired';
      subs.billingSubscriptions[subIdx].expiredAt = now.toISOString();
      subs.billingSubscriptions[subIdx].updatedAt = now.toISOString();
      
      suspendUserForBilling(sub.userId, 'Subscription expired');
      
      logger.info(`Subscription ${sub.id} expired, user ${sub.userId} suspended`);
    } else if (now > periodEnd && config.billing?.notifications?.subscriptionExpiring) {
      const daysLeft = Math.ceil((graceEnd - now) / (1000 * 60 * 60 * 24));
      const user = users.users.find(u => u.id === sub.userId);
      
      if (user?.email && !sub.expiryNotified) {
        sendSubscriptionExpiringEmail(user.email, user.username, sub, daysLeft).catch(e =>
          logger.warn(`Failed to send expiry email: ${e.message}`)
        );
        
        const subIdx = subs.billingSubscriptions.findIndex(s => s.id === sub.id);
        subs.billingSubscriptions[subIdx].expiryNotified = true;
      }
    }
  }
  
  saveBillingSubscriptions(subs);
}

export function startBillingScheduler() {
  if (billingSchedulerInterval) return;
  
  billingSchedulerInterval = setInterval(async () => {
    try {
      await checkExpiredSubscriptions();
    } catch (e) {
      logger.error(`Billing scheduler error: ${e.message}`);
    }
  }, 60 * 60 * 1000); // Check every hour
  
  checkExpiredSubscriptions();
  
  logger.info('Billing scheduler started');
}

export function stopBillingScheduler() {
  if (billingSchedulerInterval) {
    clearInterval(billingSchedulerInterval);
    billingSchedulerInterval = null;
  }
}

export default router;
