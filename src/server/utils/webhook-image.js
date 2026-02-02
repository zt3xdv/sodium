import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../../..');
const dataDir = join(rootDir, 'data');

const faviconSvg = readFileSync(join(rootDir, 'assets/favicon.svg'), 'utf-8');
const faviconDataUri = `data:image/svg+xml;base64,${Buffer.from(faviconSvg).toString('base64')}`;

let wasmInitialized = false;
let fontData = null;

async function initializeWasm() {
  if (wasmInitialized) return true;
  
  try {
    const wasmPath = join(rootDir, 'node_modules/@resvg/resvg-wasm/index_bg.wasm');
    if (!existsSync(wasmPath)) {
      logger.warn('WASM file not found, webhook images disabled');
      return false;
    }
    await initWasm(readFileSync(wasmPath));
    wasmInitialized = true;
    return true;
  } catch (e) {
    if (e.message?.includes('Already initialized')) {
      wasmInitialized = true;
      return true;
    }
    logger.warn(`Failed to initialize WASM: ${e.message}`);
    return false;
  }
}

async function loadFont() {
  if (fontData) return fontData;
  
  const fontPath = join(dataDir, 'Roboto-Regular.ttf');
  
  if (existsSync(fontPath)) {
    fontData = readFileSync(fontPath);
    return fontData;
  }
  
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-400-normal.woff');
    if (!res.ok) throw new Error('Font download failed');
    fontData = Buffer.from(await res.arrayBuffer());
    writeFileSync(fontPath, fontData);
    logger.info('Downloaded Roboto font for webhook images');
    return fontData;
  } catch (e) {
    logger.warn(`Failed to load font: ${e.message}`);
    return null;
  }
}

const STATUS_COLORS = {
  online: '#22c55e',
  starting: '#e07a3a',
  stopping: '#f59e0b',
  offline: '#71717a',
  crashed: '#ef4444',
  suspended: '#f59e0b',
  created: '#22c55e',
  deleted: '#ef4444',
  login: '#3498db'
};

const EVENT_CONFIG = {
  'server.created': { title: 'Server Created', status: 'created' },
  'server.deleted': { title: 'Server Deleted', status: 'deleted' },
  'server.started': { title: 'Server Started', status: 'online' },
  'server.stopped': { title: 'Server Stopped', status: 'offline' },
  'server.crashed': { title: 'Server Crashed', status: 'crashed' },
  'server.suspended': { title: 'Server Suspended', status: 'suspended' },
  'server.unsuspended': { title: 'Server Unsuspended', status: 'offline' },
  'user.created': { title: 'User Created', status: 'created' },
  'user.deleted': { title: 'User Deleted', status: 'deleted' },
  'user.login': { title: 'User Login', status: 'login' },
  'node.created': { title: 'Node Created', status: 'created' },
  'node.deleted': { title: 'Node Deleted', status: 'deleted' },
  'announcement.created': { title: 'Announcement Created', status: 'created' }
};

