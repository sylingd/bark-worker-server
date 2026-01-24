import type { Env, Hono } from 'hono';
import { nanoid } from 'nanoid/non-secure';
import { KVAdapter } from '../core/db/kv-adapter';
import { createHono } from '../core/hono';
import type {
  APNsProxyItem,
  APNsProxyResponse,
  APNsResponse,
  BasicEnv,
  Options,
} from '../core/type';

interface EOEventContext {
  params: any;
  request: Request;
  env: BasicEnv;
}

interface EOHonoEnv extends Env {
  Bindings: BasicEnv;
}

let hono: Hono<EOHonoEnv>;

interface QueueItem extends APNsProxyItem {
  resolve: (value: APNsResponse) => void;
}

let queue: QueueItem[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
const requestAPNs: NonNullable<Options['requestAPNs']> = (
  deviceToken,
  headers,
  aps,
  ctx,
) => {
  if (!ctx) {
    throw new Error('ctx is not defined');
  }
  const env: BasicEnv = ctx.env;
  return new Promise((resolve) => {
    let id = nanoid();
    while (queue.some((x) => x.id === id)) {
      id = nanoid();
    }
    queue.push({
      id,
      deviceToken,
      headers,
      aps,
      resolve,
    });
    if (typeof timer !== 'undefined') {
      return;
    }
    timer = setTimeout(async () => {
      timer = undefined;
      const cloneQueue = [...queue];
      queue = [];
      const f = await fetch(
        `https://${ctx.req.header('host')}${env.URL_PREFIX}-node/apns-proxy`,
        {
          method: 'POST',
          headers: {
            'x-token': String(env.PROXY_TOKEN),
          },
          body: JSON.stringify(cloneQueue),
        },
      );
      const resp = await f.json();
      if (!resp.data) {
        throw new Error('Execute queue failed');
      }
      resp.data.forEach((item: APNsProxyResponse) => {
        cloneQueue.find((x) => x.id === item.id)?.resolve(item);
      });
    });
  });
};

export const onRequest = (ctx: EOEventContext) => {
  if (!hono) {
    hono = createHono({
      db: new KVAdapter((globalThis as any)[ctx.env.DB_NAME || 'BARK_KV']),
      allowNewDevice: ctx.env.ALLOW_NEW_DEVICE !== 'false',
      allowQueryNums: ctx.env.ALLOW_QUERY_NUMS !== 'false',
      maxBatchPushCount: Number(ctx.env.MAX_BATCH_PUSH_COUNT),
      urlPrefix: ctx.env.URL_PREFIX || '/',
      basicAuth: ctx.env.BASIC_AUTH,
      apnsUrl: ctx.env.APNS_URL,
      requestAPNs,
    });
  }
  return hono.fetch(ctx.request, ctx.env);
};
