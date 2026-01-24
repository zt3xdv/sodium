#!/usr/bin/env node
const { rollup } = require('rollup');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const sass = require('sass');
const fs = require('fs');
const path = require('path');
const htmlPlugin = require('./html-plugin');

const ROOT = path.resolve(__dirname, '../..');
const isProduction = process.env.NODE_ENV === 'production';

const inputOptions = {
  input: path.join(ROOT, 'src/main.js'),
  plugins: [
    resolve(),
    commonjs()
  ]
};

const outputOptions = {
  file: path.join(ROOT, 'dist/bundle.js'),
  format: 'iife',
  name: 'Sodium',
  sourcemap: !isProduction
};

async function compileSass() {
  const inputFile = path.join(ROOT, 'src/styles/main.scss');
  const outputFile = path.join(ROOT, 'dist/styles.css');
  const mapFile = path.join(ROOT, 'dist/styles.css.map');
  
  if (!fs.existsSync(inputFile)) {
    console.log('⚠ No SCSS entry found, skipping...');
    return null;
  }
  
  try {
    const result = sass.compile(inputFile, {
      style: isProduction ? 'compressed' : 'expanded',
      sourceMap: !isProduction
    });
    
    fs.writeFileSync(outputFile, result.css);
    
    if (result.sourceMap && !isProduction) {
      fs.writeFileSync(mapFile, JSON.stringify(result.sourceMap));
    }
    
    console.log('✓ SCSS compiled');
    return 'styles.css';
  } catch (err) {
    console.error('✗ SCSS Error:', err.message);
    return null;
  }
}

async function compileJS() {
  try {
    const bundle = await rollup(inputOptions);
    await bundle.write(outputOptions);
    await bundle.close();
    
    if (isProduction) {
      await minifyJS();
    }
    
    console.log('✓ JavaScript bundled');
    return 'bundle.js';
  } catch (err) {
    console.error('✗ Rollup Error:', err.message);
    return null;
  }
}

async function minifyJS() {
  const bundlePath = path.join(ROOT, 'dist/bundle.js');
  const content = fs.readFileSync(bundlePath, 'utf8');
  
  const minified = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,=<>!&|+\-*/])\s*/g, '$1')
    .trim();
  
  fs.writeFileSync(bundlePath, minified);
  console.log('✓ JavaScript minified');
}

async function build() {
  const startTime = Date.now();
  console.log(`\n🔨 Building Sodium (${isProduction ? 'production' : 'development'})...\n`);
  
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  const [jsFile, cssFile] = await Promise.all([
    compileJS(),
    compileSass()
  ]);
  
  const assets = {
    js: jsFile,
    css: cssFile
  };
  
  htmlPlugin.generate(assets);
  
  const elapsed = Date.now() - startTime;
  console.log(`\n✓ Build complete in ${elapsed}ms\n`);
  
  return assets;
}

module.exports = { build, compileJS, compileSass, inputOptions, outputOptions };

if (require.main === module) {
  build();
}
