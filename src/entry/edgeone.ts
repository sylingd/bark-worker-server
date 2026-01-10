import type { Env, Hono } from 'hono';
import { API } from '../core/api';
import { type BasicKV, Database } from '../core/db';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

interface EOEventContext {
  uuid: string;
  params: any;
  request: Request;
  env: Record<string, unknown>;
  clientIp: string;
  server: {
    region: string;
    requestId: string;
  };
  geo: any;
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
  Bindings: {
    env: BasicEnv;
    clientIp: EOEventContext['clientIp'];
    server: EOEventContext['server'];
    geo: EOEventContext['geo'];
  };
}

let hono: Hono<EOHonoEnv>;

export const onRequest = (ctx: EOEventContext) => {
  if (!hono) {
    hono = createHono<EOHonoEnv>({
      createAPI: async (c) => {
        return new API(new Database(new WrapEdgeOneKV(c.env.env.DB_NAME)), {
          allowNewDevice: c.env.env.ALLOW_NEW_DEVICE !== 'false',
          allowQueryNums: c.env.env.ALLOW_QUERY_NUMS !== 'false',
        });
      },
      getBasicAuth(c) {
        return c.env.env.BASIC_AUTH;
      },
    });
  }
  return hono.fetch(ctx.request, {
    env: ctx.env,
    clientIp: ctx.clientIp,
    server: ctx.server,
    geo: ctx.geo,
  });
};
