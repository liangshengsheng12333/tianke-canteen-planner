<!-- ppt-master-schema: design-spec/v1 -->
# canteen-eval-2026 - Design Spec

## I. Project Information

| Item | Value |
| --- | --- |
| Project Name | canteen-eval-2026 |
| Canvas Format | PPT 16:9 (1920×1080) |
| Page Count | 9 |
| Primary Language | zh-CN |
| Target Audience | 课程答辩评审老师、期末评测考核小组 |
| Communication Intent | 全面展示《天科食客》系统从痛点到C++核心、WASM本地架构与小程序全流程成果，重点加入时空自由度分析与两餐DP关键优化，交代客观边界 |
| Desired Audience Outcome | 评审老师充分认可项目的算法理论深度、工程落地闭环与严谨求实态度，评定优秀成绩 |
| Core Message / Ask / Action | 真实食堂痛点出发，C++跨平台算法核心驱动，WASM本地闭环，深度时空自由度控制与客观边界兼备 |
| Delivery Context | 主要为期末现场投影答辩讲解，次要为关键节点唤起交互HTML演示与会后结项材料留存 |
| Artifact Afterlife | 作为大作业结项文档、课程优秀作品存档与答辩材料存档 |
| Reading Mode | balanced |
| Content Strategy | balanced |
| Design Style | custom (清新活力科技风) |
| AI Image Acquisition Path | not applicable |
| Generation Mode | continuous |
| Spec Refinement | disabled |
| Speaker Notes | enabled — final Stage-2 proactive policy |
| Custom Animations | enabled — explicit instruction and object/all-motion scope |
| Narration Audio | disabled — workflow default |
| Created Date | 2026-10-26 |

## II. Canvas Specification

| Property | Value |
| --- | --- |
| Format | PPT 16:9 |
| Dimensions | 1920 × 1080 |
| viewBox | 0 0 1920 1080 |
| Margins | 80px |
| Content Area | 1760 × 920 |

## III. Visual Theme

### Theme Style

- **Mode**: custom
- **Mode Behavior**: 以结构化论证为主线，先亮出核心技术架构与业务闭环，再深入时空自由度与算法控制，最后以实测数据和客观边界作为严密支撑。
- **Visual style**: custom
- **Visual Style Behavior**: 采用现代工程科技排版，清晰栅格与卡片微边框，留白舒适，层级分明。
- **Theme**: 清新活力科技风
- **Tone**: 严谨、现代、清晰、客观

### Color Scheme

| Role | HEX | Purpose |
| --- | --- | --- |
| Background | #FAFAFA | 全局演示画布底色，纯净防眩光 |
| Secondary background | #F4F4F5 | 容器卡片、对比底块底色 |
| Primary | #2563EB | 核心科技蓝，用于主标题、关键模块与聚焦元素 |
| Accent | #10B981 | 活力翠绿，用于成功闭环、通过项与正向数据 |
| Secondary accent | #F59E0B | 琥珀金橙，用于指标强调、就餐场景标签与对比焦点 |
| Body text | #18181B | 高对比度深色文本，保障投影易读性 |
| Secondary text | #71717A | 次要说明、图表注释与边界标注 |
| Divider | #E4E4E7 | 细分割线与微边框 |

## IV. Typography System

### Font Plan

| Role | Character (Reference) | Primary | English if non-English | Fallback tail |
| --- | --- | --- | --- | --- |
| Title | Modern Bold | Microsoft YaHei | Segoe UI | sans-serif |
| Body | Clean Neutral | Microsoft YaHei | Calibri | sans-serif |

- **Title stack**: Microsoft YaHei, Segoe UI, sans-serif
- **Body stack**: Microsoft YaHei, Calibri, sans-serif

### Font Size Hierarchy

| Purpose | Anchor Size (px) |
| --- | ---: |
| Body | 24 |
| Title | 42 |
| Subtitle | 32 |
| Annotation | 18 |
| Caption | 14 |
| Code | 14 |

## V. Layout Principles

### Deck-wide Direction

- **Hierarchy direction**: 从上到下、从左到右，重点指标放大强化，图表与说明并重
- **Composition tendency**: 卡片化网格容器，微边框与柔和层级，右侧/下方预留图表与交互按钮区
- **Cross-page continuity**: 顶部统一保留章节点位与页码指示，品牌主色 #2563EB 贯穿关键视线落点
- **Spacing posture**: balanced
- **Spacing anchors**: 80px, 32px, 24px, 12px, 36px

