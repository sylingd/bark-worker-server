import { serve } from '@hono/node-server';
import type { Env, Hono } from 'hono';
import { API } from '../core/api';
import { type BasicKV, Database } from '../core/db';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

class NodeKV implements BasicKV {
  kv: Record<string, string> = {};
  async get(key: string, options?: { type: 'json' | 'text' }) {
    const res = this.kv[key];
    if (!res) {
      return undefined;
    }
    return options?.type === 'json' ? JSON.parse(res) : res;
  }

  async put(key: string, value: string) {
    this.kv[key] = value;
  }

  async delete(key: string) {
    delete this.kv[key];
  }
}

interface ESAHonoEnv extends Env {
  Bindings: BasicEnv;
}

const hono: Hono<ESAHonoEnv> = createHono<ESAHonoEnv>({
  basePath: process.env.ROOT_PATH || '/',
  createAPI: async () => {
    return new API(new Database(new NodeKV()), {
      allowNewDevice: process.env.ALLOW_NEW_DEVICE !== 'false',
      allowQueryNums: process.env.ALLOW_QUERY_NUMS !== 'false',
      maxBatchPushCount: Number(process.env.MAX_BATCH_PUSH_COUNT),
    });
  },
  getBasicAuth: () => process.env.BASIC_AUTH,
});

serve(hono, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
