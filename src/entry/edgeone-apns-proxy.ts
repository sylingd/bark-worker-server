import got from 'got';
import { APNS_HOST_NAME } from '../core/apns';
import type { APNsProxyItem, APNsResponse, BasicEnv } from '../core/type';

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

const requestAPNs = async (
  domain: string,
  deviceToken: string,
  headers: Record<string, string>,
  aps: any,
): Promise<APNsResponse> => {
  const res = await got.post(`https://${domain}/3/device/${deviceToken}`, {
    headers,
    json: aps,
    http2: true,
  });

  let message: string;
  const responseText = res.body;

  try {
    message = JSON.parse(responseText).reason;
  } catch (_) {
    message = responseText;
  }

  return {
    status: res.statusCode,
    message,
  };
};

export const handleRequest = async (ctx: EOEventContext) => {
  const token = process.env.PROXY_TOKEN;
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

  console.log('payload', JSON.stringify(body));

  const queue = await Promise.all(
    body.map(async (item: APNsProxyItem) => {
      try {
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
      } catch (e) {
        return {
          status: 500,
          message: (e as Error).message,
          id: item.id,
        };
      }
    }),
  );

  console.log('result', queue);

  return jsonResponse({
    code: 200,
    data: queue,
  });
};
