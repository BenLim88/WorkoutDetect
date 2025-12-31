import { ExerciseType, Keypoint, RepData, JointAngles, FormIssue } from '../types';
import { poseDetectionService, KEYPOINT_INDICES } from './poseDetection';
import { calculateAngle, getJointAngles, checkBodyAlignment, getMidpoint } from '../utils/angleCalculations';

// Exercise phase states
type ExercisePhase = 'up' | 'down' | 'neutral';

interface ExerciseState {
  phase: ExercisePhase;
  minAngle: number;
  maxAngle: number;
  repStartTime: number;
  formIssues: FormIssue[];
  angleHistory: number[];
  peakPosition: Keypoint[] | null;
  bottomPosition: Keypoint[] | null;
}

// Thresholds for each exercise
const EXERCISE_THRESHOLDS = {
  pushups: {
    upAngle: 160, // Arms extended
    downAngle: 90, // Arms bent
    minROM: 70, // Minimum range of motion percentage
    idealElbowAngle: 45, // Ideal elbow angle from body
  },
  pullups: {
    upAngle: 50, // Chin above bar (elbows bent)
    downAngle: 160, // Arms extended (hanging)
    minROM: 80,
    idealShoulderEngagement: 30,
  },
  situps: {
    upAngle: 70, // Sitting up (hip angle)
    downAngle: 150, // Lying down
    minROM: 60,
  },
  squats: {
    upAngle: 170, // Standing (knee angle)
    downAngle: 90, // Squatting
    minROM: 70,
    idealKneeAngle: 90,
  },
  deadlift: {
    upAngle: 170, // Standing (hip angle)
    downAngle: 90, // Bent over
    minROM: 75,
    idealSpineAngle: 10, // Near vertical spine at top
  },
  muscleup: {
    pullPhaseUp: 60,
    pullPhaseDown: 160,
    pushPhaseUp: 170,
    pushPhaseDown: 90,
    minROM: 85,
  },
  dips: {
    upAngle: 170, // Arms extended
    downAngle: 90, // Arms bent
    minROM: 70,
  },
};

class ExerciseDetectionService {
  private state: ExerciseState = {
    phase: 'neutral',
    minAngle: 180,
    maxAngle: 0,
    repStartTime: 0,
    formIssues: [],
    angleHistory: [],
    peakPosition: null,
    bottomPosition: null,
  };

  private currentExercise: ExerciseType = 'pushups';
  private repCount = 0;
  private lastKeypoints: Keypoint[] | null = null;

  setExercise(exercise: ExerciseType): void {
    this.currentExercise = exercise;
    this.reset();
  }

  reset(): void {
    this.state = {
      phase: 'neutral',
      minAngle: 180,
      maxAngle: 0,
      repStartTime: 0,
      formIssues: [],
      angleHistory: [],
      peakPosition: null,
      bottomPosition: null,
    };
    this.repCount = 0;
    this.lastKeypoints = null;
  }

  // Main detection method - returns RepData if a rep was completed
  detectRep(keypoints: Keypoint[]): RepData | null {
    const primaryAngle = this.getPrimaryAngle(keypoints);
    if (primaryAngle === null) return null;

    // Track angle history for ROM calculation
    this.state.angleHistory.push(primaryAngle);
    if (this.state.angleHistory.length > 100) {
      this.state.angleHistory.shift();
    }

    // Update min/max angles
    if (primaryAngle < this.state.minAngle) {
      this.state.minAngle = primaryAngle;
      this.state.bottomPosition = keypoints;
    }
    if (primaryAngle > this.state.maxAngle) {
      this.state.maxAngle = primaryAngle;
      this.state.peakPosition = keypoints;
    }

    const repData = this.checkRepCompletion(keypoints, primaryAngle);
    this.lastKeypoints = keypoints;

    return repData;
  }

