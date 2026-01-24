import type { Context } from 'hono';

export type BasicEnv = Partial<{
  DB_NAME: string;
  ALLOW_NEW_DEVICE: string;
  ALLOW_QUERY_NUMS: string;
  MAX_BATCH_PUSH_COUNT: string;
  BASIC_AUTH: string;
  URL_PREFIX: string;
  APNS_URL: string;
  PROXY_TOKEN: string;
}>;

export type NullLike = null | undefined;

export interface DBAdapter {
  countAll(): Promise<number>;
  deviceTokenByKey(key: string): Promise<string | NullLike>;
  saveDeviceTokenByKey(key: string, token: string): Promise<void>;
  deleteDeviceByKey(key: string): Promise<void>;
  saveAuthorizationToken(token: string, ttl: number): Promise<void>;
  getAuthorizationToken(): Promise<string | NullLike>;
}

export interface APNsResponse {
  status: number;
  message: string;
}

export interface APNsProxyResponse extends APNsResponse {
  id: string;
}

export interface APNsProxyItem {
  id: string;
  deviceToken: string;
  headers: Record<string, string>;
  aps: any;
}

export interface Options {
  db: DBAdapter;
  allowNewDevice: boolean;
  allowQueryNums: boolean;
  maxBatchPushCount: number;
  basicAuth?: string;
  urlPrefix?: string;
  apnsUrl?: string;
  requestAPNs?: (
    deviceToken: string,
    headers: Record<string, string>,
    aps: any,
    ctx?: Context,
  ) => Promise<APNsResponse>;
}
