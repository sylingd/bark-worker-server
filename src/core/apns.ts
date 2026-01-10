import type { Database } from './db';
import { base64ToArrayBuffer, getTimestamp } from './utils';

const TOPIC = 'me.fin.bark';
const APNS_HOST_NAME = 'api.push.apple.com';
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

const getAuthToken = async (db: Database) => {
  let authToken = await db.getAuthorizationToken();

  if (authToken) {
    return await authToken;
  }

  authToken = await generateAuthToken();
  await db.saveAuthorizationToken(authToken);

  return authToken;
};

export const push = async (
  db: Database,
  deviceToken: string,
  headers: Record<string, string>,
  aps: any,
) => {
  const AUTHENTICATION_TOKEN = await getAuthToken(db);

  return await fetch(`https://${APNS_HOST_NAME}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: JSON.parse(
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
        authorization: `bearer ${AUTHENTICATION_TOKEN}`,
        'content-type': 'application/json',
      }),
    ),
    body: JSON.stringify(aps),
  });
};
