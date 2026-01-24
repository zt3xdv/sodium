import { renderNav } from '../../components/nav.js';
import { renderServerSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { getToken } from '../../utils/auth.js';
import { formatBytes } from '../../utils/format.js';
import { WS_URL } from '../../utils/constants.js';

export default function(params) {
  const serverId = params.id;
  
  return `
    ${renderNav()}
    <div class="server-layout">
      ${renderServerSidebar(serverId, 'console')}
      <main class="server-content">
        <div class="console-container">
          <div class="console-header">
            <div class="server-info">
              <h2 id="server-name">Loading...</h2>
              <span class="badge" id="server-status">—</span>
            </div>
            <div class="power-controls">
              <button class="btn btn-primary" id="btn-start" title="Start">
                ${icon('play', 18)} Start
              </button>
              <button class="btn btn-warning" id="btn-restart" title="Restart">
                ${icon('refresh', 18)} Restart
              </button>
              <button class="btn btn-danger" id="btn-stop" title="Stop">
                ${icon('stop', 18)} Stop
              </button>
              <button class="btn btn-ghost" id="btn-kill" title="Kill">
                ${icon('x', 18)} Kill
              </button>
            </div>
          </div>

          <div class="console-stats">
            <div class="stat-item">
              <span class="stat-label">CPU</span>
              <span class="stat-value" id="stat-cpu">0%</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">RAM</span>
              <span class="stat-value" id="stat-ram">0 MB</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Network</span>
              <span class="stat-value" id="stat-network">↑0 ↓0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Uptime</span>
              <span class="stat-value" id="stat-uptime">—</span>
            </div>
          </div>

          <div class="console-terminal" id="terminal">
            <div class="terminal-output" id="terminal-output"></div>
          </div>

          <div class="console-input">
            <span class="input-prefix">$</span>
            <input type="text" id="command-input" placeholder="Type a command..." autocomplete="off">
            <button class="btn btn-primary" id="send-command">
              ${icon('send', 18)}
            </button>
          </div>
        </div>
      </main>
    </div>
  `;
}

export async function mount(params) {
  const serverId = params.id;
  const terminal = document.getElementById('terminal-output');
  const commandInput = document.getElementById('command-input');
  const MAX_LINES = 500;
  
  let ws = null;
  let server = null;

  function appendLine(text, type = 'output') {
    const line = document.createElement('div');
    line.className = `terminal-line terminal-${type}`;
    line.innerHTML = ansiToHtml(text);
    terminal.appendChild(line);

    while (terminal.children.length > MAX_LINES) {
      terminal.removeChild(terminal.firstChild);
    }

    terminal.scrollTop = terminal.scrollHeight;
  }

  function ansiToHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\x1b\[0m/g, '</span>')
      .replace(/\x1b\[1m/g, '<span class="bold">')
      .replace(/\x1b\[30m/g, '<span class="ansi-black">')
      .replace(/\x1b\[31m/g, '<span class="ansi-red">')
      .replace(/\x1b\[32m/g, '<span class="ansi-green">')
      .replace(/\x1b\[33m/g, '<span class="ansi-yellow">')
      .replace(/\x1b\[34m/g, '<span class="ansi-blue">')
      .replace(/\x1b\[35m/g, '<span class="ansi-magenta">')
      .replace(/\x1b\[36m/g, '<span class="ansi-cyan">')
      .replace(/\x1b\[37m/g, '<span class="ansi-white">');
  }

  async function loadServer() {
    try {
      const res = await api.get(`/servers/${serverId}`);
      server = res.data;
      document.getElementById('server-name').textContent = server.name;
      updateStatus(server.status);
    } catch (err) {
      toast.error('Failed to load server');
    }
  }

  function updateStatus(status) {
    const badge = document.getElementById('server-status');
    badge.textContent = status;
    badge.className = `badge badge-${status === 'online' ? 'success' : status === 'starting' ? 'warning' : 'danger'}`;
    
    document.getElementById('btn-start').disabled = status === 'online' || status === 'starting';
    document.getElementById('btn-stop').disabled = status === 'offline';
    document.getElementById('btn-restart').disabled = status === 'offline';
    document.getElementById('btn-kill').disabled = status === 'offline';
  }

  function connectWebSocket() {
    const token = getToken();
    ws = new WebSocket(`${WS_URL}/console/${serverId}?token=${token}`);

    ws.onopen = () => {
      appendLine('Connected to console', 'info');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'output') {
        appendLine(data.content);
      } else if (data.type === 'status') {
        updateStatus(data.status);
      } else if (data.type === 'stats') {
        document.getElementById('stat-cpu').textContent = `${data.cpu.toFixed(1)}%`;
        document.getElementById('stat-ram').textContent = formatBytes(data.memory);
        document.getElementById('stat-network').textContent = `↑${formatBytes(data.tx)} ↓${formatBytes(data.rx)}`;
      }
    };

    ws.onclose = () => {
      appendLine('Disconnected from console', 'error');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
      appendLine('Connection error', 'error');
    };
  }

  async function sendCommand() {
    const command = commandInput.value.trim();
    if (!command) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'command', command }));
      appendLine(`$ ${command}`, 'command');
      commandInput.value = '';
    } else {
      toast.error('Not connected to console');
    }
  }

  async function powerAction(action) {
    try {
      await api.post(`/servers/${serverId}/power`, { action });
      toast.success(`${action} command sent`);
    } catch (err) {
      toast.error(`Failed to ${action} server`);
    }
  }

  commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendCommand();
  });

  document.getElementById('send-command').addEventListener('click', sendCommand);
  document.getElementById('btn-start').addEventListener('click', () => powerAction('start'));
  document.getElementById('btn-stop').addEventListener('click', () => powerAction('stop'));
  document.getElementById('btn-restart').addEventListener('click', () => powerAction('restart'));
  document.getElementById('btn-kill').addEventListener('click', () => powerAction('kill'));

  await loadServer();
  connectWebSocket();

  return () => {
    if (ws) ws.close();
  };
}
