import crypto from 'crypto';
import { loadUsers, loadConfig } from '../db.js';

export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;')
    .replace(/\\/g, '&#92;');
}

export function sanitizeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (parsed.hostname.includes('<') || parsed.hostname.includes('>')) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

export function validateUsername(username) {
  if (typeof username !== 'string') return false;
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

export function sanitizeLinks(links) {
  if (!links || typeof links !== 'object') return {};
  const allowed = ['website', 'twitter', 'github', 'discord', 'instagram'];
  const sanitized = {};
  for (const key of allowed) {
    if (links[key]) {
      sanitized[key] = sanitizeUrl(links[key]);
    }
  }
  return sanitized;
}

export function isAdmin(username) {
  const data = loadUsers();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  return user && user.isAdmin === true;
}

export function generateUUID() {
  return crypto.randomUUID();
}

export function generateToken(length = 64) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

export async function wingsRequest(node, method, endpoint, data = null, rawContent = false) {
  const url = `${node.scheme}://${node.fqdn}:${node.daemon_port}${endpoint}`;
  
  const headers = {
    'Authorization': `Bearer ${node.daemon_token}`,
    'Accept': 'application/json'
  };
  
  if (rawContent) {
    headers['Content-Type'] = 'text/plain';
  } else {
    headers['Content-Type'] = 'application/json';
  }
  
  const options = { method, headers };
  if (data !== null) {
    options.body = rawContent ? data : JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json().catch(() => ({}));
  } catch (error) {

    throw error;
  }
}

export function generateNodeConfig(node) {
  return {
    debug: false,
    uuid: node.id,
    token_id: node.daemon_token_id,
    token: node.daemon_token,
    api: {
      host: '0.0.0.0',
      port: node.daemon_port,
      ssl: { enabled: node.scheme === 'https', cert: '/etc/letsencrypt/live/node/fullchain.pem', key: '/etc/letsencrypt/live/node/privkey.pem' },
      upload_limit: node.upload_size
    },
    system: { data: '/var/lib/pterodactyl/volumes', sftp: { bind_port: node.daemon_sftp_port } },
    docker: {
      network: {
        name: 'pterodactyl_nw',
        interfaces: {
          v4: {
            subnet: '172.50.0.0/16',
            gateway: '172.50.0.1'
          }
        }
      }
    },
    remote: loadConfig().panel?.url || 'http://localhost:3000',
    allowed_origins: ['*']
  };
}

export function configToYaml(obj, indent = 0) {
  let yaml = '';
  const spaces = '  '.repeat(indent);
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n${configToYaml(value, indent + 1)}`;
    } else if (typeof value === 'boolean') {
      yaml += `${spaces}${key}: ${value}\n`;
    } else if (typeof value === 'number') {
      yaml += `${spaces}${key}: ${value}\n`;
    } else {
      yaml += `${spaces}${key}: "${value}"\n`;
    }
  }
  return yaml;
}

export function validateVariableValue(value, rulesString) {
  if (!rulesString) return null;
  
  const parts = rulesString.split('|');
  const rules = {
    required: false,
    nullable: false,
    type: null,
    min: null,
    max: null,
    in: []
  };
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === 'required') rules.required = true;
    else if (trimmed === 'nullable') rules.nullable = true;
    else if (trimmed === 'string') rules.type = 'string';
    else if (trimmed === 'numeric' || trimmed === 'integer') rules.type = 'number';
    else if (trimmed === 'boolean') rules.type = 'boolean';
    else if (trimmed.startsWith('min:')) rules.min = parseInt(trimmed.split(':')[1]);
    else if (trimmed.startsWith('max:')) rules.max = parseInt(trimmed.split(':')[1]);
    else if (trimmed.startsWith('in:')) rules.in = trimmed.split(':')[1].split(',');
  }
  
  const strValue = String(value ?? '');
  
  if (rules.required && strValue === '') {
    return 'This field is required';
  }
  
  if (rules.nullable && strValue === '') {
    return null;
  }
  
  if (rules.type === 'number' && strValue !== '') {
    if (isNaN(Number(strValue))) {
      return 'Must be a number';
    }
    const num = Number(strValue);
    if (rules.min !== null && num < rules.min) {
      return `Minimum value is ${rules.min}`;
    }
    if (rules.max !== null && num > rules.max) {
      return `Maximum value is ${rules.max}`;
    }
  }
  
  if (rules.type === 'string' && strValue !== '') {
    if (rules.min !== null && strValue.length < rules.min) {
      return `Minimum length is ${rules.min}`;
    }
    if (rules.max !== null && strValue.length > rules.max) {
      return `Maximum length is ${rules.max}`;
    }
  }
  
  if (rules.in.length > 0 && strValue !== '' && !rules.in.includes(strValue)) {
    return `Must be one of: ${rules.in.join(', ')}`;
  }
  
  return null;
}
