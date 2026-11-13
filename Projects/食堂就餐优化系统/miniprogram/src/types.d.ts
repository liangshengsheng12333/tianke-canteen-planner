// 微信全局对象的最小声明：本阶段不安装 miniprogram-api-typings，避免新增依赖。
declare const wx: any;
declare const WXWebAssembly: any;
declare function App(options: object): void;
declare function Page(options: object): void;
declare function getApp(): any;
declare function getCurrentPages(): any[];
