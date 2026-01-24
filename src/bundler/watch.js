#!/usr/bin/env node
const { watch } = require('rollup');
const chokidar = require('chokidar');
const path = require('path');
const { build, compileSass, inputOptions, outputOptions } = require('./rollup');
const htmlPlugin = require('./html-plugin');

const ROOT = path.resolve(__dirname, '../..');

let lastCSS = 'styles.css';
let lastJS = 'bundle.js';

function formatTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

async function startWatcher() {
  console.log('\n👀 Starting Sodium watch mode...\n');
  
  const assets = await build();
  lastJS = assets.js || lastJS;
  lastCSS = assets.css || lastCSS;
  
  const watcher = watch({
    ...inputOptions,
    output: outputOptions
  });
  
  watcher.on('event', (event) => {
    switch (event.code) {
      case 'START':
        break;
      case 'BUNDLE_START':
        console.log(`[${formatTime()}] Bundling JS...`);
        break;
      case 'BUNDLE_END':
        console.log(`[${formatTime()}] ✓ JS bundled in ${event.duration}ms`);
        event.result.close();
        regenerateHTML();
        break;
      case 'ERROR':
        console.error(`[${formatTime()}] ✗ Error:`, event.error.message);
        break;
    }
  });
  
  const scssWatcher = chokidar.watch(
    path.join(ROOT, 'src/styles/**/*.scss'),
    { ignoreInitial: true }
  );
  
  scssWatcher.on('change', async (filePath) => {
    const startTime = Date.now();
    const relativePath = path.relative(ROOT, filePath);
    console.log(`[${formatTime()}] SCSS changed: ${relativePath}`);
    
    const cssFile = await compileSass();
    if (cssFile) {
      lastCSS = cssFile;
      const elapsed = Date.now() - startTime;
      console.log(`[${formatTime()}] ✓ SCSS compiled in ${elapsed}ms`);
      regenerateHTML();
    }
  });
  
  const htmlWatcher = chokidar.watch(
    path.join(ROOT, 'src/templates/**/*.html'),
    { ignoreInitial: true }
  );
  
  htmlWatcher.on('change', (filePath) => {
    const relativePath = path.relative(ROOT, filePath);
    console.log(`[${formatTime()}] HTML changed: ${relativePath}`);
    regenerateHTML();
  });
  
  console.log('Watching for changes... (Ctrl+C to stop)\n');
  
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping watch mode...');
    watcher.close();
    scssWatcher.close();
    htmlWatcher.close();
    process.exit(0);
  });
}

function regenerateHTML() {
  htmlPlugin.generate({
    js: lastJS,
    css: lastCSS
  });
}

startWatcher();
