import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { WorkoutSession, ExerciseType } from '../types';
import { exercises, getExerciseList } from '../data/exercises';
import { format, subDays, isAfter } from 'date-fns';
import {
  TrendingUp,
  Calendar,
  Target,
  Activity,
  BarChart3,
  PieChart,
  ArrowLeft,
  Filter,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  workoutHistory: WorkoutSession[];
  onBack: () => void;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  workoutHistory,
  onBack,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType | 'all'>('all');

  // Filter data based on time range and exercise
  const filteredHistory = useMemo(() => {
    let filtered = workoutHistory;

    // Time filter
    if (timeRange !== 'all') {
      const days = parseInt(timeRange);
      const cutoff = subDays(new Date(), days);
      filtered = filtered.filter((session) =>
        isAfter(new Date(session.date), cutoff)
      );
    }

    // Exercise filter
    if (selectedExercise !== 'all') {
      filtered = filtered.filter((session) => session.exercise === selectedExercise);
    }

    return filtered.sort((a, b) => a.date - b.date);
  }, [workoutHistory, timeRange, selectedExercise]);

  // Calculate trends data
  const trendsData = useMemo(() => {
    const grouped = filteredHistory.reduce((acc, session) => {
      const date = format(new Date(session.date), 'MMM d');
      if (!acc[date]) {
        acc[date] = {
          date,
          totalReps: 0,
          validReps: 0,
          formScore: 0,
          rom: 0,
          count: 0,
        };
      }
      acc[date].totalReps += session.totalReps;
      acc[date].validReps += session.totalValidReps;
      acc[date].formScore += session.averageFormScore;
      acc[date].rom += session.averageROM;
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { date: string; totalReps: number; validReps: number; formScore: number; rom: number; count: number }>);

    return Object.values(grouped).map((day) => ({
      date: day.date,
      totalReps: day.totalReps,
      validReps: day.validReps,
      formScore: Math.round(day.formScore / day.count),
      rom: Math.round(day.rom / day.count),
    }));
  }, [filteredHistory]);

  // Exercise distribution data
  const exerciseDistribution = useMemo(() => {
    const distribution = workoutHistory.reduce((acc, session) => {
      if (!acc[session.exercise]) {
        acc[session.exercise] = { exercise: session.exercise, count: 0, reps: 0 };
      }
      acc[session.exercise].count += 1;
      acc[session.exercise].reps += session.totalReps;
      return acc;
    }, {} as Record<string, { exercise: string; count: number; reps: number }>);

    return Object.values(distribution).map((item) => ({
      name: exercises[item.exercise as ExerciseType].name,
      workouts: item.count,
      reps: item.reps,
    }));
  }, [workoutHistory]);

  // Joint angle data for radar chart
  const jointAngleData = useMemo(() => {
    if (filteredHistory.length === 0) return [];

    const angleTypes = [
      'leftElbow',
      'rightElbow',
      'leftShoulder',
      'rightShoulder',
      'leftHip',
      'rightHip',
      'leftKnee',
      'rightKnee',
    ];

    return angleTypes.map((type) => {
      const angles = filteredHistory
        .flatMap((s) => s.sets)
        .flatMap((set) => set.reps)
        .map((rep) => rep.jointAngles[type as keyof typeof rep.jointAngles])
        .filter((a): a is number => a !== undefined);

      return {
        angle: type.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        average: angles.length > 0
          ? Math.round(angles.reduce((a, b) => a + b, 0) / angles.length)
          : 0,
        max: angles.length > 0 ? Math.round(Math.max(...angles)) : 0,
        min: angles.length > 0 ? Math.round(Math.min(...angles)) : 0,
      };
    });
  }, [filteredHistory]);

  // ROM progress data
  const romProgressData = useMemo(() => {
    return filteredHistory.map((session) => ({
      date: format(new Date(session.date), 'MMM d'),
      rom: Math.round(session.averageROM),
      formScore: Math.round(session.averageFormScore),
    }));
  }, [filteredHistory]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (filteredHistory.length === 0) {
      return {
        totalWorkouts: 0,
        totalReps: 0,
        avgFormScore: 0,
        avgROM: 0,
        improvementRate: 0,
      };
    }

    const totalReps = filteredHistory.reduce((sum, s) => sum + s.totalReps, 0);
    const avgFormScore =
      filteredHistory.reduce((sum, s) => sum + s.averageFormScore, 0) /
      filteredHistory.length;
    const avgROM =
      filteredHistory.reduce((sum, s) => sum + s.averageROM, 0) /
      filteredHistory.length;

    // Calculate improvement (compare first half to second half)
    const midpoint = Math.floor(filteredHistory.length / 2);
    const firstHalf = filteredHistory.slice(0, midpoint);
    const secondHalf = filteredHistory.slice(midpoint);

    const firstHalfAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((sum, s) => sum + s.averageFormScore, 0) / firstHalf.length
        : 0;
    const secondHalfAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((sum, s) => sum + s.averageFormScore, 0) / secondHalf.length
        : 0;
    const improvementRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

    return {
      totalWorkouts: filteredHistory.length,
      totalReps,
      avgFormScore: Math.round(avgFormScore),
      avgROM: Math.round(avgROM),
      improvementRate: Math.round(improvementRate),
    };
  }, [filteredHistory]);

  const exerciseList = getExerciseList();

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <h2 className="text-2xl font-bold flex items-center">
          <BarChart3 className="w-6 h-6 mr-2 text-blue-400" />
          Analytics
        </h2>
        <div className="w-20" /> {/* Spacer */}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value as ExerciseType | 'all')}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Exercises</option>
            {exerciseList.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <Activity className="w-6 h-6 mx-auto mb-2 text-blue-400" />
          <div className="text-2xl font-bold">{summaryStats.totalWorkouts}</div>
          <div className="text-xs text-gray-400">Workouts</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <Target className="w-6 h-6 mx-auto mb-2 text-green-400" />
          <div className="text-2xl font-bold">{summaryStats.totalReps}</div>
          <div className="text-xs text-gray-400">Total Reps</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <PieChart className="w-6 h-6 mx-auto mb-2 text-purple-400" />
          <div className="text-2xl font-bold">{summaryStats.avgFormScore}%</div>
          <div className="text-xs text-gray-400">Avg Form</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <Activity className="w-6 h-6 mx-auto mb-2 text-orange-400" />
          <div className="text-2xl font-bold">{summaryStats.avgROM}%</div>
          <div className="text-xs text-gray-400">Avg ROM</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center">
          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
          <div className={`text-2xl font-bold ${summaryStats.improvementRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {summaryStats.improvementRate > 0 ? '+' : ''}{summaryStats.improvementRate}%
          </div>
          <div className="text-xs text-gray-400">Improvement</div>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="bg-gray-800/50 rounded-xl p-8 text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No workout data for the selected filters</p>
        </div>
      ) : (
        <>
          {/* Reps Over Time */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-4">Reps Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="totalReps"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                  name="Total Reps"
                />
                <Area
                  type="monotone"
                  dataKey="validReps"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.3}
                  name="Valid Reps"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Form Score & ROM Progress */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-4">Form Score & Range of Motion Progress</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={romProgressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="formScore"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={{ fill: '#8B5CF6', r: 4 }}
                  name="Form Score %"
                />
                <Line
                  type="monotone"
                  dataKey="rom"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ fill: '#F59E0B', r: 4 }}
                  name="ROM %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Joint Angles Radar */}
          {jointAngleData.length > 0 && jointAngleData.some((d) => d.average > 0) && (
            <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold mb-4">Joint Angle Analysis</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={jointAngleData}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="angle" stroke="#9CA3AF" fontSize={10} />
                  <PolarRadiusAxis stroke="#9CA3AF" fontSize={10} />
                  <Radar
                    name="Average Angle"
                    dataKey="average"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Max Angle"
                    dataKey="max"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Exercise Distribution */}
          {exerciseDistribution.length > 0 && (
            <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold mb-4">Exercise Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={exerciseDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="workouts" fill="#3B82F6" name="Workouts" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="reps" fill="#10B981" name="Total Reps" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent Workouts Table */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Recent Workouts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Exercise</th>
                    <th className="text-center py-2 px-2">Sets</th>
                    <th className="text-center py-2 px-2">Reps</th>
                    <th className="text-center py-2 px-2">Form</th>
                    <th className="text-center py-2 px-2">ROM</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory
                    .slice()
                    .reverse()
                    .slice(0, 10)
                    .map((session) => (
                      <tr key={session.id} className="border-b border-gray-700/50">
                        <td className="py-2 px-2">
                          {format(new Date(session.date), 'MMM d, yyyy')}
                        </td>
                        <td className="py-2 px-2">
                          {exercises[session.exercise].name}
                        </td>
                        <td className="py-2 px-2 text-center">{session.sets.length}</td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-green-400">{session.totalValidReps}</span>
                          <span className="text-gray-500">/{session.totalReps}</span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={
                              session.averageFormScore >= 80
                                ? 'text-green-400'
                                : session.averageFormScore >= 60
                                ? 'text-yellow-400'
                                : 'text-red-400'
                            }
                          >
                            {Math.round(session.averageFormScore)}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {Math.round(session.averageROM)}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
