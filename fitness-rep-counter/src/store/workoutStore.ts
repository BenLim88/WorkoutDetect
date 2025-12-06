import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ExerciseType,
  WorkoutConfig,
  WorkoutSession,
  SetData,
  RepData,
  WorkoutPhase,
  TrendDataPoint,
} from '../types';
import type { ZoomLevel } from '../hooks/useCamera';

interface WorkoutState {
  // Current workout configuration
  config: WorkoutConfig;
  
  // Current workout session
  currentSession: WorkoutSession | null;
  currentSetIndex: number;
  currentReps: RepData[];
  
  // Workout phase
  phase: WorkoutPhase;
  
  // Timer states
  countdownTime: number;
  restTime: number;
  workoutStartTime: number | null;
  setStartTime: number | null;
  
  // Historical data
  workoutHistory: WorkoutSession[];
  
  // UI state
  isCameraReady: boolean;
  isPoseDetectionReady: boolean;
  showSettings: boolean;
  
  // Camera settings
  cameraZoomLevel: ZoomLevel;
  
  // Actions
  setConfig: (config: Partial<WorkoutConfig>) => void;
  setPhase: (phase: WorkoutPhase) => void;
  setCameraReady: (ready: boolean) => void;
  setPoseDetectionReady: (ready: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setCameraZoomLevel: (level: ZoomLevel) => void;
  
  // Workout actions
  startWorkout: () => void;
  addRep: (rep: RepData) => void;
  completeSet: () => void;
  startNextSet: () => void;
  completeWorkout: () => void;
  resetWorkout: () => void;
  
  // Timer actions
  setCountdownTime: (time: number) => void;
  setRestTime: (time: number) => void;
  
  // History actions
  addToHistory: (session: WorkoutSession) => void;
  clearHistory: () => void;
  
  // Computed data
  getTrendData: () => TrendDataPoint[];
  getExerciseHistory: (exercise: ExerciseType) => WorkoutSession[];
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      // Initial state
      config: {
        exercise: 'pushups',
        sets: 3,
        targetReps: 10,
        restPeriod: 60,
      },
      
      currentSession: null,
      currentSetIndex: 0,
      currentReps: [],
      
      phase: 'setup',
      
      countdownTime: 5,
      restTime: 0,
      workoutStartTime: null,
      setStartTime: null,
      
      workoutHistory: [],
      
      isCameraReady: false,
      isPoseDetectionReady: false,
      showSettings: false,
      
      cameraZoomLevel: 1,
      
      // Actions
      setConfig: (config) => set((state) => ({
        config: { ...state.config, ...config },
      })),
      
      setPhase: (phase) => set({ phase }),
      
      setCameraReady: (ready) => set({ isCameraReady: ready }),
      
      setPoseDetectionReady: (ready) => set({ isPoseDetectionReady: ready }),
      
      setShowSettings: (show) => set({ showSettings: show }),
      
      setCameraZoomLevel: (level) => set({ cameraZoomLevel: level }),
      
      startWorkout: () => {
        const { config } = get();
        const session: WorkoutSession = {
          id: Date.now().toString(),
          date: Date.now(),
          exercise: config.exercise,
          config,
          sets: [],
          totalReps: 0,
          totalValidReps: 0,
          averageFormScore: 0,
          averageROM: 0,
          totalDuration: 0,
          caloriesEstimate: 0,
          recommendations: [],
        };
        
        set({
          currentSession: session,
          currentSetIndex: 0,
          currentReps: [],
          workoutStartTime: Date.now(),
          setStartTime: Date.now(),
          phase: 'countdown',
          countdownTime: 5,
        });
      },
      
      addRep: (rep) => set((state) => ({
        currentReps: [...state.currentReps, rep],
      })),
      
      completeSet: () => {
        const { currentReps, currentSetIndex, currentSession, config } = get();
        
        if (!currentSession) return;
        
        const validReps = currentReps.filter((r) => r.isValid);
        const setData: SetData = {
          setNumber: currentSetIndex + 1,
          reps: currentReps,
          totalReps: currentReps.length,
          validReps: validReps.length,
          averageFormScore: currentReps.length > 0
            ? currentReps.reduce((sum, r) => sum + r.formScore, 0) / currentReps.length
            : 0,
          averageROM: currentReps.length > 0
            ? currentReps.reduce((sum, r) => sum + r.rangeOfMotion, 0) / currentReps.length
            : 0,
          duration: Date.now() - (get().setStartTime || Date.now()),
          startTime: get().setStartTime || Date.now(),
          endTime: Date.now(),
        };
        
        const updatedSession: WorkoutSession = {
          ...currentSession,
          sets: [...currentSession.sets, setData],
          totalReps: currentSession.totalReps + setData.totalReps,
          totalValidReps: currentSession.totalValidReps + setData.validReps,
        };
        
        // Check if workout is complete
        if (currentSetIndex + 1 >= config.sets) {
          set({
            currentSession: updatedSession,
            phase: 'workoutComplete',
          });
        } else {
          set({
            currentSession: updatedSession,
            phase: 'resting',
            restTime: config.restPeriod,
            currentReps: [],
          });
        }
      },
      
      startNextSet: () => {
        const { currentSetIndex } = get();
        set({
          currentSetIndex: currentSetIndex + 1,
          setStartTime: Date.now(),
          currentReps: [],
          phase: 'countdown',
          countdownTime: 5,
        });
      },
      
      completeWorkout: () => {
        const { currentSession, workoutStartTime } = get();
        
        if (!currentSession) return;
        
        const totalDuration = Date.now() - (workoutStartTime || Date.now());
        const allReps = currentSession.sets.flatMap((s) => s.reps);
        
        const finalSession: WorkoutSession = {
          ...currentSession,
          totalDuration,
          averageFormScore: allReps.length > 0
            ? allReps.reduce((sum, r) => sum + r.formScore, 0) / allReps.length
            : 0,
          averageROM: allReps.length > 0
            ? allReps.reduce((sum, r) => sum + r.rangeOfMotion, 0) / allReps.length
            : 0,
          caloriesEstimate: Math.round(allReps.length * 0.5 * (totalDuration / 60000)),
          recommendations: generateRecommendations(currentSession),
        };
        
        set({
          currentSession: finalSession,
          phase: 'summary',
        });
        
        // Add to history
        get().addToHistory(finalSession);
      },
      
      resetWorkout: () => set({
        currentSession: null,
        currentSetIndex: 0,
        currentReps: [],
        phase: 'setup',
        workoutStartTime: null,
        setStartTime: null,
        countdownTime: 5,
        restTime: 0,
      }),
      
      setCountdownTime: (time) => set({ countdownTime: time }),
      
      setRestTime: (time) => set({ restTime: time }),
      
      addToHistory: (session) => set((state) => ({
        workoutHistory: [session, ...state.workoutHistory].slice(0, 100), // Keep last 100 sessions
      })),
      
      clearHistory: () => set({ workoutHistory: [] }),
      
      getTrendData: () => {
        const { workoutHistory } = get();
        
        // Group by date and calculate averages
        const groupedByDate = workoutHistory.reduce((acc, session) => {
          const date = new Date(session.date).toLocaleDateString();
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(session);
          return acc;
        }, {} as Record<string, WorkoutSession[]>);
        
        return Object.entries(groupedByDate)
          .map(([date, sessions]) => ({
            date,
            totalReps: sessions.reduce((sum, s) => sum + s.totalReps, 0),
            validReps: sessions.reduce((sum, s) => sum + s.totalValidReps, 0),
            formScore: sessions.reduce((sum, s) => sum + s.averageFormScore, 0) / sessions.length,
            rom: sessions.reduce((sum, s) => sum + s.averageROM, 0) / sessions.length,
          }))
          .reverse()
          .slice(0, 30); // Last 30 days
      },
      
      getExerciseHistory: (exercise) => {
        const { workoutHistory } = get();
        return workoutHistory.filter((s) => s.exercise === exercise);
      },
    }),
    {
      name: 'fitness-workout-storage',
      partialize: (state) => ({
        workoutHistory: state.workoutHistory,
        config: state.config,
        cameraZoomLevel: state.cameraZoomLevel,
      }),
    }
  )
);

