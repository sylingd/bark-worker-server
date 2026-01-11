import { type Context, type Env, Hono } from 'hono';
import { type API, APIError, type PushParameters } from './api';
import { getTimestamp, validateBasicAuth } from './utils';

const parseParam = (t: string) =>
  decodeURIComponent(t.replaceAll('\\+', '%20'));

const parseBody = async (c: Context): Promise<PushParameters> => {
  const isJSON = c.req.header('Content-Type')?.startsWith('application/json');
  return isJSON ? await c.req.json() : await c.req.parseBody();
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

const registerV1 = async (app: Hono, getAPI: () => API) => {
  app.get('/:device_key', async (c) =>
    c.json(
      await getAPI().push({
        ...parseQuery(c, ['device_key']),
        device_key: parseParam(c.req.param('device_key')),
      }),
    ),
  );
  app.post('/:device_key', async (c) =>
    c.json(
      await getAPI().push({
        ...(await parseBody(c)),
        device_key: parseParam(c.req.param('device_key')),
      }),
    ),
  );

  app.get('/:device_key/:body', async (c) =>
    c.json(
      await getAPI().push({
        ...parseQuery(c, ['device_key', 'body']),
        device_key: parseParam(c.req.param('device_key')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );
  app.post('/:device_key/:body', async (c) =>
    c.json(
      await getAPI().push({
        ...(await parseBody(c)),
        device_key: parseParam(c.req.param('device_key')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );

  app.get('/:device_key/:title/:body', async (c) =>
    c.json(
      await getAPI().push({
        ...parseQuery(c, ['device_key', 'title', 'body']),
        device_key: parseParam(c.req.param('device_key')),
        title: parseParam(c.req.param('title')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );
  app.post('/:device_key/:title/:body', async (c) =>
    c.json(
      await getAPI().push({
        ...(await parseBody(c)),
        device_key: parseParam(c.req.param('device_key')),
        title: parseParam(c.req.param('title')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );

  app.get('/:device_key/:title/:subtitle/:body', async (c) =>
    c.json(
      await getAPI().push({
        ...parseQuery(c, ['device_key', 'title', 'subtitle', 'body']),
        device_key: parseParam(c.req.param('device_key')),
        title: parseParam(c.req.param('title')),
        subtitle: parseParam(c.req.param('subtitle')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );
  app.post('/:device_key/:title/:subtitle/:body', async (c) =>
    c.json(
      await getAPI().push({
        ...(await parseBody(c)),
        device_key: parseParam(c.req.param('device_key')),
        title: parseParam(c.req.param('title')),
        subtitle: parseParam(c.req.param('subtitle')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );
};

export interface BaseAdapter<T extends Env> {
  basePath: string;
  createAPI: (c: Context<T>) => Promise<API>;
  getBasicAuth: (c: Context<T>) => string | undefined;
}

export const createHono = <T extends Env>(adapter: BaseAdapter<T>) => {
  let api: API;

  const getAPI = () => api;

  const app = new Hono<T>();

  const router = app.basePath(adapter.basePath);

  router.use(async (c, next) => {
    api = await adapter.createAPI(c);
    await next();
  });

  router.all('/register', async (c) => {
    return c.json(
      await api.register(c.req.query('devicetoken'), c.req.query('key')),
    );
  });

  router.all('/ping', async (c) => {
    return c.json(await api.ping());
  });

  router.all(
    '/healthz',
    () =>
      new Response('ok', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      }),
  );

  router.all('/info', async (c) => {
    if (
      !validateBasicAuth(c.req.header('Authorization'), adapter.getBasicAuth(c))
    ) {
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
  router.post('/push', async (c) => c.json(await api.push(await parseBody(c))));

  // compat v1 API
  registerV1(router as unknown as Hono, getAPI);

  router.all(
    '/',
    () =>
      new Response('ok', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      }),
  );

  app.onError((err) => {
    if (err instanceof APIError) {
      return new Response(
        JSON.stringify({
          code: err.code,
          message: err.message,
          timestamp: err.timestamp,
        }),
        {
          status: err.code,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }
    if (err instanceof Error) {
      return new Response(
        JSON.stringify({
          code: 500,
          message: err.message,
          timestamp: getTimestamp(),
        }),
        {
          status: 500,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }
    return new Response(
      JSON.stringify({
        code: 500,
        message: String(err),
        timestamp: getTimestamp(),
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  });

  return app;
};
