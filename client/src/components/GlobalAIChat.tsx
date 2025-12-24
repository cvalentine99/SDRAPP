import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  Minimize2,
  Maximize2,
  Send,
  Sparkles,
  X,
  User,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function GlobalAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "👋 Hello! I'm your RF signal intelligence assistant. I can help you:\n\n• Identify signals (WiFi, Bluetooth, LTE, GPS, etc.)\n• Recommend SDR settings for specific signals\n• Troubleshoot spectrum analysis issues\n• Explain modulation schemes\n• Provide measurement guidance\n\nWhat would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: String(response.content),
          timestamp: new Date(),
        },
      ]);
    },
    onError: (error) => {
      toast.error(`AI Error: ${error.message}`);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Sorry, I encountered an error: ${error.message}. Please try again.`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Call AI backend
    chatMutation.mutate({
      messages: messages.concat(userMessage).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      includeContext: true,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg box-glow-pink z-50"
      >
        <Bot className="w-6 h-6" />
      </Button>
    );
  }

  if (isMinimized) {
    return (
      <Card className="fixed bottom-6 right-6 w-80 shadow-xl border-primary/50 z-50">
        <div className="flex items-center justify-between p-3 bg-primary/10">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">RF Assistant</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsMinimized(false)}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[600px] shadow-2xl border-primary/50 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bot className="w-6 h-6 text-primary" />
            <Sparkles className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">RF Signal Assistant</h3>
            <p className="text-xs text-muted-foreground">
              Powered by AI • {messages.length} messages
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsMinimized(true)}
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.role === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div
                className={`flex-1 ${
                  message.role === "user" ? "text-right" : ""
                }`}
              >
                <div
                  className={`inline-block p-3 rounded-lg text-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 px-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-3 rounded-lg bg-muted">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Input */}
      <div className="p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask about signals, settings, or analysis..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || chatMutation.isPending}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </Card>
  );
}
