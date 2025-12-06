import { useEffect, useRef, useCallback, useState } from 'react';

interface UseTimerOptions {
  initialTime: number;
  countdown?: boolean;
  autoStart?: boolean;
  onTick?: (time: number) => void;
  onComplete?: () => void;
}

interface UseTimerReturn {
  time: number;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  reset: (newTime?: number) => void;
  setTime: (time: number) => void;
}

export const useTimer = ({
  initialTime,
  countdown = true,
  autoStart = false,
  onTick,
  onComplete,
}: UseTimerOptions): UseTimerReturn => {
  const [time, setTimeState] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTickRef = useRef(onTick);
  const onCompleteRef = useRef(onComplete);

  // Keep refs updated
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
  }, [isRunning]);

  const stop = useCallback(() => {
    setIsRunning(false);
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback((newTime?: number) => {
    stop();
    setTimeState(newTime !== undefined ? newTime : initialTime);
  }, [initialTime, stop]);

  const setTime = useCallback((newTime: number) => {
    setTimeState(newTime);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeState((prevTime) => {
        const newTime = countdown ? prevTime - 1 : prevTime + 1;
        
        if (onTickRef.current) {
          onTickRef.current(newTime);
        }

        if (countdown && newTime <= 0) {
          setIsRunning(false);
          if (onCompleteRef.current) {
            onCompleteRef.current();
          }
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return clearTimer;
  }, [isRunning, countdown, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return {
    time,
    isRunning,
    start,
    stop,
    reset,
    setTime,
  };
};

// Stopwatch hook (counts up)
export const useStopwatch = () => {
  return useTimer({
    initialTime: 0,
    countdown: false,
  });
};

// Countdown hook
export const useCountdown = (seconds: number, onComplete?: () => void) => {
  return useTimer({
    initialTime: seconds,
    countdown: true,
    onComplete,
  });
};
