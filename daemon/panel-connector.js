import WebSocket from 'ws';
import { EventEmitter } from 'events';

export default class PanelConnector extends EventEmitter {
  constructor(config, monitor) {
    super();
    this.config = config;
    this.monitor = monitor;
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = null;
    this.statsInterval = null;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const wsUrl = this.config.panel_url
      .replace('http://', 'ws://')
      .replace('https://', 'wss://');

    const url = `${wsUrl}/ws/daemon?token=${this.config.token}&uuid=${this.config.uuid}`;

    console.log(`Connecting to panel: ${this.config.panel_url}`);

    try {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('Connected to panel');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.startHeartbeat();
        this.startStatsReporting();
        this.sendAuth();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch (err) {
          console.error('Invalid message from panel:', err.message);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`Disconnected from panel: ${code} ${reason}`);
        this.connected = false;
        this.stopHeartbeat();
        this.stopStatsReporting();
        this.emit('disconnected', { code, reason: reason.toString() });
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('Panel connection error:', err.message);
        this.emit('error', err);
      });

    } catch (err) {
      console.error('Failed to connect:', err.message);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit('max_reconnects');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    
    console.log(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  }

  sendAuth() {
    this.send({
      type: 'auth',
      uuid: this.config.uuid,
      token: this.config.token,
      version: '1.0.0'
    });
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this.send({ type: 'heartbeat', timestamp: Date.now() });
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  startStatsReporting() {
    this.stopStatsReporting();
    this.statsInterval = setInterval(async () => {
      if (this.connected && this.monitor) {
        try {
          const stats = await this.monitor.getSystemStats();
          this.send({ type: 'stats', data: stats });
        } catch {}
      }
    }, 10000);
  }

  stopStatsReporting() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'auth_success':
        console.log('Authenticated with panel');
        this.emit('authenticated');
        break;

      case 'auth_failed':
        console.error('Authentication failed:', msg.reason);
        this.emit('auth_failed', msg.reason);
        break;

      case 'command':
        this.emit('command', msg);
        break;

      case 'server_action':
        this.emit('server_action', msg);
        break;

      case 'server_install':
        this.emit('server_install', msg);
        break;

      case 'server_create':
        this.emit('server_create', msg);
        break;

      case 'server_delete':
        this.emit('server_delete', msg);
        break;

      case 'pong':
        break;

      default:
        this.emit('message', msg);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendServerStatus(uuid, status, stats = null) {
    this.send({
      type: 'server_status',
      uuid,
      status,
      stats,
      timestamp: Date.now()
    });
  }

  sendServerOutput(uuid, output) {
    this.send({
      type: 'server_output',
      uuid,
      output,
      timestamp: Date.now()
    });
  }

  sendLog(level, message, meta = {}) {
    this.send({
      type: 'log',
      level,
      message,
      meta,
      timestamp: Date.now()
    });
  }

  disconnect() {
    this.stopHeartbeat();
    this.stopStatsReporting();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}
