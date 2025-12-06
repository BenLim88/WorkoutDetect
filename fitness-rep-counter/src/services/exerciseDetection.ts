import { ExerciseType, Keypoint, RepData, JointAngles, FormIssue, CameraPerspective } from '../types';
import { poseDetectionService, KEYPOINT_INDICES } from './poseDetection';
import { calculateAngle, getJointAngles, checkBodyAlignment } from '../utils/angleCalculations';

// Exercise phase states
type ExercisePhase = 'up' | 'down' | 'neutral';

interface ExerciseState {
  phase: ExercisePhase;
  minAngle: number;
  maxAngle: number;
  minY: number;
  maxY: number;
  repStartTime: number;
  formIssues: FormIssue[];
  angleHistory: number[];
  yHistory: number[];
  peakPosition: Keypoint[] | null;
  bottomPosition: Keypoint[] | null;
}

// Thresholds for each exercise - now includes both perspectives
const EXERCISE_THRESHOLDS = {
  pushups: {
    side: {
      upAngle: 160, // Arms extended
      downAngle: 90, // Arms bent
      minROM: 70,
    },
    front: {
      // For front view, we use vertical movement of shoulders/chest
      upYRatio: 0.3, // Higher position (smaller Y)
      downYRatio: 0.6, // Lower position (larger Y)
      minROM: 60,
    },
    minROM: 60,
  },
  pullups: {
    side: {
      upAngle: 50, // Elbows bent (chin above bar)
      downAngle: 160, // Arms extended
      minROM: 80,
    },
    front: {
      upYRatio: 0.2, // Higher position
      downYRatio: 0.5, // Lower position
      minROM: 70,
    },
    minROM: 70,
  },
  situps: {
    side: {
      upAngle: 70,
      downAngle: 150,
      minROM: 60,
    },
    front: {
      upYRatio: 0.3,
      downYRatio: 0.6,
      minROM: 50,
    },
    minROM: 50,
  },
  squats: {
    side: {
      upAngle: 170,
      downAngle: 90,
      minROM: 70,
    },
    front: {
      // Use hip Y position relative to knee
      upYRatio: 0.3,
      downYRatio: 0.5,
      minROM: 60,
    },
    minROM: 60,
  },
  deadlift: {
    side: {
      upAngle: 170,
      downAngle: 90,
      minROM: 75,
    },
    front: {
      upYRatio: 0.3,
      downYRatio: 0.6,
      minROM: 65,
    },
    minROM: 65,
  },
  muscleup: {
    side: {
      upAngle: 170,
      downAngle: 60,
      minROM: 85,
    },
    front: {
      upYRatio: 0.15,
      downYRatio: 0.5,
      minROM: 75,
    },
    minROM: 75,
  },
  dips: {
    side: {
      upAngle: 170,
      downAngle: 90,
      minROM: 70,
    },
    front: {
      upYRatio: 0.3,
      downYRatio: 0.5,
      minROM: 60,
    },
    minROM: 60,
  },
};

class ExerciseDetectionService {
  private state: ExerciseState = {
    phase: 'neutral',
    minAngle: 180,
    maxAngle: 0,
    minY: Infinity,
    maxY: 0,
    repStartTime: 0,
    formIssues: [],
    angleHistory: [],
    yHistory: [],
    peakPosition: null,
    bottomPosition: null,
  };

  private currentExercise: ExerciseType = 'pushups';
  private repCount = 0;
  private lastKeypoints: Keypoint[] | null = null;
  private currentPerspective: CameraPerspective = 'unknown';
  private perspectiveHistory: CameraPerspective[] = [];

  setExercise(exercise: ExerciseType): void {
    this.currentExercise = exercise;
    this.reset();
  }

  reset(): void {
    this.state = {
      phase: 'neutral',
      minAngle: 180,
      maxAngle: 0,
      minY: Infinity,
      maxY: 0,
      repStartTime: 0,
      formIssues: [],
      angleHistory: [],
      yHistory: [],
      peakPosition: null,
      bottomPosition: null,
    };
    this.repCount = 0;
    this.lastKeypoints = null;
    this.currentPerspective = 'unknown';
    this.perspectiveHistory = [];
  }