  private getPrimaryAngle(keypoints: Keypoint[]): number | null {
    const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
      poseDetectionService.getKeypoint(keypoints, name);

    switch (this.currentExercise) {
      case 'pushups':
      case 'dips': {
        // Use elbow angle
        const shoulder = getKP('rightShoulder') || getKP('leftShoulder');
        const elbow = getKP('rightElbow') || getKP('leftElbow');
        const wrist = getKP('rightWrist') || getKP('leftWrist');
        if (!shoulder || !elbow || !wrist) return null;
        return calculateAngle(shoulder, elbow, wrist);
      }

      case 'pullups':
      case 'muscleup': {
        // Use elbow angle (inverted logic - bent = up)
        const shoulder = getKP('rightShoulder') || getKP('leftShoulder');
        const elbow = getKP('rightElbow') || getKP('leftElbow');
        const wrist = getKP('rightWrist') || getKP('leftWrist');
        if (!shoulder || !elbow || !wrist) return null;
        return calculateAngle(shoulder, elbow, wrist);
      }

      case 'situps': {
        // Use hip angle
        const shoulder = getKP('rightShoulder') || getKP('leftShoulder');
        const hip = getKP('rightHip') || getKP('leftHip');
        const knee = getKP('rightKnee') || getKP('leftKnee');
        if (!shoulder || !hip || !knee) return null;
        return calculateAngle(shoulder, hip, knee);
      }

      case 'squats': {
        // Use knee angle
        const hip = getKP('rightHip') || getKP('leftHip');
        const knee = getKP('rightKnee') || getKP('leftKnee');
        const ankle = getKP('rightAnkle') || getKP('leftAnkle');
        if (!hip || !knee || !ankle) return null;
        return calculateAngle(hip, knee, ankle);
      }

      case 'deadlift': {
        // Use hip angle
        const shoulder = getKP('rightShoulder') || getKP('leftShoulder');
        const hip = getKP('rightHip') || getKP('leftHip');
        const knee = getKP('rightKnee') || getKP('leftKnee');
        if (!shoulder || !hip || !knee) return null;
        return calculateAngle(shoulder, hip, knee);
      }

      default:
        return null;
    }
  }

  private checkRepCompletion(keypoints: Keypoint[], angle: number): RepData | null {
    const thresholds = EXERCISE_THRESHOLDS[this.currentExercise];
    if (!thresholds) return null;

    let repCompleted = false;

    // Different exercises have different rep completion logic
    switch (this.currentExercise) {
      case 'pushups':
      case 'dips':
      case 'squats':
      case 'situps':
      case 'deadlift': {
        const upThreshold = 'upAngle' in thresholds ? thresholds.upAngle : 170;
        const downThreshold = 'downAngle' in thresholds ? thresholds.downAngle : 90;

        if (this.state.phase === 'neutral' || this.state.phase === 'up') {
          if (angle < downThreshold) {
            if (this.state.phase === 'neutral') {
              this.state.repStartTime = Date.now();
            }
            this.state.phase = 'down';
          }
        } else if (this.state.phase === 'down') {
          if (angle > upThreshold) {
            this.state.phase = 'up';
            repCompleted = true;
          }
        }
        break;
      }

      case 'pullups':
      case 'muscleup': {
        // Inverted - we start extended and pull up
        const upThreshold = 'upAngle' in thresholds ? thresholds.upAngle : 60;
        const downThreshold = 'downAngle' in thresholds ? thresholds.downAngle : 160;

        if (this.state.phase === 'neutral' || this.state.phase === 'down') {
          if (angle < upThreshold) {
            if (this.state.phase === 'neutral') {
              this.state.repStartTime = Date.now();
            }
            this.state.phase = 'up';
          }
        } else if (this.state.phase === 'up') {
          if (angle > downThreshold) {
            this.state.phase = 'down';
            repCompleted = true;
          }
        }
        break;
      }
    }

    if (repCompleted) {
      const repData = this.createRepData(keypoints);
      this.repCount++;
      
      // Reset for next rep
      this.state.minAngle = 180;
      this.state.maxAngle = 0;
      this.state.formIssues = [];
      this.state.angleHistory = [];
      this.state.peakPosition = null;
      this.state.bottomPosition = null;
      
      return repData;
    }

    // Continuous form checking
    this.checkForm(keypoints);

    return null;
  }

