import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Sentry } from "@/lib/sentry";
import { useAuth } from "@/_core/hooks/useAuth";

interface FeedbackFormData {
  name: string;
  email: string;
  comments: string;
  category: string;
}

/**
 * Feedback Button Component
 * Captures user feedback with Sentry session replay URL
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [formData, setFormData] = useState<FeedbackFormData>({
    name: "",
    email: "",
    comments: "",
    category: "bug",
  });
  
  const { user } = useAuth();
  const submitFeedback = trpc.debug.submitFeedback.useMutation();

  // Pre-fill user data if logged in
  const handleOpen = (isOpen: boolean) => {
    if (isOpen && user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
      }));
    }
    setOpen(isOpen);
    if (!isOpen) {
      setStatus("idle");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");

    try {
      // Capture a Sentry event to get an event ID for the feedback
      const eventId = Sentry.captureMessage(
        `User Feedback: ${formData.category} - ${formData.comments.substring(0, 50)}...`,
        "info"
      );

      // Get the current session replay URL if available
      const replayUrl = getSessionReplayUrl();

      // Prepare feedback with context
      const feedbackWithContext = `${formData.comments}

---
Category: ${formData.category}
Session Replay: ${replayUrl || "Not available"}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}`;

      // Submit to Sentry
      await submitFeedback.mutateAsync({
        eventId,
        name: formData.name,
        email: formData.email,
        comments: feedbackWithContext,
      });

      setStatus("success");
      
      // Reset form after success
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
        setFormData({
          name: user?.name || "",
          email: user?.email || "",
          comments: "",
          category: "bug",
        });
      }, 2000);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/10"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span className="hidden sm:inline">Report Issue</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <MessageSquarePlus className="w-5 h-5" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Help us improve by reporting bugs, suggesting features, or sharing feedback.
            Your session replay will be attached for context.
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <p className="text-lg font-medium">Thank you for your feedback!</p>
            <p className="text-sm text-muted-foreground">
              We'll review your report and get back to you if needed.
            </p>
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <p className="text-lg font-medium">Failed to submit feedback</p>
            <p className="text-sm text-muted-foreground">
              Please try again or contact support directly.
            </p>
            <Button variant="outline" onClick={() => setStatus("idle")}>
              Try Again
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Your name"
                  required
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                  required
                  className="bg-input border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm"
              >
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="performance">Performance Issue</option>
                <option value="ui">UI/UX Feedback</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Description</Label>
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Describe the issue or feedback in detail..."
                required
                rows={4}
                className="bg-input border-border resize-none"
              />
            </div>

            <div className="bg-black/30 rounded p-3 border border-border text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Session replay will be attached to help diagnose issues
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={status === "submitting"}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={status === "submitting"}
                className="gap-2"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Get the current Sentry session replay URL if available
 */
function getSessionReplayUrl(): string | null {
  try {
    // Get the current replay ID from Sentry
    const replay = Sentry.getReplay();
    if (replay) {
      const replayId = replay.getReplayId();
      if (replayId) {
        // Construct the replay URL
        const dsn = import.meta.env.VITE_SENTRY_DSN;
        if (dsn) {
          // Extract org and project from DSN
          const match = dsn.match(/https:\/\/([^@]+)@([^.]+)\.ingest\.sentry\.io\/(\d+)/);
          if (match) {
            const [, , org, projectId] = match;
            return `https://${org}.sentry.io/replays/${replayId}/?project=${projectId}`;
          }
        }
        return `Replay ID: ${replayId}`;
      }
    }
  } catch (error) {
    console.warn("Failed to get session replay URL:", error);
  }
  return null;
}

/**
 * Compact feedback button for header/toolbar
 */
export function FeedbackButtonCompact() {
  return (
    <FeedbackButton />
  );
}
