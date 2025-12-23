import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Database,
  Download,
  FileText,
  Pause,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export default function Recording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Simulated recording history
  const recordings = [
    {
      id: 1,
      filename: "capture_915MHz_20250123_102345.sigmf",
      frequency: "915.0 MHz",
      sampleRate: "10 MSPS",
      duration: "5m 23s",
      size: "3.2 GB",
      timestamp: "2025-01-23 10:23:45",
    },
    {
      id: 2,
      filename: "capture_2.4GHz_20250123_095612.sigmf",
      frequency: "2.4 GHz",
      sampleRate: "20 MSPS",
      duration: "2m 15s",
      size: "2.7 GB",
      timestamp: "2025-01-23 09:56:12",
    },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Recording Control */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Recording Control */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <span className="neon-glow-pink text-primary">
                  SIGMF RECORDING
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recording Status */}
              <div className="bg-black/80 rounded border border-secondary/30 p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
                <div className="relative z-10">
                  {isRecording ? (
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-primary animate-pulse box-glow-pink flex items-center justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full animate-pulse" />
                      </div>
                      <p className="text-2xl font-mono text-primary mb-2">
                        RECORDING
                      </p>
                      <p className="text-4xl font-mono text-secondary mb-4">
                        {Math.floor(recordingDuration / 60)}:
                        {(recordingDuration % 60).toString().padStart(2, "0")}
                      </p>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div className="bg-black/50 rounded p-2 border border-border">
                          <div className="text-muted-foreground">Data Rate</div>
                          <div className="text-secondary font-mono">
                            20 MB/s
                          </div>
                        </div>
                        <div className="bg-black/50 rounded p-2 border border-border">
                          <div className="text-muted-foreground">File Size</div>
                          <div className="text-primary font-mono">
                            {(recordingDuration * 20).toFixed(0)} MB
                          </div>
                        </div>
                        <div className="bg-black/50 rounded p-2 border border-border">
                          <div className="text-muted-foreground">Samples</div>
                          <div className="text-secondary font-mono">
                            {(recordingDuration * 10e6).toExponential(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-secondary flex items-center justify-center">
                        <Square className="w-10 h-10 text-secondary" />
                      </div>
                      <p className="text-xl font-mono text-muted-foreground mb-2">
                        READY TO RECORD
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Configure metadata and press START
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recording Controls */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="gap-2 box-glow-pink"
                  size="lg"
                  disabled={isRecording}
                  onClick={() => {
                    setIsRecording(true);
                    const interval = setInterval(() => {
                      setRecordingDuration((prev) => prev + 1);
                    }, 1000);
                    // Store interval ID for cleanup
                    (window as any).recordingInterval = interval;
                  }}
                >
                  <Play className="w-5 h-5" />
                  START RECORDING
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  size="lg"
                  disabled={!isRecording}
                  onClick={() => {
                    setIsRecording(false);
                    setRecordingDuration(0);
                    clearInterval((window as any).recordingInterval);
                  }}
                >
                  <Square className="w-5 h-5" />
                  STOP RECORDING
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">
                <span className="neon-glow-cyan text-secondary">
                  QUICK SETTINGS
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Center Freq</span>
                  <span className="font-mono text-primary">915.0 MHz</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Sample Rate</span>
                  <span className="font-mono text-secondary">10 MSPS</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Gain</span>
                  <span className="font-mono text-primary">50 dB</span>
                </div>
              </div>

              <Separator className="bg-border" />

              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">DC Offset</span>
                  <span className="font-mono text-secondary">DISABLED</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">IQ Balance</span>
                  <span className="font-mono text-secondary">DISABLED</span>
                </div>
              </div>

              <div className="bg-black/50 rounded p-3 border border-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-secondary" />
                  <span className="text-xs font-medium text-secondary">
                    Raw Capture Mode
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Corrections disabled for scientific recording
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SigMF Metadata Editor */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="neon-glow-pink text-primary">
                SIGMF METADATA
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Global Metadata */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-secondary uppercase tracking-wider">
                  Global
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="author" className="text-xs text-muted-foreground">
                    Author
                  </Label>
                  <Input
                    id="author"
                    placeholder="Your name or organization"
                    className="bg-input border-border font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="description"
                    className="text-xs text-muted-foreground"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the capture purpose and conditions"
                    className="bg-input border-border font-mono text-sm resize-none"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="license"
                    className="text-xs text-muted-foreground"
                  >
                    License
                  </Label>
                  <Input
                    id="license"
                    placeholder="e.g., CC0, MIT"
                    className="bg-input border-border font-mono text-sm"
                  />
                </div>
              </div>

              {/* Capture Metadata */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-secondary uppercase tracking-wider">
                  Capture
                </h3>
                <div className="space-y-2">
                  <Label
                    htmlFor="hardware"
                    className="text-xs text-muted-foreground"
                  >
                    Hardware
                  </Label>
                  <Input
                    id="hardware"
                    value="Ettus B210 USRP"
                    className="bg-input border-border font-mono text-sm"
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="location"
                    className="text-xs text-muted-foreground"
                  >
                    Location (Optional)
                  </Label>
                  <Input
                    id="location"
                    placeholder="GPS coordinates or site name"
                    className="bg-input border-border font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-xs text-muted-foreground">
                    Tags
                  </Label>
                  <Input
                    id="tags"
                    placeholder="Comma-separated tags"
                    className="bg-input border-border font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recording History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-secondary" />
              <span className="neon-glow-cyan text-secondary">
                RECORDING HISTORY
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="bg-black/50 rounded p-3 border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-sm font-mono text-foreground">
                          {recording.filename}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Freq: </span>
                          <span className="text-secondary">
                            {recording.frequency}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rate: </span>
                          <span className="text-secondary">
                            {recording.sampleRate}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Duration:{" "}
                          </span>
                          <span className="text-primary">
                            {recording.duration}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Size: </span>
                          <span className="text-primary">{recording.size}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time: </span>
                          <span className="text-muted-foreground">
                            {recording.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-secondary hover:box-glow-cyan"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
