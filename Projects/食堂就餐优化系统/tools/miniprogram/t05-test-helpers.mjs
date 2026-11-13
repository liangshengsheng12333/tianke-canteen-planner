// t05-test-helpers.mjs — T05 Node 侧测试/测量的公共帮助函数。
//
// 只被 tools/miniprogram 下的 test-t05-*.mjs、verify-t05-integration.mjs、measure-t05.mjs 引用，
// 不进入小程序运行时代码。提供：
//   * 项目路径、包内 WASM 身份常量与身份校验（A18 真实时限核心包内 111,554 字节 / SHA256 B0098453…）；
//   * 真实 WASM 的 Node 实例化器（new WebAssembly.Module/Instance，可按序注入延迟）；
//   * 模拟 wx 宿主（Map + 字符串持久化，可注入写入失败、可跨 AppStore 实例复用模拟杀进程重开）；
//   * 证据 JSON 写入（固定写 D:\项目\cpp\.toolchain\tmp\t05\，不写项目目录）；
//   * 计时统计（原始数组 + median/min/max/mean）与环境信息。
//
// 重要：mock wx / 延迟实例化只用于自动测试，不能替代微信开发者工具或真机证据。
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const toolsDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(toolsDir, '..', '..');
export const workspaceRoot = path.resolve(projectRoot, '..', '..');
export const srcDir = path.join(projectRoot, 'miniprogram', 'src');
export const wasmPath = path.join(srcDir, 'assets', 'wasm', 'mp_core.wasm');
export const TMP_DIR = path.join(workspaceRoot, '.toolchain', 'tmp', 't05');

/**
 * 包内唯一正式核心身份：A18 真实求解时限核心（T06e 汇合冻结值，不得重建/复制/覆盖）。
 * 111,554 字节 / SHA256 B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD。
 * 新增必需 import env.mp_monotonic_ms，旧空 imports 加载器不能实例化（见 core/wasm/A18-ABI.md）。
 */
export const WASM_EXPECTED_BYTES = 111554;
export const WASM_EXPECTED_SHA256 = 'B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD';

/** 以显式 .ts 路径导入小程序源码；源码内部的“无扩展名相对导入”由 register-ts.mjs 负责。 */
export function importTs(...segments) {
  return import(pathToFileURL(path.join(srcDir, ...segments)).href);
}

export function sha256Upper(bytes) {
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex').toUpperCase();
}

