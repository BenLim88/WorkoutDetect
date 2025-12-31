import { useEffect, useRef, useState, useCallback } from 'react';

interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

export type ZoomLevel = 1 | 1.5 | 2 | 2.5 | 3;

interface ZoomCapabilities {
  min: number;
  max: number;
  step: number;
  supportsHardwareZoom: boolean;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  facingMode: 'user' | 'environment';
  zoomLevel: ZoomLevel;
  zoomCapabilities: ZoomCapabilities;
  setZoomLevel: (level: ZoomLevel) => void;
}

export const useCamera = (options: UseCameraOptions = {}): UseCameraReturn => {
  const {
    facingMode: initialFacingMode = 'user',
    width = 640,
    height = 480,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);
  const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<ZoomCapabilities>({
    min: 1,
    max: 3,
    step: 0.5,
    supportsHardwareZoom: false,
  });

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Check for camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }

      // Stop any existing stream
      stopCamera();

      // Request camera access
      // Use conservative resolution and frame rate hints to keep
      // performance stable across front/rear cameras.
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: width, max: width },
          height: { ideal: height, max: height },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check for hardware zoom capabilities
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number; step: number } };
          if (capabilities.zoom) {
            setZoomCapabilities({
              min: capabilities.zoom.min,
              max: Math.min(capabilities.zoom.max, 3), // Cap at 3x
              step: capabilities.zoom.step,
              supportsHardwareZoom: true,
            });
          }
        } catch {
          // Hardware zoom not supported, use CSS fallback
          console.log('Hardware zoom not available, using CSS zoom');
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not found'));
            return;
          }

          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
              .then(() => resolve())
              .catch(reject);
          };

          videoRef.current.onerror = () => {
            reject(new Error('Failed to load video'));
          };
        });

        // Set canvas dimensions
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }

        setIsReady(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start camera';
      setError(message);
      console.error('Camera error:', err);
    }
  }, [facingMode, width, height, stopCamera]);

  // Apply zoom level
  const setZoomLevel = useCallback((level: ZoomLevel) => {
    if (!streamRef.current) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    // Try hardware zoom first
    if (zoomCapabilities.supportsHardwareZoom) {
      try {
        const constraintLevel = Math.min(level, zoomCapabilities.max);
        videoTrack.applyConstraints({
          advanced: [{ zoom: constraintLevel } as MediaTrackConstraintSet & { zoom: number }],
        });
      } catch {
        console.log('Hardware zoom failed, level will be applied via CSS');
      }
    }
    
    setZoomLevelState(level);
  }, [zoomCapabilities]);

  const switchCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
  }, [facingMode]);

  // Restart camera when facing mode changes
  useEffect(() => {
    // Always restart the stream when we switch between front/rear.
    // startCamera() will safely stop any existing stream first.
    startCamera();
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    isReady,
    error,
    startCamera,
    stopCamera,
    switchCamera,
    facingMode,
    zoomLevel,
    zoomCapabilities,
    setZoomLevel,
  };
};
