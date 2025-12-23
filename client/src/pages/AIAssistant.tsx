import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertCircle,
  Bot,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Hello! I'm your RF signal intelligence assistant. I can help you analyze spectrum data, identify signals, detect modulation schemes, and provide measurement recommendations. What would you like to know about your current RF environment?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInputValue("");

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: messages.length + 2,
        role: "assistant",
        content:
          "Based on the current spectrum analysis at 915 MHz, I detect a strong carrier signal with approximately 20 kHz bandwidth. The signal characteristics suggest FSK modulation with a deviation of ±10 kHz. This is consistent with ISM band telemetry systems. Would you like me to provide more detailed analysis or suggest optimal receiver settings?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="h-[calc(100vh-8rem)] p-4">
      <div className="max-w-7xl mx-auto h-full flex gap-4">
        {/* Main Chat Interface */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 bg-card border-border flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <span className="neon-glow-pink text-primary">
                  AI SIGNAL INTELLIGENCE
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
              {/* Messages Area */}
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === "user" ? "justify-end" : ""
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full border-2 border-secondary flex items-center justify-center flex-shrink-0 box-glow-cyan">
                          <Bot className="w-4 h-4 text-secondary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === "user"
                            ? "bg-primary/20 border border-primary/50"
                            : "bg-black/50 border border-secondary/30"
                        }`}
                      >
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {message.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      {message.role === "user" && (
                        <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0 box-glow-pink">
                          <span className="text-xs font-bold text-primary">
                            U
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about signal characteristics, modulation, or measurements..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="bg-input border-border flex-1"
                />
                <Button
                  onClick={handleSend}
                  className="gap-2 box-glow-pink"
                  disabled={!inputValue.trim()}
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Sidebar */}
        <div className="w-80 flex flex-col gap-4">
          {/* Quick Actions */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-secondary" />
                <span className="neon-glow-cyan text-secondary">
                  QUICK ANALYSIS
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 border-secondary hover:box-glow-cyan"
              >
                <Activity className="w-3 h-3" />
                Analyze Current Spectrum
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 border-primary hover:box-glow-pink"
              >
                <Zap className="w-3 h-3" />
                Detect Modulation
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 border-secondary hover:box-glow-cyan"
              >
                <AlertCircle className="w-3 h-3" />
                Identify Interference
              </Button>
            </CardContent>
          </Card>

          {/* Current Analysis */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="neon-glow-pink text-primary">
                  ACTIVE ANALYSIS
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-black/50 rounded p-3 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-secondary animate-pulse box-glow-cyan" />
                  <span className="text-xs font-medium text-secondary">
                    Signal Detected
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Center Freq</span>
                    <span className="font-mono text-primary">915.0 MHz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bandwidth</span>
                    <span className="font-mono text-secondary">~20 kHz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Power</span>
                    <span className="font-mono text-primary">-45 dBm</span>
                  </div>
                </div>
              </div>

              <Separator className="bg-border" />

              <div className="bg-black/50 rounded p-3 border border-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3 h-3 text-secondary" />
                  <span className="text-xs font-medium text-secondary">
                    AI Insights
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Modulation appears to be FSK with ±10 kHz deviation.
                  Consistent with ISM telemetry.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Suggested Actions */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-secondary" />
                <span className="neon-glow-cyan text-secondary">
                  RECOMMENDATIONS
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="bg-black/50 rounded p-2 border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary font-medium">
                    Increase gain by 10 dB
                  </span>{" "}
                  to improve SNR for demodulation
                </p>
              </div>
              <div className="bg-black/50 rounded p-2 border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="text-secondary font-medium">
                    Set sample rate to 1 MSPS
                  </span>{" "}
                  for optimal bandwidth coverage
                </p>
              </div>
              <div className="bg-black/50 rounded p-2 border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary font-medium">
                    Enable DC offset correction
                  </span>{" "}
                  to remove center spike
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
