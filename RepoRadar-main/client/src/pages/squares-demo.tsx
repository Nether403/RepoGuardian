import { Squares } from "@/components/ui/squares-background";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";

export default function SquaresDemo() {
  return (
    <div className="min-h-screen bg-dark text-white">
      <Header />
      <div className="container mx-auto px-6 py-12 pt-32">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold gradient-text mb-4">Squares Background Component</h1>
          <p className="text-gray-400 text-lg">
            Interactive animated grid backgrounds with hover effects
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Diagonal Movement */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Diagonal Movement</CardTitle>
              <CardDescription>Default diagonal animation with hover effect</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[400px] rounded-lg overflow-hidden bg-[#060606]">
                <Squares 
                  direction="diagonal"
                  speed={0.5}
                  squareSize={40}
                  borderColor="#333"
                  hoverFillColor="#222"
                />
              </div>
            </CardContent>
          </Card>

          {/* Right Movement */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Right Movement</CardTitle>
              <CardDescription>Horizontal scrolling to the right</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[400px] rounded-lg overflow-hidden bg-[#060606]">
                <Squares 
                  direction="right"
                  speed={1}
                  squareSize={40}
                  borderColor="#444"
                  hoverFillColor="#333"
                />
              </div>
            </CardContent>
          </Card>

          {/* Up Movement */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Upward Movement</CardTitle>
              <CardDescription>Vertical scrolling upward</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[400px] rounded-lg overflow-hidden bg-[#060606]">
                <Squares 
                  direction="up"
                  speed={0.8}
                  squareSize={50}
                  borderColor="#2a2a2a"
                  hoverFillColor="#1a1a1a"
                />
              </div>
            </CardContent>
          </Card>

          {/* Custom Colors */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Custom Colors</CardTitle>
              <CardDescription>Blue-themed grid with custom hover</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[400px] rounded-lg overflow-hidden bg-[#060606]">
                <Squares 
                  direction="diagonal"
                  speed={0.3}
                  squareSize={35}
                  borderColor="#1e40af"
                  hoverFillColor="#1e3a8a"
                />
              </div>
            </CardContent>
          </Card>

          {/* Large Squares */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Large Squares</CardTitle>
              <CardDescription>Bigger grid cells with slower movement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[400px] rounded-lg overflow-hidden bg-[#060606]">
                <Squares 
                  direction="left"
                  speed={0.4}
                  squareSize={60}
                  borderColor="#555"
                  hoverFillColor="#444"
                />
              </div>
            </CardContent>
          </Card>

          {/* Fast Animation */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Fast Animation</CardTitle>
              <CardDescription>High-speed diagonal movement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[400px] rounded-lg overflow-hidden bg-[#060606]">
                <Squares 
                  direction="diagonal"
                  speed={2}
                  squareSize={30}
                  borderColor="#666"
                  hoverFillColor="#555"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Example */}
        <Card className="bg-card border-border mt-12">
          <CardHeader>
            <CardTitle>Usage Example</CardTitle>
            <CardDescription>How to use the Squares component in your code</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-[#060606] p-6 rounded-lg overflow-x-auto text-sm">
              <code className="text-gray-300">{`import { Squares } from "@/components/ui/squares-background";

export function MyComponent() {
  return (
    <div className="relative h-[400px]">
      <Squares 
        direction="diagonal"    // "right" | "left" | "up" | "down" | "diagonal"
        speed={0.5}             // Animation speed (default: 1)
        squareSize={40}         // Size of each square in pixels (default: 40)
        borderColor="#333"      // Border color (default: "#333")
        hoverFillColor="#222"   // Fill color on hover (default: "#222")
      />
    </div>
  );
}`}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
