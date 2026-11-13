/**
 * canonical-json.ts — 与 C++ 核心一致的 JSON 规范化序列化。
 *
 * 依据 core/src/json.cpp 的 SerializeString/SerializeObject/SerializeValue 与
 * core/include/mp/json.h 的注释：
 *   对象键按 UTF-8 字节序递归排序、数组保序、紧凑（无空白/无结尾换行）、
 *   字符串只转义 `"`、`\` 与 <0x20 的控制字节（写作 \u00xx，小写 hex），
 *   其余字节（含中文 UTF-8）原样输出，数字按解析后的整数值输出。
 *
 * 只用于 catalogHash / nutritionConfig 快照哈希与备份摘要，不参与页面渲染。
 */

import { sha256Prefixed, utf8ToBytes } from './sha256';

function escapeString(text: string): string {
  let out = '"';
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const ch = text[i];
    if (ch === '"') {
      out += '\\"';
    } else if (ch === '\\') {
      out += '\\\\';
    } else if (code < 0x20) {
      out += '\\u00' + code.toString(16).padStart(2, '0');
    } else {
      out += ch;
    }
  }
  return out + '"';
}

function utf8Compare(a: string, b: string): number {
  const left = utf8ToBytes(a);
  const right = utf8ToBytes(b);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }
  return left.length - right.length;
}

function serialize(value: any, skipRootKey: string | null, isRoot: boolean): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  const type = typeof value;
  if (type === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (type === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`规范化序列化只接受安全整数，收到 ${String(value)}`);
    }
    return String(value === 0 ? 0 : value); // 消除 -0
  }
  if (type === 'string') {
    return escapeString(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => serialize(item, null, false)).join(',') + ']';
  }
  if (type === 'object') {
    const keys = Object.keys(value)
      .filter((key) => !(isRoot && skipRootKey !== null && key === skipRootKey))
      .sort(utf8Compare);
    const parts: string[] = [];
    for (const key of keys) {
      if (value[key] === undefined) {
        continue; // undefined 不是 JSON 值，与 JSON.stringify 一致省略
      }
      parts.push(escapeString(key) + ':' + serialize(value[key], null, false));
    }
    return '{' + parts.join(',') + '}';
  }
  throw new Error(`规范化序列化遇到不支持的类型：${type}`);
}

/** 规范化序列化；skipRootKey 用于计算排除自身 hash 字段的摘要。 */
export function canonicalJson(value: any, skipRootKey: string | null = null): string {
  return serialize(value, skipRootKey, true);
}

/** 计算 `sha256:<64 hex>` 摘要；excludedRootKey 非空时排除对象根上的该键。 */
export function canonicalSha256(value: any, excludedRootKey: string | null = null): string {
  return sha256Prefixed(canonicalJson(value, excludedRootKey));
}
