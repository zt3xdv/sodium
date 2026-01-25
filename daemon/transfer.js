import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import archiver from 'archiver';
import { pipeline } from 'stream/promises';
import https from 'https';
import http from 'http';

export default class TransferService {
  constructor(config, docker, filesystem) {
    this.config = config;
    this.docker = docker;
    this.filesystem = filesystem;
    this.transfers = new Map();
  }

  async exportServer(uuid) {
    const serverPath = this.filesystem.getServerPath(uuid);
    const exportPath = path.join(this.config.backups_path, `transfer_${uuid}_${Date.now()}.tar.gz`);

    await fs.mkdir(path.dirname(exportPath), { recursive: true });

    await this.docker.stopContainer(uuid).catch(() => {});

    return new Promise((resolve, reject) => {
      const output = createWriteStream(exportPath);
      const archive = archiver('tar', { gzip: true, gzipOptions: { level: 9 } });

      output.on('close', () => {
        resolve({
          path: exportPath,
          size: archive.pointer(),
          uuid
        });
      });

      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(serverPath, false);
      archive.finalize();
    });
  }

  async importServer(uuid, archivePath) {
    const serverPath = this.filesystem.getServerPath(uuid);
    
    await fs.mkdir(serverPath, { recursive: true });
    
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await execAsync(`tar -xzf "${archivePath}" -C "${serverPath}"`);
    await fs.unlink(archivePath).catch(() => {});

    return { uuid, path: serverPath };
  }

  async initiateTransfer(uuid, targetNode) {
    const transfer = {
      id: `transfer_${Date.now()}`,
      uuid,
      targetNode,
      status: 'preparing',
      progress: 0,
      startedAt: new Date().toISOString()
    };

    this.transfers.set(transfer.id, transfer);

    try {
      transfer.status = 'exporting';
      const exported = await this.exportServer(uuid);
      transfer.archivePath = exported.path;
      transfer.size = exported.size;
      transfer.progress = 30;

      transfer.status = 'uploading';
      await this.uploadToNode(transfer, targetNode);
      transfer.progress = 70;

      transfer.status = 'importing';
      await this.notifyTargetImport(transfer, targetNode);
      transfer.progress = 90;

      await fs.unlink(transfer.archivePath).catch(() => {});
      await this.docker.removeContainer(uuid).catch(() => {});
      await this.filesystem.deleteServerFiles(uuid).catch(() => {});

      transfer.status = 'completed';
      transfer.progress = 100;
      transfer.completedAt = new Date().toISOString();

      return transfer;

    } catch (err) {
      transfer.status = 'failed';
      transfer.error = err.message;
      throw err;
    }
  }

  async uploadToNode(transfer, targetNode) {
    const fileStream = createReadStream(transfer.archivePath);
    const stats = await fs.stat(transfer.archivePath);

    return new Promise((resolve, reject) => {
      const url = new URL(`${targetNode.scheme}://${targetNode.fqdn}:${targetNode.daemon_port}/transfer/receive`);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request({
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}?uuid=${transfer.uuid}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stats.size,
          'Authorization': `Bearer ${targetNode.daemon_token}`,
          'X-Transfer-UUID': transfer.uuid
        }
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      fileStream.pipe(req);
    });
  }

  async notifyTargetImport(transfer, targetNode) {
    const url = `${targetNode.scheme}://${targetNode.fqdn}:${targetNode.daemon_port}/transfer/import`;
    const client = url.startsWith('https') ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${targetNode.daemon_token}`
        }
      }, (res) => {
        res.statusCode === 200 ? resolve() : reject(new Error(`Import notification failed: ${res.statusCode}`));
      });

      req.on('error', reject);
      req.write(JSON.stringify({ uuid: transfer.uuid }));
      req.end();
    });
  }

  async receiveTransfer(uuid, dataStream) {
    const tempPath = path.join(this.config.backups_path, `incoming_${uuid}_${Date.now()}.tar.gz`);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });

    const writeStream = createWriteStream(tempPath);
    await pipeline(dataStream, writeStream);

    return { uuid, tempPath };
  }

  async completeImport(uuid, tempPath) {
    const result = await this.importServer(uuid, tempPath);
    return result;
  }

  getTransferStatus(transferId) {
    return this.transfers.get(transferId);
  }

  listTransfers() {
    return Array.from(this.transfers.values());
  }
}
