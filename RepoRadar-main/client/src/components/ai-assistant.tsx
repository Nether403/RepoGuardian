import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI assistant. I can help you understand RepoAnalyzer's features, guide you through analysis, and answer any questions about repository metrics. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const askAIMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });
      if (!response.ok) throw new Error('Failed to get AI response');
      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date()
      }]);
      setIsTyping(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
      setIsTyping(false);
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    askAIMutation.mutate(input);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group relative w-16 h-16 rounded-full bg-gradient-to-r from-primary to-secondary p-[2px] shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-110"
          data-testid="button-ai-assistant"
          data-tour="ai-assistant"
        >
          <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
            <div className="relative">
              <img 
                src="/Images/Gemini2.png" 
                alt="AI Assistant" 
                className="w-8 h-8 object-contain"
              />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="absolute -top-12 right-0 bg-card text-foreground text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border">
            AI Assistant
          </div>
        </button>
      </div>

      {/* AI Assistant Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px]">
          <div className="relative w-full h-full">
            {/* Subtle Background Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 rounded-2xl"></div>
            
            {/* Border */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary via-secondary to-accent p-[1px]">
              <div className="w-full h-full rounded-2xl bg-card/95 backdrop-blur-xl">
                {/* Header */}
                <div className="relative flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center">
                        <img 
                          src="/Images/Gemini2.png" 
                          alt="AI Assistant" 
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">AI Assistant</h3>
                      <p className="text-xs text-muted-foreground">Powered by Gemini 2.5</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </div>

                {/* Messages */}
                <ScrollArea ref={scrollRef} className="h-[440px] p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                          <div
                            className={`p-3 rounded-lg ${
                              message.role === 'user'
                                ? 'bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 text-foreground'
                                : 'bg-muted/50 border border-border text-foreground'
                            } backdrop-blur-sm`}
                          >
                            {message.content}
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-muted/50 border border-border p-3 rounded-lg">
                          <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-secondary rounded-full animate-bounce animation-delay-200"></div>
                            <div className="w-2 h-2 bg-accent rounded-full animate-bounce animation-delay-400"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card/80 backdrop-blur-sm rounded-b-2xl">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex space-x-2"
                  >
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask me anything..."
                      className="flex-1 bg-background border-border text-foreground placeholder-muted-foreground"
                      disabled={isTyping}
                      data-testid="input-ai-question"
                    />
                    <Button
                      type="submit"
                      disabled={!input.trim() || isTyping}
                      className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                      data-testid="button-ai-send"
                    >
                      <i className="fas fa-paper-plane"></i>
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animation-delay-200 {
          animation-delay: 200ms;
        }

        .animation-delay-400 {
          animation-delay: 400ms;
        }
      `}</style>
    </>
  );
}