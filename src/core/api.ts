import type { Context } from 'hono';
import { push } from './apns';
import type { DBAdapter, Options } from './type';
import { getTimestamp, newShortUUID } from './utils';

export class APIError extends Error {
  code: number;
  message: string;
  timestamp: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.message = message;
    this.timestamp = getTimestamp();
  }
}

const buildSuccess = (data?: any, message = 'success') => ({
  code: 200,
  message,
  timestamp: getTimestamp(),
  data,
});

export type PushParameters = Partial<{
  device_key: string;
  device_keys: string[];

  title: string;
  subtitle: string;
  body: string;
  sound: string;
  group: string;
  call: boolean;
  isArchive: boolean;
  icon: string;
  ciphertext: string;
  level: string;
  volume: number;
  url: string;
  image: string;
  copy: boolean;
  badge: number;
  autoCopy: boolean;
  action: string;
  iv: string;
  id: string;
  delete: boolean;
  markdown: string;
}>;

export class API {
  db: DBAdapter;
  options: Options;

  constructor(options: Options) {
    this.db = options.db;
    this.options = options;
  }

  async register(deviceToken?: string, key?: string) {
    if (!deviceToken) {
      throw new APIError(400, 'device token is empty');
    }

    if (deviceToken.length > 128) {
      throw new APIError(400, 'device token is invalid');
    }

    if (!(key && (await this.db.deviceTokenByKey(key)))) {
      if (this.options.allowNewDevice) {
        key = await newShortUUID();
      } else {
        throw new APIError(
          500,
          'device registration failed: register disabled',
        );
      }
    }

    if (deviceToken === 'deleted') {
      await this.db.deleteDeviceByKey(key);
      return buildSuccess({
        key: key,
        device_key: key,
        device_token: 'deleted',
      });
    }

    await this.db.saveDeviceTokenByKey(key, deviceToken);
    return buildSuccess({
      key: key,
      device_key: key,
      device_token: deviceToken,
    });
  }

  ping() {
    return buildSuccess(undefined, 'pong');
  }

  async info() {
    let devices: number | undefined;
    if (this.options.allowQueryNums) {
      devices = await this.db.countAll();
    }

    return {
      version: 'v2.2.6',
      build: '2025-12-03 10:51:22',
      arch: `js/${process.env.ENTRY}`,
      commit: '18d1037eab7a2310f595cfd31ea49b444f6133f2',
      time: Date.now(),
      devices: devices,
    };
  }

  async push(parameters: PushParameters, ctx?: Context) {
    // batch
    if (
      Array.isArray(parameters.device_keys) &&
      parameters.device_keys.length > 0
    ) {
      if (
        !Number.isNaN(this.options.maxBatchPushCount) &&
        this.options.maxBatchPushCount > 0
      ) {
        if (parameters.device_keys.length > this.options.maxBatchPushCount) {
          throw new APIError(
            400,
            `batch push count exceeds the maximum limit: ${this.options.maxBatchPushCount}`,
          );
        }
      }

      return buildSuccess({
        data: await Promise.all(
          parameters.device_keys.map(async (deviceKey) => {
            try {
              const res = await this.pushOne(deviceKey, parameters, ctx);
              return {
                code: res.code,
                device_key: deviceKey,
              };
            } catch (e) {
              if (e instanceof Error) {
                return {
                  code: e instanceof APIError ? e.code : 500,
                  device_key: deviceKey,
                  message: e.message,
                };
              }
            }
          }),
        ),
      });
    }

    const deviceKey = parameters.device_key;
    if (!deviceKey) {
      throw new APIError(400, 'device key is empty');
    }
    return this.pushOne(deviceKey, parameters, ctx);
  }

  private async pushOne(
    deviceKey: string,
    parameters: PushParameters,
    ctx?: Context,
  ) {
    const deviceToken = await this.db.deviceTokenByKey(deviceKey);
    if (deviceToken === undefined) {
      throw new APIError(
        400,
        `failed to get device token: failed to get [${deviceKey}] device token from database`,
      );
    }

    if (!deviceToken) {
      throw new APIError(400, 'device token invalid');
    }
    if (deviceToken.length > 128) {
      await this.db.deleteDeviceByKey(deviceKey);
      throw new APIError(400, 'invalid device token, has been removed');
    }

    const title = parameters.title || undefined;
    const subtitle = parameters.subtitle || undefined;
    const body = parameters.body || undefined;

    let sound = parameters.sound || undefined;
    if (sound) {
      if (!sound.endsWith('.caf')) {
        sound += '.caf';
      }
    } else {
      sound = '1107';
    }

    // https://developer.apple.com/documentation/usernotifications/generating-a-remote-notification
    const aps = {
      aps: parameters.delete
        ? {
            'content-available': 1,
            'mutable-content': 1,
          }
        : {
            alert: {
              title: title,
              subtitle: subtitle,
              body: !title && !subtitle && !body ? 'Empty Message' : body,
              'launch-image': undefined,
              'title-loc-key': undefined,
              'title-loc-args': undefined,
              'subtitle-loc-key': undefined,
              'subtitle-loc-args': undefined,
              'loc-key': undefined,
              'loc-args': undefined,
            },
            badge: undefined,
            sound: sound,
            'thread-id': parameters.group,
            category: 'myNotificationCategory',
            'content-available': undefined,
            'mutable-content': 1,
            'target-content-id': undefined,
            'interruption-level': undefined,
            'relevance-score': undefined,
            'filter-criteria': undefined,
            'stale-date': undefined,
            'content-state': undefined,
            timestamp: undefined,
            event: undefined,
            'dimissal-date': undefined,
            'attributes-type': undefined,
            attributes: undefined,
          },
      // ExtParams
      group: parameters.group,
      call: parameters.call,
      isarchive: parameters.isArchive,
      icon: parameters.icon,
      ciphertext: parameters.ciphertext,
      level: parameters.level,
      volume: parameters.volume,
      url: parameters.url,
      copy: parameters.copy,
      badge: parameters.badge,
      autocopy: parameters.autoCopy,
      action: parameters.action,
      iv: parameters.iv,
      image: parameters.image,
      id: parameters.id,
      delete: parameters.delete,
      markdown: parameters.markdown,
    };

    const headers: Record<string, string> = {
      'apns-push-type': parameters.delete ? 'background' : 'alert',
    };
    if (parameters.id) {
      headers['apns-collapse-id'] = parameters.id;
    }

    const response = await push(this.options, deviceToken, headers, aps, ctx);

    if (response.status === 200) {
      return buildSuccess(undefined);
    }

    if (
      response.status === 410 ||
      (response.status === 400 && response.message.includes('BadDeviceToken'))
    ) {
      await this.db.saveDeviceTokenByKey(deviceKey, '');
    }

    throw new APIError(response.status, `push failed: ${response.message}`);
  }
}
