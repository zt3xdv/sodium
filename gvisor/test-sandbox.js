#!/usr/bin/env node
/**
 * Test the Sodium gVisor sandbox
 */

import Sandbox from './sandbox.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  sandboxes_path: './sandboxes',
  runtimes_path: './runtimes',
  isolation: 'bubblewrap',
  default_limits: {
    memory_mb: 256,
    cpu_percent: 50,
    disk_mb: 256,
    timeout_seconds: 30,
    max_processes: 32,
    max_files: 256
  },
  network: { enabled: false }
};

async function test() {
  console.log('🧪 Testing Sodium Sandbox\n');

  const sandbox = new Sandbox(config);
  await sandbox.init();

  const testId = 'test-' + Date.now();
  
  console.log(`📦 Creating sandbox: ${testId}`);
  const meta = await sandbox.create(testId, {
    runtime: 'node',
    memory_mb: 128,
    cpu_percent: 25
  });
  console.log('   Limits:', meta.limits);

  // Write test script
  const homePath = path.join(sandbox.sandboxesPath, testId, 'home');
  await fs.writeFile(path.join(homePath, 'test.js'), `
console.log('🪶 Hello from Sodium Sandbox!');
console.log('Node.js:', process.version);
console.log('PID:', process.pid);
console.log('CWD:', process.cwd());
console.log('Memory:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB');

// Test loop to show stats
let i = 0;
const interval = setInterval(() => {
  console.log('Tick', ++i, 'Memory:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB');
  if (i >= 5) {
    clearInterval(interval);
    console.log('✅ Test complete!');
  }
}, 1000);
`);

  console.log('\n▶️  Starting sandbox...\n');

  sandbox.on('output', (id, data) => {
    process.stdout.write(`   ${data}`);
  });

  sandbox.on('stats', (id, stats) => {
    console.log(`   📊 Memory: ${Math.round(stats.memory_bytes / 1024 / 1024)}MB`);
  });

  sandbox.on('exit', (id, code) => {
    console.log(`\n⏹️  Exited with code: ${code}`);
  });

  try {
    await sandbox.start(testId, 'node', ['test.js']);

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 8000));

  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  console.log('\n🗑️  Cleaning up...');
  await sandbox.delete(testId);
  
  console.log('✅ Test finished!\n');
}

test().catch(console.error);
