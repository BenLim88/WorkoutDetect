import React, { useState } from 'react';
import { ExerciseType, WorkoutMode } from '../types';
import { exercises, getExerciseList } from '../data/exercises';
import { 
  Dumbbell, 
  Target, 
  Timer,
  ChevronRight,
  Zap,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  Repeat
} from 'lucide-react';
import CameraPreview from './CameraPreview';
import type { ZoomLevel } from '../hooks/useCamera';

interface ExerciseSelectorProps {
  selectedExercise: ExerciseType;
  sets: number;
  reps: number;
  restPeriod: number;
  zoomLevel: ZoomLevel;
  workoutMode: WorkoutMode;
  timedDuration: number;
  onExerciseChange: (exercise: ExerciseType) => void;
  onSetsChange: (sets: number) => void;
  onRepsChange: (reps: number) => void;
  onRestPeriodChange: (seconds: number) => void;
  onZoomChange: (level: ZoomLevel) => void;
  onWorkoutModeChange: (mode: WorkoutMode) => void;
  onTimedDurationChange: (seconds: number) => void;
  onStartWorkout: () => void;
  isReady: boolean;
}

const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({
  selectedExercise,
  sets,
  reps,
  restPeriod,
  zoomLevel,
  workoutMode,
  timedDuration,
  onExerciseChange,
  onSetsChange,
  onRepsChange,
  onRestPeriodChange,
  onZoomChange,
  onWorkoutModeChange,
  onTimedDurationChange,
  onStartWorkout,
  isReady,
}) => {
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const exerciseList = getExerciseList();
  const selected = exercises[selectedExercise];

  const difficultyColors = {
    beginner: 'bg-green-500 text-white',
    intermediate: 'bg-yellow-500 text-gray-900',
    advanced: 'bg-red-500 text-white',
  };

  return (
    <div className="exercise-selector">
      <h2 className="text-2xl font-bold mb-6 text-center">
        <Dumbbell className="inline-block mr-2" />
        Select Your Workout
      </h2>

      {/* Exercise Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Exercise</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {exerciseList.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => onExerciseChange(exercise.id)}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedExercise === exercise.id
                  ? 'border-blue-500 bg-blue-500/20 exercise-card-selected'
                  : 'border-gray-600 hover:border-gray-400 bg-gray-800/50 exercise-card'
              }`}
            >
              <div className="text-lg font-semibold mb-1 exercise-name">{exercise.name}</div>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                  difficultyColors[exercise.difficulty]
                }`}
              >
                {exercise.difficulty}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Workout Mode Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Workout Mode</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onWorkoutModeChange('sets')}
            className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
              workoutMode === 'sets'
                ? 'border-blue-500 bg-blue-500/20 exercise-card-selected'
                : 'border-gray-600 hover:border-gray-400 bg-gray-800/50 exercise-card'
            }`}
          >
            <Repeat className="w-5 h-5" />
            <div>
              <div className="font-semibold exercise-name">Sets & Reps</div>
              <div className="text-xs text-gray-400">Traditional workout</div>
            </div>
          </button>
          <button
            onClick={() => onWorkoutModeChange('timed')}
            className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
              workoutMode === 'timed'
                ? 'border-blue-500 bg-blue-500/20 exercise-card-selected'
                : 'border-gray-600 hover:border-gray-400 bg-gray-800/50 exercise-card'
            }`}
          >
            <Clock className="w-5 h-5" />
            <div>
              <div className="font-semibold exercise-name">Max Reps</div>
              <div className="text-xs text-gray-400">Timed challenge</div>
            </div>
          </button>
        </div>
      </div>

      {/* Selected Exercise Details */}
      <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
        <h3 className="text-xl font-semibold mb-2">{selected.name}</h3>
        <p className="text-gray-400 text-sm mb-3">{selected.description}</p>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {selected.targetMuscles.map((muscle) => (
            <span
              key={muscle}
              className="px-2 py-1 bg-blue-600/30 rounded-full text-xs"
            >
              {muscle}
            </span>
          ))}
        </div>

        <div className="border-t border-gray-700 pt-3 mt-3">
          <h4 className="font-medium mb-2 flex items-center">
            <Target className="w-4 h-4 mr-2" />
            Key Points
          </h4>
          <ul className="text-sm text-gray-400 space-y-1">
            {selected.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start">
                <ChevronRight className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0 text-blue-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Workout Configuration */}
      {workoutMode === 'sets' ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              <Target className="w-4 h-4 inline mr-1" />
              Sets
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={sets}
              onChange={(e) => onSetsChange(parseInt(e.target.value) || 1)}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-center text-xl font-bold focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              <Zap className="w-4 h-4 inline mr-1" />
              Reps
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={reps}
              onChange={(e) => onRepsChange(parseInt(e.target.value) || 1)}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-center text-xl font-bold focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              <Timer className="w-4 h-4 inline mr-1" />
              Rest (sec)
            </label>
            <input
              type="number"
              min={10}
              max={300}
              step={5}
              value={restPeriod}
              onChange={(e) => onRestPeriodChange(parseInt(e.target.value) || 30)}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-center text-xl font-bold focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            Duration
          </label>
          <div className="grid grid-cols-4 gap-3">
            {[30, 60, 90, 120].map((seconds) => (
              <button
                key={seconds}
                onClick={() => onTimedDurationChange(seconds)}
                className={`p-3 rounded-xl border-2 transition-all text-center ${
                  timedDuration === seconds
                    ? 'border-blue-500 bg-blue-500/20 exercise-card-selected'
                    : 'border-gray-600 hover:border-gray-400 bg-gray-800/50 exercise-card'
                }`}
              >
                <div className="text-xl font-bold exercise-name">
                  {seconds >= 60 ? `${seconds / 60}` : seconds}
                </div>
                <div className="text-xs text-gray-400">
                  {seconds >= 60 ? (seconds === 60 ? 'minute' : 'minutes') : 'seconds'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workout Summary */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-4 mb-6">
        <h4 className="font-medium mb-2">Workout Summary</h4>
        {workoutMode === 'sets' ? (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{sets * reps}</div>
              <div className="text-xs text-gray-400">Total Reps</div>
            </div>
            <div>
              <div className="text-2xl font-bold">~{Math.round((sets * reps * 3 + (sets - 1) * restPeriod) / 60)}</div>
              <div className="text-xs text-gray-400">Est. Minutes</div>
            </div>
            <div>
              <div className="text-2xl font-bold">~{Math.round(sets * reps * 0.3)}</div>
              <div className="text-xs text-gray-400">Est. Calories</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{timedDuration >= 60 ? `${timedDuration / 60}:00` : `0:${timedDuration}`}</div>
              <div className="text-xs text-gray-400">Duration</div>
            </div>
            <div>
              <div className="text-2xl font-bold">Max</div>
              <div className="text-xs text-gray-400">Reps Goal</div>
            </div>
            <div>
              <div className="text-2xl font-bold">🔥</div>
              <div className="text-xs text-gray-400">Challenge</div>
            </div>
          </div>
        )}
      </div>

      {/* Camera Setup Section */}
      <div className="mb-6">
        <button
          onClick={() => setShowCameraPreview(!showCameraPreview)}
          className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-blue-400" />
            <div className="text-left">
              <div className="font-medium">Camera Setup</div>
              <div className="text-sm text-gray-400">
                Current zoom: {zoomLevel}x {isCameraReady && showCameraPreview ? '• Camera ready' : ''}
              </div>
            </div>
          </div>
          {showCameraPreview ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showCameraPreview && (
          <div className="mt-3">
            <CameraPreview
              zoomLevel={zoomLevel}
              onZoomChange={onZoomChange}
              onReady={setIsCameraReady}
            />
          </div>
        )}
      </div>

      {/* Start Button */}
      <button
        onClick={onStartWorkout}
        disabled={!isReady}
        className={`w-full py-4 rounded-xl text-xl font-bold transition-all ${
          isReady
            ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 shadow-lg hover:shadow-green-500/25'
            : 'bg-gray-700 cursor-not-allowed'
        }`}
      >
        {isReady ? (
          <>
            <Zap className="inline-block mr-2" />
            Start Workout
          </>
        ) : (
          'Loading Camera & AI...'
        )}
      </button>
    </div>
  );
};

export default ExerciseSelector;
