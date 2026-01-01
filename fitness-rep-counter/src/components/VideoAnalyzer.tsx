import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ExerciseType, RepData } from '../types';
import { exercises } from '../data/exercises';
import { poseDetectionService } from '../services/poseDetection';
import { exerciseDetectionService } from '../services/exerciseDetection';
import { detectCameraView, getCameraViewLabel, CameraView } from '../utils/angleCalculations';
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  FileVideo,
} from 'lucide-react';

interface VideoAnalyzerProps {
  onBack: () => void;
}

const VideoAnalyzer: React.FC<VideoAnalyzerProps> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPoseReady, setIsPoseReady] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>('pushups');
  const [reps, setReps] = useState<RepData[]>([]);
  const [currentCameraView, setCurrentCameraView] = useState<CameraView>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const animationFrameRef = useRef<number | null>(null);

  // Initialize pose detection
  useEffect(() => {
    const initPose = async () => {
      try {
        await poseDetectionService.initialize();
        setIsPoseReady(true);
      } catch (err) {
        setError('Failed to initialize pose detection');
        console.error(err);
      }
    };
    initPose();
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a video file
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    setError(null);
    setVideoName(file.name);
    setReps([]);
    setProgress(0);
    setCurrentCameraView('unknown');

    // Create object URL for the video
    const url = URL.createObjectURL(file);
    setVideoSrc(url);

    // Reset exercise detection
    exerciseDetectionService.setExercise(selectedExercise);
  }, [selectedExercise]);

  // Handle exercise change
  const handleExerciseChange = useCallback((exercise: ExerciseType) => {
    setSelectedExercise(exercise);
    exerciseDetectionService.setExercise(exercise);
    setReps([]);
  }, []);

  // Draw pose on canvas
  const drawPose = useCallback((keypoints: Array<{ x: number; y: number; score?: number }>) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw skeleton connections
    const connections = [
      [0, 1], [0, 2], [1, 3], [2, 4], // Face
      [5, 7], [7, 9], [6, 8], [8, 10], // Arms
      [5, 6], [5, 11], [6, 12], [11, 12], // Torso
      [11, 13], [13, 15], [12, 14], [14, 16], // Legs
    ];

    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;

    connections.forEach(([i, j]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];
      if (kp1 && kp2 && (kp1.score || 0) > 0.3 && (kp2.score || 0) > 0.3) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    });

    // Draw keypoints
    keypoints.forEach((kp) => {
      if ((kp.score || 0) > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, []);

  // Process single frame
  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended) {
      setIsAnalyzing(false);
      return;
    }

    try {
      const pose = await poseDetectionService.detectPose(video);
      if (pose) {
        drawPose(pose.keypoints);

        // Update camera view
        const view = detectCameraView(pose.keypoints);
        if (view !== 'unknown') {
          setCurrentCameraView(view);
        }

        // Detect rep
        const rep = exerciseDetectionService.detectRep(pose.keypoints);
        if (rep) {
          setReps(prev => [...prev, rep]);
        }
      }

      // Update progress
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    } catch (err) {
      console.error('Frame processing error:', err);
    }

    // Continue processing
    if (!video.paused && !video.ended) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [drawPose]);

  // Start/stop analysis
  const toggleAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      setIsAnalyzing(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      video.play();
      setIsPlaying(true);
      setIsAnalyzing(true);
      processFrame();
    }
  }, [isPlaying, videoSrc, processFrame]);

  // Reset analysis
  const resetAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setIsPlaying(false);
    setIsAnalyzing(false);
    setReps([]);
    setProgress(0);
    exerciseDetectionService.reset();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  // Handle video end
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setIsPlaying(false);
      setIsAnalyzing(false);
      setProgress(100);
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  // Calculate stats
  const validReps = reps.filter(r => r.isValid).length;
  const avgFormScore = reps.length > 0
    ? reps.reduce((sum, r) => sum + r.formScore, 0) / reps.length
    : 0;
  const avgROM = reps.length > 0
    ? reps.reduce((sum, r) => sum + r.rangeOfMotion, 0) / reps.length
    : 0;

  return (
    <div className="video-analyzer">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h2 className="text-xl font-bold">Video Analyzer</h2>
        <div className="w-20" /> {/* Spacer for centering */}
      </div>

      {/* Exercise selector */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Exercise Type</label>
        <select
          value={selectedExercise}
          onChange={(e) => handleExerciseChange(e.target.value as ExerciseType)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          disabled={isAnalyzing}
        >
          {Object.entries(exercises).map(([id, exercise]) => (
            <option key={id} value={id}>
              {exercise.name}
            </option>
          ))}
        </select>
      </div>

      {/* File upload */}
      {!videoSrc && (
        <div
          className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileVideo className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400 mb-2">Click to select a video file</p>
          <p className="text-sm text-gray-500">Supports MP4, WebM, and other video formats</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Video display */}
      {videoSrc && (
        <>
          <div className="relative bg-gray-900 rounded-xl overflow-hidden mb-4">
            {/* Hidden video element */}
            <video
              ref={videoRef}
              src={videoSrc}
              className="hidden"
              playsInline
              muted
            />

            {/* Canvas for drawing */}
            <canvas
              ref={canvasRef}
              className="w-full aspect-video object-contain"
            />

            {/* Camera view indicator */}
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1">
              <span className="text-sm text-gray-300">
                {getCameraViewLabel(currentCameraView)}
              </span>
            </div>

            {/* Rep counter overlay */}
            <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-2xl font-bold text-white">{reps.length}</div>
              <div className="text-xs text-gray-400">Reps</div>
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
              <div
                className="h-full bg-blue-500 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* File name */}
          <div className="text-sm text-gray-400 mb-4 truncate">
            {videoName}
          </div>

          {/* Controls */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={toggleAnalysis}
              disabled={!isPoseReady}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                isPlaying
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isPlaying ? (
                <>
                  <Pause className="inline-block w-5 h-5 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="inline-block w-5 h-5 mr-2" />
                  {progress > 0 ? 'Resume' : 'Analyze'}
                </>
              )}
            </button>
            <button
              onClick={resetAnalysis}
              className="px-6 py-3 bg-gray-700 rounded-xl hover:bg-gray-600 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                resetAnalysis();
                setVideoSrc(null);
                setVideoName('');
              }}
              className="px-6 py-3 bg-gray-700 rounded-xl hover:bg-gray-600 transition-colors"
            >
              <Upload className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          {reps.length > 0 && (
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h3 className="text-lg font-semibold mb-4">Analysis Results</h3>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{reps.length}</div>
                  <div className="text-xs text-gray-400">Total Reps</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{validReps}</div>
                  <div className="text-xs text-gray-400">Valid</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className={`text-2xl font-bold ${avgFormScore >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {Math.round(avgFormScore)}%
                  </div>
                  <div className="text-xs text-gray-400">Avg Form</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {Math.round(avgROM)}%
                  </div>
                  <div className="text-xs text-gray-400">Avg ROM</div>
                </div>
              </div>

              {/* Rep history */}
              <div className="text-sm text-gray-400 mb-2">Rep History</div>
              <div className="flex gap-2 flex-wrap">
                {reps.map((rep, index) => (
                  <div
                    key={index}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      rep.isValid ? 'bg-green-600/30' : 'bg-red-600/30'
                    }`}
                    title={`Rep ${rep.repNumber}: ${Math.round(rep.formScore)}% form, ${rep.issues.join(', ') || 'Good form'}`}
                  >
                    {rep.isValid ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                ))}
              </div>

              {/* Common issues */}
              {reps.some(r => r.issues.length > 0) && (
                <div className="mt-4">
                  <div className="text-sm text-gray-400 mb-2">Common Issues</div>
                  <div className="space-y-1">
                    {Array.from(new Set(reps.flatMap(r => r.issues))).slice(0, 5).map((issue, i) => (
                      <div key={i} className="text-sm text-yellow-400 flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3" />
                        {issue}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mt-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {!isPoseReady && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Initializing pose detection...</p>
        </div>
      )}
    </div>
  );
};

export default VideoAnalyzer;
