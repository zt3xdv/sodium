import express from 'express';
import { loadAuditLogs, loadUsers } from '../db.js';
import { authenticateUser, requireAdmin } from '../utils/auth.js';

const router = express.Router();

router.use(authenticateUser, requireAdmin);

router.get('/', (req, res) => {
  const { page = 1, per_page = 50, action, targetType, adminId } = req.query;
  const data = loadAuditLogs();
  const users = loadUsers();
  
  let logs = data.auditLogs;
  
  if (action) {
    logs = logs.filter(l => l.action === action);
  }
  if (targetType) {
    logs = logs.filter(l => l.targetType === targetType);
  }
  if (adminId) {
    logs = logs.filter(l => l.adminId === adminId);
  }
  
  const total = logs.length;
  const totalPages = Math.ceil(total / per_page);
  const currentPage = Math.max(1, Math.min(parseInt(page), totalPages || 1));
  const start = (currentPage - 1) * per_page;
  const paginatedLogs = logs.slice(start, start + parseInt(per_page));
  
  const enrichedLogs = paginatedLogs.map(log => {
    const admin = users.users.find(u => u.id === log.adminId);
    return {
      ...log,
      adminUsername: admin?.username || 'Unknown'
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

router.get('/actions', (req, res) => {
  const data = loadAuditLogs();
  const actions = [...new Set(data.auditLogs.map(l => l.action))];
  res.json({ actions });
});

router.get('/target-types', (req, res) => {
  const data = loadAuditLogs();
  const targetTypes = [...new Set(data.auditLogs.map(l => l.targetType))];
  res.json({ targetTypes });
});

export default router;
