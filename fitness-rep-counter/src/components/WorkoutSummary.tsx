import React from 'react';
import { WorkoutSession } from '../types';
import { exercises } from '../data/exercises';
import { format } from 'date-fns';
import {
  Trophy,
  Target,
  Clock,
  Flame,
  TrendingUp,
  CheckCircle,
  XCircle,
  BarChart3,
  Lightbulb,
  RefreshCw,
  Share2,
} from 'lucide-react';

interface WorkoutSummaryProps {
  session: WorkoutSession;
  onStartNew: () => void;
  onViewAnalytics: () => void;
}

const WorkoutSummary: React.FC<WorkoutSummaryProps> = ({
  session,
  onStartNew,
  onViewAnalytics,
}) => {
  const exerciseData = exercises[session.exercise];
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPerformanceGrade = () => {
    const score = session.averageFormScore;
    if (score >= 90) return { grade: 'A+', color: 'text-green-400', message: 'Outstanding!' };
    if (score >= 80) return { grade: 'A', color: 'text-green-400', message: 'Excellent work!' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-400', message: 'Good job!' };
    if (score >= 60) return { grade: 'C', color: 'text-yellow-400', message: 'Keep practicing!' };
    return { grade: 'D', color: 'text-red-400', message: 'Focus on form!' };
  };

  const performance = getPerformanceGrade();

  const shareWorkout = async () => {
    const shareText = `🏋️ Just completed a ${exerciseData.name} workout!\n` +
      `✅ ${session.totalValidReps}/${session.totalReps} valid reps\n` +
      `📊 ${Math.round(session.averageFormScore)}% form score\n` +
      `⏱️ ${formatDuration(session.totalDuration)}\n` +
      `#FitnessRepCounter #Workout`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Workout Complete!',
          text: shareText,
        });
      } catch {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Workout summary copied to clipboard!');
    }
  };

  return (
    <div className="workout-summary max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold mb-2">Workout Complete!</h2>
        <p className="text-gray-400">
          {format(new Date(session.date), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Performance Grade */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 mb-6 text-center">
        <div className={`text-7xl font-bold ${performance.color} mb-2`}>
          {performance.grade}
        </div>
        <div className="text-xl text-gray-300">{performance.message}</div>
        <div className="text-sm text-gray-500 mt-1">{exerciseData.name}</div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <Target className="w-6 h-6 mx-auto mb-2 text-blue-400" />
          <div className="text-2xl font-bold">{session.totalReps}</div>
          <div className="text-xs text-gray-400">Total Reps</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-400" />
          <div className="text-2xl font-bold text-green-400">{session.totalValidReps}</div>
          <div className="text-xs text-gray-400">Valid Reps</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <Clock className="w-6 h-6 mx-auto mb-2 text-purple-400" />
          <div className="text-2xl font-bold">{formatDuration(session.totalDuration)}</div>
          <div className="text-xs text-gray-400">Duration</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <Flame className="w-6 h-6 mx-auto mb-2 text-orange-400" />
          <div className="text-2xl font-bold text-orange-400">{session.caloriesEstimate}</div>
          <div className="text-xs text-gray-400">Est. Calories</div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
        <h3 className="font-semibold mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-blue-400" />
          Performance Metrics
        </h3>
        
        <div className="space-y-4">
          {/* Form Score */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Form Score</span>
              <span className="font-medium">{Math.round(session.averageFormScore)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
                style={{ width: `${session.averageFormScore}%` }}
              />
            </div>
          </div>

          {/* Range of Motion */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Range of Motion</span>
              <span className="font-medium">{Math.round(session.averageROM)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                style={{ width: `${session.averageROM}%` }}
              />
            </div>
          </div>

          {/* Valid Rep Ratio */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Valid Rep Rate</span>
              <span className="font-medium">
                {session.totalReps > 0
                  ? Math.round((session.totalValidReps / session.totalReps) * 100)
                  : 0}%
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                style={{
                  width: `${
                    session.totalReps > 0
                      ? (session.totalValidReps / session.totalReps) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Set Breakdown */}
      <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
        <h3 className="font-semibold mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
          Set Breakdown
        </h3>
        
        <div className="space-y-3">
          {session.sets.map((set, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-700/30 rounded-lg p-3"
            >
              <div className="flex items-center">
                <span className="w-8 h-8 bg-blue-600/30 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                  {set.setNumber}
                </span>
                <div>
                  <div className="font-medium">
                    {set.validReps}/{set.totalReps} reps
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDuration(set.duration)} • {Math.round(set.averageFormScore)}% form
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {set.validReps === set.totalReps ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <span className="text-sm text-gray-400">
                    <XCircle className="w-4 h-4 inline text-red-400" />
                    {set.totalReps - set.validReps}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-4 mb-6">
        <h3 className="font-semibold mb-4 flex items-center">
          <Lightbulb className="w-5 h-5 mr-2 text-yellow-400" />
          Recommendations for Next Workout
        </h3>
        
        <ul className="space-y-3">
          {session.recommendations.map((rec, index) => (
            <li key={index} className="flex items-start">
              <span className="w-6 h-6 bg-blue-600/30 rounded-full flex items-center justify-center text-xs font-medium mr-3 flex-shrink-0 mt-0.5">
                {index + 1}
              </span>
              <span className="text-gray-300 text-sm">{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onStartNew}
          className="flex-1 py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl font-bold hover:from-green-600 hover:to-blue-600 transition-all"
        >
          <RefreshCw className="inline-block w-5 h-5 mr-2" />
          New Workout
        </button>
        <button
          onClick={onViewAnalytics}
          className="flex-1 py-4 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition-colors"
        >
          <BarChart3 className="inline-block w-5 h-5 mr-2" />
          View Analytics
        </button>
        <button
          onClick={shareWorkout}
          className="py-4 px-4 bg-gray-700 rounded-xl hover:bg-gray-600 transition-colors"
          title="Share"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default WorkoutSummary;
