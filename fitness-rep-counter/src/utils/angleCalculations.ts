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
