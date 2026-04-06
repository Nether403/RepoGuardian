/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { editImageWithGemini } from '../services/geminiService';
import { ViewMode } from '../types';
import { Upload, Wand2, Loader2, Download, ImageIcon, Palette, Terminal, ArrowLeft } from 'lucide-react';

const STYLE_PRESETS = [
  "Neon Cyberpunk",
  "Minimalist Blueprint",
  "Hand-drawn Sketch",
  "Futuristic HUD",
  "Vintage Sci-Fi"
];

interface ImageEditorProps {
  initialState?: { data: string; mimeType: string } | null;
  onNavigate?: (mode: ViewMode) => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ initialState, onNavigate }) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [processing, setProcessing] = useState(false);
  const [editedImageData, setEditedImageData] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialState) {
      setImageData(initialState.data);
      setMimeType(initialState.mimeType);
      setEditedImageData(null);
    }
  }, [initialState]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        setImageData(base64Data);
        setMimeType(file.type);
        setEditedImageData(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageData || !prompt) return;

    setProcessing(true);
    try {
      const resultBase64 = await editImageWithGemini(imageData, mimeType, prompt);
      if (resultBase64) {
        setEditedImageData(resultBase64);
      } else {
        alert('Could not generate edited image.');
      }
    } catch (error) {
      alert('An error occurred while processing.');
    } finally {
      setProcessing(false);
    }
  }, [imageData, mimeType, prompt]);

  const applyStylePreset = (style: string) => {
    setPrompt(`Redraw this exact infographic in a ${style} style. Maintain all text labels, connection lines, and overall structure accurately, but change the visual theme completely to match ${style}.`);
  };

  const triggerUpload = () => inputRef.current?.click();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center max-w-3xl mx-auto space-y-6 mb-12">
        <h2 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-300 via-pink-300 to-slate-500 font-sans">
          Reality <span className="text-pink-500">Engine</span>.
        </h2>
        <p className="text-slate-400 text-lg font-light tracking-wide">
          Apply custom styles and manipulate architectural visualizations.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* Input Column */}
        <div className="space-y-6">
          {/* Upload Area */}
          <div 
            onClick={triggerUpload}
            className={`group glass-panel rounded-3xl aspect-[4/3] flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden ${
              imageData 
                ? 'border-pink-500/30' 
                : 'hover:border-pink-400/30 hover:bg-white/5'
            }`}
          >
            {imageData ? (
              <>
                <img src={`data:${mimeType};base64,${imageData}`} alt="Source" className="h-full w-full object-contain p-4 relative z-10" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 backdrop-blur-md">
                  <p className="text-white font-medium flex items-center gap-2 font-mono text-sm">
                    <Upload className="w-4 h-4" /> CHANGE_SOURCE
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center p-6 space-y-6 flex flex-col items-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900/50 border border-white/10 flex items-center justify-center group-hover:scale-105 transition-all shadow-lg">
                   <Upload className="w-6 h-6 text-slate-400 group-hover:text-pink-400 transition-colors" />
                </div>
                <div>
                  <p className="text-slate-300 font-medium text-lg font-sans">Drop source image</p>
                  <p className="text-slate-500 text-xs mt-2 font-mono uppercase tracking-wider mb-4">PNG / JPG supported</p>
                  {onNavigate && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onNavigate(ViewMode.REPO_ANALYZER); }}
                        className="px-4 py-2 bg-white/5 hover:bg-pink-500/10 text-slate-300 hover:text-pink-300 border border-white/10 hover:border-pink-500/30 rounded-lg transition-all text-sm font-mono flex items-center gap-2"
                      >
                          <Terminal className="w-4 h-4" /> Generate in Analyzer
                      </button>
                  )}
                </div>
              </div>
            )}
             <input ref={inputRef} type="file" accept="image/png, image/jpeg" onChange={handleFileChange} className="hidden" />
          </div>

          {/* Control Panel */}
          <div className={`glass-panel p-1.5 rounded-3xl transition-all duration-500 ${imageData ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 pointer-events-none filter blur-sm'}`}>
             <div className="bg-slate-900/50 rounded-2xl p-5 space-y-6">
               
               {/* Style Presets */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-pink-400 font-mono text-xs">
                    <Palette className="w-3 h-3" />
                    <span>STYLE_FILTERS</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {STYLE_PRESETS.map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => applyStylePreset(style)}
                        className="text-[11px] px-3 py-2 bg-slate-800/50 hover:bg-pink-500/20 hover:text-pink-300 text-slate-400 rounded-lg transition-all border border-white/5 hover:border-pink-500/30 font-mono text-left truncate"
                      >
                        {style}
                      </button>
                    ))}
                  </div>
               </div>

               {/* Prompt Input */}
               <form onSubmit={handleEdit} className="space-y-4 border-t border-white/5 pt-4">
                  <div className="flex items-center gap-2 text-pink-400 font-mono text-xs">
                      <Terminal className="w-3 h-3" />
                      <span>EXECUTION_PROMPT</span>
                  </div>
                  <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe desired transformation or select a style above..."
                      className="w-full h-24 bg-slate-950/50 rounded-xl border border-white/10 p-3 text-slate-200 placeholder:text-slate-700 focus:ring-1 focus:ring-pink-500/50 focus:border-pink-500/50 resize-none font-mono text-sm leading-relaxed"
                    />
                  
                  <button
                    type="submit"
                    disabled={processing || !imageData || !prompt}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 font-mono text-sm"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wand2 className="w-4 h-4 text-pink-400" /> RUN_TRANSFORMATION</>}
                  </button>
               </form>
            </div>
          </div>
        </div>

        {/* Output Column */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <div className="glass-panel rounded-3xl aspect-[4/3] flex items-center justify-center overflow-hidden relative p-1.5">
            <div className="w-full h-full bg-slate-950/50 rounded-2xl flex items-center justify-center overflow-hidden relative">
                {processing ? (
                <div className="text-center space-y-6 relative z-10">
                    <div className="relative mx-auto w-12 h-12">
                        <Loader2 className="w-12 h-12 animate-spin text-pink-500 relative opacity-50" />
                    </div>
                    <p className="text-pink-300 font-mono text-xs animate-pulse tracking-widest">PROCESSING...</p>
                </div>
                ) : editedImageData ? (
                <img src={`data:image/png;base64,${editedImageData}`} alt="Edited" className="h-full w-full object-contain animate-in fade-in zoom-in-95 duration-700" />
                ) : (
                <div className="text-center text-slate-700 flex flex-col items-center">
                    <ImageIcon className="w-12 h-12 opacity-20 mb-4" />
                    <p className="font-mono text-xs uppercase tracking-widest opacity-50">Awaiting Output</p>
                </div>
                )}
            </div>
          </div>

          {editedImageData && !processing && (
            <a 
              href={`data:image/png;base64,${editedImageData}`}
              download="edited-image.png"
              className="glass-panel w-full py-3 text-white hover:bg-white/10 rounded-xl font-bold text-center transition-all flex items-center justify-center gap-2 font-mono text-sm"
            >
              <Download className="w-4 h-4" /> DOWNLOAD_RESULT
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
