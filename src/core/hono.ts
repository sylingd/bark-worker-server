import { type Context, type Env, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { API, APIError, type PushParameters } from './api';
import type { Options } from './type';
import { getTimestamp, validateBasicAuth } from './utils';

const parseParam = (t: string) =>
  decodeURIComponent(t.replaceAll('\\+', '%20'));

const parseBody = async <T = any>(c: Context): Promise<T> => {
  const isJSON = c.req.header('Content-Type')?.startsWith('application/json');
  return isJSON ? await c.req.json() : ((await c.req.parseBody()) as T);
};

const parseQuery = (c: Context, exclude?: Array<keyof PushParameters>) => {
  const list: Array<keyof PushParameters> = [
    'title',
    'subtitle',
    'body',
    'sound',
    'group',
    'call',
    'isArchive',
    'icon',
    'ciphertext',
    'level',
    'volume',
    'url',
    'image',
    'copy',
    'badge',
    'autoCopy',
    'action',
    'iv',
    'id',
    'delete',
    'markdown',
  ];
  const result: PushParameters = {};
  for (const k of list) {
    if (!exclude || !exclude.includes(k)) {
      const v = c.req.query(k);
      if (v) {
        result[k] = v as any;
      }
    }
  }
  return result;
};

const registerV1 = async (app: Hono, api: API) => {
  app.get('/:device_key', async (c) =>
    c.json(
      await api.push(
        {
          ...parseQuery(c, ['device_key']),
          device_key: parseParam(c.req.param('device_key')),
        },
        c,
      ),
    ),
  );
  app.post('/:device_key', async (c) =>
    c.json(
      await api.push(
        {
          ...(await parseBody(c)),
          device_key: parseParam(c.req.param('device_key')),
        },
        c,
      ),
    ),
  );

  app.get('/:device_key/:body', async (c) =>
    c.json(
      await api.push(
        {
          ...parseQuery(c, ['device_key', 'body']),
          device_key: parseParam(c.req.param('device_key')),
          body: parseParam(c.req.param('body')),
        },
        c,
      ),
    ),
  );
  app.post('/:device_key/:body', async (c) =>
    c.json(
      await api.push(
        {
          ...(await parseBody(c)),
          device_key: parseParam(c.req.param('device_key')),
          body: parseParam(c.req.param('body')),
        },
        c,
      ),
    ),
  );

  app.get('/:device_key/:title/:body', async (c) =>
    c.json(
      await api.push(
        {
          ...parseQuery(c, ['device_key', 'title', 'body']),
          device_key: parseParam(c.req.param('device_key')),
          title: parseParam(c.req.param('title')),
          body: parseParam(c.req.param('body')),
        },
        c,
      ),
    ),
  );
  app.post('/:device_key/:title/:body', async (c) =>
    c.json(
      await api.push(
        {
          ...(await parseBody(c)),
          device_key: parseParam(c.req.param('device_key')),
          title: parseParam(c.req.param('title')),
          body: parseParam(c.req.param('body')),
        },
        c,
      ),
    ),
  );

  app.get('/:device_key/:title/:subtitle/:body', async (c) =>
    c.json(
      await api.push(
        {
          ...parseQuery(c, ['device_key', 'title', 'subtitle', 'body']),
          device_key: parseParam(c.req.param('device_key')),
          title: parseParam(c.req.param('title')),
          subtitle: parseParam(c.req.param('subtitle')),
          body: parseParam(c.req.param('body')),
        },
        c,
      ),
    ),
  );
  app.post('/:device_key/:title/:subtitle/:body', async (c) =>
    c.json(
      await api.push(
        {
          ...(await parseBody(c)),
          device_key: parseParam(c.req.param('device_key')),
          title: parseParam(c.req.param('title')),
          subtitle: parseParam(c.req.param('subtitle')),
          body: parseParam(c.req.param('body')),
        },
        c,
      ),
    ),
  );
};

export const createHono = <T extends Env>(options: Options) => {
  const api = new API(options);

  const app = new Hono<T>();

  const router = app.basePath(options.urlPrefix || '/');

  router.get('/register', async (c) => {
    return c.json(
      await api.register(
        c.req.query('device_token') || c.req.query('devicetoken'),
        c.req.query('device_key') || c.req.query('key'),
      ),
    );
  });

  router.post('/register', async (c) => {
    const body = await parseBody(c);
    return c.json(
      await api.register(
        body.device_token || body.devicetoken,
        body.device_key || body.key,
      ),
    );
  });

  router.all('/ping', (c) => c.json(api.ping()));

  router.all('/healthz', (c) => c.text('ok'));

  router.all('/info', async (c) => {
    if (!validateBasicAuth(c.req.header('Authorization'), options.basicAuth)) {
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          'content-type': 'text/plain',
          'WWW-Authenticate': 'Basic',
        },
      });
    }
    return c.json(await api.info());
  });

  // base push
  router.post('/push', async (c) =>
    c.json(await api.push(await parseBody(c), c)),
  );

  // compat v1 API
  registerV1(router as unknown as Hono, api);

  router.all('/', (c) => c.text('ok'));

  app.onError((err, c) => {
    const errCode = err instanceof APIError ? err.code : 500;
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        code: errCode,
        message,
        timestamp: getTimestamp(),
      },
      errCode as ContentfulStatusCode,
    );
  });

  return app;
};
