/**
 * core-runtime.ts — 小程序侧 WASM 核心的单例加载器。
 *
 * 复用 core-bridge.ts 的加载/调用/释放实现，本文件只负责：
 *  1. 默认用 WXWebAssembly.instantiate 加载包内 WASM；
 *  2. 保持单实例串行（页面/存储层共用一个 Core）；
 *  3. 为 Node 测试提供注入 instantiate 的入口（测试不等同真机证据）。
 */

import { callApi, callApiTimed, loadCore, probeAbi } from '../utils/core-bridge';
import type { AbiProbe, Command, Core, Instantiate, TimedCall } from '../utils/core-bridge';

export const DEFAULT_WASM_PATH = '/assets/wasm/mp_core.wasm';

/** A18 isolated time-aware WASM identity; env.mp_monotonic_ms import required. */
export const WASM_IDENTITY = {
  bytes: 111554,
  sha256: 'B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD',
};

let core: Core | null = null;
let instantiateImpl: Instantiate | null = null;
let monotonicClockImpl: (() => number) | null = null;

function platformMonotonicClockMs(): number {
  const platform = typeof globalThis !== 'undefined' ? (globalThis as any).performance : null;
  return platform && typeof platform.now === 'function' ? platform.now() : -1;
}

let wasmPath = DEFAULT_WASM_PATH;

function defaultInstantiate(path: string, imports: object): Promise<{ instance: { exports: any } }> {
  if (typeof WXWebAssembly === 'undefined' || !WXWebAssembly || typeof WXWebAssembly.instantiate !== 'function') {
    throw new Error('WXWebAssembly 不可用：必须在微信小程序基础库中运行');
  }
  return WXWebAssembly.instantiate(path, imports);
}

export function configureCore(options: { instantiate?: Instantiate; wasmPath?: string; monotonicClockMs?: () => number }): void {
  if (options.monotonicClockMs) {
    monotonicClockImpl = options.monotonicClockMs;
  }
  if (options.wasmPath) {
    wasmPath = options.wasmPath;
  }
  if (options.instantiate) {
    instantiateImpl = options.instantiate;
  }
}

export function getWasmPath(): string {
  return wasmPath;
}

export function isCoreLoaded(): boolean {
  return core !== null;
}

/** 丢弃当前实例，供冷启动/重开恢复测试使用（真实小程序由进程退出完成）。 */
export function resetCore(): void {
  core = null;
}

export async function ensureCore(): Promise<Core> {
  if (core === null) {
    core = await loadCore(instantiateImpl || defaultInstantiate, wasmPath,
                          () => (monotonicClockImpl || platformMonotonicClockMs)());
  }
  return core;
}

/** 调用一个 WASM 入口；未加载时抛可定位错误（调用方负责先 ensureCore）。 */
export function callCore(command: Command, requestText: string): string {
  if (core === null) {
    throw new Error('WASM 核心尚未加载：调用方必须先 ensureCore()');
  }
  return callApi(core, command, requestText);
}

export function runAbiProbe(): AbiProbe {
  if (core === null) {
    throw new Error('WASM 核心尚未加载：调用方必须先 ensureCore()');
  }
  return probeAbi(core);
}

/**
 * 计时调用（开发页四口径计时用）：返回核心入口自身耗时与整段桥接耗时。
 * 与 callApi 共用同一 ABI 实现，不复制分配/释放逻辑。
 */
export function measureCoreCall(command: Command, requestText: string, clock: () => number): TimedCall {
  if (core === null) {
    throw new Error('WASM 核心尚未加载：调用方必须先 ensureCore()');
  }
  return callApiTimed(core, command, requestText, clock);
}