## VI. Icon Usage Specification

- **Primary bundled library**: lucide
- **Brand-logo library**: none

| Icon Path | Suitable Scenarios |
| --- | --- |
| icons/cpu.svg | C++ 核心与性能计算 |
| icons/layout.svg | 小程序与前端界面 |
| icons/database.svg | 菜单数据与状态存储 |
| icons/check-circle.svg | 验证通过与闭环确认 |
| icons/arrow-right.svg | 流程推进与跳转链接 |
| icons/external-link.svg | 启动交互 HTML 演示按钮 |
| icons/alert-circle.svg | 边界约束与客观说明 |
| icons/clock.svg | 耗时与性能中位数统计 |

## VIII. Image Resource List

| Filename | Dimensions | Ratio | Purpose | Type | Image pattern | Crop Policy | Acquire Via | Status | Reference | text_policy | page_role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| images/T10d-03-CPP与小程序架构-4K-浅色.png | 3840×2160 | 1.78 | 运行时架构展示 | Sourced | 架构图主图 | no-crop | user | existing | images/T10d-03-CPP与小程序架构.html | preserve | hero |
| images/T10d-02-产品使用闭环-4K-浅色.png | 3840×2160 | 1.78 | 业务闭环展示 | Sourced | 闭环图主图 | no-crop | user | existing | images/T10d-02-产品使用闭环.html | preserve | hero |
| images/T10d-01-三算法机制对照-4K-浅色.png | 3840×2160 | 1.78 | 算法机制对比 | Sourced | 对照图主图 | no-crop | user | existing | images/T10d-01-三算法机制对照.html | preserve | hero |
| images/01-user-v5-首页-新装方案.png | 728×1572 | 0.46 | 小程序首页走查 | Sourced | 模拟器手机框 | no-crop | user | existing | sources/03-界面截图 | preserve | supporting |
| images/02-user-v5-菜单覆盖文案.png | 728×1572 | 0.46 | 菜单覆盖走查 | Sourced | 模拟器手机框 | no-crop | user | existing | sources/03-界面截图 | preserve | supporting |
| images/03-user-v5-推荐方式页.png | 728×1572 | 0.46 | 算法选择走查 | Sourced | 模拟器手机框 | no-crop | user | existing | sources/03-界面截图 | preserve | supporting |
| images/04-user-v5-新增窗口选菜麻辣烫300g.png | 728×1572 | 0.46 | 自选菜品走查 | Sourced | 模拟器手机框 | no-crop | user | existing | sources/03-界面截图 | preserve | supporting |
| images/05-user-v5-记录页.png | 728×1572 | 0.46 | 就餐记录走查 | Sourced | 模拟器手机框 | no-crop | user | existing | sources/03-界面截图 | preserve | supporting |

## IX. Content Outline

### Part 1: 项目概览与真实落地场景

#### Slide 01 - 项目概览与封面
- **Audience move**: 评审老师对项目建立第一印象 → 明确汇报主题、核心技术栈与汇报人
- **Relationships**: title parent subtitle; subtitle parent presenter
- **Composition**: 大气科技封面，品牌主色背景修饰，左侧核心标题与汇报人，右侧技术卡片
- **Title**: 天科食客：基于 C++ 核心与 WASM 架构的校园食堂智能选餐优化系统
- **Core message**: 期末综合评测答辩汇报 · 汇报人：任潇宇
- **Content**: 课题定位：软硬件工程协同与算法落地 · 核心技术：C++17 / WebAssembly / 微信小程序 · 汇报人：任潇宇 · 指导教师与评测组 · 2026年10月
- **Motion suggestion**: 标题淡入，技术标签依次浮现

#### Slide 02 - 痛点分析与真实场景覆盖
- **Audience move**: 理解为何要做该系统以及数据是否真实 → 认同三大选餐痛点与西一食堂全数据支撑
- **Relationships**: pain_points contrast data_statistics
- **Composition**: 左侧痛点与工程目标卡片，右侧三大核心数据指标（KPI Tiles）与真实场景说明
- **Title**: 痛点分析与真实落地场景：西院西一食堂全数据覆盖
- **Core message**: 学生选餐兼具窗口分散、营养考量与预算限制，系统覆盖西一食堂 12 窗口 137 可售报价真实菜单
- **Content**: 痛点驱动：档口分散决策难、多维营养与预算矛盾、跨端离线算力瓶颈 · 真实覆盖：12 个窗口覆盖 / 166 个菜品技术实体 / 137 条真实可售报价 · 严谨口径：营养数据权威有来源估算，缺失项标“未知”而非零
- **Motion suggestion**: 痛点卡片滑入，三大数字指标卡片放大升起

