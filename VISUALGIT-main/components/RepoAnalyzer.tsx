/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo } from 'react';
import { fetchRepoFileTree } from '../services/githubService';
import { generateInfographic } from '../services/geminiService';
import { RepoFileTree, ViewMode, RepoHistoryItem, DataFlowGraph, D3Node, D3Link } from '../types';
import { AlertCircle, Loader2, Layers, Box, Download, Sparkles, Command, Palette, Globe, Clock, Maximize, KeyRound, Zap, Code2, ArrowRight, PieChart } from 'lucide-react';
import { LoadingState } from './LoadingState';
import ImageViewer from './ImageViewer';

interface RepoAnalyzerProps {
  onNavigate: (mode: ViewMode, data?: any) => void;
  history: RepoHistoryItem[];
  onAddToHistory: (item: RepoHistoryItem) => void;
}

const FLOW_STYLES = [
    "Modern Data Flow",
    "Hand-Drawn Blueprint",
    "Corporate Minimal",
    "Neon Cyberpunk",
    "Custom"
];

const LANGUAGES = [
  { label: "English (US)", value: "English" },
  { label: "Arabic (Egypt)", value: "Arabic" },
  { label: "German (Germany)", value: "German" },
  { label: "Spanish (Mexico)", value: "Spanish" },
  { label: "French (France)", value: "French" },
  { label: "Hindi (India)", value: "Hindi" },
  { label: "Indonesian (Indonesia)", value: "Indonesian" },
  { label: "Italian (Italy)", value: "Italian" },
  { label: "Japanese (Japan)", value: "Japanese" },
  { label: "Korean (South Korea)", value: "Korean" },
  { label: "Portuguese (Brazil)", value: "Portuguese" },
  { label: "Russian (Russia)", value: "Russian" },
  { label: "Ukrainian (Ukraine)", value: "Ukrainian" },
  { label: "Vietnamese (Vietnam)", value: "Vietnamese" },
  { label: "Chinese (China)", value: "Chinese" },
];

