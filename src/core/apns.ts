import type { Context } from 'hono';
import type { APNsResponse, DBAdapter, NullLike, Options } from './type';
import { base64ToArrayBuffer, getTimestamp } from './utils';

const TOPIC = 'me.fin.bark';
export const APNS_HOST_NAME = 'api.push.apple.com';
const generateAuthToken = async () => {
  const TOKEN_KEY = `-----BEGIN PRIVATE KEY-----
  MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg4vtC3g5L5HgKGJ2+
  T1eA0tOivREvEAY2g+juRXJkYL2gCgYIKoZIzj0DAQehRANCAASmOs3JkSyoGEWZ
  sUGxFs/4pw1rIlSV2IC19M8u3G5kq36upOwyFWj9Gi3Ejc9d3sC7+SHRqXrEAJow
  8/7tRpV+
  -----END PRIVATE KEY-----`;

  // Parse private key
  const privateKeyPEM = TOKEN_KEY.replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  // Decode private key
  const privateKeyArrayBuffer = base64ToArrayBuffer(privateKeyPEM);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const TEAM_ID = '5U8LBRXG3A';
  const AUTH_KEY_ID = 'LH4T9V5U4R';
  // Generate the JWT token
  const JWT_ISSUE_TIME = getTimestamp();
  const JWT_HEADER = btoa(JSON.stringify({ alg: 'ES256', kid: AUTH_KEY_ID }))
    .replace('+', '-')
    .replace('/', '_')
    .replace(/=+$/, '');
  const JWT_CLAIMS = btoa(JSON.stringify({ iss: TEAM_ID, iat: JWT_ISSUE_TIME }))
    .replace('+', '-')
    .replace('/', '_')
    .replace(/=+$/, '');
  const JWT_HEADER_CLAIMS = `${JWT_HEADER}.${JWT_CLAIMS}`;
  // Sign
  const jwtArray = new TextEncoder().encode(JWT_HEADER_CLAIMS);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    jwtArray,
  );
  const signatureArray = new Uint8Array(signature);
  const JWT_SIGNED_HEADER_CLAIMS = btoa(String.fromCharCode(...signatureArray))
    .replace('+', '-')
    .replace('/', '_')
    .replace(/=+$/, '');
  const AUTHENTICATION_TOKEN = `${JWT_HEADER_CLAIMS}.${JWT_SIGNED_HEADER_CLAIMS}`;

  return AUTHENTICATION_TOKEN;
};

let authToken: string | NullLike = null;
const getAuthToken = async (db: DBAdapter) => {
  if (authToken) {
    return authToken;
  }
  authToken = await db.getAuthorizationToken();
  if (authToken) {
    return authToken;
  }

  authToken = await generateAuthToken();
  await db.saveAuthorizationToken(authToken, 3000000); // 有效期是一小时，向下取一点
  return authToken;
};

export const requestAPNs = async (
  domain: string,
  deviceToken: string,
  headers: Record<string, string>,
  aps: any,
): Promise<APNsResponse> => {
  const res = await fetch(`https://${domain}/3/device/${deviceToken}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(aps),
  });

  let message: string;
  const responseText = await res.text();

  try {
    message = JSON.parse(responseText).reason;
  } catch (_) {
    message = responseText;
  }

  return {
    status: res.status,
    message,
  };
};

export const push = async (
  options: Options,
  deviceToken: string,
  headers: Record<string, string>,
  aps: any,
  ctx?: Context,
): Promise<APNsResponse> => {
  const token = await getAuthToken(options.db);

  const finalHeaders = JSON.parse(
    JSON.stringify({
      'apns-topic': headers['apns-topic'] || TOPIC,
      'apns-id': headers['apns-id'] || undefined,
      'apns-collapse-id': headers['apns-collapse-id'] || undefined,
      'apns-priority':
        Number(headers['apns-priority']) > 0
          ? headers['apns-priority']
          : undefined,
      'apns-expiration': headers['apns-expiration'] || getTimestamp() + 86400,
      'apns-push-type': headers['apns-push-type'] || 'alert',
      authorization: `bearer ${token}`,
      'content-type': 'application/json',
    }),
  );

  if (options.requestAPNs) {
    try {
      return await options.requestAPNs(deviceToken, finalHeaders, aps, ctx);
    } catch (e) {
      return {
        status: 500,
        message: (e as Error).message,
      };
    }
  }

  try {
    return await requestAPNs(
      options.apnsUrl || APNS_HOST_NAME,
      deviceToken,
      finalHeaders,
      aps,
    );
  } catch (e) {
    return {
      status: 500,
      message: (e as Error).message,
    };
  }
};
