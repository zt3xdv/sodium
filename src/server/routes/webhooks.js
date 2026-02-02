import express from 'express';
import { loadWebhooks, saveWebhooks } from '../db.js';
import { authenticateUser, requireAdmin } from '../utils/auth.js';
import { generateUUID, sanitizeText, sanitizeUrl } from '../utils/helpers.js';
import { WEBHOOK_EVENTS, triggerWebhook } from '../utils/webhooks.js';

const router = express.Router();

router.use(authenticateUser);

// Get webhook events list
router.get('/events', (req, res) => {
  res.json({ events: Object.values(WEBHOOK_EVENTS) });
});

// Get user's webhooks
router.get('/', (req, res) => {
  const data = loadWebhooks();
  const userWebhooks = (data.webhooks || [])
    .filter(w => w.user_id === req.user.id)
    .map(w => ({
      ...w,
      url: maskUrl(w.url),
      secret: w.secret ? '••••••••' : null
    }));
  
  res.json({ webhooks: userWebhooks });
});

// Create webhook
router.post('/', (req, res) => {
  const { name, url, type, events, secret } = req.body;
  
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  
  const sanitizedUrl = sanitizeUrl(url);
  if (!sanitizedUrl) {
    return res.status(400).json({ error: 'Invalid webhook URL' });
  }
  
  const validTypes = ['discord', 'slack', 'generic'];
  const webhookType = validTypes.includes(type) ? type : 'generic';
  
  const validEvents = Object.values(WEBHOOK_EVENTS);
  const selectedEvents = (events || []).filter(e => validEvents.includes(e) || e === '*');
  
  if (selectedEvents.length === 0) {
    return res.status(400).json({ error: 'At least one event is required' });
  }
  
  const data = loadWebhooks();
  if (!data.webhooks) data.webhooks = [];
  
  // Limit webhooks per user
  const userWebhooks = data.webhooks.filter(w => w.user_id === req.user.id);
  if (userWebhooks.length >= 10) {
    return res.status(400).json({ error: 'Maximum 10 webhooks per user' });
  }
  
  const newWebhook = {
    id: generateUUID(),
    user_id: req.user.id,
    name: sanitizeText(name).substring(0, 50),
    url: sanitizedUrl,
    type: webhookType,
    events: selectedEvents,
    secret: secret || null,
    enabled: true,
    created_at: new Date().toISOString()
  };
  
  data.webhooks.push(newWebhook);
  saveWebhooks(data);
  
  res.json({ 
    success: true, 
    webhook: {
      ...newWebhook,
      url: maskUrl(newWebhook.url),
      secret: newWebhook.secret ? '••••••••' : null
    }
  });
});

// Update webhook
router.put('/:id', (req, res) => {
  const { name, url, type, events, secret, enabled } = req.body;
  
  const data = loadWebhooks();
  const idx = (data.webhooks || []).findIndex(w => w.id === req.params.id && w.user_id === req.user.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  const webhook = data.webhooks[idx];
  
  if (name) webhook.name = sanitizeText(name).substring(0, 50);
  if (url) {
    const sanitizedUrl = sanitizeUrl(url);
    if (!sanitizedUrl) {
      return res.status(400).json({ error: 'Invalid webhook URL' });
    }
    webhook.url = sanitizedUrl;
  }
  if (type) {
    const validTypes = ['discord', 'slack', 'generic'];
    webhook.type = validTypes.includes(type) ? type : webhook.type;
  }
  if (events) {
    const validEvents = Object.values(WEBHOOK_EVENTS);
    webhook.events = events.filter(e => validEvents.includes(e) || e === '*');
  }
  if (secret !== undefined) webhook.secret = secret || null;
  if (enabled !== undefined) webhook.enabled = Boolean(enabled);
  
  webhook.updated_at = new Date().toISOString();
  saveWebhooks(data);
  
  res.json({ 
    success: true,
    webhook: {
      ...webhook,
      url: maskUrl(webhook.url),
      secret: webhook.secret ? '••••••••' : null
    }
  });
});

// Delete webhook
router.delete('/:id', (req, res) => {
  const data = loadWebhooks();
  const idx = (data.webhooks || []).findIndex(w => w.id === req.params.id && w.user_id === req.user.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  data.webhooks.splice(idx, 1);
  saveWebhooks(data);
  
  res.json({ success: true });
});

// Test webhook
router.post('/:id/test', async (req, res) => {
  const data = loadWebhooks();
  const webhook = (data.webhooks || []).find(w => w.id === req.params.id && w.user_id === req.user.id);
  
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  try {
    await triggerWebhook(WEBHOOK_EVENTS.SERVER_STARTED, {
      server_name: 'Test Server',
      server_id: '00000000-0000-0000-0000-000000000000',
      user_name: req.user.username,
      message: 'This is a test webhook from Sodium Panel'
    }, req.user.id);
    
    res.json({ success: true, message: 'Test webhook sent' });
  } catch (e) {
    res.status(500).json({ error: `Webhook test failed: ${e.message}` });
  }
});

// ==================== ADMIN WEBHOOKS ====================

// Get all webhooks (admin)
router.get('/admin/all', requireAdmin, (req, res) => {
  const data = loadWebhooks();
  const webhooks = (data.webhooks || []).map(w => ({
    ...w,
    url: maskUrl(w.url),
    secret: w.secret ? '••••••••' : null
  }));
  
  res.json({ webhooks });
});

// Create global webhook (admin)
router.post('/admin', requireAdmin, (req, res) => {
  const { name, url, type, events, secret } = req.body;
  
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  
  const sanitizedUrl = sanitizeUrl(url);
  if (!sanitizedUrl) {
    return res.status(400).json({ error: 'Invalid webhook URL' });
  }
  
  const validTypes = ['discord', 'slack', 'generic'];
  const webhookType = validTypes.includes(type) ? type : 'generic';
  
  const validEvents = Object.values(WEBHOOK_EVENTS);
  const selectedEvents = (events || []).filter(e => validEvents.includes(e) || e === '*');
  
  const data = loadWebhooks();
  if (!data.webhooks) data.webhooks = [];
  
  const newWebhook = {
    id: generateUUID(),
    user_id: null, // Global webhook
    name: sanitizeText(name).substring(0, 50),
    url: sanitizedUrl,
    type: webhookType,
    events: selectedEvents.length > 0 ? selectedEvents : ['*'],
    secret: secret || null,
    enabled: true,
    global: true,
    created_at: new Date().toISOString()
  };
  
  data.webhooks.push(newWebhook);
  saveWebhooks(data);
  
  res.json({ 
    success: true, 
    webhook: {
      ...newWebhook,
      url: maskUrl(newWebhook.url),
      secret: newWebhook.secret ? '••••••••' : null
    }
  });
});

// Delete any webhook (admin)
router.delete('/admin/:id', requireAdmin, (req, res) => {
  const data = loadWebhooks();
  const idx = (data.webhooks || []).findIndex(w => w.id === req.params.id);
  
  if (idx === -1) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  data.webhooks.splice(idx, 1);
  saveWebhooks(data);
  
  res.json({ success: true });
});

function maskUrl(url) {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/');
    if (pathParts.length > 2) {
      pathParts[pathParts.length - 1] = '••••••';
    }
    return `${parsed.protocol}//${parsed.host}${pathParts.join('/')}`;
  } catch {
    return '••••••••';
  }
}

export default router;
