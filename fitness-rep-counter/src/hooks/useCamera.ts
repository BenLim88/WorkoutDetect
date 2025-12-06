import { useEffect, useRef, useState, useCallback } from 'react';

interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
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
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

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

  const switchCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
  }, [facingMode]);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isReady) {
      startCamera();
    }
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
  };
};
