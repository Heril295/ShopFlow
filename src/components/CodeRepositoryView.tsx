import React, { useState } from 'react';
import { CODE_REPOSITORY } from '../data/codeRepository';
import { CodeFile } from '../types/shopflow';
import {
  Code,
  Folder,
  FileText,
  Copy,
  Check,
  Download,
  Terminal,
  Layers,
  Sparkles
} from 'lucide-react';

export const CodeRepositoryView: React.FC = () => {
  const [selectedPath, setSelectedPath] = useState<string>(CODE_REPOSITORY[0].path);
  const [copied, setCopied] = useState<boolean>(false);

  const activeFile = CODE_REPOSITORY.find(f => f.path === selectedPath) || CODE_REPOSITORY[0];

  const categories = Array.from(new Set(CODE_REPOSITORY.map(f => f.category)));

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100">ShopFlow Production Codebase Explorer</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              12 Production Files
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Explore authentic Go and Python services, Outbox patterns, OpenTelemetry configs, Pyrra SLOs, and k6 load tests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-950/50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {activeFile.filename}</span>
          </button>
        </div>
      </div>

      {/* Main Split: Left File Explorer, Right Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Tree Navigator (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-400 pb-2 border-b border-slate-800">
              <Folder className="w-4 h-4 text-indigo-400" />
              <span>Project Structure</span>
            </div>

            <div className="space-y-4">
              {categories.map(cat => {
                const filesInCat = CODE_REPOSITORY.filter(f => f.category === cat);
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                      {cat}
                    </div>
                    <div className="space-y-1 pl-2 border-l border-slate-800">
                      {filesInCat.map(file => {
                        const isSelected = file.path === selectedPath;
                        return (
                          <button
                            key={file.path}
                            onClick={() => setSelectedPath(file.path)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{file.filename}</span>
                            <span
                              className={`text-[10px] px-1.5 rounded font-mono uppercase ${
                                isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-950 text-slate-400'
                              }`}
                            >
                              {file.language}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Code Editor / Display (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            {/* File Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-slate-200">{activeFile.path}</span>
              </div>
              <span className="text-slate-400 text-[11px]">
                {activeFile.content.split('\n').length} lines | {activeFile.language.toUpperCase()}
              </span>
            </div>

            <p className="text-xs text-slate-400 italic font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
              {activeFile.description}
            </p>

            {/* Code Box with Line Numbers */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden font-mono text-xs">
              <div className="max-h-[580px] overflow-auto p-4 flex gap-4 text-slate-300 leading-relaxed">
                {/* Line numbers */}
                <div className="select-none text-slate-600 text-right font-mono pr-2 border-r border-slate-800/80 shrink-0 text-[11px]">
                  {activeFile.content.split('\n').map((_, idx) => (
                    <div key={idx}>{idx + 1}</div>
                  ))}
                </div>

                {/* Code body */}
                <pre className="overflow-x-auto text-[11px] font-mono text-slate-200 whitespace-pre">
                  <code>{activeFile.content}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
