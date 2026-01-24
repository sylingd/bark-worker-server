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
  reject: (reason?: Error) => void;
}

interface IAPNsProxy {
  host: string;
  prefix: string;
  token: string;
  queue: QueueItem[];
  timer: ReturnType<typeof setTimeout> | undefined;
  execute: () => Promise<void>;
  request: NonNullable<Options['requestAPNs']>;
}

const APNsProxy: IAPNsProxy = {
  host: '',
  prefix: '',
  token: process.env.PROXY_TOKEN as string,
  queue: [],
  timer: undefined,
  execute: async function (this: IAPNsProxy) {
    this.timer = undefined;
    const cloneQueue = [...this.queue];
    this.queue = [];
    try {
      const f = await fetch(
        `https://${this.host}/bark-node${this.prefix}/apns-proxy`,
        {
          method: 'POST',
          headers: {
            'x-token': this.token,
            'content-type': 'application/json',
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
    } catch (e) {
      cloneQueue.forEach((x) => x.reject(e as Error));
    }
  },
  request: function (this: IAPNsProxy, deviceToken, headers, aps, ctx) {
    if (!ctx) {
      throw new Error('ctx is not defined');
    }
    const env: BasicEnv = ctx.env;
    if (env.PROXY_TOKEN) {
      this.token = env.PROXY_TOKEN;
    }
    this.host = String(ctx.req.header('host'));
    this.prefix = String(env.URL_PREFIX);

    return new Promise((resolve, reject) => {
      let id = nanoid();
      while (this.queue.some((x) => x.id === id)) {
        id = nanoid();
      }
      this.queue.push({
        id,
        deviceToken,
        headers,
        aps,
        resolve,
        reject,
      });
      if (typeof this.timer !== 'undefined') {
        return;
      }
      this.timer = setTimeout(this.execute.bind(this));
    });
  },
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
      requestAPNs: ctx.env.APNS_URL
        ? undefined
        : APNsProxy.request.bind(APNsProxy),
    });
  }
  return hono.fetch(ctx.request, ctx.env);
};
