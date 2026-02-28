
# Navigation 站点系统

基于 Next.js 16、Tailwind CSS，针对 Cloudflare Pages + D1 + R2 构建的现代导航站点管理系统。

## 功能亮点

- **现代 UI**：响应式卡片布局，支持深色/浅色主题切换。
- **管理后台**：完整的链接与分类管理功能，支持拖拽排序。
- **导入支持**：支持从 Google Chrome（HTML）和 Safari（Plist）导入书签。
- **鉴权系统**：基于 JWT 的管理员登录，配合中间件保护管理路由。
- **图标管理**：图标存储在 Cloudflare R2，支持自定义图标上传。
- **高性能**：使用 Server Components、Edge Runtime，支持乐观更新。

## 技术栈

- **前端**：Next.js 16（App Router）、React 19、Tailwind CSS 4、Headless UI、Lucide React。
- **后端**：Next.js API Routes（Edge Runtime）、Cloudflare D1（生产）、SQLite（本地开发）。
- **存储**：Cloudflare R2（图标存储）、Cloudflare D1（数据库）。
- **鉴权**：JWT（jose）、密码哈希（bcrypt）。
- **部署**：Cloudflare Pages（配合 `@cloudflare/next-on-pages`）。

## 快速开始

### 前置条件

- Node.js 18+
- pnpm（推荐）或 npm
- Cloudflare 账号（用于生产部署）

### 本地开发

1. 克隆仓库：
```bash
git clone <repository-url>
cd Navigation
```

2. 安装依赖：
```bash
pnpm install
```

3. 复制 `.env.example` 为 `.env.local` 并配置环境变量：
```env
JWT_SECRET="your-secret-key-here"
SETUP_SECRET="your-setup-secret-here"
SETTINGS_ENC_KEY="your-32-chars-encryption-key-here"
```

4. 启动开发服务器：
```bash
pnpm dev
```

5. 初始化数据库：访问 `http://localhost:3000/api/setup?secret=your-setup-secret` 创建表并生成默认管理员账号。

默认管理员：`admin@example.com` / `admin`

### Cloudflare Pages 部署

项目已配置为部署到 Cloudflare Pages，使用 Cloudflare D1 作为数据库，Cloudflare R2 作为图标存储。

#### 部署步骤

1. **构建与测试**（本地验证）：
```bash
pnpm run build && pnpm run test
```

2. **配置 Cloudflare**：
   - 在 Cloudflare Dashboard 创建 Pages 项目
   - 绑定 D1 数据库（Binding name: `DB`）
   - 绑定 R2 Bucket（Binding name: `R2`）
   - 配置环境变量

3. **推送代码**：
```bash
git add .
git commit -m "deploy: initial deployment"
git push origin main
```

4. **初始化生产数据库**：部署成功后访问 `https://your-project.pages.dev/api/setup?secret=your-setup-secret`

#### 环境变量

在 Cloudflare Pages Settings → Environment variables 中配置：

- `NODE_VERSION`: Node.js 版本（如 `20`）
- `JWT_SECRET`: JWT 签名密钥（强密码）
- `SETUP_SECRET`: 数据库初始化密钥
- `SETTINGS_ENC_KEY`: 设置加密密钥（32字符）

## 项目结构

```
Navigation/
├── src/
│   ├── app/
│   │   ├── (public)/       # 公共页面（首页）
│   │   ├── admin/          # 管理后台
│   │   └── api/            # API 路由
│   ├── components/         # React 组件
│   ├── lib/                # 工具库（DB、Auth、R2 等）
│   └── types/              # TypeScript 类型定义
├── public/                 # 静态资源
├── wrangler.toml           # Cloudflare 配置
└── package.json
```

## 许可证

MIT
