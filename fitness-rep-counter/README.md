# FitRep Counter - AI-Powered Exercise Rep Counter

An intelligent fitness web application that uses computer vision and machine learning to automatically count exercise repetitions, analyze form, and provide real-time feedback.

![FitRep Counter](https://img.shields.io/badge/Version-1.0.0-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

### 🎯 Automatic Rep Counting
- Real-time rep detection using TensorFlow.js MoveNet pose estimation
- Support for 7 exercises:
  - Push-ups
  - Pull-ups
  - Sit-ups
  - Squats
  - Deadlifts
  - Muscle-ups
  - Dips

### 🗣️ Verbal Feedback
- Audio rep counter announces each completed rep
- Invalid rep notifications with form correction tips
- Set completion announcements
- Countdown timers with voice cues

### 📊 Form Analysis
- Real-time joint angle tracking
- Range of motion (ROM) measurement
- Form score calculation (0-100%)
- Issue detection (e.g., elbow flare, knee cave, rounded back)

### 📈 Advanced Analytics
- Workout history tracking
- Progress trends over time
- Joint angle analysis with radar charts
- Exercise distribution visualization
- ROM and form score progression graphs

### 📱 Mobile Ready
- Built with Capacitor for Android app conversion
- PWA support for installation on any device
- Responsive design for all screen sizes

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Pose Detection**: TensorFlow.js + MoveNet
- **State Management**: Zustand
- **Charts**: Recharts
- **Icons**: Lucide React
- **Mobile**: Capacitor
- **Styling**: Custom CSS with Tailwind-like utilities

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Modern web browser with camera support
- (For Android) Android Studio with SDK

### Installation

1. Clone the repository:
```bash
cd fitness-rep-counter
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:5173 in your browser

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Converting to Android App

### Prerequisites
- Android Studio installed
- Android SDK configured
- Java 17+

### Steps

1. Build the web app:
```bash
npm run build
```

2. Add Android platform:
```bash
npx cap add android
```

3. Sync the web app to Android:
```bash
npx cap sync android
```

4. Open in Android Studio:
```bash
npx cap open android
```

5. In Android Studio:
   - Wait for Gradle sync to complete
   - Add camera permissions to `AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-feature android:name="android.hardware.camera" />
   <uses-feature android:name="android.hardware.camera.autofocus" />
   ```
   - Build and run on device/emulator

### Android Manifest Additions

Add these to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-feature android:name="android.hardware.camera" android:required="true" />
```

## Usage Guide

### Starting a Workout

1. **Select Exercise**: Choose from the available exercises
2. **Configure Workout**: Set number of sets, reps per set, and rest period
3. **Start**: Click "Start Workout" to begin
4. **Position Yourself**: Ensure your full body is visible in the camera
5. **Exercise**: Perform your reps - the app will count automatically
6. **Rest**: Take your rest period between sets
7. **Complete**: View your workout summary and recommendations

### Tips for Best Results

- **Lighting**: Ensure good, even lighting
- **Camera Position**: Place camera so your full body is visible
- **Clothing**: Wear fitted clothing for better pose detection
- **Background**: Use a plain, uncluttered background
- **Distance**: Position yourself 6-10 feet from the camera

### Understanding Form Scores

- **90-100%**: Excellent form
- **70-89%**: Good form with minor issues
- **50-69%**: Needs improvement
- **Below 50%**: Focus on technique

## Architecture

```
src/
├── components/        # React components
│   ├── AnalyticsDashboard.tsx
│   ├── CameraView.tsx
│   ├── ExerciseSelector.tsx
│   ├── WorkoutDisplay.tsx
│   └── WorkoutSummary.tsx
├── data/             # Static data
│   └── exercises.ts
├── hooks/            # Custom React hooks
│   ├── useCamera.ts
│   ├── usePoseDetection.ts
│   └── useTimer.ts
├── services/         # Business logic
│   ├── exerciseDetection.ts
│   ├── poseDetection.ts
│   └── speechService.ts
├── store/            # State management
│   └── workoutStore.ts
├── types/            # TypeScript types
│   └── index.ts
└── utils/            # Utility functions
    └── angleCalculations.ts
```

## Exercise Detection Logic

Each exercise has specific detection criteria:

### Push-ups
- Track elbow angle (90° bent to 160° extended)
- Monitor body alignment (shoulder-hip-ankle)
- Check elbow flare angle

### Squats
- Track knee angle (90° at bottom to 170° standing)
- Monitor knee cave (knees tracking over toes)
- Check forward lean

### Pull-ups
- Track elbow angle (160° extended to 50° at top)
- Ensure chin above bar level
- Detect kipping/swinging

### Deadlifts
- Track hip angle (90° bent to 170° standing)
- Monitor spine neutrality
- Check bar path

## API Reference

### useCamera Hook
```typescript
const { 
  videoRef,
  canvasRef,
  isReady,
  error,
  startCamera,
  stopCamera,
  switchCamera,
  facingMode
} = useCamera({ facingMode: 'user' });
```

### usePoseDetection Hook
```typescript
const {
  isInitialized,
  currentPose,
  error,
  initialize,
  startDetection,
  stopDetection,
  resetCounter
} = usePoseDetection({
  videoRef,
  canvasRef,
  exercise: 'pushups',
  isActive: true,
  onRepComplete: (rep) => console.log(rep)
});
```

### Speech Service
```typescript
speechService.speak('Hello', 'high');
speechService.announceRep(5);
speechService.announceInvalidRep('Keep your back straight');
speechService.announceSetComplete(1, 8, 10);
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Enhancements

- [ ] Add more exercises (lunges, burpees, planks)
- [ ] Implement workout programs/routines
- [ ] Add social features (share workouts, challenges)
- [ ] Cloud sync for workout history
- [ ] Video recording of workouts
- [ ] AI coaching with personalized recommendations
- [ ] Integration with fitness trackers
- [ ] Multi-language support

## Troubleshooting

### Camera not working
- Check browser camera permissions
- Ensure no other app is using the camera
- Try a different browser

### Pose detection not accurate
- Improve lighting conditions
- Ensure full body is visible
- Wear contrasting clothing

### App running slowly
- Close other browser tabs
- Use Chrome or Edge for best WebGL support
- Reduce video resolution if needed

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- TensorFlow.js team for the MoveNet model
- The open-source fitness community
- All contributors and testers

---

Made with 💪 for fitness enthusiasts everywhere
