<!-- ppt-master-schema: design-spec/v1 -->
# canteen_eval_20261026 - Design Spec

## I. Project Information

| Item | Value |
| --- | --- |
| Project Name | 食堂就餐优化系统（天科食客）期末评测答辩 |
| Canvas Format | PPT 16:9 (1280×720) |
| Page Count | 8 |
| Primary Language | zh-CN |
| Target Audience | 课程评审老师、助教与答辩答辩组同学 |
| Communication Intent | 系统性汇报天科食客的三算法机制（贪心/DP/BnB）、DP关键等价性能优化、C++/WASM跨端工程架构及小程序真实闭环，展示严谨的工科设计与客观的实测边界 |
| Desired Audience Outcome | 评审老师高度认可算法设计深度（60分）、跨端工程质量（20分）以及客观诚实的答辩表现（20分） |
| Core Message / Ask / Action | 真实食堂环境下的就餐与记账闭环；共享C++核心统一三算法；等价优化攻克DP去重热点（PC从23.46秒降至71毫秒）；事实边界清晰严谨 |
| Delivery Context | 课设现场答辩投屏汇报，时长5~7分钟 |
| Artifact Afterlife | 课程期末大作业评测打分、优秀项目归档展示 |
| Reading Mode | presentation |
| Content Strategy | 严格基于已核准的v6素材包与讲稿骨架，如实反映客观实测数据与边界 |
| Design Style | 清新餐饮与严谨工科白绿主题 |
| AI Image Acquisition Path | not applicable |
| Generation Mode | continuous |
| Spec Refinement | disabled |
| Speaker Notes | enabled — 答辩逐页讲稿与时间分配规划（总计约5.5分钟） |
| Custom Animations | disabled — 答辩演示静态幻灯片，保证各端稳定性 |
| Narration Audio | disabled |
| Created Date | 2026-10-26 |

## II. Canvas Specification

| Property | Value |
| --- | --- |
| Format | PPT 16:9 |
| Dimensions | 1280 × 720 |
| viewBox | `0 0 1280 720` |
| Margins | 60px left/right, 40px top/bottom |
| Content Area | 1160 × 640 (x=60..1220, y=40..680) |

## III. Visual Theme

### Theme Style

- **Mode**: custom
- **Visual style**: custom
- **Theme**: 清新餐饮与严谨工科白绿主题
- **Tone**: 严谨、务实、工程感、清晰、数据驱动
- **Mode References**: instructional, pyramid
- **Mode Behavior**: 开篇建立校园食堂就餐与记账痛点，形式化建模并展开三算法对比，呈现DP等价优化PC实测硬核证据，展示C++/WASM跨端架构，收口于客观验证边界与答辩展示。
- **Visual Style References**: swiss-minimal, soft-rounded
- **Visual Style Behavior**: 以深森林绿（#1B4D3E）为主色，薄荷深绿（#2E7D5B）为辅，清爽浅米绿（#F6F9F6）为底，高对比度深墨文本（#1F2923），配合琥珀橙（#E87A24）做算法关键指标与性能拐点高亮。

### Color Scheme

| Role | HEX | Purpose |
| --- | --- | --- |
| Background | #F6F9F6 | 全局清爽浅米绿背景 |
| Secondary background | #FFFFFF | 内容卡片、图表容器、展示底板 |
| Primary | #1B4D3E | 主标题、关键分类标头、品牌主基调 |
| Accent | #E87A24 | 核心高亮、算法性能对比核心数据、关键警示 |
| Secondary accent | #2E7D5B | 辅助强调、流程流转线、状态徽章 |
| Body text | #1F2923 | 正文主要文本、高对比度阅读 |
| Secondary text | #5A6B61 | 次要说明、图表注释、边界标签、单位说明 |
| Divider | #DDE5DF | 分割线、卡片边框、表格横线 |

## IV. Typography System

### Font Plan

