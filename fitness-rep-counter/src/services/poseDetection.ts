import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
import { Keypoint, PoseResult } from '../types';

// MoveNet Keypoint indices
export const KEYPOINT_INDICES = {
  nose: 0,
  leftEye: 1,
  rightEye: 2,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16
};

class PoseDetectionService {
  private detector: poseDetection.PoseDetector | null = null;
  private isInitialized = false;
  private isInitializing = false;

  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) return;

    this.isInitializing = true;

    try {
      // Set up TensorFlow.js backend
      await tf.setBackend('webgl');
      await tf.ready();

      // Create MoveNet detector (Thunder for better accuracy)
      const model = poseDetection.SupportedModels.MoveNet;
      const detectorConfig: poseDetection.MoveNetModelConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
        enableSmoothing: true,
        minPoseScore: 0.25
      };

      this.detector = await poseDetection.createDetector(model, detectorConfig);
      this.isInitialized = true;
      console.log('Pose detection initialized successfully');
    } catch (error) {
      console.error('Failed to initialize pose detection:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async detectPose(
    video: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): Promise<PoseResult | null> {
    if (!this.detector || !this.isInitialized) {
      console.warn('Pose detector not initialized');
      return null;
    }

    try {
      const poses = await this.detector.estimatePoses(video);

      if (poses.length === 0) {
        return null;
      }

      const pose = poses[0];
      const keypoints: Keypoint[] = pose.keypoints.map((kp) => ({
        x: kp.x,
        y: kp.y,
        score: kp.score,
        name: kp.name
      }));

      return {
        keypoints,
        score: pose.score || 0
      };
    } catch (error) {
      console.error('Pose detection error:', error);
      return null;
    }
  }

  getKeypoint(keypoints: Keypoint[], name: keyof typeof KEYPOINT_INDICES): Keypoint | null {
    const index = KEYPOINT_INDICES[name];
    const keypoint = keypoints[index];
    
    if (!keypoint || (keypoint.score && keypoint.score < 0.3)) {
      return null;
    }
    
    return keypoint;
  }

  isInitializedStatus(): boolean {
    return this.isInitialized;
  }

  dispose(): void {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
      this.isInitialized = false;
    }
  }
}

export const poseDetectionService = new PoseDetectionService();
