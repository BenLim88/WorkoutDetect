# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository layout

- Primary application lives in `fitness-rep-counter/`, a React 18 + TypeScript + Vite single-page app for AI-powered exercise rep counting, form analysis, and workout analytics.
- Within `fitness-rep-counter/src` code is organized by responsibility rather than by feature:
  - `components/` – top-level UI components for configuration, live workout view, summary, analytics, and camera rendering.
  - `hooks/` – custom React hooks that encapsulate camera access, pose detection, and timing logic.
  - `services/` – framework-agnostic services for TensorFlow.js MoveNet pose detection, exercise rep detection logic, and speech synthesis.
  - `store/` – Zustand store responsible for workout configuration, current session state, timers, and persistent workout history.
  - `data/` – static exercise metadata (names, descriptions, coaching key points).
  - `types/` – central TypeScript domain model (exercise types, reps, sets, sessions, pose results, chart data, speech settings, etc.).
  - `utils/` – math utilities for joint angle calculations, body alignment scoring, and keypoint geometry.
- Root-level configs in `fitness-rep-counter/` (Vite, TypeScript project references, ESLint flat config, Capacitor config) control build, linting, and Android packaging.

## Common commands

All commands below assume you start in the repository root and then work inside the app directory:

```bash path=null start=null
cd fitness-rep-counter
```

### Install dependencies

```bash path=null start=null
npm install
```

Requirements (from `README.md`): Node.js 18+, npm or yarn, and a modern browser with camera support. Android builds additionally require Android Studio, SDK, and Java 17+.

### Local development

Start the Vite dev server (default at `http://localhost:5173`, exposed on all interfaces via `server.host: true`):

```bash path=null start=null
npm run dev
```

### Production build & preview

Build the app (runs TypeScript project build via `tsc -b` and then `vite build`, outputting to `dist/` with manual code splitting for TensorFlow, charts, and vendor libs):

```bash path=null start=null
npm run build
```

Preview the built bundle with Vite's preview server:

```bash path=null start=null
npm run preview
```

### Linting