  // Detect camera perspective based on keypoint positions
  private detectPerspective(keypoints: Keypoint[]): CameraPerspective {
    const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
      poseDetectionService.getKeypoint(keypoints, name);

    const leftShoulder = getKP('leftShoulder');
    const rightShoulder = getKP('rightShoulder');
    const leftHip = getKP('leftHip');
    const rightHip = getKP('rightHip');

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return 'unknown';
    }

    // Check confidence scores
    const minScore = 0.3;
    if ((leftShoulder.score || 0) < minScore || (rightShoulder.score || 0) < minScore) {
      return 'unknown';
    }

    // Calculate shoulder width vs expected body depth
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    const hipWidth = Math.abs(rightHip.x - leftHip.x);
    const avgWidth = (shoulderWidth + hipWidth) / 2;

    // Calculate vertical span for reference
    const verticalSpan = Math.abs(leftShoulder.y - leftHip.y);

    // If shoulders and hips are wide apart horizontally, it's front view
    // If they're close together, it's side view
    const widthToHeightRatio = avgWidth / verticalSpan;

    // Threshold: front view typically has ratio > 0.4, side view < 0.25
    if (widthToHeightRatio > 0.35) {
      return 'front';
    } else if (widthToHeightRatio < 0.2) {
      return 'side';
    }

    // In between - check if one shoulder is significantly behind the other
    const shoulderDepthDiff = Math.abs(leftShoulder.x - rightShoulder.x);
    if (shoulderDepthDiff < verticalSpan * 0.15) {
      return 'front';
    }

