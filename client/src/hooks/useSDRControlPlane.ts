/**
 * SDR Control Plane React Hook
 * 
 * Provides UI components with access to the SDR control plane.
 * UI is a PURE CLIENT of the control plane - no direct hardware access.
 * 
 * State is authoritative - UI must RESPECT lifecycle transitions.
 */

import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  type SDRRuntimeState,
  type SDRDeviceType,
  type RXConfig,
  type UIControlState,
  deriveUIControlState,
  INITIAL_SDR_STATE,
} from "../../../shared/sdr-control-plane";

export function useSDRControlPlane() {
  // Query SDR state with polling
  const { data: sdrState, refetch: refetchState } = trpc.sdrControl.getState.useQuery(undefined, {
    refetchInterval: 1000, // Poll every second for state updates
  });

  // Query audit log
  const { data: auditLog } = trpc.sdrControl.getAuditLog.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Mutations
  const setDeviceTypeMutation = trpc.sdrControl.setDeviceType.useMutation({
    onSuccess: () => {
      refetchState();
      logger.device.info("Device type set");
    },
    onError: (error) => {
      toast.error(`Failed to set device type: ${error.message}`);
      logger.device.error("Failed to set device type", { error: error.message });
    },
  });

  const connectDeviceMutation = trpc.sdrControl.connectDevice.useMutation({
    onSuccess: (state) => {
      refetchState();
      toast.success(`Connected to ${state.deviceType}`);
      logger.device.info("Device connected", { deviceType: state.deviceType });
    },
    onError: (error) => {
      toast.error(`Connection failed: ${error.message}`);
      logger.device.error("Device connection failed", { error: error.message });
    },
  });

  const disconnectDeviceMutation = trpc.sdrControl.disconnectDevice.useMutation({
    onSuccess: () => {
      refetchState();
      toast.success("Device disconnected");
      logger.device.info("Device disconnected");
    },
    onError: (error) => {
      toast.error(`Disconnect failed: ${error.message}`);
      logger.device.error("Device disconnect failed", { error: error.message });
    },
  });

  const setConfigMutation = trpc.sdrControl.setConfig.useMutation({
    onSuccess: (result) => {
      refetchState();
      if (result.validation.valid) {
        toast.success("Configuration applied");
        if (result.validation.warnings.length > 0) {
          result.validation.warnings.forEach(w => toast.warning(w));
        }
        if (result.validation.autoCorrections.length > 0) {
          result.validation.autoCorrections.forEach(c => 
            toast.info(`${c.field}: ${c.reason}`)
          );
        }
      } else {
        toast.error(`Configuration rejected: ${result.validation.errors.join(", ")}`);
      }
      logger.device.info("Configuration applied", { validation: result.validation });
    },
    onError: (error) => {
      toast.error(`Configuration failed: ${error.message}`);
      logger.device.error("Configuration failed", { error: error.message });
    },
  });

  const startStreamMutation = trpc.sdrControl.startStream.useMutation({
    onSuccess: () => {
      refetchState();
      toast.success("RX stream started");
      logger.spectrum.info("RX stream started");
    },
    onError: (error) => {
      toast.error(`Failed to start stream: ${error.message}`);
      logger.spectrum.error("Failed to start stream", { error: error.message });
    },
  });

  const stopStreamMutation = trpc.sdrControl.stopStream.useMutation({
    onSuccess: () => {
      refetchState();
      toast.success("RX stream stopped");
      logger.spectrum.info("RX stream stopped");
    },
    onError: (error) => {
      toast.error(`Failed to stop stream: ${error.message}`);
      logger.spectrum.error("Failed to stop stream", { error: error.message });
    },
  });

  const recoverFromErrorMutation = trpc.sdrControl.recoverFromError.useMutation({
    onSuccess: () => {
      refetchState();
      toast.success("Recovered from error");
      logger.device.info("Recovered from error state");
    },
    onError: (error) => {
      toast.error(`Recovery failed: ${error.message}`);
      logger.device.error("Recovery failed", { error: error.message });
    },
  });

  // Current state (with fallback)
  const state: SDRRuntimeState = sdrState || INITIAL_SDR_STATE;

  // Derive UI control state from SDR state
  const uiState: UIControlState = useMemo(() => deriveUIControlState(state), [state]);

  // Command handlers
  const setDeviceType = useCallback((deviceType: SDRDeviceType) => {
    logger.device.info("Setting device type", { deviceType });
    setDeviceTypeMutation.mutate({ deviceType });
  }, [setDeviceTypeMutation]);

  const connect = useCallback((deviceType: SDRDeviceType, serial?: string) => {
    logger.device.info("Connecting to device", { deviceType, serial });
    connectDeviceMutation.mutate({ deviceType, serial });
  }, [connectDeviceMutation]);

  const disconnect = useCallback(() => {
    logger.device.info("Disconnecting device");
    disconnectDeviceMutation.mutate();
  }, [disconnectDeviceMutation]);

  const applyConfig = useCallback((config: RXConfig) => {
    logger.device.info("Applying configuration", { config });
    setConfigMutation.mutate(config);
  }, [setConfigMutation]);

  const startStream = useCallback(() => {
    logger.spectrum.info("Starting RX stream");
    startStreamMutation.mutate();
  }, [startStreamMutation]);

  const stopStream = useCallback(() => {
    logger.spectrum.info("Stopping RX stream");
    stopStreamMutation.mutate();
  }, [stopStreamMutation]);

  const recoverFromError = useCallback(() => {
    logger.device.info("Recovering from error");
    recoverFromErrorMutation.mutate();
  }, [recoverFromErrorMutation]);

  // Loading states
  const isLoading = 
    setDeviceTypeMutation.isPending ||
    connectDeviceMutation.isPending ||
    disconnectDeviceMutation.isPending ||
    setConfigMutation.isPending ||
    startStreamMutation.isPending ||
    stopStreamMutation.isPending ||
    recoverFromErrorMutation.isPending;

  return {
    // State
    state,
    uiState,
    auditLog: auditLog || [],
    isLoading,

    // Commands
    setDeviceType,
    connect,
    disconnect,
    applyConfig,
    startStream,
    stopStream,
    recoverFromError,

    // Refresh
    refetchState,
  };
}

export type UseSDRControlPlane = ReturnType<typeof useSDRControlPlane>;
