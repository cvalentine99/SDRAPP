/**
 * Admin Policy Page
 * 
 * Admin-only page for managing operational policy.
 */

import { PolicyConfigPanel, PolicyStatusBadge } from "@/components/PolicyConfigPanel";
import { SDRControlPanelV2, AuditLogViewerV2 } from "@/components/SDRControlPanelV2";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertCircle, Shield } from "lucide-react";

export default function AdminPolicy() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="neon-glow-cyan text-primary">ADMIN: POLICY MANAGEMENT</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure operational constraints for SDR operations
          </p>
        </div>
        <PolicyStatusBadge />
      </div>

      {!isAdmin && (
        <div className="p-4 bg-yellow-500/10 rounded border border-yellow-500/30">
          <div className="flex items-center gap-2 text-yellow-500">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Admin Access Required</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            You need admin privileges to modify operational policy. Contact an administrator.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Policy Configuration */}
        <div className="space-y-4">
          <PolicyConfigPanel />
        </div>

        {/* Control Panel & Audit Log */}
        <div className="space-y-4">
          <SDRControlPanelV2 />
          <AuditLogViewerV2 />
        </div>
      </div>
    </div>
  );
}
