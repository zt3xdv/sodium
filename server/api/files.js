import { Router } from 'express';
import { auth as authMiddleware } from '../middleware/auth.js';
import Server from '../models/Server.js';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream, existsSync, statSync } from 'fs';
import multer from 'multer';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { pipeline } from 'stream/promises';

const router = Router();

const DATA_DIR = process.env.DATA_DIR || './data/servers';

function getServerPath(serverUuid) {
  return path.join(DATA_DIR, serverUuid);
}

function sanitizePath(basePath, requestedPath) {
  const fullPath = path.resolve(basePath, requestedPath.replace(/^\//, ''));
  if (!fullPath.startsWith(path.resolve(basePath))) {
    throw new Error('Path traversal detected');
  }
  return fullPath;
}

async function checkOwnership(req, serverUuid) {
  const server = await Server.findByUuid(serverUuid);
  if (!server) {
    throw { status: 404, message: 'Server not found' };
  }
  if (server.owner_id !== req.user.id && req.user.role !== 'admin') {
    throw { status: 403, message: 'Access denied' };
  }
  return server;
}

async function copyRecursive(src, dest) {
  const stats = await fs.stat(src);
  if (stats.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

async function getDirectorySize(dirPath) {
  let size = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      size += await getDirectorySize(fullPath);
    } else {
      const stats = await fs.stat(fullPath);
      size += stats.size;
    }
  }
  return size;
}

async function searchFiles(dirPath, query, results = [], basePath = dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);
    
    if (entry.name.toLowerCase().includes(query.toLowerCase())) {
      const stats = await fs.stat(fullPath);
      results.push({
        name: entry.name,
        path: '/' + relativePath,
        is_directory: entry.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      });
    }
    
    if (entry.isDirectory() && results.length < 100) {
      await searchFiles(fullPath, query, results, basePath);
    }
  }
  return results.slice(0, 100);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, req.uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

// List directory
router.get('/:serverId/files/list', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const dirPath = sanitizePath(basePath, req.query.path || '/');

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = await Promise.all(entries.map(async entry => {
      const filePath = path.join(dirPath, entry.name);
      const stats = await fs.stat(filePath);
      return {
        name: entry.name,
        is_directory: entry.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      };
    }));

    res.json({ data: files });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Read file
router.get('/:serverId/files/read', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const filePath = sanitizePath(basePath, req.query.path);

    const stats = await fs.stat(filePath);
    if (stats.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large to edit' });
    }

    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Write file
router.post('/:serverId/files/write', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const filePath = sanitizePath(basePath, req.body.path);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, req.body.content || '');

    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Create directory
router.post('/:serverId/files/mkdir', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const dirPath = sanitizePath(basePath, req.body.path);

    await fs.mkdir(dirPath, { recursive: true });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Rename/move
router.post('/:serverId/files/rename', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const fromPath = sanitizePath(basePath, req.body.from);
    const toPath = sanitizePath(basePath, req.body.to);

    await fs.rename(fromPath, toPath);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Delete
router.delete('/:serverId/files/delete', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const targetPath = sanitizePath(basePath, req.query.path);

    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      await fs.rm(targetPath, { recursive: true });
    } else {
      await fs.unlink(targetPath);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Download
router.get('/:serverId/files/download', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const filePath = sanitizePath(basePath, req.query.path);

    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot download directory. Use compress first.' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    res.setHeader('Content-Length', stats.size);
    
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Upload with multer
router.post('/:serverId/files/upload', authMiddleware, async (req, res, next) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const uploadDir = req.query.path || '/';
    const uploadPath = sanitizePath(basePath, uploadDir);
    
    await fs.mkdir(uploadPath, { recursive: true });
    req.uploadPath = uploadPath;
    
    next();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}, upload.array('files', 20), (req, res) => {
  const uploaded = req.files.map(f => ({
    name: f.originalname,
    size: f.size,
    path: path.join(req.query.path || '/', f.originalname)
  }));
  res.json({ success: true, files: uploaded });
});

// Copy file/folder
router.post('/:serverId/files/copy', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const srcPath = sanitizePath(basePath, req.body.from);
    const destPath = sanitizePath(basePath, req.body.to);

    if (!existsSync(srcPath)) {
      return res.status(404).json({ error: 'Source not found' });
    }

    await copyRecursive(srcPath, destPath);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Bulk delete
router.post('/:serverId/files/bulk-delete', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const { paths } = req.body;

    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'No paths provided' });
    }

    const results = [];
    for (const p of paths) {
      try {
        const targetPath = sanitizePath(basePath, p);
        const stats = await fs.stat(targetPath);
        if (stats.isDirectory()) {
          await fs.rm(targetPath, { recursive: true });
        } else {
          await fs.unlink(targetPath);
        }
        results.push({ path: p, success: true });
      } catch (err) {
        results.push({ path: p, success: false, error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Bulk move
router.post('/:serverId/files/bulk-move', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const { paths, destination } = req.body;

    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'No paths provided' });
    }

    const destDir = sanitizePath(basePath, destination);
    await fs.mkdir(destDir, { recursive: true });

    const results = [];
    for (const p of paths) {
      try {
        const srcPath = sanitizePath(basePath, p);
        const fileName = path.basename(srcPath);
        const newPath = path.join(destDir, fileName);
        await fs.rename(srcPath, newPath);
        results.push({ path: p, success: true, newPath: path.join(destination, fileName) });
      } catch (err) {
        results.push({ path: p, success: false, error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Compress to ZIP
router.post('/:serverId/files/compress', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const { paths, destination } = req.body;

    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'No paths provided' });
    }

    const zipName = destination || `archive-${Date.now()}.zip`;
    const zipPath = sanitizePath(basePath, zipName);

    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    for (const p of paths) {
      const fullPath = sanitizePath(basePath, p);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        archive.directory(fullPath, path.basename(fullPath));
      } else {
        archive.file(fullPath, { name: path.basename(fullPath) });
      }
    }

    await archive.finalize();

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    const zipStats = await fs.stat(zipPath);
    res.json({ 
      success: true, 
      path: zipName,
      size: zipStats.size
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Decompress ZIP/TAR
router.post('/:serverId/files/decompress', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const { path: archivePath, destination } = req.body;

    const fullArchivePath = sanitizePath(basePath, archivePath);
    const extractDir = sanitizePath(basePath, destination || path.dirname(archivePath));

    if (!existsSync(fullArchivePath)) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    await fs.mkdir(extractDir, { recursive: true });

    const ext = path.extname(fullArchivePath).toLowerCase();

    if (ext === '.zip') {
      await pipeline(
        createReadStream(fullArchivePath),
        unzipper.Extract({ path: extractDir })
      );
    } else if (ext === '.tar' || ext === '.gz' || ext === '.tgz') {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const tarFlags = ext === '.tar' ? '-xf' : '-xzf';
      await execAsync(`tar ${tarFlags} "${fullArchivePath}" -C "${extractDir}"`);
    } else {
      return res.status(400).json({ error: 'Unsupported archive format. Use .zip, .tar, .tar.gz, or .tgz' });
    }

    res.json({ success: true, extractedTo: destination || path.dirname(archivePath) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Search files
router.get('/:serverId/files/search', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    const searchPath = sanitizePath(basePath, req.query.path || '/');
    const query = req.query.query || req.query.q;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const results = await searchFiles(searchPath, query);
    res.json({ data: results, count: results.length });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get disk usage
router.get('/:serverId/files/usage', authMiddleware, async (req, res) => {
  try {
    await checkOwnership(req, req.params.serverId);
    
    const basePath = getServerPath(req.params.serverId);
    
    if (!existsSync(basePath)) {
      return res.json({ size: 0, formatted: '0 B' });
    }

    const size = await getDirectorySize(basePath);
    
    const formatSize = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    res.json({ 
      size, 
      formatted: formatSize(size)
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
