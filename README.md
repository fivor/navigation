# Navigation Site System

A modern, feature-rich navigation site management system built with Next.js 14, Tailwind CSS, and Vercel Postgres.

## Features

- **Modern UI**: Responsive card layout, Dark/Light mode support.
- **Admin Dashboard**: Manage links and categories, import bookmarks.
- **Import Support**: Import bookmarks from Google Chrome (HTML) and Safari (Plist).
- **Authentication**: Secure admin login with JWT and Middleware protection.
- **Performance**: Server Components, Vercel Postgres, Optimistic UI.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Headless UI, Lucide React.
- **Backend**: Next.js API Routes, Vercel Postgres (via `@vercel/postgres`).
- **Auth**: JWT (Jose), Bcryptjs.
- **Deployment**: Vercel.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Vercel Account
- Vercel Postgres Database

### Local Development

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy `.env.example` to `.env.local` (Create one if not exists) and set up environment variables:
   ```
   POSTGRES_URL="postgres://..."
   POSTGRES_PRISMA_URL="postgres://..."
   POSTGRES_URL_NON_POOLING="postgres://..."
   JWT_SECRET="your-secret-key"
   SETUP_SECRET="your-setup-secret"
   ```
   *Note: You can pull Vercel env vars using `vercel env pull`.*

4. Run the development server:
   ```bash
   pnpm dev
   ```

5. Initialize the database:
   Visit `http://localhost:3000/api/setup?secret=your-setup-secret` to create tables and default admin user.
   Default Admin: `admin@example.com` / `admin`

### Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-username%2Fnavigation-site&env=POSTGRES_URL,POSTGRES_PRISMA_URL,POSTGRES_URL_NON_POOLING,JWT_SECRET,SETUP_SECRET)

1. Click the button above to deploy to Vercel.
2. Configure the **Vercel Postgres** integration during deployment (Vercel will ask to add a database).
3. Set `JWT_SECRET` and `SETUP_SECRET` environment variables in Vercel.
4. After deployment, visit `https://your-domain.vercel.app/api/setup?secret=your-setup-secret` to initialize the database.
5. Log in to `/admin` with `admin@example.com` / `admin`.

## Project Structure

- `src/app/(public)`: Public facing pages (Home).
- `src/app/admin`: Admin dashboard and login.
- `src/app/api`: API routes.
- `src/components`: Reusable components.
- `src/lib`: Utilities (DB, Auth).

## License

MIT
