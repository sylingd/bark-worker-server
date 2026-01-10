import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import fs from 'fs-extra';

const defines: any = {
  'process.env.ENTRY': JSON.stringify(process.env.ENTRY),
};

if (process.env.ENTRY === 'esa') {
  defines['process.env.ROOT_PATH'] = JSON.stringify(process.env.ROOT_PATH);
  defines['process.env.DB_NAME'] = JSON.stringify(process.env.DB_NAME);
  defines['process.env.ALLOW_NEW_DEVICE'] = JSON.stringify(
    process.env.ALLOW_NEW_DEVICE,
  );
  defines['process.env.ALLOW_QUERY_NUMS'] = JSON.stringify(
    process.env.ALLOW_QUERY_NUMS,
  );
  defines['process.env.BASIC_AUTH'] = JSON.stringify(process.env.BASIC_AUTH);
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
            const dist = path.join(__dirname, 'dist');
            const functions = process.env.ROOT_PATH
              ? path.join(dist, 'edge-functions', process.env.ROOT_PATH)
              : path.join(dist, 'edge-functions');
            await fs.ensureDir(functions);
            await fs.move(
              path.join(dist, 'handler.js'),
              path.join(functions, '[[default]].js'),
            );
          }
        });
      },
    },
  ],
});