function getEventStats(event, data) {
  switch (event) {
    case 'server.created':
      return [
        { label: 'Egg', value: data.egg_name || 'Unknown' },
        { label: 'Owner', value: data.user_name || 'Unknown' },
        { label: 'Port', value: data.port?.toString() || 'N/A' }
      ];
    case 'server.deleted':
      return [
        { label: 'Owner', value: data.user_name || 'Unknown' },
        { label: 'Disk', value: formatBytes(data.disk) },
        { label: 'By', value: data.deleted_by || 'admin' }
      ];
    case 'server.started':
    case 'server.stopped':
    case 'server.crashed':
      return [
        { label: 'Memory', value: formatBytes(data.memory) },
        { label: 'CPU', value: data.cpu ? `${data.cpu}%` : '0%' },
        { label: 'Disk', value: formatBytes(data.disk) }
      ];
    case 'server.suspended':
    case 'server.unsuspended':
      return [
        { label: 'Owner', value: data.user_name || 'Unknown' },
        { label: 'Reason', value: data.reason || 'N/A' },
        { label: 'By', value: data.suspended_by || 'admin' }
      ];
    case 'user.created':
    case 'user.deleted':
      return [
        { label: 'Username', value: data.user_name || 'Unknown' },
        { label: 'Email', value: truncate(data.email, 20) || 'N/A' },
        { label: 'Admin', value: data.is_admin ? 'Yes' : 'No' }
      ];
    case 'user.login':
      return [
        { label: 'Username', value: data.user_name || 'Unknown' },
        { label: 'IP', value: data.ip || 'Unknown' },
        { label: 'Device', value: truncate(data.user_agent, 15) || 'Unknown' }
      ];
    case 'node.created':
    case 'node.deleted':
      return [
        { label: 'Node', value: data.node_name || 'Unknown' },
        { label: 'Memory', value: formatBytes(data.memory) },
        { label: 'Disk', value: formatBytes(data.disk) }
      ];
    case 'announcement.created':
      return [
        { label: 'Title', value: truncate(data.title, 18) || 'Untitled' },
        { label: 'Type', value: data.type || 'info' },
        { label: 'By', value: data.created_by || 'admin' }
      ];
    default:
      return [
        { label: 'Event', value: event },
        { label: 'Time', value: new Date().toLocaleTimeString() },
        { label: 'Data', value: 'N/A' }
      ];
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 MB';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function truncate(str, len) {
  if (!str) return str;
  return str.length > len ? str.substring(0, len - 2) + '..' : str;
}

function createStatBox(label, value) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        background: '#18181b',
        border: '1px solid #27272a',
        padding: '10px 14px',
        borderRadius: '8px',
        flex: 1
      },
      children: [
        {
          type: 'span',
          props: {
            style: { fontSize: '10px', color: '#71717a', marginBottom: '4px' },
            children: label
          }
        },
        {
          type: 'span',
          props: {
            style: { fontSize: '15px', fontWeight: '600', color: '#fafafa' },
            children: value || 'N/A'
          }
        }
      ]
    }
  };
}

async function generateWebhookImage(event, data) {
  if (!await initializeWasm()) return null;
  
  const font = await loadFont();
  if (!font) return null;
  
  const config = EVENT_CONFIG[event] || { title: event, status: 'offline' };
  const statusColor = STATUS_COLORS[config.status] || STATUS_COLORS.offline;
  const stats = getEventStats(event, data);
  const serverName = data.server_name || data.node_name || data.user_name || data.title || 'Sodium Panel';
  const nodeName = data.node_name || 'Panel';
  
  try {
    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: '#09090b',
            fontFamily: 'Roboto',
            color: '#fafafa'
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: '1px solid #27272a'
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', alignItems: 'center', gap: '8px' },
                      children: [
                        {
                          type: 'img',
                          props: {
                            src: faviconDataUri,
                            style: { width: '18px', height: '18px' }
                          }
                        },
                        {
                          type: 'span',
                          props: {
                            style: { fontWeight: '600', fontSize: '14px' },
                            children: 'Sodium'
                          }
                        }
                      ]
                    }
                  },
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#18181b',
                        padding: '4px 10px',
                        borderRadius: '12px'
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            style: {
                              width: '8px',
                              height: '8px',
                              background: statusColor,
                              borderRadius: '50%'
                            }
                          }
                        },
                        {
                          type: 'span',
                          props: {
                            style: { fontSize: '11px', color: '#a1a1aa', textTransform: 'capitalize' },
                            children: config.status
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            },
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '20px',
                  flex: 1,
                  justifyContent: 'space-between'
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', flexDirection: 'column' },
                      children: [
                        {
                          type: 'div',
                          props: {
                            style: { fontSize: '20px', fontWeight: '700', marginBottom: '10px' },
                            children: serverName
                          }
                        },
                        {
                          type: 'div',
                          props: {
                            style: { fontSize: '13px', color: '#e07a3a' },
                            children: config.title
                          }
                        }
                      ]
                    }
                  },
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', gap: '10px' },
                      children: stats.map(s => createStatBox(s.label, s.value))
                    }
                  }
                ]
              }
            },
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 20px',
                  borderTop: '1px solid #27272a',
                  fontSize: '11px',
                  color: '#71717a'
                },
                children: [
                  {
                    type: 'span',
                    props: { children: `Node: ${nodeName}` }
                  },
                  {
                    type: 'span',
                    props: { children: new Date().toLocaleString() }
                  }
                ]
              }
            }
          ]
        }
      },
      {
        width: 440,
        height: 220,
        fonts: [
          {
            name: 'Roboto',
            data: font,
            weight: 400,
            style: 'normal'
          }
        ]
      }
    );
    
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1320 }
    });
    
    return resvg.render().asPng();
  } catch (e) {
    logger.warn(`Failed to generate webhook image: ${e.message}`);
    return null;
  }
}

export { generateWebhookImage };