    return 'side';
  }

  // Smooth perspective detection to avoid flickering
  private updatePerspective(keypoints: Keypoint[]): void {
    const detected = this.detectPerspective(keypoints);
    
    if (detected !== 'unknown') {
      this.perspectiveHistory.push(detected);
      if (this.perspectiveHistory.length > 10) {
        this.perspectiveHistory.shift();
      }

      // Use majority vote from recent detections
      const frontCount = this.perspectiveHistory.filter(p => p === 'front').length;
      const sideCount = this.perspectiveHistory.filter(p => p === 'side').length;

      if (frontCount > sideCount && frontCount >= 3) {
        this.currentPerspective = 'front';
      } else if (sideCount > frontCount && sideCount >= 3) {
        this.currentPerspective = 'side';
      }
    }
  }

  // Get the primary tracking value based on perspective
  private getPrimaryValue(keypoints: Keypoint[]): { angle: number | null; yPosition: number | null } {
    const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
      poseDetectionService.getKeypoint(keypoints, name);

    let angle: number | null = null;
    let yPosition: number | null = null;

    switch (this.currentExercise) {
      case 'pushups':
      case 'dips': {
        // Side view: use elbow angle
        const shoulder = getKP('rightShoulder') || getKP('leftShoulder');
        const elbow = getKP('rightElbow') || getKP('leftElbow');
        const wrist = getKP('rightWrist') || getKP('leftWrist');
        
        if (shoulder && elbow && wrist) {
          angle = calculateAngle(shoulder, elbow, wrist);
        }

        // Front view: use shoulder/chest Y position
        if (shoulder) {
          yPosition = shoulder.y;
        }
        break;
      }

      case 'pullups':
      case 'muscleup': {
        const shoulder = getKP('rightShoulder') || getKP('leftShoulder');
        const elbow = getKP('rightElbow') || getKP('leftElbow');
        const wrist = getKP('rightWrist') || getKP('leftWrist');
        
        if (shoulder && elbow && wrist) {
          angle = calculateAngle(shoulder, elbow, wrist);
        }

        if (shoulder) {
          yPosition = shoulder.y;
        }
        break;
      }

      case 'situps': {
        const shoulder = getKP('rightShoulder') || getKP('leftShoulder');
        const hip = getKP('rightHip') || getKP('leftHip');
        const knee = getKP('rightKnee') || getKP('leftKnee');
        
        if (shoulder && hip && knee) {
          angle = calculateAngle(shoulder, hip, knee);
        }

        if (shoulder) {
          yPosition = shoulder.y;
        }
        break;
      }

      case 'squats': {
        const hip = getKP('rightHip') || getKP('leftHip');
        const knee = getKP('rightKnee') || getKP('leftKnee');
        const ankle = getKP('rightAnkle') || getKP('leftAnkle');
        
        if (hip && knee && ankle) {
          angle = calculateAngle(hip, knee, ankle);
        }

        if (hip) {
          yPosition = hip.y;
        }
        break;
      }

      case 'deadlift': {
        const shoulder = getKP('rightShoulder') || getKP('leftShoulder');
        const hip = getKP('rightHip') || getKP('leftHip');
        const knee = getKP('rightKnee') || getKP('leftKnee');
        
        if (shoulder && hip && knee) {
          angle = calculateAngle(shoulder, hip, knee);
        }

        if (shoulder) {
          yPosition = shoulder.y;
        }
        break;
      }
    }

    return { angle, yPosition };
  }

  // Main detection method - returns RepData if a rep was completed
  detectRep(keypoints: Keypoint[]): RepData | null {
    // Update perspective detection
    this.updatePerspective(keypoints);

    const { angle, yPosition } = this.getPrimaryValue(keypoints);

    // Track both angle and Y position for flexibility
    if (angle !== null) {
      this.state.angleHistory.push(angle);
      if (this.state.angleHistory.length > 100) {
        this.state.angleHistory.shift();
      }

      if (angle < this.state.minAngle) {
        this.state.minAngle = angle;
        if (this.currentPerspective === 'side') {
          this.state.bottomPosition = keypoints;
        }
      }
      if (angle > this.state.maxAngle) {
        this.state.maxAngle = angle;
        if (this.currentPerspective === 'side') {
          this.state.peakPosition = keypoints;
        }
      }
    }

    if (yPosition !== null) {
      this.state.yHistory.push(yPosition);
      if (this.state.yHistory.length > 100) {
        this.state.yHistory.shift();
      }

      if (yPosition < this.state.minY) {
        this.state.minY = yPosition;
        if (this.currentPerspective === 'front') {
          this.state.peakPosition = keypoints;
        }
      }
      if (yPosition > this.state.maxY) {
        this.state.maxY = yPosition;
        if (this.currentPerspective === 'front') {
          this.state.bottomPosition = keypoints;
        }
      }
    }

    const repData = this.checkRepCompletion(keypoints, angle, yPosition);
    this.lastKeypoints = keypoints;

    return repData;
  }

  private checkRepCompletion(
    keypoints: Keypoint[], 
    angle: number | null, 
    yPosition: number | null
  ): RepData | null {
    const thresholds = EXERCISE_THRESHOLDS[this.currentExercise];
    if (!thresholds) return null;

    let repCompleted = false;

    // Choose detection method based on perspective
    if (this.currentPerspective === 'side' && angle !== null) {
      repCompleted = this.checkRepCompletionByAngle(angle, thresholds.side);
    } else if (this.currentPerspective === 'front' && yPosition !== null) {
      repCompleted = this.checkRepCompletionByPosition(yPosition, keypoints);
    } else if (angle !== null) {
      // Fallback to angle if perspective is unknown
      repCompleted = this.checkRepCompletionByAngle(angle, thresholds.side);
    } else if (yPosition !== null) {
      // Fallback to position if no angle available
      repCompleted = this.checkRepCompletionByPosition(yPosition, keypoints);
    }

    if (repCompleted) {
      const repData = this.createRepData(keypoints);
      this.repCount++;
      
      // Reset for next rep
      this.state.minAngle = 180;
      this.state.maxAngle = 0;
      this.state.minY = Infinity;
      this.state.maxY = 0;
      this.state.formIssues = [];
      this.state.angleHistory = [];
      this.state.yHistory = [];
      this.state.peakPosition = null;
      this.state.bottomPosition = null;
      
      return repData;
    }

    // Continuous form checking
    this.checkForm(keypoints);

    return null;
  }

  private checkRepCompletionByAngle(angle: number, thresholds: { upAngle: number; downAngle: number }): boolean {
    const isInvertedExercise = this.currentExercise === 'pullups' || this.currentExercise === 'muscleup';

    if (isInvertedExercise) {
      // Pull-ups: start extended, pull up (angle decreases), then back down
      if (this.state.phase === 'neutral' || this.state.phase === 'down') {
        if (angle < thresholds.upAngle) {
          if (this.state.phase === 'neutral') {
            this.state.repStartTime = Date.now();
          }
          this.state.phase = 'up';
        }
      } else if (this.state.phase === 'up') {
        if (angle > thresholds.downAngle) {
          this.state.phase = 'down';
          return true;
        }
      }
    } else {
      // Standard exercises: start up, go down (angle decreases), come back up
      if (this.state.phase === 'neutral' || this.state.phase === 'up') {
        if (angle < thresholds.downAngle) {
          if (this.state.phase === 'neutral') {
            this.state.repStartTime = Date.now();
          }
          this.state.phase = 'down';
        }
      } else if (this.state.phase === 'down') {
        if (angle > thresholds.upAngle) {
          this.state.phase = 'up';
          return true;
        }
      }
    }

    return false;
  }

  private checkRepCompletionByPosition(yPosition: number, keypoints: Keypoint[]): boolean {
    // For front view, we track vertical movement
    // Lower Y = higher position (up), Higher Y = lower position (down)
    
    // Need some baseline movement before detecting reps
    if (this.state.yHistory.length < 5) return false;

    const range = this.state.maxY - this.state.minY;
    if (range < 30) return false; // Not enough movement

    const normalizedY = (yPosition - this.state.minY) / range;
    
    const isInvertedExercise = this.currentExercise === 'pullups' || this.currentExercise === 'muscleup';

    if (isInvertedExercise) {
      // Pull-ups: start low, pull up (Y decreases), then back down
      if (this.state.phase === 'neutral' || this.state.phase === 'down') {
        if (normalizedY < 0.3) { // Reached top
          if (this.state.phase === 'neutral') {
            this.state.repStartTime = Date.now();
          }
          this.state.phase = 'up';
        }
      } else if (this.state.phase === 'up') {
        if (normalizedY > 0.7) { // Back to bottom
          this.state.phase = 'down';
          return true;
        }
      }
    } else {
      // Push-ups, squats, etc: start high, go low (Y increases), come back up
      if (this.state.phase === 'neutral' || this.state.phase === 'up') {
        if (normalizedY > 0.7) { // Reached bottom
          if (this.state.phase === 'neutral') {
            this.state.repStartTime = Date.now();
          }
          this.state.phase = 'down';
        }
      } else if (this.state.phase === 'down') {
        if (normalizedY < 0.3) { // Back to top
          this.state.phase = 'up';
          return true;
        }
      }
    }

    return false;
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
    if (!thresholds) return 100;

    if (this.currentPerspective === 'side' && thresholds.side) {
      const idealRange = Math.abs(thresholds.side.upAngle - thresholds.side.downAngle);
      const actualRange = Math.abs(this.state.maxAngle - this.state.minAngle);
      return Math.min(100, (actualRange / idealRange) * 100);
    } else if (this.currentPerspective === 'front') {
      // For front view, use Y movement range
      const range = this.state.maxY - this.state.minY;
      // Normalize based on expected movement (rough estimate)
      const expectedRange = 100; // pixels
      return Math.min(100, (range / expectedRange) * 100);
    }

    // Fallback
    const idealRange = 70;
    const actualRange = Math.abs(this.state.maxAngle - this.state.minAngle);
    return Math.min(100, (actualRange / idealRange) * 100);
  }

  private calculateFormScore(keypoints: Keypoint[], angles: JointAngles, rom: number): number {
    let score = 100;

    // Deduct for ROM issues (be more lenient)
    const thresholds = EXERCISE_THRESHOLDS[this.currentExercise];
    const minROM = thresholds?.minROM || 60;
    
    if (rom < minROM) {
      score -= (minROM - rom) * 0.3;
    }

    // Perspective-aware form checking
    if (this.currentPerspective === 'side') {
      // More detailed form checking available for side view
      switch (this.currentExercise) {
        case 'pushups': {
          const alignmentScore = checkBodyAlignment(keypoints);
          if (alignmentScore < 80) {
            score -= (80 - alignmentScore) * 0.2;
          }
          break;
        }
        case 'squats': {
          if (angles.leftKnee && angles.rightKnee) {
            const kneeSymmetry = Math.abs(angles.leftKnee - angles.rightKnee);
            if (kneeSymmetry > 15) {
              score -= kneeSymmetry * 0.15;
            }
          }
          break;
        }
      }
    }

    // Deduct for form issues (reduced penalty)
    score -= this.state.formIssues.filter(i => i.severity === 'major').length * 8;
    score -= this.state.formIssues.filter(i => i.severity === 'moderate').length * 4;
    score -= this.state.formIssues.filter(i => i.severity === 'minor').length * 1;

    return Math.max(0, Math.min(100, score));
  }

  private isRepValid(rom: number, formScore: number): boolean {
    const thresholds = EXERCISE_THRESHOLDS[this.currentExercise];
    const minROM = thresholds?.minROM || 60;
    
    // More lenient validation
    const romValid = rom >= minROM * 0.7; // Allow 70% of minimum ROM
    const formValid = formScore >= 40;
    const noMajorIssues = this.state.formIssues.filter(i => i.severity === 'major').length === 0;
    
    return romValid && formValid && noMajorIssues;
  }

  private checkForm(keypoints: Keypoint[]): void {
    // Only do detailed form checks for side view where we have better angle data
    if (this.currentPerspective !== 'side') {
      return;
    }

    const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
      poseDetectionService.getKeypoint(keypoints, name);

    switch (this.currentExercise) {
      case 'pushups': {
        const alignmentScore = checkBodyAlignment(keypoints);
        if (alignmentScore < 60) {
          this.addFormIssue({
            type: 'alignment',
            severity: alignmentScore < 40 ? 'major' : 'moderate',
            message: 'Keep your body in a straight line',
            recommendation: 'Engage your core and glutes to maintain a plank position',
          });
        }
        break;
      }

      case 'squats': {
        const leftKnee = getKP('leftKnee');
        const rightKnee = getKP('rightKnee');
        const leftAnkle = getKP('leftAnkle');
        const rightAnkle = getKP('rightAnkle');

        if (leftKnee && rightKnee && leftAnkle && rightAnkle) {
          const ankleWidth = Math.abs(rightAnkle.x - leftAnkle.x);
          const kneeWidth = Math.abs(rightKnee.x - leftKnee.x);
          
          if (kneeWidth < ankleWidth * 0.7) {
            this.addFormIssue({
              type: 'kneeCave',
              severity: 'major',
              message: 'Knees caving inward',
              recommendation: 'Push knees out over toes',
            });
          }
        }
        break;
      }

      case 'pullups': {
        const shoulder = getKP('leftShoulder') || getKP('rightShoulder');
        const hip = getKP('leftHip') || getKP('rightHip');
        
        if (shoulder && hip && this.lastKeypoints) {
          const prevHip = poseDetectionService.getKeypoint(this.lastKeypoints, 'leftHip') ||
                          poseDetectionService.getKeypoint(this.lastKeypoints, 'rightHip');
          
          if (prevHip) {
            const horizontalMovement = Math.abs(hip.x - prevHip.x);
            if (horizontalMovement > 30) {
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
    if (!this.state.formIssues.find(i => i.type === issue.type)) {
      this.state.formIssues.push(issue);
    }
  }

  // Get current state info for UI
  getCurrentState(): { 
    phase: ExercisePhase; 
    repCount: number; 
    formIssues: FormIssue[];
    perspective: CameraPerspective;
  } {
    return {
      phase: this.state.phase,
      repCount: this.repCount,
      formIssues: [...this.state.formIssues],
      perspective: this.currentPerspective,
    };
  }

  getRepCount(): number {
    return this.repCount;
  }

  getPerspective(): CameraPerspective {
    return this.currentPerspective;
  }
}

export const exerciseDetectionService = new ExerciseDetectionService();
