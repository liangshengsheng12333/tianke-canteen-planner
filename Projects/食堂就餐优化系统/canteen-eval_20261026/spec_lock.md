<!-- ppt-master-schema: spec-lock/v1 -->
# Execution Lock

## canvas
- viewBox: 0 0 1920 1080
- format: PPT 16:9

## communication
- primary_language: zh-CN
- audience: 课程答辩评审老师、期末评测考核小组
- objective: 全面展示《天科食客》系统从痛点到C++核心、WASM本地架构与小程序全流程成果，突出时空自由度理论、两餐DP关键优化与实测数据，交代客观边界，顺利通过期末评测
- core_message: 真实食堂痛点出发，C++跨平台算法核心驱动，WASM本地闭环，深度时空自由度控制与客观边界兼备

## mode
- mode: custom
- mode_behavior: 以结构化论证为主线，先亮出核心技术架构与业务闭环，再深入时空自由度与算法控制，最后以实测数据和客观边界作为严密支撑。

## visual_style
- visual_style: custom
- visual_style_behavior: 采用现代工程科技排版，清晰栅格与卡片微边框，留白舒适，层级分明。

## colors
- background: #FAFAFA
- secondary_bg: #F4F4F5
- primary: #2563EB
- accent: #10B981
- secondary_accent: #F59E0B
- body_text: #18181B
- secondary_text: #71717A
- divider: #E4E4E7

## typography
- font_family: Microsoft YaHei, Calibri, sans-serif
- title_family: Microsoft YaHei, Segoe UI, sans-serif
- body_family: Microsoft YaHei, Calibri, sans-serif
- body: 24
- title: 42
- subtitle: 32
- annotation: 18
- code: 14
- caption: 14

## icons
- library: lucide
- inventory: cpu, layout, database, check-circle, arrow-right, external-link, alert-circle, clock

## page_rhythm
- P01: anchor
- P02: breathing
- P03: anchor
- P04: anchor
- P05: dense
- P06: anchor
- P07: dense
- P08: dense
- P09: anchor

## pptx_structure
- mode: flat

## images
- p03_arch: images/T10d-03-CPP与小程序架构-4K-浅色.png | source=user | crop=no-crop
- p04_loop: images/T10d-02-产品使用闭环-4K-浅色.png | source=user | crop=no-crop
- p05_algo: images/T10d-01-三算法机制对照-4K-浅色.png | source=user | crop=no-crop
- p08_shot1: images/01-user-v5-首页-新装方案.png | source=user | crop=no-crop
- p08_shot2: images/02-user-v5-菜单覆盖文案.png | source=user | crop=no-crop
- p08_shot3: images/03-user-v5-推荐方式页.png | source=user | crop=no-crop
- p08_shot4: images/04-user-v5-新增窗口选菜麻辣烫300g.png | source=user | crop=no-crop
- p08_shot5: images/05-user-v5-记录页.png | source=user | crop=no-crop

## forbidden
- `mask`, `<style>`, `class`, external CSS, `<foreignObject>`, `textPath`, `@font-face`, `<animate*>`, `<set>`, `<script>` / event attributes, `<iframe>`
- HTML named entities in text; write typography as raw Unicode and escape XML reserved characters