export function sha256Lower(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

/** 读取包内 WASM 并核对冻结身份；不一致抛错（不自动修复、不重建）。 */
export function readWasmChecked() {
  const bytes = fs.readFileSync(wasmPath);
  const actualBytes = bytes.length;
  const actualSha = sha256Upper(bytes);
  if (actualBytes !== WASM_EXPECTED_BYTES || actualSha !== WASM_EXPECTED_SHA256) {
    throw new Error(
      `包内 WASM 身份不符：预期 ${WASM_EXPECTED_BYTES} 字节 / ${WASM_EXPECTED_SHA256}，实际 ${actualBytes} 字节 / ${actualSha}`,
    );
  }
  return { bytes, sha256: actualSha, bytesLength: actualBytes };
}

/**
 * 真实 WASM 实例化器（与 WXWebAssembly.instantiate 同形）。
 * delays 给定时按调用次序消耗延迟毫秒数（用于“旧响应不覆盖新输入”的乱序注入）；
 * 缺省 0 表示立即实例化。每次调用都重新读字节并编译，不复用实例。
 */
export function createRealInstantiate(delays = []) {
  let call = 0;
  return async (p, imports) => {
    const delay = delays.length > 0 ? delays[Math.min(call, delays.length - 1)] : 0;
    call += 1;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const bytes = fs.readFileSync(p);
    const module = new WebAssembly.Module(bytes);
    const instance = new WebAssembly.Instance(module, imports);
    return { instance };
  };
}

// ---------------------------------------------------------------------------
// 模拟 wx 宿主
// ---------------------------------------------------------------------------

/**
 * 模拟微信小程序存储：微信 getStorageSync 对不存在的键返回 ''，setStorageSync 原样保存
 * 调用方传入的字符串。内部 Map 保存字符串，从而真实模拟“杀进程后只剩持久化文本”的语义。
 *
 * options.seed: { [key]: value } 预置数据（非字符串会 JSON.stringify）
 * options.autoPersistJson: true 时 getStorageSync 返回解析后的对象（兼容旧测试口径），
 *   默认 false（与真实微信一致返回字符串）。
 */
export function createMockWx(options = {}) {
  const storage = new Map();
  const calls = { getStorageSync: [], setStorageSync: [], removeStorageSync: [], clipboard: [], files: [] };
  const control = {
    /** 前 failuresAfter 次写入成功，之后全部失败；Infinity 表示不失败。 */
    failuresAfter: Infinity,
    writeCount: 0,
    /** 自定义抛出对象；返回 null 表示本次不失败。 */
    failWrite: null,
  };
  const files = new Map();

  for (const [key, value] of Object.entries(options.seed || {})) {
    storage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  const failIfRequested = () => {
    control.writeCount += 1;
    let shouldFail = control.writeCount > control.failuresAfter;
    if (typeof control.failWrite === 'function') {
      const decision = control.failWrite(control.writeCount);
      if (decision !== null && decision !== undefined) {
        shouldFail = true;
        throw decision;
      }
    }
    if (shouldFail) {
      const error = new Error('mock setStorageSync 写入失败（注入）');
      error.errMsg = 'setStorageSync:fail mock injected';
      throw error;
    }
  };

  const wx = {
    getStorageSync(key) {
      calls.getStorageSync.push(key);
      const raw = storage.has(key) ? storage.get(key) : '';
      if (options.autoPersistJson && raw !== '') {
        return JSON.parse(raw);
      }
      return raw;
    },
    setStorageSync(key, value) {
      calls.setStorageSync.push({ key, value });
      failIfRequested();
      storage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    removeStorageSync(key) {
      calls.removeStorageSync.push(key);
      storage.delete(key);
    },
    getStorageInfoSync() {
      return { keys: [...storage.keys()], currentSize: 0, limitSize: 10240 };
    },
    clearStorageSync() {
      storage.clear();
    },
    getAppBaseInfo() {
      return { SDKVersion: '3.0.0-node-mock', version: '8.0.0-node-mock', language: 'zh_CN' };
    },
    getDeviceInfo() {
      return { platform: 'node-mock', model: 'node-mock-model', system: 'node-mock 1.0' };
    },
    getSystemInfoSync() {
      return { platform: 'node-mock', model: 'node-mock-model', system: 'node-mock 1.0', SDKVersion: '3.0.0-node-mock' };
    },
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager() {
      return {
        readFileSync(p) {
          if (!files.has(p)) {
            const error = new Error(`mock 文件不存在：${p}`);
            error.errMsg = 'readFile:fail mock no such file';
            throw error;
          }
          const content = files.get(p);
          return options.autoPersistJson ? content : Buffer.from(content, 'utf8');
        },
        writeFileSync(p, data) {
          calls.files.push({ op: 'write', path: p });
          files.set(p, typeof data === 'string' ? data : String(data));
        },
        accessSync(p) {
          if (!files.has(p)) {
            const error = new Error(`mock 文件不存在：${p}`);
            error.errMsg = 'access:fail mock no such file';
            throw error;
          }
        },
        unlinkSync(p) {
          files.delete(p);
        },
      };
    },
    setClipboardData({ data, success } = {}) {
      calls.clipboard.push(data);
      if (typeof success === 'function') {
        success();
      }
    },
    getClipboardData({ success } = {}) {
      const data = calls.clipboard[calls.clipboard.length - 1] || '';
      if (typeof success === 'function') {
        success({ data });
      }
    },
    shareFileMessage({ success } = {}) {
      if (typeof success === 'function') {
        success();
      }
    },
    chooseMessageFile({ success } = {}) {
      if (typeof success === 'function') {
        success({ tempFiles: [] });
      }
    },
    showToast() {},
    showModal() {},
    showActionSheet({ success } = {}) {
      if (typeof success === 'function') {
        success({ tapIndex: 0 });
      }
    },
  };

  return {
    wx,
    storage,
    calls,
    control,
    files,
    /** 读取原始持久化文本（模拟杀进程后重新打开）。 */
    raw(key) {
      return storage.has(key) ? storage.get(key) : '';
    },
    /** 解析持久化的 JSON（不存在或非法时返回 null）。 */
    state(key) {
      const raw = this.raw(key);
      if (raw === '') {
        return null;
      }
      try {
        return JSON.parse(raw);
      } catch (_error) {
        return null;
      }
    },
    /** 模拟进程被杀：只保留持久化文本，返回给下一个 AppStore 使用。 */
    reboot() {
      return this;
    },
    /** 安装为全局 wx；返回卸载函数（测试结束调用，避免跨文件污染）。 */
    install() {
      globalThis.wx = wx;
      return () => {
        if (globalThis.wx === wx) {
          delete globalThis.wx;
        }
      };
    },
  };
}

/** 确保证据目录存在并写入 JSON，返回绝对路径；只写工作区 .toolchain/tmp/t05。 */
export function writeEvidenceJson(fileName, payload) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const target = path.join(TMP_DIR, fileName);
  fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
  return target;
}

/** 计时统计：median 对偶数个样本取中间两值平均；所有值保留 3 位小数。 */
export function summarize(samples) {
  const round = (value) => Number(value.toFixed(3));
  const raw = samples.map(round);
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return { count: samples.length, raw, min: round(sorted[0]), max: round(sorted[sorted.length - 1]), median: round(median), mean: round(mean) };
}

/** 运行环境与 WASM 身份（计时与集成证据必须绑定这些字段）。 */
export function environmentInfo() {
  const cpu = os.cpus()[0];
  const wasm = readWasmChecked();
  return {
    host: 'Node.js 宿主（非微信运行时、非红米真机）',
    nodeVersion: process.version,
    v8Version: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpuModel: cpu ? cpu.model.trim() : '未知',
    cpuCount: os.cpus().length,
    wasmPath,
    wasmBytes: wasm.bytesLength,
    wasmSha256: wasm.sha256,
    timestamp: new Date().toISOString(),
    timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
  };
}

/** 载入四类 T02 v2 夹具请求。 */
export async function loadFixtures() {
  const { FIXTURE_CASES } = await importTs('mock', 'simulated-inputs.ts');
  return FIXTURE_CASES;
}
