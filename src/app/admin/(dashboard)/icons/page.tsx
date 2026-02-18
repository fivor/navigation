'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconRenderer } from '@/components/ui/IconRenderer';

export default function IconSettingsPage() {
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [bucket, setBucket] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [publicBase, setPublicBase] = useState('');
  const [iconMaxKB, setIconMaxKB] = useState(128);
  const [iconMaxSize, setIconMaxSize] = useState(128);
  const [r2Msg, setR2Msg] = useState('');
  const [r2Loading, setR2Loading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearRes, setClearRes] = useState<{ message: string; count: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json() as any;
        if (data?.success && data?.data) {
          const d = data.data;
          if (d.accessKeyId) setAccessKeyId(d.accessKeyId);
          if (d.bucket) setBucket(d.bucket);
          setEndpoint(d.endpoint || '');
          setPublicBase(d.publicBase || '');
          setIconMaxKB(d.iconMaxKB ?? 128);
          setIconMaxSize(d.iconMaxSize ?? 128);
        }
      } catch {}
    })();
  }, []);

  const handleR2Save = async (e: React.FormEvent) => {
    e.preventDefault();
    setR2Msg('');
    setR2Loading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        iconMaxKB,
        iconMaxSize,
      };
      if (accessKeyId) payload.accessKeyId = accessKeyId;
      if (secretAccessKey) payload.secretAccessKey = secretAccessKey;
      if (bucket) payload.bucket = bucket;
      if (endpoint) payload.endpoint = endpoint;
      if (publicBase) payload.publicBase = publicBase;

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as any;
      if (data.success) {
        setR2Msg('设置已保存');
      } else {
        setR2Msg(data.message || '保存失败');
      }
    } catch {
      setR2Msg('保存失败，请稍后重试');
    } finally {
      setR2Loading(false);
    }
  };

  const handleClearIcons = async () => {
    if (!confirm('确定要清除所有本地存储的图标吗？此操作不可撤销。')) return;
    
    setClearLoading(true);
    setClearRes(null);
    try {
      const res = await fetch('/api/admin/icons/clear', { method: 'POST' });
      const data = await res.json() as any;
      if (data.success) {
        setClearRes({ message: data.message, count: data.count });
      } else {
        alert(data.message || '清除失败');
      }
    } catch {
      alert('发生错误，请稍后重试');
    } finally {
      setClearLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">图标设置</h1>
        
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-6">
            <IconRenderer iconName="CloudCog" className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">R2 存储配置</h2>
          </div>
          
          <form onSubmit={handleR2Save} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label="Access Key ID" 
              value={accessKeyId} 
              onChange={(e) => setAccessKeyId(e.target.value)} 
              placeholder="留空表示不修改" 
            />
            <Input 
              label="Secret Access Key" 
              type="password" 
              value={secretAccessKey} 
              onChange={(e) => setSecretAccessKey(e.target.value)} 
              placeholder="留空表示不修改" 
            />
            <Input 
              label="Bucket 名称" 
              value={bucket} 
              onChange={(e) => setBucket(e.target.value)} 
              placeholder="存储桶名称" 
            />
            <Input 
              label="Endpoint 终端节点" 
              value={endpoint} 
              onChange={(e) => setEndpoint(e.target.value)} 
              placeholder="https://<account>.r2.cloudflarestorage.com" 
            />
            <Input 
              label="Public Base 公开访问地址" 
              value={publicBase} 
              onChange={(e) => setPublicBase(e.target.value)} 
              placeholder="https://cdn.example.com" 
            />
            <div />
            
            <Input 
              label="图标体积上限 (KB)" 
              type="number" 
              value={iconMaxKB} 
              onChange={(e) => setIconMaxKB(parseInt(e.target.value || '128'))} 
            />
            <Input 
              label="图标尺寸上限 (px)" 
              type="number" 
              value={iconMaxSize} 
              onChange={(e) => setIconMaxSize(parseInt(e.target.value || '128'))} 
            />
            
            <div className="md:col-span-2 pt-4 flex items-center gap-4">
              <Button type="submit" isLoading={r2Loading}>保存配置</Button>
              {r2Msg && (
                <span className={`text-sm ${r2Msg.includes('成功') || r2Msg.includes('已保存') ? 'text-green-600' : 'text-red-500'}`}>
                  {r2Msg}
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Local Icons Management */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">本地存储管理</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            如果您已成功配置 R2 并希望释放服务器空间，可以清除本地存储的图标文件。
          </p>
          <div className="flex items-center gap-4">
            <Button 
              variant="secondary" 
              onClick={handleClearIcons} 
              isLoading={clearLoading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              清除所有本地图标
            </Button>
            {clearRes && (
              <span className="text-sm text-green-600 font-medium">
                {clearRes.message}
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
