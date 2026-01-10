import { type Context, type Env, Hono } from 'hono';
import { type API, APIError, type PushParameters } from './api';
import { getTimestamp, validateBasicAuth } from './utils';

const parseParam = (t: string) =>
  decodeURIComponent(t.replaceAll('\\+', '%20'));

const registerV1 = async (app: Hono, getAPI: () => API) => {
  app.get('/:device_key', async (c) =>
    c.json(
      await getAPI().push({
        device_key: parseParam(c.req.param('device_key')),
      }),
    ),
  );
  app.post('/:device_key', async (c) =>
    c.json(
      await getAPI().push({
        device_key: parseParam(c.req.param('device_key')),
      }),
    ),
  );

  app.get('/:device_key/:body', async (c) =>
    c.json(
      await getAPI().push({
        device_key: parseParam(c.req.param('device_key')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );
  app.post('/:device_key/:body', async (c) =>
    c.json(
      await getAPI().push({
        device_key: parseParam(c.req.param('device_key')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );

  app.get('/:device_key/:title/:body', async (c) =>
    c.json(
      await getAPI().push({
        device_key: parseParam(c.req.param('device_key')),
        title: parseParam(c.req.param('title')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );
  app.post('/:device_key/:title/:body', async (c) =>
    c.json(
      await getAPI().push({
        device_key: parseParam(c.req.param('device_key')),
        title: parseParam(c.req.param('title')),
        body: parseParam(c.req.param('body')),
      }),
    ),
  );

  app.get('/:device_key/:title/:subtitle/:body', async (c) =>
    c.json(
      await getAPI().push({
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

  app.basePath(adapter.basePath);

  app.use(async (c, next) => {
    api = await adapter.createAPI(c);
    await next();
  });

  app.all('/register', async (c) => {
    return c.json(
      await api.register(c.req.query('devicetoken'), c.req.query('key')),
    );
  });

  app.all('/ping', async (c) => {
    return c.json(await api.ping());
  });

  app.all(
    '/healthz',
    () =>
      new Response('ok', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      }),
  );

  app.all('/info', async (c) => {
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

  // batch push
  app.post('/push', async (c) => {
    // is API v2?
    const isAPIv2 = c.req
      .header('Content-Type')
      ?.startsWith('application/json');
    const body: PushParameters = isAPIv2
      ? await c.req.json()
      : await c.req.parseBody();

    return c.json(await api.push(body));
  });

  // compat old API
  registerV1(app as unknown as Hono, getAPI);

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
