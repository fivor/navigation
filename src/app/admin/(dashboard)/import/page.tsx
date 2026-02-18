'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconRenderer } from '@/components/ui/IconRenderer';

export default function ImportExportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'chrome' | 'safari'>('chrome');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    duplicates: number;
    categories: any[];
  } | null>(null);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleImport = async (e: any) => {
    if (!file) {
      setError('请选择一个文件');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/import/${importType}`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json() as any;

      if (data.success) {
        setResult(data);
      } else {
        setError(data.message || '导入失败');
      }
    } catch (err) {
      setError('导入过程中发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'html') => {
      setIsExporting(true);
      try {
          const res = await fetch(`/api/export?format=${format}`);
          if (!res.ok) throw new Error('Export failed');
          
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `bookmarks_export_${new Date().toISOString().slice(0, 10)}.${format}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
      } catch (e) {
          alert('导出失败');
          console.error(e);
      } finally {
          setIsExporting(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Export Section */}
      <section>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">导入导出</h1>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">导出数据</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  将所有已保存的网站链接打包导出。支持 JSON 格式（用于备份/迁移）或 HTML 格式（通用书签文件）。
              </p>
              <div className="flex gap-4">
                  <Button onClick={() => handleExport('json')} variant="secondary" disabled={isExporting} className="flex items-center gap-2">
                      <IconRenderer iconName="FileJson" className="w-4 h-4" />
                      导出 JSON
                  </Button>
                  <Button onClick={() => handleExport('html')} variant="secondary" disabled={isExporting} className="flex items-center gap-2">
                      <IconRenderer iconName="FileCode" className="w-4 h-4" />
                      导出 HTML (书签)
                  </Button>
              </div>
          </div>
      </section>

      {/* Import Section */}
      <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">导入书签</h2>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">导入来源</label>
          <div className="flex space-x-4">
            <button
              onClick={() => setImportType('chrome')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                importType === 'chrome'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Google Chrome (HTML)
            </button>
            <button
              onClick={() => setImportType('safari')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                importType === 'safari'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Safari (Plist)
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择文件
          </label>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <IconRenderer iconName="Upload" className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">点击上传</span> 或拖拽文件到此处
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {importType === 'chrome' ? 'HTML 文件' : 'Plist 文件'}
                </p>
              </div>
              <input type="file" className="hidden" accept={importType === 'chrome' ? '.html' : '.plist'} onChange={handleFileChange} />
            </label>
          </div>
          {file && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">已选择：{file.name}</p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
            <p className="font-semibold">导入成功！</p>
            <ul className="list-disc list-inside mt-2">
              <li>导入链接数：{result.imported}</li>
              <li>跳过重复项：{result.duplicates}</li>
              <li>发现分类数：{result.categories.length}</li>
            </ul>
          </div>
        )}

        <Button onClick={handleImport} disabled={!file || isLoading} isLoading={isLoading}>
          开始导入
        </Button>
      </section>
    </div>
  );
}
