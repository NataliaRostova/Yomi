# Yomi 03 · 增量迭代与验收报告

本轮直接修改原有 JavaScript 用户脚本，继续使用 kuromoji/IPADIC、fflate、esbuild 和现有界面实现。没有重建项目或引入框架。安装产物为 `dist/yomi-reader.user.js`，版本 3.0.0。

最终验证：**20 项模块测试通过，22 组实际浏览器验收通过，无未捕获浏览器异常**。测试浏览器为 Edge 152.0.4191.66。机器可读汇总见 [summary.json](iteration-3/summary.json)。安装 bundle 与演示 bundle 的 SHA-256 相同。

## 1. 根因与对应修复

| 原有路径／问题 | 根因 | 本轮修复 |
| --- | --- | --- |
| 未知片假名 Hover 后正文出现长解释 | `validateEntry` 接受任意 `original`，截到 120 字符仍非词源校验；`activate → applyOriginal → renderPiece` 直接写入 ruby | 独立 `annotation.js` 信任边界；只接受结构化 `sourceWord`、≥0.9 的可信度和明确的 `borrowed` 类型；旧式自由字符串不进入正文 |
| 批量词源补全也可能污染正文 | `AIClient.originals` 接受任意 ≤120 字符字符串 | 批量也必须返回相同结构并经过同一校验 |
| ruby 撑宽、改变行高 | 原生 ruby/rt 参与行内布局 | ruby 保留原文，rt 绝对定位、不换行、限宽裁切；长解释不生成正文节点；行高小于字号 1.5 倍或无法可靠测量时省略注音 |
| Hover 回填短词源后丢失当前对象 | 整个 wrapper 的子节点被重建，原 Range 失效 | 异步补全只追加或更新脱离排版流的 rt，不替换原文字节点 |
| 语法只响应内部汉字 | 无 grammar parser，只有词典 token | 14 条完整 grammar pattern 先匹配；接续检查后以整个范围建立查询对象，优先于普通词汇 |
| 复合片假名拆开 | 混排句中的 IPADIC token 被逐个使用 | 识别连续片假名表达，跨行内标签保留原始偏移；本地复合词按有词典证据的最长匹配排序 |
| 资料卡遮住下一词 | 原来紧贴目标右侧 | 优先靠视口右侧停靠；目标靠右时换到其左；不改变网页宽度 |
| 词卡有结果但正文无视觉关联 | 无独立 hovered/active 对象 | 使用原 DOM 的 Range 建立全对象高亮；进入卡片后 active 保留 |
| 旧请求浪费资源、存在结果争用 | 主要依赖 request id 丢弃响应 | 增加 AbortController、GM abort 桥接和订阅者去重；保留 request id 与页面 generation 双重保护 |
| 活用词保存后重复 | 表面读音随活用改变 | 分开表面读音和辞书形读音；Library 按原形、原形读音、类型去重 |

没有通过缩小长释义字号来掩盖问题。注音与释义从数据结构到渲染入口均分离。格式校验不能证明模型的词源判断真实，因此 AI 词源仍标记为推断；无法确认时正文留空。

## 2. 词汇、外来语与语法识别

保留原有独立鼠标文本提取、NFKC 原文偏移映射、IPADIC 活用还原、英文屈折形式和已收录短语动词。新增辞书形读音缓存；保存 `食べました` 时归于 `食べる / たべる`，不会以 `たべました` 创建另一个读音身份。

补充 `金融政策`、`個人消費`、`踏まえる`、`考慮する`、`株価` 等基础词条，以及 `エージェント`、`データセンター`、`クラウドコンピューティング`、`データベース`、`インフレ` 的已知来源。德语、荷兰语、葡萄牙语原词采用明确的本地字段；`code / cord` 一类歧义来源不放入注音。

