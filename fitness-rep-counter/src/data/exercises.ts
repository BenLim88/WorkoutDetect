import { Exercise, ExerciseType } from '../types';

export const exercises: Record<ExerciseType, Exercise> = {
  pushups: {
    id: 'pushups',
    name: 'Push-Ups',
    description: 'Classic upper body exercise targeting chest, shoulders, and triceps.',
    targetMuscles: ['Chest', 'Shoulders', 'Triceps', 'Core'],
    difficulty: 'beginner',
    keyPoints: [
      'Keep your body in a straight line from head to heels',
      'Lower chest to near ground level',
      'Keep elbows at 45-degree angle from body',
      'Fully extend arms at the top',
      'Engage core throughout the movement'
    ]
  },
  pullups: {
    id: 'pullups',
    name: 'Pull-Ups',
    description: 'Upper body pulling exercise for back and biceps.',
    targetMuscles: ['Lats', 'Biceps', 'Rear Delts', 'Forearms'],
    difficulty: 'intermediate',
    keyPoints: [
      'Start from a dead hang with arms fully extended',
      'Pull until chin is above the bar',
      'Keep shoulders down and back engaged',
      'Control the descent',
      'Avoid swinging or kipping'
    ]
  },
  situps: {
    id: 'situps',
    name: 'Sit-Ups',
    description: 'Core exercise targeting abdominal muscles.',
    targetMuscles: ['Rectus Abdominis', 'Hip Flexors', 'Obliques'],
    difficulty: 'beginner',
    keyPoints: [
      'Keep feet flat on the ground',
      'Cross arms over chest or behind head',
      'Curl up by engaging abs, not pulling with neck',
      'Come up to at least 90 degrees',
      'Control the lowering phase'
    ]
  },
  squats: {
    id: 'squats',
    name: 'Squats',
    description: 'Fundamental lower body exercise.',
    targetMuscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core'],
    difficulty: 'beginner',
    keyPoints: [
      'Feet shoulder-width apart, toes slightly out',
      'Lower until thighs are parallel to ground',
      'Keep knees tracking over toes',
      'Maintain neutral spine',
      'Drive through heels to stand'
    ]
  },
  deadlift: {
    id: 'deadlift',
    name: 'Deadlift',
    description: 'Compound exercise for posterior chain development.',
    targetMuscles: ['Lower Back', 'Glutes', 'Hamstrings', 'Traps', 'Forearms'],
    difficulty: 'intermediate',
    keyPoints: [
      'Bar over mid-foot, feet hip-width apart',
      'Hinge at hips, keep back flat',
      'Grip bar just outside knees',
      'Drive through heels, keep bar close to body',
      'Lock out hips and knees at top'
    ]
  },
  muscleup: {
    id: 'muscleup',
    name: 'Muscle-Up',
    description: 'Advanced calisthenics movement combining pull-up and dip.',
    targetMuscles: ['Lats', 'Chest', 'Triceps', 'Shoulders', 'Core'],
    difficulty: 'advanced',
    keyPoints: [
      'Start with explosive pull-up',
      'Pull bar to lower chest/upper abs',
      'Transition by rotating wrists over bar',
      'Push up to full arm extension',
      'Control the descent through both phases'
    ]
  },
  dips: {
    id: 'dips',
    name: 'Dips',
    description: 'Upper body pushing exercise for chest and triceps.',
    targetMuscles: ['Chest', 'Triceps', 'Shoulders'],
    difficulty: 'intermediate',
    keyPoints: [
      'Start with arms fully extended',
      'Lower until upper arms are parallel to ground',
      'Keep elbows close to body for triceps focus',
      'Lean forward slightly for chest emphasis',
      'Push up to full extension'
    ]
  }
};

export const getExercise = (type: ExerciseType): Exercise => {
  return exercises[type];
};

export const getExerciseList = (): Exercise[] => {
  return Object.values(exercises);
};
