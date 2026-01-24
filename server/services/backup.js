import { createWriteStream, createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { spawn } from 'child_process';
import db from './database.js';
import { v4 as uuidv4 } from 'uuid';

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || './data/backups';
    this.serverDir = process.env.DATA_DIR || './data/servers';
    this.maxBackups = parseInt(process.env.MAX_BACKUPS) || 10;
  }

  async init() {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  async createBackup(server, options = {}) {
    const backupId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${server.uuid}_${timestamp}.tar.gz`;
    const backupPath = path.join(this.backupDir, fileName);
    const serverPath = path.join(this.serverDir, server.uuid);

    try {
      await fs.access(serverPath);
    } catch {
      throw new Error('Server directory not found');
    }

    db.prepare(`
      INSERT INTO backups (uuid, server_id, name, file_name, status, created_at)
      VALUES (?, ?, ?, ?, 'creating', datetime('now'))
    `).run(backupId, server.id, options.name || `Backup ${timestamp}`, fileName);

    try {
      await this.createTarGz(serverPath, backupPath, options.ignore || []);

      const stats = await fs.stat(backupPath);
      
      db.prepare(`
        UPDATE backups 
        SET status = 'completed', size = ?, completed_at = datetime('now')
        WHERE uuid = ?
      `).run(stats.size, backupId);

      await this.pruneOldBackups(server.id);

      return {
        uuid: backupId,
        fileName,
        size: stats.size
      };

    } catch (err) {
      db.prepare(`
        UPDATE backups 
        SET status = 'failed', error = ?
        WHERE uuid = ?
      `).run(err.message, backupId);

      try {
        await fs.unlink(backupPath);
      } catch {}

      throw err;
    }
  }

  createTarGz(sourceDir, outputPath, ignore = []) {
    return new Promise((resolve, reject) => {
      const excludeArgs = ignore.flatMap(p => ['--exclude', p]);
      
      const tar = spawn('tar', [
        '-czf', outputPath,
        ...excludeArgs,
        '-C', path.dirname(sourceDir),
        path.basename(sourceDir)
      ]);

      let stderr = '';
      tar.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar failed: ${stderr}`));
        }
      });

      tar.on('error', reject);
    });
  }

  async restoreBackup(backupUuid, server) {
    const backup = db.prepare('SELECT * FROM backups WHERE uuid = ?').get(backupUuid);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const backupPath = path.join(this.backupDir, backup.file_name);
    const serverPath = path.join(this.serverDir, server.uuid);

    try {
      await fs.access(backupPath);
    } catch {
      throw new Error('Backup file not found');
    }

    await fs.rm(serverPath, { recursive: true, force: true });
    await fs.mkdir(serverPath, { recursive: true });

    return new Promise((resolve, reject) => {
      const tar = spawn('tar', [
        '-xzf', backupPath,
        '-C', path.dirname(serverPath),
        '--strip-components=1'
      ]);

      let stderr = '';
      tar.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Restore failed: ${stderr}`));
        }
      });

      tar.on('error', reject);
    });
  }

  async deleteBackup(backupUuid) {
    const backup = db.prepare('SELECT * FROM backups WHERE uuid = ?').get(backupUuid);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const backupPath = path.join(this.backupDir, backup.file_name);
    
    try {
      await fs.unlink(backupPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    db.prepare('DELETE FROM backups WHERE uuid = ?').run(backupUuid);
  }

  async pruneOldBackups(serverId) {
    const backups = db.prepare(`
      SELECT * FROM backups 
      WHERE server_id = ? AND status = 'completed'
      ORDER BY created_at DESC
    `).all(serverId);

    if (backups.length <= this.maxBackups) return;

    const toDelete = backups.slice(this.maxBackups);
    for (const backup of toDelete) {
      await this.deleteBackup(backup.uuid);
    }
  }

  async getBackups(serverId) {
    return db.prepare(`
      SELECT * FROM backups 
      WHERE server_id = ?
      ORDER BY created_at DESC
    `).all(serverId);
  }

  async getBackupSize(serverId) {
    const result = db.prepare(`
      SELECT SUM(size) as total 
      FROM backups 
      WHERE server_id = ? AND status = 'completed'
    `).get(serverId);
    
    return result?.total || 0;
  }

  getBackupPath(backup) {
    return path.join(this.backupDir, backup.file_name);
  }
}

export default new BackupService();
