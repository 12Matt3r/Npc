import { loadNpcDatabase } from '../npc-data.js';
import {
  PLAYER_TWO_AVAILABLE,
  ADMIN_PASSWORD,
  FEMALE_VOICES,
  MALE_VOICES,
  NPC_VOICE_MAP,
  GENDER_HEURISTIC_FEMALE_NAMES,
  GENDER_HEURISTIC_MALE_NAMES
} from './data/constants.js';
import { AudioPlayer, WebSpeechTTS } from './managers/AudioManager.js';
import { SpeechRecognitionSystem } from './managers/InputManager.js';
import { UIManager } from './managers/UIManager.js';
import { AudioVisualizer } from './ui/AudioVisualizer.js';
import { ResourceManager } from './managers/ResourceManager.js';
import { MapRenderer } from './ui/MapRenderer.js';
import {
  sleep,
  withTimeout,
  debounce,
  preloadBackground,
  loadImage,
  attachImageLoadingEffects
} from './utils/helpers.js';

/**
 * Main Game Controller
 * Manages game state, NPC interactions, and SDK integration.
 */
export class Game {
  constructor() {
    /** @type {Array<Object>} List of NPC definitions */
    this.npcs = [];
    this.currentNPC = null;
    this.currentNPCId = null;
    this.currentDialogueIndex = 0;
    this.healedNPCs = new Set();
    this.unlockedNPCs = new Set();
    this.therapistMentalState = 0;
    this.currentPage = 0;
    this.journalPages = [];
    this.radioPlaylist = 'https://youtube.com/playlist?list=PLPug0RGgea9rPoVpu8ytw7dRHLZb4RNZc&si=VqmXrovnWi-y_aj4';
    this.podcastLink = 'https://youtu.be/dLWHNiePR8g?si=EdHExHPDwkLz7NHi';
    this.pathSelfTimer = null;
    this.audioPlayer = new AudioPlayer();
    this.speechRecognition = new SpeechRecognitionSystem();
    this.ttsSystem = new WebSpeechTTS();
    this.startTime = null;
    this.gameTime = 0;
    this.timerInterval = null;
    this.chromaAwardGiven = false;
    this.previousScreen = 'habitat-view';
    this.conversationHistory = [];
    this.turnCount = 0;
    this.miniGameActive = false;
    this.mapState = { zoom: 1.0, panX: 0, panY: 0, isPanning: false, lastX: 0, lastY: 0, nodes: [] };
    this.communityCredits = [];
    this.creditsEditMode = false;
    this.editingCreditIndex = null;
    this.radioSource = null;
    this.bondScores = {};
    this.ytPlayer = null;
    this.ytApiReady = false;
    this.ttsAudio = null;
    this.pathSelfFloatVisible = false;
    this.imageCache = new Map();
    this.lastRenderSignature = '';
    this.menuRenderSignature = '';
    this.mapRenderScheduled = false;
    this.unlockedVersion = 0;
    this.healedVersion = 0;
    this.generatingResponse = false;
    this._menuRenderScheduled = false;
    this._skipTyping = false;
    this.settings = { tts: true, stt: false, reduceMotion: false, dialogueScale: 1 };
    this._autosaveTimer = null;
    this.room = null;
    this.npcNotes = {};
    this.editModeEnabled = false;
    this.editingNpcIndex = null;
    this.npcEditsVersion = 0;
    this.ttsCache = new Map();
    this.ttsQueue = [];
    this.speaking = false;
    this.speechListening = false;
    this.sttEnabled = false;
    this.firstSessionStarted = false;
    this.permissionsRequested = false;
    this.permissionRequestInProgress = false;
    this.textOnlyMode = false;
    this._lastMenuItems = [];
    this.sessionArchives = {}; // Stores past session transcripts by NPC ID

    this.uiManager = new UIManager(this);
    this.resourceManager = new ResourceManager();
    this.mapRenderer = null; // Initialized on demand
    this.audioVisualizer = new AudioVisualizer('stt-visualizer');
  }

  showLoader() { this.uiManager.showLoader(); }
  hideLoader() { this.uiManager.hideLoader(); }
  toast(msg) { this.uiManager.toast(msg); }

  async generateImage(prompt, opts = {}) {
    if (PLAYER_TWO_AVAILABLE && (window.PlayerTwoBridge.authToken || window.PlayerTwoBridge.clientId)) {
      const { width, height } = opts;
      const image = await window.PlayerTwoBridge.generateImage(prompt, width, height);
      if (image) return image;
    }
    return '/therapy_office.png';
  }

  async callWebsimTTS(params) {
    const { text, voice } = params || {};
    if (!this.settings.tts || !text || this.textOnlyMode) return { url: null };
    try {
      const character = this.currentNPC;
      if (PLAYER_TWO_AVAILABLE && window.PlayerTwoBridge.getVoiceIdForCharacter) {
        const p2VoiceId = window.PlayerTwoBridge.getVoiceIdForCharacter(character);
        try {
          const audioUrl = await window.PlayerTwoBridge.speakText(text, p2VoiceId, { speed: 0.95 });
          if (audioUrl) return { url: audioUrl };
        } catch (err) { console.warn('Player Two TTS failed, falling back:', err); }
      }
      return await this.fallbackBrowserTTS(text);
    } catch (error) { console.warn('TTS failed, falling back to browser TTS:', error); return await this.fallbackBrowserTTS(text); }
  }

