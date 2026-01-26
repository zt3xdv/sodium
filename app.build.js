import { watch, rollup } from '../hawk/src/bundler/rollup.js';
import { cacheBuild } from 'rollup-cache';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import progress from 'rollup-plugin-progress';
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';
import htmlPlugin from '../hawk/src/bundler/html-plugin.js';
import path from 'path';

const args = process.argv.slice(2).map(a => a.toLowerCase());
const isDev = args.includes('dev');
const isFast = args.includes('fast');
const isProd = (!isDev && !isFast) || args.includes('prod');

const input = 'src/main.js';
const outDir = path.resolve('dist');

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
  cyan: "\x1b[36m"
};

const formatError = (err) => {
  const ruta = err.loc?.file || err.id || 'Unknown';
  const linea = err.loc?.line || err.line || '-';
  const mensaje = err.message || err;

  console.error(`\n${c.gray}┌──────────────────────────────────────────────${c.reset}`);
  console.error(`${c.gray}│ ${c.white}${c.bold}ERROR${c.reset}`);
  console.error(`${c.gray}├──────────────────────────────────────────────${c.reset}`);
  console.error(`${c.gray}│ Path    ${c.gray}:: ${c.white}${ruta}${c.reset}`);
  console.error(`${c.gray}│ Message ${c.gray}:: ${c.white}${mensaje}${c.reset}`);
  console.error(`${c.gray}│ Line    ${c.gray}:: ${c.white}${linea}${c.reset}`);
  console.error(`${c.gray}└──────────────────────────────────────────────${c.reset}\n`);
};

const basePlugins = [
  resolve({ 
    browser: true, 
    extensions: ['.js'],
    preferBuiltins: false
  }),
  commonjs({
    sourceMap: false
  }),
  json(),
  postcss({
    extensions: ['.css', '.scss'],
    extract: 'main.css',
    minimize: isProd,
    sourceMap: false,
    use: {
      sass: {
        silenceDeprecations: ['legacy-js-api']
      }
    },
    plugins: [
      autoprefixer()
    ]
  }),
  htmlPlugin({
    template: 'src/templates/index.html',
    filename: 'index.html'
  })
];

if (!isDev && !isFast) {
  basePlugins.push(progress());
}

if (isProd) {
  basePlugins.push(terser({
    format: {
      comments: false
    },
    compress: {
      passes: 2
    }
  }));
}

const baseConfig = {
  input,
  plugins: basePlugins,
  output: {
    dir: outDir,
    format: 'es',
    name: 'Sodium',
    indent: false,
    sourcemap: false,
    compact: isProd
  },
  cache: true,
  treeshake: isProd ? true : false,
  onwarn(warning, warn) {
    if (warning.code === 'FILE_NAME_CONFLICT') return;
    if (warning.plugin === 'postcss' && warning.message.includes('deprecation')) return;
    warn(warning);
  }
};

const cacheOptions = {
  name: 'sodium-build-cache',
  dependencies: [],
  enabled: true
};

const cachedBuildConfig = isFast ? baseConfig : cacheBuild(cacheOptions, baseConfig);

async function runBuild() {
  try {
    const bundle = await rollup(cachedBuildConfig);
    await bundle.write(cachedBuildConfig.output);
    await bundle.close();
    console.log(`${c.cyan}│ ${c.white}Sodium build successful ${c.cyan}│${c.reset}`);
    process.exit(0);
  } catch (err) {
    formatError(err);
    process.exit(1);
  }
}

async function runWatch() {
  const watcher = watch({
    ...baseConfig,
    watch: {
      exclude: ['node_modules/**'],
      chokidar: {
        ignoreInitial: true,
        ignorePermissionErrors: true,
        usePolling: false,
        interval: 100,
        binaryInterval: 300,
        awaitWriteFinish: false
      },
      clearScreen: false,
      buildDelay: 0,
      skipWrite: false
    }
  });

  watcher.on('event', event => {
    if (event.code === 'BUNDLE_START') {
      console.clear(); 
      console.log(`${c.gray}┌──────────────────────────────────────────────${c.reset}`);
      console.log(`${c.gray}│ ${c.cyan}Sodium Bundler ${c.gray}running...${c.reset}`);
      console.log(`${c.gray}├──────────────────────────────────────────────${c.reset}`);
      process.stdout.write(`${c.gray}│ ${c.white}Bundling...${c.reset}`);
    } else if (event.code === 'BUNDLE_END') {
      if (process.stdout.clearLine) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
      }
      console.log(`${c.gray}│ ${c.white}Finished in ${c.bold}${event.duration}ms${c.reset}`);
      console.log(`${c.gray}└──────────────────────────────────────────────${c.reset}`);
    } else if (event.code === 'ERROR' || event.code === 'FATAL') {
      if (process.stdout.clearLine) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
      }
      formatError(event.error);
    }
  });

  process.on('SIGINT', async () => {
    await watcher.close();
    process.exit(0);
  });
}

if (isDev) {
  runWatch();
} else {
  runBuild();
}
