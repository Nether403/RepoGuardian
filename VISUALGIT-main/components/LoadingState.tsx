
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { Cpu, FileText, Activity } from 'lucide-react';

interface LoadingStateProps {
  message: string;
  type: 'repo' | 'article';
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message, type }) => {
  const [logs, setLogs] = useState<string[]>([]);
  
  // Theme configuration based on type
  const config = type === 'repo' ? {
    color: 'text-indigo-400',
    bg: 'bg-indigo-500',
    border: 'border-indigo-500',
    icon: Cpu,
    logPrefix: 'git',
    tasks: [
      "Fetching remote tree object...",
      "Parsing Abstract Syntax Tree...",
      "Mapping dependency graph...",
      "Identifying structural hotspots...",
      "Vectorizing node positions...",
      "Calculating force-directed layout...",
      "Optimizing render pipeline...",
      "Compiling WebGL assets...",
      "Finalizing lightmap bake..."
    ]
  } : {
    color: 'text-orange-400',
    bg: 'bg-orange-500',
    border: 'border-orange-500',
    icon: FileText,
    logPrefix: 'web',
    tasks: [
      "Resolving DNS headers...",
      "Scraping DOM structure...",
      "Extracting semantic entities...",
      "Analyzing content density...",
      "Synthesizing visual metaphors...",
      "Determining optimal layout...",
      "Rasterizing vector layers...",
      "Applying style transfer...",
      "Generating final composite..."
    ]
  };

  const Icon = config.icon;

  useEffect(() => {
    setLogs([`> initializing ${config.logPrefix}_module...`]);
    
    const interval = setInterval(() => {
      setLogs(prev => {
        const nextLog = config.tasks[Math.floor(Math.random() * config.tasks.length)];
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const newLogs = [...prev, `[${timestamp}] ${nextLog} ... OK`];
        if (newLogs.length > 5) return newLogs.slice(newLogs.length - 5);
        return newLogs;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [type]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-16 animate-in fade-in duration-700">
      
      {/* Visual HUD */}
      <div className="relative w-40 h-40 flex items-center justify-center mb-10">
        <div className={`absolute inset-0 rounded-full border border-white/10`}></div>
        
        <div className={`absolute inset-0 rounded-full border-2 border-dashed ${config.border} opacity-20 animate-[spin_12s_linear_infinite]`}></div>
        
        <div className={`absolute inset-4 rounded-full border border-t-transparent border-l-transparent ${config.border} opacity-40 animate-[spin_3s_linear_infinite_reverse]`}></div>
        
        <div className={`relative z-10 p-6 rounded-full ${config.bg} bg-opacity-10 backdrop-blur-xl border ${config.border} border-opacity-30 shadow-[0_0_40px_rgba(0,0,0,0.6)] animate-pulse`}>
           <Icon className={`w-12 h-12 ${config.color}`} />
        </div>

        <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
           <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 ${config.bg} rounded-full shadow-[0_0_15px_currentColor]`}></div>
        </div>
      </div>

      {/* Status Message */}
      <h3 className={`text-xl md:text-2xl font-orbitron font-bold ${config.color} mb-6 tracking-widest uppercase animate-pulse text-center shadow-glow-text`}>
        {message || 'PROCESSING_DATA'}
      </h3>

      {/* Terminal Window */}
      <div className="w-full bg-slate-950/80 rounded-xl border border-white/10 p-4 font-mono text-xs relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
             <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
             </div>
             <div className="text-[10px] text-slate-600 uppercase tracking-wider">system_log</div>
        </div>
        
        <div className="flex flex-col gap-1.5 h-32 justify-end">
            {logs.map((log, i) => (
                <div key={i} className="text-slate-400 animate-in slide-in-from-left-4 fade-in duration-300 truncate font-medium">
                    <span className={`${config.color} opacity-50 mr-2`}>{'>'}</span>
                    {log}
                </div>
            ))}
            <div className="flex items-center gap-2 text-slate-500 animate-pulse mt-1">
               <Activity className="w-3 h-3" />
               <span>Working...</span>
            </div>
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>
      </div>
    </div>
  );
};
