/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { generateCodeBlueprint, auditCode } from '../services/geminiService';
import { CodeAudit } from '../types';
import { Scan, ShieldAlert, Zap, Loader2, Sparkles, AlertTriangle, CheckCircle, Terminal, Eye, Download, Maximize } from 'lucide-react';
import ImageViewer from './ImageViewer';

const SAMPLE_CODE = `function processUserData(data) {
  // TODO: Fix security hole here
  eval(data.input); 
  
  if (data.active) {
    return db.users.find({ id: data.id });
  }
  return null;
}`;

const CodeXRay: React.FC = () => {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<string | null>(null);
  const [audit, setAudit] = useState<CodeAudit | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'blueprint'>('input');
  const [fullScreenImage, setFullScreenImage] = useState<{src: string, alt: string} | null>(null);

  const handleScan = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setBlueprint(null);
    setAudit(null);
    setActiveTab('blueprint');

    try {
        const [bp, ad] = await Promise.all([
            generateCodeBlueprint(code),
            auditCode(code)
        ]);
        setBlueprint(bp);
        setAudit(ad);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
      if (score >= 90) return 'text-emerald-400 border-emerald-500/50 shadow-emerald-500/20';
      if (score >= 70) return 'text-yellow-400 border-yellow-500/50 shadow-yellow-500/20';
      return 'text-red-500 border-red-500/50 shadow-red-500/20';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 mb-20">
      
      {fullScreenImage && (
          <ImageViewer 
            src={fullScreenImage.src} 
            alt={fullScreenImage.alt} 
            onClose={() => setFullScreenImage(null)} 
          />
      )}

      {/* Header */}
      <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-orbitron text-indigo-300 uppercase tracking-widest">
              <Eye className="w-3 h-3" /> Visual Code Review
          </div>
          <h2 className="text-4xl font-black text-white font-orbitron tracking-tighter">
              CODE <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-500">X-RAY</span>
          </h2>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 h-[600px]">
          
          {/* Left Panel: Input & Controls */}
          <div className="flex flex-col gap-4 h-full">
               <div className="glass-panel rounded-2xl p-1 flex-1 flex flex-col overflow-hidden border border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.05)] focus-within:border-indigo-500/50 transition-colors">
                  <div className="bg-slate-900/50 px-4 py-2 flex items-center justify-between border-b border-white/5">
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase">
                          <Terminal className="w-3 h-3" /> Source_Buffer
                      </div>
                      <button onClick={() => setCode('')} className="text-[10px] text-slate-500 hover:text-white transition-colors">
                          CLEAR
                      </button>
                  </div>
                  <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="flex-1 bg-transparent border-none text-slate-300 font-mono text-sm p-4 focus:ring-0 resize-none leading-relaxed"
                      spellCheck={false}
                      placeholder="// Paste code snippet to audit..."
                  />
               </div>
               
               <button
                  onClick={handleScan}
                  disabled={loading || !code.trim()}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold font-orbitron tracking-widest rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
               >
                  {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> SCANNING...
                      </>
                  ) : (
                      <>
                        <Scan className="w-5 h-5" /> INITIATE DEEP SCAN
                      </>
                  )}
               </button>
          </div>

          {/* Right Panel: Visualization & Diagnostics */}
          <div className="glass-panel rounded-2xl p-1.5 h-full flex flex-col overflow-hidden relative border border-white/10">
              {/* Tabs */}
              <div className="absolute top-4 right-4 z-20 flex bg-slate-900/80 rounded-lg p-1 border border-white/10 backdrop-blur-md">
                   <button 
                      onClick={() => setActiveTab('blueprint')}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-orbitron uppercase tracking-wider transition-all ${activeTab === 'blueprint' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                   >
                       Blueprint
                   </button>
                   <button 
                      onClick={() => setActiveTab('input')}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-orbitron uppercase tracking-wider transition-all ${activeTab === 'input' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                   >
                       Diagnostics
                   </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 bg-slate-950/50 rounded-xl overflow-hidden relative">
                  
                  {loading && (
                      <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
                          <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden relative">
                              <div className="absolute inset-0 bg-emerald-500 w-1/2 animate-[scan_2s_linear_infinite]"></div>
                          </div>
                          <p className="mt-4 font-mono text-emerald-400 text-xs animate-pulse">ANALYZING LOGIC GATES...</p>
                      </div>
                  )}

                  {!loading && !blueprint && !audit && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                          <Scan className="w-16 h-16 opacity-20 mb-4" />
                          <p className="font-orbitron text-xs tracking-widest opacity-50">SYSTEM IDLE</p>
                      </div>
                  )}

                  {/* Blueprint View */}
                  <div className={`absolute inset-0 transition-opacity duration-500 ${activeTab === 'blueprint' && blueprint ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                      {blueprint && (
                          <div className="w-full h-full relative group">
                              <img src={`data:image/png;base64,${blueprint}`} className="w-full h-full object-cover" alt="Code Blueprint" />
                              <div className="absolute bottom-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setFullScreenImage({src: `data:image/png;base64,${blueprint}`, alt: "Code X-Ray"})} className="p-2 bg-black/50 text-white rounded-lg hover:bg-indigo-500">
                                      <Maximize className="w-4 h-4" />
                                  </button>
                                  <a href={`data:image/png;base64,${blueprint}`} download="code-xray.png" className="p-2 bg-black/50 text-white rounded-lg hover:bg-emerald-500">
                                      <Download className="w-4 h-4" />
                                  </a>
                              </div>
                              {/* Overlay scan line */}
                              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent h-4 w-full animate-[scan_3s_linear_infinite] pointer-events-none border-b border-emerald-500/50"></div>
                          </div>
                      )}
                  </div>

                  {/* Diagnostics View */}
                  <div className={`absolute inset-0 transition-opacity duration-500 overflow-y-auto custom-scrollbar p-6 bg-slate-950 ${activeTab === 'input' && audit ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                      {audit && (
                          <div className="space-y-6">
                              {/* Score Card */}
                              <div className="flex items-center gap-6 pb-6 border-b border-white/5">
                                  <div className={`relative w-24 h-24 flex items-center justify-center rounded-full border-4 ${getScoreColor(audit.score)} bg-slate-900`}>
                                      <span className="text-3xl font-black font-orbitron text-white">{audit.score}</span>
                                      <div className="absolute -bottom-2 px-2 py-0.5 bg-slate-800 text-[9px] text-slate-400 font-bold uppercase rounded border border-white/10">Integrity</div>
                                  </div>
                                  <div className="space-y-2">
                                      <h3 className="text-white font-bold font-orbitron uppercase tracking-wide">Audit Complete</h3>
                                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                                          <div className="px-2 py-1 bg-white/5 rounded border border-white/10">Complexity: <span className="text-white">{audit.complexity}</span></div>
                                          <div className="px-2 py-1 bg-white/5 rounded border border-white/10">{audit.vulnerabilities.length} Alerts</div>
                                      </div>
                                  </div>
                              </div>

                              <div className="space-y-4">
                                  <div className="flex items-center gap-2 text-red-400 font-orbitron text-xs uppercase tracking-widest">
                                      <ShieldAlert className="w-4 h-4" /> Vulnerabilities
                                  </div>
                                  {audit.vulnerabilities.length > 0 ? (
                                      <ul className="space-y-2">
                                          {audit.vulnerabilities.map((v, i) => (
                                              <li key={i} className="bg-red-950/30 border border-red-500/20 p-3 rounded-lg text-xs text-red-200 font-mono flex gap-3">
                                                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                                                  {v}
                                              </li>
                                          ))}
                                      </ul>
                                  ) : (
                                      <div className="text-xs text-slate-500 font-mono italic p-3 bg-white/5 rounded-lg border border-white/5">No critical vulnerabilities detected.</div>
                                  )}
                              </div>

                              <div className="space-y-4">
                                  <div className="flex items-center gap-2 text-indigo-400 font-orbitron text-xs uppercase tracking-widest">
                                      <Zap className="w-4 h-4" /> Optimizations
                                  </div>
                                  {audit.optimizations.length > 0 ? (
                                      <ul className="space-y-2">
                                          {audit.optimizations.map((o, i) => (
                                              <li key={i} className="bg-indigo-950/30 border border-indigo-500/20 p-3 rounded-lg text-xs text-indigo-200 font-mono flex gap-3">
                                                  <Sparkles className="w-4 h-4 shrink-0 text-indigo-500" />
                                                  {o}
                                              </li>
                                          ))}
                                      </ul>
                                  ) : (
                                    <div className="text-xs text-slate-500 font-mono italic p-3 bg-white/5 rounded-lg border border-white/5">Code appears optimized.</div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>

              </div>
          </div>
      </div>
    </div>
  );
};

export default CodeXRay;