| Role | Character (Reference) | Primary | English if non-English | Fallback tail |
| --- | --- | --- | --- | --- |
| Title | Bold, Sans-serif | Microsoft YaHei | Segoe UI | sans-serif |
| Body | Regular, Clean | Microsoft YaHei | Segoe UI | sans-serif |
| Code | Monospace | Consolas | Courier New | monospace |

- **Title stack**: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif
- **Body stack**: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif
- **Code stack**: "Consolas", "Courier New", monospace

### Font Size Hierarchy

| Purpose | Anchor Size (px) |
| --- | ---: |
| Title | 32 |
| Subtitle | 20 |
| Body | 16 |
| Annotation | 12 |

## V. Layout Principles

### Deck-wide Direction

- **Hierarchy direction**: 从上至下（标题栏 → 结构化内容区 → 底部边界说明），左右两栏或三卡并列
- **Composition tendency**: 采用规整工程卡片式布局，左侧核心论点/数据、右侧真实配图与架构图相互印证
- **Cross-page continuity**: 顶部统一导航指示条与小标，底部统一标注事实时态与边界信息
- **Spacing posture**: 呼吸感与信息密度均衡（balanced presentation）
- **Spacing anchors**: 页面边距 60px/40px，卡片间距 20px，栏间距 24px，圆角 12px，行高 1.5

## VI. Icon Usage Specification

- **Primary bundled library**: tabler-outline
- **Stroke Width**: 2

| Icon Path | Suitable Scenarios |
| --- | --- |

## VIII. Image Resource List

| Filename | Dimensions | Ratio | Purpose | Type | Image pattern | Crop Policy | Acquire Via | Status | Reference | text_policy | page_role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| screenshot-home.png | 728x1572 | 0.46 | 首页与新装方案展示 | Screenshot | 移动端界面原型展示 | no-crop | user | Ready | 本地模拟器截图 | verbatim | main_visual |
| screenshot-menu.png | 728x1572 | 0.46 | 12窗口166菜品覆盖展示 | Screenshot | 移动端界面原型展示 | no-crop | user | Ready | 本地模拟器截图 | verbatim | supporting |
| screenshot-recommend-algo.png | 728x1572 | 0.46 | 三算法推荐方式切换页面 | Screenshot | 移动端界面原型展示 | no-crop | user | Ready | 本地模拟器截图 | verbatim | supporting |
| screenshot-selfpick.png | 728x1572 | 0.46 | 麻辣烫自选与估算营养展示 | Screenshot | 移动端界面原型展示 | no-crop | user | Ready | 本地模拟器截图 | verbatim | supporting |
| screenshot-logs.png | 728x1572 | 0.46 | 确认就餐与就餐记录页 | Screenshot | 移动端界面原型展示 | no-crop | user | Ready | 本地模拟器截图 | verbatim | supporting |
| algo-comparison.png | 3840x2160 | 1.78 | 贪心/DP/BnB算法机制全面对照 | Architecture | 宽幅架构机制矢量大图 | no-crop | user | Ready | Archify高质量渲染 | verbatim | hero_visual |
| canteen-architecture.png | 3840x2160 | 1.78 | 小程序+JS/WASM+C++系统架构 | Architecture | 宽幅系统架构矢量大图 | no-crop | user | Ready | 系统架构渲染图 | verbatim | hero_visual |

## IX. Content Outline

### Part 1: 项目背景与系统闭环

#### Slide 01 - 为什么做天科食客：食堂就餐优化闭环

- **Audience move**: 了解项目出发点，建立“在校园食堂将吃什么、花多少、吃过什么闭环连接”的核心认知。
- **Relationships**: 痛点需求（多窗口高分散、营养失衡）与系统目标（个性化智能推荐、计划与记录分离）为因果映射关系。
- **Title**: 为什么做《天科食客》：面向真实校园食堂的就餐优化系统
- **Core message**: 在预算、窗口时段和个人目标约束下辅助就餐决策，严格区分“计划建议”与“真实进食记账”。
- **Content**: 
  - 核心痛点：校园食堂选餐纠结、预算难控、营养难平衡；已有工具缺乏真实食堂菜单与闭环记账。
  - 产品使命：连接校园真实菜单、多维营养模型与三套约束优化算法，提供简易/完整双层体验。
  - 真实菜单落地：基于西区西一食堂真实采集与转录数据（12窗口、166实体、137报价），非玩具测试集。
