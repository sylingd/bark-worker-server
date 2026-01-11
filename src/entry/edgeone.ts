import type { Env, Hono } from 'hono';
import { API } from '../core/api';
import { Database } from '../core/db';
import { createHono } from '../core/hono';
import type { BasicEnv } from '../core/type';

interface EOEventContext {
  params: any;
  request: Request;
  env: BasicEnv;
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
          new Database((globalThis as any)[c.env.DB_NAME || 'BARK_KV']),
          {
            allowNewDevice: c.env.ALLOW_NEW_DEVICE !== 'false',
            allowQueryNums: c.env.ALLOW_QUERY_NUMS !== 'false',
            maxBatchPushCount: Number(c.env.MAX_BATCH_PUSH_COUNT),
          },
        );
      },
      getBasicAuth: (c) => c.env.BASIC_AUTH,
    });
  }
  return hono.fetch(ctx.request, ctx.env);
};
