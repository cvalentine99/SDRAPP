import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2, Minimize2, Maximize2, Upload, FileAudio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function FloatingAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "**Signals Forensics Assistant** ready. I can help you analyze RF spectrum data, identify modulation types, detect interference patterns, and recommend measurement techniques. What would you like to investigate?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Add signals forensics RAG context
    const ragContext = `You are a signals forensics expert specializing in RF spectrum analysis, SDR operations, and electromagnetic interference investigation. 

Key knowledge areas:
- Modulation identification (AM, FM, PSK, QAM, FSK, OFDM, spread spectrum)
- Interference patterns (harmonic distortion, intermodulation, adjacent channel, co-channel)
- Spectrum analysis techniques (waterfall interpretation, peak detection, bandwidth measurement)
- Signal characteristics (center frequency, bandwidth, power level, duty cycle, modulation index)
- Common RF bands (ISM 915MHz/2.4GHz, amateur radio, aviation, satellite)
- Hardware calibration (DC offset, IQ imbalance, gain staging, AGC behavior)

User query: ${input}

Provide technical, actionable analysis based on RF engineering principles.`;

    chatMutation.mutate({
      message: ragContext,
    });

    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const analyzeIQMutation = trpc.ai.analyzeIQFile.useMutation({
    onSuccess: (data) => {
      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  const handleFileUpload = async () => {
    if (!uploadedFile) return;

    setIsUploading(true);
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      // Send user message
      const userMessage: Message = {
        role: "user",
        content: `Uploaded IQ recording: ${uploadedFile.name} (${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Call backend IQ analysis
      analyzeIQMutation.mutate({
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        fileData: base64,
        // TODO: Extract from SigMF metadata if available
        sampleRate: 10e6, // Default 10 MSPS
        centerFrequency: 915e6, // Default 915 MHz
      });

      setUploadedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("File upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary/90 to-secondary/90 hover:from-primary hover:to-secondary text-white rounded-full shadow-lg neon-glow-pink transition-all duration-300 hover:scale-105"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="font-medium">Signals Forensics AI</span>
      </button>
    );
  }

  return (
    <div
      className={`fixed z-50 bg-card border border-border rounded-lg shadow-2xl neon-glow-cyan transition-all duration-300 ${
        isMinimized
          ? "bottom-6 right-6 w-80 h-14"
          : "bottom-6 right-6 w-96 h-[600px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Signals Forensics AI
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-7 w-7 p-0"
          >
            {isMinimized ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-7 w-7 p-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="h-[480px] p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary/20 border border-primary/30"
                        : "bg-secondary/20 border border-secondary/30"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <Streamdown className="text-sm text-foreground">
                        {msg.content}
                      </Streamdown>
                    ) : (
                      <p className="text-sm text-foreground">{msg.content}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-secondary/20 border border-secondary/30 rounded-lg p-3">
                    <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border space-y-2">
            {/* File Upload Indicator */}
            {uploadedFile && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/30 rounded">
                <FileAudio className="w-4 h-4 text-primary" />
                <span className="text-xs flex-1 truncate">{uploadedFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadedFile(null)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Input Row */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".iq,.sigmf,.wav,.bin,.dat"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={chatMutation.isPending || isUploading}
                className="neon-glow-pink"
              >
                <Upload className="w-4 h-4" />
              </Button>
              {uploadedFile ? (
                <Button
                  onClick={handleFileUpload}
                  disabled={isUploading || chatMutation.isPending}
                  size="sm"
                  className="flex-1 neon-glow-cyan"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Analyze IQ File"
                  )}
                </Button>
              ) : (
                <>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about signals, modulation, interference..."
                    className="flex-1 bg-background/50 border-border"
                    disabled={chatMutation.isPending}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || chatMutation.isPending}
                    size="sm"
                    className="neon-glow-cyan"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
