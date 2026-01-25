import fs from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import path from 'path';

export default class Logger {
  constructor(config, panelConnector = null) {
    this.config = config;
    this.panelConnector = panelConnector;
    this.logDir = path.resolve(config.logs_path || './logs');
    this.logFile = null;
    this.currentDate = null;
    this.buffer = [];
    this.flushInterval = null;
  }

  async init() {
    if (!existsSync(this.logDir)) {
      await fs.mkdir(this.logDir, { recursive: true });
    }
    this.rotateLogFile();
    this.startFlushInterval();
  }

  rotateLogFile() {
    const today = new Date().toISOString().split('T')[0];
    if (this.currentDate === today) return;

    if (this.logFile) {
      this.logFile.end();
    }

    this.currentDate = today;
    const logPath = path.join(this.logDir, `daemon_${today}.log`);
    this.logFile = createWriteStream(logPath, { flags: 'a' });
  }

  startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000);
  }

  flush() {
    if (this.buffer.length === 0) return;

    this.rotateLogFile();
    const entries = this.buffer.splice(0, this.buffer.length);
    
    for (const entry of entries) {
      this.logFile.write(JSON.stringify(entry) + '\n');
    }
  }

  log(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    };

    this.buffer.push(entry);

    if (this.config.debug || level === 'error') {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
      if (level === 'error') {
        console.error(prefix, message, meta.error || '');
      } else {
        console.log(prefix, message);
      }
    }

    if (this.panelConnector?.isConnected() && (level === 'error' || level === 'warn')) {
      this.panelConnector.sendLog(level, message, meta);
    }
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  server(uuid, level, message, meta = {}) {
    this.log(level, message, { ...meta, server: uuid });
  }

  async getLogs(options = {}) {
    const { date, level, limit = 100, server } = options;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const logPath = path.join(this.logDir, `daemon_${targetDate}.log`);

    try {
      const content = await fs.readFile(logPath, 'utf-8');
      let entries = content.trim().split('\n')
        .filter(Boolean)
        .map(line => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);

      if (level) {
        entries = entries.filter(e => e.level === level);
      }
      if (server) {
        entries = entries.filter(e => e.server === server);
      }

      return entries.slice(-limit);
    } catch {
      return [];
    }
  }

  async getLogFiles() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = await Promise.all(
        files
          .filter(f => f.startsWith('daemon_') && f.endsWith('.log'))
          .map(async (name) => {
            const stats = await fs.stat(path.join(this.logDir, name));
            return { name, size: stats.size, modified: stats.mtime.toISOString() };
          })
      );
      return logFiles.sort((a, b) => b.name.localeCompare(a.name));
    } catch {
      return [];
    }
  }

  async clearOldLogs(daysToKeep = 7) {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const files = await this.getLogFiles();

    for (const file of files) {
      const fileDate = new Date(file.modified).getTime();
      if (fileDate < cutoff) {
        await fs.unlink(path.join(this.logDir, file.name)).catch(() => {});
      }
    }
  }

  close() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
    if (this.logFile) {
      this.logFile.end();
    }
  }
}
