import { ExerciseType, Keypoint, RepData, JointAngles, FormIssue, CameraPerspective } from '../types';
import { poseDetectionService, KEYPOINT_INDICES } from './poseDetection';
import { calculateAngle, getJointAngles, checkBodyAlignment } from '../utils/angleCalculations';

// Exercise phase states
type ExercisePhase = 'calibrating' | 'ready' | 'down' | 'up';

interface ExerciseState {
  phase: ExercisePhase;
  calibrationFrames: number;
  baselineAngle: number | null;
  baselineY: number | null;
  minAngle: number;
  maxAngle: number;
  minY: number;
  maxY: number;
  repStartTime: number;
  lastPhaseChangeTime: number;
  formIssues: FormIssue[];
  angleHistory: number[];
  yHistory: number[];
  peakPosition: Keypoint[] | null;
  bottomPosition: Keypoint[] | null;
  stableFrames: number;
}

// Minimum requirements for rep detection
const MIN_REP_DURATION_MS = 400; // Minimum time for a rep (prevents counting noise)
const MIN_CALIBRATION_FRAMES = 15; // Frames needed to establish baseline
const MIN_STABLE_FRAMES = 5; // Frames of stability before starting
const MIN_ANGLE_CHANGE = 30; // Minimum angle change for a rep (side view)
const MIN_Y_CHANGE_RATIO = 0.15; // Minimum Y movement as ratio of body height

// Thresholds for each exercise
const EXERCISE_THRESHOLDS = {
  pushups: {
    side: {
      upAngle: 150, // Arms mostly extended
      downAngle: 100, // Arms bent
      minAngleChange: 40,
    },
    front: {
      downThreshold: 0.65, // How far down (normalized)
      upThreshold: 0.35, // How far up (normalized)
    },
    minROM: 50,
  },
  pullups: {
    side: {
      upAngle: 70,
      downAngle: 150,
      minAngleChange: 50,
    },
    front: {
      downThreshold: 0.7,
      upThreshold: 0.3,
    },
    minROM: 60,
  },
  situps: {
    side: {
      upAngle: 80,
      downAngle: 140,
      minAngleChange: 40,
    },
    front: {
      downThreshold: 0.6,
      upThreshold: 0.4,
    },
    minROM: 40,
  },
  squats: {
    side: {
      upAngle: 160,
      downAngle: 100,
      minAngleChange: 40,
    },
    front: {
      downThreshold: 0.6,
      upThreshold: 0.35,
    },
    minROM: 50,
  },
  deadlift: {
    side: {
      upAngle: 160,
      downAngle: 100,
      minAngleChange: 40,
    },
    front: {
      downThreshold: 0.6,
      upThreshold: 0.35,
    },
    minROM: 50,
  },
  muscleup: {
    side: {
      upAngle: 160,
      downAngle: 70,
      minAngleChange: 60,
    },
    front: {
      downThreshold: 0.7,
      upThreshold: 0.25,
    },
    minROM: 70,
  },
  dips: {
    side: {
      upAngle: 160,
      downAngle: 100,
      minAngleChange: 40,
    },
    front: {
      downThreshold: 0.6,
      upThreshold: 0.35,
    },
    minROM: 50,
  },
};

class ExerciseDetectionService {
  private state: ExerciseState = this.getInitialState();
  private currentExercise: ExerciseType = 'pushups';
  private repCount = 0;
  private lastKeypoints: Keypoint[] | null = null;
  private currentPerspective: CameraPerspective = 'unknown';
  private perspectiveHistory: CameraPerspective[] = [];
  private frameCount = 0;

  private getInitialState(): ExerciseState {
    return {
      phase: 'calibrating',
      calibrationFrames: 0,
      baselineAngle: null,
      baselineY: null,
      minAngle: 180,
      maxAngle: 0,
      minY: Infinity,
      maxY: 0,
      repStartTime: 0,
      lastPhaseChangeTime: 0,
      formIssues: [],
      angleHistory: [],
      yHistory: [],
      peakPosition: null,
      bottomPosition: null,
      stableFrames: 0,
    };
  }

  setExercise(exercise: ExerciseType): void {
    this.currentExercise = exercise;
    this.reset();
  }

