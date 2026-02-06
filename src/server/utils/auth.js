import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { loadUsers, loadApiKeys, saveApiKeys } from '../db.js';
import { loadFullConfig, saveFullConfig } from '../config.js';

export const ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin'
};

export function getJwtSecret() {
  const config = loadFullConfig();
  if (config.jwt?.secret) {
    return config.jwt.secret;
  }
  
  // Generate secure secret if not configured
  const newSecret = crypto.randomBytes(64).toString('base64url');
  console.warn('[SECURITY] No JWT secret configured - generating secure random secret');
  
  config.jwt = config.jwt || {};
  config.jwt.secret = newSecret;
  saveFullConfig(config);
  
  return newSecret;
}

export const JWT_SECRET = getJwtSecret();

export function getUserRole(user) {
  if (user.isAdmin) return ROLES.ADMIN;
  if (user.role === ROLES.MODERATOR) return ROLES.MODERATOR;
  return user.role || ROLES.USER;
}

export function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const data = loadUsers();
    const user = data.users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const role = getUserRole(user);
    
    req.user = {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin || role === ROLES.ADMIN,
      isModerator: role === ROLES.MODERATOR || role === ROLES.ADMIN,
      role: role
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.isAdmin !== true) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requireModerator(req, res, next) {
  if (!req.user || !req.user.isModerator) {
    return res.status(403).json({ error: 'Moderator access required' });
  }
  next();
}

export function authenticateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No API key provided' });
  }
  
  const token = authHeader.substring(7);
  
  if (!token.startsWith('sodium_')) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }
  
  const data = loadApiKeys();
  const apiKey = (data.apiKeys || []).find(k => k.token === token);
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'API key expired' });
  }
  
  const users = loadUsers();
  const user = users.users.find(u => u.id === apiKey.userId);
  
  if (!user) {
    return res.status(401).json({ error: 'API key owner not found' });
  }
  
  apiKey.lastUsedAt = new Date().toISOString();
  saveApiKeys(data);
  
  req.apiKey = {
    id: apiKey.id,
    type: apiKey.type,
    permissions: apiKey.permissions
  };
  
  req.user = {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin || apiKey.type === 'application',
    role: getUserRole(user)
  };
  
  next();
}

export function authenticateAny(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  if (token.startsWith('sodium_')) {
    return authenticateApiKey(req, res, next);
  }
  
  return authenticateUser(req, res, next);
}

export function requireApiPermission(permission) {
  return (req, res, next) => {
    if (!req.apiKey) {
      return next();
    }
    
    if (req.apiKey.permissions.includes('*')) {
      return next();
    }
    
    if (!req.apiKey.permissions.includes(permission)) {
      return res.status(403).json({ error: `Missing permission: ${permission}` });
    }
    
    next();
  };
}

export function requireEmailVerified(req, res, next) {
  if (req.apiKey) {
    return next();
  }
  
  const config = loadFullConfig();
  if (!config.registration?.emailVerification) {
    return next();
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.id === req.user?.id);
  
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  if (user.isAdmin) {
    return next();
  }
  
  if (!user.emailVerified) {
    return res.status(403).json({ error: 'Email verification required', code: 'EMAIL_NOT_VERIFIED' });
  }
  
  next();
}


