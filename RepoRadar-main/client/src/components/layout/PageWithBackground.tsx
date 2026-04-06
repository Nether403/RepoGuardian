import { ReactNode } from "react";
import { Squares } from "@/components/ui/squares-background";

interface PageWithBackgroundProps {
  children: ReactNode;
  className?: string;
}

export function PageWithBackground({ children, className = "" }: PageWithBackgroundProps) {
  return (
    <div className={`relative min-h-screen bg-dark text-white overflow-hidden ${className}`}>
      <div className="absolute inset-0 z-0">
        <Squares 
          direction="diagonal"
          speed={0.4}
          squareSize={40}
          borderColor="#222"
          hoverFillColor="#1a1a1a"
        />
      </div>
      
      <div className="relative z-10 pt-24">
        {children}
      </div>
    </div>
  );
}
