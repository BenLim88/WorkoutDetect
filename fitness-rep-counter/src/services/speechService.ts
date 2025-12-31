import { SpeechSettings } from '../types';

class SpeechService {
  private synthesis: SpeechSynthesis | null = null;
  private settings: SpeechSettings = {
    enabled: true,
    volume: 1,
    rate: 1,
    pitch: 1,
  };
  private voice: SpeechSynthesisVoice | null = null;
  private isInitialized = false;
  private messageQueue: string[] = [];
  private isSpeaking = false;

  initialize(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }

    this.synthesis = window.speechSynthesis;

    // Load voices
    const loadVoices = () => {
      const voices = this.synthesis?.getVoices() || [];
      // Prefer English voices
      this.voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) ||
                   voices.find(v => v.lang.startsWith('en')) ||
                   voices[0] || null;
      this.isInitialized = true;
    };

    if (this.synthesis.getVoices().length > 0) {
      loadVoices();
    } else {
      this.synthesis.onvoiceschanged = loadVoices;
    }
  }

  updateSettings(settings: Partial<SpeechSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  getSettings(): SpeechSettings {
    return { ...this.settings };
  }

  speak(text: string, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    if (!this.settings.enabled || !this.synthesis) return;

    if (priority === 'high') {
      // Cancel current speech for high priority messages
      this.synthesis.cancel();
      this.messageQueue = [text];
    } else if (priority === 'low') {
      // Add to queue
      this.messageQueue.push(text);
    } else {
      // Normal priority - add to front of queue
      this.messageQueue.unshift(text);
    }

    this.processQueue();
  }

  private processQueue(): void {
    if (this.isSpeaking || this.messageQueue.length === 0 || !this.synthesis) return;

    const text = this.messageQueue.shift();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.settings.volume;
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;
    
    if (this.voice) {
      utterance.voice = this.voice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      // Process next message after a short delay
      setTimeout(() => this.processQueue(), 100);
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.processQueue();
    };

    this.synthesis.speak(utterance);
  }

  // Convenience methods for common announcements
  // For reps: play a short "ring" on every valid rep,
  // and only speak the rep count every 5 reps to reduce chatter.
  announceRep(count: number): void {
    // Ring sound (short, lower priority)
    this.speak('ding', 'low');

    if (count > 0 && count % 5 === 0) {
      this.speak(count.toString(), 'high');
    }
  }

  announceInvalidRep(reason?: string): void {
    const message = reason ?? 'No rep. Form needs improvement.';
    this.speak(message, 'high');
  }

  announceSetComplete(setNumber: number, validReps: number, totalReps: number): void {
    const message = `Set ${setNumber} complete. ${validReps} of ${totalReps} valid reps.`;
    this.speak(message, 'high');
  }

  announceRestPeriod(seconds: number): void {
    this.speak(`Rest for ${seconds} seconds`, 'normal');
  }

  announceRestCountdown(seconds: number): void {
    if (seconds <= 5) {
      this.speak(seconds.toString(), 'high');
    }
  }

  announceWorkoutComplete(): void {
    this.speak('Workout complete! Great job!', 'high');
  }

  announceExerciseStart(exercise: string): void {
    this.speak(`Starting ${exercise}. Get ready!`, 'high');
  }

  announceCountdown(count: number): void {
    this.speak(count.toString(), 'high');
  }

  announceFormIssue(message: string): void {
    this.speak(message, 'normal');
  }

  announceMotivation(): void {
    const motivations = [
      'Keep going!',
      'You got this!',
      'Great form!',
      'Push through!',
      'Almost there!',
      'Strong effort!',
    ];
    const message = motivations[Math.floor(Math.random() * motivations.length)];
    this.speak(message, 'low');
  }

  stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.messageQueue = [];
      this.isSpeaking = false;
    }
  }

  isEnabled(): boolean {
    return this.settings.enabled && this.isInitialized;
  }
}

export const speechService = new SpeechService();