本轮 grammar 核心：`ものの`、`とはいえ`、`にもかかわらず`、`にとどまらず`、`ざるを得ない`、`にほかならない`、`かねない`、`に至るまで`、`にあたって`、`を踏まえて`、`ことから`、`わけではない`、`に即して`、`を余儀なくされる`。

- `を踏まえ / を踏まえて / を踏まえた` 归到同一 pattern；普通动词 `踏まえる` 保留为词汇。
- 支持 `に当たって`、`に留まらず` 和部分被动活用变体。
- `ざるを得ない` 检查未然形，`かねない` 检查连用形；`ものの / ことから / わけではない` 检查前接结构，避免仅按高歧义名词触发。
- 不把任意较长字符串当作可靠词条；未命中仍有词卡、AI、调整范围和划词入口。
- 注音分析或 grammar 检查异常时局部回退，不能让普通查询入口消失。

语法中文说明为项目人工整理。N1/N2 是学习参考标签，不声称来自官方考试词表。`ものの` 的接续与转折解释核对了国际交流基金的[教材说明](https://www.kyozai.jpf.go.jp/kyozai/material/BMA00058/ja/render.do)和[逆接说明](https://www.jpf.go.jp/j/project/japanese/teach/tsushin/grammar/201703.html)；这些资料不代表全部规则的全面语言学验证。

## 3. 正文与资料面板

正文 wrapper 只承载原文字、短注音和语法细下划线。跨链接、加粗等行内标签时按 Text 片段包装，不重建 paragraph.innerHTML，不移除原链接与事件。复制时去掉带脚本标识的注音，包括从 wrapper 内开始的部分选区。

Hover 与 Active 用两组 CSS Custom Highlights，Range 可跨多个原 Text 片段；不支持该 API 时回退到不接收指针事件的固定矩形层。高亮只用淡背景和细下划线，不改变字重、字号或行高。wrapper 的颜色类过渡为 140ms；Range 高亮即时更新，避免为了动画重新包裹正文。

面板使用 fixed overlay：首次开启 220ms 减速滑入，关闭 180ms；边缘可用空间不足时缩短位移，防止动画短暂越界。已打开时保持停靠坐标，换词仅内容淡入 110ms；加载、成功、无结果和错误复用同一个面板。内容变高时仅做视口内必要的钳位。移入面板保留 active，点击空白、Esc、关闭或换词时清除/替换。固定按钮冻结当前词卡。

遵循 `prefers-reduced-motion`。动画不修改网页 body 宽度。窄屏资料面板会覆盖部分正文，这是 overlay 的边界；可关闭或固定后滚动阅读，没有推挤正文来腾出侧栏。

本轮沿用本地 `RhineLabUI-main` 的低饱和纸色／石墨色、细分隔线、小型等宽标签、较大的释义层级与克制动效。没有观看到 Bilibili 视频，不声称参考了视频中的具体细节。参考目录没有修改。

## 4. 异步与缓存

- 本地/Library 命中约 25ms 开卡；未知词默认等待 250ms，用户可调 150–700ms。
- 同一 AI 配置、词、原形、上下文共享在途任务，最多 2 个实际 AI 请求；每个订阅者可独立取消，最后一个订阅者离开才中断网络。
- 指针换词先递增 request id 并取消旧查询；响应还需满足当前记录与页面 generation，才能更新卡片。
- AI 缓存键包含 endpoint、model 与上下文。基础词条用有界 LRU；Library 通过内存索引优先提供已收录资料。
- Library 中保存的释义可能来自以前的语境，来源标明 Library；它不等于重新确认了当前句子的词义。
- 默认不向 AI 发上下文。开启相应设置才附带最多 240 字符；批量词源补全仍为单独、默认关闭的开关。

## 5. Library 与持久化

有效词卡可一键收录；已收录卡显示首次日期、遇见次数、复习次数、学习状态和下次时间。统一资料库支持全部、词汇、语法、N1、N2、外来语、英语、自定义、待复习和已掌握筛选；搜索原文、读音、中文、英文、词源、标签、备注和已保存原句。列表每页 40 条；上下文按需每批 10 条。支持释义、解释、备注、标签、分类、学习状态编辑以及自定义收录。

类型与标签分离。分类编辑保留最初的识别身份，不会因用户把一个条目归为自定义而丢掉与网页表达的关联。没有自动合并不同语法核心；`ことから` 不会与 `ことになる` 合并。

安装版复用 GM 存储，供同一用户脚本匹配的各网站共用。普通网站 IndexedDB 按 origin 隔离，不能直接充当跨网站统一库，因此仅演示 shim 用 IndexedDB 实现相同异步存储接口。实现依据为 [Tampermonkey 存储 API](https://www.tampermonkey.net/documentation.php?locale=en&q=GM_values)。

存储布局：

```text
yomi:library:v1:index:0..63              启动时加载的资料索引分片
yomi:library:v1:item:<id>                单条规范资料，可用于重建索引
yomi:library:v1:contexts:<id>:<page>     每页 50 条上下文
yomi:library:v1:reviews:<id>:<page>      每页 50 条正式复习记录
yomi:library:v1:changed                 跨页失效通知
yomi:library:v1:lock:<page-id>           写操作协调租约，正常结束删除
```

正文 token 不单独查数据库。启动只读取 64 个索引分片；之后查词使用内存 Map 与别名索引，更新单个条目时只更新相关内存索引。全文检索文本在索引中保留，因此内存随资料与原句数量增长。上下文和 review body 不在启动时加载。

同页写操作排队，不同页面通过 ticket 顺序租约协调，避免同时覆盖同一分页记录。GM API 不提供真正的多键事务；规范条目先于索引写入，异常后可以从规范条目重建索引。页面被突然终止时租约会过期。极端崩溃、管理器实现差异与写入过程中关机不等同于经过数据库事务级验证。

自然遇见仅在已经收录的表达实际打开查询时记录。同一页面会话中相同 URL（忽略 hash）、句子与原形只计一次；新的页面会话可再次计数。它不是眼动追踪，也不会把所有扫描过的正文自动当作已阅读。自然遇见不改变 reviewCount。

## 6. 数据模型

```js
LearningItem = {
  id, schemaVersion: 1,
  type, recognizedType, // vocabulary | grammar | loanword | english | custom
  expression, normalizedExpression, reading,
  sourceWord, sourceWordConfidence, meaningZh, meaningEn,
  jlptLevel, partOfSpeech, explanation, usage,
  grammarPattern, grammarConnection, example, translation, source,
  tags: [], notes, createdAt, updatedAt,
  encounterCount, lastEncounteredAt, contextCount, contextSearch, searchText,
  state, // new | learning | reviewing | mastered | suspended
  reviewCount, correctCount, incorrectCount, lapseCount,
  lastReviewedAt, nextReviewAt, currentInterval, // 间隔单位为天，允许小数
  easeFactor, memoryStrength,
  scheduler: { algorithm: 'yomi-adaptive', version: 1, fsrs: null }
};
Context = {
  sentence, previousSentence, nextSentence, surface,
  pageTitle, url, domain, encounteredAt
};
ReviewRecord = {
  id, itemId, reviewedAt, grade,
  quiz: { mode, prompt, selected, correct, contextSource },
  before: { state, interval, easeFactor },
  after: { state, interval, easeFactor, nextReviewAt }, scheduler
};
```

contexts / ReviewRecords 单独分页，不把大数组塞进每条 LearningItem。当前句最多 1200 字符，前后句各最多 600；窗口边缘或无可访问前后文时留空。可读取相邻正文节点补足跨段落的前后句，跳过注音、控件和隐藏内容。

## 7. SRS

调度集中于 `scheduler.js`，不依赖 UI。新收录立即到期；每批先取正式到期项目，再加入最多 20 个新项目。第一次一般为 1 天，下一次一般为 3 天；其后依据当前间隔与 easeFactor 动态扩展。忘记回到 10 分钟并进入 learning；困难约 ×1.3；一般 ×2–2.5；简单 ×3–4。较长期且完成足够次数的项目可进入 mastered，暂停项目不入队。

按钮预览实际下一间隔。每次评分保存新状态和独立 ReviewRecord；重复提交已经推迟到未来的同一项会被拒绝。`correctCount/incorrectCount` 基于用户四级自评；语法选择的实际选项另存 quiz.selected/correct，二者不混淆。

五种题型：正向、反向、原句挖空、语法选择、语境理解。有真实保存句时优先使用。语法选择以恢复原句中的表达为目标，干扰项来自本地 grammar 表，并不承诺所有句子的其他选项在语言学上绝对不成立。缺少适用句子时提示并回退正向题。

这不是 FSRS，也不声称 memoryStrength 是校准过的遗忘概率。schema 与每条 review 的算法版本字段为以后接 FSRS 保留了迁移位置。

## 8. 文件清单

新增：`src/annotation.js`、`src/grammar.js`、`src/highlight.js`、`src/learning.js`、`src/storage-lock.js`、`src/learning-ui.js`、`src/quiz.js`、`src/scheduler.js`、`demo/learning.html`、`tests/learning.test.mjs`、`tests/iteration3-browser.mjs`、本报告及 `verification/iteration-3/` 截图和结果。

修改：`src/core.js`、`src/lexicon.js`、`src/text-engine.js`、`src/main.js`、`src/network.js`、`src/ui.js`、`src/ui-styles.js`、`demo/bridge.js`、`scripts/build.mjs`、`package.json`、`README.md`、旧浏览器回归测试。重新构建 `dist/yomi-reader.user.js`、许可文件和 `demo/yomi-reader.js`。

旧测试的更新只适配本轮有意变化：等待 Esc 退场动画、提供结构化词源 mock、新截图输出目录；旧的词形、查询、DOM、复制和网络断言保留。

## 9. 可复现验收

安装依赖后运行：

```sh
pnpm build
pnpm test
pnpm test:browser
pnpm test:learning
pnpm demo
```

打开 `http://127.0.0.1:4173/learning.html`。页面加载与安装版相同的生产 bundle，是真实界面，不是静态词卡演示。`verification.html` 保留旧兼容性用例。

1. Hover `ものの`，移入右侧卡片，再 Hover `個人消費`：检查整段 active 与不重复滑入。
2. Hover `ざるを得ない` 的头、中、尾，以及链接拆开的同一结构，检查完整 grammar 对象与链接仍可点击。
3. Hover `データセンター` 与拆开的片假名；未知片假名在未配置 AI 时应显示无结果与补救入口。
4. 收录 `踏まえる`、`ざるを得ない` 和 `ものの`，打开 Library；搜索 `consider`，编辑标签，刷新查看。
5. 点击演示页“在另一页面再次遇见”，再次查询 `踏まえる`，应只增加遇见计数。
6. Review 选择挖空，显示答案，按“一般”；检查下次时间、reviewCount 和已保存真实句。
7. 切换深浅色、缩放、窄屏与减少动态效果。
8. `test:learning` 注入超长返回、低可信度、延迟和网络/存储错误，自动验证正文矩形、active Range 与持久化记录。

实际结果以 `iteration-3/results.json`、`regression-v3/results.json` 和测试进程输出为准。本轮使用真实 IPADIC 与实际 Edge 无头浏览器，演示持久层为真实 IndexedDB。AI 成功/失败/长返回均为模拟网络传输，没有验证付费 AI 服务或使用用户密钥。用户脚本管理器中的真实跨域 GM 安装仍需在目标浏览器验收；跨页写协调已在共享存储适配器中做并发测试。

已验证的核心范围：初始注音与超长返回后段落 x/y/width/height 不变；14 条 grammar 正例的每个字符均返回完整范围；低可信来源不注音；动态节点与跨行内结构；active 留存与开卡次数；异步过时结果与网络/存储失败隔离；收录、刷新、第二页面遇见与 SRS 记录；80/100/125/175% CSS 布局缩放、390px 窄屏和 reduced-motion。

规模测试在内存存储适配器中构造 10,000 条 LearningItem、50,000 条 context、100,000 条 ReviewRecord：初始化为 64 次索引读取，随后 10,000 次查词没有额外持久层读取，上下文一页按需读取一次。这是数据访问模式测试，不是 10 万条数据在真实脚本管理器中的耗时或 60FPS 基准。

## 10. 真实运行截图

| 场景 | 文件 |
| --- | --- |
| 完整 grammar 与正文 active | [grammar-card-light.png](iteration-3/grammar-card-light.png) |
| 深色词卡 | [grammar-card-dark.png](iteration-3/grammar-card-dark.png) |
| 设置面板 | [settings-dark.png](iteration-3/settings-dark.png) |
| 加载状态 | [loading.png](iteration-3/loading.png) |
| 超长返回限制在右侧 | [long-response-contained.png](iteration-3/long-response-contained.png) |
| 网络失败 | [network-error.png](iteration-3/network-error.png) |
| 收录后的词卡 | [collected-word.png](iteration-3/collected-word.png) |
| Library | [library.png](iteration-3/library.png) |
| 编辑与真实上下文 | [library-detail.png](iteration-3/library-detail.png) |
| Review 概览 | [review-dashboard.png](iteration-3/review-dashboard.png) |
| 真实原句挖空与评分 | [review-cloze.png](iteration-3/review-cloze.png) |
| 窄屏 Library | [library-mobile.png](iteration-3/library-mobile.png) |

已有的旧版截图仍可查看：[初版词卡](before-desktop.png)、[第二轮同页词卡](after-desktop-same-page.png)。本轮阅读测试页内容不同，不将它们当作同条件布局测量；布局验证使用同一真实 DOM 的前后矩形断言。

## 11. 已知限制与后续建议

- **查询入口覆盖**：已覆盖测试中的普通日英正文、未注音词、生词、动态和行内拆分文本；图片、canvas、PDF/特殊阅读器、浏览器内部页面、iframe 和页面 Shadow DOM 不在支持范围。非常规 transform、竖排、溢出裁切等仍需针对站点测试。
- **词典命中率**：内置中文词典仍是常用词起步库，IPADIC 的大词典负责日语形态分析，并不等于全面中文释义库。未知项会明确显示未命中。没有测定“所有互联网词汇”的命中率。
- **分析准确性**：14 条 grammar 是有限接续规则，不是完整句法/语义系统；歧义、否定、引用、方言和未覆盖活用可能误判或漏判。片假名连续串也可能是专名或临时组合。AI 置信度是模型自报，不是真实概率保证。
- 严格行高下主动省略注音；跨很多节点时同一注音可能只在起始片段显示。页面框架更新已包装节点时，可能需要重新扫描。自动注音的原有 30,000 片段 / 5,000 字符单节点上限仍保留，查询不依赖该上限。
- 仅验证了 CSS 布局缩放，未把它宣称为浏览器工具栏缩放的完整矩阵。高亮降级层、Firefox、竖排与真实 Tampermonkey 多站点需扩大实机验证。
- Library 不提供云同步或独立导入导出。数据保存在浏览器/脚本管理器，删除其数据会一并清除学习记录。资料和检索文本随规模增长，已有访问模式验证不等于完成长期压力与崩溃恢复测试。
- 下一阶段优先：带许可的更大中文词典与语料评估、语法歧义回归集、真实管理器多站点和 Firefox 测试、可验证备份/迁移，再接 FSRS。避免在没有评估集的情况下宣称“所有词都能正确识别”。
