/**
 * SDR Control Plane V2 React Hook
 * 
 * Production-grade hook with capability/policy support.
 * UI is a PURE CLIENT of the control plane - no direct hardware access.
 * 
 * Features:
 * - Hardware capabilities (immutable device limits)
 * - Operational policy (deployment constraints)
 * - Atomic configuration validation
 * - Structured audit logging
 */

import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type {
  SDRConfig,
  SDRState,
  HardwareCapabilities,
  OperationalPolicy,
  ConfigValidationResult,
} from "../../../shared/sdr-capabilities";

export type DeviceType = "b210" | "b200" | "x310" | "simulator" | "rtlsdr" | "hackrf" | "limesdr";

export interface SDRControlContext {
  state: SDRState;
  deviceType: string | null;
  capability: HardwareCapabilities | null;
  policy: OperationalPolicy;
  config: SDRConfig | null;
  serial: string | null;
  lastError: string | null;
}

export interface UIControlStateV2 {
  canSetDeviceType: boolean;
  canConnect: boolean;
  canDisconnect: boolean;
  canConfigure: boolean;
  canStartStream: boolean;
  canStopStream: boolean;
  isStreaming: boolean;
  isConfigured: boolean;
  hasError: boolean;
}

function deriveUIControlState(context: SDRControlContext | null): UIControlStateV2 {
  if (!context) {
    return {
      canSetDeviceType: true,
      canConnect: false,
      canDisconnect: false,
      canConfigure: false,
      canStartStream: false,
      canStopStream: false,
      isStreaming: false,
      isConfigured: false,
      hasError: false,
    };
  }

  const { state, deviceType, config, lastError } = context;

  return {
    canSetDeviceType: state === "Idle",
    canConnect: state === "Idle" && deviceType !== null,
    canDisconnect: state !== "Idle",
    canConfigure: state === "Configured" || state === "Idle",
    canStartStream: state === "Configured" && config !== null,
    canStopStream: state === "Running",
    isStreaming: state === "Running",
    isConfigured: config !== null,
    hasError: lastError !== null,
  };
}

