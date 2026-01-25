import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import archiver from 'archiver';
import { pipeline } from 'stream/promises';

export default class FileSystem {
  constructor(config) {
    this.serversPath = path.resolve(config.servers_path || './servers');
    this.backupsPath = path.resolve(config.backups_path || './backups');
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
  }

  getServerPath(uuid) {
    return path.join(this.serversPath, uuid);
  }

  resolvePath(uuid, relativePath) {
    const serverPath = this.getServerPath(uuid);
    const resolved = path.resolve(serverPath, relativePath.replace(/^\//, ''));
    
    if (!resolved.startsWith(serverPath)) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  async listDirectory(uuid, relativePath = '/') {
    const dirPath = this.resolvePath(uuid, relativePath);
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);
          try {
            const stats = await fs.stat(fullPath);
            return {
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime.toISOString(),
              mode: stats.mode
            };
          } catch {
            return {
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: 0,
              modified: null
            };
          }
        })
      );

      return files.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
        return [];
      }
      throw err;
    }
  }

  async readFile(uuid, relativePath) {
    const filePath = this.resolvePath(uuid, relativePath);
    const stats = await fs.stat(filePath);

    if (stats.size > this.maxFileSize) {
      throw new Error('File too large to read');
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return { content, size: stats.size, modified: stats.mtime.toISOString() };
  }

  async writeFile(uuid, relativePath, content) {
    const filePath = this.resolvePath(uuid, relativePath);
    const dir = path.dirname(filePath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    
    return { success: true };
  }

  async createDirectory(uuid, relativePath) {
    const dirPath = this.resolvePath(uuid, relativePath);
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  }

  async deleteFile(uuid, relativePath) {
    const targetPath = this.resolvePath(uuid, relativePath);
    const stats = await fs.stat(targetPath);

    if (stats.isDirectory()) {
      await fs.rm(targetPath, { recursive: true });
    } else {
      await fs.unlink(targetPath);
    }
    
    return { success: true };
  }

  async rename(uuid, oldPath, newPath) {
    const oldFullPath = this.resolvePath(uuid, oldPath);
    const newFullPath = this.resolvePath(uuid, newPath);
    
    await fs.rename(oldFullPath, newFullPath);
    return { success: true };
  }

  async copy(uuid, sourcePath, destPath) {
    const srcPath = this.resolvePath(uuid, sourcePath);
    const dstPath = this.resolvePath(uuid, destPath);
    
    const stats = await fs.stat(srcPath);
    if (stats.isDirectory()) {
      await fs.cp(srcPath, dstPath, { recursive: true });
    } else {
      await fs.copyFile(srcPath, dstPath);
    }
    
    return { success: true };
  }

  async compress(uuid, files, outputName) {
    const serverPath = this.getServerPath(uuid);
    const outputPath = path.join(serverPath, outputName);
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    for (const file of files) {
      const fullPath = this.resolvePath(uuid, file);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        archive.directory(fullPath, path.basename(file));
      } else {
        archive.file(fullPath, { name: path.basename(file) });
      }
    }

    await archive.finalize();
    
    return { path: outputName };
  }

  async createBackup(uuid, name) {
    const serverPath = this.getServerPath(uuid);
    const backupDir = path.join(this.backupsPath, uuid);
    const backupName = `${name || 'backup'}_${Date.now()}.zip`;
    const backupPath = path.join(backupDir, backupName);

    await fs.mkdir(backupDir, { recursive: true });

    const output = createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(serverPath, false);
    await archive.finalize();

    const stats = await fs.stat(backupPath);
    
    return {
      name: backupName,
      size: stats.size,
      created: new Date().toISOString()
    };
  }

  async listBackups(uuid) {
    const backupDir = path.join(this.backupsPath, uuid);
    
    try {
      const files = await fs.readdir(backupDir);
      const backups = await Promise.all(
        files.filter(f => f.endsWith('.zip')).map(async (name) => {
          const stats = await fs.stat(path.join(backupDir, name));
          return { name, size: stats.size, created: stats.mtime.toISOString() };
        })
      );
      return backups.sort((a, b) => b.created.localeCompare(a.created));
    } catch {
      return [];
    }
  }

  async deleteBackup(uuid, name) {
    const backupPath = path.join(this.backupsPath, uuid, name);
    await fs.unlink(backupPath);
    return { success: true };
  }

  async deleteServerFiles(uuid) {
    const serverPath = this.getServerPath(uuid);
    try {
      await fs.rm(serverPath, { recursive: true });
    } catch {}
    return { success: true };
  }

  async getDiskUsage(uuid) {
    const serverPath = this.getServerPath(uuid);
    let totalSize = 0;

    async function calculateSize(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await calculateSize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    }

    try {
      await calculateSize(serverPath);
    } catch {}

    return totalSize;
  }
}
