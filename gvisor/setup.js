#!/usr/bin/env node
/**
 * Sodium gVisor Setup
 * Downloads and configures gVisor (runsc) and required runtimes
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { createWriteStream, existsSync } from 'fs';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GVISOR_VERSION = 'release-20240219.0';
const ARCH = process.arch === 'x64' ? 'x86_64' : process.arch === 'arm64' ? 'aarch64' : 'x86_64';

const RUNTIMES = {
  node: {
    name: 'Node.js 20',
    download: 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz',
    binary: 'node',
    version_cmd: 'node --version'
  },
  python: {
    name: 'Python 3.12',
    download: null, // System python
    binary: 'python3',
    version_cmd: 'python3 --version'
  },
  bun: {
    name: 'Bun',
    download: 'https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip',
    binary: 'bun',
    version_cmd: 'bun --version'
  },
  deno: {
    name: 'Deno',
    download: 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip',
    binary: 'deno',
    version_cmd: 'deno --version'
  }
};

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Sodium' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function setupGvisor() {
  console.log('🔧 Setting up gVisor...\n');

  const binDir = path.join(__dirname, 'bin');
  const runtimesDir = path.join(__dirname, 'runtimes');
  const sandboxDir = path.join(__dirname, 'sandboxes');

  await fs.mkdir(binDir, { recursive: true });
  await fs.mkdir(runtimesDir, { recursive: true });
  await fs.mkdir(sandboxDir, { recursive: true });

  // Check if running as root (required for gVisor)
  const isRoot = process.getuid?.() === 0;

  // Download gVisor runsc
  const runscPath = path.join(binDir, 'runsc');
  if (!existsSync(runscPath)) {
    console.log('📥 Downloading gVisor runsc...');
    const runscUrl = `https://storage.googleapis.com/gvisor/releases/${GVISOR_VERSION}/${ARCH}/runsc`;
    
    try {
      await download(runscUrl, runscPath);
      await fs.chmod(runscPath, 0o755);
      console.log('✅ gVisor runsc downloaded\n');
    } catch (err) {
      console.log('⚠️  Could not download gVisor, will use bubblewrap fallback');
      console.log('   Error:', err.message);
    }
  } else {
    console.log('✅ gVisor runsc already exists\n');
  }

  // Check for bubblewrap (lighter alternative)
  try {
    await execAsync('which bwrap');
    console.log('✅ Bubblewrap (bwrap) available as fallback\n');
  } catch {
    console.log('⚠️  Bubblewrap not found. Install with: apt install bubblewrap\n');
  }

  // Create runtime directories
  console.log('📦 Setting up runtimes...\n');

  for (const [id, runtime] of Object.entries(RUNTIMES)) {
    const runtimeDir = path.join(runtimesDir, id);
    await fs.mkdir(runtimeDir, { recursive: true });
    
    try {
      const { stdout } = await execAsync(`which ${runtime.binary}`);
      console.log(`✅ ${runtime.name}: ${stdout.trim()}`);
    } catch {
      console.log(`⚠️  ${runtime.name} not found in PATH`);
    }
  }

  // Create default config
  const configPath = path.join(__dirname, 'config.json');
  if (!existsSync(configPath)) {
    const config = {
      host: '0.0.0.0',
      port: 8081,
      isolation: isRoot ? 'gvisor' : 'bubblewrap',
      sandboxes_path: './sandboxes',
      runtimes_path: './runtimes',
      default_limits: {
        memory_mb: 512,
        cpu_percent: 100,
        disk_mb: 1024,
        timeout_seconds: 300,
        max_processes: 64,
        max_files: 1024
      },
      network: {
        enabled: false,
        allowed_hosts: []
      }
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log('\n✅ Created config.json');
  }

  console.log('\n🎉 Setup complete!');
  console.log('\nRun: npm start (or node daemon.js)');
}

setupGvisor().catch(console.error);
