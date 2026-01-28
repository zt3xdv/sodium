import jwt from 'jsonwebtoken';
import { loadUsers } from '../db.js';
import logger from './logger.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'sodium-default-secret-change-in-production';
if (!process.env.JWT_SECRET) {
  logger.warn('Using default JWT_SECRET. Set JWT_SECRET env var in production!');
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
    
    req.user = {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin
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
