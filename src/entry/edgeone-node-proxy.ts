import { APNS_HOST_NAME, requestAPNs } from '../core/apns';
import type { APNsProxyItem, BasicEnv } from '../core/type';

interface EOEventContext {
  params: any;
  request: Request;
  env: BasicEnv;
}

const jsonResponse = (data: any) =>
  new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const onRequest = async (ctx: EOEventContext) => {
  const token = ctx.env.PROXY_TOKEN;
  if (!token) {
    return jsonResponse({
      code: 400,
      message: 'PROXY_TOKEN is not set',
    });
  }

  if (ctx.request.headers.get('x-token') !== token) {
    return jsonResponse({
      code: 401,
      message: 'Unauthorized',
    });
  }

  const body = await ctx.request.json();

  const queue = await Promise.all(
    body.map(async (item: APNsProxyItem) => {
      const res = await requestAPNs(
        ctx.env.APNS_URL || APNS_HOST_NAME,
        item.deviceToken,
        item.headers,
        item.aps,
      );
      return {
        ...res,
        id: item.id,
      };
    }),
  );

  return jsonResponse({
    code: 200,
    data: queue,
  });
};