- **Images**: screenshot-home.png

#### Slide 02 - 四步完整产品闭环与功能演示

- **Audience move**: 看清系统真实交互链路，体会“计划并非已吃、确认才记账、月历可回看”的设计严谨性。
- **Relationships**: 设定目标 → 推荐/自选 → 确认就餐 → 月历回看四步时序关系。
- **Title**: 四步完整产品使用闭环与业务流程
- **Core message**: 计划不是已吃，自选草稿不直接入库；确认就餐后方记入账本，支持月历当月追溯。
- **Content**:
  - 第一步：设定个人档案与单餐预算（自动计算能量/蛋白质/脂肪/碳水参考范围）。
  - 第二步：查看推荐方案（支持三算法切换）或灵活自选（如麻辣烫称重与单品搭配）。
  - 第三步：就餐确认（状态从未吃计划转为已吃记录，触发剩余餐次动态更新）。
  - 第四步：月历与历史回看（支持62日时间桶平滑回看，数据本地加密保护）。
- **Images**: screenshot-selfpick.png, screenshot-logs.png

#### Slide 03 - 真实食堂菜单覆盖与统一规划建模

- **Audience move**: 理解真实菜单的多样性与复杂约束，建立对多维规划数学模型的认识。
- **Relationships**: 12窗口/166菜品与全天3餐规划为组合约束关系；价格/营养为多目标权重关系。
- **Title**: 真实食堂菜单覆盖与统一约束规划建模
- **Core message**: 真实数据带来组合爆炸，统一规划模型约束餐次、预算、窗口营业时段与营养合理区间。
- **Content**:
  - 菜单规模：已接入西一食堂12个窗口、166个菜品实体、137条有效报价（热干面、煎饼、肠粉、川湘小厨、称重麻辣烫等）。
  - 规划约束维度：单餐预算上限、每日能量下限与推荐区间、三大营养素供能比、时段可用性。
  - 统一目标函数：综合营养偏离惩罚、预算贴近度与菜品搭配多样性评分，供不同算法使用统一打分。
- **Images**: screenshot-menu.png, screenshot-recommend-algo.png

### Part 2: 核心算法与DP等价性能攻关

#### Slide 04 - 三个算法解决同一个三餐规划问题

- **Audience move**: 深入理解贪心、动态规划与分支限界在相同规划模型下的不同搜索策略与适用权衡。
- **Relationships**: 三算法基于相同输入模型；启发式、状态累计、乐观界剪枝为并列对照关系。
- **Title**: 三个算法解决同一个问题：策略分化与工程取舍
- **Core message**: 算法共用约束与打分，但在解空间搜索策略上各有取舍：贪心极速、DP状态复用、BnB剪枝保界。
- **Content**:
  - 贪心法（Greedy）：按局部增益逐步选取代表餐次；速度快（<10ms），属于启发式选择，不保证全局最优。
  - 动态规划（DP）：按餐次累积状态并做精确去重；三餐状态上限32/单双餐20000，截断时承认近似，适合中规模。
  - 分支限界（BnB）：深度优先结合乐观界剪枝；有效减少搜索量，受最大搜索节点数限制，适合紧凑解空间。
- **Images**: algo-comparison.png

#### Slide 05 - 核心等价优化：DP两餐耗时从23.5秒降至71毫秒