  private createRepData(keypoints: Keypoint[]): RepData {
    const jointAngles = getJointAngles(keypoints);
    const rom = this.calculateROM();
    const formScore = this.calculateFormScore(keypoints, jointAngles, rom);
    const isValid = this.isRepValid(rom, formScore);

    return {
      repNumber: this.repCount + 1,
      timestamp: Date.now(),
      duration: Date.now() - this.state.repStartTime,
      isValid,
      formScore,
      jointAngles,
      rangeOfMotion: rom,
      issues: this.state.formIssues.map(issue => issue.message),
    };
  }

  private calculateROM(): number {
    const thresholds = EXERCISE_THRESHOLDS[this.currentExercise];
    if (!thresholds || !('upAngle' in thresholds) || !('downAngle' in thresholds)) {
      return 100;
    }

    const idealRange = Math.abs(thresholds.upAngle - thresholds.downAngle);
    const actualRange = Math.abs(this.state.maxAngle - this.state.minAngle);
    
    return Math.min(100, (actualRange / idealRange) * 100);
  }

  private calculateFormScore(keypoints: Keypoint[], angles: JointAngles, rom: number): number {
    let score = 100;

    // Deduct for ROM issues
    if (rom < 70) {
      score -= (70 - rom) * 0.5;
    }

    // Check exercise-specific form
    switch (this.currentExercise) {
      case 'pushups': {
        // Check body alignment
        const alignmentScore = checkBodyAlignment(keypoints);
        if (alignmentScore < 80) {
          score -= (80 - alignmentScore) * 0.3;
        }
        break;
      }

      case 'squats': {
        // Check knee tracking
        if (angles.leftKnee && angles.rightKnee) {
          const kneeSymmetry = Math.abs(angles.leftKnee - angles.rightKnee);
          if (kneeSymmetry > 15) {
            score -= kneeSymmetry * 0.2;
          }
        }
        break;
      }

      case 'deadlift': {
        // Check spine angle
        if (angles.spine && angles.spine > 20) {
          score -= (angles.spine - 20) * 0.5;
        }
        break;
      }
    }

    // Deduct for form issues
    score -= this.state.formIssues.filter(i => i.severity === 'major').length * 10;
    score -= this.state.formIssues.filter(i => i.severity === 'moderate').length * 5;
    score -= this.state.formIssues.filter(i => i.severity === 'minor').length * 2;

    return Math.max(0, Math.min(100, score));
  }

  private isRepValid(rom: number, formScore: number): boolean {
    const thresholds = EXERCISE_THRESHOLDS[this.currentExercise];
    const minROM = thresholds && 'minROM' in thresholds ? thresholds.minROM : 70;
    
    return rom >= minROM && formScore >= 50 && 
           this.state.formIssues.filter(i => i.severity === 'major').length === 0;
  }