export function useSDRControlPlaneV2() {
  // Query control plane context with polling
  const { data: context, refetch: refetchContext } = trpc.sdrControlV2.getContext.useQuery(undefined, {
    refetchInterval: 1000,
  });

  // Query policy
  const { data: policy } = trpc.sdrControlV2.getPolicy.useQuery();

  // Query all device capabilities
  const { data: allCapabilities } = trpc.sdrControlV2.getAllDeviceCapabilities.useQuery();

  // Query audit log
  const { data: auditLog } = trpc.sdrControlV2.getAuditLog.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Mutations
  const setDeviceTypeMutation = trpc.sdrControlV2.setDeviceType.useMutation({
    onSuccess: (result) => {
      refetchContext();
      toast.success(`Device type set to ${result.context.deviceType}`);
      logger.device.info("Device type set", { deviceType: result.context.deviceType });
    },
    onError: (error) => {
      toast.error(`Failed to set device type: ${error.message}`);
      logger.device.error("Failed to set device type", { error: error.message });
    },
  });

  const connectMutation = trpc.sdrControlV2.connect.useMutation({
    onSuccess: (result) => {
      refetchContext();
      toast.success(`Connected to ${result.context.deviceType}`);
      logger.device.info("Device connected", { serial: result.context.serial });
    },
    onError: (error) => {
      toast.error(`Connection failed: ${error.message}`);
      logger.device.error("Device connection failed", { error: error.message });
    },
  });

  const disconnectMutation = trpc.sdrControlV2.disconnect.useMutation({
    onSuccess: () => {
      refetchContext();
      toast.success("Device disconnected");
      logger.device.info("Device disconnected");
    },
    onError: (error) => {
      toast.error(`Disconnect failed: ${error.message}`);
      logger.device.error("Device disconnect failed", { error: error.message });
    },
  });

  const applyConfigMutation = trpc.sdrControlV2.applyConfig.useMutation({
    onSuccess: (result) => {
      refetchContext();
      if (result.validation.valid) {
        toast.success("Configuration applied");
        if (result.validation.warnings.length > 0) {
          result.validation.warnings.forEach(w => toast.warning(w));
        }
      } else {
        // Show detailed errors
        result.validation.errors.forEach(err => {
          toast.error(`${err.field}: ${err.message}`);
        });
      }
      logger.device.info("Configuration result", { validation: result.validation });
    },
    onError: (error) => {
      toast.error(`Configuration failed: ${error.message}`);
      logger.device.error("Configuration failed", { error: error.message });
    },
  });

  const startStreamMutation = trpc.sdrControlV2.startStream.useMutation({
    onSuccess: () => {
      refetchContext();
      toast.success("RX stream started");
      logger.spectrum.info("RX stream started");
    },
    onError: (error) => {
      toast.error(`Failed to start stream: ${error.message}`);
      logger.spectrum.error("Failed to start stream", { error: error.message });
    },
  });

  const stopStreamMutation = trpc.sdrControlV2.stopStream.useMutation({
    onSuccess: () => {
      refetchContext();
      toast.success("RX stream stopped");
      logger.spectrum.info("RX stream stopped");
    },
    onError: (error) => {
      toast.error(`Failed to stop stream: ${error.message}`);
      logger.spectrum.error("Failed to stop stream", { error: error.message });
    },
  });

  const updatePolicyMutation = trpc.sdrControlV2.updatePolicy.useMutation({
    onSuccess: () => {
      toast.success("Policy updated");
      logger.device.info("Policy updated");
    },
    onError: (error) => {
      toast.error(`Failed to update policy: ${error.message}`);
      logger.device.error("Policy update failed", { error: error.message });
    },
  });

  const resetPolicyMutation = trpc.sdrControlV2.resetPolicy.useMutation({
    onSuccess: () => {
      toast.success("Policy reset to defaults");
      logger.device.info("Policy reset");
    },
    onError: (error) => {
      toast.error(`Failed to reset policy: ${error.message}`);
      logger.device.error("Policy reset failed", { error: error.message });
    },
  });

  // Derive UI control state
  const uiState = useMemo(() => deriveUIControlState(context || null), [context]);

  // Command handlers
  const setDeviceType = useCallback((deviceType: DeviceType) => {
    logger.device.info("Setting device type", { deviceType });
    setDeviceTypeMutation.mutate({ deviceType });
  }, [setDeviceTypeMutation]);

  const connect = useCallback((serial?: string) => {
    logger.device.info("Connecting to device", { serial });
    connectMutation.mutate({ serial });
  }, [connectMutation]);

  const disconnect = useCallback(() => {
    logger.device.info("Disconnecting device");
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  const applyConfig = useCallback((config: SDRConfig) => {
    logger.device.info("Applying configuration", { config });
    applyConfigMutation.mutate(config);
  }, [applyConfigMutation]);

  const startStream = useCallback(() => {
    logger.spectrum.info("Starting RX stream");
    startStreamMutation.mutate();
  }, [startStreamMutation]);

  const stopStream = useCallback(() => {
    logger.spectrum.info("Stopping RX stream");
    stopStreamMutation.mutate();
  }, [stopStreamMutation]);

  const updatePolicy = useCallback((updates: Partial<OperationalPolicy>) => {
    logger.device.info("Updating policy", { updates });
    updatePolicyMutation.mutate(updates);
  }, [updatePolicyMutation]);

  const resetPolicy = useCallback(() => {
    logger.device.info("Resetting policy");
    resetPolicyMutation.mutate();
  }, [resetPolicyMutation]);

  // Loading states
  const isLoading =
    setDeviceTypeMutation.isPending ||
    connectMutation.isPending ||
    disconnectMutation.isPending ||
    applyConfigMutation.isPending ||
    startStreamMutation.isPending ||
    stopStreamMutation.isPending ||
    updatePolicyMutation.isPending ||
    resetPolicyMutation.isPending;

  // Get capability for selected device
  const selectedCapability = useMemo(() => {
    if (!context?.deviceType || !allCapabilities) return null;
    return allCapabilities[context.deviceType] || null;
  }, [context?.deviceType, allCapabilities]);

  return {
    // Context
    context: context || null,
    state: context?.state || "Idle",
    deviceType: context?.deviceType || null,
    config: context?.config || null,
    serial: context?.serial || null,
    lastError: context?.lastError || null,

    // Capabilities & Policy
    capability: context?.capability || selectedCapability,
    policy: policy || context?.policy || null,
    allCapabilities: allCapabilities || {},

    // UI State
    uiState,
    isLoading,

    // Audit
    auditLog: auditLog || [],

    // Commands
    setDeviceType,
    connect,
    disconnect,
    applyConfig,
    startStream,
    stopStream,

    // Admin commands
    updatePolicy,
    resetPolicy,

    // Refresh
    refetchContext,
  };
}

export type UseSDRControlPlaneV2 = ReturnType<typeof useSDRControlPlaneV2>;
