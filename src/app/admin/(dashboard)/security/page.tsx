'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secMsg, setSecMsg] = useState('');
  const [secLoading, setSecLoading] = useState(false);

  const handleSecuritySave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecMsg('');
    if (newPassword && newPassword !== confirmPassword) {
      setSecMsg('两次输入的新密码不一致');
      return;
    }
    if (!newEmail && !newPassword) {
      setSecMsg('请至少修改邮箱或密码中的一项');
      return;
    }
    setSecLoading(true);
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newEmail: newEmail || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSecMsg('保存成功，请使用新邮箱/密码重新登录');
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/admin/login');
        router.refresh();
      } else {
        setSecMsg(data.message || '保存失败');
      }
    } catch {
      setSecMsg('保存失败，请稍后重试');
    } finally {
      setSecLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">安全设置</h1>
        
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">账号安全</h2>
          </div>
          
          <form onSubmit={handleSecuritySave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="当前密码"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="确认身份必填"
            />
            <div />
            
            <Input
              label="新邮箱"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="填写则更新绑定邮箱"
            />
            <div />
            
            <Input
              label="新密码"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="不修改请留空，至少5位"
            />
            <Input
              label="确认新密码"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
            />
            
            <div className="md:col-span-2 pt-4 flex items-center gap-4">
              <Button type="submit" isLoading={secLoading}>保存并重新登录</Button>
              {secMsg && (
                <span className={`text-sm ${secMsg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>
                  {secMsg}
                </span>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
