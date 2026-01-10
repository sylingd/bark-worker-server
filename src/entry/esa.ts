import type { Env, Hono } from 'hono';
import { API } from '../core/api';
import { type BasicKV, Database } from '../core/db';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

// @see https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/edge-storage-api
declare class EdgeKV implements BasicKV {
  constructor(params: { namespace: string });
  get(key: string, options?: { type: 'json' | 'text' }): Promise<any>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface ESAHonoEnv extends Env {
  Bindings: BasicEnv;
}

let hono: Hono<ESAHonoEnv>;

// inject in build
const env = {
  DB_NAME: process.env.DB_NAME || 'bark',
  ALLOW_NEW_DEVICE: process.env.ALLOW_NEW_DEVICE || 'true',
  ALLOW_QUERY_NUMS: process.env.ALLOW_QUERY_NUMS || 'true',
  BASIC_AUTH: process.env.BASIC_AUTH || '',
  ROOT_PATH: process.env.ROOT_PATH || '/',
};

export default {
  fetch(request: Request) {
    if (!hono) {
      hono = createHono<ESAHonoEnv>({
        basePath: env.ROOT_PATH || '/',
        createAPI: async () => {
          return new API(
            new Database(new EdgeKV({ namespace: env.DB_NAME || 'bark' })),
            {
              allowNewDevice: env.ALLOW_NEW_DEVICE !== 'false',
              allowQueryNums: env.ALLOW_QUERY_NUMS !== 'false',
            },
          );
        },
        getBasicAuth() {
          return env.BASIC_AUTH;
        },
      });
    }
    return hono.fetch(request, env);
  },
};
