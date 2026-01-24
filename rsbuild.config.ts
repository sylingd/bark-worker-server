import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type RsbuildConfig } from '@rsbuild/core';
import fs from 'fs-extra';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defines: Record<string, string> = {
  'process.env.ENTRY': JSON.stringify(process.env.ENTRY),
};

const config: RsbuildConfig = {
  output: {
    target: 'web',
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
      handler: {
        import: `./src/entry/${process.env.ENTRY}.ts`,
        html: false,
      },
    },
    define: defines,
  },
  tools: {
    rspack: {
      target: 'es2020',
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
};

if (process.env.ENTRY === 'node') {
  config.output!.target = 'node';
}

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

if (process.env.ENTRY === 'edgeone') {
  let proxyToken = process.env.PROXY_TOKEN;
  if (!proxyToken) {
    proxyToken = nanoid();
    console.log(`Generate PROXY_TOKEN: ${proxyToken}`);
  } else {
    console.log(`Use PROXY_TOKEN: ${proxyToken}`);
  }
  defines['process.env.PROXY_TOKEN'] = JSON.stringify(proxyToken);

  if (!process.env.URL_PREFIX || process.env.URL_PREFIX === '/') {
    throw new Error('Please set URL_PREFIX');
  }

  config.environments = {
    'node-proxy': {
      output: {
        target: 'node',
      },
      tools: {
        rspack: {
          target: 'node',
        },
      },
      source: {
        entry: {
          'apns-proxy': {
            import: `./src/entry/edgeone-apns-proxy.ts`,
            html: false,
          },
        },
      },
    },
  };

  config.plugins = [
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
              'bark-node',
              process.env.URL_PREFIX,
            );
            await fs.ensureDir(functions);
            await fs.ensureDir(nodeFunctions);
            const target = path.join(functions, '[[default]].js');
            if (await fs.pathExists(target)) {
              await fs.remove(target);
            }
            console.log(`Move handler.js to ${target}`);
            await fs.move(path.join(dist, 'handler.js'), target);

            const nodeTarget = path.join(nodeFunctions, 'apns-proxy.js');
            console.log(`Move apns-proxy.js to ${nodeTarget}`);
            const nodeTargetContent = await fs.readFile(
              path.join(dist, 'apns-proxy.js'),
              'utf-8',
            );
            await fs.writeFile(
              nodeTarget,
              nodeTargetContent.replace(
                /export[\s]*{(.*?) as handleRequest[\s]*}/,
                'export const onRequest=$1',
              ),
            );
          }
        });
      },
    },
  ];
}

// Docs: https://rsbuild.rs/config/
export default defineConfig(config);