### Part 2: 系统架构与业务闭环

#### Slide 03 - C++17 与小程序混合运行时架构
- **Audience move**: 了解系统底层如何运转 → 掌握跨平台双工具链与 WASM 架构
- **Relationships**: cpp_core parent wasm_toolchain link miniprogram
- **Composition**: 顶部架构概述，中央嵌入高分辨率架构图，右下角放置醒目的【🔗 启动架构交互演示】原生超链接按钮
- **Title**: 混合运行时架构：C++17 内核与 WASM 高性能桥接
- **Core message**: 共享 C++17 核心，MSVC Native CLI 用于电脑侧验证，Zig/Clang WASM 在小程序本地离线运行
- **Content**: 共享内核：统一的数学模型与评分核心 · Native CLI：开发端快速单体测试与基线验证 · WASM 运行：零网络依赖、本地高效率执行 · 双打包机制：user 体验包与 dev 诊断包
- **Images**: images/T10d-03-CPP与小程序架构-4K-浅色.png
- **Hyperlinks**: 启动交互演示=images/T10d-03-CPP与小程序架构.html
- **Motion suggestion**: 架构图平滑展示，演示按钮轻微呼吸发光

#### Slide 04 - 业务全流程与产品使用闭环
- **Audience move**: 了解普通用户如何使用该小程序 → 认可产品交互闭环的完整性
- **Relationships**: recommend order customize order record order history
- **Composition**: 流程闭环步骤卡片，中央嵌入产品闭环矢量图，配备【🔗 启动闭环交互演示】按钮
- **Title**: 业务全流程：从智能推荐到就餐记录闭环
- **Core message**: 方案推荐、自选加菜、确认记餐与历史回看四位一体，真实贴合就餐习惯
- **Content**: 环节一：新装方案初选与餐次概况 · 环节二：窗口自选与个性化营养称重加菜 · 环节三：用户确认后独立记餐（推荐与实录分离）· 环节四：历史数据回看与预算统计
- **Images**: images/T10d-02-产品使用闭环-4K-浅色.png
- **Hyperlinks**: 启动交互演示=images/T10d-02-产品使用闭环.html
- **Motion suggestion**: 闭环四步骤沿顺时针方向依次激活

### Part 3: 核心算法与时空自由度分析

#### Slide 05 - 时空自由度分析与算法剪枝控制
- **Audience move**: 深入探究算法内核与复杂度理论 → 充分理解决策多维自由度、时空复杂度推演与剪枝防爆炸机制
- **Relationships**: decision_dof parent time_dof link space_dof
- **Composition**: 左侧嵌入三算法机制对照图并配交互入口，右侧构建三栏深度时空自由度分析矩阵卡片
- **Title**: 核心算法机制：时空自由度分析与剪枝控制
- **Core message**: 多维自由度决策建模，通过分层剪枝与沙箱内存限额消除组合爆炸
- **Content**: 决策自由度：餐次 $M \in \{1,2,3\}$、菜品 $137^M$ 组合空间，由预算与营养目标收缩至可行域 · 时间自由度：贪心一维坍缩 $O(N\log N)$；DP 消除两餐重复扫描并实行 20,000 桶化截断；BnB 上下界提前剪枝 · 空间自由度：候选池上限 $K \le 256$；WASM 线性内存安全红线 768 页，实测峰值 562 页（35MB）
- **Images**: images/T10d-01-三算法机制对照-4K-浅色.png
- **Hyperlinks**: 启动交互演示=images/T10d-01-三算法机制对照.html
- **Motion suggestion**: 时空自由度卡片渐次展开

### Part 4: 性能突破与实测客观边界

