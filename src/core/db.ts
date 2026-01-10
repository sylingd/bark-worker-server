export interface BasicKV {
  get: <T = any>(key: string) => Promise<T | null>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export class Database {
  base: BasicKV;
  devices?: Record<string, string>;
  constructor(base: BasicKV) {
    this.base = base;
  }

  async getDevices() {
    if (!this.devices) {
      this.devices = (await this.base.get('devices')) || {};
    }
    return this.devices;
  }

  async saveDevices(devices: Record<string, string>) {
    this.devices = devices;
    return await this.base.set('devices', this.devices);
  }

  async countAll() {
    const list = await this.getDevices();
    return Object.keys(list).length;
  }

  async deviceTokenByKey(key: string) {
    const deviceKey =
      (key || '').replace(/[^a-zA-Z0-9]/g, '') || '_PLACE_HOLDER_';
    const devices = await this.getDevices();
    return devices[deviceKey];
  }

  async saveDeviceTokenByKey(key: string, token: string) {
    const deviceToken = (token || '').replace(/[^a-z0-9]/g, '') || '';
    const devices = await this.getDevices();
    devices[key] = deviceToken;
    return this.saveDevices(devices);
  }

  async deleteDeviceByKey(key: string) {
    const deviceKey =
      (key || '').replace(/[^a-zA-Z0-9]/g, '') || '_PLACE_HOLDER_';
    const devices = await this.getDevices();
    delete devices[deviceKey];
    return this.saveDevices(devices);
  }

  async saveAuthorizationToken(token: string) {
    const expireAt = Date.now() + 3000000; // 有效期是一小时，向下取一点
    await this.base.set('authToken', { token, expireAt });
    return token;
  }

  async getAuthorizationToken() {
    const res = await this.base.get('authToken');
    if (!res || res.expireAt > Date.now()) {
      this.base.delete('authToken');
      return undefined;
    }
    return res.token;
  }
}
