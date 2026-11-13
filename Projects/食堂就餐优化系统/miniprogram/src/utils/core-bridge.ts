/**
 * core-bridge.ts — 小程序侧调用 mp_core.wasm 的最小包装（T02 阶段 A）。
 *
 * 只做三件事：加载并核对导出、按 ABI 调用一次、按 ABI 释放内存。
 * 不做任何营养/规划计算，也不补任何缺失字段；业务结果一律来自 WASM。
 *
 * 本文件刻意不 import 任何相对路径模块，这样 Node 测试（tools/miniprogram）和
 * 微信开发者工具的 TypeScript 编译都能直接处理同一份源码。
 *
 * ABI 依据：core/wasm/README.md 与 tools/core/host_wasm.mjs
 *   输入  ：mp_alloc(len) → 写入 → 调用 mp_* → mp_free(ptr) 恰好一次
 *   输出  ：结果块 [u32 载荷长度][u32 保留=0][UTF-8 JSON][NUL]，
 *           先复制出载荷再 mp_free(block) 恰好一次
 *   版本串：mp_contract_version() 返回静态只读指针，不得释放
 *   零指针：mp_alloc / mp_* 返回 0 只表示真实分配失败
 */

export const REQUIRED_EXPORTS = [
  'mp_api_version',
  'mp_contract_version',
  'mp_alloc',
  'mp_free',
  'mp_plan',
  'mp_nutrition_target',
  'mp_validate_menu',
  // T05N01：Offer 级单份营养只读出口（A04 契约扩展 v1）。
  // 合并到生产前，生产 WASM 必须是已包含该导出的统一候选。
  'mp_offer_nutrition',
] as const;

export type Command = 'plan' | 'nutrition-target' | 'validate-menu' | 'offer-nutrition';

export interface CoreExports {
  memory: { buffer: ArrayBuffer };
  mp_api_version: () => number;
  mp_contract_version: () => number;
  mp_alloc: (len: number) => number;
  mp_free: (ptr: number) => void;
  mp_plan: (ptr: number, len: number) => number;
  mp_nutrition_target: (ptr: number, len: number) => number;
  mp_validate_menu: (ptr: number, len: number) => number;
  mp_offer_nutrition: (ptr: number, len: number) => number;
}

export interface Core {
  exports: CoreExports;
}

/** 与 WXWebAssembly.instantiate(path, imports) 同形；测试里可换成 Node 的实现。 */
export type Instantiate = (
  path: string,
  imports: object,
) => Promise<{ instance: { exports: any } }>;

const ENTRY_BY_COMMAND: Record<
  Command,
  'mp_plan' | 'mp_nutrition_target' | 'mp_validate_menu' | 'mp_offer_nutrition'
> = {
  plan: 'mp_plan',
  'nutrition-target': 'mp_nutrition_target',
  'validate-menu': 'mp_validate_menu',
  'offer-nutrition': 'mp_offer_nutrition',
};

const RESULT_HEADER_BYTES = 8;
const MAX_STATIC_STRING_BYTES = 64;

// ---------------------------------------------------------------------------
// UTF-8 编解码
// 微信官方 JS 支持情况文档（2026-10-20 查阅）未列出 TextEncoder/TextDecoder，
// 因此自带一份；解码遇到非法字节直接抛错，不用替换字符掩盖 ABI 问题。
// ---------------------------------------------------------------------------

