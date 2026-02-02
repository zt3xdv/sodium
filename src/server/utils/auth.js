import jwt from 'jsonwebtoken';
import { loadUsers } from '../db.js';
import { loadFullConfig } from '../config.js';

export const ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin'
};

export function getJwtSecret() {
  const config = loadFullConfig();
  return config.jwt?.secret || 'sodium-default-secret-change-in-production';
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


