import { Keypoint, JointAngles } from '../types';
import { poseDetectionService, KEYPOINT_INDICES } from '../services/poseDetection';

// Calculate angle between three points (in degrees)
export const calculateAngle = (
  point1: Keypoint,
  point2: Keypoint, // vertex
  point3: Keypoint
): number => {
  const radians =
    Math.atan2(point3.y - point2.y, point3.x - point2.x) -
    Math.atan2(point1.y - point2.y, point1.x - point2.x);

  let angle = Math.abs((radians * 180) / Math.PI);

  if (angle > 180) {
    angle = 360 - angle;
  }

  return angle;
};

// Calculate distance between two points
export const calculateDistance = (point1: Keypoint, point2: Keypoint): number => {
  return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
};

// Calculate midpoint between two points
export const getMidpoint = (point1: Keypoint, point2: Keypoint): Keypoint => {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  };
};

// Get all relevant joint angles from keypoints
export const getJointAngles = (keypoints: Keypoint[]): JointAngles => {
  const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
    poseDetectionService.getKeypoint(keypoints, name);

  const angles: JointAngles = {};

  // Left Elbow angle
  const leftShoulder = getKP('leftShoulder');
  const leftElbow = getKP('leftElbow');
  const leftWrist = getKP('leftWrist');
  if (leftShoulder && leftElbow && leftWrist) {
    angles.leftElbow = calculateAngle(leftShoulder, leftElbow, leftWrist);
  }

  // Right Elbow angle
  const rightShoulder = getKP('rightShoulder');
  const rightElbow = getKP('rightElbow');
  const rightWrist = getKP('rightWrist');
  if (rightShoulder && rightElbow && rightWrist) {
    angles.rightElbow = calculateAngle(rightShoulder, rightElbow, rightWrist);
  }

  // Left Shoulder angle
  const leftHip = getKP('leftHip');
  if (leftShoulder && leftElbow && leftHip) {
    angles.leftShoulder = calculateAngle(leftHip, leftShoulder, leftElbow);
  }

  // Right Shoulder angle
  const rightHip = getKP('rightHip');
  if (rightShoulder && rightElbow && rightHip) {
    angles.rightShoulder = calculateAngle(rightHip, rightShoulder, rightElbow);
  }

  // Left Hip angle
  const leftKnee = getKP('leftKnee');
  if (leftShoulder && leftHip && leftKnee) {
    angles.leftHip = calculateAngle(leftShoulder, leftHip, leftKnee);
  }

  // Right Hip angle
  const rightKnee = getKP('rightKnee');
  if (rightShoulder && rightHip && rightKnee) {
    angles.rightHip = calculateAngle(rightShoulder, rightHip, rightKnee);
  }

  // Left Knee angle
  const leftAnkle = getKP('leftAnkle');
  if (leftHip && leftKnee && leftAnkle) {
    angles.leftKnee = calculateAngle(leftHip, leftKnee, leftAnkle);
  }

  // Right Knee angle
  const rightAnkle = getKP('rightAnkle');
  if (rightHip && rightKnee && rightAnkle) {
    angles.rightKnee = calculateAngle(rightHip, rightKnee, rightAnkle);
  }

  // Spine angle (using shoulders and hips)
  if (leftShoulder && rightShoulder && leftHip && rightHip) {
    const shoulderMid = getMidpoint(leftShoulder, rightShoulder);
    const hipMid = getMidpoint(leftHip, rightHip);
    // Vertical reference point
    const verticalRef = { x: shoulderMid.x, y: shoulderMid.y - 100 };
    angles.spine = calculateAngle(verticalRef, shoulderMid, hipMid);
  }

  // Neck angle
  const nose = getKP('nose');
  if (nose && leftShoulder && rightShoulder) {
    const shoulderMid = getMidpoint(leftShoulder, rightShoulder);
    const verticalRef = { x: shoulderMid.x, y: shoulderMid.y - 100 };
    angles.neck = calculateAngle(verticalRef, shoulderMid, nose);
  }

  return angles;
};

// Check if body is in a straight line (for push-ups, planks)
export const checkBodyAlignment = (keypoints: Keypoint[]): number => {
  const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
    poseDetectionService.getKeypoint(keypoints, name);

  const shoulder = getKP('leftShoulder') || getKP('rightShoulder');
  const hip = getKP('leftHip') || getKP('rightHip');
  const ankle = getKP('leftAnkle') || getKP('rightAnkle');

  if (!shoulder || !hip || !ankle) return 0;

  const angle = calculateAngle(shoulder, hip, ankle);
  // Perfect alignment would be 180 degrees
  const deviation = Math.abs(180 - angle);
  const alignmentScore = Math.max(0, 100 - deviation * 2);

  return alignmentScore;
};

// Calculate vertical displacement
export const getVerticalDisplacement = (
  keypoints1: Keypoint[],
  keypoints2: Keypoint[],
  keypointName: keyof typeof KEYPOINT_INDICES
): number => {
  const kp1 = poseDetectionService.getKeypoint(keypoints1, keypointName);
  const kp2 = poseDetectionService.getKeypoint(keypoints2, keypointName);

  if (!kp1 || !kp2) return 0;

  return kp2.y - kp1.y;
};

// Camera view types
export type CameraView = 'side' | 'front' | 'oblique' | 'unknown';

/**
 * Detect camera view based on shoulder width ratio.
 * - Side view: shoulders appear very close together (width ratio < 0.1)
 * - Front view: shoulders at maximum apparent width (width ratio > 0.25)
 * - Oblique: somewhere in between
 *
 * The ratio is computed as the horizontal distance between shoulders
 * divided by the frame width (approximated by using the video/canvas dimensions
 * or normalized coordinates if using 0-1 range).
 */
export const detectCameraView = (keypoints: Keypoint[]): CameraView => {
  const getKP = (name: keyof typeof KEYPOINT_INDICES) =>
    poseDetectionService.getKeypoint(keypoints, name);

  const leftShoulder = getKP('leftShoulder');
  const rightShoulder = getKP('rightShoulder');

  if (!leftShoulder || !rightShoulder) {
    return 'unknown';
  }

  // Compute horizontal distance between shoulders
  const shoulderWidthX = Math.abs(rightShoulder.x - leftShoulder.x);

  // We also need a reference for scale. Use the vertical torso length
  // (shoulder to hip) as a normalizer since it's relatively constant
  // regardless of camera angle.
  const leftHip = getKP('leftHip');
  const rightHip = getKP('rightHip');
  const hip = leftHip || rightHip;
  const shoulder = leftShoulder; // use one shoulder for torso length

  if (!hip) {
    // Fallback: just use raw shoulder width thresholds (assuming ~640px frame)
    if (shoulderWidthX < 40) return 'side';
    if (shoulderWidthX > 150) return 'front';
    return 'oblique';
  }

  const torsoLength = Math.abs(hip.y - shoulder.y);
  if (torsoLength < 10) {
    // Torso not visible enough
    return 'unknown';
  }

  // Ratio of shoulder width to torso length
  // Side view: ratio ~0 to 0.3
  // Oblique: ratio ~0.3 to 0.7
  // Front view: ratio ~0.7+
  const ratio = shoulderWidthX / torsoLength;

  if (ratio < 0.3) return 'side';
  if (ratio > 0.7) return 'front';
  return 'oblique';
};

/**
 * Get a human-readable description of the detected camera view.
 */
export const getCameraViewLabel = (view: CameraView): string => {
  switch (view) {
    case 'side':
      return 'Side View';
    case 'front':
      return 'Front View';
    case 'oblique':
      return 'Oblique View';
    default:
      return 'Unknown View';
  }
};
