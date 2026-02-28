# Copilot / AI Agent Instructions — Navigation

目的：为 AI 编码代理提供最小且可操作的仓库上下文，帮助快速上手并进行修改。

快速启动
- 安装并运行开发服务器：`pnpm install` 然后 `pnpm dev`（Next.js 开发服务器）。
- 云与数据库注意事项：项目面向 Cloudflare Pages 的 D1（通过 `@cloudflare/next-on-pages`）以及 Vercel Postgres。本地需要测试 D1 绑定时请使用 `wrangler pages dev`；本地回退使用 `better-sqlite3`（如可用）。
- 初始化数据库/表：启动后访问 `/api/setup?secret=SETUP_SECRET` 来创建表并生成默认管理员账号。

重要文件（优先阅读）
- 应用根与全局 Provider：[src/app/layout.tsx](src/app/layout.tsx#L1)
- 公共布局：[src/app/(public)/layout.tsx](src/app/(public)/layout.tsx#L1)
- 管理面板布局与侧栏：[src/app/admin/(dashboard)/layout.tsx](src/app/admin/(dashboard)/layout.tsx#L1)
- 中间件（权限守卫）：[src/middleware.ts](src/middleware.ts#L1)
- DB 适配器 / `sql` 模板标记（D1 ↔ SQLite）：[src/lib/db.ts](src/lib/db.ts#L1)
- 鉴权辅助（JWT）：[src/lib/auth.ts](src/lib/auth.ts#L1)
- 服务端会话读取：[src/lib/session.ts](src/lib/session.ts#L1)
- 设置与加密的 R2 配置：[src/lib/settings.ts](src/lib/settings.ts#L1)
- Edge 兼容的 R2 上传（轻量签名实现）：[src/lib/r2.ts](src/lib/r2.ts#L1)
- 客户端 providers：[src/components/providers.tsx](src/components/providers.tsx#L1)
- Next 配置（模块别名与重写）：[next.config.ts](next.config.ts#L1)

高层架构与常见模式
- 框架：Next.js 14（App Router）。默认使用服务端组件（Server Components），需要客户端行为的组件使用 `use client`（参见 `Providers`）。
- 路由：公共页面在 `src/app/(public)`，管理页面在 `src/app/admin`。API 路由在 `src/app/api` 下（注意 `/icons/:path*` 被重写至 `api/icons`）。
- 鉴权：使用 JWT，token 存在名为 `token` 的 cookie 中；`verifyToken`（[src/lib/auth.ts](src/lib/auth.ts#L1)）在中间件中校验以保护 `/admin` 路径。登录页在 `/admin/login`。
- 数据库：所有 DB 操作应使用 `sql` 模板标签（[src/lib/db.ts](src/lib/db.ts#L1)），该函数在运行时自动识别 D1（Cloudflare）或本地 SQLite（better-sqlite3）并返回 `{ rows, rowCount }`。
- Edge 与 Node 的边界：中间件和 R2 上传器等运行在 Edge Runtime。避免在 Edge 路径中引用 Node 专用模块（例如 `better-sqlite3`、`fs`、原生 Node 加密实现等）。仓库通过 [next.config.ts](next.config.ts#L1) 将 `better-sqlite3`、`sharp`、`cheerio` 别名到 `empty-module.js`，避免被打包进 Edge Worker。
- 密钥与加密：R2 等敏感配置在 `src/lib/settings.ts` 中使用 Web Crypto 加密存储。常见环境变量：`JWT_SECRET`、`SETUP_SECRET`、`SETTINGS_ENC_KEY` / `AUTH_SECRET`。

项目约定
- 所有数据库交互使用 `sql` 模板标记，避免直接创建数据库连接对象。
- Token cookie 名：`token`（`middleware.ts` 和 `getSession()` 依赖该名称）。
- 管理路由保护：`/admin` 下的路径由 `middleware.ts` 守护（`/admin/login` 为例外）。修改鉴权逻辑请优先检查并更新 `middleware.ts`。
- 图标路由：静态路径 `/icons/:path*` 被重写到 `/api/icons/:path*`（见 `next.config.ts`），新增图标相关端点时请确保兼容该重写规则。
- R2：项目使用内置的签名实现（[src/lib/r2.ts](src/lib/r2.ts#L1)），在 Edge 环境优先使用该实现以避免引入 Node-only SDK。

开发与构建工作流
- 本地开发（推荐）：
```bash
pnpm install
pnpm dev
```
当需要 D1 绑定时，请使用：
```bash
wrangler pages dev
```
- Cloudflare Pages 发布：仓库包含 `@cloudflare/next-on-pages`，可使用 `pages:build` 脚本为 Pages 打包（见 `package.json`）。
- 静态检查：`pnpm lint`。

修改 Edge/服务端代码前需检查
- 若代码可能在 Edge 运行，确保不导入 Node-only 模块（`better-sqlite3`、`fs`、Node 原生 crypto 等）；优先复用 `src/lib/db.ts`、`src/lib/r2.ts` 等工具函数。
- 若引入数据库/表结构变更，请同时更新 `api/setup` 的初始化逻辑（参见 `src/lib/api-handlers/setup.ts`），保证部署/开发环境的迁移路径。

调试提示
- DB 回退的日志：`src/lib/db.ts` 在 D1 与 SQLite 切换时会打印告警，遇到数据不一致或无法连接时请检查运行方式（`wrangler pages dev` vs `pnpm dev`）。
- 未找到 D1 绑定的错误：若抛出 "D1 Database binding not found"，说明当前运行环境缺少 D1 绑定，请使用 `wrangler pages dev` 或切换到本地 SQLite。

更多信息
- 阅读上文列出的关键文件及仓库根目录 `README.md` 以获取环境变量与初始化细节。
- 在提交会影响运行时环境（Edge vs Node、DB、密钥）的更改时，在 PR 描述中列出受影响文件并说明在 D1 与 SQLite 两种模式下的行为差异。

如有不清楚或需要补充的部分，请指明领域（鉴权、DB、R2、构建或路由），我会按需扩展或修正。

Purpose: give AI coding agents the minimal, actionable context to be productive in this repo.

Quick start
- Install & run dev: `pnpm install` then `pnpm dev` (Next.js dev server).
- Cloud/DB notes: the project targets Cloudflare Pages D1 (via `@cloudflare/next-on-pages`) and Vercel Postgres. To exercise D1 bindings locally use `wrangler pages dev`; local fallback uses `better-sqlite3` if available.
- Initialize DB/tables: visit `/api/setup?secret=SETUP_SECRET` after starting the app to create tables and the default admin user.

Important files to read (examples)
- App root & global providers: [src/app/layout.tsx](src/app/layout.tsx#L1)
- Public layout: [src/app/(public)/layout.tsx](src/app/(public)/layout.tsx#L1)
- Admin layout and sidebar: [src/app/admin/(dashboard)/layout.tsx](src/app/admin/(dashboard)/layout.tsx#L1)
- Middleware (auth guard): [src/middleware.ts](src/middleware.ts#L1)
- DB adapter / `sql` tag (D1 ↔ SQLite): [src/lib/db.ts](src/lib/db.ts#L1)
- Auth helpers (JWT): [src/lib/auth.ts](src/lib/auth.ts#L1)
- Session helper (server-side): [src/lib/session.ts](src/lib/session.ts#L1)
- Settings & encrypted R2 config: [src/lib/settings.ts](src/lib/settings.ts#L1)
- R2 upload helper (Edge-friendly): [src/lib/r2.ts](src/lib/r2.ts#L1)
- Providers (client): [src/components/providers.tsx](src/components/providers.tsx#L1)
- Next config (module aliasing & rewrites): [next.config.ts](next.config.ts#L1)

High-level architecture & patterns
- Framework: Next.js 14 (App Router). Most UI is implemented with server components by default; client components use 'use client' (see `Providers`).
- Routing: public pages under `src/app/(public)`, admin under `src/app/admin`. API routes live in `src/app/api` and `src/app/api/*` (see `api/icons` rewrite).
- Auth model: JWT stored in a cookie named `token`. `verifyToken` in [src/lib/auth.ts](src/lib/auth.ts#L1) is used by `middleware.ts` to protect `/admin` paths. Login lives at `/admin/login`.
- DB access: use the `sql` template tag exported by [src/lib/db.ts](src/lib/db.ts#L1). It auto-detects D1 (Cloudflare) at runtime and falls back to `better-sqlite3` for local development. Query results are returned as `{ rows, rowCount }`.
- Edge vs Node: some code runs in Edge runtime (middleware, R2 upload helper). Avoid using native Node-only modules in Edge code paths. The repo aliases `better-sqlite3`, `sharp`, and `cheerio` to `empty-module.js` in [next.config.ts](next.config.ts#L1) to prevent bundling into Edge workers.
- Secrets & encryption: settings which store R2 credentials are encrypted with Web Crypto (see [src/lib/settings.ts](src/lib/settings.ts#L1)). Environment keys: `JWT_SECRET`, `SETUP_SECRET`, `SETTINGS_ENC_KEY` / `AUTH_SECRET`.

Project-specific conventions
- Use `sql` template tag for all DB interactions (do not instantiate DB connections directly elsewhere).
- Token cookie name: `token` (middleware and `getSession()` rely on this). See [src/middleware.ts](src/middleware.ts#L1) and [src/lib/session.ts](src/lib/session.ts#L1).
- Admin-protected routes: any path under `/admin` is guarded by `middleware.ts` (except `/admin/login`). If updating auth behavior, update `middleware.ts` first.
- Icons: served via a rewrite `/icons/:path* -> /api/icons/:path*` (see [next.config.ts](next.config.ts#L1)). If adding icon endpoints, keep this rewrite in mind.
- R2 usage: project uses a small signature implementation in [src/lib/r2.ts](src/lib/r2.ts#L1) — prefer it for Edge-compatible uploads instead of Node-only SDKs.

Dev & build workflows
- Local dev (recommended): `pnpm dev` — uses Next dev server. If D1 bindings are required, use `wrangler pages dev` which supplies `getRequestContext()` D1 bindings.
- Production build for Cloudflare Pages: repo includes `@cloudflare/next-on-pages`; use the provided `pages:build` npm script where appropriate.
- Lint: `pnpm lint`.

What to check before changing server/Edge code
- If code may run in Edge, ensure it does not import native Node modules (`better-sqlite3`, `fs`, native `crypto` patterns that Node-only). Prefer the project's existing helpers (`src/lib/db.ts`, `src/lib/r2.ts`).
- If adding DB schema changes, update the `api/setup` logic (search `src/lib/api-handlers/setup.ts`) and migration path — initializing tables relies on `/api/setup` currently.

Debugging tips
- DB fallback logs: [src/lib/db.ts](src/lib/db.ts#L1) logs when it switches between D1 and SQLite; watch console output for switching warnings.
- Missing D1 binding error: the DB helper throws a clear error recommending `wrangler pages dev` when no D1 binding is found.

If you need more context
- Read the files listed above and the top-level `README.md` for setup environment variable names and initialization instructions.
- When proposing changes that affect runtime (Edge vs Node, DB, or secrets), include the exact files changed and an explanation of how the change behaves under both D1 and SQLite modes.

If anything here is unclear or missing, tell me which area (auth, DB, R2, builds, or routes) and I'll expand or correct this file.
