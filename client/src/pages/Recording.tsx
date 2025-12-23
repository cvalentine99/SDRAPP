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
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { generateSigMFMetadata, downloadSigMFMetadata } from "@/lib/sigmf";

export default function Recording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [currentFileSize, setCurrentFileSize] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const utils = trpc.useUtils();
  const deviceConfig = trpc.device.getConfig.useQuery();
  const recordings = trpc.recording.list.useQuery();
  const createRecording = trpc.recording.create.useMutation({
    onSuccess: () => {
      utils.recording.list.invalidate();
      toast.success("Recording saved successfully");
    },
    onError: (error) => {
      toast.error(`Failed to save recording: ${error.message}`);
    },
  });
  const deleteRecording = trpc.recording.delete.useMutation({
    onSuccess: () => {
      utils.recording.list.invalidate();
      toast.success("Recording deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete recording: ${error.message}`);
    },
  });
  const uploadIQData = trpc.recording.uploadIQData.useMutation({
    onError: (error) => {
      toast.error(`Failed to upload IQ data: ${error.message}`);
    },
  });
  
  const startIQRecording = trpc.recording.startIQRecording.useMutation();
  const uploadRecordedIQ = trpc.recording.uploadRecordedIQ.useMutation();

  // Update recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && recordingStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        setRecordingDuration(elapsed);
        
        // Simulate file size growth (10 MSPS * 2 bytes/sample * 2 channels = 40 MB/s)
        const sampleRate = parseFloat(deviceConfig.data?.sampleRate || "10");
        const bytesPerSecond = sampleRate * 1e6 * 2 * 2; // I/Q, 16-bit samples
        setCurrentFileSize(elapsed * bytesPerSecond);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime, deviceConfig.data?.sampleRate]);

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingStartTime(Date.now());
    setRecordingDuration(0);
    setCurrentFileSize(0);
    toast.success("Recording started");
  };

  const handleStopRecording = async () => {
    if (!deviceConfig.data || !recordingStartTime) return;

    setIsRecording(false);
    toast.info("Saving recording...");

    try {
      // Generate filename
      const timestamp = new Date(recordingStartTime).toISOString().replace(/[:.]/g, "-").slice(0, -5);
      const freq = deviceConfig.data.centerFrequency.replace(".", "_");
      const filename = `capture_${freq}MHz_${timestamp}`;

      // Try hardware IQ recording first, fall back to simulated if unavailable
      let iqData: Uint8Array;
      try {
        const result = await startIQRecording.mutateAsync({
          frequency: parseFloat(deviceConfig.data.centerFrequency),
          sampleRate: parseFloat(deviceConfig.data.sampleRate),
          gain: deviceConfig.data.gain,
          duration: recordingDuration,
          filename,
        });
        
        // Upload recorded IQ file to S3
        const uploadResult = await uploadRecordedIQ.mutateAsync({
          tempFile: result.tempFile,
          filename,
          recordingId: 0, // Will be set after createRecording
        });
        
        // Read the IQ data for upload (already in S3, but we need the data for metadata)
        iqData = new Uint8Array(0); // Placeholder since already uploaded
        
        toast.success("Hardware IQ recording captured");
      } catch (hardwareError) {
        toast.warning("Hardware unavailable, using simulated IQ data");
        
        // Fall back to simulated IQ data
        const numSamples = Math.floor(currentFileSize / 8);
      
      // Prevent OOM: limit to 50MB of IQ data (~6.5M samples)
      const MAX_SAMPLES = 6_500_000;
      if (numSamples > MAX_SAMPLES) {
        toast.error(`Recording too large (${(currentFileSize / 1024 / 1024).toFixed(1)}MB). Maximum 50MB.`);
        setIsRecording(false);
        return;
      }
      
        const iqDataFloat = new Float32Array(numSamples * 2);
        const sampleRate = parseFloat(deviceConfig.data.sampleRate) * 1e6;
        
        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const phase = 2 * Math.PI * 1e6 * t;
          iqDataFloat[i * 2] = 0.5 * Math.cos(phase) + (Math.random() - 0.5) * 0.1;
          iqDataFloat[i * 2 + 1] = 0.5 * Math.sin(phase) + (Math.random() - 0.5) * 0.1;
        }
        
        iqData = new Uint8Array(iqDataFloat.buffer);
      }
      
      // Upload IQ data to S3 with progress tracking
      setIsUploading(true);
      setUploadProgress(0);
      
      // Simulate upload progress (in production, use actual upload progress from S3)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Stop at 90% until upload completes
          }
          return prev + 10;
        });
      }, 200);
      
      try {
        // Convert iqData to base64 for upload
        let binary = '';
        const chunkSize = 0x8000; // 32KB chunks
        for (let i = 0; i < iqData.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(iqData.subarray(i, i + chunkSize)));
        }
        const base64Data = btoa(binary);
        
        const { s3Url, s3Key } = await uploadIQData.mutateAsync({
          filename: `${filename}.sigmf-data`,
          data: base64Data,
        });
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        toast.success("IQ data uploaded successfully");
        
        // Continue with metadata save...
        
        // Save recording metadata
        await createRecording.mutateAsync({
        filename: `${filename}.sigmf`,
        s3Key,
        s3Url,
        centerFrequency: deviceConfig.data.centerFrequency,
        sampleRate: deviceConfig.data.sampleRate,
        gain: deviceConfig.data.gain,
        duration: recordingDuration,
        fileSize: formatFileSize(currentFileSize),
        author: "SDR Operator",
        description: "Captured signal data",
        hardware: "Ettus B210",
      });

        setRecordingStartTime(null);
        setRecordingDuration(0);
        setCurrentFileSize(0);
        setUploadProgress(0);
        setIsUploading(false); // Reset uploading state
      } catch (error) {
        clearInterval(progressInterval);
        setIsUploading(false);
        setUploadProgress(0);
        toast.error("Failed to save recording");
        console.error(error);
      }
    } catch (error) {
      toast.error("Failed to stop recording");
      console.error(error);
    }
  };

  const handleDeleteRecording = (id: number, filename: string) => {
    if (confirm(`Delete recording "${filename}"?`)) {
      deleteRecording.mutate({ id });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

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
                            {formatFileSize(currentFileSize)}
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
                  ) : isUploading ? (
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-secondary flex items-center justify-center">
                        <div className="text-2xl font-mono text-secondary">
                          {uploadProgress}%
                        </div>
                      </div>
                      <p className="text-xl font-mono text-secondary mb-4">
                        UPLOADING TO S3
                      </p>
                      <div className="w-full bg-black/50 rounded-full h-3 border border-secondary/30 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 neon-glow-cyan"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {uploadProgress < 100 ? 'Uploading IQ data...' : 'Finalizing...'}
                      </p>
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
                  onClick={handleStartRecording}
                >
                  <Play className="w-5 h-5" />
                  START RECORDING
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  size="lg"
                  disabled={!isRecording}
                  onClick={handleStopRecording}
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
              {recordings.data?.map((recording) => (
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
                            {recording.centerFrequency} MHz
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rate: </span>
                          <span className="text-secondary">
                            {recording.sampleRate} MSPS
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Duration:{" "}
                          </span>
                          <span className="text-primary">
                            {formatDuration(recording.duration)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Size: </span>
                          <span className="text-primary">{recording.fileSize}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time: </span>
                          <span className="text-muted-foreground">
                            {new Date(recording.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-primary hover:box-glow-pink"
                        onClick={() => {
                          // Download and visualize IQ data
                          window.open(recording.s3Url, '_blank');
                          toast.success("Opening IQ data file");
                        }}
                      >
                        <Play className="w-3 h-3" />
                        Play
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-secondary hover:box-glow-cyan"
                        onClick={() => {
                          const metadata = generateSigMFMetadata({
                            centerFrequency: recording.centerFrequency,
                            sampleRate: recording.sampleRate,
                            gain: recording.gain,
                            duration: recording.duration,
                            author: recording.author || undefined,
                            description: recording.description || undefined,
                            license: recording.license || undefined,
                            hardware: recording.hardware || undefined,
                            location: recording.location || undefined,
                            tags: recording.tags || undefined,
                          });
                          downloadSigMFMetadata(metadata, recording.filename);
                          toast.success("SigMF metadata downloaded");
                        }}
                      >
                        <Download className="w-3 h-3" />
                        Metadata
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDeleteRecording(recording.id, recording.filename)}
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
