import express from 'express';
import { loadActivityLogs, loadUsers } from '../db.js';
import { authenticateUser, requireAdmin } from '../utils/auth.js';

const router = express.Router();

router.get('/me', authenticateUser, (req, res) => {
  const { page = 1, per_page = 25 } = req.query;
  const data = loadActivityLogs();
  
  const userLogs = data.activityLogs.filter(l => l.userId === req.user.id);
  
  const total = userLogs.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const logs = userLogs.slice(start, start + parseInt(per_page));
  
  res.json({
    logs,
    meta: {
      current_page: currentPage,
      per_page: parseInt(per_page),
      total,
      total_pages: totalPages
    }
  });
});

router.get('/', authenticateUser, requireAdmin, (req, res) => {
  const { page = 1, per_page = 50, userId, action } = req.query;
  const data = loadActivityLogs();
  const users = loadUsers();
  
  let logs = data.activityLogs;
  
  if (userId) {
    logs = logs.filter(l => l.userId === userId);
  }
  if (action) {
    logs = logs.filter(l => l.action === action);
  }
  
  const total = logs.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const paginatedLogs = logs.slice(start, start + parseInt(per_page));
  
  const enrichedLogs = paginatedLogs.map(log => {
    const user = users.users.find(u => u.id === log.userId);
    return {
      ...log,
      username: user?.username || 'Unknown'
    };
  });
  
  res.json({
    logs: enrichedLogs,
    meta: {
      current_page: currentPage,
      per_page: parseInt(per_page),
      total,
      total_pages: totalPages
    }
  });
});

router.get('/user/:userId', authenticateUser, requireAdmin, (req, res) => {
  const { page = 1, per_page = 25 } = req.query;
  const data = loadActivityLogs();
  
  const userLogs = data.activityLogs.filter(l => l.userId === req.params.userId);
  
  const total = userLogs.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const logs = userLogs.slice(start, start + parseInt(per_page));
  
  res.json({
    logs,
    meta: {
      current_page: currentPage,
      per_page: parseInt(per_page),
      total,
      total_pages: totalPages
    }
  });
});

export default router;
