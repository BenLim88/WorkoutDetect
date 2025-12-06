import React, { useCallback, useState } from 'react';
import { useWorkoutStore } from './store/workoutStore';
import ExerciseSelector from './components/ExerciseSelector';
import WorkoutDisplay from './components/WorkoutDisplay';
import WorkoutSummary from './components/WorkoutSummary';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { RepData, WorkoutPhase, WorkoutMode } from './types';
import {
  Activity,
  BarChart3,
  Settings,
  Info,
  Moon,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import './App.css';

type AppView = 'home' | 'workout' | 'summary' | 'analytics';

function App() {
  const [appView, setAppView] = useState<AppView>('home');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);

  const {
    config,
    currentSession,
    currentSetIndex,
    currentReps,
    phase,
    countdownTime,
    restTime,
    workoutHistory,
    isCameraReady,
    isPoseDetectionReady,
    cameraZoomLevel,
    setConfig,
    setPhase,
    setCameraReady,
    setPoseDetectionReady,
    setCameraZoomLevel,
    startWorkout,
    addRep,
    completeSet,
    startNextSet,
    completeWorkout,
    resetWorkout,
    setCountdownTime,
    setRestTime,
  } = useWorkoutStore();

  const isReady = isCameraReady && isPoseDetectionReady;

  const handleStartWorkout = useCallback(() => {
    startWorkout();
    setAppView('workout');
  }, [startWorkout]);

  const handleRepComplete = useCallback((rep: RepData) => {
    addRep(rep);
  }, [addRep]);

  const handleSetComplete = useCallback(() => {
    completeSet();
  }, [completeSet]);

  const handleStartNextSet = useCallback(() => {
    startNextSet();
  }, [startNextSet]);

  const handleCompleteWorkout = useCallback(() => {
    completeWorkout();
    setAppView('summary');
  }, [completeWorkout]);

  const handleStopWorkout = useCallback(() => {
    if (currentReps.length > 0) {
      completeSet();
    }
    completeWorkout();
    setAppView('summary');
  }, [currentReps.length, completeSet, completeWorkout]);

  const handleNewWorkout = useCallback(() => {
    resetWorkout();
    setAppView('home');
  }, [resetWorkout]);

  const handleViewAnalytics = useCallback(() => {
    setAppView('analytics');
  }, []);

  const handleBackFromAnalytics = useCallback(() => {
    if (currentSession && phase === 'summary') {
      setAppView('summary');
    } else {
      setAppView('home');
    }
  }, [currentSession, phase]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('light-mode');
  };

  return (
    <div className={`app min-h-screen ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-lg border-b transition-colors ${
        isDarkMode 
          ? 'bg-gray-900/80 border-gray-800' 
          : 'bg-white/90 border-slate-200'
      }`}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" />
            <span className="font-bold text-lg">FitRep Counter</span>
          </div>
          <div className="flex items-center gap-2">
            {appView === 'home' && (
              <button
                onClick={handleViewAnalytics}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-slate-100'
                }`}
                title="View Analytics"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsSpeechEnabled(!isSpeechEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-slate-100'
              }`}
              title={isSpeechEnabled ? 'Mute Voice' : 'Enable Voice'}
            >
              {isSpeechEnabled ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-slate-100'
              }`}
              title="Toggle Theme"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {appView === 'home' && (
          <ExerciseSelector
            selectedExercise={config.exercise}
            sets={config.sets}
            reps={config.targetReps}
            restPeriod={config.restPeriod}
            zoomLevel={cameraZoomLevel}
            workoutMode={config.mode}
            timedDuration={config.timedDuration}
            onExerciseChange={(exercise) => setConfig({ exercise })}
            onSetsChange={(sets) => setConfig({ sets })}
            onRepsChange={(reps) => setConfig({ targetReps: reps })}
            onRestPeriodChange={(restPeriod) => setConfig({ restPeriod })}
            onZoomChange={setCameraZoomLevel}
            onWorkoutModeChange={(mode: WorkoutMode) => setConfig({ mode })}
            onTimedDurationChange={(timedDuration) => setConfig({ timedDuration })}
            onStartWorkout={handleStartWorkout}
            isReady={true} // Will show loading state in workout display
          />
        )}

        {appView === 'workout' && (
          <WorkoutDisplay
            exercise={config.exercise}
            targetReps={config.targetReps}
            totalSets={config.sets}
            restPeriod={config.restPeriod}
            workoutMode={config.mode}
            timedDuration={config.timedDuration}
            currentSet={currentSetIndex}
            phase={phase}
            countdownTime={countdownTime}
            restTime={restTime}
            reps={currentReps}
            initialZoomLevel={cameraZoomLevel}
            onRepComplete={handleRepComplete}
            onSetComplete={handleSetComplete}
            onStartNextSet={handleStartNextSet}
            onCompleteWorkout={handleCompleteWorkout}
            onStopWorkout={handleStopWorkout}
            onCountdownTick={setCountdownTime}
            onRestTick={setRestTime}
            onPhaseChange={setPhase}
            onCameraReady={setCameraReady}
            onPoseReady={setPoseDetectionReady}
            onZoomChange={setCameraZoomLevel}
          />
        )}

        {appView === 'summary' && currentSession && (
          <WorkoutSummary
            session={currentSession}
            onStartNew={handleNewWorkout}
            onViewAnalytics={handleViewAnalytics}
          />
        )}

        {appView === 'analytics' && (
          <AnalyticsDashboard
            workoutHistory={workoutHistory}
            onBack={handleBackFromAnalytics}
          />
        )}
      </main>

      {/* Footer */}
      <footer className={`mt-auto py-4 text-center text-sm transition-colors ${
        isDarkMode ? 'text-gray-500' : 'text-slate-500'
      }`}>
        <p>
          <Activity className="w-4 h-4 inline mr-1" />
          FitRep Counter - AI-Powered Workout Tracking
        </p>
        <p className="text-xs mt-1">
          Position yourself in frame with good lighting for best results
        </p>
      </footer>
    </div>
  );
}

export default App;
