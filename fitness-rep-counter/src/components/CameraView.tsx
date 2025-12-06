import React, { useEffect, useRef } from 'react';
import { Camera, CameraOff, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  error: string | null;
  onStart: () => void;
  onSwitch: () => void;
  facingMode: 'user' | 'environment';
  showOverlay?: boolean;
  repCount?: number;
  targetReps?: number;
  setNumber?: number;
  totalSets?: number;
  formScore?: number;
  currentPhase?: string;
  isSpeechEnabled?: boolean;
  onToggleSpeech?: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  isReady,
  error,
  onStart,
  onSwitch,
  facingMode,
  showOverlay = false,
  repCount = 0,
  targetReps = 0,
  setNumber = 1,
  totalSets = 1,
  formScore = 0,
  currentPhase = '',
  isSpeechEnabled = true,
  onToggleSpeech,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onStart();
  }, [onStart]);

  const getFormScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div ref={containerRef} className="camera-view relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden">
      {/* Hidden video element */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
      />

      {/* Canvas for drawing */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
      />

      {/* Loading/Error state */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
          {error ? (
            <div className="text-center p-4">
              <CameraOff className="w-12 h-12 mx-auto mb-4 text-red-400" />
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={onStart}
                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="text-center">
              <Camera className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-pulse" />
              <p className="text-gray-400">Initializing camera...</p>
            </div>
          )}
        </div>
      )}

      {/* Workout Overlay */}
      {showOverlay && isReady && (
        <>
          {/* Rep Counter - Top Center */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-center">
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-8 py-4">
              <div className="text-6xl font-bold tracking-wider">
                <span className="text-white">{repCount}</span>
                <span className="text-gray-500 text-4xl"> / {targetReps}</span>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Set {setNumber} of {totalSets}
              </div>
            </div>
          </div>

          {/* Form Score - Top Right */}
          <div className="absolute top-4 right-4">
            <div className="bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2">
              <div className="text-xs text-gray-400 mb-1">Form Score</div>
              <div className={`text-2xl font-bold ${getFormScoreColor(formScore)}`}>
                {Math.round(formScore)}%
              </div>
            </div>
          </div>

          {/* Phase Indicator - Bottom Center */}
          {currentPhase && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
              <div className={`px-6 py-2 rounded-full text-sm font-medium ${
                currentPhase === 'up' 
                  ? 'bg-green-500/80' 
                  : currentPhase === 'down' 
                    ? 'bg-blue-500/80' 
                    : 'bg-gray-500/80'
              }`}>
                {currentPhase.toUpperCase()}
              </div>
            </div>
          )}
        </>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
        {/* Switch Camera */}
        <button
          onClick={onSwitch}
          className="p-3 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-colors"
          title="Switch Camera"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Speech Toggle */}
        {onToggleSpeech && (
          <button
            onClick={onToggleSpeech}
            className="p-3 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-colors"
            title={isSpeechEnabled ? 'Mute' : 'Unmute'}
          >
            {isSpeechEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraView;