  reset(): void {
    this.state = this.getInitialState();
    this.repCount = 0;
    this.lastKeypoints = null;
    this.currentPerspective = 'unknown';
    this.perspectiveHistory = [];
    this.frameCount = 0;
  }

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

    const minScore = 0.3;
    if ((leftShoulder.score || 0) < minScore || (rightShoulder.score || 0) < minScore) {
      return 'unknown';
    }

    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    const hipWidth = Math.abs(rightHip.x - leftHip.x);
    const avgWidth = (shoulderWidth + hipWidth) / 2;
    const verticalSpan = Math.abs(leftShoulder.y - leftHip.y);
    const widthToHeightRatio = avgWidth / verticalSpan;

    if (widthToHeightRatio > 0.35) {
      return 'front';
    } else if (widthToHeightRatio < 0.2) {
      return 'side';
    }

    const shoulderDepthDiff = Math.abs(leftShoulder.x - rightShoulder.x);
    if (shoulderDepthDiff < verticalSpan * 0.15) {
      return 'front';
    }

    return 'side';
  }

  private updatePerspective(keypoints: Keypoint[]): void {
    const detected = this.detectPerspective(keypoints);
    
    if (detected !== 'unknown') {
      this.perspectiveHistory.push(detected);
      if (this.perspectiveHistory.length > 15) {
        this.perspectiveHistory.shift();
      }

      const frontCount = this.perspectiveHistory.filter(p => p === 'front').length;
      const sideCount = this.perspectiveHistory.filter(p => p === 'side').length;

      if (frontCount > sideCount && frontCount >= 5) {
        this.currentPerspective = 'front';
      } else if (sideCount > frontCount && sideCount >= 5) {
        this.currentPerspective = 'side';
      }
    }
  }

  private getPrimaryValue(keypoints: Keypoint[]): { angle: number | null; yPosition: number | null; bodyHeight: number | null } {
    const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
      poseDetectionService.getKeypoint(keypoints, name);

    let angle: number | null = null;
    let yPosition: number | null = null;
    let bodyHeight: number | null = null;

    // Calculate body height for normalization
    const shoulder = getKP('rightShoulder') || getKP('leftShoulder');
    const hip = getKP('rightHip') || getKP('leftHip');
    if (shoulder && hip) {
      bodyHeight = Math.abs(hip.y - shoulder.y);
    }

    switch (this.currentExercise) {
      case 'pushups':
      case 'dips': {
        const shoulderPt = getKP('rightShoulder') || getKP('leftShoulder');
        const elbow = getKP('rightElbow') || getKP('leftElbow');
        const wrist = getKP('rightWrist') || getKP('leftWrist');
        
        if (shoulderPt && elbow && wrist) {
          angle = calculateAngle(shoulderPt, elbow, wrist);
        }
        if (shoulderPt) {
          yPosition = shoulderPt.y;
        }
        break;
      }

      case 'pullups':
      case 'muscleup': {
        const shoulderPt = getKP('rightShoulder') || getKP('leftShoulder');
        const elbow = getKP('rightElbow') || getKP('leftElbow');
        const wrist = getKP('rightWrist') || getKP('leftWrist');
        
        if (shoulderPt && elbow && wrist) {
          angle = calculateAngle(shoulderPt, elbow, wrist);
        }
        if (shoulderPt) {
          yPosition = shoulderPt.y;
        }
        break;
      }

      case 'situps': {
        const shoulderPt = getKP('rightShoulder') || getKP('leftShoulder');
        const hipPt = getKP('rightHip') || getKP('leftHip');
        const knee = getKP('rightKnee') || getKP('leftKnee');
        
        if (shoulderPt && hipPt && knee) {
          angle = calculateAngle(shoulderPt, hipPt, knee);
        }
        if (shoulderPt) {
          yPosition = shoulderPt.y;
        }
        break;
      }

      case 'squats': {
        const hipPt = getKP('rightHip') || getKP('leftHip');
        const knee = getKP('rightKnee') || getKP('leftKnee');
        const ankle = getKP('rightAnkle') || getKP('leftAnkle');
        
        if (hipPt && knee && ankle) {
          angle = calculateAngle(hipPt, knee, ankle);
        }
        if (hipPt) {
          yPosition = hipPt.y;
        }
        break;
      }

      case 'deadlift': {
        const shoulderPt = getKP('rightShoulder') || getKP('leftShoulder');
        const hipPt = getKP('rightHip') || getKP('leftHip');
        const knee = getKP('rightKnee') || getKP('leftKnee');
        
        if (shoulderPt && hipPt && knee) {
          angle = calculateAngle(shoulderPt, hipPt, knee);
        }
        if (shoulderPt) {
          yPosition = shoulderPt.y;
        }
        break;
      }
    }

    return { angle, yPosition, bodyHeight };
  }

  private isStablePosition(history: number[], threshold: number): boolean {
    if (history.length < MIN_STABLE_FRAMES) return false;
    
    const recent = history.slice(-MIN_STABLE_FRAMES);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const maxDeviation = Math.max(...recent.map(v => Math.abs(v - avg)));
    
    return maxDeviation < threshold;
  }

  detectRep(keypoints: Keypoint[]): RepData | null {
    this.frameCount++;
    this.updatePerspective(keypoints);

    const { angle, yPosition, bodyHeight } = this.getPrimaryValue(keypoints);

    // Track history
    if (angle !== null) {
      this.state.angleHistory.push(angle);
      if (this.state.angleHistory.length > 60) {
        this.state.angleHistory.shift();
      }
    }

    if (yPosition !== null) {
      this.state.yHistory.push(yPosition);
      if (this.state.yHistory.length > 60) {
        this.state.yHistory.shift();
      }
    }

    // Calibration phase - wait for user to get into position
    if (this.state.phase === 'calibrating') {
      this.state.calibrationFrames++;
      
      // Check if we have enough stable data
      const isAngleStable = this.state.angleHistory.length >= MIN_CALIBRATION_FRAMES &&
        this.isStablePosition(this.state.angleHistory, 10);
      const isYStable = this.state.yHistory.length >= MIN_CALIBRATION_FRAMES &&
        this.isStablePosition(this.state.yHistory, 15);

      if ((this.currentPerspective === 'side' && isAngleStable) ||
          (this.currentPerspective === 'front' && isYStable) ||
          (this.currentPerspective === 'unknown' && (isAngleStable || isYStable))) {
        
        // Set baseline values
        if (angle !== null) {
          const recent = this.state.angleHistory.slice(-MIN_STABLE_FRAMES);
          this.state.baselineAngle = recent.reduce((a, b) => a + b, 0) / recent.length;
        }
        if (yPosition !== null) {
          const recent = this.state.yHistory.slice(-MIN_STABLE_FRAMES);
          this.state.baselineY = recent.reduce((a, b) => a + b, 0) / recent.length;
        }
        
        this.state.phase = 'ready';
        this.state.lastPhaseChangeTime = Date.now();
        console.log('Calibration complete. Ready to count reps.');
      }
      
      this.lastKeypoints = keypoints;
      return null;
    }

    // Track min/max for ROM calculation
    if (angle !== null) {
      this.state.minAngle = Math.min(this.state.minAngle, angle);
      this.state.maxAngle = Math.max(this.state.maxAngle, angle);
    }
    if (yPosition !== null) {
      this.state.minY = Math.min(this.state.minY, yPosition);
      this.state.maxY = Math.max(this.state.maxY, yPosition);
    }

    const repData = this.checkRepCompletion(keypoints, angle, yPosition, bodyHeight);
    this.lastKeypoints = keypoints;

    return repData;
  }

  private checkRepCompletion(
    keypoints: Keypoint[], 
    angle: number | null, 
    yPosition: number | null,
    bodyHeight: number | null
  ): RepData | null {
    const thresholds = EXERCISE_THRESHOLDS[this.currentExercise];
    if (!thresholds) return null;

    const now = Date.now();
    const timeSinceLastChange = now - this.state.lastPhaseChangeTime;

    // Prevent rapid phase changes (debouncing)
    if (timeSinceLastChange < 150) return null;

    let repCompleted = false;

    if (this.currentPerspective === 'side' && angle !== null) {
      repCompleted = this.checkRepByAngle(angle, thresholds.side, now);
    } else if (this.currentPerspective === 'front' && yPosition !== null && bodyHeight !== null) {
      repCompleted = this.checkRepByPosition(yPosition, bodyHeight, thresholds.front, now);
    } else if (angle !== null) {
      repCompleted = this.checkRepByAngle(angle, thresholds.side, now);
    }

    if (repCompleted) {
      const repDuration = now - this.state.repStartTime;
      
      // Validate rep duration
      if (repDuration < MIN_REP_DURATION_MS) {
        console.log(`Rep too fast (${repDuration}ms), ignoring`);
        return null;
      }

      const repData = this.createRepData(keypoints, repDuration);
      this.repCount++;
      
      // Reset for next rep but keep calibration
      this.state.minAngle = 180;
      this.state.maxAngle = 0;
      this.state.minY = Infinity;
      this.state.maxY = 0;
      this.state.formIssues = [];
      this.state.peakPosition = null;
      this.state.bottomPosition = null;
      
      return repData;
    }

    this.checkForm(keypoints);
    return null;
  }

  private checkRepByAngle(
    angle: number, 
    thresholds: { upAngle: number; downAngle: number; minAngleChange: number },
    now: number
  ): boolean {
    const isInverted = this.currentExercise === 'pullups' || this.currentExercise === 'muscleup';
    
    // Check for sufficient angle change from baseline
    if (this.state.baselineAngle !== null) {
      const changeFromBaseline = Math.abs(angle - this.state.baselineAngle);
      if (changeFromBaseline < thresholds.minAngleChange * 0.5 && this.state.phase === 'ready') {
        return false; // Not enough movement yet
      }
    }

    if (isInverted) {
      // Pull-ups: arms start extended (high angle), pull up (low angle), return
      switch (this.state.phase) {
        case 'ready':
          if (angle < thresholds.upAngle) {
            this.state.phase = 'up';
            this.state.repStartTime = now;
            this.state.lastPhaseChangeTime = now;
          }
          break;
        case 'up':
          if (angle > thresholds.downAngle) {
            this.state.phase = 'ready';
            this.state.lastPhaseChangeTime = now;
            return true;
          }
          break;
      }
    } else {
      // Push-ups, etc: arms start extended (high angle), go down (low angle), return
      switch (this.state.phase) {
        case 'ready':
          if (angle < thresholds.downAngle) {
            this.state.phase = 'down';
            this.state.repStartTime = now;
            this.state.lastPhaseChangeTime = now;
            this.state.bottomPosition = this.lastKeypoints;
          }
          break;
        case 'down':
          if (angle > thresholds.upAngle) {
            this.state.phase = 'ready';
            this.state.lastPhaseChangeTime = now;
            this.state.peakPosition = this.lastKeypoints;
            return true;
          }
          break;
      }
    }

    return false;
  }

  private checkRepByPosition(
    yPosition: number,
    bodyHeight: number,
    thresholds: { downThreshold: number; upThreshold: number },
    now: number
  ): boolean {
    if (this.state.baselineY === null) return false;

    // Need enough Y history to establish range
    if (this.state.yHistory.length < 10) return false;

    const yRange = this.state.maxY - this.state.minY;
    
    // Require minimum movement (as ratio of body height)
    if (yRange < bodyHeight * MIN_Y_CHANGE_RATIO) return false;

    // Normalize current position within the observed range
    const normalizedY = (yPosition - this.state.minY) / yRange;

    const isInverted = this.currentExercise === 'pullups' || this.currentExercise === 'muscleup';

    if (isInverted) {
      // Pull-ups: start low (high Y), go up (low Y), return
      switch (this.state.phase) {
        case 'ready':
          if (normalizedY < thresholds.upThreshold) {
            this.state.phase = 'up';
            this.state.repStartTime = now;
            this.state.lastPhaseChangeTime = now;
          }
          break;
        case 'up':
          if (normalizedY > thresholds.downThreshold) {
            this.state.phase = 'ready';
            this.state.lastPhaseChangeTime = now;
            return true;
          }
          break;
      }
    } else {
      // Push-ups: start high (low Y), go down (high Y), return
      switch (this.state.phase) {
        case 'ready':
          if (normalizedY > thresholds.downThreshold) {
            this.state.phase = 'down';
            this.state.repStartTime = now;
            this.state.lastPhaseChangeTime = now;
          }
          break;
        case 'down':
          if (normalizedY < thresholds.upThreshold) {
            this.state.phase = 'ready';
            this.state.lastPhaseChangeTime = now;
            return true;
          }
          break;
      }
    }

    return false;
  }

  private createRepData(keypoints: Keypoint[], duration: number): RepData {
    const jointAngles = getJointAngles(keypoints);
    const rom = this.calculateROM();
    const formScore = this.calculateFormScore(keypoints, jointAngles, rom);
    const isValid = this.isRepValid(rom, formScore, duration);

    return {
      repNumber: this.repCount + 1,
      timestamp: Date.now(),
      duration,
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
      return Math.min(100, Math.max(0, (actualRange / idealRange) * 100));
    } else if (this.currentPerspective === 'front') {
      const range = this.state.maxY - this.state.minY;
      const expectedRange = 80;
      return Math.min(100, Math.max(0, (range / expectedRange) * 100));
    }

    return 70; // Default
  }

  private calculateFormScore(keypoints: Keypoint[], angles: JointAngles, rom: number): number {
    let score = 100;

    const thresholds = EXERCISE_THRESHOLDS[this.currentExercise];
    const minROM = thresholds?.minROM || 50;
    
    if (rom < minROM) {
      score -= (minROM - rom) * 0.4;
    }

    if (this.currentPerspective === 'side') {
      switch (this.currentExercise) {
        case 'pushups': {
          const alignmentScore = checkBodyAlignment(keypoints);
          if (alignmentScore < 70) {
            score -= (70 - alignmentScore) * 0.3;
          }
          break;
        }
        case 'squats': {
          if (angles.leftKnee && angles.rightKnee) {
            const kneeSymmetry = Math.abs(angles.leftKnee - angles.rightKnee);
            if (kneeSymmetry > 20) {
              score -= kneeSymmetry * 0.2;
            }
          }
          break;
        }
      }
    }

    score -= this.state.formIssues.filter(i => i.severity === 'major').length * 10;
    score -= this.state.formIssues.filter(i => i.severity === 'moderate').length * 5;
    score -= this.state.formIssues.filter(i => i.severity === 'minor').length * 2;

    return Math.max(0, Math.min(100, score));
  }

  private isRepValid(rom: number, formScore: number, duration: number): boolean {
    const thresholds = EXERCISE_THRESHOLDS[this.currentExercise];
    const minROM = thresholds?.minROM || 50;
    
    const romValid = rom >= minROM * 0.6;
    const formValid = formScore >= 50;
    const durationValid = duration >= MIN_REP_DURATION_MS;
    const noMajorIssues = this.state.formIssues.filter(i => i.severity === 'major').length === 0;
    
    return romValid && formValid && durationValid && noMajorIssues;
  }

  private checkForm(keypoints: Keypoint[]): void {
    if (this.currentPerspective !== 'side') return;

    const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
      poseDetectionService.getKeypoint(keypoints, name);

    switch (this.currentExercise) {
      case 'pushups': {
        const alignmentScore = checkBodyAlignment(keypoints);
        if (alignmentScore < 50) {
          this.addFormIssue({
            type: 'alignment',
            severity: alignmentScore < 30 ? 'major' : 'moderate',
            message: 'Keep your body in a straight line',
            recommendation: 'Engage your core and glutes',
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
          
          if (kneeWidth < ankleWidth * 0.6) {
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
    }
  }

  private addFormIssue(issue: FormIssue): void {
    if (!this.state.formIssues.find(i => i.type === issue.type)) {
      this.state.formIssues.push(issue);
    }
  }

  getCurrentState(): { 
    phase: ExercisePhase; 
    repCount: number; 
    formIssues: FormIssue[];
    perspective: CameraPerspective;
    isCalibrated: boolean;
  } {
    return {
      phase: this.state.phase,
      repCount: this.repCount,
      formIssues: [...this.state.formIssues],
      perspective: this.currentPerspective,
      isCalibrated: this.state.phase !== 'calibrating',
    };
  }

  getRepCount(): number {
    return this.repCount;
  }

  getPerspective(): CameraPerspective {
    return this.currentPerspective;
  }

  isCalibrated(): boolean {
    return this.state.phase !== 'calibrating';
  }
}

export const exerciseDetectionService = new ExerciseDetectionService();