export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    let cp = ch.codePointAt(0) as number;
    if (cp >= 0xd800 && cp <= 0xdfff) {
      cp = 0xfffd; // 孤立代理项，与标准 TextEncoder 一致
    }
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes: Uint8Array): string {
  const parts: string[] = [];
  let codePoints: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const lead = bytes[i];
    let cp: number;
    let continuation: number;
    let minimum: number; // 该长度编码允许的最小码点，用于拒绝过长编码
    if (lead < 0x80) {
      cp = lead;
      continuation = 0;
      minimum = 0;
    } else if ((lead & 0xe0) === 0xc0) {
      cp = lead & 0x1f;
      continuation = 1;
      minimum = 0x80;
    } else if ((lead & 0xf0) === 0xe0) {
      cp = lead & 0x0f;
      continuation = 2;
      minimum = 0x800;
    } else if ((lead & 0xf8) === 0xf0) {
      cp = lead & 0x07;
      continuation = 3;
      minimum = 0x10000;
    } else {
      throw new Error(`非法 UTF-8：偏移 ${i} 处首字节 0x${lead.toString(16)}`);
    }
    if (i + continuation >= bytes.length) {
      throw new Error(`非法 UTF-8：偏移 ${i} 处序列被截断`);
    }
    for (let k = 1; k <= continuation; k += 1) {
      const next = bytes[i + k];
      if ((next & 0xc0) !== 0x80) {
        throw new Error(`非法 UTF-8：偏移 ${i + k} 处不是后续字节`);
      }
      cp = (cp << 6) | (next & 0x3f);
    }
    if (cp < minimum || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
      throw new Error(`非法 UTF-8：偏移 ${i} 处码点 U+${cp.toString(16)} 不合法`);
    }
    codePoints.push(cp);
    if (codePoints.length >= 4096) {
      parts.push(String.fromCodePoint(...codePoints));
      codePoints = [];
    }
    i += continuation + 1;
  }
  parts.push(String.fromCodePoint(...codePoints));
  return parts.join('');
}

// ---------------------------------------------------------------------------
// 加载与调用
// ---------------------------------------------------------------------------

export async function loadCore(
  instantiate: Instantiate,
  wasmPath: string,
  monotonicClockMs: () => number = () => -1,
): Promise<Core> {
  const { instance } = await instantiate(wasmPath, {
    env: {
      mp_monotonic_ms: () => {
        // Host failure becomes the core's visible clock error, never a fabricated time.
        try {
          const value = monotonicClockMs();
          return typeof value === 'number' && Number.isFinite(value) ? value : -1;
        } catch (_) {
          return -1;
        }
      },
    },
  });
  const exports = instance.exports;
  const missing: string[] = REQUIRED_EXPORTS.filter((name) => typeof exports[name] !== 'function');
  if (!exports.memory || !exports.memory.buffer) {
    missing.push('memory');
  }
  if (missing.length > 0) {
    throw new Error(`WASM 缺少必需导出：${missing.join(', ')}`);
  }
  return { exports };
}

/**
 * 解析结果块并复制出 JSON 文本。返回的是 JS 字符串，与线性内存无关，
 * 因此调用方可以在此之后安全释放结果块。
 */
function decodeResultBlock(buffer: ArrayBuffer, block: number): string {
  if (block + RESULT_HEADER_BYTES > buffer.byteLength) {
    throw new Error(`结果块指针 ${block} 越过线性内存（${buffer.byteLength} 字节）`);
  }
  const view = new DataView(buffer);
  const payloadLength = view.getUint32(block, true);
  const reserved = view.getUint32(block + 4, true);
  if (reserved !== 0) {
    throw new Error(`结果块保留字段应为 0，实际为 ${reserved}`);
  }
  const payloadStart = block + RESULT_HEADER_BYTES;
  if (payloadStart + payloadLength + 1 > buffer.byteLength) {
    throw new Error(`结果块载荷长度 ${payloadLength} 越过线性内存（${buffer.byteLength} 字节）`);
  }
  if (view.getUint8(payloadStart + payloadLength) !== 0) {
    throw new Error('结果块载荷之后缺少 NUL 结尾');
  }
  return utf8Decode(new Uint8Array(buffer, payloadStart, payloadLength));
}

export interface TimedCall {
  text: string;
  /** 仅入口函数（mp_plan 等）自身的耗时，不含分配/复制/释放。 */
  coreMs: number;
  /** 整个 callApi 流程：编码、分配、写入、入口、结果块复制、两次释放。 */
  totalMs: number;
}

/**
 * 内部统一实现：ABI 生命周期只有这一份。clock 为空时不做计时（正常调用路径）。
 * 输入分配与结果块各在 finally 中释放一次；每次读写线性内存前都重新取
 * exports.memory.buffer，因为 mp_alloc 或任何入口都可能让内存增长。
 */
