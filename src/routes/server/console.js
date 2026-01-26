import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

let consoleSocket = null;
let terminal = null;
let fitAddon = null;
let resizeObserver = null;
let statusCallback = null;
let resourcesCallback = null;
let serverIdGetter = null;

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
  
  setTimeout(() => {
    fitAddon.fit();
  }, 0);
  
  resizeObserver = new ResizeObserver(() => {
    if (fitAddon) {
      fitAddon.fit();
    }
  });
  resizeObserver.observe(container);
  
  window.addEventListener('resize', handleResize);
  
  terminal.writeln('\x1b[90m[SYSTEM] Connecting to console...\x1b[0m');
}

function handleResize() {
  if (fitAddon) {
    fitAddon.fit();
  }
}

async function connectWebSocket(serverId) {
  const username = localStorage.getItem('username');
  
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/console?server=${serverId}&username=${encodeURIComponent(username)}`;
  
  consoleSocket = new WebSocket(wsUrl);
  
  consoleSocket.onopen = () => {
    writeSystem('Connected to console');
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
      writeSystem('Connection closed, reconnecting...');
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
      writeSystem('Authenticated successfully');
      consoleSocket.send(JSON.stringify({ event: 'send logs', args: [null] }));
      consoleSocket.send(JSON.stringify({ event: 'send stats', args: [null] }));
      break;
      
    case 'token expiring':
    case 'token expired':
      writeSystem('Token expired, reconnecting...');
      break;
      
    case 'console output':
      if (args && args[0] && terminal) {
        console.log('Console output raw:', JSON.stringify(args[0]));
        terminal.write(args[0]);
      }
      break;
      
    case 'status':
      if (args && args[0] && statusCallback) {
        statusCallback(args[0]);
      }
      break;
      
    case 'stats':
      if (args && args[0] && resourcesCallback) {
        resourcesCallback(args[0]);
      }
      break;
      
    case 'install output':
      if (args && args[0] && terminal) {
        terminal.write(`\x1b[33m${args[0]}\x1b[0m`);
      }
      break;
      
    case 'install started':
      writeSystem('Installation started...');
      break;
      
    case 'install completed':
      writeSystem('Installation completed');
      break;
      
    case 'daemon error':
      if (args && args[0]) {
        writeError(`DAEMON: ${args[0]}`);
      }
      break;
      
    case 'daemon message':
      if (args && args[0]) {
        writeSystem(`DAEMON: ${args[0]}`);
      }
      break;
      
    default:
      console.log('Unhandled WebSocket event:', event, args);
  }
}

function writeSystem(text) {
  if (terminal) {
    terminal.writeln(`\x1b[90m[SYSTEM] ${text}\x1b[0m`);
  }
}

function writeError(text) {
  if (terminal) {
    terminal.writeln(`\x1b[31m[ERROR] ${text}\x1b[0m`);
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
      const res = await fetch(`/api/servers/${serverId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, command })
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
  window.removeEventListener('resize', handleResize);
  
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
