import React, { useEffect, useCallback } from 'react';
import { Camera, CameraOff, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useCamera, ZoomLevel } from '../hooks/useCamera';

const ZOOM_LEVELS: ZoomLevel[] = [1, 1.5, 2, 2.5, 3];

interface CameraPreviewProps {
  zoomLevel: ZoomLevel;
  onZoomChange: (level: ZoomLevel) => void;
  onReady?: (ready: boolean) => void;
}

const CameraPreview: React.FC<CameraPreviewProps> = ({
  zoomLevel,
  onZoomChange,
  onReady,
}) => {
  const {
    videoRef,
    canvasRef,
    isReady,
    error,
    startCamera,
    stopCamera,
    switchCamera,
    facingMode,
    zoomCapabilities,
    setZoomLevel,
  } = useCamera({ facingMode: 'user' });

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Notify parent of ready state
  useEffect(() => {
    onReady?.(isReady);
  }, [isReady, onReady]);

  // Sync zoom level from props
  useEffect(() => {
    if (isReady) {
      setZoomLevel(zoomLevel);
    }
  }, [isReady, zoomLevel, setZoomLevel]);

  // Draw video to canvas continuously
  useEffect(() => {
    if (!isReady || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
      }
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isReady, videoRef, canvasRef]);

  const handleZoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      const newLevel = ZOOM_LEVELS[currentIndex + 1];
      setZoomLevel(newLevel);
      onZoomChange(newLevel);
    }
  }, [zoomLevel, setZoomLevel, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      const newLevel = ZOOM_LEVELS[currentIndex - 1];
      setZoomLevel(newLevel);
      onZoomChange(newLevel);
    }
  }, [zoomLevel, setZoomLevel, onZoomChange]);

  const handleZoomSelect = useCallback((level: ZoomLevel) => {
    setZoomLevel(level);
    onZoomChange(level);
  }, [setZoomLevel, onZoomChange]);

  return (
    <div className="camera-preview relative bg-gray-900 rounded-xl overflow-hidden">
      {/* Hidden video element */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
      />

      {/* Canvas for preview */}
      <div className="aspect-video overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover"
          style={{
            transform: `${facingMode === 'user' ? 'scaleX(-1)' : ''} scale(${zoomCapabilities.supportsHardwareZoom ? 1 : zoomLevel})`,
            transformOrigin: 'center center',
          }}
        />
      </div>

      {/* Loading/Error state */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
          {error ? (
            <div className="text-center p-4">
              <CameraOff className="w-10 h-10 mx-auto mb-3 text-red-400" />
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-sm"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="text-center">
              <Camera className="w-10 h-10 mx-auto mb-3 text-blue-400 animate-pulse" />
              <p className="text-gray-400 text-sm">Starting camera...</p>
            </div>
          )}
        </div>
      )}

      {/* Camera ready overlay with positioning guide */}
      {isReady && (
        <>
          {/* Positioning guide */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 border-2 border-white/20 rounded-lg" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-blue-400/40 rounded-full" />
          </div>

          {/* Zoom indicator */}
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <span className="text-sm font-medium">{zoomLevel}x zoom</span>
          </div>

          {/* Switch camera button */}
          <button
            onClick={switchCamera}
            className="absolute top-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-colors"
            title="Switch Camera"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Zoom Controls - Bottom */}
      <div className="bg-gray-800/80 backdrop-blur-sm p-3">
        <div className="flex items-center justify-center gap-2">
          {/* Zoom out button */}
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Zoom level buttons */}
          <div className="flex gap-1">
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => handleZoomSelect(level)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  zoomLevel === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {level}x
              </button>
            ))}
          </div>

          {/* Zoom in button */}
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 3}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Helper text */}
        <p className="text-center text-xs text-gray-400 mt-2">
          Adjust zoom to frame yourself properly before starting
        </p>
      </div>
    </div>
  );
};

export default CameraPreview;