- **Audience move**: 见证算法与数据结构等价优化的巨大成效，同时认可未达50ms目标的客观事实。
- **Relationships**: 优化前重复状态扫描与优化后去重哈希表为因果改进关系；PC实测与50ms原目标为对比差距关系。
- **Title**: DP核心等价优化：消除重复扫描与热点突破
- **Core message**: 通过规范化状态键与哈希去重消除冗余扩展，PC中位耗时降至71毫秒，如实面对50ms剩余差距。
- **Content**:
  - 性能瓶颈根因：原两餐DP在大候选空间下（G2）存在大量重复状态扩展与无效扫描，PC耗时高达23,455.864 ms。
  - T04A19优化策略：引入规范方案键（planKey）与哈希去重缓存，完全等价优化，输出摘要100%匹配冻结基线。
  - 实测成果与差距：交付方五次中位70.999ms、P01独立复测86.300ms（降幅>99.6%）；距原50ms指标仍有差距，客观保留事实。
  - 内存占用：峰值562页（约35.13MiB），严格位于768页安全线以内。

### Part 3: 工程落地与客观验证

#### Slide 06 - 跨端工程实现：小程序与C++17共享核心

- **Audience move**: 认可工业级跨端架构，C++核心既驱动原生CLI实验，又通过WASM驱动微信小程序。
- **Relationships**: 微信UI层 → WASM桥接层 → C++核心层自上而下调用关系；CLI与小程序为同源双端验证关系。
- **Title**: 跨端工程实现：微信小程序与C++17共享核心
- **Core message**: 业务与算法分离；同一套现代C++17核心兼顾桌面高性能实验与微信小程序端侧离线计算。
- **Content**:
  - 核心架构三层分工：表示层（微信原生小程、双模式UI）→ 桥接层（JS/WASM ABI胶水）→ 算法核心层（C++17现代核心）。
  - 双端验证一致性：C++核心同时编译为原生CLI可执行文件与WebAssembly模块，确保算法测试集与端侧运行100%同源。
  - 离线安全性：所有计算均在手机端本地完成，无网络依赖，就餐历史与健康数据安全不离端。
- **Images**: canteen-architecture.png

#### Slide 07 - 验证结果、客观事实边界与局限说明

- **Audience move**: 感受答辩团队的诚信与严谨态度，清晰区分模拟器证据、PC实测与真机待测边界。
- **Relationships**: 12/12已测场景与尚未完成的真机/朋友试用为客观并存关系；营养估算与化验检测为边界说明。
- **Title**: 验证矩阵、客观事实边界与局限说明
- **Core message**: 严守事实边界：微信模拟器12/12走查通过；PC性能不代表手机耗时；真机与试用如实标注未完。
- **Content**:
  - 模拟器走查：user-v5候选微信开发者工具12/12场景全通（建档、换算、三算法切换、自选搭配、记账回看）。
  - 性能边界说明：71ms/86ms为PC Node WASM实测，受手机端算力影响，真机微观渲染与耗时仍标“未测”。
  - 营养数据口径：采用中国食物成分表结合菜品配方估算，保留估算标签，不冒充实验室化学化验数据。
  - 状态声明：当前体验候选为user-v5，真机扫码与朋友试用正在推进，生产环境未上线。

#### Slide 08 - 项目总结、工程沉淀与未来展望

- **Audience move**: 形成项目工作扎实、算法硬核、工程规范的整体正面评价，做好进入Q&A环节的准备。
- **Relationships**: 算法设计深度、工程落地严谨度、答辩表达真实性构成三维支撑。
- **Title**: 项目总结、工程沉淀与未来展望
- **Core message**: 从食堂菜单到算法落地，实现高可用工程闭环；保持工科诚实，持续探索增肌与多食堂拓展。
- **Content**:
  - 成果沉淀：完整C++17优化核心库、跨端WASM工具链方案、12窗口真实菜单数据集、微信小程序实用工程范式。
  - 后续演进路线：扩充更多校区食堂菜单、增加增肌与控糖等多目标模式、优化移动端极低功耗离线求解器。
  - 答辩致谢：感谢老师与助教的指导，欢迎各位评委老师批评指正！

## X. Speaker Notes Requirements

- **Generation**: enabled
- **Filename**: match each SVG filename under notes/
- **Content**: preserve verbatim 5~7 分钟答辩口述台词骨架，严格标注时间节奏
- **Total duration**: 330 秒（5.5 分钟）
- **Notes style**: formal, technical, objective
- **Presentation purpose**: 期末评测答辩
