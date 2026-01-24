import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type RsbuildEntry } from '@rsbuild/core';
import fs from 'fs-extra';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defines: Record<string, string> = {
  'process.env.ENTRY': JSON.stringify(process.env.ENTRY),
};

if (process.env.ENTRY === 'esa') {
  [
    'URL_PREFIX',
    'MAX_BATCH_PUSH_COUNT',
    'DB_NAME',
    'ALLOW_NEW_DEVICE',
    'ALLOW_QUERY_NUMS',
    'BASIC_AUTH',
    'APNS_URL',
  ].forEach((key) => {
    defines[`process.env.${key}`] = process.env[key]
      ? JSON.stringify(process.env[key])
      : 'undefined';
  });
}

const otherEntry: RsbuildEntry = {};

if (process.env.ENTRY === 'edgeone') {
  let proxyToken = process.env.PROXY_TOKEN;
  if (!proxyToken) {
    proxyToken = nanoid();
    console.log(`Generate PROXY_TOKEN: ${proxyToken}`);
  } else {
    console.log(`Use PROXY_TOKEN: ${proxyToken}`);
  }
  defines['process.env.PROXY_TOKEN'] = JSON.stringify(proxyToken);
  otherEntry['apns-proxy'] = {
    import: `./src/entry/edgeone-apns-proxy.ts`,
    html: false,
  };

  if (!process.env.URL_PREFIX || process.env.URL_PREFIX === '/') {
    throw new Error('Please set URL_PREFIX');
  }
}

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  output: {
    target: process.env.ENTRY === 'node' ? 'node' : 'web',
    module: true,
    distPath: {
      root: 'dist',
      js: '.',
    },
    filename: {
      js: '[name].js',
    },
    cleanDistPath: true,
    polyfill: 'off',
    sourceMap: false,
    minify: false,
    externals: ['node:process'],
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
  source: {
    entry: {
      ...otherEntry,
      handler: {
        import: `./src/entry/${process.env.ENTRY}.ts`,
        html: false,
      },
    },
    define: defines,
  },
  tools: {
    rspack: {
      target: process.env.ENTRY === 'node' ? 'node' : 'es2020',
      output: {
        asyncChunks: false,
        library: {
          type: 'module',
        },
      },
      experiments: {
        outputModule: true,
      },
    },
  },
  plugins: [
    {
      name: 'after',
      setup(api) {
        api.onAfterBuild(async () => {
          if (process.env.ENTRY === 'edgeone') {
            if (!process.env.URL_PREFIX || process.env.URL_PREFIX === '/') {
              throw new Error('Please set URL_PREFIX');
            }
            const cwd = process.cwd();
            const dist = path.join(__dirname, 'dist');
            const functions = path.join(
              cwd,
              'edge-functions',
              process.env.URL_PREFIX,
            );
            const nodeFunctions = path.join(
              cwd,
              'node-functions',
              `${process.env.URL_PREFIX}-node`,
            );
            await fs.ensureDir(functions);
            await fs.ensureDir(nodeFunctions);
            const target = path.join(functions, '[[default]].js');
            if (await fs.pathExists(target)) {
              await fs.remove(target);
            }
            const nodeTarget = path.join(nodeFunctions, 'apns-proxy.js');
            if (await fs.pathExists(nodeTarget)) {
              await fs.remove(nodeTarget);
            }
            console.log(`Move handler.js to ${target}`);
            await fs.move(path.join(dist, 'handler.js'), target);
            console.log(`Move apns-proxy.js to ${nodeTarget}`);
            await fs.move(path.join(dist, 'apns-proxy.js'), nodeTarget);
          }
        });
      },
    },
  ],
});
