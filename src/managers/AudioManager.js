// --- Simple Audio Player for UI sounds ---
export class AudioPlayer {
  constructor() {
    this.enabled = true;
    this.sounds = {
      confirm: new Audio('/button-press.mp3'),
      error: new Audio('/error.mp3'),
    };
    Object.values(this.sounds).forEach(a => {
      a.volume = 0.9;
      a.preload = 'auto';
    });
  }
  playSound(name) {
    if (!this.enabled) return;
    const snd = this.sounds[name];
    if (!snd) return;
    try {
      snd.currentTime = 0;
      snd.play().catch(() => {});
    } catch (_) {}
  }
  setEnabled(on) {
    this.enabled = !!on;
  }
}

// --- Web Speech API TTS ---
export class WebSpeechTTS {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.voicesLoaded = false;
    this.loadVoices();
  }

  loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
      if (this.voices.length > 0) {
        this.voicesLoaded = true;
      } else {
        // Load voices asynchronously
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = this.synth.getVoices();
          this.voicesLoaded = true;
        };
      }
    }
  }

  getVoiceForName(voiceName) {
    if (!this.voicesLoaded || !this.voices.length) return null;

    // Try to find exact match first
    let voice = this.voices.find(v => v.name === voiceName);

    // If not found, try partial match
    if (!voice && voiceName) {
      voice = this.voices.find(v => v.name.toLowerCase().includes(voiceName.toLowerCase()));
    }

    // Fallback to default
    if (!voice) {
      voice = this.voices.find(v => v.default) || this.voices[0];
    }

    return voice;
  }

  async speak(text, voiceName) {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      const voice = this.getVoiceForName(voiceName);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(event.error));

      this.synth.speak(utterance);
    });
  }
}
