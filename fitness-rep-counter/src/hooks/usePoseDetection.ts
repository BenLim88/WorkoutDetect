import { useEffect, useRef, useState, useCallback } from 'react';
import { poseDetectionService } from '../services/poseDetection';
import { exerciseDetectionService } from '../services/exerciseDetection';
import { PoseResult, RepData, ExerciseType, Keypoint } from '../types';

interface UsePoseDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  exercise: ExerciseType;
  isActive: boolean;
  onRepComplete?: (rep: RepData) => void;
}

interface UsePoseDetectionReturn {
  isInitialized: boolean;
  currentPose: PoseResult | null;
  error: string | null;
  initialize: () => Promise<void>;
  startDetection: () => void;
  stopDetection: () => void;
  resetCounter: () => void;
}

export const usePoseDetection = ({
  videoRef,
  canvasRef,
  exercise,
  isActive,
  onRepComplete,
}: UsePoseDetectionOptions): UsePoseDetectionReturn => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentPose, setCurrentPose] = useState<PoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const detectRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const initialize = useCallback(async () => {
    try {
      setError(null);
      await poseDetectionService.initialize();
      exerciseDetectionService.setExercise(exercise);
      setIsInitialized(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize pose detection';
      setError(message);
      console.error('Pose detection initialization error:', err);
    }
  }, [exercise]);

  const drawPose = useCallback((keypoints: Keypoint[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw skeleton connections
    const connections = [
      // Face
      [0, 1], [0, 2], [1, 3], [2, 4],
      // Arms
      [5, 7], [7, 9], [6, 8], [8, 10],
      // Torso
      [5, 6], [5, 11], [6, 12], [11, 12],
      // Legs
      [11, 13], [13, 15], [12, 14], [14, 16],
    ];

    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;

    connections.forEach(([i, j]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];
      
      if (kp1 && kp2 && (kp1.score || 0) > 0.3 && (kp2.score || 0) > 0.3) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    });

    // Draw keypoints
    keypoints.forEach((kp) => {
      if ((kp.score || 0) > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, [canvasRef, videoRef]);

  const detect = useCallback(async () => {
    if (!isRunningRef.current || !videoRef.current) return;

    const video = videoRef.current;
    
    if (video.readyState >= 2) {
      const pose = await poseDetectionService.detectPose(video);
      
      if (pose) {
        setCurrentPose(pose);
        drawPose(pose.keypoints);

        // Detect rep
        if (isActive) {
          const rep = exerciseDetectionService.detectRep(pose.keypoints);
          if (rep && onRepComplete) {
            onRepComplete(rep);
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      detectRef.current?.();
    });
  }, [videoRef, isActive, onRepComplete, drawPose]);

  // Keep detect ref updated
  useEffect(() => {
    detectRef.current = detect;
  }, [detect]);

  const startDetection = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    detect();
  }, [detect]);

  const stopDetection = useCallback(() => {
    isRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const resetCounter = useCallback(() => {
    exerciseDetectionService.reset();
  }, []);

  // Update exercise when it changes
  useEffect(() => {
    exerciseDetectionService.setExercise(exercise);
  }, [exercise]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    isInitialized,
    currentPose,
    error,
    initialize,
    startDetection,
    stopDetection,
    resetCounter,
  };
};
