import React, { useEffect, useState, useCallback } from 'react';
import { ExerciseType, RepData, WorkoutPhase } from '../types';
import { exercises } from '../data/exercises';
import { useCamera, ZoomLevel } from '../hooks/useCamera';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { useTimer } from '../hooks/useTimer';
import { speechService } from '../services/speechService';
import { checkBodyAlignment } from '../utils/angleCalculations';
import CameraView from './CameraView';
import { 
  Play, 
  Pause, 
  StopCircle, 
  SkipForward,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface WorkoutDisplayProps {
  exercise: ExerciseType;
  targetReps: number;
  totalSets: number;
  restPeriod: number;
  currentSet: number;
  phase: WorkoutPhase;
  countdownTime: number;
  restTime: number;
  reps: RepData[];
  initialZoomLevel?: ZoomLevel;
  onRepComplete: (rep: RepData) => void;
  onSetComplete: () => void;
  onStartNextSet: () => void;
  onCompleteWorkout: () => void;
  onStopWorkout: () => void;
  onCountdownTick: (time: number) => void;
  onRestTick: (time: number) => void;
  onPhaseChange: (phase: WorkoutPhase) => void;
  onCameraReady: (ready: boolean) => void;
  onPoseReady: (ready: boolean) => void;
  onZoomChange?: (level: ZoomLevel) => void;
}

const WorkoutDisplay: React.FC<WorkoutDisplayProps> = ({
  exercise,
  targetReps,
  totalSets,
  restPeriod,
  currentSet,
  phase,
  countdownTime,
  restTime,
  reps,
  initialZoomLevel = 1,
  onRepComplete,
  onSetComplete,
  onStartNextSet,
  onCompleteWorkout,
  onStopWorkout,
  onCountdownTick,
  onRestTick,
  onPhaseChange,
  onCameraReady,
  onPoseReady,
  onZoomChange,
}) => {
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [lastFormIssue, setLastFormIssue] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [hasAnnouncedSetupIssue, setHasAnnouncedSetupIssue] = useState(false);

  const exerciseData = exercises[exercise];

  // Camera hook
  const {
    videoRef,
    canvasRef,
    isReady: isCameraReady,
    error: cameraError,
    startCamera,
    switchCamera,
    facingMode,
    zoomLevel,
    zoomCapabilities,
    setZoomLevel,
  } = useCamera({ facingMode: 'user' });

  // Apply initial zoom level when camera becomes ready
  useEffect(() => {
    if (isCameraReady && initialZoomLevel !== 1) {
      setZoomLevel(initialZoomLevel);
    }
  }, [isCameraReady, initialZoomLevel, setZoomLevel]);

  // Sync zoom changes back to parent
  const handleZoomChange = useCallback((level: ZoomLevel) => {
    setZoomLevel(level);
    onZoomChange?.(level);
  }, [setZoomLevel, onZoomChange]);

  // Handle rep completion
  const handleRepComplete = useCallback((rep: RepData) => {
    if (isPaused) return;

    onRepComplete(rep);

    if (rep.isValid) {
      speechService.announceRep(reps.length + 1);
    } else {
      const defaultIssue =
        'No rep. Keep your body in a straight line from shoulders through hips to ankles.';
      const issue = rep.issues[0] || defaultIssue;
      speechService.announceInvalidRep(issue);
      setLastFormIssue(issue);
      setTimeout(() => setLastFormIssue(null), 3000);
    }

    // Check if set is complete
    if (reps.length + 1 >= targetReps) {
      setTimeout(() => {
        onSetComplete();
        const validReps = [...reps, rep].filter(r => r.isValid).length;
        speechService.announceSetComplete(currentSet + 1, validReps, targetReps);
      }, 500);
    }
  }, [isPaused, onRepComplete, reps, targetReps, onSetComplete, currentSet]);

  // Pose detection hook
  const {
    isInitialized: isPoseReady,
    currentPose,
    error: poseError,
    initialize: initializePose,
    startDetection,
    stopDetection,
    resetCounter,
  } = usePoseDetection({
    videoRef,
    canvasRef,
    exercise,
    isActive: phase === 'exercising' && !isPaused,
    onRepComplete: handleRepComplete,
  });

  // Countdown timer
  const countdownTimer = useTimer({
    initialTime: countdownTime,
    countdown: true,
    onTick: (time) => {
      onCountdownTick(time);
      if (time <= 3 && time > 0) {
        speechService.announceCountdown(time);
      }
    },
    onComplete: () => {
      onPhaseChange('exercising');
      speechService.speak('Go!', 'high');
      resetCounter();
    },
  });

  // Rest timer
  const restTimer = useTimer({
    initialTime: restPeriod,
    countdown: true,
    onTick: (time) => {
      onRestTick(time);
      if (time <= 5 && time > 0) {
        speechService.announceRestCountdown(time);
      }
    },
    onComplete: () => {
      onStartNextSet();
    },
  });

  // Initialize speech service
  useEffect(() => {
    speechService.initialize();
    speechService.updateSettings({ enabled: isSpeechEnabled });
  }, []);

  // Update camera ready state
  useEffect(() => {
    onCameraReady(isCameraReady);
  }, [isCameraReady, onCameraReady]);

  // Update pose ready state
  useEffect(() => {
    onPoseReady(isPoseReady);
  }, [isPoseReady, onPoseReady]);

  // Pre-workout posture check for push-ups:
  // before any reps are registered, ensure the body is in a straight line
  // so that the system has a good side/oblique view for angle measurements.
  useEffect(() => {
    if (exercise !== 'pushups') return;
    if (!currentPose) return;
    if (reps.length > 0) return;
    if (phase !== 'countdown' && phase !== 'exercising') return;

    const alignmentScore = checkBodyAlignment(currentPose.keypoints);

    // If alignment is poor or keypoints are missing, remind the user once.
    if (alignmentScore < 85) {
      if (!hasAnnouncedSetupIssue) {
        speechService.announceFormIssue(
          'Set up in a straight line from shoulders through hips to ankles before starting push-ups.',
        );
        setHasAnnouncedSetupIssue(true);
      }
    } else if (hasAnnouncedSetupIssue) {
      // Reset so that if the user loses setup later (before first rep),
      // we can warn again.
      setHasAnnouncedSetupIssue(false);
    }
  }, [exercise, currentPose, reps.length, phase, hasAnnouncedSetupIssue]);

  // Initialize pose detection when camera is ready
  useEffect(() => {
    if (isCameraReady && !isPoseReady) {
      initializePose();
    }
  }, [isCameraReady, isPoseReady, initializePose]);

  // Start detection when ready
  useEffect(() => {
    if (isCameraReady && isPoseReady) {
      startDetection();
    }
    return () => stopDetection();
  }, [isCameraReady, isPoseReady, startDetection, stopDetection]);

  // Handle phase changes
  useEffect(() => {
    if (phase === 'countdown') {
      // Do not start the countdown until camera & pose detection
      // are both initialized, so that "Go" aligns with readiness.
      if (!isCameraReady || !isPoseReady) {
        return;
      }
      countdownTimer.reset(countdownTime);
      countdownTimer.start();
      speechService.announceExerciseStart(exerciseData.name);
    } else if (phase === 'resting') {
      restTimer.reset(restPeriod);
      restTimer.start();
      speechService.announceRestPeriod(restPeriod);
    } else if (phase === 'workoutComplete') {
      speechService.announceWorkoutComplete();
      onCompleteWorkout();
    }
  }, [phase, isCameraReady, isPoseReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle speech
  const toggleSpeech = useCallback(() => {
    setIsSpeechEnabled(prev => {
      speechService.updateSettings({ enabled: !prev });
      return !prev;
    });
  }, []);

  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  // Skip rest
  const skipRest = useCallback(() => {
    restTimer.stop();
    onStartNextSet();
  }, [restTimer, onStartNextSet]);

  // Get average form score
  const avgFormScore = reps.length > 0
    ? reps.reduce((sum, r) => sum + r.formScore, 0) / reps.length
    : 100;

  // Valid reps count
  const validReps = reps.filter(r => r.isValid).length;

  return (
    <div className="workout-display">
      {/* Camera View */}
      <CameraView
        videoRef={videoRef}
        canvasRef={canvasRef}
        isReady={isCameraReady}
        error={cameraError || poseError}
        onStart={startCamera}
        onSwitch={switchCamera}
        facingMode={facingMode}
        showOverlay={phase === 'exercising' || phase === 'countdown'}
        repCount={reps.length}
        targetReps={targetReps}
        setNumber={currentSet + 1}
        totalSets={totalSets}
        formScore={avgFormScore}
        isSpeechEnabled={isSpeechEnabled}
        onToggleSpeech={toggleSpeech}
        zoomLevel={zoomLevel}
        onZoomChange={handleZoomChange}
        supportsHardwareZoom={zoomCapabilities.supportsHardwareZoom}
      />

      {/* Countdown Overlay */}
      {phase === 'countdown' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl font-bold text-white mb-4 animate-pulse">
              {countdownTimer.time}
            </div>
            <div className="text-2xl text-gray-400">Get Ready!</div>
            <div className="text-lg text-blue-400 mt-2">{exerciseData.name}</div>
          </div>
        </div>
      )}

      {/* Rest Period Overlay */}
      {phase === 'resting' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-6xl font-bold text-white mb-2">
              {restTimer.time}s
            </div>
            <div className="text-xl text-gray-400 mb-6">Rest Period</div>
            
            <div className="bg-gray-800 rounded-xl p-4 mb-6">
              <div className="text-sm text-gray-400 mb-2">Set {currentSet + 1} Summary</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold text-green-400">{validReps}</div>
                  <div className="text-xs text-gray-500">Valid Reps</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{reps.length - validReps}</div>
                  <div className="text-xs text-gray-500">Invalid</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">{Math.round(avgFormScore)}%</div>
                  <div className="text-xs text-gray-500">Form</div>
                </div>
              </div>
            </div>

            <button
              onClick={skipRest}
              className="px-6 py-3 bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <SkipForward className="inline-block w-5 h-5 mr-2" />
              Skip Rest
            </button>
          </div>
        </div>
      )}

      {/* Form Issue Alert */}
      {lastFormIssue && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-lg flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            {lastFormIssue}
          </div>
        </div>
      )}

      {/* Workout Info Panel */}
      <div className="mt-4 bg-gray-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{exerciseData.name}</h3>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-600/30 rounded-full text-sm">
              Set {currentSet + 1}/{totalSets}
            </span>
          </div>
        </div>

        {/* Current Set Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{reps.length}</div>
            <div className="text-xs text-gray-400">Reps</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{validReps}</div>
            <div className="text-xs text-gray-400">Valid</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${avgFormScore >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>
              {Math.round(avgFormScore)}%
            </div>
            <div className="text-xs text-gray-400">Form</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {reps.length > 0 ? Math.round(reps.reduce((s, r) => s + r.rangeOfMotion, 0) / reps.length) : 0}%
            </div>
            <div className="text-xs text-gray-400">ROM</div>
          </div>
        </div>

        {/* Rep History */}
        {reps.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-gray-400 mb-2">Recent Reps</div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {reps.slice(-10).map((rep, index) => (
                <div
                  key={index}
                  className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                    rep.isValid ? 'bg-green-600/30' : 'bg-red-600/30'
                  }`}
                  title={`Rep ${rep.repNumber}: ${Math.round(rep.formScore)}% form`}
                >
                  {rep.isValid ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-3">
          {phase === 'exercising' && (
            <>
              <button
                onClick={togglePause}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  isPaused
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                }`}
              >
                {isPaused ? (
                  <>
                    <Play className="inline-block w-5 h-5 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="inline-block w-5 h-5 mr-2" />
                    Pause
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  onSetComplete();
                  const vr = reps.filter(r => r.isValid).length;
                  speechService.announceSetComplete(currentSet + 1, vr, reps.length);
                }}
                className="flex-1 py-3 bg-blue-600 rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                <SkipForward className="inline-block w-5 h-5 mr-2" />
                End Set
              </button>
            </>
          )}
          <button
            onClick={onStopWorkout}
            className="py-3 px-6 bg-red-600 rounded-xl font-medium hover:bg-red-700 transition-colors"
          >
            <StopCircle className="inline-block w-5 h-5 mr-2" />
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutDisplay;
