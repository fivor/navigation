'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/admin');
        router.refresh(); // Update auth state
      } else {
        setError(data.message || '登录失败');
      }
    } catch (err) {
      setError('发生错误，请重试。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center items-center px-6 py-12 lg:px-8 bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Blurred Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat blur-sm brightness-[0.85] dark:brightness-[0.5]"
        style={{ backgroundImage: `url('/login-bg.svg')` }}
      />
      
      {/* Overlay for better readability */}
      <div className="absolute inset-0 z-0 bg-white/30 dark:bg-black/40" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-2xl rounded-2xl p-8 border border-white/20 dark:border-gray-700/50">
            <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-blue-50/80 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                    <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                欢迎回来
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    请登录一个导航站管理后台
                </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
                <Input
                    label="邮箱地址"
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="请输入管理员邮箱"
                    className="bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-600 focus:bg-white dark:focus:bg-gray-900 transition-colors"
                />

                <Input
                    label="密码"
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-600 focus:bg-white dark:focus:bg-gray-900 transition-colors"
                />
            </div>

            {error && (
                <div className="p-3 bg-red-50/90 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50 rounded-lg text-sm text-red-600 dark:text-red-400 text-center animate-pulse backdrop-blur-sm">
                {error}
                </div>
            )}

            <Button type="submit" className="w-full py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white" isLoading={isLoading}>
                立即登录
            </Button>
            </form>
            
            <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
                Fivor Navigation Admin Panel &copy; {new Date().getFullYear()}
            </div>
        </div>
      </div>
    </div>
  );
}
