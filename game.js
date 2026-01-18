import { loadNpcDatabase } from './npc-data.js';

// Player Two Bridge initialization flag
const PLAYER_TWO_AVAILABLE = typeof PlayerTwoBridge !== 'undefined';

// Admin password for edit mode
const ADMIN_PASSWORD = 'Oliver4Games';

// Hoisted static data for voice assignment
const FEMALE_VOICES = [
  'EXAVITQu4vr4xnSDxMaL', // Bella - soft, warm female
  'IKne3meq5aSn9XLyUdCD', // Charlotte - elegant female
  'Erb2aVKbUjmDbZDW0EUl', // Matilda - friendly female
  'ThT5KcBeYPX3keUQqHPh', // Dorothy - clear female
  'Xb7hHmsMSqMt8JDRKZmR', // Elsie - gentle female
  'dIHfPqOYQP7sYx0wBoQj', // Matilda - mature female
  'v7j7aL4aL6yJ3S9K6Z4f', // Sarah - wise female
  'ZLNc5MSGzPsl58pVVI6z', // Sophia - confident female
  'iXJp8G1Y0OKL97s9mUq8', // Domi - energetic female
  'VR6AewLTigWG4xSOukaG', // Arnold - also good for female characters
  'CYw3kZ02Hs0563khs1Fj', // Dave - versatile voice
  'bVMeCyTHy58xNoL34h3p', // Clyde - mature voice
  'ErXwobaYiN019PkySvjV', // Donald - clear voice
  'jsCqWAovK2LkecY7zXl4', // Josh - young voice
  'AIFQyd7GmdmPYYKDGn8P', // Matt - friendly voice
];

const MALE_VOICES = [
  'pNInz6obpgDQGcFmaJgB', // Adam - deep male
  'VR6AewLTigWG4xSOukaG', // Arnold - rough male
  'CYw3kZ02Hs0563khs1Fj', // Dave - friendly male
  'bVMeCyTHy58xNoL34h3p', // Clyde - wise male
  'ErXwobaYiN019PkySvjV', // Donald - confident male
  'jsCqWAovK2LkecY7zXl4', // Josh - young male
  'AIFQyd7GmdmPYYKDGn8P', // Matt - casual male
  '3HO6Pj9B8qLcGHYMSnQF', // Michael - professional male
  'EjaXVo2F1d74l9kC1HMi', // James - strong male
  'PfluYxWGeiGYBoNE9tP7', // William - sophisticated male
  'KOun72jFzG5uUaz8Rw9g', // Lewis - warm male
  'AVM5jL4EX9UY79nz8f4b', // Robert - authoritative male
  'EUl2dcsEgNVTqB9q4eVx', // Sam - upbeat male
  'gK5j0S6w7W7Q9F2cM1pF', // Thomas - thoughtful male
  'x4rC9rTF2y4H7l4G9v5m', // Ethan - modern male
];

const NPC_VOICE_MAP = {
  mira_healer: "en-female",
  byte_glitched_courier: "en-male",
  captain_loop: "en-male",
  daisy_exe: "en-female",
  rustjaw: "en-male",
  worm: "en-male",
  chess_bishop: "en-male",
  pebble: "en-male",
  glitch_exe: "en-female",
  wise_one_gerald: "en-male",
  captain_marcus: "en-male",
  music_android: "en-female",
  superhero_jake: "en-male",
  zombie: "en-male",
  cosmic_merchant: "en-female",
  puzzle_cube: "en-male",
  battle_royale_vendor: "en-male",
  farm_widow: "en-female",
  mimic: "en-male",
  jules: "en-female",
  aria_7_2: "en-female",
  racing_ghost_2: "en-male",
  lost_tetris_block_2: "en-male",
  glitched_priest: "en-male",
  healer: "en-female",
  tower_turret: "en-male",
  rogue_ai: "en-male",
  rich_investor: "en-male",
  sea_activist_2: "en-male",
  harmonix: "en-male",
  wise_one: "en-male",
  goldmask: "en-male",
  silent_couple: "en-male",
  tutorial_bot: "en-male",
  marcus_memory: "en-male",
  sea_activist: "en-male",
  moth_king: "en-male",
  brom: "en-male",
  save_child: "en-female",
  tiko_quest_vendor: "en-male",
  princess_melancholy: "en-female",
  wrestling_ferret: "en-male",
  save_point_veteran: "en-male",
  robot_detective_k47: "en-male",
  marcus_47b_street_loop: "en-male",
  sos_vessel: "en-male",
  halftime_star_bunny: "en-male",
  unknown_fragment_8887: "en-male",
  unknown_fragment_8909: "en-male",
  golden_melting_effigy: "en-male",
  sentient_server: "en-male",
  therapy_specter: "en-male",
  meta_receptionist: "en-female",
  therapist_shadow: "en-male",
  hackathon_judge: "en-female",
  the_therapist: "en-female",
};

// Hoisted static data for gender heuristics
const GENDER_HEURISTIC_FEMALE_NAMES = ['sarah', 'emma', 'sophie', 'chloe', 'ava', 'mia', 'isabella', 'emily', 'grace', 'hannah', 'lily', 'zoe', 'leah', 'lucy', 'ella', 'freya', 'ivy', 'scarlett', 'imogen', 'poppy', 'alice', 'ruby', 'charlie', 'brooke', 'daisy'];
const GENDER_HEURISTIC_MALE_NAMES = ['oliver', 'harry', 'jack', 'jacob', 'noah', 'charlie', 'thomas', 'william', 'james', 'george', 'alfie', 'joshua', 'muhammad', 'harrison', 'leo', 'alexander', 'archie', 'mason', 'ethan', 'joseph', 'freddie', 'samuel', 'ryan'];

// --- Simple Audio Player for UI sounds ---
class AudioPlayer {
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

// --- Speech Recognition System ---
class SpeechRecognitionSystem {
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
    if (PLAYER_TWO_AVAILABLE && (PlayerTwoBridge.authToken || PlayerTwoBridge.clientId)) {
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

    PlayerTwoBridge.startSTT({
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
      PlayerTwoBridge.stopSTT();
    }

    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    this.isListening = false;
  }
}

// --- Web Speech API TTS ---
class WebSpeechTTS {
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

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// Add: race helper with timeout
async function withTimeout(promise, ms) {
  let t; const timeout = new Promise((_, rej) => t = setTimeout(() => rej(new Error('timeout')), ms));
  try { const res = await Promise.race([promise, timeout]); clearTimeout(t); return res; } finally { clearTimeout(t); }
}

/* Add: small utility to debounce frequent UI updates */
function debounce(fn, delay = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

async function preloadBackground(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function loadImage(url, timeout = 15000) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(false); img.src = ''; } }, timeout);
    img.onload = () => { if (!done) { done = true; clearTimeout(t); resolve(true); } };
    img.onerror = () => { if (!done) { done = true; clearTimeout(t); resolve(false); } };
    img.src = url;
  });
}

async function fetchFinalUrlWithTimeout(promptWithSeed, maxAttempts = 25) {
  try {
    const result = await withTimeout(fetchFinalUrl(promptWithSeed, maxAttempts), 12000);
    return result;
  } catch (_) {
    return null;
  }
}

// --- End Image Helpers ---

// Add: in-flight image promise de-duplication cache
const inFlightImages = new Map();

// Add: image loading effects helper
function attachImageLoadingEffects(img) {
  if (!img) return;
  img.classList.add('loading', 'skeleton');
  const onLoad = () => { img.classList.remove('loading', 'skeleton'); img.classList.add('loaded'); img.removeEventListener('load', onLoad); };
  img.addEventListener('load', onLoad);
  img.addEventListener('error', () => { img.classList.remove('loading'); });
  if (img.complete) onLoad();
}

