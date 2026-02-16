import type { Metadata } from "next";
import { Inter, Ma_Shan_Zheng } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

export const runtime = 'edge';

const inter = Inter({ subsets: ["latin"] });
const maShanZheng = Ma_Shan_Zheng({ 
  weight: '400',
  subsets: ["latin"],
  variable: '--font-handwriting',
});

export const metadata: Metadata = {
  title: "一个导航站",
  description: "一个现代化的导航站管理系统",
  icons: {
    icon: [
      { url: '/favicon.ico?v=2', rel: 'icon' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${inter.className} ${maShanZheng.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