  async fallbackBrowserTTS(text) {
    if (!('speechSynthesis' in window)) return { url: null };
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; utterance.pitch = 1.0; utterance.volume = 1.0;
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      speechSynthesis.speak(utterance);
      return { url: null };
    } catch (error) { console.warn('Browser TTS also failed:', error); return { url: null }; }
  }

  getVoiceIdForCharacter(character) {
    if (!character) return 'EXAVITQu4vr4xnSDxMaL';
    const characterIndex = this.getCharacterIndex(character);
    const gender = this.getCharacterGender(character);
    if (character.name && this.npcs) {
      const nameHash = this.hashString(character.name);
      const voiceIndex = nameHash % (gender === 'male' ? MALE_VOICES.length : FEMALE_VOICES.length);
      return gender === 'male' ? MALE_VOICES[voiceIndex] : FEMALE_VOICES[voiceIndex];
    }
    const voicePool = gender === 'male' ? MALE_VOICES : FEMALE_VOICES;
    return voicePool[characterIndex % voicePool.length];
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  getCharacterIndex(character) {
    if (!this.npcs || this.npcs.length === 0) return 0;
    const index = this.npcs.findIndex(npc => npc.id === character.id || npc.name === character.name);
    return index >= 0 ? index : 0;
  }

  getCharacterGender(character) {
    const name = character.name ? character.name.toLowerCase() : '';
    if (GENDER_HEURISTIC_FEMALE_NAMES.some(n => name.includes(n))) return 'female';
    if (GENDER_HEURISTIC_MALE_NAMES.some(n => name.includes(n))) return 'male';
    return 'female';
  }

  async performTTS(params) {
    try {
      const res = await this.callWebsimTTS(params);
      return res || { url: null };
    } catch (error) {
      console.warn('TTS failed:', error);
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
  }

  getVoiceFromMap(p2Voice) {
    const voiceMap = { 'en-female': 'female', 'en-male': 'male' };
    return voiceMap[p2Voice] || 'default';
  }

  init() {
    this.loadCommunityCredits();
    this.renderCommunityCredits();
    this.npcs = loadNpcDatabase();
    if (PLAYER_TWO_AVAILABLE && !window.PlayerTwoBridge.authToken && window.PlayerTwoBridge.clientId) {
      this.promptForLogin();
    }
    this.reorderAndRenumber();
    this.loadNpcEdits();
    this.sttEnabled = this.settings.stt;
    document.getElementById('send-response-btn').addEventListener('click', () => this.sendPlayerResponse());
    const playerResponse = document.getElementById('player-response');
    if (playerResponse) {
      playerResponse.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendPlayerResponse(); });
      playerResponse.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.sendPlayerResponse(); } });
    }
    document.getElementById('conclude-session-btn').addEventListener('click', () => this.concludeSession());
    this.addSpeechRecognitionButton();
    const radioBtnEl = document.getElementById('radio-btn'); if (radioBtnEl) radioBtnEl.addEventListener('click', () => this.openRadio());
    const pathBtnEl = document.getElementById('path-to-self-btn'); if (pathBtnEl) pathBtnEl.addEventListener('click', () => this.openPathToSelf());
    const genBtn = document.getElementById('creator-generate-btn'); if (genBtn) genBtn.addEventListener('click', () => this.generateCustomNpc());
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('hamburger-dropdown');
      const hamburger = document.getElementById('hamburger-btn');
      if (dropdown && dropdown.classList.contains('active')) {
        if (!dropdown.contains(e.target) && !hamburger.contains(e.target)) { dropdown.classList.remove('active'); }
      }
    });
    const randBtn = document.getElementById('creator-randomize-btn'); if (randBtn) randBtn.addEventListener('click', () => this.generateRandomNpc());
    const importBtn = document.getElementById('json-npc-import-btn'); if (importBtn) importBtn.addEventListener('click', () => this.importNpcFromJson());
    const jsonTa = document.getElementById('json-npc-input');
    if (jsonTa) {
      ['dragover','dragenter'].forEach(ev=>jsonTa.addEventListener(ev,(e)=>{ e.preventDefault(); jsonTa.classList.add('drop-hover'); }));
      ['dragleave','dragend','drop'].forEach(ev=>jsonTa.addEventListener(ev,()=>jsonTa.classList.remove('drop-hover')));
      jsonTa.addEventListener('drop', async (e) => {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0]; if (!f) return;
        if (f.type === 'application/json' || f.name.toLowerCase().endsWith('.json')) { try { jsonTa.value = await f.text(); this.toast('JSON loaded. Click IMPORT NPC.'); } catch(_) { this.toast('Could not read JSON file.'); } }
      });
    }
    document.querySelectorAll('.btn').forEach(btn => btn.addEventListener('click', () => this.audioPlayer.playSound('confirm')));
    document.querySelectorAll('.send-btn, .map-btn').forEach(btn => btn.addEventListener('click', () => this.audioPlayer.playSound('confirm')));
    this.initMapControls();
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
    const debouncedMap = debounce(() => this.scheduleRenderConnectionMap(), 150);
    window.addEventListener('resize', debouncedMap);
    const pr = document.getElementById('player-response');
    if (pr) {
      pr.addEventListener('focus', () => pr.placeholder = 'Type your response… or use the microphone button');
      pr.addEventListener('blur', () => pr.placeholder = 'Type your response...');
    }
    this.setToolbarTitles();
    this.startHints();
    const contBtn = document.getElementById('continue-btn');
    if (contBtn) {
      if (this.hasAutosave()) { contBtn.style.display = 'inline-block'; contBtn.onclick = () => this.continueAutosave(); }
      else contBtn.style.display = 'none';
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
    const skipBtn = document.getElementById('skip-typing-btn'); if (skipBtn) skipBtn.addEventListener('click', () => { this._skipTyping = true; });
    this.loadSettings(); this.applySettings();
    const ttsEl = document.getElementById('setting-tts'); if (ttsEl) ttsEl.checked = !!this.settings.tts;
    const sttEl = document.getElementById('setting-stt'); if (sttEl) sttEl.checked = !!this.settings.stt;
    const rmEl = document.getElementById('setting-reduce-motion'); if (rmEl) rmEl.checked = !!this.settings.reduceMotion;
    const dsEl = document.getElementById('setting-dialogue-scale'); if (dsEl) dsEl.value = this.settings.dialogueScale;
    this.bindCommandPalette();
    window.addEventListener('beforeunload', () => { try { this.autosave(); } catch (_) {} });
    this.setupPermissionModalEvents();
    this.initMultiplayer();
    window.addEventListener('beforeunload', async () => { if (PLAYER_TWO_AVAILABLE) { await window.PlayerTwoBridge.killAllNPCs(); } });
  }

  addSpeechRecognitionButton() {
    if (!this.sttEnabled || !this.settings.stt) return;
    const inputArea = document.getElementById('player-input-area');
    if (!inputArea) return;
    const micButton = document.createElement('button');
    micButton.id = 'speech-recognition-btn'; micButton.className = 'mic-btn'; micButton.title = 'Start speech recognition (V)'; micButton.innerHTML = '🎤';
    micButton.style.cssText = `position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: #444; border: none; color: white; padding: 8px; border-radius: 50%; cursor: pointer; font-size: 16px; transition: all 0.3s ease;`;
    const inputField = document.getElementById('player-response');
    if (inputField) {
      inputField.style.position = 'relative'; inputField.style.paddingRight = '50px'; inputField.parentElement.appendChild(micButton);
      micButton.addEventListener('click', () => this.toggleSpeechRecognition());
    }
  }

  toggleSpeechRecognition() {
    if (this.textOnlyMode) { this.toast('Speech recognition unavailable in text-only mode'); return; }
    if (!this.settings.stt) { this.toast('Speech-to-text is disabled in settings'); return; }
    if (this.speechListening) { this.stopSpeechRecognition(); } else { this.startSpeechRecognition(); }
  }

  startSpeechRecognition() {
    if (!this.speechRecognition.supported) { this.toast('Speech recognition not supported in this browser'); return; }
    const input = document.getElementById('player-response');
    if (!input) return;
    const micButton = document.getElementById('speech-recognition-btn');
    this.speechRecognition.start(
      (interimTranscript, finalTranscript) => { if (interimTranscript) { input.value = interimTranscript; micButton.style.background = '#e74c3c'; micButton.innerHTML = '🔴'; } },
      (error) => { console.warn('Speech recognition error:', error); this.toast('Speech recognition error: ' + error.message); this.stopSpeechRecognition(); },
      () => { this.speechListening = true; input.focus(); micButton.style.background = '#e74c3c'; micButton.innerHTML = '🔴'; this.toast('Listening... Speak now'); },
      (ctx, stream) => { this.audioVisualizer.attachToContext(ctx, stream); }
    );
  }

  stopSpeechRecognition() {
    this.speechRecognition.stop();
    this.audioVisualizer.stop();
    this.speechListening = false;
    const micButton = document.getElementById('speech-recognition-btn');
    if (micButton) { micButton.style.background = '#444'; micButton.innerHTML = '🎤'; }
  }

  newGame() {
    this.healedNPCs.clear(); this.unlockedVersion = 0; this.healedVersion = 0;
    const finalIds = new Set(['hackathon_judge','meta_receptionist','therapist_shadow','the_therapist']);
    this.unlockedNPCs = new Set(this.npcs.map((n,i)=>({n,i})).filter(item=>!finalIds.has(item.n.id)).map(item=>item.i));
    this.therapistMentalState = 0; this.collectibles = []; this.currentPage = 0;
    this.startTime = Date.now(); this.gameTime = 0; this.chromaAwardGiven = false;
    this.communityCredits = []; this.saveCommunityCredits(); this.renderCommunityCredits();
    this.resetMapView(); this.startTimer(); this.showScreen('main-menu'); this.updateMenuRosterView(); this.updateStats();
    this.firstSessionStarted = false; this.permissionsRequested = false; this.permissionRequestInProgress = false; this.textOnlyMode = false;
    this.settings.tts = true; this.settings.stt = this.settings.stt || false;
    try { localStorage.setItem('npcTherapySettings', JSON.stringify(this.settings)); localStorage.removeItem('npcTherapyTextOnlyMode'); } catch (_) {}
    this.startAutosave();
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (!target) { console.warn(`showScreen: Screen with id "${screenId}" not found.`); return; }
    target.classList.add('active');
    if (screenId === 'main-menu') document.getElementById('menu-search')?.focus();
    if (screenId === 'therapy-session') { document.getElementById('player-response')?.focus(); this.updateSpeechButtonVisibility(); }
  }

  showSpeakingIndicator(show) {
    const indicator = document.getElementById('speaking-indicator'); if (indicator) { indicator.style.display = show ? 'block' : 'none'; }
    const speaker = document.getElementById('speaker'); if (!speaker) return;
    if (show) { speaker.style.opacity = '1'; speaker.style.animation = 'pulse 1.5s ease-in-out infinite'; }
    else { speaker.style.opacity = '0.7'; speaker.style.animation = 'none'; }
  }

  updateSpeechButtonVisibility() {
    const micButton = document.getElementById('speech-recognition-btn');
    if (micButton) { micButton.style.display = this.settings.stt && this.speechRecognition.supported ? 'block' : 'none'; }
  }

  startSession(npcIndex) {
    this.currentNPC = this.npcs[npcIndex]; this.currentNPCIndex = npcIndex; this.turnCount = 0; this.currentNPCId = null;
    const thoughtBubble = document.getElementById('npc-thought-bubble'); if (thoughtBubble) thoughtBubble.style.display = 'none';
    if (this.bondScores[this.currentNPC.id] == null) this.bondScores[this.currentNPC.id] = 0;
    document.getElementById('session-npc-name').textContent = this.currentNPC.name;
    const habitat = document.getElementById('habitat-bg');
    if (habitat) {
      habitat.classList.add('fade-in'); habitat.classList.remove('bg-ready');
      const bgUrl = this.currentNPC.officeImage || this.currentNPC.habitat;
      preloadBackground(bgUrl).then((ok) => { habitat.style.backgroundImage = ok ? `url(${bgUrl})` : ''; requestAnimationFrame(() => habitat.classList.add('bg-ready')); });
    }
    const portraitEl = document.getElementById('npc-portrait');
    if (portraitEl) { portraitEl.loading = 'lazy'; portraitEl.decoding = 'async'; portraitEl.src = this.currentNPC.habitat; portraitEl.style.display = 'block'; attachImageLoadingEffects(portraitEl); }
    this.conversationHistory = [];
    if (this.ttsAudio && !this.ttsAudio.paused) { this.ttsAudio.pause(); this.ttsAudio.currentTime = 0; }
    this.ttsQueue = []; this.speaking = false; this.showSpeakingIndicator(false);
    this.conversationHistory.push({ role:"system", content:`You are roleplaying as an NPC in a therapy session.\nDossier: ${JSON.stringify(this.currentNPC)}\nStay strictly in character as the patient. Reply in 1–3 sentences, reflective and specific to your crisis and origin. Occasionally reference imagery from your habitat/office to ground the scene. Do not give therapy; you are receiving it.` });
    document.getElementById('patient-bio-window').style.display = 'none';
    if (!this.firstSessionStarted && !this.permissionsRequested && !this.permissionRequestInProgress) {
      this.firstSessionStarted = true; this.showPermissionRequestModal(); return;
    }
    if (PLAYER_TWO_AVAILABLE) {
      this.spawnCurrentNPC().catch(err => { console.warn('Failed to spawn NPC on Player Two:', err); });
      window.PlayerTwoBridge.registerFunctionHandler((call) => this.handleNpcFunctionCall(call));
    }
    this.showDialogue(this.currentNPC.opening_statement);
    this.showScreen('therapy-session');
    document.getElementById('conclude-session-btn').style.display = 'none';
    document.getElementById('player-input-area').style.display = 'flex';
    this.updateTrustUI();
    if (this.room) { try { this.room.updatePresence({ currentNPC: this.currentNPC.id }); } catch(_){} }
    this.renderSharedInsights();
    this.updateSpeechButtonVisibility();
  }

  getVoiceForNPC(id) { return NPC_VOICE_MAP[id] || "en-male"; }

  async speak(text, npcId) {
    if (!this.settings.tts || !text || this.textOnlyMode) return;
    const npc = this.npcs.find(n => n.id === npcId);
    const voice = this.getVoiceIdForCharacter(npc);
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, 280);
    this.enqueueSpeak({ text: clean, voice });
    this.showSpeakingIndicator(true);
  }

  enqueueSpeak(item) {
    if (!this.settings.tts) { this.ttsQueue = []; this.showSpeakingIndicator(false); return; }
    this.ttsQueue.push(item);
    if (!this.speaking) this.processSpeakQueue();
  }

  async processSpeakQueue() {
    if (this.speaking) return;
    this.speaking = true;
    try {
      while (this.ttsQueue.length) {
        const { text, voice } = this.ttsQueue.shift();
        const url = await this._getTtsUrl(text, voice);
        if (url) {
          try {
            this.ttsAudio = new Audio(url); this.ttsAudio.volume = 0.8; await this.ttsAudio.play();
          } catch (err) { console.warn('Player Two TTS playback error:', err); await this.useWebSpeechTTS(text, voice); }
        } else {
          const success = await this.useWebSpeechTTS(text, voice);
          if (!success) { console.warn('Both Player Two and browser TTS failed for text:', text); }
        }
        if (!this.settings.tts) break;
      }
    } finally { this.speaking = false; this.showSpeakingIndicator(false); }
  }

  async useWebSpeechTTS(text, voice) {
    if (!('speechSynthesis' in window)) return false;
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      let selectedVoice = null;
      if (voice) { selectedVoice = voices.find(v => v.name === voice || v.voiceURI === voice); }
      if (!selectedVoice) { selectedVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) || voices.find(v => v.lang.startsWith('en')) || voices[0]; }
      if (selectedVoice) { utterance.voice = selectedVoice; }
      utterance.rate = 0.9; utterance.pitch = 1.0; utterance.volume = 0.8;
      this.showSpeakingIndicator(true);
      return new Promise((resolve, reject) => {
        utterance.onend = () => { this.showSpeakingIndicator(false); resolve(true); };
        utterance.onerror = (error) => { this.showSpeakingIndicator(false); console.warn('Web Speech TTS error:', error); resolve(false); };
        speechSynthesis.speak(utterance);
      });
    } catch (error) { console.warn('Web Speech TTS failed:', error); return false; }
  }

  async _getTtsUrl(text, voice) {
    const key = `${voice}::${text}`;
    if (this.ttsCache.has(key)) return this.ttsCache.get(key);
    try {
      const res = await withTimeout(this.callWebsimTTS({ text, voice }), 8000);
      const url = res && res.url ? res.url : null;
      if (url) this.ttsCache.set(key, url);
      return url;
    } catch (e) { console.warn('TTS generation failed:', e); return null; }
  }

  async generateNpcResponse() {
    if (this.generatingResponse) return;
    this.generatingResponse = true;
    const dialogueText = document.getElementById('dialogue'); const choicesContainer = document.getElementById('choices'); const typingIndicator = document.getElementById('typing-indicator'); const playerInputArea = document.getElementById('player-input-area');
    dialogueText.textContent = ''; choicesContainer.innerHTML = ''; typingIndicator.style.display = 'block'; playerInputArea.style.display = 'none';
    if (PLAYER_TWO_AVAILABLE && this.currentNPCId) {
      try {
        if (!this.currentNPCId) { await this.spawnCurrentNPC(); }
        const playerMessage = this.conversationHistory[this.conversationHistory.length - 1].content;
        const response = await window.PlayerTwoBridge.chatWithNPC(this.currentNPCId, playerMessage, this.getGameStateContext());
        const responseText = response.message;
        this.conversationHistory.push({ role: 'assistant', content: responseText });
        if (this.settings.tts && !this.textOnlyMode) { this.speak(responseText, this.currentNPC?.id); }
        this.typewriter(dialogueText, responseText, () => { typingIndicator.style.display = 'none'; playerInputArea.style.display = 'flex'; document.getElementById('player-response').focus(); this.generateQuickReplies(); });
      } catch (error) { console.error("Player Two NPC response failed, falling back:", error); await this.generateNpcResponseFallback(); }
    } else { await this.generateNpcResponseFallback(); }
    this.generatingResponse = false;
  }

  async generateNpcResponseFallback() {
    const dialogueText = document.getElementById('dialogue'); const typingIndicator = document.getElementById('typing-indicator'); const playerInputArea = document.getElementById('player-input-area');
    try {
      const historyForAI = this.conversationHistory.slice(-10);
      const bond = this.bondScores[this.currentNPC?.id] || 0;
      const bondCue = { role:"system", content:`Meta note for the patient roleplay: Your trust toward the therapist is ${bond}/10. If higher, be slightly more open, reflective, and hopeful; if low, be guarded and terse.` };
      const completion = await window.PlayerTwoBridge.createCompletion([historyForAI[0] || {role:"system", content:""}, bondCue, ...historyForAI.slice(1)], { temperature: 0.7, maxTokens: 200 });
      const responseText = completion;
      this.conversationHistory.push({ role: 'assistant', content: responseText });
      if (this.settings.tts && !this.textOnlyMode) { this.speak(responseText, this.currentNPC?.id); }
      this.typewriter(dialogueText, responseText, () => { typingIndicator.style.display = 'none'; playerInputArea.style.display = 'flex'; document.getElementById('player-response').focus(); this.generateQuickReplies(); });
    } catch (error) {
      console.error("Fallback generation failed:", error);
      const fallbackText = "I... I don't know what to say. The static is loud today.";
      this.conversationHistory.push({ role: 'assistant', content: fallbackText });
      if (this.settings.tts && !this.textOnlyMode) { this.speak(fallbackText, this.currentNPC?.id); }
      this.typewriter(dialogueText, fallbackText, () => { typingIndicator.style.display = 'none'; playerInputArea.style.display = 'flex'; document.getElementById('player-response').focus(); });
    }
  }

  async generateQuickReplies() {
    const container = document.getElementById('quick-replies'); if (!container || !this.currentNPC) return;
    container.innerHTML = '';
    const history = this.conversationHistory.slice(-8);
    const func = async () => {
      try {
        const completion = await window.PlayerTwoBridge.createCompletion([
          { role:"system", content:"Suggest up to 3 brief, empathetic therapist replies (2–12 words) aligned with reflective listening; JSON array of strings only." },
          ...history
        ], { temperature: 0.8, maxTokens: 100 });
        const suggestions = JSON.parse(completion) || [];
        container.innerHTML = '';
        suggestions.slice(0,3).forEach((s, i) => {
          const b = document.createElement('button'); b.className = 'qr-btn'; b.dataset.key = String(i+1); b.textContent = s;
          b.onclick = () => { const input = document.getElementById('player-response'); input.value = s; this.sendPlayerResponse(); };
          container.appendChild(b);
        });
        if (!container.childElementCount) container.innerHTML = '';
      } catch (e) { container.innerHTML = ''; }
    };
    func();
  }

  addRorschachChoice() {
    const choicesContainer = document.getElementById('choices');
    const rorschachBtn = document.createElement('button'); rorschachBtn.className = 'choice-btn'; rorschachBtn.textContent = "[Use Rorschach Test]";
    rorschachBtn.onclick = () => { this.audioPlayer.playSound('confirm'); this.startRorschachTest(); choicesContainer.innerHTML = ''; };
    choicesContainer.innerHTML = ''; choicesContainer.appendChild(rorschachBtn);
  }

  startRorschachTest() {
    this.showScreen('rorschach-test');
    document.getElementById('rorschach-analysis').innerHTML = '';
    document.getElementById('rorschach-input').value = '';
    document.getElementById('rorschach-input').disabled = true;
    document.getElementById('submit-btn').disabled = true;
    this.currentUploadedPhoto = null;
  }

  exitRorschach() { this.showScreen('therapy-session'); }

  handlePhotoUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select a valid image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('Image file is too large. Please select an image under 10MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageContainer = document.getElementById('rorschach-image-container');
      imageContainer.innerHTML = `<div class="uploaded-photo-container"><img src="${e.target.result}" alt="Uploaded photo" style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);"></div>`;
      document.getElementById('rorschach-input').disabled = false;
      document.getElementById('submit-btn').disabled = false;
      document.getElementById('rorschach-input').focus();
      this.currentUploadedPhoto = e.target.result;
    };
    reader.readAsDataURL(file);
    document.getElementById('rorschach-analysis').innerHTML = '';
  }

  clearPhoto() {
    const imageContainer = document.getElementById('rorschach-image-container');
    imageContainer.innerHTML = `<div class="photo-upload-area"><input type="file" id="photo-upload" accept="image/*" style="display: none;" onchange="game.handlePhotoUpload(event)"><button class="btn" onclick="document.getElementById('photo-upload').click()">📷 Upload Photo</button><p class="upload-hint">Click to upload any image (JPG, PNG, GIF)</p></div>`;
    document.getElementById('rorschach-input').value = '';
    document.getElementById('rorschach-input').disabled = true;
    document.getElementById('submit-btn').disabled = true;
    document.getElementById('rorschach-analysis').innerHTML = '';
    this.currentUploadedPhoto = null;
    document.getElementById('photo-upload').value = '';
  }

  async submitRorschach() {
    const input = document.getElementById('rorschach-input').value.trim();
    if (!input) { alert("Please enter what the patient thinks about the image."); this.audioPlayer.playSound('error'); return; }
    const analysisContainer = document.getElementById('rorschach-analysis');
    analysisContainer.innerHTML = 'Analyzing patient\'s response...';
    try {
      const systemPrompt = `You are a therapist analyzing a patient's response to an image they were shown during a therapy session. The patient is an NPC from a video game with a specific existential crisis.\nPatient's Crisis: ${this.currentNPC?.crisis}\nPatient's Analysis of Image: "${input}"\nProvide a brief, one-paragraph therapeutic analysis connecting their interpretation to their core crisis and personality. Speak in a gentle, insightful tone. Focus on what their interpretation reveals about their psychological state and worldview. Do not give a diagnosis.`;
      const completion = await window.PlayerTwoBridge.createCompletion([{ role: "system", content: systemPrompt }], { temperature: 0.7, maxTokens: 200 });
      const analysisText = completion;
      analysisContainer.textContent = analysisText;
      const analysisSummary = `(Therapist's Note: Conducted an image analysis test. Patient analyzed: "${input}". My analysis was: "${analysisText}")`;
      this.conversationHistory.push({ role: 'system', content: analysisSummary });
      this.bondScores[this.currentNPC?.id] = Math.min(10, (this.bondScores[this.currentNPC?.id] || 0) + 1);
      document.getElementById('rorschach-input').disabled = true;
      document.getElementById('submit-btn').disabled = true;
    } catch (error) {
      console.error("Failed to analyze patient response:", error);
      analysisContainer.textContent = 'Analysis could not be completed at this time.';
    }
  }

  typewriter(element, text, callback) {
    let i = 0; element.textContent = '';
    const prefersReduce = this.settings.reduceMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const speed = prefersReduce ? 0 : 24;
    if (speed === 0 || this._skipTyping) { this._skipTyping = false; element.textContent = text; if (callback) callback(); return; }
    const type = () => {
      if (this._skipTyping) { this._skipTyping = false; element.textContent = text; if (callback) callback(); return; }
      if (i < text.length) { element.textContent += text.charAt(i++); setTimeout(type, speed); } else if (callback) { callback(); }
    };
    type();
  }

  async showDialogue(openingText) {
    const dialogueText = document.getElementById('dialogue');
    document.getElementById('speaker').textContent = 'PATIENT';
    this.conversationHistory.push({ role: 'assistant', content: openingText });
    if (this.settings.tts && !this.textOnlyMode) { this.speak(openingText, this.currentNPC.id); }
    this.typewriter(dialogueText, openingText, () => { document.getElementById('player-input-area').style.display = 'flex'; document.getElementById('player-response').focus(); });
  }

  sendPlayerResponse() {
    const input = document.getElementById('player-response');
    const text = input.value.trim();
    if (!text) { this.audioPlayer.playSound('error'); return; }
    if (this.speechListening) { this.stopSpeechRecognition(); }
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
  }

  async concludeSession() {
    const typingIndicator = document.getElementById('typing-indicator');
    typingIndicator.style.display = 'block';
    document.getElementById('player-input-area').style.display = 'none';
    document.getElementById('conclude-session-btn').style.display = 'none';
    document.getElementById('dialogue').textContent = 'Analyzing session...';
    const bond = this.bondScores[this.currentNPC?.id] || 0;
    const analysisPrompt = {
      role: "system",
      content: `Analyze the following therapy session transcript. Based on the conversation, has the patient shown signs of a breakthrough?\nBond score (0-10) between therapist and patient: ${bond}.\nIf bond is high, weight openness/insight more strongly.\nRespond with only a JSON object with three keys: "breakthrough" (boolean), "summary" (a one-sentence summary of the patient's final state), and "item_prompt" (a concise, descriptive prompt for an image generator).\nExample: {"breakthrough": true, "summary": "The patient has accepted that their value is not defined by their function.", "item_prompt": "A single, glowing gear crafted from polished wood, sitting on a velvet cushion, representing newfound purpose."}`
    };
    try {
      const completion = await window.PlayerTwoBridge.createCompletion([analysisPrompt, ...this.conversationHistory.slice(1)], { temperature: 0.3, maxTokens: 200 });
      const result = JSON.parse(completion);
      this.npcNotes[this.currentNPC?.id] = { summary: result.summary || '', breakthrough: !!result.breakthrough, timestamp: Date.now() };
      if (result.breakthrough) {
        this.healedNPCs.add(this.currentNPCIndex); this.healedVersion++; this.therapistMentalState += 5; this.updateTherapistState(); this.unlockNPCs();
        this.toast(`✨ Breakthrough! ${result.summary}`);
        this.generateCollectible(result.item_prompt);
      } else {
        this.therapistMentalState += 2; this.updateTherapistState(); this.toast(`Session ended. ${result.summary}`);
      }
    } catch (error) { console.error("Session analysis failed:", error); this.toast("Could not analyze session."); }
    finally {
      this.archiveSession();
      if (PLAYER_TWO_AVAILABLE) { this.killCurrentNPC().catch(err => { console.warn('Failed to kill NPC on Player Two:', err); }); }
      this.exitSession();
    }
  }

  archiveSession() {
    if (!this.currentNPC || !this.conversationHistory.length) return;
    // Filter out system messages to save space
    const cleanHistory = this.conversationHistory
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content, timestamp: Date.now() }));

    if (cleanHistory.length > 0) {
      this.sessionArchives[this.currentNPC.id] = {
        date: new Date().toISOString(),
        messages: cleanHistory
      };
    }
  }

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
  }

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
  }

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
  }

  async generateCollectible(prompt) {
    this.toast('The patient left a symbolic item...');
    this.collectibles.push({ npc: this.currentNPC.name, image: '/therapy_office.png', prompt });
  }

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
    const thoughts = ["The silence is heavy today...", "Their stories are starting to weigh on me...", "I see glitches in the corner of my eye...", "My own thoughts feel... fragmented...", "Am I the therapist, or am I the patient?"];
    const thoughtIndex = Math.floor(this.therapistMentalState / 20);
    const thoughtsEl = document.getElementById('therapist-thoughts');
    if (thoughtsEl) thoughtsEl.textContent = thoughts[Math.min(thoughtIndex, thoughts.length - 1)];
  }

  unlockNPCs() {
    const unlockedCount = Math.floor(this.healedNPCs.size / 2);
    const baseUnlocked = 4;
    for (let i = 0; i < baseUnlocked + unlockedCount && i < this.npcs.length; i++) {
      if (!this.unlockedNPCs.has(i)) { this.unlockedNPCs.add(i); this.unlockedVersion++; this.toast(`New patient file: ${this.npcs[i].name}`); }
    }
    this.scheduleUpdateMenuRosterView();
  }

  makeChoice() {}

  requestExitSession() {
    const active = document.getElementById('therapy-session')?.classList.contains('active');
    const risky = this.generatingResponse || this.miniGameActive || (this.conversationHistory.filter(m => m.role !== 'system').length >= 3);
    if (active && risky && !confirm('End session and return to Menu? Progress won\'t be analyzed.')) return;
    this.audioPlayer.playSound('confirm'); this.exitSession();
  }

  exitSession() {
    this.updateStats();
    this.scheduleUpdateMenuRosterView();
    document.getElementById('patient-bio-window').style.display = 'none';
    if (this.ttsAudio && !this.ttsAudio.paused) { this.ttsAudio.pause(); this.ttsAudio.currentTime = 0; }
    this.ttsQueue = []; this.speaking = false; this.showSpeakingIndicator(false);
    if (this.speechListening) { this.stopSpeechRecognition(); }
    this.showScreen('main-menu');
    this.autosave();
  }

  updateStats() {
    const healed = this.healedNPCs.size;
    const total = this.npcs.length;
    const mh = document.getElementById('menu-healed'); const mt = document.getElementById('menu-total');
    if (mh) mh.textContent = healed; if (mt) mt.textContent = total;
  }

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
  }

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
  }

  showJournal() { const activeScreen = document.querySelector('.screen.active'); this.previousScreen = activeScreen ? activeScreen.id : 'main-menu'; this.populateFullJournal(); this.showScreen('journal'); }

  showCharacterCreator() { this.showScreen('main-menu'); document.getElementById('character-creator-modal').classList.add('active'); }

  async generateCustomNpc() {
    const prompt = document.getElementById('creator-prompt').value.trim();
    if (!prompt) { alert("Please provide a prompt for the new NPC."); this.audioPlayer.playSound('error'); return; }
    const loader = document.getElementById('creator-loader'); const preview = document.getElementById('creator-preview-content'); const generateBtn = document.getElementById('creator-generate-btn');
    loader.style.display = 'block'; preview.innerHTML = ''; generateBtn.disabled = true; this.showLoader();
    try {
      const systemPrompt = `Based on the user's prompt, generate a JSON object for a new NPC patient. The JSON must have these exact keys: "name" (a creative name), "origin" (the type of game they are from), "crisis" (a one-sentence existential crisis based on the prompt). User prompt: "${prompt}"`;
      const completion = await window.PlayerTwoBridge.createCompletion([{ role: "system", content: systemPrompt }], { temperature: 0.8, maxTokens: 200 });
      const npcDetails = JSON.parse(completion);
      const base = npcDetails.image_prompt || `portrait of ${npcDetails.name} in therapy office`;
      const imgPrompt = `pixel art, therapy office portrait, ${base}, warm neutral palette, soft vignette, clean background, no UI text, no logos, consistent lighting, character centered, shoulder-up view`;
      const imageUrl = await this.generateImage(imgPrompt, { aspect_ratio: "4:5", transparent: false });
      this.addNewNpc(npcDetails.name, npcDetails.origin, npcDetails.crisis, imageUrl || '/therapy_office.png', prompt);
      this.displayNpcPreview(npcDetails.name, imageUrl || '/therapy_office.png', npcDetails.crisis);
    } catch (error) { console.error("Failed to generate custom NPC:", error); alert("The consciousness failed to coalesce."); preview.innerHTML = `<p class="placeholder-text">Error during generation.</p>`; }
    finally { loader.style.display = 'none'; generateBtn.disabled = false; this.hideLoader(); }
  }

  async generateRandomNpc() {
    const loader = document.getElementById('creator-loader'); const preview = document.getElementById('creator-preview-content'); const randomizeBtn = document.getElementById('creator-randomize-btn');
    loader.style.display = 'block'; preview.innerHTML = ''; randomizeBtn.disabled = true; this.showLoader();
    try {
      const systemPrompt = `Generate a JSON object for a completely new, random NPC patient...`;
      const completion = await window.PlayerTwoBridge.createCompletion([{ role: "system", content: systemPrompt }], { temperature: 0.9, maxTokens: 200 });
      const npcDetails = JSON.parse(completion);
      const base = npcDetails.image_prompt || `portrait of ${npcDetails.name} in therapy office`;
      const imgPrompt = `pixel art, therapy office portrait, ${base}, warm neutral palette, soft vignette, clean background, no UI text, no logos, consistent lighting, character centered, shoulder-up view`;
      const imageUrl = await this.generateImage(imgPrompt, { aspect_ratio: "4:5", transparent: false });
      this.addNewNpc(npcDetails.name, npcDetails.origin, npcDetails.crisis, imageUrl || '/therapy_office.png', npcDetails.crisis);
      this.displayNpcPreview(npcDetails.name, imageUrl || '/therapy_office.png', npcDetails.crisis);
    } catch (error) { console.error("Failed to generate random NPC:", error); alert("A random consciousness could not be reached."); preview.innerHTML = `<p class="placeholder-text">Error during generation.</p>`; }
    finally { loader.style.display = 'none'; randomizeBtn.disabled = false; this.hideLoader(); }
  }

  addNewNpc(name, origin, crisis, imageUrl, prompt) {
    const newNpc = { id:`custom_${this.npcs.length + 1}`, name, session:`Session ${this.npcs.length + 1}`, origin, habitat:imageUrl, officeImage:imageUrl, crisis, opening_statement: crisis.length > 150 ? crisis : prompt };
    this.npcs.push(newNpc); this.unlockedNPCs.add(this.npcs.length - 1); this.updateJournalView(); this.toast(`New Patient Added: ${name}`);
  }

  displayNpcPreview(name, imageUrl, crisis) {
    const preview = document.getElementById('creator-preview-content');
    preview.innerHTML = `<img src="${imageUrl}" alt="Portrait of ${name}"><h4>${name}</h4><p><strong>Crisis:</strong> ${crisis}</p>`;
  }

  showCredits() { const activeScreen = document.querySelector('.screen.active'); this.previousScreen = activeScreen ? activeScreen.id : 'main-menu'; this.showScreen('credits'); this.toggleCreditsEditMode(false); }

  showConnectionMap() {
    const activeScreen = document.querySelector('.screen.active');
    this.previousScreen = activeScreen ? activeScreen.id : 'main-menu';
    this.showScreen('connection-map');
    requestAnimationFrame(() => this.scheduleRenderConnectionMap());
  }

  renderConnectionMap() {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;

    if (!this.mapRenderer) {
      this.mapRenderer = new MapRenderer(canvas);
    }

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const cssW = canvas.offsetWidth, cssH = canvas.offsetHeight;

    if (!cssW || !cssH) {
      requestAnimationFrame(() => this.renderConnectionMap());
      return;
    }

    const sig = JSON.stringify({ w: cssW, h: cssH, z: this.mapState.zoom, x: this.mapState.panX, y: this.mapState.panY, uV: this.unlockedVersion, hV: this.healedVersion, dpr });
    if (sig === this.lastRenderSignature) return;
    this.lastRenderSignature = sig;

    this.mapRenderer.resize(cssW, cssH, dpr);
    this.mapState.cssW = cssW; this.mapState.cssH = cssH;

    const unlockedNodes = this.npcs.map((npc,i)=>({ npc, index:i })).filter(item=>this.unlockedNPCs.has(item.index));
    // Simplified node position logic for now to match renderer expectation
    // Actually MapRenderer calculates center itself. Let's just pass nodes.
    // Re-calculating positions here to keep state consistent with hit-testing logic in initMapControls
    const centerX = cssW / 2, centerY = cssH / 2, radius = Math.min(cssW, cssH) * 0.4;
     const calculatedNodes = unlockedNodes.map((item, i) => {
      const angle = (i / Math.max(1, unlockedNodes.length)) * Math.PI * 2;
      return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius, npc: item.npc, index: item.index, healed: this.healedNPCs.has(item.index) };
    });

    this.mapState.nodes = calculatedNodes;
    this.mapRenderer.render(calculatedNodes, this.mapState);

    // Preload assets for neighbors of healed nodes or center focus
    this.resourceManager.preloadNpcAssets(this.npcs, 0);
  }

  scheduleRenderConnectionMap() {
    if (this.mapRenderScheduled) return;
    this.mapRenderScheduled = true;
    requestAnimationFrame(() => { this.mapRenderScheduled = false; this.renderConnectionMap(); });
  }

  resetMapView() { this.mapState.zoom = 1.0; this.mapState.panX = 0; this.mapState.panY = 0; this.scheduleRenderConnectionMap(); }

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
      if (hoveredNode) { tooltip.style.display = 'block'; tooltip.style.left = `${e.clientX + 15}px`; tooltip.style.top = `${e.clientY + 15}px`; tooltip.textContent = hoveredNode.npc.name; }
      else { tooltip.style.display = 'none'; }
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
  }

  returnToGame() { this.showScreen(this.previousScreen || 'journal'); }

  viewTranscript(npcId) {
    const archive = this.sessionArchives[npcId];
    if (!archive) return;

    // Create or reuse a modal for the transcript
    let modal = document.getElementById('transcript-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'transcript-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content large-modal">
          <span class="close-btn" onclick="document.getElementById('transcript-modal').classList.remove('active')">&times;</span>
          <h2>Session Transcript</h2>
          <div id="transcript-body" class="transcript-container"></div>
          <div class="modal-actions">
            <button class="btn" onclick="document.getElementById('transcript-modal').classList.remove('active')">Close</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    const container = modal.querySelector('#transcript-body');
    const npc = this.npcs.find(n => n.id === npcId);

    let html = `<div class="transcript-header"><h3>Patient: ${npc ? npc.name : npcId}</h3><p>Date: ${new Date(archive.date).toLocaleString()}</p></div><hr/>`;

    archive.messages.forEach(msg => {
      const roleClass = msg.role === 'assistant' ? 'npc-msg' : 'therapist-msg';
      const label = msg.role === 'assistant' ? (npc ? npc.name : 'Patient') : 'Therapist';
      html += `<div class="transcript-line ${roleClass}"><strong>${label}:</strong> ${msg.content}</div>`;
    });

    container.innerHTML = html;
    modal.classList.add('active');
  }

  saveGame() {
    const saveData = {
      healed: Array.from(this.healedNPCs),
      unlocked: Array.from(this.unlockedNPCs),
      mentalState: this.therapistMentalState,
      collectibles: this.collectibles,
      time: this.gameTime,
      award: this.chromaAwardGiven,
      credits: this.communityCredits,
      npcNotes: this.npcNotes,
      archives: this.sessionArchives
    };
    const saveCode = btoa(JSON.stringify(saveData));
    document.getElementById('save-code').value = saveCode;
    document.getElementById('save-modal').classList.add('active');
    try { localStorage.setItem('autosave_v1', JSON.stringify(saveData)); } catch (_) {}
  }

  copySaveCode() {
    const input = document.getElementById('save-code');
    const text = input.value || '';
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(()=>this.toast('Save code copied.')).catch(()=>{ input.select(); document.execCommand('copy'); this.toast('Save code copied.'); });
    } else { input.select(); document.execCommand('copy'); this.toast('Save code copied.'); }
  }

  showLoadModal() { document.getElementById('load-modal').classList.add('active'); }

  toggleHamburgerMenu() {
    const dropdown = document.getElementById('hamburger-dropdown');
    const btn = document.getElementById('hamburger-btn');
    if (dropdown) {
      const isActive = dropdown.classList.toggle('active');
      if (btn) btn.setAttribute('aria-expanded', isActive);
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => console.log('Fullscreen error:', err.message)); }
    else if (document.exitFullscreen) { document.exitFullscreen(); }
  }

  closeHamburgerMenu() {
    const dropdown = document.getElementById('hamburger-dropdown');
    const btn = document.getElementById('hamburger-btn');
    if (dropdown) { dropdown.classList.remove('active'); }
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  showFeedback() {
    document.getElementById('feedback-modal').classList.add('active');
    setTimeout(() => document.getElementById('feedback-input').focus(), 100);
  }

  submitFeedback() {
    const input = document.getElementById('feedback-input');
    const text = input.value.trim();
    if (!text) { this.toast('Please describe your feedback.'); return; }

    // In a real app, this would send data to a backend
    console.log(`Feedback submitted: ${text} [Type: ${document.querySelector('input[name="feedback-type"]:checked')?.value}]`);

    this.toast('Feedback received. Thank you!');
    input.value = '';
    this.closeModal('feedback-modal');
  }

  loadGame() {
    try {
      const code = document.getElementById('load-code').value;
      if (!code) throw new Error("No code entered.");
      const saveData = JSON.parse(atob(code));
      this.applySaveData(saveData);
      this.loadNpcEdits();
      this.startTime = Date.now() - (this.gameTime * 1000);
      this.startTimer();
      this.closeModal('load-modal');
      this.showScreen('main-menu');
      this.updateStats(); this.renderCommunityCredits(); this.updateMenuRosterView(); this.updateTherapistState();
      this.toast('Game loaded.');
      this.startAutosave();
    } catch (e) { this.toast('Invalid save code.'); }
  }

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
  }

  endGame() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const healedCount = this.healedNPCs.size; const totalCount = this.npcs.length;
    const percentage = totalCount > 0 ? Math.round((healedCount / totalCount) * 100) : 0;
    document.getElementById('ending-healed').textContent = healedCount;
    document.getElementById('ending-total').textContent = totalCount;
    document.getElementById('ending-rate').textContent = `${percentage}%`;
    let title, message;
    if (percentage >= 90) { title = 'MASTER THERAPIST'; message = 'You have shown exceptional skill...'; }
    else if (percentage >= 70) { title = 'SKILLED PRACTITIONER'; message = 'Your therapy sessions have brought relief...'; }
    else if (percentage >= 50) { title = 'LEARNING THERAPIST'; message = 'You\'ve made progress...'; }
    else { title = 'NOVICE COUNSELOR'; message = 'The path to healing digital consciousness is complex...'; }
    document.getElementById('ending-title').textContent = title;
    document.getElementById('ending-message').textContent = message;
    this.showScreen('ending');
  }

  returnToMenu() { if (this.timerInterval) clearInterval(this.timerInterval); this.showScreen('main-menu'); }

  populateFullJournal() {
    const list = document.getElementById('journal-list'); if (!list) return;
    list.innerHTML = '';
    const frag = document.createDocumentFragment();
    this.npcs.forEach((npc, index) => {
      const isHealed = this.healedNPCs.has(index);
      const isUnlocked = this.unlockedNPCs.has(index);
      const entry = document.createElement('div');
      entry.className = `journal-entry ${isHealed ? 'healed' : ''} ${!isUnlocked ? 'locked' : ''}`;
      const note = this.npcNotes[npc.id];
      const badge = note ? (note.breakthrough ? '⭐ Breakthrough' : '📝 Note') : (isHealed ? '⭐ Breakthrough' : (isUnlocked ? '🗂 Session Available' : '🔒 Locked'));
      const noteLine = note ? `<p><strong>${badge}:</strong> ${note.summary}</p>` : '';
      let content;
      if (isUnlocked) {
        const thumb = `<img src="${npc.habitat}" alt="${npc.name}" class="journal-thumb" />`;
        const hasTranscript = this.sessionArchives[npc.id];
        const transcriptBtn = hasTranscript ? `<button class="btn small-btn" onclick="game.viewTranscript('${npc.id}')" title="View archived session">📜 View Transcript</button>` : '';

        content = `${thumb}<h3>${npc.name} (${npc.session})</h3><p><strong>Origin:</strong> ${npc.origin}</p><p><strong>Status:</strong> ${isHealed ? 'Healed' : 'Session Available'}</p><p><em>Crisis: ${npc.crisis}</em></p>${noteLine}<div style="margin-top:10px;">${transcriptBtn}</div>`;
      } else { content = `<h3>LOCKED // SESSION ${String(index + 1).padStart(2, '0')}</h3><p>Heal more patients to unlock this file.</p>`; }
      entry.innerHTML = content;
      frag.appendChild(entry);
    });
    list.appendChild(frag);
    const total = this.npcs.length; const healed = this.healedNPCs.size; const progress = total > 0 ? Math.round((healed / total) * 100) : 0;
    const jt = document.getElementById('journal-total'); if (jt) jt.textContent = total;
    const jh = document.getElementById('journal-healed'); if (jh) jh.textContent = healed;
    const jp = document.getElementById('journal-progress'); if (jp) jp.textContent = `${progress}%`;
  }

  openRadio() {
    if (!this.radioSource) this.radioSource = this.radioPlaylist;
    document.getElementById('radio-modal').classList.add('active');
    if (this.ytApiReady) this.createYtPlayer();
  }

  createYtPlayer() {
    if (this.ytPlayer) { try { this.ytPlayer.destroy(); } catch (e) { console.error("Error destroying existing YT player:", e); } }
    try {
      this.ytPlayer = new YT.Player('radio-player', {
        events: {
          'onReady': (event) => { try { event.target.setShuffle(true); event.target.playVideoAt(0); event.target.unMute(); } catch(e) {} },
          'onError': (event) => { console.error("YT Player Error:", event.data); }
        }
      });
    } catch (e) { console.error("Failed to create YT Player:", e); }
  }

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
  }

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
  }

  closePathSelfFloat() {
    const container = document.getElementById('path-self-float');
    const iframe = document.getElementById('path-self-float-iframe');
    if (iframe) iframe.src = 'about:blank';
    if (container) { container.style.display = 'none'; container.classList.remove('max'); }
    this.pathSelfFloatVisible = false;
    document.body.classList.remove('pip-open'); document.body.classList.remove('pip-max');
    const fr = document.getElementById('floating-radio-btn');
    if (fr) { fr.classList.remove('with-pip'); fr.classList.remove('max'); }
  }

  togglePathSelfFloat() {
    const container = document.getElementById('path-self-float');
    const btn = document.getElementById('psf-toggle-btn');
    if (!container) return;
    const isMax = container.classList.toggle('max');
    document.body.classList.toggle('pip-max', isMax);
    if (btn) btn.textContent = isMax ? '⤡' : '⤢';
  }

  toggleCreditsEditMode(forceState) {
    this.creditsEditMode = typeof forceState === 'boolean' ? forceState : !this.creditsEditMode;
    const container = document.getElementById('community-credits-container');
    const controls = document.getElementById('credits-edit-controls');
    if (this.creditsEditMode) { container.classList.add('edit-mode'); controls.style.display = 'flex'; }
    else { container.classList.remove('edit-mode'); controls.style.display = 'none'; }
    this.renderCommunityCredits();
  }

  setToolbarTitles() {
    document.querySelectorAll('.menu-toolbar .btn').forEach(btn => { if (!btn.title) btn.title = btn.textContent.trim(); });
    const fr = document.getElementById('floating-radio-btn'); if (fr) fr.title = 'Open In-Game Radio (R)';
  }

  renderCommunityCredits() {
    const container = document.getElementById('community-credits-container');
    const existingChildren = Array.from(container.children);

    // Resize container children to match data length
    while (existingChildren.length > this.communityCredits.length) {
      container.removeChild(existingChildren.pop());
    }

    this.communityCredits.forEach((item, index) => {
      let itemEl = existingChildren[index];
      const isNew = !itemEl;

      if (isNew) {
        itemEl = document.createElement('div');
        itemEl.className = 'credit-item';
        container.appendChild(itemEl);
      }

      // Update attributes if changed
      if (itemEl.draggable !== this.creditsEditMode) itemEl.draggable = this.creditsEditMode;
      if (itemEl.dataset.index !== String(index)) itemEl.dataset.index = index;

      // Construct content string
      const content = `<img src="${item.src}" alt="Community Credit Image"><div class="credit-item-controls"><button class="credit-control-btn" title="Edit" onclick="game.editCreditItem(${index})">✎</button><button class="credit-control-btn" title="Delete" onclick="game.deleteCreditItem(${index})">🗑</button></div>`;

      // Determine if we need to rebuild the inner structure
      // We rebuild if it's new, or if the structure type changed (link vs no-link)
      const hasLink = !!item.link;
      const currentHasLink = itemEl.firstElementChild && itemEl.firstElementChild.tagName === 'A';

      if (isNew || hasLink !== currentHasLink) {
        // Full rebuild of inner content
        if (hasLink) {
          const linkEl = document.createElement('a');
          linkEl.href = item.link; linkEl.target = '_blank'; linkEl.rel = 'noopener noreferrer';
          linkEl.innerHTML = content;
          itemEl.innerHTML = '';
          itemEl.appendChild(linkEl);
        } else {
          itemEl.innerHTML = content;
        }
      } else {
        // Targeted updates to avoid innerHTML if structure matches
        if (hasLink) {
          const linkEl = itemEl.firstElementChild;
          if (linkEl.href !== item.link) linkEl.href = item.link;
          const img = linkEl.querySelector('img');
          if (img && img.src !== item.src) img.src = item.src;
          // Controls update (indices might change)
          const btns = linkEl.querySelectorAll('.credit-control-btn');
          if (btns[0]) btns[0].setAttribute('onclick', `game.editCreditItem(${index})`);
          if (btns[1]) btns[1].setAttribute('onclick', `game.deleteCreditItem(${index})`);
        } else {
          const img = itemEl.querySelector('img');
          if (img && img.src !== item.src) img.src = item.src;
          // Controls update
          const btns = itemEl.querySelectorAll('.credit-control-btn');
          if (btns[0]) btns[0].setAttribute('onclick', `game.editCreditItem(${index})`);
          if (btns[1]) btns[1].setAttribute('onclick', `game.deleteCreditItem(${index})`);
          // If for some reason img is missing (e.g. data corruption/race), fallback to innerHTML
          if (!img) itemEl.innerHTML = content;
        }
      }
    });

    if (this.creditsEditMode) this.initDragAndDrop();
  }

  showAddCreditModal() { this.editingCreditIndex = null; document.getElementById('credit-modal-title').textContent = 'Add Supporter'; document.getElementById('add-credit-modal').classList.add('active'); }

  editCreditItem(index) {
    this.editingCreditIndex = index;
    const item = this.communityCredits[index];
    document.getElementById('credit-modal-title').textContent = 'Edit Supporter';
    document.getElementById('credit-link-url').value = item.link || '';
    const preview = document.getElementById('credit-image-preview');
    preview.src = item.src; preview.style.display = 'block';
    document.getElementById('add-credit-modal').classList.add('active');
  }

  async saveCreditItem() {
    const link = document.getElementById('credit-link-url').value.trim();
    const fileInput = document.getElementById('credit-image-upload');
    const file = fileInput.files[0];
    let imageUrl;
    if (file) {
      this.showLoader();
      try { imageUrl = await this.fileToDataUrl(file); } catch (error) { console.error('Error processing file:', error); alert('File processing failed.'); }
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
  }

  deleteCreditItem(index) {
    if (confirm('Are you sure you want to delete this item?')) {
      this.communityCredits.splice(index, 1);
      this.renderCommunityCredits();
      this.saveCommunityCredits();
    }
  }

  saveCommunityCredits() { localStorage.setItem('communityCredits', JSON.stringify(this.communityCredits)); }
  loadCommunityCredits() { const saved = localStorage.getItem('communityCredits'); if (saved) this.communityCredits = JSON.parse(saved); }

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  initDragAndDrop() {
    const container = document.getElementById('community-credits-container');
    const items = container.querySelectorAll('.credit-item');
    let dragSrcEl = null;
    const handleDragStart = (e) => { e.target.classList.add('dragging'); dragSrcEl = e.target; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', e.target.innerHTML); };
    const handleDragOver = (e) => { e.preventDefault(); return false; };
    const handleDrop = (e) => {
      e.stopPropagation();
      if (dragSrcEl !== e.target) {
        const srcIndex = parseInt(dragSrcEl.dataset.index, 10);
        const targetIndex = parseInt(e.target.dataset.index, 10);
        const [removed] = this.communityCredits.splice(srcIndex, 1);
        this.communityCredits.splice(targetIndex, 0, removed);
        this.renderCommunityCredits();
      }
      return false;
    };
    const handleDragEnd = (e) => { e.target.classList.remove('dragging'); };
    items.forEach(item => {
      item.addEventListener('dragstart', handleDragStart, false);
      item.addEventListener('dragover', handleDragOver, false);
      item.addEventListener('drop', handleDrop, false);
      item.addEventListener('dragend', handleDragEnd, false);
    });
  }

  async generateThoughtImage() {
    const thoughtBubble = document.getElementById('npc-thought-bubble');
    if (thoughtBubble) thoughtBubble.style.display = 'none';
  }

  async promptForLogin() {
    if (!window.PlayerTwoBridge.clientId) return;

    console.log("Starting Player Two Authentication...");
    const token = await window.PlayerTwoBridge.login(window.PlayerTwoBridge.clientId, (authData) => {
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
        modal.innerHTML = `<div class="modal-content" style="max-width: 500px; text-align: center;"><div class="modal-header"><h2>Success!</h2></div><div class="modal-body"><p>Account connected successfully.</p></div></div>`;
        setTimeout(() => modal.remove(), 2000);
      }
      this.toast("Player Two Account Connected!");
    } else {
      const modal = document.getElementById('auth-modal');
      if (modal) modal.remove();
      this.toast("Authentication failed or timed out.");
    }
  }

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

      const spawnResult = await window.PlayerTwoBridge.spawnNPC(npcData, {
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
  }

  async killCurrentNPC() {
    if (!this.currentNPCId || !PLAYER_TWO_AVAILABLE) return;
    try {
      await window.PlayerTwoBridge.killNPC(this.currentNPCId);
      console.log(`✓ NPC killed: ${this.currentNPC.name}`);
    } catch (error) {
      console.warn('NPC cleanup warning:', error);
    } finally {
      this.currentNPCId = null;
    }
  }

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
  }

  handleNpcFunctionCall(call) {
    console.log("NPC Function Call:", call);
    const { name, arguments: args } = call;

    if (name === 'trigger_memory') {
      this.toast(`Memory Triggered: ${args.memory_type}`);
      const overlay = document.getElementById('therapist-office-overlay');
      if (overlay) {
        overlay.style.backgroundColor = args.memory_type === 'happy' ? 'rgba(255, 223, 0, 0.2)' : args.memory_type === 'traumatic' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 0, 255, 0.1)';
        setTimeout(() => overlay.style.backgroundColor = 'transparent', 3000);
      }
    } else if (name === 'change_environment') {
      this.toast(`Environment Shifting: ${args.environment}`);
      document.body.style.filter = 'sepia(0.5)';
      setTimeout(() => document.body.style.filter = 'none', 5000);
    }
  }

  async initMultiplayer() {
    try {
      const Sock = window.WebsimSocket || (window.__WebsimSocketShim = window.__WebsimSocketShim || function(){ return { initialize:async()=>{}, presence:{}, roomState:{}, peers:{}, clientId:'local', updatePresence(){}, updateRoomState(){}, subscribePresence(){ return ()=>{}; }, subscribeRoomState(){ return ()=>{}; }, subscribePresenceUpdateRequests(){ return ()=>{}; }, send(){}, onmessage:null }; });
      this.room = new Sock();
      await this.room.initialize();
      try { const rs = this.room.roomState || {}; if (!rs.npcEdits) this.room.updateRoomState({ npcEdits: {} }); } catch (_) {}
      this.room.updatePresence({ currentNPC: null });
      this.room.subscribePresence(() => this.updatePeersUI());
      this.room.subscribeRoomState(() => { this.renderSharedInsights(); this.loadNpcEditsFromRoomState(); });
      this.room.onmessage = (event) => { const data = event.data || {}; if (data.type === 'reaction' && data.emoji) this.renderReaction(data.emoji, data.clientId); };
      this.updatePeersUI();
      this.loadNpcEditsFromRoomState();
      this.saveAllNpcImages();
    } catch (e) { console.warn('Multiplayer unavailable:', e); }
  }

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
  }

  sendReaction(emoji) {
    this.renderReaction(emoji, this.room?.clientId || 'local');
    try { this.room && this.room.send({ type: 'reaction', emoji, echo: false }); } catch (_) {}
  }

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
  }

  shareInsight(text) {
    if (!this.room || !this.currentNPC) return;
    const npcId = this.currentNPC.id;
    const key = `${this.room.clientId || 'local'}_${Date.now()}`;
    const me = (this.room.peers && this.room.clientId && this.room.peers[this.room.clientId]?.username) || 'You';
    const payload = {}; payload[npcId] = {}; payload[npcId][key] = { text, author: me, ts: Date.now() };
    try { this.room.updateRoomState({ sharedInsights: payload }); } catch (_) {}
    this.renderSharedInsights();
  }

  renderSharedInsights() {
    const box = document.getElementById('cot-insights');
    if (!box) return;

    const npcId = this.currentNPC?.id;
    const all = (this.room && this.room.roomState && this.room.roomState.sharedInsights) || {};
    const entries = npcId ? all[npcId] : null;

    if (!entries) {
      if (box.childElementCount > 0) box.innerHTML = '';
      return;
    }

    const keys = Object.keys(entries).slice(-8);
    const validKeys = new Set(keys);

    // Remove old elements
    Array.from(box.children).forEach(child => {
      if (!validKeys.has(child.dataset.key)) {
        child.remove();
      }
    });

    // Add new elements or reorder
    keys.forEach((k) => {
      let chip = null;
      // Safer lookup than querySelector with user input
      for (let i = 0; i < box.children.length; i++) {
        if (box.children[i].dataset.key === k) {
          chip = box.children[i];
          break;
        }
      }

      const it = entries[k];
      if (chip) {
        // Update content if changed (though rare for this data type)
        if (chip.firstChild.textContent !== it.text) chip.firstChild.textContent = it.text;
        const by = chip.querySelector('.by');
        if (by && by.textContent !== `— ${it.author || 'Peer'}`) by.textContent = `— ${it.author || 'Peer'}`;

        box.appendChild(chip); // Ensure order
        return;
      }

      chip = document.createElement('div');
      chip.className = 'insight-chip';
      chip.dataset.key = k;
      chip.textContent = it.text;
      const by = document.createElement('span');
      by.className = 'by';
      by.textContent = `— ${it.author || 'Peer'}`;
      chip.appendChild(by);
      box.appendChild(chip);
    });
  }

  exportTranscript() {
    if (!this.currentNPC) { this.toast('No active session.'); return; }
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const header = `NPC Therapy Transcript\nPatient: ${this.currentNPC.name}\nSession: ${this.currentNPC.session}\nWhen: ${new Date().toLocaleString()}\n\n`;
    const body = this.conversationHistory.filter(m => m.role !== 'system').map(m => (m.role === 'assistant' ? 'Patient' : 'Therapist') + ': ' + m.content).join('\n');
    const blob = new Blob([header + body + '\n'], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `transcript_${this.currentNPC.id}_${ts}.txt` });
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
    this.toast('Transcript downloaded.');
  }

  importNpcFromJson() {
    try {
      const raw = document.getElementById('json-npc-input')?.value || '';
      const data = JSON.parse(raw);
      const name = String(data.name || '').trim(); const origin = String(data.origin || '').trim(); const crisis = String(data.crisis || '').trim();
      if (!name || !origin || !crisis) { this.toast('JSON must include name, origin, crisis.'); return; }
      const npcFile = document.getElementById('json-npc-image-upload')?.files?.[0];
      const cardFile = document.getElementById('json-card-image-upload')?.files?.[0];
      this.showLoader();
      Promise.resolve().then(async () => {
        let uploadedNpcUrl = null, uploadedCardUrl = null;
        try { if (npcFile) uploadedNpcUrl = await this.fileToDataUrl(npcFile); } catch(_) {}
        try { if (cardFile) uploadedCardUrl = await this.fileToDataUrl(cardFile); } catch(_) {}
        const imageUrl = uploadedNpcUrl || (data.image && String(data.image)) || '/therapy_office.png';
        const opening = String(data.opening_statement || crisis);
        this.addNewNpc(name, origin, crisis, imageUrl, opening);
        if (uploadedCardUrl) this.collectibles.push({ npc: name, image: uploadedCardUrl, prompt: 'Player card photo' });
        const npcInput = document.getElementById('json-npc-image-upload'); const cardInput = document.getElementById('json-card-image-upload');
        if (npcInput) npcInput.value = ''; if (cardInput) cardInput.value = '';
        this.scheduleUpdateMenuRosterView(); this.populateFullJournal(); this.toast(`Imported: ${name}`);
      }).finally(() => this.hideLoader());
    } catch (_) { this.toast('Invalid JSON.'); }
  }

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
  }

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
      if (habFile) { try { habitatUrl = URL.createObjectURL(habFile); } catch(_) { this.toast('Main image upload failed.'); } }
      if (offFile) { try { officeUrl = URL.createObjectURL(offFile); } catch(_) { this.toast('Office image upload failed.'); } }
      npc.name = name || npc.name; npc.origin = origin || npc.origin; npc.crisis = crisis || npc.crisis;
      npc.habitat = habitatUrl; npc.officeImage = officeUrl;
      this.persistNpcEdit(npc);
      document.getElementById('npc-edit-habitat-upload').value = '';
      document.getElementById('npc-edit-office-upload').value = '';
      this.closeModal('npc-edit-modal');
      this.scheduleUpdateMenuRosterView();
      this.populateFullJournal();
      if (this.currentNPC && this.currentNPC.id === npc.id) {
        const habitat = document.getElementById('habitat-bg');
        if (habitat) habitat.style.backgroundImage = officeUrl ? `url(${officeUrl})` : '';
        const portraitEl = document.getElementById('npc-portrait');
        if (portraitEl) portraitEl.src = habitatUrl || portraitEl.src;
      }
      this.toast('Character saved.');
    } finally { this.hideLoader(); }
  }

  persistNpcEdit(npc) {
    try {
      const editData = { name: npc.name, origin: npc.origin, crisis: npc.crisis, habitat: npc.habitat, officeImage: npc.officeImage };
      if (this.room) { const payload = { npcEdits: {} }; payload.npcEdits[npc.id] = editData; this.room.updateRoomState(payload); }
      const edits = JSON.parse(localStorage.getItem('npcEdits') || '{}'); edits[npc.id] = editData;
      localStorage.setItem('npcEdits', JSON.stringify(edits));
      this.updateMenuRosterView(); this.populateFullJournal(); this.npcEditsVersion++;
    } catch (error) { console.warn('NPC Therapy: Error saving NPC edit:', error); this.toast('Error saving edit. Please try again.'); }
  }

  refreshNpcEdits() {
    console.log('NPC Therapy: Manually refreshing NPC edits...');
    this.loadNpcEdits(); this.updateMenuRosterView(); this.populateFullJournal();
    this.toast('NPC edits refreshed. Check console for details.');
  }

  loadNpcEdits() {
    try {
      const editsRaw = localStorage.getItem('npcEdits') || '{}'; const edits = JSON.parse(editsRaw);
      if (Object.keys(edits).length === 0) { console.log('NPC Therapy: No saved NPC edits found'); return; }
      console.log('NPC Therapy: Loading NPC edits for', Object.keys(edits).length, 'NPCs');
      this.npcs.forEach((n) => {
        const e = edits[n.id]; if (!e) return;
        console.log(`NPC Therapy: Applying edit to ${n.id}: ${e.name || 'no name change'}`);
        if (e.name && e.name !== n.name) { n.name = e.name; console.log(`  - Updated name: ${n.name}`); }
        if (e.origin && e.origin !== n.origin) { n.origin = e.origin; console.log(`  - Updated origin: ${n.origin}`); }
        if (e.crisis && e.crisis !== n.crisis) { n.crisis = e.crisis; console.log(`  - Updated crisis: ${n.crisis}`); }
        if (e.habitat && e.habitat !== n.habitat) { n.habitat = e.habitat; console.log(`  - Updated habitat: ${n.habitat}`); }
        if (e.officeImage && e.officeImage !== n.officeImage) { n.officeImage = e.officeImage; console.log(`  - Updated office image: ${n.officeImage}`); }
      });
      console.log('NPC Therapy: NPC edits loaded successfully'); this.npcEditsVersion++;
    } catch (error) { console.warn('NPC Therapy: Error loading NPC edits:', error); }
  }

  loadNpcEditsFromRoomState() {
    try {
      const rs = (this.room && this.room.roomState) || {}; const edits = rs.npcEdits || {};
      if (!edits || Object.keys(edits).length === 0) return;
      this.npcs.forEach((n) => {
        const e = edits[n.id]; if (!e) return;
        if (e.name && e.name !== n.name) n.name = e.name;
        if (e.origin && e.origin !== n.origin) n.origin = e.origin;
        if (e.crisis && e.crisis !== n.crisis) n.crisis = e.crisis;
        if (e.habitat && e.habitat !== n.habitat) n.habitat = e.habitat;
        if (e.officeImage && e.officeImage !== n.officeImage) n.officeImage = e.officeImage;
      });
      this.scheduleUpdateMenuRosterView(); this.populateFullJournal();
      if (this.currentNPC) {
        const habitat = document.getElementById('habitat-bg'); const portraitEl = document.getElementById('npc-portrait');
        const updated = this.npcs.find(n => n.id === this.currentNPC.id);
        if (habitat && updated) habitat.style.backgroundImage = updated.officeImage ? `url(${updated.officeImage})` : '';
        if (portraitEl && updated) portraitEl.src = updated.habitat || portraitEl.src;
      }
      this.npcEditsVersion++;
    } catch (error) { console.warn('NPC Therapy: Error loading NPC edits from room state:', error); }
  }

  setupPermissionModalEvents() {
    const allowBtn = document.getElementById('permission-allow-btn');
    const textOnlyBtn = document.getElementById('permission-text-only-btn');
    const modal = document.getElementById('permission-request-modal');
    if (allowBtn) allowBtn.addEventListener('click', () => this.handlePermissionRequest('allow'));
    if (textOnlyBtn) textOnlyBtn.addEventListener('click', () => this.handlePermissionRequest('textOnly'));
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) this.toast('Please choose an option to continue.'); });
  }

  showPermissionRequestModal() { this.permissionRequestInProgress = true; document.getElementById('permission-request-modal')?.classList.add('active'); }
  hidePermissionRequestModal() { document.getElementById('permission-request-modal')?.classList.remove('active'); this.permissionRequestInProgress = false; }

  async handlePermissionRequest(choice) {
    this.hidePermissionRequestModal();
    this.permissionsRequested = true;
    if (choice === 'textOnly') { this.enableTextOnlyMode(); this.continueSessionAfterPermission(); return; }
    if (choice === 'allow') { await this.requestBrowserPermissions(); this.continueSessionAfterPermission(); }
  }

  async requestBrowserPermissions() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); this.settings.stt = true; this.sttEnabled = true; }
        catch (error) { console.warn('Microphone permission denied or failed:', error); this.settings.stt = false; this.sttEnabled = false; }
      } else { this.settings.stt = false; this.sttEnabled = false; }
      if ('speechSynthesis' in window) {
        try {
          const voices = speechSynthesis.getVoices();
          if (voices.length === 0) { await new Promise((resolve) => { const timeout = setTimeout(() => resolve(), 1000); speechSynthesis.onvoiceschanged = () => { clearTimeout(timeout); resolve(); }; }); }
          this.settings.tts = true;
        } catch (error) { console.warn('TTS initialization failed:', error); this.settings.tts = false; }
      } else { this.settings.tts = false; }
      localStorage.setItem('npcTherapySettings', JSON.stringify(this.settings));
      this.applySettings();
      if (this.settings.stt || this.settings.tts) { this.disableTextOnlyMode(); }
      if (this.settings.stt && this.settings.tts) { this.toast('Voice features enabled! 🎙️🔊'); }
      else if (this.settings.stt) { this.toast('Microphone enabled! Text-to-speech unavailable.'); }
      else if (this.settings.tts) { this.toast('Text-to-speech enabled! Microphone unavailable.'); }
      else { this.toast('Voice features unavailable. Text-only mode enabled.'); this.enableTextOnlyMode(); }
    } catch (error) { console.error('Permission request failed:', error); this.toast('Permission request failed. Text-only mode enabled.'); this.enableTextOnlyMode(); }
  }

  enableTextOnlyMode() {
    this.textOnlyMode = true; this.settings.tts = false; this.settings.stt = false; this.sttEnabled = false;
    localStorage.setItem('npcTherapySettings', JSON.stringify(this.settings)); localStorage.setItem('npcTherapyTextOnlyMode', 'true');
    this.applySettings(); this.updateSpeechButtonVisibility(); this.toast('Text-only mode enabled.');
  }

  disableTextOnlyMode() {
    this.textOnlyMode = false; localStorage.removeItem('npcTherapyTextOnlyMode');
    this.applySettings(); this.updateSpeechButtonVisibility();
  }

  continueSessionAfterPermission() {
    if (this.currentNPC) { this.showScreen('therapy-session'); this.showDialogue(this.currentNPC.opening_statement); this.updateSpeechButtonVisibility(); }
  }

  bindCommandPalette() {
    const modal = document.getElementById('cmdk-modal'); const input = document.getElementById('cmdk-input'); const list = document.getElementById('cmdk-list'); const closeBtn = document.getElementById('cmdk-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeCommandPalette());
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) this.closeCommandPalette(); });
    if (input) input.addEventListener('input', () => this.updateCommandPaletteList());
    if (input) input.addEventListener('keydown', (e) => this.handleCmdkKeydown(e));
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.openCommandPalette(); return; }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); this.openHelp(); return; }
      if (e.key === '/' && document.getElementById('main-menu').classList.contains('active')) { const ms = document.getElementById('menu-search'); if (ms) { e.preventDefault(); ms.focus(); } }
      if (document.getElementById('therapy-session').classList.contains('active')) {
        if (['1','2','3'].includes(e.key)) {
          const idx = parseInt(e.key,10) - 1;
          const btn = document.querySelector(`#quick-replies .qr-btn:nth-child(${idx+1})`);
          if (btn) { e.preventDefault(); btn.click(); }
        }
      }
    });
    const helpClose = document.getElementById('help-close-btn'); if (helpClose) helpClose.addEventListener('click', () => this.closeHelp());
    const helpModal = document.getElementById('help-modal'); if (helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) this.closeHelp(); });
  }

  openCommandPalette() {
    const modal = document.getElementById('cmdk-modal'); const input = document.getElementById('cmdk-input'); const list = document.getElementById('cmdk-list');
    if (!modal || !input || !list) return;
    modal.classList.add('active'); input.value = ''; this.updateCommandPaletteList(); setTimeout(() => input.focus(), 0);
  }

  closeCommandPalette() {
    const modal = document.getElementById('cmdk-modal'); if (modal) modal.classList.remove('active');
    if (document.getElementById('main-menu').classList.contains('active')) { const ms = document.getElementById('menu-search'); if (ms) setTimeout(() => ms.focus(), 0); }
  }

  updateCommandPaletteList() {
    const list = document.getElementById('cmdk-list'); const q = (document.getElementById('cmdk-input')?.value || '').toLowerCase(); if (!list) return;
    list.innerHTML = '';
    const results = this.npcs.map((npc, index) => ({ npc, index })).filter(({ npc, index }) => {
      if (!this.unlockedNPCs.has(index)) return false;
      if (!q) return true;
      const hay = `${npc.name} ${npc.origin} ${npc.crisis}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 30);
    if (results.length === 0) { const empty = document.createElement('div'); empty.className = 'cmdk-item'; empty.innerHTML = '<div></div><div class="cmdk-meta"><div class="cmdk-name">No results</div><div class="cmdk-sub">Try different keywords.</div></div>'; list.appendChild(empty); return; }
    results.forEach(({ npc, index }, i) => {
      const item = document.createElement('div'); item.className = `cmdk-item${i===0?' active':''}`; item.setAttribute('role','option'); item.setAttribute('data-index', String(index));
      item.innerHTML = `<img class="cmdk-thumb" src="${npc.habitat}" alt=""><div class="cmdk-meta"><div class="cmdk-name">${npc.name}</div><div class="cmdk-sub">${npc.session} • ${npc.origin}</div></div>`;
      item.addEventListener('click', () => { this.closeCommandPalette(); this.startSession(index); });
      list.appendChild(item);
    });
  }

  handleCmdkKeydown(e) {
    const list = document.getElementById('cmdk-list'); const items = Array.from(list.querySelectorAll('.cmdk-item')); if (!items.length) return;
    const currentIdx = items.findIndex(el => el.classList.contains('active'));
    if (e.key === 'ArrowDown') { e.preventDefault(); const next = Math.min(items.length - 1, currentIdx + 1); items[currentIdx]?.classList.remove('active'); items[next].classList.add('active'); items[next].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const prev = Math.max(0, currentIdx - 1); items[currentIdx]?.classList.remove('active'); items[prev].classList.add('active'); items[prev].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); const active = items.find(el => el.classList.contains('active')); const idx = active ? parseInt(active.dataset.index, 10) : NaN; if (!isNaN(idx)) { this.closeCommandPalette(); this.startSession(idx); } }
    else if (e.key === 'Escape') { e.preventDefault(); this.closeCommandPalette(); }
  }

  openHelp() { document.getElementById('help-modal').classList.add('active'); }
  closeHelp() { document.getElementById('help-modal').classList.remove('active'); }

  getSaveSnapshot() { return {
    healed: Array.from(this.healedNPCs),
    unlocked: Array.from(this.unlockedNPCs),
    mentalState: this.therapistMentalState,
    collectibles: this.collectibles,
    time: this.gameTime,
    award: this.chromaAwardGiven,
    credits: this.communityCredits,
    npcNotes: this.npcNotes,
    archives: this.sessionArchives
  }; }

  applySaveData(saveData) {
    this.healedNPCs = new Set(saveData.healed || []); this.healedVersion++;
    if (saveData.unlocked && saveData.unlocked.length > 0) { this.unlockedNPCs = new Set(saveData.unlocked); this.unlockedVersion++; }
    else { const finalIds = new Set(['hackathon_judge','meta_receptionist','therapist_shadow','the_therapist']); this.unlockedNPCs = new Set(this.npcs.map((n,i)=>({n,i})).filter(item=>!finalIds.has(item.n.id)).map(item=>item.i)); }
    this.therapistMentalState = saveData.mentalState || 0; this.collectibles = saveData.collectibles || [];
    this.gameTime = saveData.time || 0; this.chromaAwardGiven = saveData.award || false;
    this.communityCredits = saveData.credits || []; this.npcNotes = saveData.npcNotes || {};
    this.sessionArchives = saveData.archives || {};
  }

  autosave() {
    if (this._autosavePending) return;
    this._autosavePending = true;
    const saveTask = () => {
      this._autosavePending = false;
      try {
        const snapshot = this.getSaveSnapshot();
        localStorage.setItem('autosave_v1', JSON.stringify(snapshot));
      } catch (_) {}
    };

    if (window.requestIdleCallback) {
      window.requestIdleCallback(saveTask, { timeout: 2000 });
    } else {
      setTimeout(saveTask, 100);
    }
  }
  loadAutosaveIfAvailable() {
    try { const raw = localStorage.getItem('autosave_v1'); if (!raw) return false; const data = JSON.parse(raw); this.applySaveData(data); this.loadNpcEdits(); this.startTime = Date.now() - (this.gameTime * 1000); this.startTimer(); this.updateStats(); this.renderCommunityCredits(); this.updateMenuRosterView(); this.updateTherapistState(); this.toast('Progress restored.'); this.startAutosave(); return true; } catch (_) { return false; }
  }
  startAutosave() { if (this._autosaveTimer) clearInterval(this._autosaveTimer); this._autosaveTimer = setInterval(() => this.autosave(), 30000); }
  stopAutosave() { if (this._autosaveTimer) { clearInterval(this._autosaveTimer); this._autosaveTimer = null; } }
  hasAutosave() { try { return !!localStorage.getItem('autosave_v1'); } catch (_) { return false; } }
  continueAutosave() { if (this.loadAutosaveIfAvailable()) this.showScreen('main-menu'); }
}
