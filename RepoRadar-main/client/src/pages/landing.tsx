import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to home
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation('/home');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleGetStarted = () => {
    setLocation('/handler/sign-in');
  };
  return (
    <div className="min-h-screen bg-dark text-white">
      <Header />
      {/* Hero Section */}
      <section className="relative pt-48 pb-32 bg-gradient-to-b from-dark via-card to-dark overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 animate-glow"></div>
        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-3 mb-8">
            <div className="w-32 h-32 rounded-2xl flex items-center justify-center animate-float">
              <img 
                src="/Images/Gitradartrans.png" 
                alt="RepoRadar logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-6xl font-bold gradient-text">RepoRadar</h1>
          </div>
          
          <h2 className="text-5xl font-bold mb-8 leading-tight">
            Discover & Analyze
            <br />
            <span className="gradient-text">GitHub Repositories</span>
          </h2>
          
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            AI-powered analysis of originality, completeness, marketability, and monetization potential. 
            Make informed decisions about repositories with comprehensive insights powered by Gemini 2.5 Pro.
          </p>
          
          <div className="flex items-center justify-center space-x-6 mb-16">
            <Button
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white px-12 py-4 rounded-xl text-lg font-semibold transition-all duration-300 neon-glow"
              data-testid="button-login"
            >
              Get Started Free
            </Button>
            <Button
              variant="outline"
              className="border-2 border-primary/30 text-primary hover:bg-primary/10 px-8 py-4 rounded-xl text-lg font-medium transition-all duration-300"
              data-testid="button-learn-more"
            >
              Learn More
            </Button>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <img 
                    src="/Images/Gemini2.png" 
                    alt="AI-Powered Analysis" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-xl font-semibold mb-2">AI-Powered Analysis</h3>
                <p className="text-gray-400">Gemini 2.5 Pro evaluates repositories across 5 key metrics</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <img 
                    src="/Images/metrics2.png" 
                    alt="Comprehensive Metrics" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-xl font-semibold mb-2">Comprehensive Metrics</h3>
                <p className="text-gray-400">Analyze originality, completeness, marketability, and more</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <img 
                    src="/Images/compare2.png" 
                    alt="Smart Comparison" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-xl font-semibold mb-2">Smart Comparison</h3>
                <p className="text-gray-400">Compare repositories side-by-side with detailed breakdowns</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gradient-to-b from-card to-dark">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold gradient-text mb-4">Powerful Analysis Tools</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Everything you need to make informed decisions about GitHub repositories
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                  <img 
                    src="/Images/GreenOctoCat.png" 
                    alt="Repository Discovery" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Repository Discovery</h3>
                  <p className="text-gray-400">
                    Search and discover repositories with advanced filtering and trending insights.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                  <img 
                    src="/Images/Gemini2.png" 
                    alt="AI Evaluation" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">AI Evaluation</h3>
                  <p className="text-gray-400">
                    Get comprehensive analysis with scores for originality, completeness, and market potential.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                  <img 
                    src="/Images/save2.png" 
                    alt="Save & Organize" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Save & Organize</h3>
                  <p className="text-gray-400">
                    Bookmark interesting repositories and track your analysis history.
                  </p>
                </div>
              </div>
            </div>

            <div className="gradient-border">
              <div className="bg-card rounded-xl p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold">Sample Analysis</h4>
                  <div className="text-2xl font-bold gradient-text">8.9</div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Originality</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="w-5/6 h-full bg-gradient-to-r from-primary to-secondary"></div>
                      </div>
                      <span className="text-primary font-semibold">8.7</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Completeness</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-r from-green-400 to-blue-500"></div>
                      </div>
                      <span className="text-green-400 font-semibold">9.4</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Marketability</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="w-11/12 h-full bg-gradient-to-r from-accent to-primary"></div>
                      </div>
                      <span className="text-accent font-semibold">9.1</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-dark via-card to-dark">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-gray-300 mb-10">
            Join thousands of developers making smarter repository decisions
          </p>
          <Button
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white px-12 py-4 rounded-xl text-lg font-semibold transition-all duration-300 neon-glow"
            data-testid="button-get-started"
          >
            Start Analyzing Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                  <img 
                    src="/Images/Gitradartrans.png" 
                    alt="RepoRadar" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-xl font-bold gradient-text">RepoAnalyzer</h3>
              </div>
              <p className="text-gray-400 text-sm">AI-powered GitHub repository analysis platform.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Repository Search</li>
                <li>AI Analysis</li>
                <li>Comparison Tool</li>
                <li>Similar Repos</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Documentation</li>
                <li>API Reference</li>
                <li>Community</li>
                <li>Support</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>About</li>
                <li>Blog</li>
                <li>Privacy</li>
                <li>Terms</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 mt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2024 RepoAnalyzer. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