#### Slide 06 - 核心性能飞跃：两餐 DP 消除重复扫描
- **Audience move**: 见证关键性能突破成果 → 震撼于从 23.46 秒到 71 毫秒的百倍提升
- **Relationships**: before_optimization contrast after_optimization
- **Composition**: 双核心 KPI 对比大看板（优化前 23,456 ms vs 优化后 71.0 ms），搭配柱状提速图
- **Title**: 性能突破：两餐 DP 消除重复扫描
- **Core message**: 针对两餐 DP 重复扫描执行等价优化，PC/Node 实测中位数从 23.46 秒大幅降低至 71.00 ms
- **Content**: 旧冻结 WASM：五次运行中位数 23,455.864 ms（严重卡顿）· 新核心优化后：作者五次中位数 70.999 ms，P01 独立复测 86.300 ms，接入包 69.534 ms · 性能提升百倍以上，消除计算等待
- **Motion suggestion**: 优化前耗时条收缩，优化后毫秒级卡片高亮浮现

#### Slide 07 - 测量边界与严谨声明：实事求是的工程态度
- **Audience move**: 审视测试数据是否严谨合规 → 赞赏团队不盲目虚构、实事求是的工科作风
- **Relationships**: verified_facts contrast explicit_boundaries
- **Composition**: 两组对称卡片，左侧已确认事实，右侧严谨客观边界
- **Title**: 测量边界与严谨声明：实事求是的工程态度
- **Core message**: 明确承认未达原 50ms 目标但达成可用性能，严格区分 PC 数据与手机实测
- **Content**: 内存平稳：PC WASM G2 峰值 562 页远低于 768 页容量线 · 客观边界一：原 50 ms 目标未达到，当前用户认可本轮实用性能，严禁虚构达标 · 客观边界二：全部数据为 PC/Node 测量，不代表手机实测速度
- **Motion suggestion**: 边界警示标志显现，强调客观结论

### Part 5: 界面走查与答辩总结

#### Slide 08 - 原型走查与评测验收范围
- **Audience move**: 查看系统实际运行效果与验收结论 → 确认模拟器走查跑通并认可严密的过程管理
- **Relationships**: screenshot_grid parent acceptance_boundary
- **Composition**: 上方 5 联模拟器真实手机界面横向排布，下方验收对照表（已通过项 vs 待推进项）
- **Title**: 原型走查与验收范围：真实界面与边界界定
- **Core message**: user-v5 模拟器走查完备支持课程演示，坦诚交代真机与数据恢复等未测项
- **Content**: 原型走查：首页新装方案 / 菜单覆盖文案 / 推荐算法单选 / 麻辣烫300g选菜 / 记录页 · 已验收范围：模拟器功能闭环、算法响应哈希匹配 · 客观未测项：真机实测、微信聊天文件选择/手机恢复、朋友试用（跳过）· 当前定位为课程答辩体验版
- **Images**: images/01-user-v5-首页-新装方案.png; images/02-user-v5-菜单覆盖文案.png; images/03-user-v5-推荐方式页.png; images/04-user-v5-新增窗口选菜麻辣烫300g.png; images/05-user-v5-记录页.png
- **Motion suggestion**: 五张手机截图依次展开排列，下方边界打勾

#### Slide 09 - 总结回顾与答辩致谢
- **Audience move**: 梳理全篇要点，留下深刻积极印象 → 欢迎老师提问交流
- **Relationships**: summary parent ren_xiaoyu_closing
- **Composition**: 大气收尾页面，三大核心亮点提炼卡片，下方居中致谢与汇报人 任潇宇
- **Title**: 总结回顾：打造有深度的校园食堂优化系统
- **Core message**: C++ 跨平台算法内核 · WASM 轻量化本地落地 · 深度时空自由度控制 · 真实食堂场景闭环
- **Content**: 亮点一：真实食堂场景覆盖，137条报价与营养估算模型 · 亮点二：跨平台C++与WASM架构，两餐DP提升数百倍 · 亮点三：深度时空自由度建模与严谨求实答辩作风 · 汇报人：任潇宇 · 敬请各位评审老师批评指正！
- **Motion suggestion**: 总结卡片聚合并显现致谢文本

## X. Speaker Notes Requirements

- **Generation**: enabled
- **Filename**: match each SVG filename under notes/
- **Content**: 紧扣期末答辩场景，为汇报人任潇宇提供专业、严谨、清晰的逐页口述答辩词，并在涉及交互图时注明演示动作
- **Total duration**: 约 6-8 分钟
- **Notes style**: formal
- **Presentation purpose**: 全面展示《天科食客》系统从痛点到C++核心、WASM本地架构与小程序全流程成果，突出时空自由度理论、两餐DP关键优化与实测数据，交代客观边界
