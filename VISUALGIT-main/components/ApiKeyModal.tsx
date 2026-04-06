
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Shield, ExternalLink, CreditCard, Loader2, KeyRound, AlertTriangle } from 'lucide-react';

interface ApiKeyModalProps {
  onKeySelected: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onKeySelected }) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        setTimeout(() => {
            onKeySelected();
        }, 500);
      }
    } catch (e) {
      console.error("Failed to open key selector", e);
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4">
      <div className="w-full max-w-md relative overflow-hidden glass-panel rounded-3xl border border-red-600/50 shadow-[0_0_80px_rgba(220,38,38,0.3)] animate-in fade-in zoom-in-95 duration-300 bg-slate-900/80">
        
        {/* Decorative Background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="p-8 relative z-10 flex flex-col items-center text-center space-y-6">
          
          <div className="w-20 h-20 bg-slate-950/50 rounded-2xl flex items-center justify-center border border-red-500/50 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
             <KeyRound className="w-10 h-10 text-red-500" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white font-orbitron uppercase tracking-wider">Access Restricted</h2>
            <p className="text-slate-400 text-sm leading-relaxed font-sans">
              VisualGit employs advanced <span className="text-orange-400 font-bold">Image Generation</span> models requiring verified authentication.
            </p>
          </div>

          <div className="w-full p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-left">
             <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
             <div className="space-y-1">
                 <p className="text-xs font-bold text-red-400 uppercase tracking-widest font-orbitron">Paid Project Required</p>
                 <p className="text-xs text-red-200/70 leading-relaxed font-mono">
                    Please select an API key linked to a <strong>Google Cloud Billing Project</strong>.
                 </p>
             </div>
          </div>

          <button 
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 border-none text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center gap-2 group disabled:opacity-70 font-orbitron tracking-widest text-sm"
          >
            {isConnecting ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin" /> VERIFYING...
                </>
            ) : (
                <>
                    <CreditCard className="w-5 h-5" /> AUTHENTICATE
                </>
            )}
          </button>

          <div className="pt-4 border-t border-white/5 w-full">
             <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors font-mono"
             >
                Documentation <ExternalLink className="w-3 h-3" />
             </a>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;