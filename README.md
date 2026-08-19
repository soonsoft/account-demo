# account-demo

金融账户域的 agent demo：自然语言查客户/账户，agent 自主调用工具、按引用渲染表格/表单，支持把成功查询录成 shortcut 一键零 LLM 回放。完整展示 [agent-lite](https://github.com/soonsoft/agent-lite) 的浏览器侧架构。

```
浏览器（React+Vite，:5173）
 ├─ 左栏导航：对话 / Shortcuts 列表
 ├─ 中栏：聊天时间线（内联渲染表格/表单）｜ shortcut 详情（meta + 回放输出）
 └─ 右栏步骤面板：tool_call/tool_result/phase/重试，按交互分组折叠
        │ runSession（browser-portable core，浏览器内跑 agent loop）
        ▼ ProxyLLMClient → llm-gateway(:3000) → glm-5.2（智谱 Anthropic 兼容端点）
```

## 跑起来

```bash
# 1. 起 gateway（配好 .env：LLM_PROVIDER=anthropic, LLM_MODEL=glm-5.2, BASE_URL 带 /v1）
cd llm-gateway && npm start
# 2. 起 web
cd account-demo && npm run dev      # http://localhost:5173
npm test                            # 28 tests
npm run typecheck && npm run typecheck:web
```

CLI 版（不开浏览器）：`npm start "查 Alice Chen 的账户"` / `--repl` / `--scenario list`。

## 工具面（fixture 数据上的领域工具）

- **query**：`query_parties`（KYC/风险/类型/PEP/姓名筛选）、`query_party_details`（单客户详情）、`query_accounts`、`query_account_details`（含联名持有人/卡）
- **render**：`render_table`（引用 + orderBy/limit 选行）、`render_detail`（单对象表单）
- **control**：`finalize_data`（进渲染阶段）

数据是手写 fixture（6 客户/5 账户/联名/卡，脱敏只有 last4），改 `src/data/fixture.json` 即可换数据。

## Shortcut

对话成功后「💾 存为 shortcut」→ IndexedDB 持久 → 左栏点击回放：跳过 LLM 按录制的工具序列重查 live 数据并渲染（步骤面板可见「⚡ 回放，零 LLM」组——无 LLM 轮次、直出 tool 调用）。

## 结构

```
src/            browser-portable core（CLI 与 web 共用，零 Node API）
  agent.ts        runSession（多轮 messages 累积）
  message-accumulator.ts  llm/tool 包装重建完整对话（含 abort 悬空补齐）
  tools/ query.ts render.ts · data/ fixture+store · prompt.ts · scenarios.ts
  cli.ts          Node CLI（唯一用 Node API 的文件）
web/            React + Vite 前端（App/Nav/ChatView/ShortcutView/StepsPanel…）
```

## 相关

[agent-lite](https://github.com/soonsoft/agent-lite) · [llm-gateway](https://github.com/soonsoft/llm-gateway) · [llm-protocol](https://github.com/soonsoft/llm-protocol)