const RepoAnalyzer: React.FC<RepoAnalyzerProps> = ({ onNavigate, history, onAddToHistory }) => {
  const [repoInput, setRepoInput] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(FLOW_STYLES[0]);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].value);
  const [customStyle, setCustomStyle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<string>('');
  
  // Infographic State
  const [infographicData, setInfographicData] = useState<string | null>(null);
  const [infographic3DData, setInfographic3DData] = useState<string | null>(null);
  const [generating3D, setGenerating3D] = useState(false);
  const [currentFileTree, setCurrentFileTree] = useState<RepoFileTree[] | null>(null);
  const [currentRepoName, setCurrentRepoName] = useState<string>('');
  
  // Viewer State
  const [fullScreenImage, setFullScreenImage] = useState<{src: string, alt: string} | null>(null);

  const parseRepoInput = (input: string): { owner: string, repo: string } | null => {
    const cleanInput = input.trim().replace(/\/$/, '');
    try {
      const url = new URL(cleanInput);
      if (url.hostname === 'github.com') {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
      }
    } catch (e) { }
    const parts = cleanInput.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) return { owner: parts[0], repo: parts[1] };
    return null;
  };

  const addToHistory = (repoName: string, imageData: string, is3D: boolean, style: string) => {
     const newItem: RepoHistoryItem = {
         id: Date.now().toString(),
         repoName,
         imageData,
         is3D,
         style,
         date: new Date()
     };
     onAddToHistory(newItem);
  };

  const handleApiError = (err: any) => {
      if (err.message && err.message.includes("Requested entity was not found")) {
          const confirmSwitch = window.confirm(
              "BILLING REQUIRED: The current API key does not have access to these models.\n\n" +
              "This feature requires a paid Google Cloud Project. Please switch to a valid paid API Key."
          );
          if (confirmSwitch) {
              window.location.reload();
          }
      }
      setError(err.message || 'An unexpected error occurred during analysis.');
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfographicData(null);
    setInfographic3DData(null);
    setCurrentFileTree(null);

    const repoDetails = parseRepoInput(repoInput);
    if (!repoDetails) {
      setError('Invalid format. Use "owner/repo" or a full GitHub URL.');
      return;
    }

    setLoading(true);
    setCurrentRepoName(repoDetails.repo);
    try {
      setLoadingStage('CONNECTING TO GITHUB');
      const fileTree = await fetchRepoFileTree(repoDetails.owner, repoDetails.repo);

      if (fileTree.length === 0) throw new Error('No relevant code files found in this repository.');
      setCurrentFileTree(fileTree);

      setLoadingStage('ANALYZING STRUCTURE & GENERATING');
      
      const styleToUse = selectedStyle === 'Custom' ? customStyle : selectedStyle;

      const infographicBase64 = await generateInfographic(repoDetails.repo, fileTree, styleToUse, false, selectedLanguage);
      
      if (infographicBase64) {
        setInfographicData(infographicBase64);
        addToHistory(repoDetails.repo, infographicBase64, false, styleToUse);
      } else {
          throw new Error("Failed to generate visual.");
      }

    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleGenerate3D = async () => {
    if (!currentFileTree || !currentRepoName) return;
    setGenerating3D(true);
    try {
      const styleToUse = selectedStyle === 'Custom' ? customStyle : selectedStyle;
      const data = await generateInfographic(currentRepoName, currentFileTree, styleToUse, true, selectedLanguage);
      if (data) {
          setInfographic3DData(data);
          addToHistory(currentRepoName, data, true, styleToUse);
      }
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setGenerating3D(false);
    }
  };

  const generateGraphFromTree = (tree: RepoFileTree[]): DataFlowGraph => {
      const nodes: D3Node[] = [{ id: 'root', group: 0, label: 'root' }];
      const links: D3Link[] = [];
      const pathMap = new Map<string, string>(); 
      pathMap.set('', 'root');
    
      let nodeIdCounter = 1;
      // limit complexity for the graph view
      const limitedTree = tree.slice(0, 100); 
    
      limitedTree.forEach(file => {
          const parts = file.path.split('/');
          let currentPath = '';
          let parentId = 'root';
    
          parts.forEach((part, index) => {
              const isLast = index === parts.length - 1;
              currentPath = currentPath ? `${currentPath}/${part}` : part;
              
              if (!pathMap.has(currentPath)) {
                  const id = `node_${nodeIdCounter++}`;
                  pathMap.set(currentPath, id);
                  
                  // Determine group based on file extension
                  let group = 1;
                  if (isLast) {
                      const ext = part.split('.').pop();
                      if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) group = 2;
                      if (['css', 'scss', 'html'].includes(ext || '')) group = 3;
                      if (['json', 'yml', 'config'].includes(ext || '')) group = 4;
                  } else {
                      group = 5; // Folder
                  }
    
                  nodes.push({ id, label: part, group });
                  links.push({ source: parentId, target: id, value: 1 });
              }
              parentId = pathMap.get(currentPath)!;
          });
      });
    
      return { nodes, links };
  };

  const launchDevStudio = () => {
      if (!currentFileTree || !currentRepoName) return;
      const graphData = generateGraphFromTree(currentFileTree);
      onNavigate(ViewMode.DEV_STUDIO, {
          repoName: currentRepoName,
          fileTree: currentFileTree,
          graphData
      });
  };

  const loadFromHistory = (item: RepoHistoryItem) => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentRepoName(item.repoName);
      if (item.is3D) {
          setInfographic3DData(item.imageData);
      } else {
          setInfographicData(item.imageData);
          setInfographic3DData(null);
      }
      // Note: We don't restore fileTree from history in this simple version, 
      // so Dev Studio won't be available for history items until re-analyzed.
      setCurrentFileTree(null); 
  };

  // --- Tech Stack Statistics ---
  const techStackStats = useMemo(() => {
    if (!currentFileTree) return [];
    
    const extensionMap: Record<string, string> = {
        'ts': 'TypeScript', 'tsx': 'TypeScript', 'js': 'JavaScript', 'jsx': 'JavaScript',
        'css': 'CSS', 'scss': 'Sass', 'html': 'HTML',
        'json': 'JSON', 'yml': 'YAML', 'yaml': 'YAML',
        'py': 'Python', 'go': 'Go', 'rs': 'Rust', 'java': 'Java',
        'c': 'C', 'cpp': 'C++', 'cs': 'C#', 'php': 'PHP', 'rb': 'Ruby'
    };
    
    const stats: Record<string, number> = {};
    let total = 0;

    currentFileTree.forEach(file => {
        const ext = file.path.split('.').pop()?.toLowerCase();
        if (ext && extensionMap[ext]) {
            const lang = extensionMap[ext];
            stats[lang] = (stats[lang] || 0) + 1;
            total++;
        }
    });

    return Object.entries(stats)
        .map(([lang, count]) => ({ lang, count, percent: (count / total) * 100 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5
  }, [currentFileTree]);

  // Color mapping for languages
  const getLangColor = (lang: string) => {
      const colors: Record<string, string> = {
          'TypeScript': 'bg-blue-500', 'JavaScript': 'bg-yellow-400',
          'CSS': 'bg-pink-500', 'Sass': 'bg-pink-400', 'HTML': 'bg-orange-500',
          'JSON': 'bg-slate-400', 'YAML': 'bg-slate-400',
          'Python': 'bg-green-500', 'Go': 'bg-cyan-500', 'Rust': 'bg-red-500',
          'Java': 'bg-orange-600', 'C': 'bg-slate-500', 'C++': 'bg-blue-700'
      };
      return colors[lang] || 'bg-indigo-500';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 mb-20">
      
      {fullScreenImage && (
          <ImageViewer 
            src={fullScreenImage.src} 
            alt={fullScreenImage.alt} 
            onClose={() => setFullScreenImage(null)} 
          />
      )}

      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white font-orbitron leading-tight">
          GIT <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-600">FLOW</span>
        </h2>
        <p className="text-slate-400 text-lg md:text-xl font-light tracking-wide font-sans">
          Turn any repository into a fully analyzed, interactive architectural blueprint.
        </p>
      </div>

      {/* Input Section */}
      <div className="max-w-xl mx-auto relative z-10">
        <form onSubmit={handleAnalyze} className="glass-panel rounded-2xl p-2 transition-all duration-300 focus-within:border-indigo-500/50 focus-within:shadow-[0_0_20px_rgba(99,102,241,0.2)] bg-black/40">
          <div className="flex items-center">
             <div className="pl-3 text-indigo-500">
                <Command className="w-5 h-5" />
             </div>
             <input
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="owner/repository"
                className="w-full bg-transparent border-none text-white placeholder:text-slate-600 focus:ring-0 text-lg px-4 py-2 font-mono"
              />
              <div className="pr-2">
                <button
                type="submit"
                disabled={loading || !repoInput.trim()}
                className="px-6 py-2 bg-brand-gradient hover:opacity-90 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-orbitron text-sm tracking-wider shadow-[0_0_20px_rgba(234,88,12,0.4)]"
                >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ANALYZE"}
                </button>
             </div>
          </div>

          {/* Controls: Style and Language */}
          <div className="mt-2 pt-2 border-t border-white/5 px-3 pb-1 space-y-3">
             {/* Style Selector */}
             <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                 <div className="flex items-center gap-1.5 text-indigo-400 font-orbitron text-[10px] uppercase tracking-wider shrink-0">
                     <Palette className="w-3 h-3" /> Filter:
                 </div>
                 <div className="flex gap-2">
                     {FLOW_STYLES.map(style => (
                         <button
                            key={style}
                            type="button"
                            onClick={() => setSelectedStyle(style)}
                            className={`text-[10px] px-3 py-1.5 rounded-md font-mono transition-all whitespace-nowrap uppercase tracking-wide border ${
                                selectedStyle === style 
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                                : 'bg-white/5 text-slate-500 hover:text-slate-300 border-transparent hover:border-white/10'
                            }`}
                         >
                             {style}
                         </button>
                     ))}
                 </div>
             </div>
             
             {/* Language Selector & Custom Style Input */}
             <div className="flex flex-wrap gap-3">
               <div className="flex items-center gap-2 bg-slate-950/50 border border-white/10 rounded-lg px-3 py-1.5 shrink-0 min-w-0 max-w-full">
                  <Globe className="w-3 h-3 text-indigo-500 shrink-0" />
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="bg-transparent border-none text-xs text-slate-300 focus:ring-0 p-0 font-mono cursor-pointer min-w-0 flex-1 truncate uppercase"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value} className="bg-slate-900 text-slate-300">
                        {lang.label}
                      </option>
                    ))}
                  </select>
               </div>

               {selectedStyle === 'Custom' && (
                   <input 
                      type="text" 
                      value={customStyle}
                      onChange={(e) => setCustomStyle(e.target.value)}
                      placeholder="Custom style prompt..."
                      className="flex-1 min-w-[120px] bg-slate-950/50 border border-white/10 rounded-lg px-3 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 font-mono transition-all"
                   />
               )}
             </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto p-4 glass-panel border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 animate-in fade-in slide-in-from-top-2 font-mono text-sm bg-red-950/20">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <p className="flex-1">{error}</p>
          {error.includes("Required") && (
              <button 
                onClick={() => window.location.reload()}
                className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-xs font-bold transition-colors flex items-center gap-1 font-orbitron"
              >
                 <KeyRound className="w-3 h-3" /> RE-KEY
              </button>
          )}
        </div>
      )}

      {loading && (
        <LoadingState message={loadingStage} type="repo" />
      )}

      {/* Results Section */}
      {infographicData && !loading && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
          
          {/* Tech Stack Holograph - Only show if we have fresh tree data */}
          {techStackStats.length > 0 && (
              <div className="mb-6 glass-panel p-4 rounded-xl border border-indigo-500/10 flex items-center gap-4 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/20 to-transparent pointer-events-none"></div>
                  <div className="flex items-center gap-2 text-indigo-400 font-orbitron text-xs uppercase tracking-widest shrink-0 relative z-10">
                      <PieChart className="w-4 h-4" /> Code_DNA
                  </div>
                  <div className="flex-1 flex gap-1 h-2 rounded-full overflow-hidden bg-slate-900/50 relative z-10">
                      {techStackStats.map((stat, idx) => (
                          <div 
                              key={stat.lang} 
                              style={{ width: `${stat.percent}%` }} 
                              className={`${getLangColor(stat.lang)} h-full`} 
                              title={`${stat.lang}: ${Math.round(stat.percent)}%`}
                          />
                      ))}
                  </div>
                  <div className="flex gap-3 text-[10px] font-mono text-slate-400 shrink-0 relative z-10">
                       {techStackStats.slice(0, 3).map(stat => (
                           <div key={stat.lang} className="flex items-center gap-1.5">
                               <div className={`w-1.5 h-1.5 rounded-full ${getLangColor(stat.lang)}`}></div>
                               {stat.lang} <span className="opacity-50">{Math.round(stat.percent)}%</span>
                           </div>
                       ))}
                  </div>
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 2D Infographic Card */}
              <div className="glass-panel rounded-3xl p-1.5 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                 <div className="px-4 py-3 flex flex-wrap items-center justify-between border-b border-white/5 mb-1.5 gap-2 bg-slate-900/40 rounded-t-2xl">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 font-orbitron uppercase tracking-widest">
                      <Layers className="w-4 h-4 text-indigo-400" /> Logic_Layer
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setFullScreenImage({src: `data:image/png;base64,${infographicData}`, alt: `${currentRepoName} 2D`})}
                        className="text-xs flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-mono p-1.5 rounded-lg hover:bg-white/10"
                        title="Full Screen"
                      >
                        <Maximize className="w-4 h-4" />
                      </button>
                      <a href={`data:image/png;base64,${infographicData}`} download={`${currentRepoName}-infographic-2d.png`} className="text-xs flex items-center gap-2 text-indigo-300 hover:text-white transition-colors font-mono bg-indigo-500/10 px-3 py-1.5 rounded-lg hover:bg-indigo-500/20 border border-indigo-500/20 font-semibold uppercase tracking-wider">
                        <Download className="w-3 h-3" /> Save PNG
                      </a>
                    </div>
                </div>
                <div className="rounded-2xl overflow-hidden bg-[#eef8fe] relative group border border-slate-200/10">
                    {selectedStyle === "Neon Cyberpunk" && <div className="absolute inset-0 bg-slate-950 pointer-events-none mix-blend-multiply" />}
                    <div className="absolute inset-0 bg-slate-950/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <img src={`data:image/png;base64,${infographicData}`} alt="Repository Flow Diagram" className="w-full h-auto object-cover transition-opacity relative z-10" />
                </div>
              </div>

              {/* 3D Infographic Card */}
              <div className="glass-panel rounded-3xl p-1.5 flex flex-col border border-white/10">
                 <div className="px-4 py-3 flex flex-wrap items-center justify-between border-b border-white/5 mb-1.5 shrink-0 gap-2 bg-slate-900/40 rounded-t-2xl">
                    <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 font-orbitron uppercase tracking-widest">
                      <Box className="w-4 h-4 text-fuchsia-400" /> Holo_View
                    </h3>
                    {infographic3DData && (
                      <div className="flex items-center gap-2 animate-in fade-in">
                        <button 
                            onClick={() => setFullScreenImage({src: `data:image/png;base64,${infographic3DData}`, alt: `${currentRepoName} 3D`})}
                            className="text-xs flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-mono p-1.5 rounded-lg hover:bg-white/10"
                            title="Full Screen"
                        >
                            <Maximize className="w-4 h-4" />
                        </button>
                        <a href={`data:image/png;base64,${infographic3DData}`} download={`${currentRepoName}-infographic-3d.png`} className="text-xs flex items-center gap-2 text-slate-300 hover:text-white transition-colors font-mono bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 border border-white/10 font-semibold uppercase tracking-wider">
                          <Download className="w-3 h-3" /> Save PNG
                        </a>
                      </div>
                    )}
                </div>
                
                <div className="flex-1 rounded-2xl overflow-hidden bg-slate-950/30 relative flex items-center justify-center min-h-[300px] group">
                  {infographic3DData ? (
                      <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                         <div className="absolute inset-0 bg-slate-950/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10" />
                         <img src={`data:image/png;base64,${infographic3DData}`} alt="Repository 3D Flow Diagram" className="w-full h-full object-cover animate-in fade-in transition-opacity relative z-20" />
                      </div>
                  ) : generating3D ? (
                    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center animate-in fade-in">
                         <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500/50" />
                         <p className="text-fuchsia-300/50 font-orbitron text-xs animate-pulse tracking-widest">RENDERING HOLOGRAPHIC MODEL...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
                        <p className="text-slate-500 font-mono text-xs">Generate isometric tabletop perspective?</p>
                        <button 
                          onClick={handleGenerate3D}
                          className="px-6 py-3 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-xl font-bold transition-all flex items-center gap-2 font-orbitron text-sm uppercase tracking-wide shadow-[0_0_15px_rgba(217,70,239,0.2)] hover:shadow-[0_0_25px_rgba(217,70,239,0.4)]"
                        >
                          <Sparkles className="w-4 h-4" />
                          RENDER_MODEL
                        </button>
                    </div>
                  )}
                </div>
              </div>
          </div>
          
          {/* New Dev Studio Action Section */}
          <div className="mt-6 flex justify-center">
            <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.1)] max-w-2xl w-full">
                <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                    <Code2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className="text-white font-bold font-orbitron uppercase tracking-wide">Developer Studio</h3>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                        Interact with the live dependency graph and debug components with Gemini 3.0 Pro.
                    </p>
                </div>
                <button
                    onClick={launchDevStudio}
                    disabled={!currentFileTree}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/50 rounded-xl font-bold transition-all flex items-center gap-2 font-orbitron text-sm tracking-widest shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] hover:-translate-y-0.5"
                >
                    ENTER_STUDIO <ArrowRight className="w-4 h-4" />
                </button>
            </div>
          </div>

        </div>
      )}

      {/* History Section */}
      {history.length > 0 && (
          <div className="pt-12 border-t border-white/5 animate-in fade-in">
              <div className="flex items-center gap-2 mb-6 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <h3 className="text-sm font-orbitron uppercase tracking-widest">Recent Blueprints</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {history.map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => loadFromHistory(item)}
                        className="group bg-slate-900/40 border border-white/5 hover:border-indigo-500/50 rounded-xl overflow-hidden text-left transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                      >
                          <div className="aspect-video relative overflow-hidden bg-slate-950">
                              <img src={`data:image/png;base64,${item.imageData}`} alt={item.repoName} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                              {item.is3D && (
                                  <div className="absolute top-2 right-2 bg-fuchsia-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded font-orbitron">3D</div>
                              )}
                          </div>
                          <div className="p-3">
                              <p className="text-xs font-bold text-white truncate font-mono">{item.repoName}</p>
                              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{item.style}</p>
                          </div>
                      </button>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default RepoAnalyzer;