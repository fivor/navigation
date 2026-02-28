
# Navigation 站点系统

基于 Next.js 14、Tailwind CSS，针对 Cloudflare Pages + D1 构建的现代导航站点管理系统。

## 功能亮点

- **现代 UI**：响应式卡片布局，支持深色/浅色主题。
- **管理后台**：管理链接与分类，支持导入书签。
- **导入支持**：支持从 Google Chrome（HTML）和 Safari（Plist）导入书签。
- **鉴权**：基于 JWT 的管理员登录，配合中间件保护管理路由。
- **性能**：使用 Server Components、Edge Runtime，支持乐观更新。

## 技术栈

- **前端**：Next.js 14（App Router）、React、Tailwind CSS、Headless UI、Lucide React。
- **后端**：Next.js API Routes；Cloudflare D1（Pages 场景）或本地 SQLite（开发回退）。
- **鉴权**：JWT（jose）、bcryptjs。
- **部署**：Vercel / Cloudflare Pages（配合 `@cloudflare/next-on-pages`）。

## 快速开始

### 前置条件

- Node.js 18+
- pnpm（推荐）或 npm
- 若使用生产数据库：Cloudflare D1（Pages 绑定）

### 本地开发

1. 克隆仓库。
2. 安装依赖：
```bash
pnpm install
```
3. 复制 `.env.example` 为 `.env.local`（如果不存在则创建），并填写环境变量：
```env
JWT_SECRET="your-secret-key"
SETUP_SECRET="your-setup-secret"
SETTINGS_ENC_KEY="your-32-chars-encryption-key"
```

4. 启动开发服务器：
```bash
pnpm dev
```

5. 初始化数据库：在浏览器访问 `http://localhost:3000/api/setup?secret=your-setup-secret` 来创建表并生成默认管理员账号。
默认管理员：`admin@example.com` / `admin`

> 如果需要在本地测试 Cloudflare D1 绑定（Edge 环境），请使用：
```bash
wrangler pages dev
```

### 部署

本项目默认面向 Cloudflare Pages + D1（使用 `@cloudflare/next-on-pages`）。主要部署注意事项：

- Cloudflare Pages（推荐用于 D1）：使用项目自带的 `pages:build` 打包脚本将应用打包为 Pages Worker。构建后在 Pages 控制台绑定 D1（或使用 Pages 后端）并配置环境变量。
- 使用 D1 绑定进行本地开发时，请使用：
```bash
wrangler pages dev
```
这将提供 D1 绑定并模拟 Edge 环境。
- 环境变量（至少）需设置：
```
JWT_SECRET=...
SETUP_SECRET=...
SETTINGS_ENC_KEY=...
```

构建并初始化：部署或本地测试完成构建后，访问 `/api/setup?secret=你的SETUP_SECRET` 来创建表与默认管理员账号。

登录管理后台位于 `/admin`，初始管理员：`admin@example.com` / `admin`（建议首次登陆后更改密码）。

## 项目结构（简要）

- `src/app/(public)`: 公共页面（首页等）。
- `src/app/admin`: 管理面板与登录页面。
- `src/app/api`: API 路由实现。
- `src/components`: 可复用组件。
- `src/lib`: 工具库（DB、Auth、R2、settings 等）。

## 许可证

MIT
