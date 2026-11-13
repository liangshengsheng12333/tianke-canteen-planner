// register-ts.mjs — Node 24 直接运行小程序 TypeScript 源码的解析钩子。
//
// 背景：Node 24 内置类型擦除（type stripping）可以直接 import .ts，但不做扩展名
// 补全；小程序源码内部使用 `import './types'` 这类无扩展名相对导入，微信开发者
// 工具能编译，Node 直接跑会 ERR_MODULE_NOT_FOUND。本文件用 node:module 的同步
// registerHooks 只补这一件事：相对/绝对且无扩展名的 specifier 依次尝试
// `.ts`、`.mts`、`.js`、`/index.ts`；其余解析完全交给 Node 默认行为。
//
// 用法（在项目根 D:\项目\cpp\Projects\食堂就餐优化系统 下）：
//   node --import ./tools/miniprogram/register-ts.mjs --test tools/miniprogram/test-t05-*.mjs
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/measure-t05.mjs
//
// 边界：只在测试/测量入口使用，不进入小程序运行时代码；不改变任何被测源码。
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 扩展名判定：最后一段要么没有 `.`，要么只有 `./`、`../` 这种路径段点。 */
function isExtensionless(specifier) {
  const lastSegment = specifier.slice(specifier.lastIndexOf('/') + 1);
  return lastSegment !== '' && !lastSegment.includes('.');
}

/** 只在相对或绝对文件路径上做补全；裸模块名（node:fs 等）原样交给 Node。 */
function isPathSpecifier(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/') || specifier.startsWith('file:');
}

const CANDIDATE_SUFFIXES = ['.ts', '.mts', '.js', '/index.ts'];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!isPathSpecifier(specifier) || !isExtensionless(specifier) || !context.parentURL) {
      return nextResolve(specifier, context);
    }
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidateUrl = new URL(specifier + suffix, context.parentURL);
      if (!candidateUrl.protocol.startsWith('file:')) {
        continue;
      }
      if (existsSync(fileURLToPath(candidateUrl))) {
        return nextResolve(candidateUrl.href, context);
      }
    }
    // 找不到候选时保留 Node 原始报错（ERR_MODULE_NOT_FOUND），便于定位真实路径问题。
    return nextResolve(specifier, context);
  },
});