  private checkForm(keypoints: Keypoint[]): void {
    const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
      poseDetectionService.getKeypoint(keypoints, name);

    switch (this.currentExercise) {
      case 'pushups': {
        // Check body alignment (shouldershipsankles in a straight line)
        const alignmentScore = checkBodyAlignment(keypoints);

        // Treat anything noticeably out of line as a form issue.
        // < 75 is considered a major issue (sagging hips or pike),
        // 7584 is a moderate issue.
        if (alignmentScore < 85) {
          this.addFormIssue({
            type: 'alignment',
            severity: alignmentScore < 75 ? 'major' : 'moderate',
            message: 'No rep. Keep your body in a straight line from shoulders through hips to ankles.',
            recommendation: 'Engage your core and glutes to maintain a rigid plank from shoulders to ankles.',
          });
        }

        // Check elbow angle from body
        const leftShoulder = getKP('leftShoulder');
        const rightShoulder = getKP('rightShoulder');
        const leftElbow = getKP('leftElbow');
        const rightElbow = getKP('rightElbow');
        
        if (leftShoulder && rightShoulder && leftElbow && rightElbow) {
          const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
          const elbowWidth = Math.abs(rightElbow.x - leftElbow.x);
          const elbowFlare = (elbowWidth / shoulderWidth) - 1;
          
          if (elbowFlare > 0.5) {
            this.addFormIssue({
              type: 'elbowFlare',
              severity: 'moderate',
              message: 'Elbows flaring out too much',
              recommendation: 'Keep elbows at 45-degree angle from body',
            });
          }
        }
        break;
      }

      case 'squats': {
        // Check knee cave
        const leftKnee = getKP('leftKnee');
        const rightKnee = getKP('rightKnee');
        const leftAnkle = getKP('leftAnkle');
        const rightAnkle = getKP('rightAnkle');

        if (leftKnee && rightKnee && leftAnkle && rightAnkle) {
          const ankleWidth = Math.abs(rightAnkle.x - leftAnkle.x);
          const kneeWidth = Math.abs(rightKnee.x - leftKnee.x);
          
          if (kneeWidth < ankleWidth * 0.8) {
            this.addFormIssue({
              type: 'kneeCave',
              severity: 'major',
              message: 'Knees caving inward',
              recommendation: 'Push knees out over toes',
            });
          }
        }

        // Check forward lean
        const shoulder = getKP('leftShoulder') || getKP('rightShoulder');
        const hip = getKP('leftHip') || getKP('rightHip');
        
        if (shoulder && hip) {
          const forwardLean = shoulder.x - hip.x;
          if (Math.abs(forwardLean) > 100) {
            this.addFormIssue({
              type: 'forwardLean',
              severity: 'moderate',
              message: 'Excessive forward lean',
              recommendation: 'Keep chest up and weight on mid-foot',
            });
          }
        }
        break;
      }

      case 'deadlift': {
        // Check for rounded back
        const nose = getKP('nose');
        const shoulder = getKP('leftShoulder') || getKP('rightShoulder');
        const hip = getKP('leftHip') || getKP('rightHip');

        if (nose && shoulder && hip) {
          const shoulderMid = shoulder;
          const spineAngle = Math.abs(
            Math.atan2(hip.y - shoulderMid.y, hip.x - shoulderMid.x) * (180 / Math.PI)
          );
          
          if (spineAngle < 60 || spineAngle > 120) {
            this.addFormIssue({
              type: 'roundedBack',
              severity: 'major',
              message: 'Keep spine neutral',
              recommendation: 'Maintain flat back throughout the lift',
            });
          }
        }
        break;
      }

      case 'pullups': {
        // Check for kipping
        const shoulder = getKP('leftShoulder') || getKP('rightShoulder');
        const hip = getKP('leftHip') || getKP('rightHip');
        
        if (shoulder && hip && this.lastKeypoints) {
          const prevHip = poseDetectionService.getKeypoint(this.lastKeypoints, 'leftHip') ||
                          poseDetectionService.getKeypoint(this.lastKeypoints, 'rightHip');
          
          if (prevHip) {
            const horizontalMovement = Math.abs(hip.x - prevHip.x);
            if (horizontalMovement > 20) {
              this.addFormIssue({
                type: 'kipping',
                severity: 'minor',
                message: 'Minimize body swing',
                recommendation: 'Use controlled movement, avoid kipping',
              });
            }
          }
        }
        break;
      }
    }
  }

  private addFormIssue(issue: FormIssue): void {
    // Avoid duplicate issues
    if (!this.state.formIssues.find(i => i.type === issue.type)) {
      this.state.formIssues.push(issue);
    }
  }

  // Get current state info for UI
  getCurrentState(): { phase: ExercisePhase; repCount: number; formIssues: FormIssue[] } {
    return {
      phase: this.state.phase,
      repCount: this.repCount,
      formIssues: [...this.state.formIssues],
    };
  }

  getRepCount(): number {
    return this.repCount;
  }
}

export const exerciseDetectionService = new ExerciseDetectionService();
