// check-pages.mjs — T05 页面静态一致性检查（不能替代微信编译）：
//  1) WXML 标签闭合；
//  2) 事件绑定（bind*/catch*）在页面对象里存在对应方法；
//  3) mustache 表达式的根标识符都在页面 data（或 wx:for 局部变量）中；
//  4) 每个页面文件齐全（ts/wxml/wxss/json）。
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const srcRoot = path.join(projectRoot, 'miniprogram', 'src');
// U04 起页面清单包含“我的”收口新增的个人资料/预算偏好/数据管理三页；T05S03 追加自选菜次级页。
const pages = ['home', 'profile', 'logs', 'self-pick', 'menu', 'dev', 'appearance', 'profile-edit', 'budget', 'data'];

const storage = new Map();
globalThis.wx = {
  getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key),
  env: { USER_DATA_PATH: path.join(projectRoot, 'miniprogram') },
  getFileSystemManager: () => ({ writeFileSync() {}, readFileSync() { return ''; } }),
  getAppBaseInfo: () => ({}),
  getDeviceInfo: () => ({}),
  showToast() {}, showModal() {}, showActionSheet() {}, navigateTo() {}, reLaunch() {},
  setClipboardData() {}, getClipboardData() {}, chooseMessageFile() {},
};
const pageOptions = [];
globalThis.Page = (options) => pageOptions.push(options);
globalThis.App = () => {};
globalThis.getApp = () => ({ globalData: { store: null } });
globalThis.getCurrentPages = () => [];

const VOID_TAGS = new Set(['input', 'image', 'icon', 'switch', 'slider', 'progress', 'checkbox', 'radio', 'textarea', 'video', 'audio', 'camera', 'canvas', 'map', 'import', 'include', 'wxs', 'template']);
const KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'typeof', 'in', 'item', 'index', 'wx', 'Math', 'Date', 'Array', 'String', 'Number', 'JSON']);

let failures = 0;
const fail = (page, message) => {
  failures += 1;
  console.log(`[FAIL] pages/${page}: ${message}`);
};
const pass = (page, message) => console.log(`[PASS] pages/${page}: ${message}`);

function checkTagBalance(page, wxml) {
  const stack = [];
  const tagPattern = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g;
  let match;
  let line = 1;
  let consumed = 0;
  while ((match = tagPattern.exec(wxml)) !== null) {
    line += (wxml.slice(consumed, match.index).match(/\n/g) || []).length;
    consumed = match.index;
    const name = match[1].toLowerCase();
    const selfClosing = match[3] === '/' || VOID_TAGS.has(name);
    if (match[0].startsWith('</')) {
      const top = stack.pop();
      if (top !== name) {
        fail(page, `第 ${line} 行闭合标签 </${name}> 与期望 </${top || '无'}> 不匹配`);
        return false;
      }
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  if (stack.length > 0) {
    fail(page, `存在未闭合标签：${stack.map((name) => '<' + name + '>').join(' ')}`);
    return false;
  }
  pass(page, 'WXML 标签闭合');
  return true;
}

function checkEvents(page, wxml, options) {
  const names = new Set();
  const regex = /(?:bind|catch)[a-zA-Z:]+\s*=\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(wxml)) !== null) names.add(match[1]);
  const missing = [...names].filter((name) => typeof options[name] !== 'function');
  if (missing.length > 0) {
    fail(page, `事件绑定缺少页面方法：${missing.join(', ')}`);
    return false;
  }
  pass(page, `事件绑定 ${names.size} 个均有对应方法`);
  return true;
}

function checkBindings(page, wxml, options) {
  const dataKeys = new Set(Object.keys(options.data || {}));
  const locals = new Set(['item', 'index']);
  // wx:for-item / wx:for-index 可重命名局部变量，必须收集，否则误报。
  for (const match of wxml.matchAll(/wx:for-item\s*=\s*"([^"]+)"/g)) locals.add(match[1]);
  for (const match of wxml.matchAll(/wx:for-index\s*=\s*"([^"]+)"/g)) locals.add(match[1]);
  // block 模板里的 template data 别名也按局部变量放过（本项目未使用自定义组件）。
  const identifiers = new Set();
  const regex = /\{\{([\s\S]*?)\}\}/g;
  let match;
  while ((match = regex.exec(wxml)) !== null) {
    const expression = match[1].replace(/'[^']*'|"[^"]*"/g, ' ');
    // 只取“路径根标识符”：前面不能是 '.'，避免把 view.a.b 的 a/b 当根字段。
    const tokens = expression.match(/(?<![.\w$])[A-Za-z_$][\w$]*/g) || [];
    for (const token of tokens) {
      if (KEYWORDS.has(token)) continue;
      identifiers.add(token);
    }
  }
  const missing = [...identifiers].filter((name) => !dataKeys.has(name) && !locals.has(name));
  if (missing.length > 0) {
    fail(page, `WXML 绑定的 data 字段不存在：${missing.join(', ')}`);
    return false;
  }
  pass(page, `WXML 绑定根标识符 ${identifiers.size} 个均可在 data/wx:for 中解析`);
  return true;
}

for (const page of pages) {
  const dir = path.join(srcRoot, 'pages', page);
  try {
    await import(pathToFileURL(path.join(dir, 'index.ts')).href);
  } catch (error) {
    fail(page, `页面模块加载失败：${error && error.message ? error.message : String(error)}`);
  }
  for (const extension of ['ts', 'wxml', 'wxss', 'json']) {
    const file = path.join(dir, `index.${extension}`);
    if (!fs.existsSync(file)) {
      fail(page, `缺少 index.${extension}`);
    }
  }
  const options = pageOptions[pageOptions.length - 1];
  const wxml = fs.readFileSync(path.join(dir, 'index.wxml'), 'utf8');
  try {
    JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  } catch (error) {
    fail(page, `index.json 不是合法 JSON：${error.message}`);
  }
  checkTagBalance(page, wxml);
  if (options) {
    checkEvents(page, wxml, options);
    checkBindings(page, wxml, options);
  } else {
    fail(page, '页面模块未注册 Page(options)');
  }
}

console.log(failures === 0 ? '\n全部页面静态检查通过（不能替代微信开发者工具编译）' : `\n静态检查失败 ${failures} 项`);
process.exitCode = failures === 0 ? 0 : 1;
