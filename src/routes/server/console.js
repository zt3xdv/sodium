import { api } from '../../utils/api.js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { getToken } from '../../utils/api.js';

let consoleSocket = null;
let terminal = null;
let fitAddon = null;
let resizeObserver = null;
let statusCallback = null;
let resourcesCallback = null;
let serverIdGetter = null;
let resizeTimeout = null;
let lastDimensions = { cols: 0, rows: 0 };

export function setConsoleCallbacks(onStatus, onResources, getServerId) {
  statusCallback = onStatus;
  resourcesCallback = onResources;
  serverIdGetter = getServerId;
}

export function renderConsoleTab() {
  return `
    <div class="console-tab">
      <div class="card console-card">
        <div class="console-terminal" id="console-terminal"></div>
        <div class="console-input">
          <input type="text" id="command-input" placeholder="Type a command..." />
          <button class="btn btn-primary" id="send-command">
            <span class="material-icons-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function initConsoleTab(serverId) {
  cleanupConsoleTab();
  
  initTerminal();
  connectWebSocket(serverId);
  
  document.getElementById('send-command').onclick = () => sendCommand(serverId);
  document.getElementById('command-input').onkeypress = (e) => {
    if (e.key === 'Enter') sendCommand(serverId);
  };
}

function initTerminal() {
  const container = document.getElementById('console-terminal');
  if (!container) return;
  
  terminal = new Terminal({
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      cursorAccent: '#0d1117',
      selectionBackground: '#264f78',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc'
    },
    fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", "Menlo", monospace',
    fontSize: 13,
    lineHeight: 1.4,
    cursorBlink: true,
    cursorStyle: 'bar',
    scrollback: 5000,
    convertEol: true,
    disableStdin: true
  });
  
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());
  
  terminal.open(container);
  
  requestAnimationFrame(() => {
    safeFit();
  });
  
  resizeObserver = new ResizeObserver(() => {
    debouncedFit();
  });
  resizeObserver.observe(container);
  
  window.addEventListener('resize', debouncedFit);
}

function safeFit() {
  if (!fitAddon || !terminal) return;
  
  const container = document.getElementById('console-terminal');
  if (!container) return;
  
  container.style.visibility = 'hidden';
  fitAddon.fit();
  container.style.visibility = 'visible';
}

function debouncedFit() {
  requestAnimationFrame(safeFit);
}

async function connectWebSocket(serverId) {
  const token = getToken();
  
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/console?server=${serverId}&token=${encodeURIComponent(token)}`;
  
  consoleSocket = new WebSocket(wsUrl);
  
  consoleSocket.onopen = () => {
  };
  
  consoleSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleSocketMessage(message);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  };
  
  consoleSocket.onclose = () => {
    if (serverIdGetter && serverIdGetter() === serverId) {
      writeInfo('connection closed, reconnecting...');
      setTimeout(() => connectWebSocket(serverId), 5000);
    }
  };
  
  consoleSocket.onerror = (error) => {
    console.error('WebSocket error:', error);
    writeError('WebSocket connection failed');
  };
}

function handleSocketMessage(message) {
  const { event, args } = message;
  
  switch (event) {
    case 'auth success':
      consoleSocket.send(JSON.stringify({ event: 'send logs', args: [null] }));
      consoleSocket.send(JSON.stringify({ event: 'send stats', args: [null] }));
      break;
      
    case 'token expiring':
    case 'token expired':
      writeInfo('session expired, reconnecting...');
      break;
      
    case 'console output':
      if (args && args[0] && terminal) {
        terminal.writeln(args[0]);
      }
      break;
      
    case 'status':
      if (args && args[0]) {
        writeStatus(args[0]);
        if (statusCallback) statusCallback(args[0]);
      }
      break;
      
    case 'stats':
      if (args && args[0] && resourcesCallback) {
        const stats = typeof args[0] === 'string' ? JSON.parse(args[0]) : args[0];
        resourcesCallback(stats);
      }
      break;
      
    case 'install output':
      if (args && args[0] && terminal) {
        terminal.writeln(`\x1b[33m${args[0]}\x1b[0m`);
      }
      break;
      
    case 'install started':
      writeInfo('installation started...');
      break;
      
    case 'install completed':
      writeInfo('installation completed');
      break;
      
    case 'daemon error':
      if (args && args[0]) {
        writeError(args[0]);
      }
      break;
      
    case 'daemon message':
      if (args && args[0]) {
        writeInfo(args[0]);
      }
      break;
      
    default:
      console.log('Unhandled WebSocket event:', event, args);
  }
}

function writeInfo(text) {
  if (terminal) {
    terminal.writeln(`\x1b[90m${text}\x1b[0m`);
  }
}

function writeStatus(status) {
  if (terminal) {
    const statusMessages = {
      'starting': 'marked as starting...',
      'running': 'server is now running',
      'stopping': 'marked as stopping...',
      'offline': 'server is now offline',
      'killing': 'marked as killing...'
    };
    const msg = statusMessages[status] || `server status: ${status}`;
    terminal.writeln(`\x1b[90m${msg}\x1b[0m`);
  }
}

function writeError(text) {
  if (terminal) {
    terminal.writeln(`\x1b[31m${text}\x1b[0m`);
  }
}

async function sendCommand(serverId) {
  const input = document.getElementById('command-input');
  const command = input.value.trim();
  if (!command) return;
  
  if (terminal) {
    terminal.writeln(`\x1b[36m> ${command}\x1b[0m`);
  }
  input.value = '';
  
  if (consoleSocket && consoleSocket.readyState === WebSocket.OPEN) {
    consoleSocket.send(JSON.stringify({
      event: 'send command',
      args: [command]
    }));
  } else {
    const username = localStorage.getItem('username');
    try {
      const res = await api(`/api/servers/${serverId}/command`, {
        method: 'POST',
        
        body: JSON.stringify({ command })
      });
      
      if (!res.ok) {
        const data = await res.json();
        writeError(data.error);
      }
    } catch (e) {
      writeError('Failed to send command');
    }
  }
}

export function cleanupConsoleTab() {
  window.removeEventListener('resize', debouncedFit);
  
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }
  
  lastDimensions = { cols: 0, rows: 0 };
  
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
  
  if (fitAddon) {
    fitAddon = null;
  }
  
  if (consoleSocket) {
    consoleSocket.close();
    consoleSocket = null;
  }
}