const game = {
  npcs: [],
  currentNPC: null,
  currentNPCId: null, // Player Two NPC ID
  currentDialogueIndex: 0,
  healedNPCs: new Set(),
  unlockedNPCs: new Set(),
  therapistMentalState: 0,
  currentPage: 0,
  journalPages: [],
  radioPlaylist: 'https://youtube.com/playlist?list=PLPug0RGgea9rPoVpu8ytw7dRHLZb4RNZc&si=VqmXrovnWi-y_aj4',
  podcastLink: 'https://youtu.be/dLWHNiePR8g?si=EdHExHPDwkLz7NHi',
  pathSelfTimer: null,
  audioPlayer: new AudioPlayer(),
  speechRecognition: new SpeechRecognitionSystem(),
  ttsSystem: new WebSpeechTTS(),
  startTime: null,
  gameTime: 0,
  timerInterval: null,
  chromaAwardGiven: false,
  previousScreen: 'habitat-view',
  conversationHistory: [],
  turnCount: 0,
  miniGameActive: false,
  mapState: { zoom: 1.0, panX: 0, panY: 0, isPanning: false, lastX: 0, lastY: 0, nodes: [] },
  communityCredits: [],
  creditsEditMode: false,
  editingCreditIndex: null,
  radioSource: null,
  bondScores: {},
  ytPlayer: null,
  ytApiReady: false,
  ttsAudio: null,
  pathSelfFloatVisible: false,
  imageCache: new Map(),
  lastRenderSignature: '',
  menuRenderSignature: '',
  mapRenderScheduled: false,
  unlockedVersion: 0,
  healedVersion: 0,
  generatingResponse: false,
  _menuRenderScheduled: false,
  _skipTyping: false,
  settings: { tts: true, stt: false, reduceMotion: false, dialogueScale: 1 },
  _autosaveTimer: null,
  room: null,
  // Add: per-NPC session notes with breakthrough flag
  npcNotes: {},
  editModeEnabled: false,
  editingNpcIndex: null,
  npcEditsVersion: 0,
  // Add: TTS optimization state
  ttsCache: new Map(),
  ttsQueue: [],
  speaking: false,
  speechListening: false,
  
  // Track if we should show microphone button (only when STT is enabled)
  sttEnabled: false,
  
  // Permission request tracking for "just-in-time" flow
  firstSessionStarted: false,
  permissionsRequested: false,
  permissionRequestInProgress: false,
  textOnlyMode: false,

  showLoader() { document.getElementById('global-loader').style.display = 'flex'; },
  hideLoader() { document.getElementById('global-loader').style.display = 'none'; },

  // Remove old single-provider pollinations fetch in favor of unified pipeline, but keep name for compatibility
  async pollinationsImage(prompt, opts = {}) {
    // Route through unified generateImage to leverage caching
    return this.generateImage(prompt, opts);
  },

  // Optimized: unified, cached image generation (Player Two compatible)
  async generateImage(prompt, opts = {}) {
    // Image generation is disabled; return a neutral fallback image.
    return '/therapy_office.png';
  },

  // Player Two / Browser TTS Implementation
  async callWebsimTTS(params) {
    const { text, voice } = params || {};
    if (!this.settings.tts || !text || this.textOnlyMode) {
      return { url: null };
    }

    try {
      // Resolve a simple voice code for the NPC (e.g., "en-male"/"en-female")
      const character = this.currentNPC;
      const voiceCode = voice || this.getVoiceForNPC(character?.id);

      // Try Player Two TTS if available
      if (PLAYER_TWO_AVAILABLE && PlayerTwoBridge.getVoiceIdForCharacter) {
        const p2VoiceId = PlayerTwoBridge.getVoiceIdForCharacter(character);
        try {
          const audioUrl = await PlayerTwoBridge.speakText(text, p2VoiceId, { speed: 0.95 });
          if (audioUrl) {
            return { url: audioUrl };
          }
        } catch (err) {
          console.warn('Player Two TTS failed, falling back:', err);
        }
      }

      // Fallback to browser TTS if Player Two TTS fails or is unavailable
      return await this.fallbackBrowserTTS(text);
    } catch (error) {
      console.warn('TTS failed, falling back to browser TTS:', error);
      return await this.fallbackBrowserTTS(text);
    }
  },

  /**
   * Prompt user for Player Two Login
   */
  async promptForLogin() {
    if (!PlayerTwoBridge.clientId) return;

    console.log("Starting Player Two Authentication...");
    const token = await PlayerTwoBridge.login(PlayerTwoBridge.clientId, (authData) => {
      // Create a modal to show the code
      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.id = 'auth-modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; text-align: center;">
          <div class="modal-header"><h2>Connect Player Two Account</h2></div>
          <div class="modal-body">
            <p>To enable AI features, please link your account:</p>
            <p style="font-size: 1.2rem; margin: 1rem 0;">1. Go to: <a href="${authData.verification_uri_complete}" target="_blank" style="color: #64ffda;">${authData.verification_uri}</a></p>
            <p style="font-size: 1.2rem; margin: 1rem 0;">2. Enter Code: <strong style="font-size: 1.5rem; color: #64ffda; border: 1px dashed #64ffda; padding: 0.2rem 0.5rem;">${authData.user_code}</strong></p>
            <p><small>Waiting for confirmation...</small></p>
            <div id="auth-spinner" class="spinner" style="margin: 1rem auto;"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    });

    if (token) {
      const modal = document.getElementById('auth-modal');
      if (modal) {
        modal.innerHTML = `
          <div class="modal-content" style="max-width: 500px; text-align: center;">
            <div class="modal-header"><h2>Success!</h2></div>
            <div class="modal-body">
              <p>Account connected successfully.</p>
            </div>
          </div>
        `;
        setTimeout(() => modal.remove(), 2000);
      }
      this.toast("Player Two Account Connected!");
    } else {
      const modal = document.getElementById('auth-modal');
      if (modal) modal.remove();
      this.toast("Authentication failed or timed out.");
    }
  },

  // Fallback to browser TTS if Websim TTS fails
  async fallbackBrowserTTS(text) {
    if (!('speechSynthesis' in window)) {
      return { url: null };
    }
    
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Find a suitable voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) || 
                           voices.find(v => v.lang.startsWith('en')) ||
                           voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      speechSynthesis.speak(utterance);
      return { url: null };
    } catch (error) {
      console.warn('Browser TTS also failed:', error);
      return { url: null };
    }
  },

  // Comprehensive 11 Labs voice library for 55+ characters with verified voice IDs
  getVoiceIdForCharacter(character) {
    if (!character) return 'EXAVITQu4vr4xnSDxMaL'; // Default voice (Bella - female)
    
    const characterIndex = this.getCharacterIndex(character);
    const gender = this.getCharacterGender(character);
    
    // If we have the actual NPC data, try to find a specific voice for this character
    if (character.name && this.npcs) {
      // Create a hash from character name for consistent voice assignment
      const nameHash = this.hashString(character.name);
      const voiceIndex = nameHash % (gender === 'male' ? MALE_VOICES.length : FEMALE_VOICES.length);
      return gender === 'male' ? MALE_VOICES[voiceIndex] : FEMALE_VOICES[voiceIndex];
    }
    
    // Fallback: use character index to ensure variety across 55 characters
    const voicePool = gender === 'male' ? MALE_VOICES : FEMALE_VOICES;
    return voicePool[characterIndex % voicePool.length];
  },

  // Simple string hash function for consistent voice assignment
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  },

  // Get character's index for consistent voice assignment
  getCharacterIndex(character) {
    if (!this.npcs || this.npcs.length === 0) return 0;
    const index = this.npcs.findIndex(npc => npc.id === character.id || npc.name === character.name);
    return index >= 0 ? index : 0;
  },

  // Determine character gender from name or other indicators
  getCharacterGender(character) {
    const name = character.name ? character.name.toLowerCase() : '';
    
    if (GENDER_HEURISTIC_FEMALE_NAMES.some(n => name.includes(n))) return 'female';
    if (GENDER_HEURISTIC_MALE_NAMES.some(n => name.includes(n))) return 'male';
    
    // If we can't determine, assume neutral/female
    return 'female';
  },

  // Keep old performTTS method for backward compatibility, but redirect to Websim
  async performTTS(params) {
    try {
      const res = await this.callWebsimTTS(params);
      return res || { url: null };
    } catch (error) {
      console.warn('TTS failed:', error);
      // Fallback to browser TTS if available
      const text = params?.text || '';
      if (text) {
        try {
          const p2Voice = params?.voice || this.getVoiceForNPC(this.currentNPC?.id);
          const voiceName = this.getVoiceFromMap(p2Voice);
          await this.ttsSystem.speak(text, voiceName);
        } catch (_) {}
      }
      return { url: null };
    }
  },

  getVoiceFromMap(p2Voice) {
    // Convert Player Two voice names to Web Speech API voice names
    const voiceMap = {
      'en-female': 'female',  // Will try to find female voices
      'en-male': 'male',      // Will try to find male voices
    };
    return voiceMap[p2Voice] || 'default';
  },

  init() {
    this.loadCommunityCredits();
    this.renderCommunityCredits();
    this.npcs = loadNpcDatabase();
    
    // Check Authentication
    if (PLAYER_TWO_AVAILABLE && !PlayerTwoBridge.authToken && PlayerTwoBridge.clientId) {
      this.promptForLogin();
    }

    // Reorder NPCs first
    this.reorderAndRenumber();
    
    // Load NPC edits after reordering to ensure they're applied to the final array
    this.loadNpcEdits();
    
    // Initialize STT enabled state based on settings
    this.sttEnabled = this.settings.stt;
    document.getElementById('send-response-btn').addEventListener('click', () => this.sendPlayerResponse());
    
    // Enhanced player response input with speech recognition
    const playerResponse = document.getElementById('player-response');
    if (playerResponse) {
      playerResponse.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendPlayerResponse(); });
      playerResponse.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.sendPlayerResponse(); } });
    }
    
    document.getElementById('conclude-session-btn').addEventListener('click', () => this.concludeSession());
    
    // Add speech recognition button
    this.addSpeechRecognitionButton();
    
    const radioBtnEl = document.getElementById('radio-btn'); if (radioBtnEl) radioBtnEl.addEventListener('click', () => this.openRadio());
    const pathBtnEl = document.getElementById('path-to-self-btn'); if (pathBtnEl) pathBtnEl.addEventListener('click', () => this.openPathToSelf());
    const genBtn = document.getElementById('creator-generate-btn'); if (genBtn) genBtn.addEventListener('click', () => this.generateCustomNpc());

    // Close hamburger menu when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('hamburger-dropdown');
      const hamburger = document.getElementById('hamburger-btn');
      if (dropdown && dropdown.classList.contains('active')) {
        if (!dropdown.contains(e.target) && !hamburger.contains(e.target)) {
          dropdown.classList.remove('active');
        }
      }
    });
    const randBtn = document.getElementById('creator-randomize-btn'); if (randBtn) randBtn.addEventListener('click', () => this.generateRandomNpc());
    const importBtn = document.getElementById('json-npc-import-btn'); if (importBtn) importBtn.addEventListener('click', () => this.importNpcFromJson());
    
    // Drag & drop JSON into the textarea
    const jsonTa = document.getElementById('json-npc-input');
    if (jsonTa) {
      ['dragover','dragenter'].forEach(ev=>jsonTa.addEventListener(ev,(e)=>{ e.preventDefault(); jsonTa.classList.add('drop-hover'); }));
      ;['dragleave','dragend','drop'].forEach(ev=>jsonTa.addEventListener(ev,()=>jsonTa.classList.remove('drop-hover')));
      jsonTa.addEventListener('drop', async (e) => {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0]; if (!f) return;
        if (f.type === 'application/json' || f.name.toLowerCase().endsWith('.json')) { try { jsonTa.value = await f.text(); this.toast('JSON loaded. Click IMPORT NPC.'); } catch(_) { this.toast('Could not read JSON file.'); } }
      });
    }
    document.querySelectorAll('.btn').forEach(btn => btn.addEventListener('click', () => this.audioPlayer.playSound('confirm')));
    document.querySelectorAll('.send-btn, .map-btn').forEach(btn => btn.addEventListener('click', () => this.audioPlayer.playSound('confirm')));
    this.initMapControls();
    
    /* Skip typing on dialogue click or Space */
    const dlg = document.querySelector('.dialogue-box');
    if (dlg) dlg.addEventListener('click', () => { this._skipTyping = true; });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.getElementById('therapy-session').classList.contains('active')) this._skipTyping = true;
    });
    
    const fr = document.getElementById('floating-radio-btn'); if (fr) fr.addEventListener('click', () => this.openRadio());
    const psfClose = document.getElementById('psf-close-btn'); if (psfClose) psfClose.addEventListener('click', () => this.closePathSelfFloat());
    const psfToggle = document.getElementById('psf-toggle-btn'); if (psfToggle) psfToggle.addEventListener('click', () => this.togglePathSelfFloat && this.togglePathSelfFloat());
    const portraitEl = document.getElementById('npc-portrait'); if (portraitEl) portraitEl.addEventListener('click', () => this.togglePatientBio());
    const bioCloseBtn = document.getElementById('pbw-close-btn'); if (bioCloseBtn) bioCloseBtn.addEventListener('click', () => this.togglePatientBio(false));
    
    const menuSearch = document.getElementById('menu-search');
    if (menuSearch) {
      const debouncedMenu = debounce(() => this.scheduleUpdateMenuRosterView(), 200);
      menuSearch.addEventListener('input', debouncedMenu);
      // Enter to start first unlocked match
      menuSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const items = this._lastMenuItems || [];
          const match = items.find(({ index }) => this.unlockedNPCs.has(index));
          if (match) this.startSession(match.index);
        }
      });
      this.scheduleUpdateMenuRosterView();
    }
    
    this.ttsAudio = new Audio(); this.ttsAudio.volume = 1.0;
    
    /* Add: responsive map + input hints + titles + first-run tips */
    const debouncedMap = debounce(() => this.scheduleRenderConnectionMap(), 150);
    window.addEventListener('resize', debouncedMap);
    const pr = document.getElementById('player-response');
    if (pr) {
      pr.addEventListener('focus', () => pr.placeholder = 'Type your response… or use the microphone button');
      pr.addEventListener('blur', () => pr.placeholder = 'Type your response...');
    }
    this.setToolbarTitles();
    this.startHints();
    // Show CONTINUE if autosave exists
    const contBtn = document.getElementById('continue-btn');
    if (contBtn) {
      if (this.hasAutosave()) {
        contBtn.style.display = 'inline-block';
        contBtn.onclick = () => this.continueAutosave();
      } else contBtn.style.display = 'none';
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { const activeModal = document.querySelector('.modal.active'); if (activeModal) this.closeModal(activeModal.id); }
      else if (e.key.toLowerCase() === 'j') this.showJournal();
      else if (e.key.toLowerCase() === 'c') this.showCredits();
      else if (e.key.toLowerCase() === 'r') this.openRadio();
      else if (e.key.toLowerCase() === 'm') this.showScreen('main-menu');
      else if (e.key.toLowerCase() === 's') { this.saveGame(); document.getElementById('save-modal').classList.add('active'); }
      else if (e.key.toLowerCase() === 'g') this.showCollectibles();
      else if (e.key.toLowerCase() === 'v') this.toggleSpeechRecognition();
    });
    // Add skip typing click
    const skipBtn = document.getElementById('skip-typing-btn'); if (skipBtn) skipBtn.addEventListener('click', () => { this._skipTyping = true; });
    // Settings bindings
    this.loadSettings();
    this.applySettings();
    const ttsEl = document.getElementById('setting-tts'); if (ttsEl) ttsEl.checked = !!this.settings.tts;
    const sttEl = document.getElementById('setting-stt'); if (sttEl) sttEl.checked = !!this.settings.stt;
    const rmEl = document.getElementById('setting-reduce-motion'); if (rmEl) rmEl.checked = !!this.settings.reduceMotion;
    const dsEl = document.getElementById('setting-dialogue-scale'); if (dsEl) dsEl.value = this.settings.dialogueScale;

    // --- UX: Command Palette + '/' focus + quick reply keys ---
    this.bindCommandPalette();

    // Setup autosave on unload
    window.addEventListener('beforeunload', () => {
      try { this.autosave(); } catch (_) {}
    });

    // Setup permission request modal events
    this.setupPermissionModalEvents();

    // Multiplayer
    this.initMultiplayer();
    
    // Cleanup Player Two NPCs on page unload
    window.addEventListener('beforeunload', async () => {
      if (PLAYER_TWO_AVAILABLE) {
        await PlayerTwoBridge.killAllNPCs();
      }
    });
  },

  // Add speech recognition button to UI (only if STT is enabled)
  addSpeechRecognitionButton() {
    // Only add the button if STT is enabled in settings
    if (!this.sttEnabled || !this.settings.stt) return;
    
    const inputArea = document.getElementById('player-input-area');
    if (!inputArea) return;

    const micButton = document.createElement('button');
    micButton.id = 'speech-recognition-btn';
    micButton.className = 'mic-btn';
    micButton.title = 'Start speech recognition (V)';
    micButton.innerHTML = '🎤';
    micButton.style.cssText = `
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: #444;
      border: none;
      color: white;
      padding: 8px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.3s ease;
    `;

    // Make the input relative positioned to contain the button
    const inputField = document.getElementById('player-response');
    if (inputField) {
      inputField.style.position = 'relative';
      inputField.style.paddingRight = '50px';
      inputField.parentElement.appendChild(micButton);
      
      micButton.addEventListener('click', () => this.toggleSpeechRecognition());
    }
  },

  // Toggle speech recognition
  toggleSpeechRecognition() {
    if (this.textOnlyMode) {
      this.toast('Speech recognition unavailable in text-only mode');
      return;
    }
    
    if (!this.settings.stt) {
      this.toast('Speech-to-text is disabled in settings');
      return;
    }

    if (this.speechListening) {
      this.stopSpeechRecognition();
    } else {
      this.startSpeechRecognition();
    }
  },

  // Start speech recognition
  startSpeechRecognition() {
    if (!this.speechRecognition.supported) {
      this.toast('Speech recognition not supported in this browser');
      return;
    }

    const input = document.getElementById('player-response');
    if (!input) return;

    const micButton = document.getElementById('speech-recognition-btn');
    
    this.speechRecognition.start(
      // onResult
      (interimTranscript, finalTranscript) => {
        if (interimTranscript) {
          input.value = interimTranscript;
          micButton.style.background = '#e74c3c';
          micButton.innerHTML = '🔴';
        }
      },
      // onError
      (error) => {
        console.warn('Speech recognition error:', error);
        this.toast('Speech recognition error: ' + error.message);
        this.stopSpeechRecognition();
      },
      // onStart
      () => {
        this.speechListening = true;
        input.focus();
        micButton.style.background = '#e74c3c';
        micButton.innerHTML = '🔴';
        this.toast('Listening... Speak now');
      }
    );
  },

  // Stop speech recognition
  stopSpeechRecognition() {
    this.speechRecognition.stop();
    this.speechListening = false;
    
    const micButton = document.getElementById('speech-recognition-btn');
    if (micButton) {
      micButton.style.background = '#444';
      micButton.innerHTML = '🎤';
    }
  },

  newGame() {
    this.healedNPCs.clear();
    this.unlockedVersion = 0; this.healedVersion = 0;
    const finalIds = new Set(['hackathon_judge','meta_receptionist','therapist_shadow','the_therapist']);
    this.unlockedNPCs = new Set(this.npcs.map((n,i)=>({n,i})).filter(item=>!finalIds.has(item.n.id)).map(item=>item.i));
    this.therapistMentalState = 0; this.collectibles = []; this.currentPage = 0;
    this.startTime = Date.now(); this.gameTime = 0; this.chromaAwardGiven = false;
    this.communityCredits = []; this.saveCommunityCredits(); this.renderCommunityCredits();
    this.resetMapView(); this.startTimer(); this.showScreen('main-menu'); this.updateMenuRosterView(); this.updateStats();
    
    // Reset permission-related flags for new game
    this.firstSessionStarted = false;
    this.permissionsRequested = false;
    this.permissionRequestInProgress = false;
    this.textOnlyMode = false;

    // Re‑enable TTS on fresh game and clear any stored text‑only preference
    this.settings.tts = true;
    this.settings.stt = this.settings.stt || false;
    try {
      localStorage.setItem('npcTherapySettings', JSON.stringify(this.settings));
      localStorage.removeItem('npcTherapyTextOnlyMode');
    } catch (_) {}

    // start autosave loop
    this.startAutosave();
  },

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (!target) { console.warn(`showScreen: Screen with id "${screenId}" not found.`); return; }
    target.classList.add('active');
    if (screenId === 'main-menu') document.getElementById('menu-search')?.focus();
    if (screenId === 'therapy-session') {
      document.getElementById('player-response')?.focus();
      this.updateSpeechButtonVisibility();
    }
  },

  // Show/hide speaking indicator (visual feedback when NPCs are speaking)
  showSpeakingIndicator(show) {
    const indicator = document.getElementById('speaking-indicator');
    if (indicator) {
      indicator.style.display = show ? 'block' : 'none';
    }
  },

  updateSpeechButtonVisibility() {
    const micButton = document.getElementById('speech-recognition-btn');
    if (micButton) {
      micButton.style.display = this.settings.stt && this.speechRecognition.supported ? 'block' : 'none';
    }
  },

  startSession(npcIndex) {
    this.currentNPC = this.npcs[npcIndex]; this.currentNPCIndex = npcIndex; this.turnCount = 0;
    this.currentNPCId = null; // Will be set when spawning
    const thoughtBubble = document.getElementById('npc-thought-bubble'); if (thoughtBubble) thoughtBubble.style.display = 'none';
    if (this.bondScores[this.currentNPC.id] == null) this.bondScores[this.currentNPC.id] = 0;
    document.getElementById('session-npc-name').textContent = this.currentNPC.name;
    const habitat = document.getElementById('habitat-bg');
    if (habitat) {
      habitat.classList.add('fade-in'); habitat.classList.remove('bg-ready');
      const bgUrl = this.currentNPC.officeImage || this.currentNPC.habitat;
      preloadBackground(bgUrl).then((ok) => {
        habitat.style.backgroundImage = ok ? `url(${bgUrl})` : '';
        requestAnimationFrame(() => habitat.classList.add('bg-ready'));
      });
    }
    const portraitEl = document.getElementById('npc-portrait');
    if (portraitEl) { portraitEl.loading = 'lazy'; portraitEl.decoding = 'async'; portraitEl.src = this.currentNPC.habitat; portraitEl.style.display = 'block'; attachImageLoadingEffects(portraitEl); }
    this.conversationHistory = [];
    // Stop any ongoing TTS when a new session starts
    if (this.ttsAudio && !this.ttsAudio.paused) { 
      this.ttsAudio.pause(); 
      this.ttsAudio.currentTime = 0; 
    }
    this.ttsQueue = []; // clear pending speech
    this.speaking = false;
    this.showSpeakingIndicator(false);
    this.conversationHistory.push({ role:"system", content:`You are roleplaying as an NPC in a therapy session.\nDossier: ${JSON.stringify(this.currentNPC)}\nStay strictly in character as the patient. Reply in 1–3 sentences, reflective and specific to your crisis and origin. Occasionally reference imagery from your habitat/office to ground the scene. Do not give therapy; you are receiving it.` });
    document.getElementById('patient-bio-window').style.display = 'none';
    
    // Check if this is the first session and trigger permission request
    if (!this.firstSessionStarted && !this.permissionsRequested && !this.permissionRequestInProgress) {
      this.firstSessionStarted = true;
      this.showPermissionRequestModal();
      return; // Exit here, continueSession will be called after permissions
    }
    
    // Spawn NPC on Player Two if available
    if (PLAYER_TWO_AVAILABLE) {
      this.spawnCurrentNPC().catch(err => {
        console.warn('Failed to spawn NPC on Player Two:', err);
      });
    // Register function handler
    PlayerTwoBridge.registerFunctionHandler((call) => this.handleNpcFunctionCall(call));
    }
    
    this.showDialogue(this.currentNPC.opening_statement);
    this.showScreen('therapy-session');
    document.getElementById('conclude-session-btn').style.display = 'none';
    document.getElementById('player-input-area').style.display = 'flex';
    this.updateTrustUI();
    if (this.room) { try { this.room.updatePresence({ currentNPC: this.currentNPC.id }); } catch(_){} }
    // Render shared insights for this NPC on session start
    this.renderSharedInsights();
    this.updateSpeechButtonVisibility();
  },

  getVoiceForNPC(id) {
    return NPC_VOICE_MAP[id] || "en-male";
  },

  // Enhanced speak method for working TTS
  async speak(text, npcId) {
    if (!this.settings.tts || !text || this.textOnlyMode) return;
    
    // Get the NPC data to select appropriate ElevenLabs voice
    const npc = this.npcs.find(n => n.id === npcId);
    const voice = this.getVoiceIdForCharacter(npc);
    
    // Normalize and clamp length to avoid long-generation stalls
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, 280);
    this.enqueueSpeak({ text: clean, voice });
    // Add visual feedback
    this.showSpeakingIndicator(true);
  },

  enqueueSpeak(item) {
    // If TTS disabled, clear queue
    if (!this.settings.tts) { this.ttsQueue = []; this.showSpeakingIndicator(false); return; }
    this.ttsQueue.push(item);
    // If already speaking, let current finish; otherwise process now
    if (!this.speaking) this.processSpeakQueue();
  },

  async processSpeakQueue() {
    if (this.speaking) return;
    this.speaking = true;
    try {
      while (this.ttsQueue.length) {
        const { text, voice } = this.ttsQueue.shift();
        
        // Try Player Two TTS first (high-quality natural voices)
        const url = await this._getTtsUrl(text, voice);
        if (url) {
          try {
            // Create and play audio element
            this.ttsAudio = new Audio(url);
            this.ttsAudio.volume = 0.8;
            await this.ttsAudio.play();
          } catch (err) {
            console.warn('Player Two TTS playback error:', err);
            // Fallback to browser TTS if Player Two fails
            await this.useWebSpeechTTS(text, voice);
          }
        } else {
          // If Player Two TTS fails completely, fallback to browser TTS
          const success = await this.useWebSpeechTTS(text, voice);
          if (!success) {
            console.warn('Both Player Two and browser TTS failed for text:', text);
          }
        }
        
        // If TTS got disabled mid-queue, stop processing
        if (!this.settings.tts) break;
      }
    } finally {
      this.speaking = false;
      this.showSpeakingIndicator(false);
    }
  },

  async useWebSpeechTTS(text, voice) {
    if (!('speechSynthesis' in window)) return false;
    
    try {
      // Cancel any current speech
      speechSynthesis.cancel();
      
      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Find and set the voice
      const voices = speechSynthesis.getVoices();
      let selectedVoice = null;
      
      if (voice) {
        // Try to find a voice that matches the voice ID or name
        selectedVoice = voices.find(v => v.name === voice || v.voiceURI === voice);
      }
      
      if (!selectedVoice) {
        // Fallback to English female voice
        selectedVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) ||
                       voices.find(v => v.lang.startsWith('en')) ||
                       voices[0];
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      // Set speech parameters
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      
      // Show speaking indicator
      this.showSpeakingIndicator(true);
      
      // Return promise that resolves when speech is finished
      return new Promise((resolve, reject) => {
        utterance.onend = () => {
          this.showSpeakingIndicator(false);
          resolve(true);
        };
        utterance.onerror = (error) => {
          this.showSpeakingIndicator(false);
          console.warn('Web Speech TTS error:', error);
          resolve(false);
        };
        
        // Start speaking
        speechSynthesis.speak(utterance);
      });
      
    } catch (error) {
      console.warn('Web Speech TTS failed:', error);
      return false;
    }
  },

  async _getTtsUrl(text, voice) {
    const key = `${voice}::${text}`;
    if (this.ttsCache.has(key)) return this.ttsCache.get(key);
    try {
      // Call our unified TTS handler to avoid recursion
      const res = await withTimeout(this.callWebsimTTS({ text, voice }), 8000);
      const url = res && res.url ? res.url : null;
      if (url) this.ttsCache.set(key, url);
      return url;
    } catch (e) {
      console.warn('TTS generation failed:', e);
      return null;
    }
  },

  showSpeakingIndicator(show) {
    const speaker = document.getElementById('speaker');
    if (!speaker) return;
    if (show) {
      speaker.style.opacity = '1';
      speaker.style.animation = 'pulse 1.5s ease-in-out infinite';
    } else {
      speaker.style.opacity = '0.7';
      speaker.style.animation = 'none';
    }
  },

  async generateNpcResponse() {
    if (this.generatingResponse) return;
    this.generatingResponse = true;
    const dialogueText = document.getElementById('dialogue');
    const choicesContainer = document.getElementById('choices');
    const typingIndicator = document.getElementById('typing-indicator');
    const playerInputArea = document.getElementById('player-input-area');
    dialogueText.textContent = ''; choicesContainer.innerHTML = ''; typingIndicator.style.display = 'block'; playerInputArea.style.display = 'none';
    
    // If Player Two is available, use it for NPC responses
    if (PLAYER_TWO_AVAILABLE && this.currentNPCId) {
      try {
        // Ensure NPC is spawned
        if (!this.currentNPCId) {
          await this.spawnCurrentNPC();
        }
        
        const playerMessage = this.lastPlayerMessage;
        const response = await PlayerTwoBridge.chatWithNPC(
          this.currentNPCId,
          playerMessage,
          this.getGameStateContext()
        );
        
        const responseText = response.message;
        this.conversationHistory.push({ role: 'assistant', content: responseText });
        
        // Only speak if TTS is enabled and not in text-only mode
        if (this.settings.tts && !this.textOnlyMode) {
          this.speak(responseText, this.currentNPC?.id);
        }
        
        this.typewriter(dialogueText, responseText, () => { 
          typingIndicator.style.display = 'none'; 
          playerInputArea.style.display = 'flex'; 
          document.getElementById('player-response').focus(); 
          this.generateQuickReplies(); 
        });
        
      } catch (error) {
        console.error("Player Two NPC response failed, falling back:", error);
        await this.generateNpcResponseFallback();
      }
    } else {
      // Fallback for when Player Two is not available
      await this.generateNpcResponseFallback();
    }
    
    this.generatingResponse = false;
  },
  
  // Fallback response generation when Player Two is unavailable
  async generateNpcResponseFallback() {
    const dialogueText = document.getElementById('dialogue');
    const choicesContainer = document.getElementById('choices');
    const typingIndicator = document.getElementById('typing-indicator');
    const playerInputArea = document.getElementById('player-input-area');
    
    try {
      const historyForAI = this.conversationHistory.slice(-10);
      const bond = this.bondScores[this.currentNPC?.id] || 0;
      const bondCue = { role:"system", content:`Meta note for the patient roleplay: Your trust toward the therapist is ${bond}/10. If higher, be slightly more open, reflective, and hopeful; if low, be guarded and terse.` };
      
      const completion = await PlayerTwoBridge.createCompletion(
        [historyForAI[0] || {role:"system", content:""}, bondCue, ...historyForAI.slice(1)],
        { temperature: 0.7, maxTokens: 200 }
      );
      
      const responseText = completion;
      this.conversationHistory.push({ role: 'assistant', content: responseText });
      
      if (this.settings.tts && !this.textOnlyMode) {
        this.speak(responseText, this.currentNPC?.id);
      }
      
      this.typewriter(dialogueText, responseText, () => { 
        typingIndicator.style.display = 'none'; 
        playerInputArea.style.display = 'flex'; 
        document.getElementById('player-response').focus(); 
        this.generateQuickReplies(); 
      });
      
    } catch (error) {
      console.error("Fallback generation failed:", error);
      const fallbackText = "I... I don't know what to say. The static is loud today.";
      this.conversationHistory.push({ role: 'assistant', content: fallbackText });
      
      if (this.settings.tts && !this.textOnlyMode) {
        this.speak(fallbackText, this.currentNPC?.id);
      }
      
      this.typewriter(dialogueText, fallbackText, () => { 
        typingIndicator.style.display = 'none'; 
        playerInputArea.style.display = 'flex'; 
        document.getElementById('player-response').focus(); 
      });
    }
  },

  async generateQuickReplies() {
    const container = document.getElementById('quick-replies');
    if (!container || !this.currentNPC) return;
    container.innerHTML = '';
    const history = this.conversationHistory.slice(-8);
    
    // Use Player Two if available
    if (PLAYER_TWO_AVAILABLE) {
      return (async () => {
        try {
          const completion = await PlayerTwoBridge.createCompletion([
            { role:"system", content:"Suggest up to 3 brief, empathetic therapist replies (2–12 words) aligned with reflective listening; JSON array of strings only." },
            ...history
          ], { temperature: 0.8, maxTokens: 100 });
          
          const suggestions = JSON.parse(completion) || [];
          container.innerHTML = '';
          suggestions.slice(0,3).forEach((s, i) => {
            const b = document.createElement('button');
            b.className = 'qr-btn';
            b.dataset.key = String(i+1);
            b.textContent = s;
            b.onclick = () => { const input = document.getElementById('player-response'); input.value = s; this.sendPlayerResponse(); };
            container.appendChild(b);
          });
          if (!container.childElementCount) container.innerHTML = '';
        } catch (e) { 
          console.warn('Quick reply generation failed:', e);
          container.innerHTML = ''; 
        }
      })();
    }
    
    // Fallback when Player Two unavailable
    return (async () => {
      try {
        const completion = await PlayerTwoBridge.createCompletion([
          { role:"system", content:"Suggest up to 3 brief, empathetic therapist replies (2–12 words) aligned with reflective listening; JSON array of strings only." },
          ...history
        ], { temperature: 0.8, maxTokens: 100 });
        
        const suggestions = JSON.parse(completion) || [];
        container.innerHTML = '';
        suggestions.slice(0,3).forEach((s, i) => {
          const b = document.createElement('button');
          b.className = 'qr-btn';
          b.dataset.key = String(i+1);
          b.textContent = s;
          b.onclick = () => { const input = document.getElementById('player-response'); input.value = s; this.sendPlayerResponse(); };
          container.appendChild(b);
        });
        if (!container.childElementCount) container.innerHTML = '';
      } catch (e) { container.innerHTML = ''; }
    })();
  },

  addRorschachChoice() {
    const choicesContainer = document.getElementById('choices');
    const rorschachBtn = document.createElement('button');
    rorschachBtn.className = 'choice-btn';
    rorschachBtn.textContent = "[Use Rorschach Test]";
    rorschachBtn.onclick = () => { this.audioPlayer.playSound('confirm'); this.startRorschachTest(); choicesContainer.innerHTML = ''; };
    choicesContainer.innerHTML = '';
    choicesContainer.appendChild(rorschachBtn);
  },

  startRorschachTest() {
    this.showScreen('rorschach-test');
    document.getElementById('rorschach-analysis').innerHTML = '';
    document.getElementById('rorschach-input').value = '';
    document.getElementById('rorschach-input').disabled = true;
    document.getElementById('submit-btn').disabled = true;
    this.currentUploadedPhoto = null;
  },

  exitRorschach() { this.showScreen('therapy-session'); },

  handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('Image file is too large. Please select an image under 10MB.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageContainer = document.getElementById('rorschach-image-container');
      imageContainer.innerHTML = `
        <div class="uploaded-photo-container">
          <img src="${e.target.result}" alt="Uploaded photo" style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);">
        </div>
      `;
      
      // Enable the input and submit button
      document.getElementById('rorschach-input').disabled = false;
      document.getElementById('submit-btn').disabled = false;
      document.getElementById('rorschach-input').focus();
      
      // Store the image data for potential AI analysis
      this.currentUploadedPhoto = e.target.result;
    };
    
    reader.readAsDataURL(file);
    document.getElementById('rorschach-analysis').innerHTML = '';
  },

  clearPhoto() {
    const imageContainer = document.getElementById('rorschach-image-container');
    imageContainer.innerHTML = `
      <div class="photo-upload-area">
        <input type="file" id="photo-upload" accept="image/*" style="display: none;" onchange="game.handlePhotoUpload(event)">
        <button class="btn" onclick="document.getElementById('photo-upload').click()">📷 Upload Photo</button>
        <p class="upload-hint">Click to upload any image (JPG, PNG, GIF)</p>
      </div>
    `;
    
    document.getElementById('rorschach-input').value = '';
    document.getElementById('rorschach-input').disabled = true;
    document.getElementById('submit-btn').disabled = true;
    document.getElementById('rorschach-analysis').innerHTML = '';
    this.currentUploadedPhoto = null;
    
    // Reset the file input
    document.getElementById('photo-upload').value = '';
  },

  async submitRorschach() {
    const input = document.getElementById('rorschach-input').value.trim();
    if (!input) { alert("Please enter what the patient thinks about the image."); this.audioPlayer.playSound('error'); return; }
    
    const analysisContainer = document.getElementById('rorschach-analysis');
    analysisContainer.innerHTML = 'Analyzing patient\'s response...';
    
    try {
      const systemPrompt = `You are a therapist analyzing a patient's response to an image they were shown during a therapy session. The patient is an NPC from a video game with a specific existential crisis.
Patient's Crisis: ${this.currentNPC?.crisis}
Patient's Analysis of Image: "${input}"
Provide a brief, one-paragraph therapeutic analysis connecting their interpretation to their core crisis and personality. Speak in a gentle, insightful tone. Focus on what their interpretation reveals about their psychological state and worldview. Do not give a diagnosis.`;
      
      let completion;
      if (PLAYER_TWO_AVAILABLE) {
        completion = await PlayerTwoBridge.createCompletion([{ role: "system", content: systemPrompt }], { temperature: 0.7, maxTokens: 200 });
      } else {
        completion = await PlayerTwoBridge.createCompletion([{ role: "system", content: systemPrompt }], { temperature: 0.7, maxTokens: 200 });
      }
      
      const analysisText = completion;
      analysisContainer.textContent = analysisText;
      
      const analysisSummary = `(Therapist's Note: Conducted an image analysis test. Patient analyzed: "${input}". My analysis was: "${analysisText}")`;
      this.conversationHistory.push({ role: 'system', content: analysisSummary });
      this.bondScores[this.currentNPC?.id] = Math.min(10, (this.bondScores[this.currentNPC?.id] || 0) + 1);
      
      // Disable the form after successful submission
      document.getElementById('rorschach-input').disabled = true;
      document.getElementById('submit-btn').disabled = true;
      
    } catch (error) {
      console.error("Failed to analyze patient response:", error);
      analysisContainer.textContent = 'Analysis could not be completed at this time.';
    }
  },

  typewriter(element, text, callback) {
    let i = 0; element.textContent = '';
    const prefersReduce = this.settings.reduceMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const speed = prefersReduce ? 0 : 24;
    if (speed === 0 || this._skipTyping) { this._skipTyping = false; element.textContent = text; if (callback) callback(); return; }
    function type() {
      if (game._skipTyping) { game._skipTyping = false; element.textContent = text; if (callback) callback(); return; }
      if (i < text.length) { element.textContent += text.charAt(i++); setTimeout(type, speed); } else if (callback) { callback(); }
    }
    type();
  },

  async showDialogue(openingText) {
    const dialogueText = document.getElementById('dialogue');
    document.getElementById('speaker').textContent = 'PATIENT';
    this.conversationHistory.push({ role: 'assistant', content: openingText });
    // Only speak if TTS is enabled and not in text-only mode
    if (this.settings.tts && !this.textOnlyMode) {
      this.speak(openingText, this.currentNPC.id);
    }
    this.typewriter(dialogueText, openingText, () => { document.getElementById('player-input-area').style.display = 'flex'; document.getElementById('player-response').focus(); });
  },

  sendPlayerResponse() {
    const input = document.getElementById('player-response');
    const text = input.value.trim();
    if (!text) { this.audioPlayer.playSound('error'); return; }
    
    // Stop speech recognition if active
    if (this.speechListening) {
      this.stopSpeechRecognition();
    }
    
    const qr = document.getElementById('quick-replies'); if (qr) qr.innerHTML = '';
    this.conversationHistory.push({ role: 'user', content: text });
    input.value = ''; this.turnCount++;
    if (this.turnCount === 2) this.addRorschachChoice();
    if (this.turnCount === 3 || this.turnCount === 6) this.generateThoughtImage();
    if (this.turnCount >= 3 || this.bondScores[this.currentNPC.id] >= 3) document.getElementById('conclude-session-btn').style.display = 'block';
    this.updateBondWithAI(text).then(() => {
      if (this.currentNPC.id === 'zombie' && this.turnCount === 2 && !this.miniGameActive) { this.startMemoryGame(); return; }
      if (this.turnCount === 3 || this.turnCount === 6) this.generateThoughtImage();
      if (this.turnCount >= 3 || this.bondScores[this.currentNPC.id] >= 3) document.getElementById('conclude-session-btn').style.display = 'block';
      this.generateNpcResponse();
    });
  },

  async concludeSession() {
    const typingIndicator = document.getElementById('typing-indicator');
    typingIndicator.style.display = 'block';
    document.getElementById('player-input-area').style.display = 'none';
    document.getElementById('conclude-session-btn').style.display = 'none';
    document.getElementById('dialogue').textContent = 'Analyzing session...';
    const bond = this.bondScores[this.currentNPC?.id] || 0;
    const analysisPrompt = {
      role: "system",
      content: `Analyze the following therapy session transcript. Based on the conversation, has the patient shown signs of a breakthrough?
Bond score (0-10) between therapist and patient: ${bond}.
If bond is high, weight openness/insight more strongly.
Respond with only a JSON object with three keys: "breakthrough" (boolean), "summary" (a one-sentence summary of the patient's final state), and "item_prompt" (a concise, descriptive prompt for an image generator).
Example: {"breakthrough": true, "summary": "The patient has accepted that their value is not defined by their function.", "item_prompt": "A single, glowing gear crafted from polished wood, sitting on a velvet cushion, representing newfound purpose."}`
    };
    
    try {
      // Use Player Two if available
      let result;
      if (PLAYER_TWO_AVAILABLE) {
        const completion = await PlayerTwoBridge.createCompletion(
          [analysisPrompt, ...this.conversationHistory.slice(1)],
          { temperature: 0.3, maxTokens: 200 }
        );
        result = JSON.parse(completion);
      } else {
        // Fallback
        const completion = await PlayerTwoBridge.createCompletion(
          [analysisPrompt, ...this.conversationHistory.slice(1)],
          { temperature: 0.3, maxTokens: 200 }
        );
        result = JSON.parse(completion);
      }

      // Add: store AI-powered session note with breakthrough badge
      this.npcNotes[this.currentNPC?.id] = {
        summary: result.summary || '',
        breakthrough: !!result.breakthrough,
        timestamp: Date.now(),
      };

      if (result.breakthrough) {
        this.healedNPCs.add(this.currentNPCIndex);
        this.healedVersion++;
        this.therapistMentalState += 5;
        this.updateTherapistState();
        this.unlockNPCs();
        this.toast(`✨ Breakthrough! ${result.summary}`);
        this.generateCollectible(result.item_prompt);
      } else {
        this.therapistMentalState += 2;
        this.updateTherapistState();
        this.toast(`Session ended. ${result.summary}`);
      }
    } catch (error) {
      console.error("Session analysis failed:", error);
      this.toast("Could not analyze session.");
    } finally { 
      // Kill NPC on Player Two if available
      if (PLAYER_TWO_AVAILABLE) {
        this.killCurrentNPC().catch(err => {
          console.warn('Failed to kill NPC on Player Two:', err);
        });
      }
      this.exitSession(); 
    }
  },

  startMemoryGame() {
    this.miniGameActive = true;
    const dialogueText = document.getElementById('dialogue');
    const playerInputArea = document.getElementById('player-input-area');
    const gameContainer = document.getElementById('memory-game-container');
    playerInputArea.style.display = 'none';
    this.typewriter(dialogueText, "Fragments... images... flashing in my head. They feel... important. Can you help me match them?");
    const emojis = ['🏠', '❤️', '🧠', '🍽️', '🏠', '❤️', '🧠', '🍽️'];
    emojis.sort(() => Math.random() - 0.5);
    gameContainer.innerHTML = ''; gameContainer.style.display = 'grid';
    emojis.forEach(emoji => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      card.dataset.emoji = emoji;
      card.innerHTML = `<div class="card-face card-front">?</div><div class="card-face card-back">${emoji}</div>`;
      card.addEventListener('click', () => this.handleCardClick(card));
      gameContainer.appendChild(card);
    });
    this.memoryGameState = { flippedCards: [], matchedPairs: 0, totalPairs: emojis.length / 2, isLocked: false };
  },

  handleCardClick(card) {
    if (this.memoryGameState.isLocked || card.classList.contains('flipped')) return;
    card.classList.add('flipped');
    this.memoryGameState.flippedCards.push(card);
    if (this.memoryGameState.flippedCards.length === 2) {
      this.memoryGameState.isLocked = true;
      const [card1, card2] = this.memoryGameState.flippedCards;
      if (card1.dataset.emoji === card2.dataset.emoji) {
        this.memoryGameState.matchedPairs++;
        this.memoryGameState.flippedCards = []; this.memoryGameState.isLocked = false;
        if (this.memoryGameState.matchedPairs === this.memoryGameState.totalPairs) setTimeout(() => this.endMemoryGame(true), 1000);
      } else {
        setTimeout(() => {
          card1.classList.remove('flipped'); card2.classList.remove('flipped');
          this.memoryGameState.flippedCards = []; this.memoryGameState.isLocked = false;
        }, 1500);
      }
    }
  },

  endMemoryGame(success) {
    const gameContainer = document.getElementById('memory-game-container');
    const dialogueText = document.getElementById('dialogue');
    gameContainer.style.display = 'none';
    this.miniGameActive = false;
    let outcomeText = '', systemNote = '';
    if (success) {
      outcomeText = "The images... they connect. I... I remember. Thank you. It feels a little clearer now.";
      systemNote = "(Therapist's Note: The patient responded well to the memory exercise, successfully matching the pairs. This seems to have a calming effect.)";
    } else {
      outcomeText = "It's still so fuzzy... but thank you for trying.";
      systemNote = "(Therapist's Note: The memory exercise was attempted.)";
    }
    this.conversationHistory.push({ role: 'system', content: systemNote });
    this.conversationHistory.push({ role: 'assistant', content: outcomeText });
    this.speak(outcomeText, this.currentNPC.id);
    this.typewriter(dialogueText, outcomeText, () => { document.getElementById('player-input-area').style.display = 'flex'; document.getElementById('player-response').focus(); });
  },

  async generateCollectible(prompt) {
    // Image generation disabled; add a text-only collectible with a neutral image.
    this.toast('The patient left a symbolic item...');
    this.collectibles.push({ npc: this.currentNPC.name, image: '/therapy_office.png', prompt });
  },

  updateTherapistState() {
    const overlay = document.getElementById('therapist-office-overlay');
    const degradation = this.therapistMentalState / 200;
    overlay.style.opacity = degradation;
    const officeView = document.getElementById('therapist-office-view');
    if (officeView) {
      if (this.therapistMentalState > 40) {
        const glitchIntensity = (this.therapistMentalState - 40) / 60;
        officeView.style.setProperty('--glitch-intensity', glitchIntensity);
        officeView.classList.add('glitching');
      } else { officeView.classList.remove('glitching'); }
    }
    const thoughts = [
      "The silence is heavy today. The faint hum of the server is the only company.",
      "Their stories are starting to weigh on me. So many broken pieces of code.",
      "I see glitches in the corner of my eye. Are they real?",
      "My own thoughts feel... fragmented. Echoes of their pain.",
      "Am I the therapist, or am I the patient? The line is blurring."
    ];
    const thoughtIndex = Math.floor(this.therapistMentalState / 20);
    const thoughtsEl = document.getElementById('therapist-thoughts');
    if (thoughtsEl) thoughtsEl.textContent = thoughts[Math.min(thoughtIndex, thoughts.length - 1)];
  },

  unlockNPCs() {
    const unlockedCount = Math.floor(this.healedNPCs.size / 2);
    const baseUnlocked = 4;
    for (let i = 0; i < baseUnlocked + unlockedCount && i < this.npcs.length; i++) {
      if (!this.unlockedNPCs.has(i)) { this.unlockedNPCs.add(i); this.unlockedVersion++; this.toast(`New patient file: ${this.npcs[i].name}`); }
    }
    this.scheduleUpdateMenuRosterView();
  },

  makeChoice() {},

  requestExitSession() {
    const active = document.getElementById('therapy-session')?.classList.contains('active');
    const risky = this.generatingResponse || this.miniGameActive || (this.conversationHistory.filter(m => m.role !== 'system').length >= 3);
    if (active && risky && !confirm('End session and return to Menu? Progress won\'t be analyzed.')) return;
    this.audioPlayer.playSound('confirm'); this.exitSession();
  },

  exitSession() {
    this.updateStats();
    this.scheduleUpdateMenuRosterView();
    document.getElementById('patient-bio-window').style.display = 'none';
    // Stop all TTS and clear queue
    if (this.ttsAudio && !this.ttsAudio.paused) { 
      this.ttsAudio.pause(); 
      this.ttsAudio.currentTime = 0; 
    }
    this.ttsQueue = [];
    this.speaking = false;
    this.showSpeakingIndicator(false);
    
    // Stop speech recognition if active
    if (this.speechListening) {
      this.stopSpeechRecognition();
    }
    
    this.showScreen('main-menu');
    // autosave after session finishes
    this.autosave();
  },

  updateStats() {
    const healed = this.healedNPCs.size;
    const total = this.npcs.length;
    const mh = document.getElementById('menu-healed');
    const mt = document.getElementById('menu-total');
    if (mh) mh.textContent = healed;
    if (mt) mt.textContent = total;
  },

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.gameTime = Math.floor((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(this.gameTime / 60);
      const seconds = this.gameTime % 60;
      const timeEl = document.getElementById('game-time');
      if (timeEl) timeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      if (this.gameTime >= 1200 && !this.chromaAwardGiven) this.showChromaAward();
    }, 1000);
  },

  showChromaAward() {
    this.chromaAwardGiven = true;
    const popup = document.getElementById('award-popup');
    popup.classList.add('active');
    ['hackathon_judge','meta_receptionist','therapist_shadow','the_therapist'].forEach((id) => {
      const idx = this.npcs.findIndex(n => n.id === id);
      if (idx !== -1) this.unlockedNPCs.add(idx);
    });
    setTimeout(() => {
      popup.classList.remove('active');
      this.scheduleUpdateMenuRosterView();
    }, 5000);
  },

  showJournal() { const activeScreen = document.querySelector('.screen.active'); this.previousScreen = activeScreen ? activeScreen.id : 'main-menu'; this.populateFullJournal(); this.showScreen('journal'); },

  showCharacterCreator() {
    // Open the modal with embedded creation tool (iframe).
    this.showScreen('main-menu');
    document.getElementById('character-creator-modal').classList.add('active');
  },

  async generateCustomNpc() {
    const prompt = document.getElementById('creator-prompt').value.trim();
    if (!prompt) { alert("Please provide a prompt for the new NPC."); this.audioPlayer.playSound('error'); return; }
    const loader = document.getElementById('creator-loader');
    const preview = document.getElementById('creator-preview-content');
    const generateBtn = document.getElementById('creator-generate-btn');
    loader.style.display = 'block'; preview.innerHTML = ''; generateBtn.disabled = true; this.showLoader();
    try {
      const systemPrompt = `Based on the user's prompt, generate a JSON object for a new NPC patient. The JSON must have these exact keys: "name" (a creative name), "origin" (the type of game they are from), "crisis" (a one-sentence existential crisis based on the prompt). User prompt: "${prompt}"`;
      
      let completion;
      if (PLAYER_TWO_AVAILABLE) {
        completion = await PlayerTwoBridge.createCompletion([{ role: "system", content: systemPrompt }], { temperature: 0.8, maxTokens: 200 });
      } else {
        completion = await PlayerTwoBridge.createCompletion([{ role: "system", content: systemPrompt }], { temperature: 0.8, maxTokens: 200 });
      }
      
      const npcDetails = JSON.parse(completion);
      let imageUrl = null;
      const base = npcDetails.image_prompt || `portrait of ${npcDetails.name} in therapy office`;
      const imgPrompt = `pixel art, therapy office portrait, ${base}, warm neutral palette, soft vignette, clean background, no UI text, no logos, consistent lighting, character centered, shoulder-up view`;
      imageUrl = await this.generateImage(imgPrompt, { aspect_ratio: "4:5", transparent: false });
      this.addNewNpc(npcDetails.name, npcDetails.origin, npcDetails.crisis, imageUrl || '/therapy_office.png', prompt);
      this.displayNpcPreview(npcDetails.name, imageUrl || '/therapy_office.png', npcDetails.crisis);
    } catch (error) {
      console.error("Failed to generate custom NPC:", error);
      alert("The consciousness failed to coalesce. Please try a different prompt.");
      preview.innerHTML = `<p class="placeholder-text">Error during generation.</p>`;
    } finally { loader.style.display = 'none'; generateBtn.disabled = false; this.hideLoader(); }
  },

  async generateRandomNpc() {
    const loader = document.getElementById('creator-loader');
    const preview = document.getElementById('creator-preview-content');
    const randomizeBtn = document.getElementById('creator-randomize-btn');
    loader.style.display = 'block'; preview.innerHTML = ''; randomizeBtn.disabled = true; this.showLoader();
    try {
      const systemPrompt = `Generate a JSON object for a completely new, random NPC patient for a therapy game. The JSON must have these exact keys: "name" (a creative name), "origin" (the type of game they are from, e.g., 'Forgotten 90s Platformer', 'Obscure Puzzle Game'), "crisis" (a one-sentence existential crisis), and "image_prompt" (a concise prompt for a pixel art image of them in a therapy office). Be creative and melancholic.`;
      
      let completion;
      if (PLAYER_TWO_AVAILABLE) {
        completion = await PlayerTwoBridge.createCompletion([{ role: "system", content: systemPrompt }], { temperature: 0.9, maxTokens: 200 });
      } else {
        completion = await PlayerTwoBridge.createCompletion([{ role: "system", content: systemPrompt }], { temperature: 0.9, maxTokens: 200 });
      }
      
      const npcDetails = JSON.parse(completion);
      let imageUrl = null;
      const base = npcDetails.image_prompt || `portrait of ${npcDetails.name} in therapy office`;
      const imgPrompt = `pixel art, therapy office portrait, ${base}, warm neutral palette, soft vignette, clean background, no UI text, no logos, consistent lighting, character centered, shoulder-up view`;
      imageUrl = await this.generateImage(imgPrompt, { aspect_ratio: "4:5", transparent: false });
      this.addNewNpc(npcDetails.name, npcDetails.origin, npcDetails.crisis, imageUrl || '/therapy_office.png', npcDetails.crisis);
      this.displayNpcPreview(npcDetails.name, imageUrl || '/therapy_office.png', npcDetails.crisis);
    } catch (error) {
      console.error("Failed to generate random NPC:", error);
      alert("A random consciousness could not be reached. Please try again.");
      preview.innerHTML = `<p class="placeholder-text">Error during generation.</p>`;
    } finally { loader.style.display = 'none'; randomizeBtn.disabled = false; this.hideLoader(); }
  },

  addNewNpc(name, origin, crisis, imageUrl, prompt) {
    const newNpc = { id:`custom_${this.npcs.length + 1}`, name, session:`Session ${this.npcs.length + 1}`, origin, habitat:imageUrl, officeImage:imageUrl, crisis, opening_statement: crisis.length > 150 ? crisis : prompt };
    this.npcs.push(newNpc);
    this.unlockedNPCs.add(this.npcs.length - 1);
    this.updateJournalView();
    this.toast(`New Patient Added: ${name}`);
  },

  displayNpcPreview(name, imageUrl, crisis) {
    const preview = document.getElementById('creator-preview-content');
    preview.innerHTML = `<img src="${imageUrl}" alt="Portrait of ${name}"><h4>${name}</h4><p><strong>Crisis:</strong> ${crisis}</p>`;
  },

  showCredits() { const activeScreen = document.querySelector('.screen.active'); this.previousScreen = activeScreen ? activeScreen.id : 'main-menu'; this.showScreen('credits'); this.toggleCreditsEditMode(false); },

  showConnectionMap() { const activeScreen = document.querySelector('.screen.active'); this.previousScreen = activeScreen ? activeScreen.id : 'main-menu'; this.showScreen('connection-map'); this.renderConnectionMap();
    // Ensure a post-layout render when the screen becomes visible
    requestAnimationFrame(() => this.scheduleRenderConnectionMap());
  },

  renderConnectionMap() {
    const canvas = document.getElementById('map-canvas'); const ctx = canvas.getContext('2d');
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    // Resize for DPR for crisper lines
    const cssW = canvas.offsetWidth, cssH = canvas.offsetHeight;
    if (!cssW || !cssH) { // canvas not laid out yet; try again next frame
      requestAnimationFrame(() => this.renderConnectionMap());
      return;
    }
    const sig = JSON.stringify({ w: cssW, h: cssH, z: this.mapState.zoom, x: this.mapState.panX, y: this.mapState.panY, uV: this.unlockedVersion, hV: this.healedVersion, dpr });
    if (sig === this.lastRenderSignature) return;
    this.lastRenderSignature = sig;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    // Cache CSS dimensions for accurate mouse math on HiDPI
    this.mapState.cssW = cssW; this.mapState.cssH = cssH;
    const centerX = cssW / 2, centerY = cssH / 2, radius = Math.min(cssW, cssH) * 0.4;
    ctx.save(); ctx.translate(centerX, centerY); ctx.scale(this.mapState.zoom, this.mapState.zoom); ctx.translate(-centerX + this.mapState.panX, -centerY + this.mapState.panY);
    const unlockedNodes = this.npcs.map((npc,i)=>({ npc, index:i })).filter(item=>this.unlockedNPCs.has(item.index));
    const nodePositions = unlockedNodes.map((item, i) => {
      const angle = (i / Math.max(1, unlockedNodes.length)) * Math.PI * 2;
      return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius, npc: item.npc, index: item.index, healed: this.healedNPCs.has(item.index) };
    });
    this.mapState.nodes = nodePositions;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1;
    ctx.beginPath();
    nodePositions.forEach((pos1, i) => { nodePositions.forEach((pos2, j) => {
      if (i < j && (pos1.index + pos2.index) % 5 < 2) { ctx.moveTo(pos1.x, pos1.y); ctx.lineTo(pos2.x, pos2.y); }
    });});
    ctx.stroke();
    nodePositions.forEach(pos => { ctx.beginPath(); ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2); ctx.fillStyle = pos.healed ? '#4CAF50' : '#fff'; ctx.fill(); });
    ctx.restore();
  },

  scheduleRenderConnectionMap() {
    if (this.mapRenderScheduled) return;
    this.mapRenderScheduled = true;
    requestAnimationFrame(() => { this.mapRenderScheduled = false; this.renderConnectionMap(); });
  },

  resetMapView() { this.mapState.zoom = 1.0; this.mapState.panX = 0; this.mapState.panY = 0; this.scheduleRenderConnectionMap(); },

  initMapControls() {
    const canvas = document.getElementById('map-canvas'); const tooltip = document.getElementById('map-tooltip');
    canvas.addEventListener('mousemove', (e) => {
      if (this.mapState.isPanning) {
        const dx = (e.clientX - this.mapState.lastX) / this.mapState.zoom;
        const dy = (e.clientY - this.mapState.lastY) / this.mapState.zoom;
        this.mapState.panX += dx; this.mapState.panY += dy;
        this.mapState.lastX = e.clientX; this.mapState.lastY = e.clientY;
        this.scheduleRenderConnectionMap();
      }
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
      let hoveredNode = null;
      const centerX = (this.mapState.cssW || canvas.offsetWidth) / 2;
      const centerY = (this.mapState.cssH || canvas.offsetHeight) / 2;
      for (const node of this.mapState.nodes) {
        const screenX = centerX + (node.x - centerX + this.mapState.panX) * this.mapState.zoom;
        const screenY = centerY + (node.y - centerY + this.mapState.panY) * this.mapState.zoom;
        const distance = Math.sqrt((mouseX - screenX) ** 2 + (mouseY - screenY) ** 2);
        if (distance < 6 * this.mapState.zoom) { hoveredNode = node; break; }
      }
      if (hoveredNode) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
        tooltip.textContent = hoveredNode.npc.name;
      } else { tooltip.style.display = 'none'; }
    }, { passive: true });
    canvas.addEventListener('mousedown', (e) => { this.mapState.isPanning = true; this.mapState.lastX = e.clientX; this.mapState.lastY = e.clientY; });
    canvas.addEventListener('mouseup', () => { this.mapState.isPanning = false; });
    canvas.addEventListener('mouseleave', () => { this.mapState.isPanning = false; });
    canvas.addEventListener('dblclick', () => this.resetMapView());
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
      const centerX = (this.mapState.cssW || canvas.offsetWidth) / 2;
      const centerY = (this.mapState.cssH || canvas.offsetHeight) / 2;
      for (const node of this.mapState.nodes) {
        const screenX = centerX + (node.x - centerX + this.mapState.panX) * this.mapState.zoom;
        const screenY = centerY + (node.y - centerY + this.mapState.panY) * this.mapState.zoom;
        const distance = Math.hypot(mouseX - screenX, mouseY - screenY);
        if (distance < 8 * this.mapState.zoom) { this.startSession(node.index); break; }
      }
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomAmount = 0.1;
      const mouseX = e.clientX - canvas.getBoundingClientRect().left;
      const mouseY = e.clientY - canvas.getBoundingClientRect().top;
      const wheel = e.deltaY < 0 ? 1 : -1;
      const zoom = Math.exp(wheel * zoomAmount);
      const newZoom = Math.max(0.5, Math.min(3, this.mapState.zoom * zoom));
      const centerX = canvas.width / 2; const centerY = canvas.height / 2;
      this.mapState.panX -= (mouseX - centerX) / (this.mapState.zoom * zoom) - (mouseX - centerX) / this.mapState.zoom;
      this.mapState.panY -= (mouseY - centerY) / (this.mapState.zoom * zoom) - (mouseY - centerY) / this.mapState.zoom;
      this.mapState.zoom = newZoom;
      this.scheduleRenderConnectionMap();
    }, { passive: false });
  },

  returnToGame() { this.showScreen(this.previousScreen || 'journal'); },

  saveGame() {
    const saveData = { healed: Array.from(this.healedNPCs), unlocked: Array.from(this.unlockedNPCs), mentalState: this.therapistMentalState, collectibles: this.collectibles, time: this.gameTime, award: this.chromaAwardGiven, credits: this.communityCredits };
    const saveCode = btoa(JSON.stringify(saveData));
    document.getElementById('save-code').value = saveCode;
    document.getElementById('save-modal').classList.add('active');
    // persist autosave mirror too
    try { localStorage.setItem('autosave_v1', JSON.stringify(saveData)); } catch (_) {}
  },

  copySaveCode() {
    const input = document.getElementById('save-code');
    const text = input.value || '';
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(()=>this.toast('Save code copied.')).catch(()=>{ input.select(); document.execCommand('copy'); this.toast('Save code copied.'); });
    } else { input.select(); document.execCommand('copy'); this.toast('Save code copied.'); }
  },

  showLoadModal() { document.getElementById('load-modal').classList.add('active'); },

  // Hamburger Menu Functions
  toggleHamburgerMenu() {
    const dropdown = document.getElementById('hamburger-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('active');
    }
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log('Fullscreen error:', err.message);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  },

  closeHamburgerMenu() {
    const dropdown = document.getElementById('hamburger-dropdown');
    if (dropdown) {
      dropdown.classList.remove('active');
    }
  },

  loadGame() {
    try {
      const code = document.getElementById('load-code').value;
      if (!code) throw new Error("No code entered.");
      const saveData = JSON.parse(atob(code));
      this.applySaveData(saveData);
      
      // Ensure NPC edits are loaded after manual save load
      this.loadNpcEdits();
      
      this.startTime = Date.now() - (this.gameTime * 1000);
      this.startTimer();
      this.closeModal('load-modal');
      this.showScreen('main-menu');
      this.updateStats(); this.renderCommunityCredits(); this.updateMenuRosterView(); this.updateTherapistState();
      this.toast('Game loaded.');
      // refresh autosave after manual load
      this.startAutosave();
    } catch (e) { this.toast('Invalid save code.'); }
  },

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'radio-modal' && this.ytPlayer) { this.ytPlayer.stopVideo(); this.ytPlayer.destroy(); this.ytPlayer = null; }
    if (modalId === 'path-to-self-modal') { if (this.pathSelfTimer) clearTimeout(this.pathSelfTimer); document.getElementById('path-to-self-iframe').src = 'about:blank'; }
    if (modalId === 'add-credit-modal') {
      this.editingCreditIndex = null;
      document.getElementById('credit-image-upload').value = '';
      document.getElementById('credit-link-url').value = '';
      document.getElementById('credit-image-preview').style.display = 'none';
    }
    if (modalId === 'settings-modal') {
      // removed auto-lock so edit mode stays enabled after unlocking
      // this.editModeEnabled = false; this.toast('Edit mode locked.'); this.scheduleUpdateMenuRosterView();
    }
  },

  endGame() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const healedCount = this.healedNPCs.size; const totalCount = this.npcs.length;
    const percentage = totalCount > 0 ? Math.round((healedCount / totalCount) * 100) : 0;
    document.getElementById('ending-healed').textContent = healedCount;
    document.getElementById('ending-total').textContent = totalCount;
    document.getElementById('ending-rate').textContent = `${percentage}%`;
    let title, message;
    if (percentage >= 90) { title = 'MASTER THERAPIST'; message = 'You have shown exceptional skill in helping digital beings find their purpose. The NPCs you\'ve healed will carry their newfound understanding throughout their programmed existence.'; }
    else if (percentage >= 70) { title = 'SKILLED PRACTITIONER'; message = 'Your therapy sessions have brought relief to many digital consciousness. While not all could be healed, your efforts have made a significant impact on their existential struggles.'; }
    else if (percentage >= 50) { title = 'LEARNING THERAPIST'; message = 'You\'ve made progress in understanding the unique challenges faced by NPCs. With more practice, you could help even more digital beings find meaning in their coded lives.'; }
    else { title = 'NOVICE COUNSELOR'; message = 'The path to healing digital consciousness is complex. Each NPC carries theiressed one carry their own unique burden of awareness. Perhaps another approach would yield better results.'; }
    document.getElementById('ending-title').textContent = title;
    document.getElementById('ending-message').textContent = message;
    this.showScreen('ending');
  },

  returnToMenu() { if (this.timerInterval) clearInterval(this.timerInterval); this.showScreen('main-menu'); },

  populateFullJournal() {
    const list = document.getElementById('journal-list'); if (!list) return;
    list.innerHTML = '';
    const frag = document.createDocumentFragment();
    this.npcs.forEach((npc, index) => {
      const isHealed = this.healedNPCs.has(index);
      const isUnlocked = this.unlockedNPCs.has(index);
      const entry = document.createElement('div');
      entry.className = `journal-entry ${isHealed ? 'healed' : ''} ${!isUnlocked ? 'locked' : ''}`;
      // Add: derive badge and last note if present
      const note = this.npcNotes[npc.id];
      const badge = note ? (note.breakthrough ? '⭐ Breakthrough' : '📝 Note') : (isHealed ? '⭐ Breakthrough' : (isUnlocked ? '🗂 Session Available' : '🔒 Locked'));
      const noteLine = note ? `<p><strong>${badge}:</strong> ${note.summary}</p>` : '';
      let content;
      if (isUnlocked) {
        // Include habitat (Main image) thumbnail in Journal
        const thumb = `<img src="${npc.habitat}" alt="${npc.name}" class="journal-thumb" />`;
        content = `${thumb}<h3>${npc.name} (${npc.session})</h3><p><strong>Origin:</strong> ${npc.origin}</p><p><strong>Status:</strong> ${isHealed ? 'Healed' : 'Session Available'}</p><p><em>Crisis: ${npc.crisis}</em></p>${noteLine}`;
      } else {
        content = `<h3>LOCKED // SESSION ${String(index + 1).padStart(2, '0')}</h3><p>Heal more patients to unlock this file.</p>`;
      }
      entry.innerHTML = content;
      frag.appendChild(entry);
    });
    list.appendChild(frag);
    // Update journal header stats
    const total = this.npcs.length;
    const healed = this.healedNPCs.size;
    const progress = total > 0 ? Math.round((healed / total) * 100) : 0;
    const jt = document.getElementById('journal-total'); if (jt) jt.textContent = total;
    const jh = document.getElementById('journal-healed'); if (jh) jh.textContent = healed;
    const jp = document.getElementById('journal-progress'); if (jp) jp.textContent = `${progress}%`;
  },

  openRadio() {
    if (!this.radioSource) this.radioSource = this.radioPlaylist;
    document.getElementById('radio-modal').classList.add('active');
    if (this.ytApiReady) this.createYtPlayer();
    else console.log("YouTube API not ready yet, waiting...");
  },

  createYtPlayer() {
    if (this.ytPlayer) { try { this.ytPlayer.destroy(); } catch (e) { console.error("Error destroying existing YT player:", e); } }
    try {
      this.ytPlayer = new YT.Player('radio-player', {
        events: {
          'onReady': (event) => { try { event.target.setShuffle(true); event.target.playVideoAt(0); event.target.unMute(); } catch(e) { console.error("YT Player onReady event failed:", e); } },
          'onError': (event) => { console.error("YT Player Error:", event.data); }
        }
      });
    } catch (e) { console.error("Failed to create YT Player:", e); }
  },

  openPathToSelf() {
    this.showPathSelfFloat('https://uxwq0l0o2qi9.space.minimax.io/');
    if (this.pathSelfTimer) clearTimeout(this.pathSelfTimer);
    this.pathSelfTimer = setTimeout(() => {
      alert('A strange signal is interfering with your radio...');
      this.audioPlayer.playSound('confirm');
      this.pathSelfTimer = null;
      this.radioSource = this.podcastLink;
      if (document.getElementById('radio-modal').classList.contains('active')) this.openRadio();
    }, 20 * 60 * 1000);
  },

  showPathSelfFloat(url) {
    const container = document.getElementById('path-self-float');
    const iframe = document.getElementById('path-self-float-iframe');
    if (!container || !iframe) return;
    iframe.src = url || 'about:blank';
    container.style.display = 'block';
    this.pathSelfFloatVisible = true;
    document.body.classList.add('pip-open');
    const fr = document.getElementById('floating-radio-btn'); if (fr) fr.classList.add('with-pip');
    container.classList.remove('max'); document.body.classList.remove('pip-max');
    const fr2 = document.getElementById('floating-radio-btn'); if (fr2) fr2.classList.remove('max');
    const psfToggle = document.getElementById('psf-toggle-btn'); if (psfToggle) psfToggle.textContent = '⤢';
  },

  closePathSelfFloat() {
    const container = document.getElementById('path-self-float');
    const iframe = document.getElementById('path-self-float-iframe');
    if (iframe) iframe.src = 'about:blank';
    if (container) { container.style.display = 'none'; container.classList.remove('max'); }
    this.pathSelfFloatVisible = false;
    document.body.classList.remove('pip-open'); document.body.classList.remove('pip-max');
    const fr = document.getElementById('floating-radio-btn');
    if (fr) { fr.classList.remove('with-pip'); fr.classList.remove('max'); }
  },
  
  togglePathSelfFloat() {
    const container = document.getElementById('path-self-float');
    const btn = document.getElementById('psf-toggle-btn');
    const fr = document.getElementById('floating-radio-btn');
    if (!container) return;
    const isMax = container.classList.toggle('max');
    document.body.classList.toggle('pip-max', isMax);
    if (btn) btn.textContent = isMax ? '⤡' : '⤢';
  },

  toggleCreditsEditMode(forceState) {
    this.creditsEditMode = typeof forceState === 'boolean' ? forceState : !this.creditsEditMode;
    const container = document.getElementById('community-credits-container');
    const controls = document.getElementById('credits-edit-controls');
    if (this.creditsEditMode) { container.classList.add('edit-mode'); controls.style.display = 'flex'; }
    else { container.classList.remove('edit-mode'); controls.style.display = 'none'; }
    this.renderCommunityCredits();
  },

  /* Add: set titles for toolbar buttons for better accessibility */
  setToolbarTitles() {
    document.querySelectorAll('.menu-toolbar .btn').forEach(btn => {
      if (!btn.title) btn.title = btn.textContent.trim();
    });
    const fr = document.getElementById('floating-radio-btn');
    if (fr) fr.title = 'Open In-Game Radio (R)';
  },

  renderCommunityCredits() {
    const container = document.getElementById('community-credits-container');
    container.innerHTML = '';
    this.communityCredits.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'credit-item';
      itemEl.draggable = this.creditsEditMode;
      itemEl.dataset.index = index;
      const content = `<img src="${item.src}" alt="Community Credit Image"><div class="credit-item-controls"><button class="credit-control-btn" title="Edit" onclick="game.editCreditItem(${index})">✎</button><button class="credit-control-btn" title="Delete" onclick="game.deleteCreditItem(${index})">🗑</button></div>`;
      if (item.link) {
        const linkEl = document.createElement('a');
        linkEl.href = item.link; linkEl.target = '_blank'; linkEl.rel = 'noopener noreferrer';
        linkEl.innerHTML = content;
        itemEl.appendChild(linkEl);
      } else { itemEl.innerHTML = content; }
      container.appendChild(itemEl);
    });
    if (this.creditsEditMode) this.initDragAndDrop();
  },

  showAddCreditModal() { this.editingCreditIndex = null; document.getElementById('credit-modal-title').textContent = 'Add Supporter'; document.getElementById('add-credit-modal').classList.add('active'); },

  editCreditItem(index) {
    this.editingCreditIndex = index;
    const item = this.communityCredits[index];
    document.getElementById('credit-modal-title').textContent = 'Edit Supporter';
    document.getElementById('credit-link-url').value = item.link || '';
    const preview = document.getElementById('credit-image-preview');
    preview.src = item.src; preview.style.display = 'block';
    document.getElementById('add-credit-modal').classList.add('active');
  },

  async saveCreditItem() {
    const link = document.getElementById('credit-link-url').value.trim();
    const fileInput = document.getElementById('credit-image-upload');
    const file = fileInput.files[0];
    let imageUrl;
    if (file) {
      this.showLoader();
      try {
        // Convert file to data URL for local use (Player Two compatible)
        imageUrl = await this.fileToDataUrl(file);
      } catch (error) { console.error('Error processing file:', error); alert('File processing failed. Please try again.'); }
      finally { this.hideLoader(); }
    }
    if (this.editingCreditIndex !== null) {
      const item = this.communityCredits[this.editingCreditIndex];
      if (imageUrl) item.src = imageUrl;
      item.link = link;
    } else {
      if (!imageUrl) { alert('Please select an image file to upload.'); return; }
      this.communityCredits.push({ src: imageUrl, link });
    }
    this.renderCommunityCredits();
    this.saveCommunityCredits();
    this.closeModal('add-credit-modal');
  },

  deleteCreditItem(index) {
    if (confirm('Are you sure you want to delete this item?')) {
      this.communityCredits.splice(index, 1);
      this.renderCommunityCredits();
      this.saveCommunityCredits();
    }
  },

  saveCommunityCredits() { localStorage.setItem('communityCredits', JSON.stringify(this.communityCredits)); },
  loadCommunityCredits() { const saved = localStorage.getItem('communityCredits'); if (saved) this.communityCredits = JSON.parse(saved); },

  // Helper method to convert file to data URL for Player Two compatibility
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  initDragAndDrop() {
    const container = document.getElementById('community-credits-container');
    const items = container.querySelectorAll('.credit-item');
    let dragSrcEl = null;
    function handleDragStart(e) { this.classList.add('dragging'); dragSrcEl = this; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', this.innerHTML); }
    function handleDragOver(e) { e.preventDefault(); return false; }
    function handleDrop(e) {
      e.stopPropagation();
      if (dragSrcEl !== this) {
        const srcIndex = parseInt(dragSrcEl.dataset.index, 10);
        const targetIndex = parseInt(this.dataset.index, 10);
        const [removed] = game.communityCredits.splice(srcIndex, 1);
        game.communityCredits.splice(targetIndex, 0, removed);
        game.renderCommunityCredits();
      }
      return false;
    }
    function handleDragEnd() { this.classList.remove('dragging'); }
    items.forEach(item => {
      item.addEventListener('dragstart', handleDragStart, false);
      item.addEventListener('dragover', handleDragOver, false);
      item.addEventListener('drop', handleDrop, false);
      item.addEventListener('dragend', handleDragEnd, false);
    });
  },

  async generateThoughtImage() {
    // Image generation disabled; hide thought bubble gracefully.
    const thoughtBubble = document.getElementById('npc-thought-bubble');
    if (thoughtBubble) thoughtBubble.style.display = 'none';
  },

  togglePatientBio(forceShow) {
    const bioWindow = document.getElementById('patient-bio-window');
    if (!bioWindow || !this.currentNPC) return;
    const isVisible = bioWindow.style.display === 'flex';
    if (forceShow === false || isVisible) { bioWindow.style.display = 'none'; }
    else {
      const contentEl = document.getElementById('pbw-content');
      const noteObj = this.npcNotes[this.currentNPC.id] || {};
      const existing = noteObj.note || '';
      contentEl.innerHTML = `
        <h4>${this.currentNPC.name}</h4>
        <p><strong>Origin:</strong> ${this.currentNPC.origin}</p>
        <p><strong>Declared Crisis:</strong> ${this.currentNPC.crisis}</p>
        <textarea id="pbw-notes" class="pbw-notes" placeholder="Your confidential notes…">${existing}</textarea>
        <div class="pbw-actions">
          <button class="psf-btn" id="pbw-save">Save</button>
          <button class="psf-btn" id="pbw-summarize">AI Summarize</button>
          <button class="psf-btn" id="pbw-share">Share Insight</button>
        </div>
        <div id="pbw-summary" style="margin-top:.4rem; font-size:.85rem; opacity:.85;"></div>
      `;
      // bind actions
      contentEl.querySelector('#pbw-save').onclick = () => {
        const text = contentEl.querySelector('#pbw-notes').value.trim();
        this.npcNotes[this.currentNPC.id] = { ...(this.npcNotes[this.currentNPC.id]||{}), note: text };
        this.toast('Notes saved.');
      };
      contentEl.querySelector('#pbw-summarize').onclick = async () => {
        const text = contentEl.querySelector('#pbw-notes').value.trim();
        if (!text) { this.toast('Write some notes first.'); return; }
        const sys = `Summarize the following therapist's notes into one empathetic, specific, 12–18 word insight. Output only the sentence.\nNotes:\n${text}`;
        try {
          let completion;
          if (PLAYER_TWO_AVAILABLE) {
            completion = await PlayerTwoBridge.createCompletion([{ role:'system', content: sys }], { temperature: 0.5, maxTokens: 50 });
          } else {
            completion = await PlayerTwoBridge.createCompletion([{ role:'system', content: sys }], { temperature: 0.5, maxTokens: 50 });
          }
          const summary = (completion || '').trim();
          contentEl.querySelector('#pbw-summary').textContent = `Insight: ${summary}`;
          // store locally
          this.npcNotes[this.currentNPC?.id] = { ...(this.npcNotes[this.currentNPC?.id]||{}), summary };
        } catch (_) { this.toast('AI summarize failed.'); }
      };
      contentEl.querySelector('#pbw-share').onclick = async () => {
        const summaryEl = contentEl.querySelector('#pbw-summary');
        let text = (summaryEl.textContent || '').replace(/^Insight:\s*/,'').trim();
        if (!text) {
          // fallback to auto-summarize notes if summary missing
          await contentEl.querySelector('#pbw-summarize').onclick();
          text = (contentEl.querySelector('#pbw-summary').textContent || '').replace(/^Insight:\s*/,'').trim();
        }
        if (!text) { this.toast('No insight to share.'); return; }
        this.shareInsight(text);
        this.toast('Shared to co‑therapists.');
      };
      bioWindow.style.display = 'flex';
      this.audioPlayer.playSound('confirm');
    }
  },

  showCollectibles() {
    const grid = document.getElementById('collectibles-grid');
    grid.innerHTML = '';
    if (this.collectibles.length === 0) {
      grid.innerHTML = '<p>No collectibles yet. Heal patients to receive symbolic items.</p>';
    } else {
      this.collectibles.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'collectible-item';
        itemEl.innerHTML = `<img src="${item.image}" alt="${item.prompt}"><p>${item.npc}</p>`;
        grid.appendChild(itemEl);
      });
    }
    document.getElementById('collectibles-modal').classList.add('active');
  },

  updateJournalView() {
    // remove deprecated roster panel rendering (no corresponding DOM in index.html)
  },

  updateMenuRosterView() {
    const grid = document.getElementById('menu-roster-grid'); const search = document.getElementById('menu-search');
    if (!grid) return;
    const searchQuery = (search?.value || '').toLowerCase();
    const eV = this.npcEditsVersion || 0;
    const fullSig = JSON.stringify({ q: searchQuery, uV: this.unlockedVersion, hV: this.healedVersion, n: this.npcs.length, eV });
    if (fullSig === this.menuRenderSignature) return; this.menuRenderSignature = fullSig;
    const blackoutIds = new Set(['hackathon_judge','meta_receptionist','therapist_shadow','the_therapist']);
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    const items = this.npcs.map((npc,index)=>({ npc, index })).filter(item => {
      if (!searchQuery) return true;
      const hay = `${item.npc.name} ${item.npc.origin} ${item.npc.crisis}`.toLowerCase();
      return hay.includes(searchQuery);
    });
    // Store last filtered items for Enter-to-start
    this._lastMenuItems = items;
    items.sort((a,b)=>{ const af = a.npc.session==='Final Session'; const bf = b.npc.session==='Final Session'; if (af && !bf) return 1; if (!af && bf) return -1; const an = parseInt(a.npc.session.split(' ')[1]); const bn = parseInt(b.npc.session.split(' ')[1]); return (an - bn) || (a.index - b.index); });
    if (items.length === 0) { grid.innerHTML = '<p style="opacity:0.7;padding:0.5rem 0;">No matching patients.</p>'; }
    else {
      items.forEach(({ npc, index }) => {
        const isUnlocked = this.unlockedNPCs.has(index);
        const isHealed = this.healedNPCs.has(index);
        const blackout = blackoutIds.has(npc.id) && !isUnlocked;
        const card = document.createElement('div');
        card.className = `roster-card ${isHealed ? 'healed' : ''} ${isUnlocked ? '' : 'locked'} ${blackout ? 'blackout' : ''}`;
        const nameText = blackout ? '?????' : npc.name;
        const metaText = blackout ? '????' : `${npc.session} • ${npc.origin}`;
        const bioText = blackout ? '' : npc.crisis;
        card.innerHTML = `${!isUnlocked ? '<div class="lock-badge">LOCKED</div>' : ''}<div class="roster-thumb"><img class="loading" loading="lazy" src="${npc.habitat}" alt="${npc.name}"></div><div class="roster-info"><div class="roster-name">${nameText}</div><div class="roster-meta">${metaText}</div><div class="roster-bio">${bioText}</div></div>`;
        const img = card.querySelector('.roster-thumb img'); attachImageLoadingEffects(img);
        card.setAttribute('role','button'); card.tabIndex = 0;
        card.setAttribute('aria-label', `${nameText} – ${metaText}${isUnlocked ? '' : ' (locked)'}`);
        if (isUnlocked) {
          card.addEventListener('click', () => {
            if (this.editModeEnabled) this.openNpcEdit(index);
            else this.startSession(index);
          });
          if (this.editModeEnabled) card.classList.add('editable');
          else card.classList.remove('editable');
        }
        frag.appendChild(card);
      });
    }
    grid.appendChild(frag);
    const cover = document.getElementById('journal-cover'); const backCover = document.getElementById('journal-back-cover');
    if (cover) cover.style.display = 'none'; if (backCover) backCover.style.display = 'none';
  },

  renderCurrentPage() {},

  nextPage() { const maxPage = this.journalPages.length + 1; if (this.currentPage < maxPage) { this.currentPage++; this.renderCurrentPage(); } },

  prevPage() { if (this.currentPage > 0) { this.currentPage--; this.renderCurrentPage(); } },

  async updateBondWithAI(playerResponse) {
    const lastNpcResponse = this.conversationHistory.filter(m => m.role === 'assistant').pop()?.content || this.currentNPC?.opening_statement;
    const systemPrompt = `Analyze the therapist's response in the context of the patient's last statement.
Patient said: "${lastNpcResponse}"
Therapist responded: "${playerResponse}"
Based on therapeutic principles (empathy, validation, open-ended questions vs. dismissiveness, advice-giving), calculate a "bond_change" value between -2 (harmful) to +2 (very helpful).
Respond with only a JSON object: {"bond_change": number, "reason": "A brief explanation for the change."}`;
    
    try {
      // Use Player Two if available
      let result;
      if (PLAYER_TWO_AVAILABLE) {
        const completion = await PlayerTwoBridge.createCompletion(
          [{ role: "system", content: systemPrompt }],
          { temperature: 0.3, maxTokens: 100 }
        );
        result = JSON.parse(completion);
      } else {
        // Fallback
        const completion = await PlayerTwoBridge.createCompletion(
          [{ role: "system", content: systemPrompt }],
          { temperature: 0.3, maxTokens: 100 }
        );
        result = JSON.parse(completion);
      }
      
      const delta = result.bond_change || 0;
      const id = this.currentNPC?.id;
      const current = this.bondScores[id] || 0;
      this.bondScores[id] = Math.max(0, Math.min(10, current + delta));
      console.log(`Bond updated for ${id}: ${current} -> ${this.bondScores[id]} (Reason: ${result.reason})`);
      this.updateTrustUI();
    } catch (error) { 
      console.error("AI bond analysis failed. No bond change.", error); 
      // Fallback to keyword-based analysis
      this.updateBondFromMessage(playerResponse);
    }
  },

  updateBondFromMessage(text) {
    const t = text.toLowerCase();
    const positives = ['i hear','i understand','tell me more','that sounds',"i'm here",'with you','safe','thank','together','okay'];
    const negatives = ['you should','you must','just do',"why don't you",'calm down','but actually'];
    let delta = 0;
    positives.forEach(k => { if (t.includes(k)) delta += 1; });
    negatives.forEach(k => { if (t.includes(k)) delta -= 1; });
    const id = this.currentNPC?.id;
    const current = this.bondScores[id] || 0;
    this.bondScores[id] = Math.max(0, Math.min(10, current + delta));
  },

  /**
   * Spawn current NPC on Player Two
   */
  async spawnCurrentNPC() {
    if (!this.currentNPC || !PLAYER_TWO_AVAILABLE) return;
    
    try {
      const npcData = {
        id: this.currentNPC.id,
        name: this.currentNPC.name,
        shortName: this.currentNPC.name.split(' ')[0],
        origin: this.currentNPC.origin,
        crisis: this.currentNPC.crisis,
        opening_statement: this.currentNPC.opening_statement,
        gender: this.currentNPC.gender
      };
      
      const spawnResult = await PlayerTwoBridge.spawnNPC(npcData, {
        keepGameState: true,
        ttsSpeed: 0.95,
        functions: this.getNpcFunctions()
      });
      
      this.currentNPCId = spawnResult.npc_id;
      console.log(`✓ NPC spawned: ${this.currentNPC.name} (ID: ${this.currentNPCId})`);
      
    } catch (error) {
      console.error('Failed to spawn NPC:', error);
      this.currentNPCId = null;
    }
  },

  /**
   * Kill current NPC on Player Two (cleanup)
   */
  async killCurrentNPC() {
    if (!this.currentNPCId || !PLAYER_TWO_AVAILABLE) return;
    
    try {
      await PlayerTwoBridge.killNPC(this.currentNPCId);
      console.log(`✓ NPC killed: ${this.currentNPC.name}`);
    } catch (error) {
      console.warn('NPC cleanup warning:', error);
    } finally {
      this.currentNPCId = null;
    }
  },

  /**
   * Get list of functions available to NPCs
   */
  getNpcFunctions() {
    return [
      {
        name: "trigger_memory",
        description: "Trigger a visual flashback or memory for the patient. Use this when the conversation reveals a deep, specific detail about their past.",
        parameters: {
          memory_type: { type: "string", description: "The type of memory: 'happy', 'traumatic', 'neutral'" },
          description: { type: "string", description: "A brief description of what is seen in the memory." }
        },
        required: ["memory_type", "description"]
      },
      {
        name: "change_environment",
        description: "Alter the therapy room environment to reflect the patient's mood or story.",
        parameters: {
          environment: { type: "string", description: "The type of environment: 'forest', 'space', 'void', 'pixel_city'" }
        },
        required: ["environment"]
      }
    ];
  },

  /**
   * Handle function calls from NPCs
   */
  handleNpcFunctionCall(call) {
    console.log("NPC Function Call:", call);
    const { name, arguments: args } = call;

    if (name === 'trigger_memory') {
      this.toast(`Memory Triggered: ${args.memory_type}`);
      // Visual feedback for memory
      const overlay = document.getElementById('therapist-office-overlay');
      if (overlay) {
        overlay.style.backgroundColor = args.memory_type === 'happy' ? 'rgba(255, 223, 0, 0.2)' :
                                      args.memory_type === 'traumatic' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 0, 255, 0.1)';
        setTimeout(() => overlay.style.backgroundColor = 'transparent', 3000);
      }
    } else if (name === 'change_environment') {
      this.toast(`Environment Shifting: ${args.environment}`);
      // In a real implementation, this would switch background images
      // For now, just a visual tint or effect
      document.body.style.filter = 'sepia(0.5)';
      setTimeout(() => document.body.style.filter = 'none', 5000);
    }
  },

  /**
   * Get game state context for AI
   */
  getGameStateContext() {
    const bondScore = this.bondScores[this.currentNPC?.id] || 0;
    const turnCount = this.turnCount || 0;
    
    let trustLevel = '';
    if (bondScore < 3) trustLevel = 'Patient is guarded and distant.';
    else if (bondScore < 6) trustLevel = 'Patient is beginning to open up.';
    else if (bondScore < 8) trustLevel = 'Patient is developing trust.';
    else trustLevel = 'Patient feels safe and connected.';
    
    return `Session Info: Turn ${turnCount}, Trust Score: ${bondScore}/10. ${trustLevel}`;
  },

  reorderAndRenumber() {
    const finalIds = ['hackathon_judge','meta_receptionist','therapist_shadow','the_therapist'];
    const isFinal = new Set(finalIds);
    const others = this.npcs.filter(n => !isFinal.has(n.id));
    const map = new Map(this.npcs.map(n => [n.id, n]));
    const finals = finalIds.map(id => map.get(id)).filter(Boolean);
    this.npcs = [...others, ...finals];
    this.npcs.forEach((npc, idx) => { if (npc.session !== 'Final Session') npc.session = `Session ${String(idx + 1).padStart(2, '0')}`; });
  },

  updateTrustUI() {
    const badge = document.getElementById('trust-badge');
    if (!badge || !this.currentNPC) return;
    const score = this.bondScores[this.currentNPC.id] || 0;
    badge.textContent = `Trust: ${score}/10`;
    const hue = Math.round((score / 10) * 120);
    badge.style.borderColor = `hsl(${hue}, 70%, 50%)`;
    badge.style.color = `hsl(${hue}, 80%, 70%)`;
  },

  /* Add: gentle first-run tips via toasts */
  startHints() {
    if (localStorage.getItem('npcTherapyTipsShown')) return;
    setTimeout(() => this.toast('Tip: Press R to open the in‑game radio.'), 1200);
    setTimeout(() => this.toast('Tip: Click the patient portrait for their dossier.'), 5200);
    setTimeout(() => this.toast('Tip: Press J for Journal, C for Credits, M for Menu.'), 9200);
    setTimeout(() => this.toast('Map: Drag to pan, scroll to zoom, double‑click to reset.'), 13200);
    setTimeout(() => this.toast('New: Press V to use voice input!'), 17200);
    localStorage.setItem('npcTherapyTipsShown', '1');
  },

  toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3200);
  },

  scheduleUpdateMenuRosterView() {
    if (this._menuRenderScheduled) return;
    this._menuRenderScheduled = true;
    const run = () => { this._menuRenderScheduled = false; this.updateMenuRosterView(); };
    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 150 });
    } else {
      requestAnimationFrame(run);
    }
  },

  openSettings() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    // Sync current values
    const ttsEl = document.getElementById('setting-tts'); if (ttsEl) ttsEl.checked = !!this.settings.tts;
    const sttEl = document.getElementById('setting-stt'); if (sttEl) sttEl.checked = !!this.settings.stt;
    const rmEl = document.getElementById('setting-reduce-motion'); if (rmEl) rmEl.checked = !!this.settings.reduceMotion;
    const dsEl = document.getElementById('setting-dialogue-scale'); if (dsEl) dsEl.value = this.settings.dialogueScale;
    const btn = document.getElementById('setting-enter-edit');
    if (btn) btn.onclick = () => this.enterEditMode();
    const exitBtn = document.getElementById('setting-exit-edit');
    if (exitBtn) {
      exitBtn.onclick = () => { this.editModeEnabled = false; this.toast('Edit mode disabled.'); this.scheduleUpdateMenuRosterView(); };
      exitBtn.disabled = !this.editModeEnabled;
    }
    const saveAllBtn = document.getElementById('save-all-images-btn');
    if (saveAllBtn) saveAllBtn.onclick = () => this.saveAllNpcImages();
    modal.classList.add('active');
  },

  saveAllNpcImages() {
    const edits = {};
    this.npcs.forEach(n => {
      edits[n.id] = {
        name: n.name,
        origin: n.origin,
        crisis: n.crisis,
        opening_statement: n.opening_statement,
        habitat: n.habitat,
        officeImage: n.officeImage,
      };
    });
    try {
      const existing = JSON.parse(localStorage.getItem('npcEdits') || '{}');
      Object.assign(existing, edits);
      localStorage.setItem('npcEdits', JSON.stringify(existing));
      if (this.room) this.room.updateRoomState({ npcEdits: existing });
      this.toast(`Saved ${Object.keys(edits).length} NPC images & descriptions globally.`);
    } catch (_) { this.toast('Save failed.'); }
  },

  enterEditMode() {
    const pass = prompt('Enter admin password to enable character editing:');
    if (pass === ADMIN_PASSWORD) {
      this.editModeEnabled = true;
      this.toast('Admin edit mode enabled. Close Settings, then click a character to edit.');
      this.scheduleUpdateMenuRosterView();
      // enable Exit button state if settings still open
      const exitBtn = document.getElementById('setting-exit-edit');
      if (exitBtn) exitBtn.disabled = false;
    } else { this.toast('Incorrect password.'); }
  },

  saveSettings() {
    const ttsEl = document.getElementById('setting-tts');
    const sttEl = document.getElementById('setting-stt');
    const rmEl = document.getElementById('setting-reduce-motion');
    const dsEl = document.getElementById('setting-dialogue-scale');
    
    // Check if in text-only mode and warn user
    if (this.textOnlyMode && ((ttsEl && ttsEl.checked) || (sttEl && sttEl.checked))) {
      this.toast('Voice features disabled in text-only mode. Start a new game to re-enable.');
      this.closeModal('settings-modal');
      return;
    }
    
    this.settings.tts = !!(ttsEl && ttsEl.checked);
    this.settings.stt = !!(sttEl && sttEl.checked);
    this.settings.reduceMotion = !!(rmEl && rmEl.checked);
    const scale = parseFloat(dsEl && dsEl.value ? dsEl.value : '1');
    this.settings.dialogueScale = isNaN(scale) ? 1 : Math.max(0.9, Math.min(1.6, scale));
    localStorage.setItem('npcTherapySettings', JSON.stringify(this.settings));
    this.applySettings();
    this.updateSpeechButtonVisibility();
    // If TTS was disabled, stop any current speech
    if (!this.settings.tts) {
      if (this.ttsAudio && !this.ttsAudio.paused) {
        this.ttsAudio.pause();
        this.ttsAudio.currentTime = 0;
      }
      this.ttsQueue = [];
      this.speaking = false;
      this.showSpeakingIndicator(false);
    }
    
    // Update speech button visibility
    this.updateSpeechButtonVisibility();
    
    const ttsEl2 = document.getElementById('setting-tts'); if (ttsEl2) ttsEl2.checked = !!this.settings.tts;
    const sttEl2 = document.getElementById('setting-stt'); if (sttEl2) sttEl2.checked = !!this.settings.stt;
    const rmEl2 = document.getElementById('setting-reduce-motion'); if (rmEl2) rmEl2.checked = !!this.settings.reduceMotion;
    const dsEl2 = document.getElementById('setting-dialogue-scale'); if (dsEl2) dsEl2.value = String(this.settings.dialogueScale);
    this.closeModal('settings-modal');
    this.toast('Settings saved.');
  },
  resetSettings() {
    this.settings = { tts: true, stt: false, reduceMotion: false, dialogueScale: 1 };
    localStorage.setItem('npcTherapySettings', JSON.stringify(this.settings));
    this.applySettings();
    const ttsEl = document.getElementById('setting-tts'); if (ttsEl) ttsEl.checked = true;
    const sttEl = document.getElementById('setting-stt'); if (sttEl) sttEl.checked = false;
    const rmEl = document.getElementById('setting-reduce-motion'); if (rmEl) rmEl.checked = false;
    const dsEl = document.getElementById('setting-dialogue-scale'); if (dsEl) dsEl.value = 1;
    this.updateSpeechButtonVisibility();
    this.toast('Settings reset.');
  },
  loadSettings() {
    try {
      const raw = localStorage.getItem('npcTherapySettings');
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = {
          tts: parsed.tts !== false,
          stt: parsed.stt === true, // Explicitly default to false unless explicitly enabled
          reduceMotion: !!parsed.reduceMotion,
          dialogueScale: typeof parsed.dialogueScale === 'number' ? parsed.dialogueScale : 1,
        };
      } else {
        // First time - set default settings with STT disabled
        this.settings = { tts: true, stt: false, reduceMotion: false, dialogueScale: 1 };
        localStorage.setItem('npcTherapySettings', JSON.stringify(this.settings));
      }
    } catch (_) { /* ignore */ }
    
    // Load text-only mode state from localStorage
    const textOnlyStored = localStorage.getItem('npcTherapyTextOnlyMode');
    this.textOnlyMode = textOnlyStored === 'true';
    
    // If in text-only mode, ensure TTS and STT are disabled
    if (this.textOnlyMode) {
      this.settings.tts = false;
      this.settings.stt = false;
      this.sttEnabled = false;
    }
    
    // Update STT enabled state based on settings
    this.sttEnabled = this.settings.stt;
  },
  applySettings() {
    document.documentElement.style.setProperty('--dialogue-scale', String(this.settings.dialogueScale || 1));
    this.updateSpeechButtonVisibility();
  },

  // Update microphone button visibility based on STT settings
  updateSpeechButtonVisibility() {
    const micButton = document.getElementById('speech-recognition-btn');
    const inputField = document.getElementById('player-response');
    
    // Don't show microphone button if in text-only mode
    if (this.textOnlyMode || !this.settings.stt) {
      // STT disabled - remove microphone button if it exists
      if (micButton) {
        micButton.remove();
      }
      this.sttEnabled = false;
    } else {
      // STT enabled - add microphone button
      this.sttEnabled = true;
      if (!micButton && inputField) {
        this.addSpeechRecognitionButton();
      }
    }
  },

  // ===== Command Palette & Hotkeys =====
  bindCommandPalette() {
    const modal = document.getElementById('cmdk-modal');
    const input = document.getElementById('cmdk-input');
    const list = document.getElementById('cmdk-list');
    const closeBtn = document.getElementById('cmdk-close-btn');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeCommandPalette());
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) this.closeCommandPalette(); });
    if (input) input.addEventListener('input', () => this.updateCommandPaletteList());
    if (input) input.addEventListener('keydown', (e) => this.handleCmdkKeydown(e));

    window.addEventListener('keydown', (e) => {
      // Ctrl/Cmd+K opens palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openCommandPalette();
        return;
      }
      // Help modal on '?'
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        this.openHelp();
        return;
      }
      // '/' focuses main menu search
      if (e.key === '/' && document.getElementById('main-menu').classList.contains('active')) {
        const ms = document.getElementById('menu-search'); if (ms) { e.preventDefault(); ms.focus(); }
      }
      // Quick replies 1-3
      if (document.getElementById('therapy-session').classList.contains('active')) {
        if (['1','2','3'].includes(e.key)) {
          const idx = parseInt(e.key,10) - 1;
          const btn = document.querySelector(`#quick-replies .qr-btn:nth-child(${idx+1})`);
          if (btn) { e.preventDefault(); btn.click(); }
        }
      }
    });

    // Help modal controls
    const helpClose = document.getElementById('help-close-btn');
    if (helpClose) helpClose.addEventListener('click', () => this.closeHelp());
    const helpModal = document.getElementById('help-modal');
    if (helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) this.closeHelp(); });
  },

  openCommandPalette() {
    const modal = document.getElementById('cmdk-modal');
    const input = document.getElementById('cmdk-input');
    const list = document.getElementById('cmdk-list');
    if (!modal || !input || !list) return;
    modal.classList.add('active');
    input.value = '';
    this.updateCommandPaletteList();
    setTimeout(() => input.focus(), 0);
  },

  closeCommandPalette() {
    const modal = document.getElementById('cmdk-modal');
    if (modal) modal.classList.remove('active');
    // Restore focus to main menu search for quicker flow
    if (document.getElementById('main-menu').classList.contains('active')) {
      const ms = document.getElementById('menu-search');
      if (ms) setTimeout(() => ms.focus(), 0);
    }
  },

  updateCommandPaletteList() {
    const list = document.getElementById('cmdk-list');
    const q = (document.getElementById('cmdk-input')?.value || '').toLowerCase();
    if (!list) return;
    list.innerHTML = '';
    const results = this.npcs
      .map((npc, index) => ({ npc, index }))
      .filter(({ npc, index }) => {
        if (!this.unlockedNPCs.has(index)) return false;
        if (!q) return true;
        const hay = `${npc.name} ${npc.origin} ${npc.crisis}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 30);

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cmdk-item';
      empty.innerHTML = '<div></div><div class="cmdk-meta"><div class="cmdk-name">No results</div><div class="cmdk-sub">Try different keywords.</div></div>';
      list.appendChild(empty);
      return;
    }

    results.forEach(({ npc, index }, i) => {
      const item = document.createElement('div');
      item.className = `cmdk-item${i===0?' active':''}`;
      item.setAttribute('role','option');
      item.setAttribute('data-index', String(index));
      item.innerHTML = `<img class="cmdk-thumb" src="${npc.habitat}" alt=""><div class="cmdk-meta"><div class="cmdk-name">${npc.name}</div><div class="cmdk-sub">${npc.session} • ${npc.origin}</div></div>`;
      item.addEventListener('click', () => { this.closeCommandPalette(); this.startSession(index); });
      list.appendChild(item);
    });
  },

  handleCmdkKeydown(e) {
    const list = document.getElementById('cmdk-list');
    const items = Array.from(list.querySelectorAll('.cmdk-item'));
    if (!items.length) return;
    const currentIdx = items.findIndex(el => el.classList.contains('active'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(items.length - 1, currentIdx + 1);
      items[currentIdx]?.classList.remove('active');
      items[next].classList.add('active');
      items[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, currentIdx - 1);
      items[currentIdx]?.classList.remove('active');
      items[prev].classList.add('active');
      items[prev].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = items.find(el => el.classList.contains('active'));
      const idx = active ? parseInt(active.dataset.index, 10) : NaN;
      if (!isNaN(idx)) { this.closeCommandPalette(); this.startSession(idx); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.closeCommandPalette();
    }
  },

  // ===== Autosave helpers =====
  getSaveSnapshot() {
    return {
      healed: Array.from(this.healedNPCs),
      unlocked: Array.from(this.unlockedNPCs),
      mentalState: this.therapistMentalState,
      collectibles: this.collectibles,
      time: this.gameTime,
      award: this.chromaAwardGiven,
      credits: this.communityCredits,
      // Add: persist npcNotes
      npcNotes: this.npcNotes,
    };
  },

  applySaveData(saveData) {
    this.healedNPCs = new Set(saveData.healed || []);
    this.healedVersion++;
    if (saveData.unlocked && saveData.unlocked.length > 0) {
      this.unlockedNPCs = new Set(saveData.unlocked);
      this.unlockedVersion++;
    } else {
      const finalIds = new Set(['hackathon_judge','meta_receptionist','therapist_shadow','the_therapist']);
      this.unlockedNPCs = new Set(this.npcs.map((n,i)=>({n,i})).filter(item=>!finalIds.has(item.n.id)).map(item=>item.i));
    }
    this.therapistMentalState = saveData.mentalState || 0;
    this.collectibles = saveData.collectibles || [];
    this.gameTime = saveData.time || 0;
    this.chromaAwardGiven = saveData.award || false;
    this.communityCredits = saveData.credits || [];
    // Add: restore npcNotes
    this.npcNotes = saveData.npcNotes || {};
  },

  autosave() {
    try {
      const snapshot = this.getSaveSnapshot();
      localStorage.setItem('autosave_v1', JSON.stringify(snapshot));
    } catch (_) {}
  },

  loadAutosaveIfAvailable() {
    try {
      const raw = localStorage.getItem('autosave_v1');
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.applySaveData(data);
      
      // Ensure NPC edits are loaded after restoring save data
      this.loadNpcEdits();
      
      this.startTime = Date.now() - (this.gameTime * 1000);
      this.startTimer();
      this.updateStats(); this.renderCommunityCredits(); this.updateMenuRosterView(); this.updateTherapistState();
      this.toast('Progress restored.');
      this.startAutosave();
      return true;
    } catch (_) {
      return false;
    }
  },

  startAutosave() {
    if (this._autosaveTimer) clearInterval(this._autosaveTimer);
    this._autosaveTimer = setInterval(() => this.autosave(), 30000); // every 30s
  },

  stopAutosave() {
    if (this._autosaveTimer) { clearInterval(this._autosaveTimer); this._autosaveTimer = null; }
  },

  hasAutosave() { try { return !!localStorage.getItem('autosave_v1'); } catch (_) { return false; } },
  continueAutosave() { if (this.loadAutosaveIfAvailable()) this.showScreen('main-menu'); },

  async initMultiplayer() {
    try {
      const Sock = window.WebsimSocket || (window.__WebsimSocketShim = window.__WebsimSocketShim || function(){ return { initialize:async()=>{}, presence:{}, roomState:{}, peers:{}, clientId:'local', updatePresence(){}, updateRoomState(){}, subscribePresence(){ return ()=>{}; }, subscribeRoomState(){ return ()=>{}; }, subscribePresenceUpdateRequests(){ return ()=>{}; }, send(){}, onmessage:null }; });
      this.room = new Sock();
      await this.room.initialize();
      // Ensure shared npcEdits exists
      try {
        const rs = this.room.roomState || {};
        if (!rs.npcEdits) this.room.updateRoomState({ npcEdits: {} });
      } catch (_) {}
      this.room.updatePresence({ currentNPC: null });
      this.room.subscribePresence(() => this.updatePeersUI());
      // Apply shared edits on any room state change
      this.room.subscribeRoomState(() => {
        this.renderSharedInsights();
        this.loadNpcEditsFromRoomState();
      });
      this.room.onmessage = (event) => {
        const data = event.data || {};
        if (data.type === 'reaction' && data.emoji) this.renderReaction(data.emoji, data.clientId);
      };
      this.updatePeersUI();
      // Initial apply if npcEdits already present
      this.loadNpcEditsFromRoomState();
      // NEW: Save current NPC data (images + descriptions) globally so all clients see the same roster
      this.saveAllNpcImages();
    } catch (e) { console.warn('Multiplayer unavailable:', e); }
  },

  updatePeersUI() {
    const wrap = document.getElementById('cot-avatars');
    if (!wrap || !this.room) return;
    wrap.innerHTML = '';
    const peers = this.room.peers || {};
    Object.keys(peers).forEach((id) => {
      const img = document.createElement('img');
      img.src = peers[id].avatarUrl || '';
      img.alt = peers[id].username || 'peer';
      wrap.appendChild(img);
    });
  },

  sendReaction(emoji) {
    this.renderReaction(emoji, this.room?.clientId || 'local');
    try { this.room && this.room.send({ type: 'reaction', emoji, echo: false }); } catch (_) {}
  },

  renderReaction(emoji, fromId) {
    const box = document.getElementById('cot-reactions');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'reaction';
    el.textContent = emoji;
    const x = 20 + Math.random()*60; const y = 60 + Math.random()*20;
    el.style.left = `${x}%`; el.style.bottom = `${y}px`;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  },

  shareInsight(text) {
    if (!this.room || !this.currentNPC) return;
    const npcId = this.currentNPC.id;
    const key = `${this.room.clientId || 'local'}_${Date.now()}`;
    const me = (this.room.peers && this.room.clientId && this.room.peers[this.room.clientId]?.username) || 'You';
    const payload = {};
    payload[npcId] = {};
    payload[npcId][key] = { text, author: me, ts: Date.now() };
    try {
      this.room.updateRoomState({ sharedInsights: payload });
    } catch (_) {}
    this.renderSharedInsights();
  },

  renderSharedInsights() {
    const box = document.getElementById('cot-insights');
    if (!box) return;
    box.innerHTML = '';
    const npcId = this.currentNPC?.id;
    const all = (this.room && this.room.roomState && this.room.roomState.sharedInsights) || {};
    const entries = npcId ? all[npcId] : null;
    if (!entries) return;
    Object.keys(entries).slice(-8).forEach((k) => {
      const it = entries[k];
      const chip = document.createElement('div');
      chip.className = 'insight-chip';
      chip.textContent = it.text;
      const by = document.createElement('span');
      by.className = 'by';
      by.textContent = `— ${it.author || 'Peer'}`;
      chip.appendChild(by);
      box.appendChild(chip);
    });
  },

  exportTranscript() {
    if (!this.currentNPC) { this.toast('No active session.'); return; }
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const header = `NPC Therapy Transcript\nPatient: ${this.currentNPC.name}\nSession: ${this.currentNPC.session}\nWhen: ${new Date().toLocaleString()}\n\n`;
    const body = this.conversationHistory
      .filter(m => m.role !== 'system')
      .map(m => (m.role === 'assistant' ? 'Patient' : 'Therapist') + ': ' + m.content)
      .join('\n');
    const blob = new Blob([header + body + '\n'], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `transcript_${this.currentNPC.id}_${ts}.txt` });
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
    this.toast('Transcript downloaded.');
  },

  importNpcFromJson() {
    try {
      const raw = document.getElementById('json-npc-input')?.value || '';
      const data = JSON.parse(raw);
      const name = String(data.name || '').trim();
      const origin = String(data.origin || '').trim();
      const crisis = String(data.crisis || '').trim();
      if (!name || !origin || !crisis) { this.toast('JSON must include name, origin, crisis.'); return; }
      const npcFile = document.getElementById('json-npc-image-upload')?.files?.[0];
      const cardFile = document.getElementById('json-card-image-upload')?.files?.[0];
      this.showLoader();
      Promise.resolve().then(async () => {
        let uploadedNpcUrl = null, uploadedCardUrl = null;
        try { 
          if (npcFile) uploadedNpcUrl = URL.createObjectURL(npcFile); 
        } catch(_) { this.toast('NPC image upload failed.'); }
        try { 
          if (cardFile) uploadedCardUrl = URL.createObjectURL(cardFile); 
        } catch(_) { this.toast('Card photo upload failed.'); }
        const imageUrl = uploadedNpcUrl || (data.image && String(data.image)) || '/therapy_office.png';
        const opening = String(data.opening_statement || crisis);
        this.addNewNpc(name, origin, crisis, imageUrl, opening);
        if (uploadedCardUrl) this.collectibles.push({ npc: name, image: uploadedCardUrl, prompt: 'Player card photo' });
        // Clear upload terminals and refresh roster/journal
        const npcInput = document.getElementById('json-npc-image-upload');
        const cardInput = document.getElementById('json-card-image-upload');
        if (npcInput) npcInput.value = '';
        if (cardInput) cardInput.value = '';
        this.scheduleUpdateMenuRosterView();
        this.populateFullJournal();
        this.toast(`Imported: ${name}`);
      }).finally(() => this.hideLoader());
    } catch (_) { this.toast('Invalid JSON.'); }
  },

  openNpcEdit(index) {
    this.editingNpcIndex = index;
    const npc = this.npcs[index];
    document.getElementById('npc-edit-name').value = npc.name || '';
    document.getElementById('npc-edit-origin').value = npc.origin || '';
    document.getElementById('npc-edit-crisis').value = npc.crisis || '';
    const prev = document.getElementById('npc-edit-preview');
    prev.innerHTML = `<img src="${npc.habitat}" alt="" style="max-width:100%;"><p>Office: <img src="${npc.officeImage}" alt="" style="max-width:100%;"></p>`;
    document.getElementById('npc-edit-modal').classList.add('active');
    const saveBtn = document.getElementById('npc-edit-save-btn');
    saveBtn.onclick = () => this.saveNpcEdit();
  },

  async saveNpcEdit() {
    const idx = this.editingNpcIndex; if (idx == null) return;
    const npc = this.npcs[idx];
    const name = document.getElementById('npc-edit-name').value.trim();
    const origin = document.getElementById('npc-edit-origin').value.trim();
    const crisis = document.getElementById('npc-edit-crisis').value.trim();
    const habFile = document.getElementById('npc-edit-habitat-upload').files[0];
    const offFile = document.getElementById('npc-edit-office-upload').files[0];
    this.showLoader();
    try {
      let habitatUrl = npc.habitat, officeUrl = npc.officeImage;
      if (habFile) { 
        try { habitatUrl = URL.createObjectURL(habFile); } 
        catch(_) { this.toast('Main image upload failed.'); } 
      }
      if (offFile) { 
        try { officeUrl = URL.createObjectURL(offFile); } 
        catch(_) { this.toast('Office image upload failed.'); } 
      }
      npc.name = name || npc.name; npc.origin = origin || npc.origin; npc.crisis = crisis || npc.crisis;
      npc.habitat = habitatUrl; npc.officeImage = officeUrl;
      this.persistNpcEdit(npc);
      // Clear upload terminals
      document.getElementById('npc-edit-habitat-upload').value = '';
      document.getElementById('npc-edit-office-upload').value = '';
      this.closeModal('npc-edit-modal');
      // Refresh all characters
      this.scheduleUpdateMenuRosterView();
      this.populateFullJournal();

      // If this NPC is currently active in a session, immediately reflect updated images.
      if (this.currentNPC && this.currentNPC.id === npc.id) {
        const habitat = document.getElementById('habitat-bg');
        if (habitat) habitat.style.backgroundImage = officeUrl ? `url(${officeUrl})` : '';
        const portraitEl = document.getElementById('npc-portrait');
        if (portraitEl) portraitEl.src = habitatUrl || portraitEl.src;
      }

      this.toast('Character saved.');
    } finally { this.hideLoader(); }
  },

  persistNpcEdit(npc) {
    try {
      const editData = { 
        name: npc.name, 
        origin: npc.origin, 
        crisis: npc.crisis, 
        habitat: npc.habitat, 
        officeImage: npc.officeImage 
      };
      // Broadcast to all clients via shared room state
      if (this.room) {
        const payload = { npcEdits: {} };
        payload.npcEdits[npc.id] = editData;
        this.room.updateRoomState(payload);
      }
      // Local fallback for offline usage
      const edits = JSON.parse(localStorage.getItem('npcEdits') || '{}');
      edits[npc.id] = editData;
      localStorage.setItem('npcEdits', JSON.stringify(edits));
      // Refresh UI to reflect changes
      this.updateMenuRosterView();
      this.populateFullJournal();
      this.npcEditsVersion++;
    } catch (error) {
      console.warn('NPC Therapy: Error saving NPC edit:', error);
      this.toast('Error saving edit. Please try again.');
    }
  },

  // Manually refresh NPC edits (useful for debugging or manual reload)
  refreshNpcEdits() {
    console.log('NPC Therapy: Manually refreshing NPC edits...');
    this.loadNpcEdits();
    this.updateMenuRosterView();
    this.populateFullJournal();
    this.toast('NPC edits refreshed. Check console for details.');
  },

  loadNpcEdits() {
    try {
      const editsRaw = localStorage.getItem('npcEdits') || '{}';
      const edits = JSON.parse(editsRaw);
      
      if (Object.keys(edits).length === 0) {
        console.log('NPC Therapy: No saved NPC edits found');
        return;
      }
      
      console.log('NPC Therapy: Loading NPC edits for', Object.keys(edits).length, 'NPCs');
      
      this.npcs.forEach((n) => {
        const e = edits[n.id]; 
        if (!e) return;
        
        console.log(`NPC Therapy: Applying edit to ${n.id}: ${e.name || 'no name change'}`);
        
        // Apply all available edits
        if (e.name && e.name !== n.name) {
          n.name = e.name;
          console.log(`  - Updated name: ${n.name}`);
        }
        if (e.origin && e.origin !== n.origin) {
          n.origin = e.origin;
          console.log(`  - Updated origin: ${n.origin}`);
        }
        if (e.crisis && e.crisis !== n.crisis) {
          n.crisis = e.crisis;
          console.log(`  - Updated crisis: ${n.crisis}`);
        }
        if (e.habitat && e.habitat !== n.habitat) {
          n.habitat = e.habitat;
          console.log(`  - Updated habitat: ${n.habitat}`);
        }
        if (e.officeImage && e.officeImage !== n.officeImage) {
          n.officeImage = e.officeImage;
          console.log(`  - Updated office image: ${n.officeImage}`);
        }
      });
      
      console.log('NPC Therapy: NPC edits loaded successfully');
      this.npcEditsVersion++;
      
    } catch (error) {
      console.warn('NPC Therapy: Error loading NPC edits:', error);
    }
  },

  loadNpcEditsFromRoomState() {
    try {
      const rs = (this.room && this.room.roomState) || {};
      const edits = rs.npcEdits || {};
      if (!edits || Object.keys(edits).length === 0) return;
      this.npcs.forEach((n) => {
        const e = edits[n.id];
        if (!e) return;
        if (e.name && e.name !== n.name) n.name = e.name;
        if (e.origin && e.origin !== n.origin) n.origin = e.origin;
        if (e.crisis && e.crisis !== n.crisis) n.crisis = e.crisis;
        if (e.habitat && e.habitat !== n.habitat) n.habitat = e.habitat;
        if (e.officeImage && e.officeImage !== n.officeImage) n.officeImage = e.officeImage;
      });
      // Update all views that rely on NPC data
      this.scheduleUpdateMenuRosterView();
      this.populateFullJournal();
      if (this.currentNPC) {
        const habitat = document.getElementById('habitat-bg');
        const portraitEl = document.getElementById('npc-portrait');
        const updated = this.npcs.find(n => n.id === this.currentNPC.id);
        if (habitat && updated) habitat.style.backgroundImage = updated.officeImage ? `url(${updated.officeImage})` : '';
        if (portraitEl && updated) portraitEl.src = updated.habitat || portraitEl.src;
      }
      this.npcEditsVersion++;
    } catch (error) {
      console.warn('NPC Therapy: Error loading NPC edits from room state:', error);
    }
  },

  // ===== Permission Request System (Just-in-time) =====
  setupPermissionModalEvents() {
    const allowBtn = document.getElementById('permission-allow-btn');
    const textOnlyBtn = document.getElementById('permission-text-only-btn');
    const modal = document.getElementById('permission-request-modal');
    
    if (allowBtn) {
      allowBtn.addEventListener('click', () => this.handlePermissionRequest('allow'));
    }
    
    if (textOnlyBtn) {
      textOnlyBtn.addEventListener('click', () => this.handlePermissionRequest('textOnly'));
    }
    
    // Close modal on background click
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          // Don't allow closing without choosing
          this.toast('Please choose an option to continue.');
        }
      });
    }
  },

  showPermissionRequestModal() {
    this.permissionRequestInProgress = true;
    const modal = document.getElementById('permission-request-modal');
    if (modal) {
      modal.classList.add('active');
    }
  },

  hidePermissionRequestModal() {
    const modal = document.getElementById('permission-request-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.permissionRequestInProgress = false;
  },

  async handlePermissionRequest(choice) {
    this.hidePermissionRequestModal();
    this.permissionsRequested = true;
    
    if (choice === 'textOnly') {
      // Text-only mode: disable both TTS and STT
      this.enableTextOnlyMode();
      this.continueSessionAfterPermission();
      return;
    }
    
    if (choice === 'allow') {
      // Request permissions for both TTS and STT
      await this.requestBrowserPermissions();
      this.continueSessionAfterPermission();
    }
  },

  async requestBrowserPermissions() {
    try {
      // Request microphone access for STT
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // We got permission, stop the stream immediately
          stream.getTracks().forEach(track => track.stop());
          this.settings.stt = true;
          this.sttEnabled = true;
        } catch (error) {
          console.warn('Microphone permission denied or failed:', error);
          this.settings.stt = false;
          this.sttEnabled = false;
        }
      } else {
        this.settings.stt = false;
        this.sttEnabled = false;
      }
      
      // Request TTS permission by initializing speech synthesis
      if ('speechSynthesis' in window) {
        try {
          // Test TTS by getting voices - this will trigger browser permission
          const voices = speechSynthesis.getVoices();
          if (voices.length === 0) {
            // Wait for voices to load, which may trigger permission
            await new Promise((resolve) => {
              const timeout = setTimeout(() => resolve(), 1000);
              speechSynthesis.onvoiceschanged = () => {
                clearTimeout(timeout);
                resolve();
              };
            });
          }
          this.settings.tts = true;
        } catch (error) {
          console.warn('TTS initialization failed:', error);
          this.settings.tts = false;
        }
      } else {
        this.settings.tts = false;
      }
      
      // Save settings
      localStorage.setItem('npcTherapySettings', JSON.stringify(this.settings));
      this.applySettings();
      
      // Clear text-only mode since we got permissions
      if (this.settings.stt || this.settings.tts) {
        this.disableTextOnlyMode();
      }
      
      // Show appropriate toast messages
      if (this.settings.stt && this.settings.tts) {
        this.toast('Voice features enabled! 🎙️🔊');
      } else if (this.settings.stt) {
        this.toast('Microphone enabled! Text-to-speech unavailable.');
      } else if (this.settings.tts) {
        this.toast('Text-to-speech enabled! Microphone unavailable.');
      } else {
        this.toast('Voice features unavailable. Text-only mode enabled.');
        this.enableTextOnlyMode();
      }
      
    } catch (error) {
      console.error('Permission request failed:', error);
      this.toast('Permission request failed. Text-only mode enabled.');
      this.enableTextOnlyMode();
    }
  },

  enableTextOnlyMode() {
    this.textOnlyMode = true;
    this.settings.tts = false;
    this.settings.stt = false;
    this.sttEnabled = false;
    localStorage.setItem('npcTherapySettings', JSON.stringify(this.settings));
    localStorage.setItem('npcTherapyTextOnlyMode', 'true');
    this.applySettings();
    this.updateSpeechButtonVisibility();
    this.toast('Text-only mode enabled.');
  },

  disableTextOnlyMode() {
    this.textOnlyMode = false;
    localStorage.removeItem('npcTherapyTextOnlyMode');
    this.applySettings();
    this.updateSpeechButtonVisibility();
  },

  continueSessionAfterPermission() {
    if (this.currentNPC) {
      // Resume the session that was interrupted
      this.showScreen('therapy-session');
      this.showDialogue(this.currentNPC.opening_statement);
      this.updateSpeechButtonVisibility();
    }
  },
};

window.onYouTubeIframeAPIReady = function() {
  game.ytApiReady = true;
  if (document.getElementById('radio-modal').classList.contains('active')) game.createYtPlayer();
};

window.game = game;
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Player Two Bridge first
  if (PLAYER_TWO_AVAILABLE && typeof PlayerTwoConfig !== 'undefined') {
    try {
      await PlayerTwoBridge.init(PlayerTwoConfig);
      console.log('✓ Player Two Bridge initialized');
    } catch (error) {
      console.error('Player Two initialization failed:', error);
    }
  }
  
  game.init();
  // Start fresh; user can choose CONTINUE if autosave exists
  game.newGame();
});

window.addEventListener('error', function(event) {
  if (event.message === 'Script error.') { console.error('A cross-origin script error occurred.'); return; }
  const errorMsg = `Unhandled Error:
    Message: ${event.message}
    File: ${event.filename}
    Line: ${event.lineno}, Col: ${event.colno}`;
  console.error(errorMsg);
});