Run ESLint (flat config with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`; `dist/` is globally ignored):

```bash path=null start=null
npm run lint
```

### Android (Capacitor) build workflow

The app is set up to be packaged as an Android application using Capacitor. Typical flow (per `README.md`):

```bash path=null start=null
# From fitness-rep-counter/
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, you must ensure appropriate camera and internet permissions are present in `android/app/src/main/AndroidManifest.xml` (see `README.md` for the exact `<uses-permission>` / `<uses-feature>` entries).

### Tests

As of this version there is no configured test runner or `test` NPM script (and no `*.test.ts` / `*.test.tsx` files). If you need automated tests, you will first need to introduce a test framework and corresponding NPM scripts before tests can be run from the CLI.

## Application architecture

### Entry point, routing, and PWA setup

- `src/main.tsx` renders `<App />` into `#root` under `React.StrictMode` and registers a service worker (`sw.js`) after the window `load` event when the browser supports `navigator.serviceWorker`. This enables PWA-style offline/installation behavior; avoid removing `sw.js` or the registration unless you also update this initialization.
- `src/App.tsx` is the main application shell. It:
  - Manages high-level view state via `appView: 'home' | 'workout' | 'summary' | 'analytics'`.
  - Tracks simple UI preferences such as dark/light mode and whether speech feedback is enabled.
  - Sources all workout domain data and actions from the Zustand store via `useWorkoutStore()`.

Views:

- **Home view** (`appView === 'home'`): renders `ExerciseSelector`, bound to `config` from the store (`exercise`, `sets`, `targetReps`, `restPeriod`, and `cameraZoomLevel`). Starting a workout calls `startWorkout()` on the store and switches to the `workout` view.
- **Workout view** (`'workout'`): renders `WorkoutDisplay`, which orchestrates camera, pose detection, timers, and speech. Callbacks from `WorkoutDisplay` (rep completion, set completion, phase and timer updates, camera/pose readiness, zoom changes) delegate to `useWorkoutStore` actions to keep all domain state centralized.
- **Summary view** (`'summary'`): when `currentSession` exists and the workout has been completed, `WorkoutSummary` displays per-set and per-session metrics (total reps, valid reps, average form and ROM, duration, recommendations). Buttons allow starting a new workout (`resetWorkout()`) or navigating to analytics.
- **Analytics view** (`'analytics'`): renders `AnalyticsDashboard`, driven entirely by `workoutHistory` and helper selectors from the store. Navigation logic in `App` ensures that returning from analytics lands either on the last summary or back on the home screen depending on the current phase.

### State management and persistence

- `src/store/workoutStore.ts` defines the global app store using Zustand with `persist` middleware.
  - **Configuration**: `config: WorkoutConfig` (exercise type, number of sets, target reps, rest period) is the canonical source used throughout the UI.
  - **Live session state**: `currentSession`, `currentSetIndex`, `currentReps`, `phase: WorkoutPhase`, countdown and rest timers, and timestamps for workout and individual sets.
  - **History**: `workoutHistory: WorkoutSession[]` accumulates past sessions and is used by analytics components.
  - **UI and camera state**: `isCameraReady`, `isPoseDetectionReady`, `showSettings`, and `cameraZoomLevel` centralize readiness and UI flags that otherwise would be scattered across components.
  - **Actions**: methods like `setConfig`, `startWorkout`, `addRep`, `completeSet`, `startNextSet`, `completeWorkout`, `resetWorkout`, and timer setters encapsulate all allowed state transitions. `completeWorkout` also computes derived metrics (average form, ROM, calories estimate) and generates human-readable recommendations based on performance.
  - **Persistence**: via `persist`, only `workoutHistory`, `config`, and `cameraZoomLevel` are stored under the `fitness-workout-storage` key; transient session data is intentionally not persisted across reloads.
  - **Analytics helpers**: `getTrendData()` aggregates history by calendar date for charts (total reps, valid reps, average form and ROM) and returns at most the last 30 days; `getExerciseHistory(exercise)` filters prior sessions by `ExerciseType`.

When modifying core behavior (e.g., workout phases or history structure), update both the store and consumers such as `AnalyticsDashboard` to keep derived metrics consistent.

### Camera and pose detection pipeline

The end-to-end pipeline from camera frames to rep events consists of several layers:

1. **`useCamera` hook (`src/hooks/useCamera.ts`)**
   - Wraps `navigator.mediaDevices.getUserMedia` to acquire a video stream given options like `facingMode`, `width`, and `height`.
   - Exposes `videoRef` and `canvasRef` React refs, plus `startCamera`, `stopCamera`, and `switchCamera` helpers.
   - Tracks `facingMode`, readiness state, and zoom level, and probes `MediaTrackCapabilities` to detect hardware zoom support, falling back to CSS-based zoom when hardware zoom is unavailable.
   - Ensures the canvas dimensions are synchronized to the actual video frame size once the metadata is loaded and playback starts.

2. **Pose detection service (`src/services/poseDetection.ts`)**
   - Lazily initializes TensorFlow.js with the WebGL backend and sets up a MoveNet `SINGLEPOSE_THUNDER` detector with smoothing and a minimum pose score.
   - Provides `detectPose(videoElement)` which returns the highest-scoring pose as a `PoseResult` (keypoints + score) or `null` when no pose is detected.
   - Exposes `getKeypoint(keypoints, name)` which applies a minimum score threshold to filter out low-confidence joints and a `KEYPOINT_INDICES` mapping for all MoveNet joints.

3. **Exercise detection service (`src/services/exerciseDetection.ts`)**
   - Maintains per-exercise detection state (`phase` across the rep, min/max observed angles, ROM history, current form issues, rep counter, and cached positions at the top/bottom of the motion).
   - Uses `EXERCISE_THRESHOLDS` to define angle and ROM thresholds for each `ExerciseType` (push-ups, pull-ups, sit-ups, squats, deadlift, muscle-up, dips).
   - For each frame, `detectRep(keypoints)`:
     - Computes a primary joint angle appropriate to the exercise (e.g., elbow angle for push-ups/dips, knee angle for squats, hip angle for deadlifts and sit-ups) using `calculateAngle` from `src/utils/angleCalculations.ts`.
     - Updates angle history and min/max angles to track ROM for the current rep.
     - Runs a finite-state machine over `phase` to determine when a full rep has been completed and, when appropriate, emits a `RepData` object containing rep number, duration, ROM %, form score, and issues.
   - Performs continuous form checks specific to each exercise (body alignment for push-ups/planks, knee cave and forward lean for squats, rounded back for deadlifts, kipping for pull-ups) and records `FormIssue` objects that later influence the rep's `formScore` and validity.

4. **`usePoseDetection` hook (`src/hooks/usePoseDetection.ts`)**
   - Bridges `useCamera` and the services by accepting `videoRef`/`canvasRef`, the current `exercise`, and an `isActive` flag.
   - On initialization, calls `poseDetectionService.initialize()` and sets the exercise on `exerciseDetectionService`.
   - Runs a `requestAnimationFrame` loop while active that:
     - Invokes `poseDetectionService.detectPose(video)` when the video is ready.
     - Draws the live video frame plus a skeleton overlay (connections and keypoints) into the canvas.
     - When `isActive` is true, calls `exerciseDetectionService.detectRep` and forwards any completed reps to the optional `onRepComplete` callback.
   - Exposes control functions (`initialize`, `startDetection`, `stopDetection`, `resetCounter`) and status (`isInitialized`, `currentPose`, `error`).

5. **Workout orchestration (`src/components/WorkoutDisplay.tsx`)**
   - Owns instances of `useCamera`, `usePoseDetection`, and `useTimer` and passes camera and pose readiness back to the global store via `onCameraReady` / `onPoseReady`.
   - Responds to store-driven `phase` changes:
     - `countdown` – resets and starts a countdown timer, displays a full-screen overlay, announces the upcoming exercise, and transitions to `exercising` upon completion.
     - `exercising` – keeps pose detection active; each `RepData` is passed to the parent, speech feedback is triggered, and set completion is checked against `targetReps`.
     - `resting` – runs a rest timer with overlay, summary stats, optional skip button, and rest countdown speech cues; on completion calls `onStartNextSet`.
     - `workoutComplete` – announces completion and delegates to `onCompleteWorkout`, which finalizes the session in the store and transitions to `summary`.
   - Manages UI-level concerns like pause/resume, speech on/off, rest skipping, zoom synchronization with the store, and rich on-screen feedback (recent rep tiles, per-set metrics, form issue banners).

### Timing and speech feedback

- **Timing hooks (`src/hooks/useTimer.ts`)**:
  - `useTimer` implements a reusable timer with `time`, `isRunning`, and control functions (`start`, `stop`, `reset`, `setTime`), driven by `setInterval` and optional `onTick` / `onComplete` callbacks.
  - `useCountdown` and `useStopwatch` are thin wrappers configuring `useTimer` for counting down or up, respectively.
  - `WorkoutDisplay` uses two independent timers (countdown before a set and rest between sets), and forwards their ticks to the store so that time remaining is part of global state.

- **Speech service (`src/services/speechService.ts`)**:
  - Wraps `window.speechSynthesis` with initialization, voice selection (English voice preference), settings (`enabled`, `volume`, `rate`, `pitch`), and an internal message queue to avoid overlapping utterances.
  - Exposes high-level methods `announceRep`, `announceInvalidRep`, `announceSetComplete`, `announceRestPeriod`, `announceRestCountdown`, `announceWorkoutComplete`, `announceExerciseStart`, `announceCountdown`, `announceFormIssue`, and `announceMotivation`.
  - `WorkoutDisplay` initializes this service once per mount and updates settings when the user toggles speech. It uses the convenience methods to keep audio feedback aligned with visible state (e.g., rep count, set completion, countdown numbers, rest countdown).

### Domain modeling and analytics

- **Types (`src/types/index.ts`)** define the shared domain language:
  - Exercise identifiers (`ExerciseType`) and metadata (`Exercise`).
  - Configuration (`WorkoutConfig`), per-rep (`RepData`), per-set (`SetData`), and per-session (`WorkoutSession`) structures.
  - Pose detection results (`PoseResult`, `Keypoint`) and analysis types (`JointAngles`, `TrendDataPoint`, `JointAngleHistory`, `FormIssue`, `SpeechSettings`).
  - Workout lifecycle phases (`WorkoutPhase`), which are critical for coordinating UI, timers, and detection.

- **Exercise metadata (`src/data/exercises.ts`)** describes each supported exercise (push-ups, pull-ups, sit-ups, squats, deadlift, muscle-up, dips) with human-readable descriptions, difficulty level, target muscles, and coaching key points. Components like `ExerciseSelector` and `WorkoutDisplay` read from this module to present guidance alongside detection.

- **Angle & alignment utilities (`src/utils/angleCalculations.ts`)** centralize geometric helpers:
  - `calculateAngle`, `calculateDistance`, and `getMidpoint` for basic operations.
  - `getJointAngles` to derive a consistent set of joint angles from keypoints for analysis and scoring.
  - `checkBodyAlignment` to compute an alignment score (0–100) for push-up–style exercises.
  - `getVerticalDisplacement` to compare vertical movement of a specific joint across frames.

- **Analytics** (primarily implemented in `AnalyticsDashboard.tsx` and supported by `useWorkoutStore`):
  - Use `workoutHistory` and `getTrendData()` to build charts (via Recharts) for total reps, valid reps, form scores, and ROM trends over time.
  - Exercise-specific breakdowns can be computed via `getExerciseHistory(exercise)` to power per-exercise analytics and comparisons.

When extending the app (e.g., adding new exercises, metrics, or analytics views), keep this separation of concerns in mind:

- Add new exercise metadata in `src/data/exercises.ts` and update `ExerciseType` / related types in `src/types/index.ts`.
- Extend thresholds and detection logic in `src/services/exerciseDetection.ts` and, if necessary, add new helpers in `src/utils/angleCalculations.ts`.
- Wire new UI or analytics features through the Zustand store rather than introducing separate global state so history and trends remain consistent across the app.
