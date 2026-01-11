export interface BasicKV {
  get(key: string, options?: { type: 'json' | 'text' }): Promise<any>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class Database {
  kv: BasicKV;
  constructor(kv: BasicKV) {
    this.kv = kv;
  }

  async countAll() {
    const c = Number(await this.kv.get('deviceCount'));
    return Number.isNaN(c) ? 0 : c;
  }
  async updateCount(diff: number) {
    const count = await this.countAll();
    await this.kv.put('deviceCount', String(count + diff));
  }

  async deviceTokenByKey(key: string) {
    const deviceKey =
      (key || '').replace(/[^a-zA-Z0-9]/g, '') || '_PLACE_HOLDER_';
    const devices = await this.kv.get(`device_${deviceKey}`, { type: 'text' });
    return devices;
  }

  async saveDeviceTokenByKey(key: string, token: string) {
    const deviceToken = (token || '').replace(/[^a-z0-9]/g, '') || '';
    const k = `device_${key}`;
    // updateCount
    this.kv.get(k).then((value) => {
      if (value) {
        this.updateCount(1);
      }
    });
    return this.kv.put(k, deviceToken);
  }

  async deleteDeviceByKey(key: string) {
    const deviceKey =
      (key || '').replace(/[^a-zA-Z0-9]/g, '') || '_PLACE_HOLDER_';
    this.updateCount(-1);
    return this.kv.delete(`device_${deviceKey}`);
  }

  async saveAuthorizationToken(token: string) {
    const expireAt = Date.now() + 3000000; // 有效期是一小时，向下取一点
    await this.kv.put('authToken', JSON.stringify({ token, expireAt }));
    return token;
  }

  async getAuthorizationToken() {
    const res = await this.kv.get('authToken');
    if (!res || res.expireAt > Date.now()) {
      return undefined;
    }
    return res.token;
  }
}
