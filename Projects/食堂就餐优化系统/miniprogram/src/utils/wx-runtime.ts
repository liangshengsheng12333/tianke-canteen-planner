/**
 * wx-runtime.ts — 小程序宿主 API 的最小访问层。
 *
 * 领域层不直接触碰全局 wx：测试可在 Node 中替换 globalThis.wx 上的存储实现，
 * 页面沿用真实微信宿主。这里只包装存储、环境、文件与剪贴板，不补业务语义。
 */

export interface StorageLike {
  getStorageSync(key: string): any;
  setStorageSync(key: string, value: any): void;
  removeStorageSync?(key: string): void;
}

export interface WxLike extends StorageLike {
  getAppBaseInfo?: () => any;
  getDeviceInfo?: () => any;
  getSystemInfoSync?: () => any;
  getPerformance?: () => any;
  env?: { USER_DATA_PATH?: string };
  getFileSystemManager?: () => any;
  chooseMessageFile?: (options: any) => void;
  setClipboardData?: (options: any) => void;
  getClipboardData?: (options: any) => void;
  showToast?: (options: any) => void;
  showModal?: (options: any) => void;
  navigateTo?: (options: any) => void;
}

/** 当前宿主对象；微信运行时为全局 wx，Node 测试注入 mock。 */
export function getWx(): WxLike {
  const candidate = (globalThis as any).wx;
  if (!candidate || typeof candidate.getStorageSync !== 'function') {
    throw new Error('wx 宿主不可用：缺少 getStorageSync（Node 测试请注入 globalThis.wx）');
  }
  return candidate as WxLike;
}

export function hasWx(): boolean {
  const candidate = (globalThis as any).wx;
  return !!candidate && typeof candidate.getStorageSync === 'function';
}

/** 读取一个字符串键；微信对不存在的键返回空字符串，这里统一成 null。 */
export function readStorage(key: string): string | null {
  const raw = getWx().getStorageSync(key);
  if (raw === '' || raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== 'string') {
    throw new Error(`存储键 ${key} 不是字符串，实际为 ${typeof raw}`);
  }
  return raw;
}

export function writeStorage(key: string, value: string): void {
  getWx().setStorageSync(key, value);
}

export function removeStorage(key: string): void {
  const wx = getWx();
  if (typeof wx.removeStorageSync === 'function') {
    wx.removeStorageSync(key);
  } else {
    // 少数测试替身没有 remove；写入空串即可让读取侧视为不存在。
    wx.setStorageSync(key, '');
  }
}

export function readEnvironmentRows(): { label: string; value: string }[] {
  try {
    const wx = getWx();
    const app = typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo() : {};
    const device = typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo() : {};
    return [
      { label: '基础库 SDKVersion', value: app.SDKVersion || '未知' },
      { label: '微信版本', value: app.version || '未知' },
      { label: '平台', value: device.platform || 'devtools/unknown' },
      { label: '设备型号', value: device.model || '未知' },
      { label: '系统', value: device.system || '未知' },
    ];
  } catch (_e) {
    return [{ label: '环境获取', value: '在模拟测试环境运行' }];
  }
}

/** 本地业务日期（设备本地时区），格式 YYYY-MM-DD。 */
export function localBusinessDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 设备本地时区偏移；东八区为 +480，与 contract 的 tzOffsetMinutes 语义一致。 */
export function localTzOffsetMinutes(now: Date): number {
  return -now.getTimezoneOffset();
}

export function describeError(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && error.errMsg) {
    return String(error.errMsg);
  }
  try {
    return JSON.stringify(error);
  } catch (_e) {
    return String(error);
  }
}

/**
 * 高分辨率时钟（毫秒）：优先 performance.now（开发者工具/真机 JS 引擎通常可用），
 * 其次 wx.getPerformance().now()，最后退回 Date.now（毫秒整数，精度不足时只作参考）。
 */
export function nowMs(): number {
  try {
    const perf = (globalThis as any).performance;
    if (perf && typeof perf.now === 'function') {
      return perf.now();
    }
  } catch (_e) {
    // 继续尝试 wx.getPerformance
  }
  try {
    const wx = getWx();
    if (typeof wx.getPerformance === 'function') {
      const perf = wx.getPerformance();
      if (perf && typeof perf.now === 'function') {
        return perf.now();
      }
    }
  } catch (_e) {
    // 退回到 Date.now
  }
  return Date.now();
}