function invokeApi(
  core: Core,
  command: Command,
  requestText: string,
  clock: (() => number) | null,
): TimedCall {
  const entryName = ENTRY_BY_COMMAND[command];
  if (!entryName) {
    throw new Error(`未知命令：${command}`);
  }
  const { exports } = core;
  const totalStart = clock ? clock() : 0;
  let coreMs = 0;
  const input = utf8Encode(requestText);
  const inputPtr = exports.mp_alloc(input.length);
  if (inputPtr === 0) {
    throw new Error('mp_alloc 返回 0：输入缓冲区真实分配失败');
  }
  try {
    new Uint8Array(exports.memory.buffer, inputPtr, input.length).set(input);
    const entryStart = clock ? clock() : 0;
    const block = exports[entryName](inputPtr, input.length);
    const entryEnd = clock ? clock() : 0;
    if (clock) {
      coreMs = entryEnd - entryStart;
    }
    if (block === 0) {
      throw new Error(`${entryName} 返回 0：结果块真实分配失败`);
    }
    try {
      const text = decodeResultBlock(exports.memory.buffer, block);
      const totalMs = clock ? clock() - totalStart : 0;
      return { text, coreMs, totalMs };
    } finally {
      exports.mp_free(block);
    }
  } finally {
    exports.mp_free(inputPtr);
  }
}

/** 用一份 UTF-8 JSON 请求调用一个入口，返回 WASM 给出的原始 JSON 文本。 */
export function callApi(core: Core, command: Command, requestText: string): string {
  return invokeApi(core, command, requestText, null).text;
}

/**
 * 与 callApi 相同的 ABI 路径，额外返回分项耗时（开发页/计时实验用，不进入业务路径）。
 * clock 必须传高分辨率时钟（如 performance.now 包装），否则毫秒级精度不足以区分分项。
 */
export function callApiTimed(core: Core, command: Command, requestText: string, clock: () => number): TimedCall {
  return invokeApi(core, command, requestText, clock);
}

// ---------------------------------------------------------------------------
// ABI 探针（阶段 A）：只验证加载、导出与分配/释放生命周期，不产生业务结果
// ---------------------------------------------------------------------------

export interface AbiProbe {
  apiVersion: number;
  contractVersion: string;
  memoryBytesBefore: number;
  memoryBytesAfter: number;
  allocPtr: number;
  allocWriteReadOk: boolean;
  /** 故意传入空对象调用 mp_validate_menu 得到的原始返回文本，仅用于验证结果块布局 */
  resultBlockProbeText: string;
}

function readStaticCString(buffer: ArrayBuffer, ptr: number): string {
  const limit = Math.min(buffer.byteLength, ptr + MAX_STATIC_STRING_BYTES);
  const bytes = new Uint8Array(buffer, 0, limit);
  let end = ptr;
  while (end < limit && bytes[end] !== 0) {
    end += 1;
  }
  if (end >= limit) {
    throw new Error(`mp_contract_version 指向的字符串在 ${MAX_STATIC_STRING_BYTES} 字节内没有 NUL 结尾`);
  }
  return utf8Decode(bytes.subarray(ptr, end));
}

export function probeAbi(core: Core): AbiProbe {
  const { exports } = core;
  const apiVersion = exports.mp_api_version();
  const contractVersion = readStaticCString(exports.memory.buffer, exports.mp_contract_version()); // 静态指针，不释放

  const memoryBytesBefore = exports.memory.buffer.byteLength;
  const probeBytes = Uint8Array.from([0x4d, 0x50, 0x00, 0xff, 0x01, 0x7f, 0x80, 0xa5]);
  const allocPtr = exports.mp_alloc(probeBytes.length);
  if (allocPtr === 0) {
    throw new Error('mp_alloc 返回 0：探针缓冲区真实分配失败');
  }
  let allocWriteReadOk: boolean;
  try {
    const region = new Uint8Array(exports.memory.buffer, allocPtr, probeBytes.length);
    region.set(probeBytes);
    allocWriteReadOk = probeBytes.every((byte, index) => region[index] === byte);
  } finally {
    exports.mp_free(allocPtr);
  }
  const memoryBytesAfter = exports.memory.buffer.byteLength;

  const resultBlockProbeText = callApi(core, 'validate-menu', '{}');
  return {
    apiVersion,
    contractVersion,
    memoryBytesBefore,
    memoryBytesAfter,
    allocPtr,
    allocWriteReadOk,
    resultBlockProbeText,
  };
}
