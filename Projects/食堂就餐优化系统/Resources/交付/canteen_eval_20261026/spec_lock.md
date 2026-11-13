<!-- ppt-master-schema: spec-lock/v1 -->
# Execution Lock

## canvas
- viewBox: 0 0 1280 720
- format: PPT 16:9

## communication
- primary_language: zh-CN
- audience: 课程评审老师、助教与答辩答辩组同学
- objective: 系统性汇报天科食客的三算法机制（贪心/DP/BnB）、DP关键等价性能优化、C++/WASM跨端工程架构及小程序真实闭环，展示严谨的工科设计与客观的实测边界
- core_message: 真实食堂环境下的就餐与记账闭环；共享C++核心统一三算法；等价优化攻克DP去重热点（PC从23.46秒降至71毫秒）；事实边界清晰严谨

## mode
- mode: custom
- mode_references: instructional, pyramid
- mode_behavior: 开篇建立校园食堂就餐与记账痛点，形式化建模并展开三算法对比，呈现DP等价优化PC实测硬核证据，展示C++/WASM跨端架构，收口于客观验证边界与答辩展示。

## visual_style
- visual_style: custom
- visual_style_references: swiss-minimal, soft-rounded
- visual_style_behavior: 以深森林绿（#1B4D3E）为主色，薄荷深绿（#2E7D5B）为辅，清爽浅米绿（#F6F9F6）为底，高对比度深墨文本（#1F2923），配合琥珀橙（#E87A24）做算法关键指标与性能拐点高亮。

## colors
- background: #F6F9F6
- secondary_background: #FFFFFF
- primary: #1B4D3E
- accent: #E87A24
- secondary_accent: #2E7D5B
- body_text: #1F2923
- secondary_text: #5A6B61
- divider: #DDE5DF

## typography
- font_family: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif
- title_family: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif
- body_family: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif
- code_family: "Consolas", "Courier New", monospace
- title: 32
- subtitle: 20
- body: 16
- annotation: 12

## icons
- library: tabler-outline
- stroke_width: 2
- inventory: []

## page_rhythm
- P01: anchor
- P02: dense
- P03: breathing
- P04: dense
- P05: dense
- P06: dense
- P07: dense
- P08: anchor

## pptx_structure
- mode: flat

## images
- p01_home: images/screenshot-home.png | source=user | crop=no-crop
- p02_selfpick: images/screenshot-selfpick.png | source=user | crop=no-crop
- p02_logs: images/screenshot-logs.png | source=user | crop=no-crop
- p03_menu: images/screenshot-menu.png | source=user | crop=no-crop
- p03_recommend: images/screenshot-recommend-algo.png | source=user | crop=no-crop
- p04_algo: images/algo-comparison.png | source=user | crop=no-crop
- p06_arch: images/canteen-architecture.png | source=user | crop=no-crop

## forbidden
- `mask`, `<style>`, `class`, external CSS, `<foreignObject>`, `textPath`, `@font-face`, `<animate*>`, `<set>`, `<script>` / event attributes, `<iframe>`
- HTML named entities in text; write typography as raw Unicode and escape XML reserved characters