// Helper function to generate recommendations
function generateRecommendations(session: WorkoutSession): string[] {
  const recommendations: string[] = [];
  
  const avgFormScore = session.sets.length > 0
    ? session.sets.reduce((sum, s) => sum + s.averageFormScore, 0) / session.sets.length
    : 0;
  
  const avgROM = session.sets.length > 0
    ? session.sets.reduce((sum, s) => sum + s.averageROM, 0) / session.sets.length
    : 0;
  
  const validRepRatio = session.totalReps > 0
    ? session.totalValidReps / session.totalReps
    : 0;
  
  // Form score recommendations
  if (avgFormScore < 60) {
    recommendations.push(
      'Focus on form over speed. Consider reducing reps and concentrating on proper technique.'
    );
  } else if (avgFormScore < 80) {
    recommendations.push(
      'Good progress! Continue working on maintaining consistent form throughout each set.'
    );
  } else {
    recommendations.push(
      'Excellent form! Consider increasing difficulty or adding more reps to challenge yourself.'
    );
  }
  
  // ROM recommendations
  if (avgROM < 70) {
    recommendations.push(
      'Work on achieving full range of motion. Consider mobility exercises before your workout.'
    );
  } else if (avgROM < 85) {
    recommendations.push(
      'Good range of motion. Focus on controlling the movement through the full range.'
    );
  }
  
  // Valid rep ratio recommendations
  if (validRepRatio < 0.7) {
    recommendations.push(
      'Many reps were invalid. Slow down and ensure each rep meets proper standards.'
    );
  }
  
  // Exercise-specific recommendations
  switch (session.exercise) {
    case 'pushups':
      if (avgFormScore < 75) {
        recommendations.push(
          'Keep your core engaged throughout the movement to maintain a straight body line.'
        );
      }
      break;
    case 'squats':
      if (avgROM < 80) {
        recommendations.push(
          'Try to reach parallel or below. Work on hip and ankle mobility.'
        );
      }
      break;
    case 'deadlift':
      recommendations.push(
        'Always prioritize a neutral spine. Consider using lighter weight if form breaks down.'
      );
      break;
    case 'pullups':
      if (validRepRatio < 0.8) {
        recommendations.push(
          'Ensure full extension at bottom and chin above bar at top for valid reps.'
        );
      }
      break;
  }
  
  // General improvement
  recommendations.push(
    `Next workout: Try to complete ${Math.ceil(session.totalValidReps * 1.05)} valid reps with improved form.`
  );
  
  return recommendations;
}
