/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { generateArticleInfographic } from '../services/geminiService';
import { Citation, ArticleHistoryItem } from '../types';
import { Link, Loader2, Download, Sparkles, AlertCircle, Palette, Globe, ExternalLink, BookOpen, Clock, Maximize, FileText } from 'lucide-react';
import { LoadingState } from './LoadingState';
import ImageViewer from './ImageViewer';

interface ArticleToInfographicProps {
    history: ArticleHistoryItem[];
    onAddToHistory: (item: ArticleHistoryItem) => void;
}

const SKETCH_STYLES = [
    "Modern Editorial",
    "Fun & Playful",
    "Clean Minimalist",
    "Dark Mode Tech",
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

const ArticleToInfographic: React.FC<ArticleToInfographicProps> = ({ history, onAddToHistory }) => {
  const [urlInput, setUrlInput] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(SKETCH_STYLES[0]);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].value);
  const [customStyle, setCustomStyle] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState('');
  
  // Viewer State
  const [fullScreenImage, setFullScreenImage] = useState<{src: string, alt: string} | null>(null);

  const addToHistory = (url: string, image: string, cites: Citation[], sum: string) => {
      let title = url;
      try { title = new URL(url).hostname; } catch(e) {}
      
      const newItem: ArticleHistoryItem = {
          id: Date.now().toString(),
          title: title,
          url,
          imageData: image,
          citations: cites,
          summary: sum,
          date: new Date()
      };
      onAddToHistory(newItem);
  };

  const loadFromHistory = (item: ArticleHistoryItem) => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setUrlInput(item.url);
      setImageData(item.imageData);
      setCitations(item.citations);
      setSummary(item.summary || "");
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
        setError("Please provide a valid URL.");
        return;
    }
    
    setLoading(true);
    setError(null);
    setImageData(null);
    setCitations([]);
    setSummary('');
    setLoadingStage('INITIALIZING...');

    try {
      const styleToUse = selectedStyle === 'Custom' ? customStyle : selectedStyle;
      const { imageData: resultImage, citations: resultCitations, summary: resultSummary } = await generateArticleInfographic(urlInput, styleToUse, (stage) => {
          setLoadingStage(stage);
      }, selectedLanguage);
      
      if (resultImage) {
          setImageData(resultImage);
          setCitations(resultCitations);
          setSummary(resultSummary);
          addToHistory(urlInput, resultImage, resultCitations, resultSummary);
      } else {
          throw new Error("Failed to generate infographic image. The URL might be inaccessible.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 mb-20">
      
      {fullScreenImage && (
          <ImageViewer 
            src={fullScreenImage.src} 
            alt={fullScreenImage.alt} 
            onClose={() => setFullScreenImage(null)} 
          />
      )}

      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <h2 className="text-5xl md:text-6xl font-black tracking-tight text-white font-orbitron">
          SITE <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">SKETCH</span>
        </h2>
        <p className="text-slate-400 text-lg md:text-xl font-light tracking-wide font-sans">
          Turn any article, documentation page, or blog post into a stunning, easy-to-digest infographic.
        </p>
      </div>

      {/* Input Section */}
      <div className="glass-panel rounded-3xl p-6 md:p-10 space-y-8 relative z-10 border border-orange-500/20 shadow-[0_0_40px_rgba(234,88,12,0.1)]">
         <form onSubmit={handleGenerate} className="space-y-8">
            <div className="space-y-4">
                <label className="text-xs text-orange-400 font-orbitron tracking-widest flex items-center gap-2 uppercase">
                    <Link className="w-4 h-4" /> Source_URL
                </label>
                <div className="relative">
                    <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/interesting-article"
                        className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-6 py-5 text-lg text-slate-200 placeholder:text-slate-600 focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 font-mono transition-all shadow-inner focus:shadow-[0_0_20px_rgba(234,88,12,0.2)]"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-700">
                        <Sparkles className="w-5 h-5 opacity-50" />
                    </div>
                </div>
            </div>

            {/* Style & Language Controls */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Style Selector */}
                <div className="space-y-4">
                     <label className="text-xs text-orange-400 font-orbitron tracking-widest flex items-center gap-2 uppercase">
                        <Palette className="w-4 h-4" /> Visual_Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {SKETCH_STYLES.map(style => (
                            <button
                                key={style}
                                type="button"
                                onClick={() => setSelectedStyle(style)}
                                className={`py-2 px-2 rounded-xl font-mono text-[11px] transition-all border whitespace-nowrap truncate uppercase tracking-wider ${
                                    selectedStyle === style 
                                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/30 shadow-[0_0_10px_rgba(234,88,12,0.2)]' 
                                    : 'bg-slate-900/50 text-slate-500 border-white/5 hover:border-white/10 hover:text-slate-300'
                                }`}
                            >
                                {style}
                            </button>
                        ))}
                    </div>
                     {selectedStyle === 'Custom' && (
                         <input 
                            type="text" 
                            value={customStyle}
                            onChange={(e) => setCustomStyle(e.target.value)}
                            placeholder="Describe custom style..."
                            className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 font-mono transition-all"
                         />
                     )}
                </div>

                 {/* Language Selector */}
                 <div className="space-y-4 min-w-0">
                     <label className="text-xs text-orange-400 font-orbitron tracking-widest flex items-center gap-2 uppercase">
                        <Globe className="w-4 h-4" /> Output_Lang
                    </label>
                    <div className="relative w-full min-w-0">
                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 font-mono appearance-none cursor-pointer hover:bg-white/5 transition-colors truncate pr-8"
                        >
                             {LANGUAGES.map((lang) => (
                                <option key={lang.value} value={lang.value} className="bg-slate-900 text-slate-300">
                                    {lang.label}
                                </option>
                             ))}
                        </select>
                         <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                 </div>
            </div>

            <button
                type="submit"
                disabled={loading || !urlInput.trim()}
                className="w-full py-5 bg-brand-gradient hover:opacity-90 border-none text-white rounded-2xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-orbitron text-lg tracking-widest shadow-[0_0_30px_rgba(220,38,38,0.4)]"
            >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                {loading ? "PROCESSING..." : "IGNITE GENERATION"}
            </button>
         </form>
      </div>

      {error && (
        <div className="glass-panel border-red-500/30 p-4 rounded-xl flex items-center gap-3 text-red-400 animate-in fade-in font-mono text-sm bg-red-950/30">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <LoadingState message={loadingStage || 'READING_CONTENT'} type="article" />
      )}

      {/* Result Section */}
      {imageData && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Image Panel */}
            <div className="lg:col-span-2 glass-panel rounded-3xl p-1.5 border border-orange-500/20 shadow-[0_0_30px_rgba(234,88,12,0.1)]">
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 mb-1.5 bg-slate-900/30 rounded-t-2xl">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 font-orbitron uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-orange-400" /> Output_Sketch
                    </h3>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setFullScreenImage({src: `data:image/png;base64,${imageData}`, alt: "Article Sketch"})}
                            className="text-xs flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-mono p-1.5 rounded-lg hover:bg-white/10"
                            title="Full Screen"
                        >
                            <Maximize className="w-4 h-4" />
                        </button>
                        <a href={`data:image/png;base64,${imageData}`} download="site-sketch.png" className="text-xs flex items-center gap-2 text-orange-300 hover:text-orange-200 transition-colors font-mono bg-orange-500/10 px-4 py-2 rounded-xl border border-orange-500/20 font-bold uppercase tracking-wider">
                            <Download className="w-4 h-4" /> PNG
                        </a>
                    </div>
                </div>
                <div className="rounded-2xl overflow-hidden bg-[#eef8fe] relative group">
                    {selectedStyle === "Dark Mode Tech" && <div className="absolute inset-0 bg-slate-950 pointer-events-none mix-blend-multiply" />}
                    <div className="absolute inset-0 bg-slate-950/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <img src={`data:image/png;base64,${imageData}`} alt="Generated Infographic" className="w-full h-auto object-contain max-h-[800px] mx-auto relative z-10" />
                </div>
            </div>

            {/* Executive Brief & Citations Column */}
            <div className="space-y-6">
                
                {/* Executive Brief */}
                {summary && (
                    <div className="glass-panel rounded-2xl p-6 border border-white/10 flex flex-col h-fit">
                         <div className="flex items-center gap-2 mb-4 text-orange-400">
                             <FileText className="w-4 h-4" />
                             <h4 className="text-xs font-bold font-orbitron uppercase tracking-widest">Executive Brief</h4>
                         </div>
                         <div className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             {summary}
                         </div>
                    </div>
                )}

                {/* Citations */}
                {citations.length > 0 && (
                    <div className="glass-panel rounded-2xl p-6 border border-white/10 h-fit">
                        <div className="flex items-center gap-2 mb-4 text-indigo-400">
                            <BookOpen className="w-4 h-4" />
                            <h4 className="text-xs font-bold font-orbitron uppercase tracking-widest">Grounding</h4>
                        </div>
                        <div className="space-y-3">
                            {citations.slice(0, 5).map((cite, idx) => {
                                let hostname = cite.uri;
                                try { hostname = new URL(cite.uri).hostname; } catch (e) {}
                                return (
                                    <a 
                                        key={idx} 
                                        href={cite.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 bg-slate-950/40 hover:bg-white/5 rounded-xl border border-white/5 hover:border-orange-500/30 transition-all group"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-slate-500 group-hover:text-orange-400">
                                            <Globe className="w-3 h-3" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-300 truncate group-hover:text-white">{cite.title || "Source"}</p>
                                            <p className="text-[10px] text-slate-500 truncate font-mono">{hostname}</p>
                                        </div>
                                    </a>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
      
      {/* History Section */}
      {history.length > 0 && (
          <div className="pt-12 border-t border-white/5 animate-in fade-in">
              <div className="flex items-center gap-2 mb-6 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <h3 className="text-sm font-orbitron uppercase tracking-widest">Recent Sketches</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {history.map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => loadFromHistory(item)}
                        className="group bg-slate-900/40 border border-white/5 hover:border-orange-500/50 rounded-xl overflow-hidden text-left transition-all hover:shadow-[0_0_20px_rgba(234,88,12,0.2)]"
                      >
                          <div className="aspect-video relative overflow-hidden bg-slate-950">
                              <img src={`data:image/png;base64,${item.imageData}`} alt={item.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="p-3">
                              <p className="text-xs font-bold text-white truncate font-mono">{item.title}</p>
                              <p className="text-[10px] text-slate-500 mt-1 truncate">{new URL(item.url).hostname}</p>
                          </div>
                      </button>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default ArticleToInfographic;