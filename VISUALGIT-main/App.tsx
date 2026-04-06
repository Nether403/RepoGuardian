/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import RepoAnalyzer from './components/RepoAnalyzer';
import Home from './components/Home';
import DevStudio from './components/DevStudio';
import CodeXRay from './components/CodeXRay';
import ApiKeyModal from './components/ApiKeyModal';
import { ViewMode, RepoHistoryItem, DevStudioState } from './types';
import { Github, GitBranch, Home as HomeIcon, CreditCard, Flame, Scan } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.HOME);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [checkingKey, setCheckingKey] = useState<boolean>(true);
  
  // Lifted History State for Persistence
  const [repoHistory, setRepoHistory] = useState<RepoHistoryItem[]>([]);
  
  // Dev Studio State
  const [devStudioData, setDevStudioData] = useState<DevStudioState | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else {
        setHasApiKey(false);
      }
      setCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleNavigate = (mode: ViewMode, data?: any) => {
    if (mode === ViewMode.DEV_STUDIO && data) {
      setDevStudioData(data);
    }
    setCurrentView(mode);
  };

  const handleAddRepoHistory = (item: RepoHistoryItem) => {
    setRepoHistory(prev => [item, ...prev]);
  };

  if (checkingKey) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <div className="min-h-screen flex flex-col relative text-slate-300">
      {/* C4 Hyper-Glass Background System */}
      <div className="bg-void"></div>
      <div className="noise"></div>
      <div className="scanlines"></div>
      
      {/* Enforce API Key Modal */}
      {!hasApiKey && <ApiKeyModal onKeySelected={() => setHasApiKey(true)} />}

      <header className="sticky top-4 z-50 mx-auto w-[calc(100%-1rem)] md:w-[calc(100%-2rem)] max-w-[1400px]">
        <div className="glass-panel rounded-2xl px-4 md:px-6 py-3 md:py-4 flex justify-between items-center bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-lg">
          <button 
            onClick={() => setCurrentView(ViewMode.HOME)}
            className="flex items-center gap-3 md:gap-4 group transition-opacity hover:opacity-80"
          >
            <div className="relative flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 shadow-[0_0_15px_rgba(234,88,12,0.2)] group-hover:border-orange-500/60 transition-colors">
               <Flame className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
            </div>
            <div className="text-left">
              <h1 className="text-lg md:text-xl font-black text-white tracking-widest font-orbitron flex items-center gap-2 uppercase">
                VisualGit <span className="px-2 py-0.5 rounded-sm bg-orange-600/10 text-[10px] font-bold text-orange-500 border border-orange-500/20 hidden sm:inline-block tracking-normal font-mono">STUDIO</span>
              </h1>
              <p className="text-xs font-mono text-slate-500 tracking-widest uppercase hidden sm:block">Visual Intelligence Platform</p>
            </div>
          </button>
          <div className="flex items-center gap-4">
            {hasApiKey && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-bold text-indigo-400 font-orbitron uppercase tracking-widest cursor-help hover:bg-indigo-500/20 transition-colors" title="API Key Active">
                    <CreditCard className="w-3 h-3" /> Paid Tier
                </div>
            )}
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 md:p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-orange-500/50 hover:bg-orange-600/10 transition-all hover:shadow-[0_0_15px_rgba(234,88,12,0.3)]"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Navigation Tabs */}
        {currentView !== ViewMode.HOME && (
            <div className="flex justify-center mb-8 md:mb-10 animate-in fade-in slide-in-from-top-4 sticky top-24 z-40">
            <div className="glass-panel p-1 md:p-1.5 rounded-full flex relative shadow-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10">
                <button
                onClick={() => setCurrentView(ViewMode.HOME)}
                className="relative flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-full font-medium text-sm transition-all duration-300 font-mono text-slate-500 hover:text-white hover:bg-white/5"
                title="Home"
                >
                <HomeIcon className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-white/10 my-auto mx-1"></div>
                <button
                onClick={() => setCurrentView(ViewMode.REPO_ANALYZER)}
                className={`relative flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full font-bold text-sm transition-all duration-300 font-orbitron tracking-wide uppercase ${
                    currentView === ViewMode.REPO_ANALYZER || currentView === ViewMode.DEV_STUDIO
                    ? 'text-white bg-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-white/10'
                    : 'text-slate-500 hover:text-white'
                }`}
                >
                <GitBranch className={`w-4 h-4 ${(currentView === ViewMode.REPO_ANALYZER || currentView === ViewMode.DEV_STUDIO) ? 'text-indigo-400' : ''}`} />
                <span className="hidden sm:inline">GitFlow</span>
                </button>
                <div className="w-px h-6 bg-white/10 my-auto mx-1"></div>
                <button
                onClick={() => setCurrentView(ViewMode.CODE_XRAY)}
                className={`relative flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full font-bold text-sm transition-all duration-300 font-orbitron tracking-wide uppercase ${
                    currentView === ViewMode.CODE_XRAY
                    ? 'text-white bg-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-white/10'
                    : 'text-slate-500 hover:text-white'
                }`}
                >
                <Scan className={`w-4 h-4 ${currentView === ViewMode.CODE_XRAY ? 'text-emerald-400' : ''}`} />
                <span className="hidden sm:inline">Code X-Ray</span>
                </button>
            </div>
            </div>
        )}

        <div className="flex-1">
            {currentView === ViewMode.HOME && (
                <Home onNavigate={handleNavigate} />
            )}
            {currentView === ViewMode.REPO_ANALYZER && (
                <div className="animate-in fade-in-30 slide-in-from-bottom-4 duration-500 ease-out">
                    <RepoAnalyzer 
                        onNavigate={handleNavigate} 
                        history={repoHistory} 
                        onAddToHistory={handleAddRepoHistory}
                    />
                </div>
            )}
            {currentView === ViewMode.DEV_STUDIO && devStudioData && (
                <div className="animate-in fade-in-30 slide-in-from-bottom-4 duration-500 ease-out h-full">
                    <DevStudio 
                        initialState={devStudioData} 
                        onNavigate={handleNavigate}
                    />
                </div>
            )}
            {currentView === ViewMode.CODE_XRAY && (
                <div className="animate-in fade-in-30 slide-in-from-bottom-4 duration-500 ease-out h-full">
                    <CodeXRay />
                </div>
            )}
        </div>
      </main>

      <footer className="py-6 mt-auto border-t border-white/5 bg-slate-950/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto text-center px-4">
          <p className="text-xs font-mono text-slate-600">
            <span className="text-orange-500/70">visual</span>:<span className="text-indigo-500/70">git</span>$ System Ready
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;