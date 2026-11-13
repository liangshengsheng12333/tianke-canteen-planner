/**
 * app.ts — 天科食客小程序入口。
 *
 * 只持有全局唯一 AppStore（本地状态 + WASM 调用串行化），页面通过 getApp().globalData.store
 * 访问同一份状态；不在页面之间复制业务数据。onShow 检查业务日期是否跨日。
 *
 * 外观（浅色/深色/跟随系统）由 utils/appearance.ts 独占管理：在 App() 之前同步解析，
 * 让首帧尽量直接用正确主题；系统主题变化与回到前台时各同步一次。
 */
import { AppStore } from './domain/store';
import { getAppearance, initAppearance, refreshAppearance } from './utils/appearance';
import { nowMs } from './utils/wx-runtime';

// 冷启动计时起点：模块求值早于 onLaunch，尽量接近小程序 JS 启动时刻。
const launchAtMs = nowMs();
const store = new AppStore();

// 先确定外观再创建页面：外观读取是同步本地存储，不引入额外启动等待。
refreshAppearance();

App({
  globalData: { store, launchAtMs, firstHomeAtMs: 0, appearance: getAppearance() },
  onLaunch() {
    const result = store.init();
    if (!result.ok) {
      // 初始化失败（存储损坏等）不静默吞掉，页面会展示可恢复的错误状态。
      console.error('天科食客初始化失败：', result.message);
    }
    // 监听系统主题变化；不支持时只保留“回到前台同步”这一条路径。
    initAppearance();
    refreshAppearance();
  },
  onShow() {
    store.ensureToday();
    // 从后台返回时按当前系统主题重新解析一次（“跟随系统”才能在返回后立即同步）。
    refreshAppearance();
  },
});