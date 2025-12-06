// Exercise Types
export type ExerciseType = 
  | 'pushups'
  | 'pullups'
  | 'situps'
  | 'squats'
  | 'deadlift'
  | 'muscleup'
  | 'dips';

export interface Exercise {
  id: ExerciseType;
  name: string;
  description: string;
  targetMuscles: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  keyPoints: string[];
}

// Workout Mode
export type WorkoutMode = 'sets' | 'timed';

// Workout Configuration
export interface WorkoutConfig {
  exercise: ExerciseType;
  mode: WorkoutMode;
  sets: number;
  targetReps: number;
  restPeriod: number; // in seconds
  timedDuration: number; // in seconds, for timed mode
}

// Rep Data
export interface RepData {
  repNumber: number;
  timestamp: number;
  duration: number;
  isValid: boolean;
  formScore: number; // 0-100
  jointAngles: JointAngles;
  rangeOfMotion: number; // percentage of ideal ROM
  issues: string[];
}

// Set Data
export interface SetData {
  setNumber: number;
  reps: RepData[];
  totalReps: number;
  validReps: number;
  averageFormScore: number;
  averageROM: number;
  duration: number;
  startTime: number;
  endTime: number;
}

// Workout Session
export interface WorkoutSession {
  id: string;
  date: number;
  exercise: ExerciseType;
  config: WorkoutConfig;
  sets: SetData[];
  totalReps: number;
  totalValidReps: number;
  averageFormScore: number;
  averageROM: number;
  totalDuration: number;
  caloriesEstimate: number;
  recommendations: string[];
}

// Joint Angles for Analysis
export interface JointAngles {
  leftElbow?: number;
  rightElbow?: number;
  leftShoulder?: number;
  rightShoulder?: number;
  leftHip?: number;
  rightHip?: number;
  leftKnee?: number;
  rightKnee?: number;
  spine?: number;
  neck?: number;
}

// Pose Keypoint
export interface Keypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

// Pose Detection Result
export interface PoseResult {
  keypoints: Keypoint[];
  score: number;
}

// App State Types
export type WorkoutPhase = 
  | 'setup'
  | 'countdown'
  | 'exercising'
  | 'resting'
  | 'setComplete'
  | 'workoutComplete'
  | 'summary';

// Chart Data Types
export interface TrendDataPoint {
  date: string;
  totalReps: number;
  validReps: number;
  formScore: number;
  rom: number;
}

export interface JointAngleHistory {
  date: string;
  exercise: ExerciseType;
  angles: JointAngles;
}

// Form Issue Types
export interface FormIssue {
  type: string;
  severity: 'minor' | 'moderate' | 'major';
  message: string;
  recommendation: string;
}

// Camera Perspective Types
export type CameraPerspective = 'front' | 'side' | 'unknown';

// Speech Settings
export interface SpeechSettings {
  enabled: boolean;
  volume: number;
  rate: number;
  pitch: number;
}
