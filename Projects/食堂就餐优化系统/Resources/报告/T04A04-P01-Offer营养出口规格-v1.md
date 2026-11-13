# T04A04｜Offer营养只读出口规格

P01，2026-10-22。供P04编写单项实现提示词。反重力Gemini 3.8实现，主执行员写核心，最多两名同模型子代理分别核对快照案例和原生/WASM一致性；不使用sol做此类常规导出接合。

## 问题与完成标准

自选菜需要每份Offer的最终营养快照，现有核心只提供目标、菜单校验和推荐入口。新增一个直接只读出口，复用`ParseCatalog`、`ValidateCatalogSemantics`、`OfferNutrition`等已有处理，不在前端复制份量缩放、override、套餐求和和舍入。交付可调用的原生/WASM隔离候选、接口扩展文档和少量区分度明确的结果。

输入核心基线为A03反馈输出；已接收的`planner.cpp` SHA256为`417E753207D49700DFE8FE0AD7B010BA178E953E72ED4743FE33149E76582AC0`。本项不需要改变求解器或排序。项目根`D:\项目\cpp\Projects\食堂就餐优化系统`。

## 确定接口

- 新增C ABI `mp_offer_nutrition(const char* input, uint32_t length)`；复用现有`BuildResultBlock`/`RunContractEntry`和8字节结果块、`mp_alloc/mp_free`生命周期。现有三个入口及内存协议保持可用；不增加第二种包络。
- 请求：`{contractVersion:"1.0", catalog:MenuCatalog, meal:"breakfast"|"lunch"|"dinner", offerIds:string[]}`。`offerIds`非空、唯一；只查单份售卖Offer，不传quantity、不调用推荐。
- 核心按既有方式校验目录及catalogHash，解析实际报价，包括规则套餐展开报价。按请求顺序返回；请求ID必须与本餐真实可售报价对应。展开ID可能含`#`/`+`且长于普通稳定ID，应使用现有实际报价查找语义，不套普通64字符ID校验。查不到的ID按现有非法输入错误处理，整次不产生半份成功结果。
- 业务结果`{menuVersion,catalogHash,meal,offers:[{offerId,dishId,windowId,portionCode,nutrition:{energyKcal,proteinDg,fatDg,carbDg},nutritionComplete,estimated}]}`，外层为现有ResultEnvelope。四个数值各自可为null；保留已知零与部分未知。单位沿用整数kcal和dg，`nutritionComplete`由四项完整性决定，`estimated`沿现有核心来源传播。
- 结果是一份Offer的营养，半份缩放、override、固定/规则套餐求和都由已有核心函数完成。不要另写同义算法，不用目标值或推荐结果代替菜单营养；价格不属于这个接口的计算内容。
- 正式扩展文档保存`Resources\契约\Offer营养只读出口扩展-v1.md`，记录新增能力及请求/成功/错误示例；不改冻结T01文件。新能力通过新导出名称识别，旧入口语义和现有版本/内存协议不变。

## 实现范围与验证

允许核心catalog/API/contract声明、原生CLI新增`offer-nutrition`操作及必要构建导出配置。只修改这个直接调用链，减少防御性编程：复用入口校验，内部不反复检查已验证目录，不引入通用适配框架、前端备用公式或复杂兼容分支。错误沿现有机制返回，分配失败照原协议处理。

隔离构建原生CLI和WASM；用少量明确案例覆盖整/半份、override、固定/规则套餐、已知零/部分未知及错误ID，并核对新入口原生/WASM结果一致。原有入口做必要冒烟即可，不重跑整套算法矩阵或性能实验。不安装工具，不改DSH的`miniprogram`或`tools/miniprogram`，不替换当前小程序WASM，不编造真实菜单。

唯一反馈：`Resources\报告\T04A04-反重力-Offer营养只读出口-交付反馈-v1.md`，证据目录同级`T04A04-反重力-Offer营养只读出口-证据-v1\`。隔离构建置于本卡证据目录或工具支持的专属构建目录，记录实际路径/哈希及调用示例。主执行员汇总子代理独立输出；完成后停止，前端读取和正式替换WASM由P01另派。
