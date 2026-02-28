# Cloudflare Pages 部署指南（Navigation）

本指南用于将当前项目发布到 GitHub 并自动部署到 Cloudflare Pages，数据存储采用 Cloudflare D1，静态资源可选绑定 R2。

## 前置准备
- Node.js 18+（建议与本地一致）
- 包管理器：pnpm（推荐）或 npm
- Cloudflare 账号与 Pages 项目权限
- 已在 Cloudflare 创建 D1 数据库与（可选）R2 Bucket

## 本地验证
1. 安装依赖：
   ```bash
   pnpm install
   ```
2. 构建与测试（需 100% 通过）：
   ```bash
   pnpm run build && pnpm run test
   ```

## 推送到 GitHub
1. 初始化并提交变更：
   ```bash
   git add .
   git commit -m "feat: deploy to Cloudflare Pages with D1"
   ```
2. 推送到主分支：
   ```bash
   git push origin main
   ```
3. 打开仓库 Settings → Pages 或在 Cloudflare Dashboard 中导入该仓库以创建 Pages 项目。

## Cloudflare Pages 配置
在 Cloudflare Dashboard → Pages → 项目 → Settings 中进行以下设置：

### Build 配置
- Build command：`pnpm run pages:build`
- Build output directory：默认由 `@cloudflare/next-on-pages` 生成并在 `wrangler.toml` 中配置为 `.vercel/output/static`

### 环境变量（Environment variables）
- `NODE_VERSION`：与本地一致的 Node 版本（例如：`18` 或 `20`）
- `JWT_SECRET`：用于签发与校验管理员登录令牌
- `SETUP_SECRET`：初始化数据库时的保护密钥
- `SETTINGS_ENC_KEY`：应用设置（如 R2 凭据）的加密密钥
- 业务相关 ENV：如 `API_KEY`、`JWT_EXPIRES_IN` 等（根据实际需求添加）

### D1 绑定
- 在 Pages → Settings → Functions → D1 Databases 中添加绑定：
  - Binding name：`DB`（需与 `wrangler.toml` 保持一致）
  - 选择已创建的 D1 数据库
  - 记下 `D1_DATABASE_ID`（用于记录与排查）

### R2 绑定（可选）
- 在 Pages → Settings → Functions → R2 Buckets 添加绑定：
  - Binding name：`R2`（需与 `wrangler.toml` 保持一致）
  - 选择已创建的 R2 Bucket

## 回归验证
1. 触发部署后，打开部署日志确认无错误。
2. 访问生成的域名（例如：`https://<project>.pages.dev`）进行功能回归：
   - 打开首页无报错、首屏加载正常
   - 访问 `/admin/login`，使用默认管理员或已设置的账号登录
   - 访问 `/api/setup?secret=<SETUP_SECRET>` 完成数据结构初始化
   - 管理后台：分类与链接的增删改查、导入导出、图标加载（如绑定 R2）
3. API 响应耗时与首屏时间不低于当前基线（建议使用 Lighthouse 与浏览器 Performance 进行对比）

## 常见问题
- 若构建时出现 Edge/Node 兼容警告属于正常提示，项目已实现 Edge（D1）与本地 SQLite 的适配。
- 生产环境必须设置 `JWT_SECRET` 与 `SETTINGS_ENC_KEY`，否则应用会报错。
- 本地开发可使用：
  ```bash
  wrangler pages dev
  ```
  以模拟 Pages 的 D1/R2 绑定（需在 `wrangler.toml` 中正确配置）。

## 参考
- `wrangler.toml` 中的 D1/R2 绑定示例
- `src/lib/db.ts` 中的 D1/SQLite 适配实现
- `src/lib/auth.ts`、`src/lib/settings.ts` 的安全校验逻辑
