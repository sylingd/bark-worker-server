import type { Env, Hono } from 'hono';
import { API } from '../core/api';
import { type BasicKV, Database } from '../core/db';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

interface EOEventContext {
  params: any;
  request: Request;
  env: BasicEnv;
}

// @see https://edgeone.cloud.tencent.com/pages/document/162936897742577664
declare class EdgeOneKV {
  constructor(params: { namespace: string });
  get(
    key: string,
    options?: { type: 'stream' | 'json' | 'text' | 'arrayBuffer' },
  ): Promise<any>;
  put(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

class WrapEdgeOneKV implements BasicKV {
  kv: EdgeOneKV;
  constructor(name: string) {
    this.kv = (globalThis as any)[name];
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

interface EOHonoEnv extends Env {
  Bindings: BasicEnv;
}

let hono: Hono<EOHonoEnv>;

export const onRequest = (ctx: EOEventContext) => {
  if (!hono) {
    hono = createHono<EOHonoEnv>({
      basePath: ctx.env.ROOT_PATH || '/',
      createAPI: async (c) => {
        return new API(
          new Database(new WrapEdgeOneKV(c.env.DB_NAME || 'bark')),
          {
            allowNewDevice: c.env.ALLOW_NEW_DEVICE !== 'false',
            allowQueryNums: c.env.ALLOW_QUERY_NUMS !== 'false',
          },
        );
      },
      getBasicAuth(c) {
        return c.env.BASIC_AUTH;
      },
    });
  }
  return hono.fetch(ctx.request, ctx.env);
};
