
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import { PenTool, Sparkles, Flame } from 'lucide-react';

interface IntroAnimationProps {
  onComplete: () => void;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhaseState] = useState<'warp' | 'formula' | 'logo' | 'reveal'>('warp');
  const phaseRef = useRef<'warp' | 'formula' | 'logo' | 'reveal'>('warp');
  const [formulaText, setFormulaText] = useState('');
  const typewriterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const setPhase = (newPhase: 'warp' | 'formula' | 'logo' | 'reveal') => {
    setPhaseState(newPhase);
    phaseRef.current = newPhase;
  };

  // Animation Sequence Timing
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setPhase('formula');
      typewriterEffect("ƒ(LINK) + AI → INK");
    }, 2500);

    const timer2 = setTimeout(() => {
      setPhase('logo');
    }, 5000);

    const timer3 = setTimeout(() => {
      setPhase('reveal');
    }, 6500);

    const timer4 = setTimeout(() => {
      onComplete();
    }, 7500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
    };
  }, [onComplete]);

  const typewriterEffect = (text: string) => {
    let i = 0;
    setFormulaText('');
    if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
    
    typewriterIntervalRef.current = setInterval(() => {
      setFormulaText(text.substring(0, i + 1));
      i++;
      if (i > text.length && typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
    }, 50);
  };

  // Canvas Warp Drive Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); 
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    
    canvas.width = width;
    canvas.height = height;

    const chars = "010101<>{}[]/\\Σ∫πƒ∆∇LINK2INK";
    const particles: { x: number; y: number; z: number; char: string; color: string }[] = [];
    const particleCount = 400; 
    
    // Initialize
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 5,
        y: (Math.random() - 0.5) * height * 5,
        z: Math.random() * 4000, 
        char: chars[Math.floor(Math.random() * chars.length)],
        // Orange and Red particles
        color: Math.random() > 0.5 ? '#f97316' : '#dc2626'
      });
    }

    let lastTime = performance.now();

    const render = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 16.67, 2.0); 
      lastTime = time;

      const currentPhase = phaseRef.current;

      if (currentPhase === 'reveal') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      } else {
          ctx.fillStyle = 'rgba(2, 6, 23, 0.4)'; 
      }
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      particles.forEach(p => {
        let baseSpeed = 60;
        
        if (currentPhase === 'formula') {
           baseSpeed = 5; 
        } else if (currentPhase === 'logo') {
           baseSpeed = 90;
        } else if (currentPhase === 'reveal') {
           baseSpeed = 180;
        }

        p.z -= baseSpeed * deltaTime;

        if (p.z <= 10) {
          p.z = 4000;
          p.x = (Math.random() - 0.5) * width * 5;
          p.y = (Math.random() - 0.5) * height * 5;
        }

        const perspective = 300;
        const k = perspective / p.z; 
        const px = p.x * k + cx;
        const py = p.y * k + cy;

        if (px >= -100 && px <= width + 100 && py >= -100 && py <= height + 100 && p.z > 10) {
          const size = (1 - p.z / 4000) * 30; 
          const alpha = (1 - p.z / 4000); 
          
          if (size > 1) {
              ctx.font = `bold ${size}px "Orbitron"`;
              ctx.fillStyle = p.color;
              ctx.globalAlpha = alpha;
              ctx.fillText(p.char, px, py);
              ctx.globalAlpha = 1.0;
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render(performance.now());

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center overflow-hidden transition-opacity duration-1000 ease-out ${phase === 'reveal' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Phase 2: The Formula */}
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 transform ${phase === 'formula' ? 'scale-100 opacity-100 blur-0' : 'scale-150 opacity-0 blur-xl pointer-events-none'}`}>
         <div className="relative group text-center px-4">
            <div className="absolute -inset-12 bg-orange-600/20 rounded-full blur-3xl animate-pulse"></div>
            <h1 className="relative text-3xl md:text-6xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-orange-200 to-red-200 tracking-widest drop-shadow-[0_0_25px_rgba(234,88,12,0.6)]">
              {formulaText}
              <span className="animate-pulse text-red-500">_</span>
            </h1>
         </div>
      </div>

      {/* Phase 3: The Graphic Logo */}
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${phase === 'logo' ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 -rotate-90 pointer-events-none'}`}>
          <div className="relative w-40 h-40 flex items-center justify-center">
             {/* Spinning Rings */}
             <div className="absolute inset-0 border-[6px] border-orange-600 rounded-full animate-[spin_4s_linear_infinite] border-t-transparent border-l-transparent opacity-90 shadow-[0_0_30px_rgba(234,88,12,0.4)]"></div>
             <div className="absolute inset-3 border-[4px] border-red-500 rounded-full animate-[spin_3s_linear_infinite_reverse] border-b-transparent border-r-transparent opacity-90 shadow-[0_0_30px_rgba(220,38,38,0.4)]"></div>
             <div className="absolute inset-[-20px] border-[1px] border-white/10 rounded-full animate-pulse"></div>
             
             {/* Center Icon */}
             <div className="bg-slate-950 p-8 rounded-3xl border border-white/20 shadow-[0_0_60px_rgba(234,88,12,0.6)] relative z-10">
                <Flame className="w-16 h-16 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
             </div>
          </div>
      </div>

      {/* Final Flash White Overlay */}
      <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-1000 ease-in ${phase === 'reveal' ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
};

export default IntroAnimation;
