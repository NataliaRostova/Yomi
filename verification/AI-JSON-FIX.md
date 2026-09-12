# 3.0.1 · DeepSeek Flash 释义 JSON 故障

用户报告：DeepSeek / `deepseek-flash`，查询每个词均提示“AI 未返回有效 JSON，请确认模型支持此格式”。

## 已确认的代码问题

1. 3.0.0 请求仅提供 `max_tokens: 1200`，没有关闭思考，也没有启用 JSON Output。
2. [DeepSeek 官方思考模式文档](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/)说明，当前模型默认开启思考、默认 high，最终 `content` 与 `reasoning_content` 分开返回。旧脚本对这套默认行为没有适配。
3. 旧解析器只处理纯 JSON 或单独包住全文的代码围栏。模型在 JSON 前后加说明、返回空字符串或输出不完整时，都被报成同一句错误。
4. 旧实现忽略 `finish_reason`，未区分达到生成上限、空答案、拒绝和实际语法错误。官方 API 文档也说明 [`finish_reason=length` 可伴随截断内容](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion)。

这与“每个词都失败”高度吻合，最可能是统一请求参数和响应处理层的问题。没有获取用户那次实际响应，因此不能证明该次一定是截断而非空答案或其他格式问题。没有声称 `deepseek-flash` 不支持 JSON，也没有擅自替换用户模型。

## 修复

- 自动识别 `deepseek-flash` / `deepseek-pro` 及已知 V4 名称，使用原始 HTTP 请求顶层字段：

```json
{
  "thinking": {"type": "disabled"},
  "response_format": {"type": "json_object"},
  "max_tokens": 2048,
  "stream": false
}
```

- 提示词改为一个完整 JSON 对象范例，要求简洁、单个对象及准确字段。JSON 输出配置依据 [DeepSeek JSON Output](https://api-docs.deepseek.com/zh-cn/guides/json_mode/)。
- 识别响应的 `finish_reason`；区分空最终答案、只有思考、截断、拒绝、非 Chat Completions 包装和错误流式响应。
- 可提取说明文字中的唯一完整 JSON 对象，处理 Markdown 围栏、前置的完整思考标签、文本内容块，以及字符串外的尾逗号。
- 不用 eval，不补造缺失的字段或截断内容，不从多个候选对象中随意选取，也不把 reasoning_content 当最终释义。
- 仅格式错误、空答案、明确截断自动重新生成一次。DeepSeek 第二次输出上限 4096；不回传先前的思考内容。认证、网络错误和已取消查询不会因此重试。
- 重试复用原会话的取消信号、并发限制和过时结果保护；失败不写入释义缓存。正文注音仍经过原有的严格短词源校验。
- 设置新增“接口兼容”：自动 / DeepSeek / 通用。中转接口若不接收 DeepSeek 专用字段，可以选“通用”；模型被中转站改名时可明确选 DeepSeek。

## 更新

用 `dist/yomi-reader.user.js` 替换原脚本，版本应为 **3.0.1**，刷新目标网页。保留原 API 地址、密钥、`deepseek-flash` 模型和学习资料。

“接口兼容”默认为自动，新版会自动适配该模型。若只在本地演示页面使用，刷新页面即可加载新 bundle。浏览器中已经打开的外部页面仍需刷新，安装到脚本管理器的旧代码也需要手动替换。

## 验证

- `node --test tests/*.test.mjs`：26 项通过。新增参数构造、说明包裹 JSON、内容块、尾逗号、多个对象拒绝、截断/空答案分类、一次重试上限以及取消不重试等检查。
- `pnpm test:ai`：4 组真实浏览器测试通过，执行实际打包脚本并检查词卡结果、DeepSeek 请求参数、截断补试和通用中转模式。
- 旧浏览器回归结果见 `regression-v3/results.json`。
- 本次使用模拟的 DeepSeek 响应形状，没有用户密钥，没有发起真实账户请求，不能将它视为用户 API 账户的实测恢复。

结果与截图：

- [结果 JSON](ai-response-fix/results.json)
- [实际词卡成功状态](ai-response-fix/success.png)
- [DeepSeek 兼容设置](ai-response-fix/deepseek-settings.png)

修改文件：`src/network.js`、`src/core.js`、`src/main.js`、`src/ui.js`、`scripts/build.mjs`、`package.json`、`tests/core.test.mjs`；新增 `tests/ai-response.test.mjs` 与 `tests/ai-response-browser.mjs`；更新安装与演示 bundle。
