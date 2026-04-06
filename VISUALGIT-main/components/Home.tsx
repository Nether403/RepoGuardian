/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ViewMode } from '../types';
import { GitBranch, Link, BrainCircuit, Image, Zap, ArrowRight, Code2, Scan } from 'lucide-react';

interface HomeProps {
  onNavigate: (mode: ViewMode) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-20 mb-20">
      {/* Hero Section */}
      <div className="text-center space-y-6 pt-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold font-orbitron text-orange-400 mb-2 tracking-wider uppercase shadow-[0_0_15px_rgba(234,88,12,0.15)]">
            <Zap className="w-3 h-3 text-orange-500" />
            <span>Powered by Gemini 3.0 Pro Image</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500 font-orbitron leading-tight drop-shadow-2xl">
          VISUAL<span className="text-orange-600">GIT</span>
        </h1>
        
        <p className="text-slate-400 text-xl font-light max-w-2xl mx-auto leading-relaxed font-sans">
          Transform complex repositories into crystal-clear <span className="text-white font-medium">Architectural Blueprints</span> and <span className="text-white font-medium">Holographic Schematics</span>.
        </p>

        {/* Main Actions */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 pt-8 w-full">
            
            {/* GitFlow Option */}
            <button 
                onClick={() => onNavigate(ViewMode.REPO_ANALYZER)}
                className="w-full md:w-[280px] glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all duration-300 border border-white/10 hover:border-indigo-500/50 text-left hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] relative overflow-hidden group"
            >
                <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <GitBranch className="w-24 h-24 -rotate-12 text-indigo-500" />
                </div>
                <div className="relative z-10 flex flex-col h-full">
                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20 w-fit mb-4 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                        <GitBranch className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-indigo-200 transition-colors font-orbitron uppercase tracking-wide">GitFlow</h3>
                        <p className="text-xs text-slate-400 font-mono mt-2 group-hover:text-slate-300">Visualize Repo Architecture</p>
                    </div>
                </div>
            </button>

            {/* Code X-Ray Option */}
            <button 
                onClick={() => onNavigate(ViewMode.CODE_XRAY)}
                className="w-full md:w-[280px] glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all duration-300 border border-white/10 hover:border-emerald-500/50 text-left hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] relative overflow-hidden group"
            >
                <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Scan className="w-24 h-24 -rotate-12 text-emerald-500" />
                </div>
                <div className="relative z-10 flex flex-col h-full">
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 w-fit mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                        <Scan className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-emerald-200 transition-colors font-orbitron uppercase tracking-wide">Code X-Ray</h3>
                        <p className="text-xs text-slate-400 font-mono mt-2 group-hover:text-slate-300">Deep Scan & Vulnerability Audit</p>
                    </div>
                </div>
            </button>
        </div>
      </div>

      {/* 3-Step Process Visualization */}
      <div className="relative pt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 border-t border-white/5">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 relative pt-6">
             {/* Step 1 */}
             <div className="flex flex-col items-center text-center space-y-4 group">
                 <div className="w-14 h-14 rounded-2xl bg-slate-900/50 border border-white/10 flex items-center justify-center shadow-lg group-hover:border-indigo-500/50 transition-colors group-hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                     <Link className="w-6 h-6 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                 </div>
                 <div>
                     <h3 className="text-white font-bold text-sm font-orbitron uppercase tracking-widest mb-1">
                        1. Connect
                     </h3>
                     <p className="text-slate-500 text-xs font-mono leading-relaxed max-w-[200px] mx-auto">
                        Provide URL or Code Snippet
                     </p>
                 </div>
             </div>

             {/* Step 2 */}
             <div className="flex flex-col items-center text-center space-y-4 group">
                 <div className="w-14 h-14 rounded-2xl bg-slate-900/50 border border-orange-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(234,88,12,0.2)]">
                     <BrainCircuit className="w-6 h-6 text-orange-400 animate-pulse" />
                 </div>
                 <div>
                     <h3 className="text-white font-bold text-sm font-orbitron uppercase tracking-widest mb-1 text-orange-500">
                        2. Analyze
                     </h3>
                     <p className="text-slate-500 text-xs font-mono leading-relaxed max-w-[200px] mx-auto">
                        Deep Scan Dependencies & Logic
                     </p>
                 </div>
             </div>

             {/* Step 3 */}
             <div className="flex flex-col items-center text-center space-y-4 group">
                 <div className="w-14 h-14 rounded-2xl bg-slate-900/50 border border-white/10 flex items-center justify-center shadow-lg group-hover:border-indigo-500/50 transition-colors group-hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                     <Image className="w-6 h-6 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                 </div>
                 <div>
                     <h3 className="text-white font-bold text-sm font-orbitron uppercase tracking-widest mb-1">
                        3. Visualize
                     </h3>
                     <p className="text-slate-500 text-xs font-mono leading-relaxed max-w-[200px] mx-auto">
                        Generate High-Fidelity Schematics
                     </p>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default Home;