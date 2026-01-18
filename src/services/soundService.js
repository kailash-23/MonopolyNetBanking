/**
 * Sound Service
 * Handles all sound effects and notifications for the app
 */

class SoundService {
  constructor() {
    this.enabled = true;
    this.notificationsEnabled = true;
    this.audioContext = null;
    this.sounds = {};
    this.volume = 0.5;
    
    // Initialize settings from localStorage
    this.loadSettings();
  }

  loadSettings() {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        this.enabled = userData.settings?.soundEnabled ?? true;
        this.notificationsEnabled = userData.settings?.notificationsEnabled ?? true;
      } catch (e) {
        console.error('Failed to load sound settings:', e);
      }
    }
  }

  updateSettings(soundEnabled, notificationsEnabled) {
    this.enabled = soundEnabled;
    this.notificationsEnabled = notificationsEnabled;
  }

  getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Generate a beep tone
  playTone(frequency, duration, type = 'sine') {
    if (!this.enabled) return;

    try {
      const ctx = this.getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Failed to play tone:', e);
    }
  }

  // Button click sound - soft click
  playClick() {
    if (!this.enabled) return;
    this.playTone(800, 0.05, 'sine');
  }

  // Button hover sound - subtle
  playHover() {
    if (!this.enabled) return;
    this.playTone(600, 0.03, 'sine');
  }

  // Success sound - ascending tones
  playSuccess() {
    if (!this.enabled) return;
    this.playTone(523, 0.1, 'sine'); // C
    setTimeout(() => this.playTone(659, 0.1, 'sine'), 100); // E
    setTimeout(() => this.playTone(784, 0.15, 'sine'), 200); // G
  }

  // Error sound - descending tones
  playError() {
    if (!this.enabled) return;
    this.playTone(400, 0.15, 'sawtooth');
    setTimeout(() => this.playTone(300, 0.2, 'sawtooth'), 150);
  }

  // Notification sound - pleasant chime
  playNotification() {
    if (!this.enabled || !this.notificationsEnabled) return;
    this.playTone(880, 0.1, 'sine'); // A5
    setTimeout(() => this.playTone(1047, 0.15, 'sine'), 100); // C6
  }

  // Friend request received
  playFriendRequest() {
    if (!this.enabled || !this.notificationsEnabled) return;
    this.playTone(659, 0.1, 'sine'); // E
    setTimeout(() => this.playTone(784, 0.1, 'sine'), 100); // G
    setTimeout(() => this.playTone(1047, 0.15, 'sine'), 200); // C6
  }

  // Game start sound
  playGameStart() {
    if (!this.enabled) return;
    const notes = [523, 659, 784, 1047]; // C, E, G, C
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.15, 'sine'), i * 150);
    });
  }

  // Dice roll sound
  playDiceRoll() {
    if (!this.enabled) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.playTone(200 + Math.random() * 400, 0.05, 'triangle');
      }, i * 50);
    }
  }

  // Money received
  playMoneyReceived() {
    if (!this.enabled) return;
    this.playTone(523, 0.08, 'sine');
    setTimeout(() => this.playTone(659, 0.08, 'sine'), 80);
    setTimeout(() => this.playTone(784, 0.12, 'sine'), 160);
  }

  // Money paid
  playMoneyPaid() {
    if (!this.enabled) return;
    this.playTone(784, 0.08, 'sine');
    setTimeout(() => this.playTone(659, 0.08, 'sine'), 80);
    setTimeout(() => this.playTone(523, 0.12, 'sine'), 160);
  }

  // Toggle sound - switch flip
  playToggle(isOn) {
    if (!this.enabled) return;
    this.playTone(isOn ? 700 : 500, 0.05, 'sine');
  }

  // Navigation sound
  playNavigate() {
    if (!this.enabled) return;
    this.playTone(600, 0.04, 'sine');
  }

  // Modal open
  playModalOpen() {
    if (!this.enabled) return;
    this.playTone(400, 0.08, 'sine');
    setTimeout(() => this.playTone(600, 0.1, 'sine'), 50);
  }

  // Modal close
  playModalClose() {
    if (!this.enabled) return;
    this.playTone(600, 0.08, 'sine');
    setTimeout(() => this.playTone(400, 0.1, 'sine'), 50);
  }

  // Show browser notification
  async showNotification(title, body, options = {}) {
    if (!this.notificationsEnabled) return;

    // Request permission if needed
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/mrMonopoly.png',
        badge: '/mrMonopoly.png',
        vibrate: [200, 100, 200],
        ...options
      });

      // Play notification sound
      this.playNotification();

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    }
  }

  // Request notification permission
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }
}

// Export singleton instance
export const soundService = new SoundService();
export default soundService;
