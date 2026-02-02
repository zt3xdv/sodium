import { loadWebhooks } from '../db.js';
import logger from './logger.js';
import { generateWebhookImage } from './webhook-image.js';

export const WEBHOOK_EVENTS = {
  // Server events
  SERVER_CREATED: 'server.created',
  SERVER_DELETED: 'server.deleted',
  SERVER_STARTED: 'server.started',
  SERVER_STOPPED: 'server.stopped',
  SERVER_CRASHED: 'server.crashed',
  SERVER_SUSPENDED: 'server.suspended',
  SERVER_UNSUSPENDED: 'server.unsuspended',
  
  // User events
  USER_CREATED: 'user.created',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  
  // Admin events
  NODE_CREATED: 'node.created',
  NODE_DELETED: 'node.deleted',
  ANNOUNCEMENT_CREATED: 'announcement.created'
};

export async function triggerWebhook(event, data, userId = null) {
  const webhooksData = loadWebhooks();
  const webhooks = webhooksData.webhooks || [];
  
  const matchingWebhooks = webhooks.filter(w => {
    if (!w.enabled) return false;
    if (!w.events.includes(event) && !w.events.includes('*')) return false;
    if (w.user_id && w.user_id !== userId) return false;
    return true;
  });
  
  for (const webhook of matchingWebhooks) {
    try {
      await sendWebhook(webhook, event, data);
    } catch (e) {
      logger.warn(`Webhook ${webhook.id} failed: ${e.message}`);
    }
  }
}

async function sendWebhook(webhook, event, data) {
  if (webhook.type === 'discord') {
    return sendDiscordWebhook(webhook, event, data);
  }
  
  const payload = buildPayload(webhook.type, event, data);
  
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Sodium-Panel/1.0'
  };
  
  if (webhook.secret) {
    headers['X-Webhook-Secret'] = webhook.secret;
  }
  
  const response = await fetch(webhook.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return true;
}

async function sendDiscordWebhook(webhook, event, data) {
  const image = await generateWebhookImage(event, data);
  
  if (image) {
    const formData = new FormData();
    formData.append('files[0]', new Blob([image], { type: 'image/png' }), 'notification.png');
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return true;
  }
  
  const payload = buildDiscordPayload(event, data, new Date().toISOString());
  const response = await fetch(webhook.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return true;
}

function buildPayload(type, event, data) {
  const timestamp = new Date().toISOString();
  
  switch (type) {
    case 'discord':
      return buildDiscordPayload(event, data, timestamp);
    case 'slack':
      return buildSlackPayload(event, data, timestamp);
    case 'generic':
    default:
      return {
        event,
        timestamp,
        data
      };
  }
}

function buildDiscordPayload(event, data, timestamp) {
  const colors = {
    'server.created': 0x2ecc71,
    'server.deleted': 0xe74c3c,
    'server.started': 0x3498db,
    'server.stopped': 0x95a5a6,
    'server.crashed': 0xe74c3c,
    'server.suspended': 0xf39c12,
    'server.unsuspended': 0x2ecc71,
    'user.created': 0x9b59b6,
    'user.deleted': 0xe74c3c,
    'user.login': 0x3498db,
    'node.created': 0x1abc9c,
    'node.deleted': 0xe74c3c,
    'announcement.created': 0xf1c40f
  };
  
  const titles = {
    'server.created': '🖥️ Server Created',
    'server.deleted': '🗑️ Server Deleted',
    'server.started': '▶️ Server Started',
    'server.stopped': '⏹️ Server Stopped',
    'server.crashed': '💥 Server Crashed',
    'server.suspended': '⏸️ Server Suspended',
    'server.unsuspended': '▶️ Server Unsuspended',

    'user.created': '👤 User Created',
    'user.deleted': '👤 User Deleted',
    'user.login': '🔑 User Login',
    'node.created': '🖧 Node Created',
    'node.deleted': '🖧 Node Deleted',
    'announcement.created': '📢 New Announcement'
  };
  
  const fields = [];
  
  if (data.server_name) fields.push({ name: 'Server', value: data.server_name, inline: true });
  if (data.server_id) fields.push({ name: 'Server ID', value: data.server_id.substring(0, 8), inline: true });
  if (data.user_name) fields.push({ name: 'User', value: data.user_name, inline: true });
  if (data.node_name) fields.push({ name: 'Node', value: data.node_name, inline: true });
  if (data.title) fields.push({ name: 'Title', value: data.title, inline: false });
  if (data.message) fields.push({ name: 'Message', value: data.message.substring(0, 200), inline: false });
  if (data.ip) fields.push({ name: 'IP', value: data.ip, inline: true });
  
  return {
    embeds: [{
      title: titles[event] || event,
      color: colors[event] || 0x7289da,
      fields,
      timestamp,
      footer: {
        text: 'Sodium Panel'
      }
    }]
  };
}

function buildSlackPayload(event, data, timestamp) {
  const emojis = {
    'server.created': ':desktop_computer:',
    'server.deleted': ':wastebasket:',
    'server.started': ':arrow_forward:',
    'server.stopped': ':stop_button:',
    'server.crashed': ':boom:',
    'user.created': ':bust_in_silhouette:',
    'user.login': ':key:'
  };
  
  let text = `${emojis[event] || ':bell:'} *${event}*\n`;
  
  if (data.server_name) text += `Server: ${data.server_name}\n`;
  if (data.user_name) text += `User: ${data.user_name}\n`;
  if (data.message) text += `${data.message}\n`;
  
  return {
    text,
    attachments: [{
      color: '#7289da',
      footer: 'Sodium Panel',
      ts: Math.floor(new Date(timestamp).getTime() / 1000)
    }]
  };
}
