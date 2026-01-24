#!/usr/bin/env node
const isWatch = process.argv.includes('--watch');

if (isWatch) {
  require('./src/bundler/watch');
} else {
  require('./src/bundler/rollup').build();
}
