import { PLAYER_TWO_AVAILABLE } from '../data/constants.js';

// --- Speech Recognition System ---
export class SpeechRecognitionSystem {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

    if (this.supported) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    }
  }

  setupRecognition() {
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;
  }

  start(onResult, onError, onStart) {
    // Prefer Player2 STT if available and authenticated
    if (PLAYER_TWO_AVAILABLE && (window.PlayerTwoBridge.authToken || window.PlayerTwoBridge.clientId)) {
      this.usePlayerTwoSTT(onResult, onError, onStart);
      return;
    }

    if (!this.supported) {
      onError(new Error('Speech recognition not supported in this browser'));
      return;
    }

    if (this.isListening) {
      this.stop();
    }

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      onResult(finalTranscript || interimTranscript, finalTranscript);
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      onError(new Error(event.error));
    };

    this.recognition.onstart = () => {
      this.isListening = true;
      onStart();
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    try {
      this.recognition.start();
    } catch (error) {
      onError(error);
    }
  }

  usePlayerTwoSTT(onResult, onError, onStart) {
    if (this.isListening) this.stop();

    this.isListening = true;
    onStart();

    window.PlayerTwoBridge.startSTT({
      onTranscript: (text, isFinal) => {
        // Player2 STT sends results. isFinal is true for committed text.
        // We simulate interim/final behavior for the UI.
        onResult(text, isFinal ? text : "");
      },
      onError: (err) => {
        this.isListening = false;
        onError(err);
      },
      onStart: () => {
        // Already triggered onStart above, but could sync state here
      },
      onStop: () => {
        this.isListening = false;
      }
    });
  }

  stop() {
    if (PLAYER_TWO_AVAILABLE && this.isListening) {
      window.PlayerTwoBridge.stopSTT();
    }

    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    this.isListening = false;
  }
}
