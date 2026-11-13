// test-appearance.mjs — T05U01 外观模块的本地单元验证（Node 直跑 TS，不是微信运行时证据）。
//
// 覆盖：默认值、非法值回退、保存成功、写入失败、回读不一致、系统主题可读/不可读、
// “跟随系统”保留用户选择、系统主题变化事件通知、可见页面重绘通知。
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-appearance.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const modulePath = path.join(projectRoot, 'miniprogram', 'src', 'utils', 'appearance.ts');
const STORAGE_KEY = 'tk.ui.appearance.v1';

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failures.push(name);
    console.log(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** 每个用例用独立的模块实例（查询串绕过 ESM 缓存），避免上一个用例的内存快照串味。 */
let instanceSeq = 0;
async function loadModule() {
  instanceSeq += 1;
  const url = `${pathToFileURL(modulePath).href}?case=${instanceSeq}`;
  return import(url);
}

/** 安装可控的 wx 测试桩；返回控制器，便于逐用例调整失败模式与系统主题。 */
function installWxStub() {
  const storage = new Map();
  const control = {
    storage,
    writeThrows: false,
    readThrows: false,
    tamperValue: null,
    systemTheme: 'light',
    appBaseThrows: false,
    themeHandlers: [],
    navCalls: [],
    backgroundCalls: [],
  };
  globalThis.wx = {
    getStorageSync(key) {
      if (control.readThrows) {
        throw new Error('storage read failed');
      }
      return storage.has(key) ? storage.get(key) : '';
    },
    setStorageSync(key, value) {
      if (control.writeThrows) {
        throw new Error('storage full');
      }
      // tamperValue 模拟“写入返回成功但实际落盘值不同”，用于验证回读校验。
      storage.set(key, control.tamperValue === null ? value : control.tamperValue);
    },
    getAppBaseInfo() {
      if (control.appBaseThrows) {
        throw new Error('getAppBaseInfo unavailable');
      }
      return { theme: control.systemTheme };
    },
    getSystemInfoSync() {
      return { theme: control.systemTheme };
    },
    onThemeChange(handler) {
      control.themeHandlers.push(handler);
    },
    setNavigationBarColor(options) {
      control.navCalls.push(options);
    },
    setBackgroundColor(options) {
      control.backgroundCalls.push(options);
    },
  };
  return control;
}

const control = installWxStub();

// 1) 无存储值 → 默认浅色；页面 class 为 tk-light。
{
  const mod = await loadModule();
  check('默认偏好为浅色', mod.loadPreference() === 'light', mod.loadPreference());
  check('默认解析结果为浅色', mod.getAppearance().resolved === 'light');
  check('默认页面 class 为 tk-light', mod.pageThemeData().themeClass === 'tk-light');
}

// 2) 非法存储值 → 回退浅色，不猜测用户意图。
{
  control.storage.clear();
  control.storage.set(STORAGE_KEY, 'blue');
  const mod = await loadModule();
  check('非法存储值回退浅色', mod.loadPreference() === 'light');
}

// 3) 保存成功：写入后可回读，内存快照与实际解析一致。
{
  control.storage.clear();
  control.writeThrows = false;
  control.tamperValue = null;
  control.systemTheme = 'light';
  const mod = await loadModule();
  const saved = mod.setAppearancePreference('dark');
  check('保存深色成功', saved === true);
  check('保存后存储值为 dark', control.storage.get(STORAGE_KEY) === 'dark');
  check('保存后快照为深色', mod.getAppearance().resolved === 'dark');
  check('深色页面 class 为 tk-dark', mod.pageThemeData().themeClass === 'tk-dark');
  check('切换后调用了导航栏配色', control.navCalls.length > 0, String(control.navCalls.length));
}

// 4) 写入抛错：返回 false，存储保持旧值，内存不切换。
{
  control.storage.clear();
  control.storage.set(STORAGE_KEY, 'dark');
  control.writeThrows = true;
  const mod = await loadModule();
  const saved = mod.setAppearancePreference('light');
  check('写入抛错时保存返回 false', saved === false);
  check('写入抛错后存储仍是旧值', control.storage.get(STORAGE_KEY) === 'dark', String(control.storage.get(STORAGE_KEY)));
  check('写入抛错后快照仍是深色', mod.getAppearance().resolved === 'dark');
  control.writeThrows = false;
}

// 5) 写入返回成功但回读不一致：按失败处理（不能假称已保存）。
{
  control.storage.clear();
  control.storage.set(STORAGE_KEY, 'dark');
  control.tamperValue = 'system';
  const mod = await loadModule();
  const saved = mod.setAppearancePreference('light');
  check('回读不一致时保存返回 false', saved === false);
  check('回读不一致时快照不变', mod.getAppearance().preference === 'dark');
  control.tamperValue = null;
}

// 6) 跟随系统：系统主题可读时按系统解析，并记录 systemReadable。
{
  control.storage.clear();
  control.storage.set(STORAGE_KEY, 'system');
  control.systemTheme = 'dark';
  const mod = await loadModule();
  check('跟随系统解析为深色', mod.resolveTheme('system') === 'dark');
  check('跟随系统可读时标记 systemReadable', mod.getAppearance().systemReadable === true);
  check('跟随系统页面 class 为 tk-dark', mod.pageThemeData().themeClass === 'tk-dark');
}

// 7) 跟随系统但系统主题不可读：暂用浅色，但保存的选择仍是 system（不能被覆盖成 light）。
{
  control.storage.clear();
  control.storage.set(STORAGE_KEY, 'system');
  control.appBaseThrows = true;
  delete globalThis.wx.getSystemInfoSync;
  const mod = await loadModule();
  const snapshot = mod.getAppearance();
  check('不可读系统主题时暂用浅色', snapshot.resolved === 'light');
  check('不可读时仍保留 system 选择', snapshot.preference === 'system');
  check('不可读时标记 systemReadable=false', snapshot.systemReadable === false);
  check('不可读时不把解析值写回存储', control.storage.get(STORAGE_KEY) === 'system');
  control.appBaseThrows = false;
  globalThis.wx.getSystemInfoSync = () => ({ theme: control.systemTheme });
}

// 8) 系统主题变化事件：只在“跟随系统”时触发重解析，并通知可见页面重绘。
{
  control.storage.clear();
  control.storage.set(STORAGE_KEY, 'system');
  control.systemTheme = 'light';
  const pages = [];
  const visiblePage = {
    data: { themeClass: 'tk-light' },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
  const otherPage = { data: { view: null }, setData() {} };
  pages.push(visiblePage, otherPage);
  globalThis.getCurrentPages = () => pages;

  const mod = await loadModule();
  mod.initAppearance();
  check('注册了系统主题监听', control.themeHandlers.length === 1, String(control.themeHandlers.length));

  control.systemTheme = 'dark';
  control.themeHandlers[0]();
  check('系统主题变化后快照跟随为深色', mod.getAppearance().resolved === 'dark');
  check('可见页面收到 tk-dark 重绘', visiblePage.data.themeClass === 'tk-dark', visiblePage.data.themeClass);
  check('无 themeClass 的页面不被改动', otherPage.data.themeClass === undefined);
  globalThis.getCurrentPages = () => [];
}

// 9) 固定深色不受系统主题影响：系统变深色/浅色都不应改动解析结果。
{
  control.storage.clear();
  control.storage.set(STORAGE_KEY, 'dark');
  control.systemTheme = 'light';
  const mod = await loadModule();
  mod.initAppearance();
  control.systemTheme = 'dark';
  control.themeHandlers.forEach((handler) => handler());
  check('固定深色不受系统主题影响', mod.getAppearance().resolved === 'dark');
}

// 10) 读取抛错时不冒泡：按默认浅色继续启动。
{
  control.storage.clear();
  control.readThrows = true;
  const mod = await loadModule();
  check('读取抛错时回退浅色', mod.loadPreference() === 'light');
  control.readThrows = false;
}

console.log(failures.length === 0 ? `\n全部 ${passed} 项外观模块检查通过（本地 Node 桩，不是微信运行时证据）` : `\n失败 ${failures.length} 项：${failures.join('；')}`);
process.exitCode = failures.length === 0 ? 0 : 1;