'use client'

import { SpiralAnimation } from "@/components/ui/spiral-animation"
import { Squares } from "@/components/ui/squares-background"
import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'

const Splash = () => {
  const [startVisible, setStartVisible] = useState(false)
  const [, setLocation] = useLocation()

  // Navigate to main app
  const enterApp = () => {
    // Mark that user has seen the splash screen
    sessionStorage.setItem('splashSeen', 'true')
    setLocation('/landing')
  }

  // Check if user has already seen splash screen
  useEffect(() => {
    const splashSeen = sessionStorage.getItem('splashSeen')
    if (splashSeen === 'true') {
      // Skip splash and go directly to landing
      setLocation('/landing')
      return
    }
  }, [setLocation])

  // Fade in the start button after animation loads
  useEffect(() => {
    const timer = setTimeout(() => {
      setStartVisible(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
      {/* Squares Background */}
      <div className="absolute inset-0 z-0 opacity-30">
        <Squares 
          direction="diagonal"
          speed={0.3}
          squareSize={50}
          borderColor="#1a1a1a"
          hoverFillColor="#0a0a0a"
        />
      </div>
      
      {/* Spiral Animation */}
      <div className="absolute inset-0 z-10">
        <SpiralAnimation />
      </div>

      {/* Logo in center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        <img 
          src="/Images/logo.png" 
          alt="RepoRadar Logo" 
          className="w-64 h-64 object-contain animate-pulse drop-shadow-2xl"
          onError={(e) => {
            // Fallback to text logo if image not found
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent) {
              const fallback = document.createElement('div')
              fallback.className = 'text-white text-6xl font-bold tracking-wider'
              fallback.textContent = 'RepoRadar'
              parent.appendChild(fallback)
            }
          }}
        />
      </div>

      {/* Enter Button */}
      <div 
        className={`absolute left-1/2 bottom-32 -translate-x-1/2 z-20
          transition-all duration-1500 ease-out
          ${startVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        <button 
          onClick={enterApp}
          className="text-white text-2xl tracking-[0.2em] uppercase font-extralight
            transition-all duration-700 hover:tracking-[0.3em] animate-pulse
            hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:ring-offset-2 focus:ring-offset-black px-8 py-3 rounded-lg"
        >
          Enter
        </button>
      </div>
    </div>
  )
}

export default Splash
