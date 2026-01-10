import { push } from './apns';
import type { Database } from './db';
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

const buildSuccess = (data: any, message = 'success') => ({
  code: 200,
  message,
  timestamp: getTimestamp(),
  data,
});

export interface Options {
  allowNewDevice: boolean;
  allowQueryNums: boolean;
}

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
  db: Database;
  options: Options;

  constructor(db: Database, options: Options) {
    this.db = db;
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

    await this.db.saveDeviceTokenByKey(key, deviceToken);

    return buildSuccess({
      key: key,
      device_key: key,
      device_token: deviceToken,
    });
  }

  async ping() {
    return buildSuccess({}, 'pong');
  }

  async info() {
    let devices: number | undefined;
    if (this.options.allowQueryNums) {
      devices = await this.db.countAll();
    }

    return {
      version: 'v2.2.6',
      build: '2025-12-03 10:51:22',
      arch: 'js',
      commit: '18d1037eab7a2310f595cfd31ea49b444f6133f2',
      devices: devices,
    };
  }

  async push(parameters: PushParameters) {
    // TODO: support device_keys
    const deviceKey = parameters.device_key;
    if (!deviceKey) {
      throw new APIError(400, 'device key is empty');
    }
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

    const group = parameters.group || undefined;
    const call = parameters.call || undefined;
    const isArchive = parameters.isArchive || undefined;
    const icon = parameters.icon || undefined;
    const ciphertext = parameters.ciphertext || undefined;
    const level = parameters.level || undefined;
    const volume = parameters.volume || undefined;
    const url = parameters.url || undefined;
    const image = parameters.image || undefined;
    const copy = parameters.copy || undefined;
    const badge = parameters.badge || undefined;
    const autoCopy = parameters.autoCopy || undefined;
    const action = parameters.action || undefined;
    const iv = parameters.iv || undefined;
    const id = parameters.id || undefined;
    const _delete = parameters.delete || undefined;
    const markdown = parameters.markdown || undefined;

    // https://developer.apple.com/documentation/usernotifications/generating-a-remote-notification
    const aps = {
      aps: _delete
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
            'thread-id': group,
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
      group: group,
      call: call,
      isarchive: isArchive,
      icon: icon,
      ciphertext: ciphertext,
      level: level,
      volume: volume,
      url: url,
      copy: copy,
      badge: badge,
      autocopy: autoCopy,
      action: action,
      iv: iv,
      image: image,
      id: id,
      delete: _delete,
      markdown: markdown,
    };

    const headers: Record<string, string> = {
      'apns-push-type': _delete ? 'background' : 'alert',
    };
    if (id) {
      headers['apns-collapse-id'] = id;
    }

    const response = await push(this.db, deviceToken, headers, aps);

    if (response.status === 200) {
      return buildSuccess({});
    }

    let message: string;
    const responseText = await response.text();

    try {
      message = JSON.parse(responseText).reason;
    } catch (_) {
      message = responseText;
    }

    if (
      response.status === 410 ||
      (response.status === 400 && message.includes('BadDeviceToken'))
    ) {
      await this.db.saveDeviceTokenByKey(deviceKey, '');
    }

    throw new APIError(response.status, `push failed: ${message}`);
  }
}
