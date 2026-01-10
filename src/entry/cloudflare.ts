import type { Env, Hono } from 'hono';
import { API } from '../core/api';
import { type BasicKV, Database } from '../core/db';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

declare class CFKV {
  get(
    key: string,
    options?: { type: 'stream' | 'json' | 'text' | 'arrayBuffer' },
  ): Promise<any>;
  put(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

class CloudflareKV implements BasicKV {
  kv: CFKV;
  constructor(kv: CFKV) {
    this.kv = kv;
  }
  async get(key: string) {
    return await this.kv.get(key, { type: 'json' });
  }
  async set(key: string, value: any) {
    return await this.kv.put(key, value);
  }
  async delete(key: string) {
    return await this.kv.delete(key);
  }
}

interface CFHonoEnv extends Env {
  Bindings: BasicEnv;
}

let hono: Hono<CFHonoEnv>;

export default {
  fetch(request: any, env: any, ctx: any) {
    if (!hono) {
      hono = createHono({
        createAPI: async (c) => {
          return new API(
            new Database(new CloudflareKV((c.env as any)[c.env.DB_NAME])),
            {
              allowNewDevice: c.env.ALLOW_NEW_DEVICE !== 'false',
              allowQueryNums: c.env.ALLOW_NEW_DEVICE !== 'false',
            },
          );
        },
        getBasicAuth(c) {
          return c.env.BASIC_AUTH;
        },
      });
    }
    return hono.fetch(request, env, ctx);
  },
};
