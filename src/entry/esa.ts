import { env } from 'node:process';
import type { Env, Hono } from 'hono';
import { API } from '../core/api';
import { type BasicKV, Database } from '../core/db';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

// @see https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/edge-storage-api
declare class EdgeKV {
  constructor(params: { namespace: string });
  get(
    key: string,
    options?: { type: 'stream' | 'json' | 'text' | 'arrayBuffer' },
  ): Promise<any>;
  put(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

class ESAKV implements BasicKV {
  kv: EdgeKV;
  constructor(name: string) {
    this.kv = new EdgeKV({ namespace: name });
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

interface ESAHonoEnv extends Env {
  Bindings: BasicEnv;
}

let hono: Hono<ESAHonoEnv>;

export default {
  fetch(request: any) {
    if (!hono) {
      hono = createHono<ESAHonoEnv>({
        basePath: env.ROOT_PATH || '/',
        createAPI: async () => {
          return new API(new Database(new ESAKV(env.DB_NAME || 'bark')), {
            allowNewDevice: env.ALLOW_NEW_DEVICE !== 'false',
            allowQueryNums: env.ALLOW_QUERY_NUMS !== 'false',
          });
        },
        getBasicAuth() {
          return env.BASIC_AUTH;
        },
      });
    }
    return hono.fetch(request, env);
  },
};
