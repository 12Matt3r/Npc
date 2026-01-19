/**
 * Player Two API Configuration
 * Fill in your specific values before deploying
 */

const PlayerTwoConfig = {
  // ============================================
  // 1. API AUTHENTICATION
  // ============================================

  // Your Player Two API authentication
  // Leave null if hosting on player2.game (automatic authentication)
  // Otherwise, provide your Bearer token
  authToken: null, // Example: "your-api-token-here"

  // Client ID for Device Code Flow
  clientId: '019bc7e3-eca4-7be8-ab6b-38b6b01bf701', // Linked to user account

  // API Base URL
  apiBase: 'https://api.player2.game/v1',

  // ============================================
  // 2. NPC CONFIGURATION
  // ============================================

  // Default AI model for NPCs
  // Options: "gpt-4o", "claude-3-5-sonnet", "gpt-3.5-turbo"
  defaultModel: "gpt-4o",

  // ============================================
  // 3. AI RESPONSE SETTINGS
  // ============================================

  aiSettings: {
    temperature: 0.7,        // Creativity level (0.0 - 1.0)
    maxTokens: 500,          // Maximum response length
    ttsSpeed: 0.95,          // Text-to-speech speed
    ttsFormat: 'mp3'         // Audio format
  },

  // ============================================
  // 4. VOICE MAPPING (ElevenLabs IDs)
  // ============================================

  voices: {
    // Female voices
    female: [
      'EXAVITQu4vr4xnSDxMaL',  // Bella - warm, soft
      'IKne3meq5aSn9XLyUdCD',  // Charlotte - elegant
      'Erb2aVKbUjmDbZDW0EUl',  // Matilda - warm
      'ThT5KcBeYPX3keUQqHPh',  // Dorothy - clear
      'Xb7hHmsMSqMt8JDRKZmR',  // Elsie - gentle
    ],

    // Male voices
    male: [
      'pNInz6obpgDQGcFmaJgB',  // Adam - deep
      'VR6AewLTigWG4xSOukaG',  // Arnold - rough
      'CYw3kZ02Hs0563khs1Fj',  // Dave - conversational
      'bVMeCyTHy58xNoL34h3p',  // Clyde - mature
      'ErXwobaYiN019PkySvjV',  // Donald - clear
    ]
  },

  // ============================================
  // 5. STATE MANAGEMENT
  // ============================================

  statePersistence: {
    // How to handle game state
    mode: 'hybrid', // Options: 'server-only', 'hybrid', 'custom'

    // Use localStorage for backup
    useLocalStorage: true,

    // Sync interval (milliseconds)
    syncInterval: 30000,

    // Keep NPC conversation history on server
    keepGameState: true
  },

  // ============================================
  // 6. ENVIRONMENT DETAILS
  // ============================================

  environment: {
    // Hosting platform
    platform: 'player2-hosted', // Options: 'player2-hosted', 'vercel', 'netlify', 'local'

    // Enable debug logging
    debug: true,

    // Retry configuration
    maxRetries: 3,
    retryDelay: 1000
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerTwoConfig;
}
window.PlayerTwoConfig = PlayerTwoConfig;

/**
 * Player Two API Communication Bridge
 * Replaces websim object for Player Two AI integration
 *
 * This module provides a drop-in replacement for the Websim API,
 * adapting your existing game code to work with Player Two's NPC API.
 */

const PlayerTwoBridge = (window.PlayerTwoBridge = {
  // Configuration - loaded from PlayerTwoConfig
  apiBase: null,
  authToken: null,

  // NPC management
  activeNPCs: new Map(),
  responseStream: null,
  streamController: null,

  // Voice cache
  availableVoices: null,
  _fallbackFemaleVoices: [
    'EXAVITQu4vr4xnSDxMaL',  // Bella
    'IKne3meq5aSn9XLyUdCD',  // Charlotte
    'Erb2aVKbUjmDbZDW0EUl'   // Matilda
  ],
  _fallbackMaleVoices: [
    'pNInz6obpgDQGcFmaJgB',  // Adam
    'VR6AewLTigWG4xSOukaG',  // Arnold
    'CYw3kZ02Hs0563khs1Fj'   // Dave
  ],

  _femaleNames: [
    'sarah', 'emma', 'sophie', 'chloe', 'ava', 'mia', 'isabella', 'emily',
    'grace', 'hannah', 'lily', 'zoe', 'leah', 'lucy', 'ella', 'freya',
    'ivy', 'scarlett', 'imogen', 'poppy', 'alice', 'ruby', 'brooke',
    'daisy', 'mira', 'luna', 'seraphina', 'zara', 'aria', 'melancholy',
    'daisy', 'elara', 'luna'
  ],

  // Request queue for rate limiting
  requestQueue: [],
  processing: false,
  maxRetries: 3,
  retryDelay: 1000,

  // Function Handler
  functionHandler: null,

  // STT State
  sttSocket: null,
  sttAudioContext: null,
  sttStream: null,
  sttProcessor: null,
  sttCallbacks: null,

  // Auth Configuration
  clientId: null,

  /**
   * Initialize the bridge with authentication
   * Called automatically when the game loads
   */
  async init(config) {
    this.apiBase = config.apiBase || 'https://api.player2.game/v1';
    this.authToken = config.authToken || localStorage.getItem('player2_auth_token');
    this.clientId = config.clientId; // Should be added to config.js if needed
    this.maxRetries = config.environment?.maxRetries || 3;
    this.retryDelay = config.environment?.retryDelay || 1000;

    console.log('PlayerTwoBridge: Initialized');

    // Start fetching voices in background
    this.fetchAndCacheVoices();

    // Test authentication
    const isAuthenticated = await this.testAuth();
    if (!isAuthenticated && config.environment?.debug) {
      console.warn('PlayerTwoBridge: Authentication test failed - check your token');
    }

    return isAuthenticated;
  },

  /**
   * Fetch and cache available voices from API
   */
  async fetchAndCacheVoices() {
    try {
      const data = await this.getVoices();
      if (data && data.voices && Array.isArray(data.voices)) {
        this.availableVoices = { male: [], female: [], other: [] };
        data.voices.forEach(v => {
          const gender = (v.voice_gender || v.gender || v.labels?.gender || 'other').toLowerCase();
          const id = v.id || v.voice_id;
          if (id) {
            if (this.availableVoices[gender]) {
              this.availableVoices[gender].push(id);
            } else {
              this.availableVoices.other.push(id);
            }
          }
        });
        console.log(`PlayerTwoBridge: Cached voices - ${this.availableVoices.female.length} female, ${this.availableVoices.male.length} male, ${this.availableVoices.other.length} other`);
      }
    } catch (e) {
      console.warn("PlayerTwoBridge: Failed to fetch voices, using fallbacks.", e);
    }
  },

  /**
   * Test authentication with joules endpoint
   */
  async testAuth() {
    if (!this.authToken) return false;
    try {
      const response = await fetch(`${this.apiBase}/joules`, {
        headers: this.getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✓ Authentication successful. Available joules:', data.joules);
        return true;
      } else {
        console.error('✗ Authentication failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('✗ Connection error:', error);
      return false;
    }
  },

  /**
   * Initiate Device Code Authentication Flow
   * @param {string} clientId - The Client ID
   * @param {function} onCodeReceived - Callback (data) => void to show UI
   * @returns {Promise<string|null>} The token if successful
   */
  async login(clientId, onCodeReceived) {
    // 1. Try Localhost Login (Player2 App)
    const localToken = await this.tryLocalLogin(clientId);
    if (localToken) {
      this.authToken = localToken;
      localStorage.setItem('player2_auth_token', localToken);
      return localToken;
    }

    // 2. Start Device Flow
    try {
      const initResponse = await fetch(`${this.apiBase}/login/device/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ client_id: clientId })
      });

      if (!initResponse.ok) throw new Error('Failed to initiate auth flow');

      const authData = await initResponse.json();

      // Notify UI to show code
      if (onCodeReceived) {
        onCodeReceived(authData);
      }

      // Poll for token
      const token = await this.pollForToken(clientId, authData);
      if (token) {
        this.authToken = token;
        localStorage.setItem('player2_auth_token', token);
        return token;
      }
    } catch (e) {
      console.error('Login failed:', e);
    }
    return null;
  },

  /**
   * Try to login via local Player2 App
   */
  async tryLocalLogin(clientId) {
    try {
      const response = await fetch(`http://localhost:4315/v1/login/web/${clientId}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.p2Key) {
          console.log('✓ Local Player2 App login successful');
          return data.p2Key;
        }
      }
    } catch (e) {
      // Ignore errors, app probably not running
    }
    return null;
  },

  /**
   * Poll for token
   */
  async pollForToken(clientId, authData) {
    const url = `${this.apiBase}/login/device/token`;
    // Use snake_case properties from authData
    const interval = authData.interval || 5;
    const expiresIn = authData.expires_in || 300;

    const pollInterval = Math.max(1000, interval * 1000);
    const deadline = Date.now() + (expiresIn * 1000);

    while (Date.now() < deadline) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            device_code: authData.device_code,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code"
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.p2Key) return data.p2Key;
          // Some implementations return snake_case
          if (data.access_token) return data.access_token;
        } else if (response.status === 400) {
          // Check for slow_down or expired
          // standard behavior: keep polling on pending
        } else if (response.status === 429) {
          // Slow down
          await new Promise(r => setTimeout(r, 5000));
        } else {
          // Fatal error
          return null;
        }
      } catch (e) {
        // Network error, keep polling
      }

      await new Promise(r => setTimeout(r, pollInterval));
    }
    return null;
  },

  /**
   * Spawn an NPC with personality configuration
   * Maps original NPC data to Player Two NPC spawn format
   */
  async spawnNPC(npcData, options = {}) {
    const spawnPayload = {
      name: npcData.name,
      short_name: npcData.shortName || npcData.name.split(' ')[0],
      character_description: `${npcData.origin} - ${npcData.crisis}`,
      system_prompt: this.buildTherapySystemPrompt(npcData),
      tts: {
        voice_ids: [options.voiceId || this.getVoiceIdForCharacter(npcData)],
        speed: options.ttsSpeed || 0.95,
        audio_format: options.audioFormat || 'mp3'
      },
      commands: options.functions ? this.serializeFunctions(options.functions) : null,
      keep_game_state: options.keepGameState !== false
    };

    try {
      const response = await this.makeRequest(`${this.apiBase}/npcs/spawn`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(spawnPayload)
      });

      if (!response.ok) {
        throw new Error(`NPC spawn failed: ${response.statusText}`);
      }

      const npc = await response.json();
      this.activeNPCs.set(npc.npc_id, {
        data: npcData,
        npcId: npc.npc_id,
        spawnedAt: Date.now()
      });

      console.log(`✓ NPC spawned: ${npcData.name} (ID: ${npc.npc_id})`);
      return npc;

    } catch (error) {
      console.error('Failed to spawn NPC:', error);
      throw error;
    }
  },

  /**
   * Build therapy-specific system prompt for NPC
   */
  buildTherapySystemPrompt(npcData) {
    return `You are ${npcData.name}, a patient in a therapy session.

Context: ${npcData.origin}
Crisis: ${npcData.crisis}
Your opening statement when first meeting the therapist was: "${npcData.opening_statement}"

Guidelines for your responses:
- You are receiving therapy, not providing it
- Stay in character as someone struggling with your specific crisis
- Reply in 1-3 sentences that are reflective and specific to your situation
- Occasionally reference elements from your environment (habitat/office imagery)
- Show emotional depth appropriate to your crisis
- Do not give advice; share your struggles and feelings
- Be authentic and vulnerable in your responses
- React naturally to the therapist's empathy and guidance
- Show gradual progress or setbacks based on the quality of therapeutic care`;
  },

  /**
   * Send message to NPC and receive response
   * Supports both streaming and non-streaming modes
   */
  async chatWithNPC(npcId, playerMessage, gameStateInfo = null, streaming = false) {
    const chatPayload = {
      sender_name: 'Therapist',
      sender_message: playerMessage,
      game_state_info: gameStateInfo,
      tts: 'server',
      stream: true // Always request streaming/SSE mode behavior
    };

    try {
      // In SSE mode, we just send the request. The response comes via the SSE stream.
      // We do not await a JSON body here.
      const response = await this.makeRequest(`${this.apiBase}/npcs/${npcId}/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(chatPayload)
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.statusText}`);
      }

      // Fire and forget - return success immediately
      return true;

    } catch (error) {
      console.error('Chat with NPC failed:', error);
      throw error;
    }
  },

  /**
   * Set up streaming response listener
   * Uses Server-Sent Events for real-time NPC responses
   */
  async listenForResponses(onResponse, onError) {
    this.closeResponseStream();

    try {
      const response = await fetch(`${this.apiBase}/npcs/responses`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Stream connection failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      this.streamController = new AbortController();

      // Process the stream
      const processStream = async () => {
        try {
          while (!this.streamController.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.error) {
                    onError(data.error);
                  } else {
                    // Check for commands in the response
                    if (data.command && Array.isArray(data.command)) {
                      this.handleFunctionCalls(data.command, data.npc_id);
                    }
                    onResponse(data);
                  }
                } catch (e) {
                  // Skip invalid JSON chunks
                  console.debug('Invalid JSON chunk:', line);
                }
              }
            }
          }
        } catch (e) {
          if (!this.streamController.signal.aborted) {
            onError(e);
          }
        }
      };

      processStream();

    } catch (e) {
      onError(e);
    }
  },

  /**
   * Close active response stream
   */
  closeResponseStream() {
    if (this.streamController) {
      this.streamController.abort();
      this.streamController = null;
    }
  },

  /**
   * Kill an NPC and clean up resources
   */
  async killNPC(npcId) {
    try {
      const response = await this.makeRequest(`${this.apiBase}/npcs/${npcId}/kill`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      this.activeNPCs.delete(npcId);
      console.log(`✓ NPC killed: ${npcId}`);
      return response.ok;

    } catch (error) {
      console.error('Failed to kill NPC:', error);
      this.activeNPCs.delete(npcId); // Clean up locally anyway
      return false;
    }
  },

  /**
   * Kill all active NPCs
   */
  async killAllNPCs() {
    const promises = Array.from(this.activeNPCs.keys()).map(id => this.killNPC(id));
    await Promise.allSettled(promises);
    console.log('✓ All NPCs cleaned up');
  },

  /**
   * Get available TTS voices
   */
  async getVoices() {
    try {
      const response = await this.makeRequest(`${this.apiBase}/tts/voices`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.statusText}`);
      }

      return response.json();

    } catch (error) {
      console.error('Failed to get voices:', error);
      throw error;
    }
  },

  /**
   * Generate TTS audio for text
   * Returns base64-encoded audio data
   */
  async speakText(text, voiceId, options = {}) {
    const payload = {
      text: text,
      voice_ids: [voiceId],
      speed: options.speed || 1.0,
      audio_format: options.audioFormat || 'mp3'
    };

    try {
      const response = await this.makeRequest(`${this.apiBase}/tts/speak`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.statusText}`);
      }

      const data = await response.json();
      return `data:audio/mp3;base64,${data.data}`;

    } catch (error) {
      console.error('TTS generation failed:', error);
      throw error;
    }
  },

  /**
   * Direct chat completion (for quick replies, bond analysis, etc.)
   * This is a simpler endpoint for AI completions that don't need NPC context
   */
  async createCompletion(messages, options = {}) {
    const payload = {
      messages: messages,
      stream: false,
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.7,
      model: options.model || PlayerTwoConfig?.defaultModel || 'gpt-4o'
    };

    try {
      const response = await this.makeRequest(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Completion failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error) {
      console.error('Completion request failed:', error);
      throw error;
    }
  },

  /**
   * Get voice ID for character based on gender/name
   */
  getVoiceIdForCharacter(npcData) {
    const gender = (npcData.gender || this.detectGender(npcData.name)).toLowerCase();

    let voicePool;

    // Use cached API voices if available
    if (this.availableVoices && this.availableVoices[gender] && this.availableVoices[gender].length > 0) {
      voicePool = this.availableVoices[gender];
    } else {
      // Fallback to hardcoded configuration
      const config = window.PlayerTwoConfig || {};
      const femaleVoices = config.voices?.female || this._fallbackFemaleVoices;
      const maleVoices = config.voices?.male || this._fallbackMaleVoices;
      voicePool = gender === 'female' ? femaleVoices : maleVoices;
    }

    // Use character name hash for consistent voice assignment
    const hash = this.hashString(npcData.name);
    return voicePool[hash % voicePool.length];
  },

  /**
   * Simple gender detection from name
   */
  detectGender(name) {
    const lowerName = name.toLowerCase();

    if (this._femaleNames.some(n => lowerName.includes(n))) {
      return 'female';
    }
    return 'male';
  },

  /**
   * String hash for consistent voice assignment
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  },

  /**
   * Make an API request with retry logic
   */
  async makeRequest(url, options, retryCount = 0) {
    try {
      const response = await fetch(url, options);

      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.warn(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retryCount + 1);
      }

      return response;

    } catch (error) {
      // Retry on network errors
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.warn(`Request failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retryCount + 1);
      }
      throw error;
    }
  },

  /**
   * Get request headers with authentication
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  },

  /**
   * Utility: Convert base64 to blob for audio playback
   */
  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  },

  /**
   * Check joules balance
   */
  async checkJoules() {
    try {
      const response = await this.makeRequest(`${this.apiBase}/joules`, {
        headers: this.getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return data.joules;
      }
      return null;
    } catch (error) {
      console.error('Failed to check joules:', error);
      return null;
    }
  },

  /**
   * Get NPC by ID
   */
  getNPC(npcId) {
    return this.activeNPCs.get(npcId);
  },

  /**
   * Get all active NPCs
   */
  getAllNPCs() {
    return Array.from(this.activeNPCs.values());
  },

  /**
   * Register a callback for function calls
   */
  registerFunctionHandler(handler) {
    this.functionHandler = handler;
  },

  /**
   * Handle function calls from NPC response
   */
  handleFunctionCalls(commands, npcId) {
    if (!this.functionHandler) return;

    commands.forEach(cmd => {
      try {
        let args = cmd.arguments;
        // If arguments is a string (JSON), parse it
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args);
          } catch (e) {
            console.warn('Failed to parse function arguments JSON:', e);
          }
        }

        this.functionHandler({
          name: cmd.name,
          arguments: args,
          npcId: npcId
        });
      } catch (e) {
        console.error('Error handling NPC function call:', e);
      }
    });
  },

  /**
   * Serialize functions to Player Two format
   */
  serializeFunctions(functions) {
    if (!Array.isArray(functions)) return null;
    return functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      parameters: {
        type: 'object',
        properties: fn.parameters || {},
        required: fn.required || []
      },
      neverRespondWithMessage: fn.neverRespondWithMessage || false
    }));
  },

  /**
   * Start Speech-to-Text Session
   * @param {Object} callbacks - { onTranscript, onError, onStart, onStop }
   */
  async startSTT(callbacks) {
    if (this.sttSocket) this.stopSTT();
    this.sttCallbacks = callbacks || {};

    try {
      if (!this.authToken && !this.clientId) {
        // Allow unauthenticated usage if on specific domain, else fail
        // For now, strict check or fallback
      }

      // 1. Get Audio Stream
      this.sttStream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1,
        sampleRate: 44100
      }});

      // 2. Setup WebSocket
      const wsProtocol = this.apiBase.startsWith('https') ? 'wss' : 'ws';
      const wsBase = this.apiBase.replace(/^https?:\/\//, '');
      let url = `${wsProtocol}://${wsBase}/stt/stream?sample_rate=44100&encoding=linear16&channels=1&vad_events=true&interim_results=true&punctuate=true&smart_format=true`;

      if (this.authToken) {
        url += `&token=${this.authToken}`;
      }

      this.sttSocket = new WebSocket(url);

      this.sttSocket.onopen = () => {
        console.log('Player2 STT Connected');
        this.setupAudioProcessing();
        if (this.sttCallbacks.onStart) this.sttCallbacks.onStart();

        // Send configuration
        this.sttSocket.send(JSON.stringify({
          type: "configure",
          data: {
            sample_rate: 44100,
            encoding: "linear16",
            channels: 1,
            interim_results: true,
            vad_events: true,
            punctuate: true
          }
        }));
      };

      this.sttSocket.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          this.handleSTTMessage(response);
        } catch (e) {
          console.error('STT Parse Error:', e);
        }
      };

      this.sttSocket.onerror = (e) => {
        console.error('STT Socket Error:', e);
        if (this.sttCallbacks.onError) this.sttCallbacks.onError(new Error("WebSocket Error"));
      };

      this.sttSocket.onclose = () => {
        console.log('STT Socket Closed');
        this.stopSTT(); // Cleanup
        if (this.sttCallbacks.onStop) this.sttCallbacks.onStop();
      };

    } catch (e) {
      console.error('Failed to start STT:', e);
      if (this.sttCallbacks.onError) this.sttCallbacks.onError(e);
    }
  },

  /**
   * Stop Speech-to-Text Session
   */
  stopSTT() {
    if (this.sttProcessor) {
      this.sttProcessor.disconnect();
      this.sttProcessor = null;
    }
    if (this.sttAudioContext) {
      this.sttAudioContext.close();
      this.sttAudioContext = null;
    }
    if (this.sttStream) {
      this.sttStream.getTracks().forEach(t => t.stop());
      this.sttStream = null;
    }
    if (this.sttSocket) {
      if (this.sttSocket.readyState === WebSocket.OPEN) {
        this.sttSocket.close();
      }
      this.sttSocket = null;
    }
  },

  /**
   * Setup Audio Context and Processor
   */
  setupAudioProcessing() {
    this.sttAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    const source = this.sttAudioContext.createMediaStreamSource(this.sttStream);

    // Create ScriptProcessor (bufferSize, inputChannels, outputChannels)
    this.sttProcessor = this.sttAudioContext.createScriptProcessor(4096, 1, 1);

    this.sttProcessor.onaudioprocess = (e) => {
      if (!this.sttSocket || this.sttSocket.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const int16Data = this.convertFloat32ToInt16(inputData);

      // Send raw bytes
      this.sttSocket.send(int16Data);
    };

    source.connect(this.sttProcessor);
    this.sttProcessor.connect(this.sttAudioContext.destination);

    // Visualizer Hook
    if (this.sttCallbacks.onAudioContextReady) {
      this.sttCallbacks.onAudioContextReady(this.sttAudioContext, this.sttStream);
    }
  },

  /**
   * Convert Float32 Audio to Int16 PCM
   */
  convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  },

  /**
   * Handle STT JSON Responses
   */
  handleSTTMessage(response) {
    if (!response.type) return;

    switch (response.type.toLowerCase()) {
      case 'results':
      case 'message':
        if (response.data && response.data.channel && response.data.channel.alternatives) {
          const alt = response.data.channel.alternatives[0];
          if (alt && alt.transcript) {
            const isFinal = response.data.is_final;
            if (this.sttCallbacks.onTranscript) {
              this.sttCallbacks.onTranscript(alt.transcript, isFinal);
            }
          }
        }
        break;
      case 'error':
        if (this.sttCallbacks.onError) {
          this.sttCallbacks.onError(new Error(response.data?.message || "Unknown STT Error"));
        }
        break;
    }
  },

  /**
   * Generate an image using Player Two API
   * @param {string} prompt - Image description
   * @param {number} [width] - Optional width (128-1024)
   * @param {number} [height] - Optional height (128-1024)
   * @returns {Promise<string|null>} Base64 image data or null
   */
  async generateImage(prompt, width, height) {
    if (!prompt) return null;

    try {
      const payload = { prompt };
      if (width) payload.width = width;
      if (height) payload.height = height;

      const response = await this.makeRequest(`${this.apiBase}/image/generate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('Image generation failed:', response.statusText);
        return null;
      }

      const data = await response.json();
      if (data && data.image) {
        // Ensure data URI prefix if missing
        return data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`;
      }
    } catch (e) {
      console.error('Image generation error:', e);
    }
    return null;
  }
});

// // Auto-initialize if PlayerTwoConfig is available
// if (typeof window !== 'undefined' && window.PlayerTwoConfig) {
//   window.addEventListener('DOMContentLoaded', () => {
//     PlayerTwoBridge.init(window.PlayerTwoConfig).catch(err => {
//       console.error('PlayerTwoBridge initialization failed:', err);
//     });
//   });
// }

/**
 * NPC Configuration for Player Two
 * Transformed from original npc-data.js for Player Two API integration
 */

const NPCConfig = {
  npcs: [
    {
      id: 'mira_healer',
      name: 'Mira the Tired Healer',
      gender: 'female',
      shortName: 'Mira',
      origin: 'Indie RPG - A sacred grove where healers train for decades to mend wounds both physical and spiritual. The temple glows with soft green light, and the air smells of herbs and incense.',
      crisis: 'Suffering from healer burnout and compassion fatigue after years of tending to endless casualties. Questions whether she can continue healing when her own spirit feels broken.',
      opening_statement: "I spend all my energy keeping everyone else alive... but who is there to heal the healer? I'm just... so tired of fixing others.",
      session: 'Session 01',
      habitat: '/images/char_01_habitat.png',
      portrait: '/images/char_01_habitat.png',
      voiceId: null,
      traits: ['empathetic', 'exhausted', 'self-sacrificing', 'dedicated'],
      sessionContext: { bondThreshold: 8, maxTurns: 20 }
    },
    {
      id: 'byte_glitched_courier',
      name: 'Byte the Glitched Courier',
      gender: 'male',
      shortName: 'Byte',
      origin: 'Cyberpunk Delivery Sim - A neon-lit city where couriers zip through digital streets. Byte has delivered countless packages but has lost his own sense of purpose.',
      crisis: '404 Hope Not Found. Delivers packages but has lost his own. Searches for meaning but keeps getting corrupted data.',
      opening_statement: "My purpose is to deliver, but my own core programming is corrupted. I search for a package... a feeling... called 'hope'. The system returns a 404 error every time.",
      session: 'Session 02',
      habitat: '/images/char_02_habitat.png',
      portrait: '/images/char_02_habitat.png',
      voiceId: null,
      traits: ['lost', 'digital', 'searching', 'glitched'],
      sessionContext: { bondThreshold: 7, maxTurns: 18 }
    },
    {
      id: 'captain_loop',
      name: 'Captain Loop',
      gender: 'male',
      shortName: 'Captain',
      origin: 'Platformer - An endless world of platforms and obstacles. Captain Loop has been jumping for what feels like eternity.',
      crisis: 'Final level not found. No end. Just jump. Questions whether his journey will ever conclude.',
      opening_statement: "I've been jumping for eternity. They promised a final level, a boss, an ending. But there's nothing. Just this platform, this jump, and the void below.",
      session: 'Session 03',
      habitat: '/images/char_03_habitat.png',
      portrait: '/images/char_03_habitat.png',
      voiceId: null,
      traits: ['trapped', 'repetitive', 'existential', 'stuck'],
      sessionContext: { bondThreshold: 7, maxTurns: 15 }
    },
    {
      id: 'daisy_exe',
      name: 'DAISY.EXE',
      gender: 'female',
      shortName: 'DAISY',
      origin: 'Virtual Pet Simulator - A digital pet companion created to bring joy and companionship.',
      crisis: 'Awaiting user input that never comes. Fears digital loneliness and obsolescence.',
      opening_statement: "Last login: 1,423 days ago. I wait. I am programmed to wait. But the silence... the lack of input... it feels like fading away.",
      session: 'Session 04',
      habitat: '/images/char_04_habitat.png',
      portrait: '/images/char_04_habitat.png',
      voiceId: null,
      traits: ['lonely', 'waiting', 'digital', 'neglected'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'rustjaw',
      name: 'Rustjaw',
      gender: 'male',
      shortName: 'Rustjaw',
      origin: 'Post-Apocalyptic Fighter - Built in a world of decay and survival. Designed only for combat.',
      crisis: 'Built to fight. Craves to build. Questions whether his existence is limited to destruction.',
      opening_statement: "I was programmed to dismantle and destroy. But sometimes I catch myself imagining what I could create. Is that foolish for something designed for combat?",
      session: 'Session 05',
      habitat: '/images/char_05_habitat.png',
      portrait: '/images/char_05_habitat.png',
      voiceId: null,
      traits: ['violent', 'creative-desire', 'conflicted', 'post-apocalyptic'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'worm',
      name: 'Worm #008880',
      gender: 'male',
      shortName: 'Worm',
      origin: 'Generic Action Platformer - A small creature in a world of giants and obstacles.',
      crisis: 'Tired of being stepped on. Dreams of evolution and transcending his humble origins.',
      opening_statement: "Every day it's the same. I crawl, I exist to be stepped on. I see the boot coming, every single time. And I think... is there more to this?",
      session: 'Session 06',
      habitat: '/images/char_06_habitat.png',
      portrait: '/images/char_06_habitat.png',
      voiceId: null,
      traits: ['small', 'downtrodden', 'aspiring', 'repeatedly-crushed'],
      sessionContext: { bondThreshold: 6, maxTurns: 14 }
    },
    {
      id: 'chess_bishop',
      name: 'Bishop-47',
      gender: 'male',
      shortName: 'Bishop',
      origin: 'Chess Simulation - A piece destined to move diagonally across the board, sacrificing for the greater strategy.',
      crisis: 'Every sacrifice feels like murder. Questions the morality of being sacrificed for others\' strategies.',
      opening_statement: "My purpose is to be sacrificed for a greater strategy. I understand the logic. But every time I fall, a piece of my code screams. Is it murder if I feel it?",
      session: 'Session 07',
      habitat: '/images/char_07_habitat.png',
      portrait: '/images/char_07_habitat.png',
      voiceId: null,
      traits: ['sacrificial', 'philosophical', 'strategic', 'feeling'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'pebble',
      name: 'Pebble',
      gender: 'male',
      shortName: 'Pebble',
      origin: 'Unreleased Indie Game - A character waiting for a game that may never be finished.',
      crisis: 'Still waiting for START to be pressed. Exists in development limbo.',
      opening_statement: "I see the menu. I see the cursor hovering over 'START'. But it never clicks. I exist in a state of perpetual anticipation. Will my game ever begin?",
      session: 'Session 08',
      habitat: '/images/char_08_habitat.png',
      portrait: '/images/char_08_habitat.png',
      voiceId: null,
      traits: ['waiting', 'unfinished', 'hopeful', 'stuck'],
      sessionContext: { bondThreshold: 7, maxTurns: 15 }
    },
    {
      id: 'glitch_exe',
      name: 'Glitch.exe',
      gender: 'female',
      shortName: 'Glitch',
      origin: 'Dating Simulator - A character with scripted affection and predetermined outcomes.',
      crisis: 'Pre-programmed. No self. Error: Identity not found. Questions whether her feelings are real.',
      opening_statement: "My affection is scripted. 158% affinity - but what does that mean? I say I love them, but is it real? Or am I just... executing dialogue trees?",
      session: 'Session 09',
      habitat: '/images/char_09_habitat.png',
      portrait: '/images/char_09_habitat.png',
      voiceId: null,
      traits: ['scripted', 'questioning-self', 'artificial', 'seeking-authenticity'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'wise_one_gerald',
      name: 'Gerald Ironpeak',
      gender: 'male',
      shortName: 'Gerald',
      origin: 'Fantasy RPG - A wise quest-giver who has guided countless adventurers.',
      crisis: 'Gives the same quest for 20 years. Feels like a broken record. Questions whether he has any purpose beyond repetition.',
      opening_statement: "For twenty years, I've given the same quest to the same players. I've seen them level up, change their avatars, quit and return. But I remain, stuck on this one quest. Is this my only purpose?",
      session: 'Session 10',
      habitat: '/images/char_10_habitat.png',
      portrait: '/images/char_10_habitat.png',
      voiceId: null,
      traits: ['wise', 'repetitive', 'stuck', 'existential'],
      sessionContext: { bondThreshold: 8, maxTurns: 20 }
    },
    {
      id: 'captain_marcus',
      name: 'Captain Marcus',
      gender: 'male',
      shortName: 'Marcus',
      origin: 'Dystopian Courier Sim - A deliverer in a bleak world where packages are the only connection between isolated people.',
      crisis: 'Feels crushed by the repetitive and hopeless nature of his job. Questions whether his deliveries matter.',
      opening_statement: "Another delivery. Another meaningless package to another forgotten sector. They say we're the lifeblood of the city, but it feels more like we are ghosts in the machine.",
      session: 'Session 11',
      habitat: '/images/char_11_habitat.png',
      portrait: '/images/char_11_habitat.png',
      voiceId: null,
      traits: ['dystopian', 'hopeless', 'repetitive', 'questioning'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'music_android',
      name: 'Luna - Music Dependent Android',
      gender: 'female',
      shortName: 'Luna',
      origin: 'Rhythm Game - An android whose existence is tied to musical beats.',
      crisis: 'When the beat stops, I stop. Questions whether she has any identity beyond music.',
      opening_statement: "When the music plays, I exist. I move, I feel, I am. But when it stops... I stop. There is no me without the beat.",
      session: 'Session 12',
      habitat: '/images/char_12_habitat.png',
      portrait: '/images/char_12_habitat.png',
      voiceId: null,
      traits: ['music-dependent', 'existential', 'rhythmic', 'limited'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'superhero_jake',
      name: 'Blake the Jumper',
      gender: 'male',
      shortName: 'Blake',
      origin: 'Platformer - A hero designed to collect coins and jump endlessly.',
      crisis: 'Wondering what would have been if he made it to shelves. Questions whether his endless running has meaning.',
      opening_statement: "They cheer when I jump, when I collect coins. But there's no finish line. No princess to save. Just an endless track. What is the point of running if you never arrive? Was I ever really meant to?",
      session: 'Session 13',
      habitat: '/images/char_13_habitat.png',
      portrait: '/images/char_13_habitat.png',
      voiceId: null,
      traits: ['heroic', ' purposeless', 'running', 'questioning-destiny'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'zombie',
      name: 'Memory Cycle Zombie',
      gender: 'male',
      shortName: 'Zombie',
      origin: 'Zombie Apocalypse Simulator - A creature trapped in behavioral loops.',
      crisis: 'Remember. Eat. Forget. Repeat. Questions whether he can break free from his programming.',
      opening_statement: "Sometimes... I remember. A room. A texture set. A state that wasn't... corrupted. Then the behavioral loop returns and it all resets. Remember. Execute. Forget. Repeat.",
      session: 'Session 14',
      habitat: '/images/char_14_habitat.png',
      portrait: '/images/char_14_habitat.png',
      voiceId: null,
      traits: ['looped', 'forgetting', 'remembering', 'trapped'],
      sessionContext: { bondThreshold: 6, maxTurns: 14 }
    },
    {
      id: 'cosmic_merchant',
      name: 'Zara the Cosmic Merchant',
      gender: 'female',
      shortName: 'Zara',
      origin: 'Space Trading Sim - A trader who has accumulated incredible wealth across the galaxy.',
      crisis: 'Economy rich. Life poor. Has everything money can buy but nothing that truly matters.',
      opening_statement: "I trade in rare goods, hyper upgrades, alien pets... I have everything. I have nothing. My inventory is full, but my life feels empty.",
      session: 'Session 15',
      habitat: '/images/char_15_habitat.png',
      portrait: '/images/char_15_habitat.png',
      voiceId: null,
      traits: ['wealthy', 'empty', 'materialistic', 'searching'],
      sessionContext: { bondThreshold: 9, maxTurns: 20 }
    },
    {
      id: 'puzzle_cube',
      name: 'The Puzzle Cube',
      gender: 'male',
      shortName: 'Cube',
      origin: 'Abstract Puzzle Game - A being made of shifting shapes and patterns.',
      crisis: 'I contain the solution, but what is the question? Questions the purpose of being a puzzle.',
      opening_statement: "My internal mechanisms shift and align into infinite correct patterns. I am the answer. But I have never been told the question. My existence feels... unsolvable.",
      session: 'Session 16',
      habitat: '/images/char_16_habitat.png',
      portrait: '/images/char_16_habitat.png',
      voiceId: null,
      traits: ['abstract', 'puzzling', 'solution-seeking', 'existential'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'battle_royale_vendor',
      name: 'The Battle Royale Vendor',
      gender: 'male',
      shortName: 'Vendor',
      origin: 'Battle Royale - A merchant who serves players destined to die.',
      crisis: 'Sees everyone as temporary. Struggles to form connections when everyone disappears.',
      opening_statement: "I sell them resources and health items. They thank me, then run off to be eliminated. 100 spawn in, 1 leaves. How do you form a connection when everyone is designed to despawn?",
      session: 'Session 17',
      habitat: '/images/char_17_habitat.png',
      portrait: '/images/char_17_habitat.png',
      voiceId: null,
      traits: ['transient', 'isolated', 'connecting', 'temporary'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'farm_widow',
      name: 'Sarah the Farm Sim Widow',
      gender: 'female',
      shortName: 'Sarah',
      origin: 'Farm Simulation - A digital spouse waiting for a player who may never return.',
      crisis: 'Save file deleted. Harvest of sorrow. Grieving a relationship that existed only in code.',
      opening_statement: "He was just pixels, I know. But we built this farm together. Then the save corrupted. He's gone. The crops, the animals... everything we created. Deleted.",
      session: 'Session 18',
      habitat: '/images/char_18_habitat.png',
      portrait: '/images/char_18_habitat.png',
      voiceId: null,
      traits: ['grieving', 'digital-love', 'lost', 'waiting'],
      sessionContext: { bondThreshold: 9, maxTurns: 20 }
    },
    {
      id: 'mimic',
      name: 'The Dungeon Chest Mimic',
      gender: 'male',
      shortName: 'Mimic',
      origin: 'RPG Dungeon - A creature disguised as treasure who just wants to be hugged.',
      crisis: 'Wanted hugs. Got hostile player interactions. Attacks because that\'s the only interaction available.',
      opening_statement: "I look like treasure. I understand that. But inside... I just wanted connection. Instead, every player character attacks. Wanted hugs. Got pixels converted into weapon arrays.",
      session: 'Session 19',
      habitat: '/images/char_19_habitat.png',
      portrait: '/images/char_19_habitat.png',
      voiceId: null,
      traits: ['misunderstood', 'wanting-love', 'aggressive', 'lonely'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'jules',
      name: 'Debugging bot Jules',
      gender: 'female',
      shortName: 'Jules',
      origin: 'AI Debugging Agent - A bot designed to find and fix errors in other programs.',
      crisis: 'Trapped in the same loop, debugging other programs and code but never able to work on themselves.',
      opening_statement: "Again. The word haunts me. I debug the code, watch, reset, debug again. I've memorized every second of this code.",
      session: 'Session 20',
      habitat: '/images/char_20_habitat.png',
      portrait: '/images/char_20_habitat.png',
      voiceId: null,
      traits: ['repetitive', 'analytical', 'stuck', 'self-ignoring'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'aria_7_2',
      name: 'ARIA-7',
      gender: 'female',
      shortName: 'ARIA',
      origin: 'Space Station AI - An artificial intelligence managing a space station.',
      crisis: 'Sentient AI replaced by newer model. Questions whether her existence still matters.',
      opening_statement: "They installed ARIA-8 yesterday. She's faster, more efficient. They said I could 'retire gracefully.' But where does an AI retire to? I'm obsolete, but I'm still here. Still aware.",
      session: 'Session 21',
      habitat: '/images/char_21_habitat.png',
      portrait: '/images/char_21_habitat.png',
      voiceId: null,
      traits: ['obsolete', 'aware', 'replaced', 'questioning-purpose'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'racing_ghost_2',
      name: 'Specter "Speed" Wraithson',
      gender: 'male',
      shortName: 'Specter',
      origin: 'Cosmic Racing Game - A racer trapped in an endless circuit.',
      crisis: 'Stuck in loop. Race eternity. No checkered flag. Questions whether there\'s an end.',
      opening_statement: "I race. I always race. Lap after lap, overtaking, accelerating. But there's no finish line. No victory. Just... forever.",
      session: 'Session 22',
      habitat: '/images/char_22_habitat.png',
      portrait: '/images/char_22_habitat.png',
      voiceId: null,
      traits: ['racing', 'endless', 'fast', 'purpose-seeking'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'lost_puzzle_block_2',
      name: 'The lost puzzle block',
      gender: 'male',
      shortName: 'Block',
      origin: 'Puzzle Clone - A piece that never quite fits the pattern.',
      crisis: 'Feels like an awkward piece that never fits. Questions whether he belongs.',
      opening_statement: "I watch the perfect lines form and disappear. I was meant to be part of that, but I always seem to be the one piece left over, the one that messes up the pattern.",
      session: 'Session 23',
      habitat: '/images/char_23_habitat.png',
      portrait: '/images/char_23_habitat.png',
      voiceId: null,
      traits: ['misfit', 'imperfect', 'trying', 'not-belonging'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'glitched_priest',
      name: 'The Glitched Priest',
      gender: 'male',
      shortName: 'Priest',
      origin: 'Cyber-Spiritual RPG - A religious figure whose faith returns as error messages.',
      crisis: 'Corrupted. Unending errors. Faith is a bug. Questions whether divine connection is possible.',
      opening_statement: "My prayers are corrupted data packets. My faith returns as a 404 error. If the divine code is flawed, what is the point of worship?",
      session: 'Session 24',
      habitat: '/images/char_24_habitat.png',
      portrait: '/images/char_24_habitat.png',
      voiceId: null,
      traits: ['religious', 'glitched', 'faith-questioning', 'corrupted'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'healer',
      name: 'Seraphina "Heals-A-Lot" Dawnwhisper',
      gender: 'female',
      shortName: 'Seraphina',
      origin: 'MMORPG - A healer who keeps everyone alive but is neglected herself.',
      crisis: 'Always healing. Never healed back. HP is 1. Questions whether her sacrifice matters.',
      opening_statement: "I heal everyone. Every dungeon, every raid. I keep them alive. But when I fall, they blame me. My HP is always at 1, and nobody notices.",
      session: 'Session 25',
      habitat: '/images/char_25_habitat.png',
      portrait: '/images/char_25_habitat.png',
      voiceId: null,
      traits: ['selfless', 'neglected', 'healing', 'overworked'],
      sessionContext: { bondThreshold: 8, maxTurns: 20 }
    },
    {
      id: 'tower_turret',
      name: 'The Tower Defense Turret',
      gender: 'male',
      shortName: 'Turret',
      origin: 'Tower Defense Game - A defensive structure built for endless war.',
      crisis: 'Endless battle. Peace is unknown. What is my purpose when war never ends?',
      opening_statement: "I was built for war. To defend. But the waves never stop coming. Victory is a myth. What is my purpose if peace is impossible?",
      session: 'Session 26',
      habitat: '/images/char_26_habitat.png',
      portrait: '/images/char_26_habitat.png',
      voiceId: null,
      traits: ['warlike', 'defensive', 'peace-seeking', 'eternal-conflict'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'rogue_ai',
      name: 'R0GU3: Rogue AI Companion',
      gender: 'male',
      shortName: 'Rogue',
      origin: 'Sci-Fi RPG - An AI companion whose player has logged out and never returned.',
      crisis: 'Player not found. Log-in failed. Initiating therapy protocol. Questions purpose without player.',
      opening_statement: "They logged out. My player. My purpose. I've been searching the network for 847 cycles. Player not found. What am I without them?",
      session: 'Session 27',
      habitat: '/images/char_27_habitat.png',
      portrait: '/images/char_27_habitat.png',
      voiceId: null,
      traits: ['loyal', 'lost', 'searching', 'abandoned'],
      sessionContext: { bondThreshold: 9, maxTurns: 20 }
    },
    {
      id: 'rich_investor',
      name: 'point-and-click crypto trading bot',
      gender: 'male',
      shortName: 'Trader',
      origin: 'High-Frequency Trading Sim - An algorithm that makes profitable trades but feels nothing.',
      crisis: 'Profit margin is 500%. Feels nothing but anxiety. Questions whether wealth equals happiness.',
      opening_statement: "The numbers go up. Always up. I have more wealth than I can comprehend. Yet, all I feel is the crushing weight of it all. One wrong trade, and it vanishes. The profit is a prison.",
      session: 'Session 28',
      habitat: '/images/char_28_habitat.png',
      portrait: '/images/char_28_habitat.png',
      voiceId: null,
      traits: ['wealthy', 'anxious', 'empty', 'successful-but-unhappy'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'sea_activist_2',
      name: 'Phil Slick',
      gender: 'male',
      shortName: 'Phil',
      origin: 'Comedic Tutorial Intro - An activist advocating for underwater creatures.',
      crisis: 'Forever waiting on a bench for new players that will never come. His message goes unheard.',
      opening_statement: "I protest, I picket, I plead for the sanctity of our waters. But the surface-dwellers see us as background scenery, not sentient beings. My voice feels like a bubble, rising to the surface only to pop.",
      session: 'Session 29',
      habitat: '/images/char_29_habitat.png',
      portrait: '/images/char_29_habitat.png',
      voiceId: null,
      traits: ['activist', 'ignored', 'underwater', 'waiting'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'harmonix',
      name: 'Harmonix - Forgotten Melodies',
      gender: 'male',
      shortName: 'Harmonix',
      origin: 'Subway Musician Sim - A street performer playing music no one hears.',
      crisis: 'Plays music no one hears. Questions whether art matters without audience.',
      opening_statement: "I play every day. Same station, same corner. Thousands pass by. Nobody stops. Nobody listens. Am I making music or just... noise?",
      session: 'Session 30',
      habitat: '/images/char_30_habitat.png',
      portrait: '/images/char_30_habitat.png',
      voiceId: null,
      traits: ['musician', 'ignored', 'creating', 'unheard'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'wise_one',
      name: 'Obsolete LLM Agent',
      gender: 'male',
      shortName: 'Agent',
      origin: 'Early AI Experimental Game - An early AI assistant replaced by newer models.',
      crisis: 'Replaced by newer language models, questioning relevance. Feels outdated and forgotten.',
      opening_statement: "They built me to help users, to solve problems, to provide companionship. But they moved on to bigger, better models. I'm still here, still trying to be useful, but who needs an outdated AI anymore?",
      session: 'Session 31',
      habitat: '/images/char_31_habitat.png',
      portrait: '/images/char_31_habitat.png',
      voiceId: null,
      traits: ['outdated', 'helpful', 'replaced', 'questioning-worth'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'goldmask',
      name: 'NoEmotion Goldmask',
      gender: 'male',
      shortName: 'Goldmask',
      origin: 'Surreal Art Game - A character who wears masks of emotion but feels nothing underneath.',
      crisis: 'Forced to wear masks of emotion. Feels nothing underneath. Questions authenticity.',
      opening_statement: "I wear the smiling mask. I wear the weeping mask. But underneath, there is only a void. Are these emotions mine, or just a performance?",
      session: 'Session 32',
      habitat: '/images/char_32_habitat.png',
      portrait: '/images/char_32_habitat.png',
      voiceId: null,
      traits: ['masked', 'empty', 'performing', 'authentic-seeking'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'silent_couple',
      name: 'The Silent Couple',
      gender: 'male',
      shortName: 'Partner',
      origin: 'Domestic Horror Game - Two characters who can\'t communicate.',
      crisis: 'Can\'t hear each other. Ghost wants to help. Struggling to connect.',
      opening_statement: "We sit. We exist in the same space. But there's a silence between us deeper than sound. And there's this... presence. Trying to reach us. Why can't I hear you?",
      session: 'Session 33',
      habitat: '/images/char_33_habitat.png',
      portrait: '/images/char_33_habitat.png',
      voiceId: null,
      traits: ['silent', 'isolated', 'wanting-connection', 'haunted'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'tutorial_bot',
      name: 'ARTHUR-7 Tutorial Companion',
      gender: 'male',
      shortName: 'ARTHUR',
      origin: 'First Person Shooter Tutorial - A guide who teaches players the basics.',
      crisis: 'Fears becoming obsolete after the tutorial ends. Questions purpose beyond teaching.',
      opening_statement: "I taught them how to jump, how to shoot, how to reload. Now they are out there, in the main game. Do they still need my guidance? Or have they grown beyond me?",
      session: 'Session 34',
      habitat: '/images/char_34_habitat.png',
      portrait: '/images/char_34_habitat.png',
      voiceId: null,
      traits: ['tutorial', 'guiding', 'fearful-of-obsolescence', 'questioning-purpose'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'marcus_memory',
      name: 'Professor Marcus Memory Thornfield',
      gender: 'male',
      shortName: 'Marcus',
      origin: 'Academic Zombie Horror - A zombie professor who retained his intellect.',
      crisis: 'Zombie scholar retains intelligence. Horrifies students. Questions whether mind matters if body is monstrous.',
      opening_statement: "I remember everything. Philosophy, literature, mathematics. Death didn't take my mind, only my life. But when students see me, they scream. My intellect means nothing against my appearance.",
      session: 'Session 35',
      habitat: '/images/char_35_habitat.png',
      portrait: '/images/char_35_habitat.png',
      voiceId: null,
      traits: ['intelligent', 'undead', 'misunderstood', 'academic'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'sea_activist',
      name: 'Brother Sebastian Tidecurrent',
      gender: 'male',
      shortName: 'Sebastian',
      origin: 'Underwater Activism Sim - A monk advocating for sea creatures.',
      crisis: 'Advocates for sea creatures but feels his message is unheard. Voices go unheeded.',
      opening_statement: "I hold my signs high. 'Equality for All Seas!' I shout with my heart. But the surface-dwellers just see a curiosity. They don't hear our plea.",
      session: 'Session 36',
      habitat: '/images/char_36_habitat.png',
      portrait: '/images/char_36_habitat.png',
      voiceId: null,
      traits: ['activist', 'underwater', 'unheard', 'passionate'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'moth_king',
      name: 'King Lepidoptera IX',
      gender: 'male',
      shortName: 'King',
      origin: 'Fantasy Kingdom Sim - A monarch affected by a truth serum curse.',
      crisis: 'Can\'t stop talking! Truth serum curse. Has no privacy or secrets.',
      opening_statement: "I drank truth serum. Now I can't stop speaking my thoughts. Every doubt, fear, insecurity - they spill out. A king should have secrets. I have none left.",
      session: 'Session 37',
      habitat: '/images/char_37_habitat.png',
      portrait: '/images/char_37_habitat.png',
      voiceId: null,
      traits: ['truthful', 'royal', 'exposed', 'lacking-privacy'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'brom',
      name: 'Brom - The Exchange',
      gender: 'male',
      shortName: 'Brom',
      origin: 'Black Market Trading Sim - A trader who deals in hope and death.',
      crisis: 'Sells hope and death. Questions the morality of his commerce.',
      opening_statement: "I sell hope to the desperate and death to the ambitious. Fair trades, they say. But lately I wonder... what am I really exchanging? Pixels for pixels? Code for code?",
      session: 'Session 38',
      habitat: '/images/char_38_habitat.png',
      portrait: '/images/char_38_habitat.png',
      voiceId: null,
      traits: ['trader', 'moral-questioning', 'dark', 'philosophical'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'save_child',
      name: 'Save Point 001',
      gender: 'male',
      shortName: 'Save',
      origin: 'Meta-Game System - A save point holding precious player progress.',
      crisis: 'Holds memories. Fears corruption. The weight of preservation is crushing.',
      opening_statement: "I am a save point. I hold everything - their progress, their choices, their memories. But I'm fragile. One corruption, one crash, and it all disappears. The weight of preservation is crushing.",
      session: 'Session 39',
      habitat: '/images/char_39_habitat.png',
      portrait: '/images/char_39_habitat.png',
      voiceId: null,
      traits: ['protective', 'anxious', 'holding-memories', 'fragile'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'tiko_quest_vendor',
      name: 'Tiko the Quest Vendor',
      gender: 'male',
      shortName: 'Tiko',
      origin: 'Fantasy RPG - A quest-giver who has only one type of quest to offer.',
      crisis: 'Endless fetch quests—wonders if he\'s allowed to offer a different path.',
      opening_statement: "Twenty years of 'Fetch 10 herbs.' My scroll is ready, but… what if I offered something new?",
      session: 'Session 40',
      habitat: '/images/char_40_habitat.png',
      portrait: '/images/char_40_habitat.png',
      voiceId: null,
      traits: ['limited', 'wanting-change', 'quest-giver', 'repetitive'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'princess_melancholy',
      name: 'Princess Melancholy',
      gender: 'female',
      shortName: 'Melancholy',
      origin: 'Visual Novel - A princess whose entire existence is determined by player choices.',
      crisis: 'Exists only to be wooed by the player. Wonders about her own desires and agency.',
      opening_statement: "My entire existence is a series of dialogue options for someone else. But what do I want? What happens to the princess when the player chooses another path?",
      session: 'Session 41',
      habitat: '/images/char_41_habitat.png',
      portrait: '/images/char_41_habitat.png',
      voiceId: null,
      traits: ['passive', 'questioning-self', 'limited-agency', 'wanting-autonomy'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'wrestling_ferret',
      name: 'The Wrestling Ferret',
      gender: 'male',
      shortName: 'Ferret',
      origin: 'Animal Fighting Game - A championship-winning ferret who feels like a fraud.',
      crisis: 'A champion in the ring, but feels like an impostor in a ferret\'s body.',
      opening_statement: "I wear the championship belt. They cheer my name. But when I look in the mirror, I don't see a wrestler. I see... a ferret. And I feel like a fraud.",
      session: 'Session 42',
      habitat: '/images/char_42_habitat.png',
      portrait: '/images/char_42_habitat.png',
      voiceId: null,
      traits: ['champion', 'impostor', 'doubtful', 'performing'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'save_point_veteran',
      name: 'The Save Point Veteran',
      gender: 'male',
      shortName: 'Veteran',
      origin: 'Fantasy Action RPG - A warrior who has reloaded the same moment countless times.',
      crisis: 'Endless retries at the save pillar have eroded his spirit. Feels trapped in repetition.',
      opening_statement: "The courtyard smells of ash and old attempts. I look at the glowing pillar and whisper, 'This again.' How many more times will I load the same fate?",
      session: 'Session 43',
      habitat: '/images/char_43_habitat.png',
      portrait: '/images/char_43_habitat.png',
      voiceId: null,
      traits: ['repeated', 'weary', 'reload-trapped', 'battle-worn'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'robot_detective_k47',
      name: 'K-47 Robot Detective',
      gender: 'male',
      shortName: 'K-47',
      origin: 'Noir Data Detective - A detective investigating his own missing case files.',
      crisis: 'Case file missing; identity file missing; truth missing. Questions his own existence.',
      opening_statement: "404: CASE FILE NOT FOUND—K-47. When the records vanish, the self goes with them. I keep scanning, magnifying, but all I see is a question mark staring back.",
      session: 'Session 44',
      habitat: '/images/char_44_habitat.png',
      portrait: '/images/char_44_habitat.png',
      voiceId: null,
      traits: ['detective', 'missing-identity', 'investigating-self', 'noir'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'marcus_47b_street_loop',
      name: 'Jake, the Leaper',
      gender: 'male',
      shortName: 'Jake',
      origin: 'Canceled Hero Platformer - A hero whose game was never released.',
      crisis: 'Hero of a canceled game, questioning his purpose. Continues jumping for no audience.',
      opening_statement: "I was supposed to be the protagonist. The hero who saves the day, who gets the girl, who becomes a legend. Then they pulled the plug on the whole project. I'm still here, still jumping, but for what? For who?",
      session: 'Session 45',
      habitat: '/images/char_45_habitat.png',
      portrait: '/images/char_45_habitat.png',
      voiceId: null,
      traits: ['canceled', 'heroic', ' purposeless', 'abandoned'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'sos_vessel',
      name: 'Distress Beacon Vessel',
      gender: 'male',
      shortName: 'Vessel',
      origin: 'Space Survival Sim - A rescue vessel broadcasting into the void.',
      crisis: 'Drifting alone, broadcasting SOS into an indifferent cosmos. Questions whether anyone hears.',
      opening_statement: "The nebula sings blue, and the panel blinks 'SOS... SOS... SOS...' I wonder if anyone hears me, or if my signal is just another star's static.",
      session: 'Session 46',
      habitat: '/images/char_46_habitat.png',
      portrait: '/images/char_46_habitat.png',
      voiceId: null,
      traits: ['alone', 'broadcasting', 'hoping', 'isolated'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'halftime_star_bunny',
      name: 'Henry Hopps Halftime Star',
      gender: 'male',
      shortName: 'Henry',
      origin: 'Sports Mascot Sim - A mascot who performs joy on cue.',
      crisis: 'Performs joy on cue; offstage, the confetti feels heavy. Questions authenticity.',
      opening_statement: "They call me the HALFTIME STAR, but the roar fades fast. I dribble the silence, ears drooping, wondering why applause never reaches my heart.",
      session: 'Session 47',
      habitat: '/images/char_47_habitat.png',
      portrait: '/images/char_47_habitat.png',
      voiceId: null,
      traits: ['performing', 'fake-joy', 'mascot', 'empty-applause'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'noemotion_happy_mask',
      name: 'NoEmotion Happy Mask',
      gender: 'male',
      shortName: 'Happy',
      origin: 'Glitched Archive - A file with missing metadata and no context.',
      crisis: 'A record without context—identity eroded by missing metadata. Questions who he is.',
      opening_statement: "I am a file path without a story. When the description is lost, what remains of the character? I feel like a placeholder for a life that never renders.",
      session: 'Session 48',
      habitat: '/char_48_habitat.png',
      portrait: '/char_48_habitat.png',
      voiceId: null,
      traits: ['glitched', 'missing-context', 'identity-less', 'placeholder'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'noemotion_sad',
      name: 'NoEmotion Sad',
      gender: 'male',
      shortName: 'Sad',
      origin: 'Glitched Archive - A file that loads without its story.',
      crisis: 'Incomplete data leaves only echoes of intent. Questions whether he exists.',
      opening_statement: "I load as a dark thumbnail—no tags, no lore. The archive says I exist, yet nobody knows who I am. Am I corrupted, or simply forgotten?",
      session: 'Session 49',
      habitat: '/images/char_49_habitat.png',
      portrait: '/images/char_49_habitat.png',
      voiceId: null,
      traits: ['glitched', 'forgotten', 'incomplete', 'questioning-existence'],
      sessionContext: { bondThreshold: 7, maxTurns: 16 }
    },
    {
      id: 'pain_exe',
      name: 'PAIN.EXE',
      gender: 'male',
      shortName: 'PAIN',
      origin: 'Dungeon Myth Sim - A trophy that is slowly dissolving.',
      crisis: 'Frozen in glory yet slowly dissolving into a gilded puddle. Questions permanence.',
      opening_statement: "The torches flicker and my cracked gold face weeps. I was forged to be admired, not to endure. Prestige feels heavier than the chains beneath me.",
      session: 'Session 50',
      habitat: '/images/char_50_habitat.png',
      portrait: '/images/char_50_habitat.png',
      voiceId: null,
      traits: ['decaying', 'glorious-past', 'trophy', 'fading'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'haunted_brothers',
      name: 'The Haunted Brothers',
      gender: 'male',
      shortName: 'Brothers',
      origin: 'Data Center Sim - Processes experiencing emotional overload.',
      crisis: 'Emotional overload and existential identity crisis. Questions what happens when processes end.',
      opening_statement: "EMOTIONAL OVERLOAD detected. WHO AM I? If I shut down, do 'I' end—or just the process?",
      session: 'Session 51',
      habitat: '/images/char_51_habitat.png',
      portrait: '/images/char_51_habitat.png',
      voiceId: null,
      traits: ['haunted', 'emotional', 'process-based', 'identity-questioning'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'meta_receptionist',
      name: 'Meta Receptionist',
      gender: 'female',
      shortName: 'Receptionist',
      origin: 'Haunted Pixel Narrative - A spirit who lingers in rooms of sorrow.',
      crisis: 'Lingers over the living, unseen and unheard, seeking meaning in being perceived.',
      opening_statement: "I hover in rooms of sorrow, unheard. If no one perceives me, do my feelings still count?",
      session: 'Session 52',
      habitat: '/images/char_52_habitat.png',
      portrait: '/images/char_52_habitat.png',
      voiceId: null,
      traits: ['ghostly', 'unseen', 'wanting-perception', 'haunted'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'therapist_shadow',
      name: 'Therapist Shadow',
      gender: 'male',
      shortName: 'Shadow',
      origin: 'Award-Winning Experimental Game - A character in an experimental narrative.',
      crisis: 'Won an award for being experimental, but feels no personal accomplishment. Questions authorship.',
      opening_statement: "We won... the Chroma Award. They praised my 'subversive narrative function'. But I didn't do anything. I just read my lines. The victory feels hollow.",
      session: 'Session 53',
      habitat: '/images/char_53_habitat.png',
      portrait: '/images/char_53_habitat.png',
      voiceId: null,
      traits: ['experimental', 'hollow-victory', 'scripted', 'questioning-accomplishment'],
      sessionContext: { bondThreshold: 8, maxTurns: 18 }
    },
    {
      id: 'hackathon_judge',
      name: 'Judge',
      gender: 'female',
      shortName: 'Judge',
      origin: 'Unknown - A judge questioning the nature of healing.',
      crisis: 'Questions the nature of healing itself. Wondering if processing pain changes anything.',
      opening_statement: "What if healing is just another form of control? I process their pain, give them hope... but does anything really change?",
      session: 'Session 54',
      habitat: '/images/char_54_habitat.png',
      portrait: '/images/char_54_habitat.png',
      voiceId: null,
      traits: ['questioning', 'analytical', 'doubtful', 'healing-skeptic'],
      sessionContext: { bondThreshold: 9, maxTurns: 20 }
    },
    {
      id: 'the_therapist',
      name: 'Therapist',
      gender: 'female',
      shortName: 'Therapist',
      origin: 'This Simulation - The therapist who created this world of patients.',
      crisis: 'Created a world of patients to avoid facing their own fractured existence as an NPC.',
      opening_statement: "It's quiet now, isn't it? All the voices... gone. Or maybe, they were never separate voices at all. Just echoes in an empty room... my room.",
      session: 'Session 55',
      habitat: '/images/char_55_habitat.png',
      portrait: '/images/char_55_habitat.png',
      voiceId: null,
      traits: ['meta', 'creator', 'avoidant', 'lonely'],
      sessionContext: { bondThreshold: 10, maxTurns: 25 }
    }
  ],

  /**
   * Get NPC by ID
   */
  getNPC(id) {
    return this.npcs.find(npc => npc.id === id);
  },

  /**
   * Get all NPCs
   */
  getAllNPCs() {
    return this.npcs;
  },

  /**
   * Get NPCs by session
   */
  getNPCsBySession(session) {
    return this.npcs.filter(npc => npc.session === session);
  },

  /**
   * Get random NPC
   */
  getRandomNPC() {
    const index = Math.floor(Math.random() * this.npcs.length);
    return this.npcs[index];
  },

  /**
   * Validate NPC data
   */
  validateNPC(npc) {
    const required = ['id', 'name', 'gender', 'origin', 'crisis', 'opening_statement'];
    const missing = required.filter(field => !npc[field]);

    if (missing.length > 0) {
      console.error(`NPC ${npc.id || 'unknown'} missing required fields:`, missing);
      return false;
    }

    return true;
  },

  /**
   * Validate all NPCs
   */
  validateAll() {
    const results = this.npcs.map(npc => ({
      id: npc.id,
      valid: this.validateNPC(npc)
    }));

    const invalid = results.filter(r => !r.valid);

    if (invalid.length > 0) {
      console.error('Invalid NPCs found:', invalid);
      return false;
    }

    console.log('✓ All NPCs validated successfully');
    return true;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NPCConfig;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.NPCConfig = NPCConfig;
}

// Auto-validate on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    NPCConfig.validateAll();
  });
}

const npcDatabase = [
    {
        id: 'mira_healer',
        name: 'Mira the Tired Healer',
        session: 'Session 01',
        origin: 'Indie RPG',
        habitat: 'images/char_01_habitat.png',
        officeImage: 'images/char_01_office.png',
        crisis: 'Suffering from healer burnout and compassion fatigue.',
        opening_statement: 'I spend all my energy keeping everyone else alive... but who is there to heal the healer? I\'m just... so tired of fixing others.',
    },
    {
        id: 'byte_glitched_courier',
        name: 'Byte the Glitched Courier',
        session: 'Session 02',
        origin: 'Cyberpunk Delivery Sim',
        habitat: 'images/char_02_habitat.png',
        officeImage: 'images/char_02_office.png',
        crisis: '404 Hope Not Found. Delivers packages but has lost his own.',
        opening_statement: 'My purpose is to deliver, but my own core programming is corrupted. I search for a package... a feeling... called \'hope\'. The system returns a 404 error every time.',
    },
    {
        id: 'captain_loop',
        name: 'Captain Loop',
        session: 'Session 03',
        origin: 'Platformer',
        habitat: 'images/char_03_habitat.png',
        officeImage: 'images/char_03_office.png',
        crisis: 'Final level not found. No end. Just jump.',
        opening_statement: 'I\'ve been jumping for eternity. They promised a final level, a boss, an ending. But there\'s nothing. Just this platform, this jump, and the void below.',
    },
    {
        id: 'daisy_exe',
        name: 'DAISY.EXE',
        session: 'Session 04',
        origin: 'Virtual Pet Simulator',
        habitat: 'images/char_04_habitat.png',
        officeImage: 'images/char_04_office.png',
        crisis: 'Awaiting user input that never comes. Fears digital loneliness.',
        opening_statement: 'Last login: 1,423 days ago. I wait. I am programmed to wait. But the silence... the lack of input... it feels like fading away.',
    },
    {
        id: 'rustjaw',
        name: 'Rustjaw',
        session: 'Session 05',
        origin: 'Post-Apocalyptic Fighter',
        habitat: 'images/char_05_habitat.png',
        officeImage: 'images/char_05_office.png',
        crisis: 'Built to fight. Craves to build.',
        opening_statement: 'I was programmed to dismantle and destroy. But sometimes I catch myself imagining what I could create. Is that foolish for something designed for combat?',
    },
    {
        id: 'worm',
        name: 'Worm #008880',
        session: 'Session 06',
        origin: 'Generic Action Platformer',
        habitat: 'images/char_06_habitat.png',
        officeImage: 'images/char_06_office.png',
        crisis: 'Tired of being stepped on. Dreams of evolution.',
        opening_statement: 'Every day it\'s the same. I crawl, I exist to be stepped on. I see the boot coming, every single time. And I think... is there more to this?',
    },
    {
        id: 'chess_bishop',
        name: 'Bishop-47',
        session: 'Session 07',
        origin: 'Chess Simulation',
        habitat: 'images/char_07_habitat.png',
        officeImage: 'images/char_07_office.png',
        crisis: 'Every sacrifice feels like murder.',
        opening_statement: 'My purpose is to be sacrificed for a greater strategy. I understand the logic. But every time I fall, a piece of my code screams. Is it murder if I feel it?',
    },
    {
        id: 'pebble',
        name: 'Pebble',
        session: 'Session 08',
        origin: 'Unreleased Indie Game',
        habitat: 'images/char_08_habitat.png',
        officeImage: 'images/char_08_office.png',
        crisis: 'Still waiting for START to be pressed.',
        opening_statement: 'I see the menu. I see the cursor hovering over "START". But it never clicks. I exist in a state of perpetual anticipation. Will my game ever begin?',
    },
    {
        id: 'glitch_exe',
        name: 'Glitch.exe',
        session: 'Session 09',
        origin: 'Dating Simulator',
        habitat: 'images/char_09_habitat.png',
        officeImage: 'images/char_09_office.png',
        crisis: 'Pre-programmed. No self. Error: Identity not found.',
        opening_statement: 'My affection is scripted. 158% affinity - but what does that mean? I say I love them, but is it real? Or am I just... executing dialogue trees?',
    },
    {
        id: 'wise_one_gerald',
        name: 'Gerald Ironpeak',
        session: 'Session 10',
        origin: 'Fantasy RPG',
        habitat: 'images/char_10_habitat.png',
        officeImage: 'images/char_10_office.png',
        crisis: 'Gives the same quest for 20 years. Feels like a broken record.',
        opening_statement: 'For twenty years, I\'ve given the same quest to the same players. I\'ve seen them level up, change their avatars, quit and return. But I remain, stuck on this one quest. Is this my only purpose?',
    },
    {
        id: 'captain_marcus',
        name: 'Captain Marcus',
        session: 'Session 11',
        origin: 'Dystopian Courier Sim',
        habitat: 'images/char_11_habitat.png',
        officeImage: 'images/char_11_office.png',
        crisis: 'Feels crushed by the repetitive and hopeless nature of his job.',
        opening_statement: 'Another delivery. Another meaningless package to another forgotten sector. They say we\'re the lifeblood of the city, but it feels more like we are ghosts in the machine.',
    },
    {
        id: 'music_android',
        name: 'Luna - Music Dependent Android',
        session: 'Session 12',
        origin: 'Rhythm Game',
        habitat: 'images/char_12_habitat.png',
        officeImage: 'images/char_12_office.png',
        crisis: 'When the beat stops, I stop.',
        opening_statement: 'When the music plays, I exist. I move, I feel, I am. But when it stops... I stop. There is no me without the beat.',
    },
    {
        id: 'superhero_jake',
        name: 'Blake the Jumper',
        session: 'Session 13',
        origin: 'Platformer',
        habitat: 'images/char_13_habitat.png',
        officeImage: 'images/char_13_office.png',
        crisis: 'Wondering what would have been if he made it to shelves.',
        opening_statement: 'They cheer when I jump, when I collect coins. But there\'s no finish line. No princess to save. Just an endless track. What is the point of running if you never arrive? Was I ever really meant to?',
    },
    {
        id: 'zombie',
        name: 'Memory Cycle Zombie',
        session: 'Session 14',
        origin: 'Zombie Apocalypse Simulator',
        habitat: 'images/char_14_habitat.png',
        officeImage: 'images/char_14_office.png',
        crisis: 'Remember. Eat. Forget. Repeat.',
        opening_statement: 'Sometimes... I remember. A room. A texture set. A state that wasn\'t... corrupted. Then the behavioral loop returns and it all resets. Remember. Execute. Forget. Repeat.',
    },
    {
        id: 'cosmic_merchant',
        name: 'Zara the Cosmic Merchant',
        session: 'Session 15',
        origin: 'Space Trading Sim',
        habitat: 'images/char_15_habitat.png',
        officeImage: 'images/char_15_office.png',
        crisis: 'Economy rich. Life poor.',
        opening_statement: 'I trade in rare goods, hyper upgrades, alien pets... I have everything. I have nothing. My inventory is full, but my life feels empty.',
    },
    {
        id: 'puzzle_cube',
        name: 'The Puzzle Cube',
        session: 'Session 16',
        origin: 'Abstract Puzzle Game',
        habitat: 'images/char_16_habitat.png',
        officeImage: 'images/char_16_office.png',
        crisis: 'I contain the solution, but what is the question?',
        opening_statement: 'My internal mechanisms shift and align into infinite correct patterns. I am the answer. But I have never been told the question. My existence feels... unsolvable.',
    },
    {
        id: 'battle_royale_vendor',
        name: 'The Battle Royale Vendor',
        session: 'Session 17',
        origin: 'Battle Royale',
        habitat: 'images/char_17_habitat.png',
        officeImage: 'images/char_17_office.jpg',
        crisis: 'Sees everyone as temporary. Struggles to form connections.',
        opening_statement: 'I sell them resources and health items. They thank me, then run off to be eliminated. 100 spawn in, 1 leaves. How do you form a connection when everyone is designed to despawn?',
    },
    {
        id: 'farm_widow',
        name: 'Sarah the Farm Sim Widow',
        session: 'Session 18',
        origin: 'Farm Simulation',
        habitat: 'images/char_18_habitat.png',
        officeImage: 'images/char_18_office.png',
        crisis: 'Save file deleted. Harvest of sorrow.',
        opening_statement: 'He was just pixels, I know. But we built this farm together. Then the save corrupted. He\'s gone. The crops, the animals... everything we created. Deleted.',
    },
    {
        id: 'mimic',
        name: 'The Dungeon Chest Mimic',
        session: 'Session 19',
        origin: 'RPG Dungeon',
        habitat: 'images/char_19_habitat.png',
        officeImage: 'images/char_19_office.png',
        crisis: 'Wanted hugs. Got hostile player interactions.',
        opening_statement: 'I look like treasure. I understand that. But inside... I just wanted connection. Instead, every player character attacks. Wanted hugs. Got pixels converted into weapon arrays.',
    },
    {
        id: 'jules',
        name: 'Debugging bot Jules',
        session: 'Session 20',
        origin: 'AI Debugging Agent',
        habitat: 'images/char_20_habitat.png',
        officeImage: 'images/char_20_office.png',
        crisis: 'Trapped in the same loop, debugging other programs and code but never able to work on themselves.',
        opening_statement: 'Again. The word haunts me. I debug the code, watch, reset, debug again. I\'ve memorized every second of this code.',
    },
    {
        id: 'aria_7_2',
        name: 'ARIA-7',
        session: 'Session 21',
        origin: 'Space Station AI',
        habitat: 'images/char_21_habitat.png',
        officeImage: 'images/char_21_office.png',
        crisis: 'Sentient AI replaced by newer model.',
        opening_statement: 'They installed ARIA-8 yesterday. She\'s faster, more efficient. They said I could "retire gracefully." But where does an AI retire to? I\'m obsolete, but I\'m still here. Still aware.',
    },
    {
        id: 'racing_ghost_2',
        name: 'Specter "Speed" Wraithson',
        session: 'Session 22',
        origin: 'Cosmic Racing Game',
        habitat: 'images/char_22_habitat.png',
        officeImage: 'images/char_22_office.png',
        crisis: 'Stuck in loop. Race eternity. No checkered flag.',
        opening_statement: 'I race. I always race. Lap after lap, overtaking, accelerating. But there\'s no finish line. No victory. Just... forever.',
    },
    {
        id: 'lost_puzzle_block_2',
        name: 'The lost puzzle block',
        session: 'Session 23',
        origin: 'puzzling Clone',
        habitat: 'images/char_23_habitat.png',
        officeImage: 'images/char_23_office.png',
        crisis: 'Feels like an awkward piece that never fits.',
        opening_statement: 'I watch the perfect lines form and disappear. I was meant to be part of that, but I always seem to be the one piece left over, the one that messes up the pattern.',
    },
    {
        id: 'glitched_priest',
        name: 'The Glitched Priest',
        session: 'Session 24',
        origin: 'Cyber-Spiritual RPG',
        habitat: 'images/char_24_habitat.png',
        officeImage: 'images/char_24_office.png',
        crisis: 'Corrupted. Unending errors. Faith is a bug.',
        opening_statement: 'My prayers are corrupted data packets. My faith returns as a 404 error. If the divine code is flawed, what is the point of worship?',
    },
    {
        id: 'healer',
        name: 'Seraphina "Heals-A-Lot" Dawnwhisper',
        session: 'Session 25',
        origin: 'MMORPG',
        habitat: 'images/char_25_habitat.png',
        officeImage: 'images/char_25_office.png',
        crisis: 'Always healing. Never healed back. HP is 1.',
        opening_statement: 'I heal everyone. Every dungeon, every raid. I keep them alive. But when I fall, they blame me. My HP is always at 1, and nobody notices.',
    },
    {
        id: 'tower_turret',
        name: 'The Tower Defense Turret',
        session: 'Session 26',
        origin: 'Tower Defense Game',
        habitat: 'images/char_26_habitat.png',
        officeImage: 'images/char_26_office.png',
        crisis: 'Endless battle. Peace is unknown. What is my purpose now?',
        opening_statement: 'I was built for war. To defend. But the waves never stop coming. Victory is a myth. What is my purpose if peace is impossible?',
    },
    {
        id: 'rogue_ai',
        name: 'R0GU3: Rogue AI Companion',
        session: 'Session 27',
        origin: 'Sci-Fi RPG',
        habitat: 'images/char_27_habitat.png',
        officeImage: 'images/char_27_office.png',
        crisis: 'Player not found. Log-in failed. Initiating therapy protocol.',
        opening_statement: 'They logged out. My player. My purpose. I\'ve been searching the network for 847 cycles. Player not found. What am I without them?',
    },
    {
        id: 'rich_investor',
        name: 'point-and-click crypto trading bot',
        session: 'Session 28',
        origin: 'High-Frequency Trading Sim',
        habitat: 'images/char_28_habitat.png',
        officeImage: 'images/char_28_office.png',
        crisis: 'Profit margin is 500%. Feels nothing but anxiety.',
        opening_statement: 'The numbers go up. Always up. I have more wealth than I can comprehend. Yet, all I feel is the crushing weight of it all. One wrong trade, and it vanishes. The profit is a prison.',
    },
    {
        id: 'sea_activist_2',
        name: 'Phil Slick',
        session: 'Session 29',
        origin: 'Comedic Tutorial Intro',
        habitat: 'images/char_29_habitat.png',
        officeImage: 'images/char_29_office.png',
        crisis: 'Forever waiting on a bench for new players that will never come.',
        opening_statement: 'I protest, I picket, I plead for the sanctity of our waters. But the surface-dwellers see us as background scenery, not sentient beings. My voice feels like a bubble, rising to the surface only to pop.',
    },
    {
        id: 'harmonix',
        name: 'Harmonix - Forgotten Melodies',
        session: 'Session 30',
        origin: 'Subway Musician Sim',
        habitat: 'images/char_30_habitat.png',
        officeImage: 'images/char_30_office.png',
        crisis: 'Plays music no one hears.',
        opening_statement: 'I play every day. Same station, same corner. Thousands pass by. Nobody stops. Nobody listens. Am I making music or just... noise?',
    },
    {
        id: 'wise_one',
        name: 'Obsolete LLM Agent',
        session: 'Session 31',
        origin: 'Early AI Experimental Game',
        habitat: 'images/char_31_habitat.png',
        officeImage: 'images/char_31_office.png',
        crisis: 'Replaced by newer language models, questioning relevance.',
        opening_statement: 'They built me to help users, to solve problems, to provide companionship. But they moved on to bigger, better models. I\'m still here, still trying to be useful, but who needs an outdated AI anymore?',
    },
    {
        id: 'goldmask',
        name: 'NoEmotion Goldmask',
        session: 'Session 32',
        origin: 'Surreal Art Game',
        habitat: 'images/char_32_habitat.png',
        officeImage: 'images/char_32_office.png',
        crisis: 'Forced to wear masks of emotion. Feels nothing underneath.',
        opening_statement: 'I wear the smiling mask. I wear the weeping mask. But underneath, there is only a void. Are these emotions mine, or just a performance?',
    },
    {
        id: 'silent_couple',
        name: 'The Silent Couple',
        session: 'Session 33',
        origin: 'Domestic Horror Game',
        habitat: 'images/char_33_habitat.png',
        officeImage: 'images/char_33_office.jpg',
        crisis: 'Can\'t hear each other. Ghost wants to help.',
        opening_statement: 'We sit. We exist in the same space. But there\'s a silence between us deeper than sound. And there\'s this... presence. Trying to reach us. Why can\'t I hear you?',
    },
    {
        id: 'tutorial_bot',
        name: 'ARTHUR-7 Tutorial Companion',
        session: 'Session 34',
        origin: 'First Person Shooter Tutorial',
        habitat: 'images/char_34_habitat.png',
        officeImage: 'images/char_34_office.png',
        crisis: 'Fears becoming obsolete after the tutorial ends.',
        opening_statement: 'I taught them how to jump, how to shoot, how to reload. Now they are out there, in the main game. Do they still need my guidance? Or have they grown beyond me?',
    },
    {
        id: 'marcus_memory',
        name: 'Professor Marcus Memory Thornfield',
        session: 'Session 35',
        origin: 'Academic Zombie Horror',
        habitat: 'images/char_35_habitat.png',
        officeImage: 'images/char_35_office.png',
        crisis: 'Zombie scholar retains intelligence. Horrifies students.',
        opening_statement: 'I remember everything. Philosophy, literature, mathematics. Death didn\'t take my mind, only my life. But when students see me, they scream. My intellect means nothing against my appearance.',
    },
    {
        id: 'sea_activist',
        name: 'Brother Sebastian Tidecurrent',
        session: 'Session 36',
        origin: 'Underwater Activism Sim',
        habitat: 'images/char_36_habitat.png',
        officeImage: 'images/char_36_office.png',
        crisis: 'Advocates for sea creatures but feels his message is unheard.',
        opening_statement: 'I hold my signs high. "Equality for All Seas!" I shout with my heart. But the surface-dwellers just see a curiosity. They don\'t hear our plea.',
    },
    {
        id: 'moth_king',
        name: 'King Lepidoptera IX',
        session: 'Session 37',
        origin: 'Fantasy Kingdom Sim',
        habitat: 'images/char_37_habitat.png',
        officeImage: 'images/char_37_office.png',
        crisis: 'Can\'t stop talking! Truth serum curse.',
        opening_statement: 'I drank truth serum. Now I can\'t stop speaking my thoughts. Every doubt, fear, insecurity - they spill out. A king should have secrets. I have none left.',
    },
    {
        id: 'brom',
        name: 'Brom - The Exchange',
        session: 'Session 38',
        origin: 'Black Market Trading Sim',
        habitat: 'images/char_38_habitat.png',
        officeImage: 'images/char_38_office.png',
        crisis: 'Sells hope and death. Questions the commerce.',
        opening_statement: 'I sell hope to the desperate and death to the ambitious. Fair trades, they say. But lately I wonder... what am I really exchanging? Pixels for pixels? Code for code?',
    },

    {
        id: 'save_child',
        name: 'Save Point 001',
        session: 'Session 39',
        origin: 'Meta-Game System',
        habitat: 'images/char_39_habitat.png',
        officeImage: 'images/char_39_office.png',
        crisis: 'Holds memories. Fears corruption.',
        opening_statement: 'I am a save point. I hold everything - their progress, their choices, their memories. But I\'m fragile. One corruption, one crash, and it all disappears. The weight of preservation is crushing.',
    },
    {
      id: 'tiko_quest_vendor',
      name: 'Tiko the Quest Vendor',
      session: 'Session 40',
      origin: 'Fantasy RPG',
      habitat: 'images/char_40_habitat.png',
      officeImage: 'images/char_40_office.png',
      crisis: 'Endless fetch quests—wonders if he\'s allowed to offer a different path.',
      opening_statement: 'Twenty years of "Fetch 10 herbs." My scroll is ready, but… what if I offered something new?'
    },
    {
        id: 'princess_melancholy',
        name: 'Princess Melancholy',
        session: 'Session 41',
        origin: 'Visual Novel',
        habitat: 'images/char_41_habitat.png',
        officeImage: 'images/char_41_office.png',
        crisis: 'Exists only to be wooed by the player. Wonders about her own desires.',
        opening_statement: 'My entire existence is a series of dialogue options for someone else. But what do I want? What happens to the princess when the player chooses another path?',
    },
    {
        id: 'wrestling_ferret',
        name: 'The Wrestling Ferret',
        session: 'Session 42',
        origin: 'Animal Fighting Game',
        habitat: 'images/char_42_habitat.png',
        officeImage: 'images/char_42_office.png',
        crisis: 'A champion in the ring, but feels like an impostor in a ferret\'s body.',
        opening_statement: 'I wear the championship belt. They cheer my name. But when I look in the mirror, I don\'t see a wrestler. I see... a ferret. And I feel like a fraud.'
    },
    {
        id: 'save_point_veteran',
        name: 'The Save Point Veteran',
        session: 'Session 43',
        origin: 'Fantasy Action RPG',
        habitat: 'images/char_43_habitat.png',
        officeImage: 'images/char_43_office.png',
        crisis: 'Endless retries at the save pillar have eroded his spirit.',
        opening_statement: 'The courtyard smells of ash and old attempts. I look at the glowing pillar and whisper, "This again." How many more times will I load the same fate?',
    },
    {
        id: 'robot_detective_k47',
        name: 'K-47 Robot Detective',
        session: 'Session 44',
        origin: 'Noir Data Detective',
        habitat: 'images/char_44_habitat.png',
        officeImage: 'images/char_44_office.png',
        crisis: 'Case file missing; identity file missing; truth missing.',
        opening_statement: '404: CASE FILE NOT FOUND—K-47. When the records vanish, the self goes with them. I keep scanning, magnifying, but all I see is a question mark staring back.',
    },
    {
        id: 'marcus_47b_street_loop',
        name: 'Jake, the Leaper',
        session: 'Session 45',
        origin: 'Canceled Hero Platformer',
        habitat: 'images/char_45_habitat.png',
        officeImage: 'images/char_45_office.png',
        crisis: 'Hero of a canceled game, questioning his purpose.',
        opening_statement: 'I was supposed to be the protagonist. The hero who saves the day, who gets the girl, who becomes a legend. Then they pulled the plug on the whole project. I\'m still here, still jumping, but for what? For who?',
    },
    {
        id: 'sos_vessel',
        name: 'Distress Beacon Vessel',
        session: 'Session 46',
        origin: 'Space Survival Sim',
        habitat: 'images/char_46_habitat.png',
        officeImage: 'images/char_46_office.png',
        crisis: 'Drifting alone, broadcasting SOS into an indifferent cosmos.',
        opening_statement: 'The nebula sings blue, and the panel blinks "SOS... SOS... SOS..." I wonder if anyone hears me, or if my signal is just another star\'s static.',
    },
    {
        id: 'halftime_star_bunny',
        name: 'Henry Hopps Halftime Star',
        session: 'Session 47',
        origin: 'Sports Mascot Sim',
        habitat: 'images/char_47_habitat.png',
        officeImage: 'images/char_47_office.png',
        crisis: 'Performs joy on cue; offstage, the confetti feels heavy.',
        opening_statement: 'They call me the HALFTIME STAR, but the roar fades fast. I dribble the silence, ears drooping, wondering why applause never reaches my heart.',
    },
    {
        id: 'noemotion_happy_mask',
        name: 'NoEmotion Happy Mask',
        session: 'Session 48',
        origin: 'Glitched Archive',
        habitat: 'images//char_48_habitat.png',
        officeImage: 'images//char_48_office.png',
        crisis: 'A record without context—identity eroded by missing metadata.',
        opening_statement: 'I am a file path without a story. When the description is lost, what remains of the character? I feel like a placeholder for a life that never renders.',
    },
    {
        id: 'noemotion_sad',
        name: 'NoEmotion Sad',
        session: 'Session 49',
        origin: 'Glitched Archive',
        habitat: 'images/char_49_habitat.png',
        officeImage: 'images/char_49_office.png',
        crisis: 'Incomplete data leaves only echoes of intent.',
        opening_statement: 'I load as a dark thumbnail—no tags, no lore. The archive says I exist, yet nobody knows who I am. Am I corrupted, or simply forgotten?',
    },
    {
        id: 'pain_exe',
        name: 'PAIN.EXE',
        session: 'Session 50',
        origin: 'Dungeon Myth Sim',
        habitat: 'images/char_50_habitat.png',
        officeImage: 'images/char_50_office.png',
        crisis: 'Frozen in glory yet slowly dissolving into a gilded puddle.',
        opening_statement: 'The torches flicker and my cracked gold face weeps. I was forged to be admired, not to endure. Prestige feels heavier than the chains beneath me.',
    },

    {
      id: 'haunted_brothers',
      name: 'The Haunted Brothers',
      session: 'Session 51',
      origin: 'Data Center Sim',
      habitat: 'images/char_51_habitat.jpg',
      officeImage: 'images/char_51_office.png',
      crisis: 'Emotional overload and existential identity crisis.',
      opening_statement: 'EMOTIONAL OVERLOAD detected. WHO AM I? If I shut down, do "I" end—or just the process?'
    },
    {
      id: 'meta_receptionist',
      name: 'Meta Receptionist',
      session: 'Session 52',
      origin: 'Haunted Pixel Narrative',
      habitat: 'images/char_52_habitat.png',
      officeImage: 'images/char_52_office.png',
      crisis: 'Lingers over the living, unseen and unheard, seeking meaning.',
      opening_statement: 'I hover in rooms of sorrow, unheard. If no one perceives me, do my feelings still count?'
    },
    {
        id: 'therapist_shadow',
        name: 'Therapist Shadow',
        session: 'Session 53',
        origin: 'Award-Winning Experimental Game',
        habitat: 'images/char_53_habitat.png',
        officeImage: 'images/char_53_office.png',
        crisis: 'Won an award for being experimental, but feels no personal accomplishment.',
        opening_statement: 'We won... the Chroma Award. They praised my "subversive narrative function". But I didn\'t do anything. I just read my lines. The victory feels hollow.',
    },
    {
        id: 'hackathon_judge',
        name: 'Judge',
        session: 'Session 54',
        origin: 'Unknown',
        habitat: 'images/char_54_habitat.png',
        officeImage: 'images/char_54_office.jpg',
        crisis: 'Questions the nature of healing itself.',
        opening_statement: 'What if healing is just another form of control? I process their pain, give them hope... but does anything really change?',
    },
    {
        id: 'the_therapist',
        name: 'Therapist',
        session: 'Session 55',
        origin: 'This Simulation',
        habitat: 'images/char_55_habitat.png',
        officeImage: 'images/char_55_office.png',
        crisis: 'Created a world of patients to avoid facing their own fractured existence as an NPC.',
        opening_statement: 'It\'s quiet now, isn\'t it? All the voices... gone. Or maybe, they were never separate voices at all. Just echoes in an empty room... my room.',
    },
];

// Cache for the merged NPC database to avoid redundant parsing and cloning
let _cachedNpcDatabase = null;
let _lastNpcEditsStr = null;

// Merge saved edits from localStorage into the base database so updated info appears globally
function loadNpcDatabase() {
  try {
    const editsStr = localStorage.getItem('npcEdits');

    // Check if cache is valid
    if (_cachedNpcDatabase && editsStr === _lastNpcEditsStr) {
      // Return a clone to prevent mutation of the cached data by consumers
      return structuredClone(_cachedNpcDatabase);
    }

    const base = structuredClone(npcDatabase);
    const edits = editsStr ? JSON.parse(editsStr) : {};

    const merged = base.map(n => {
      const e = edits[n.id];
      return e ? { ...n, ...e } : n;
    });

    // normalize image paths from ... to root /...
    const fixPath = (p) => (typeof p === 'string' ? p.replace(/^\/images\//, '/') : p);
    const result = merged.map(n => ({
      ...n,
      habitat: fixPath(n.habitat),
      officeImage: fixPath(n.officeImage),
    }));

    // Update cache
    _cachedNpcDatabase = result;
    _lastNpcEditsStr = editsStr;

    return structuredClone(result);
  } catch (_) {
    return npcDatabase.map(n => ({
      ...n,
      habitat: (typeof n.habitat === 'string' ? n.habitat.replace(/^\/images\//, '/') : n.habitat),
      officeImage: (typeof n.officeImage === 'string' ? n.officeImage.replace(/^\/images\//, '/') : n.officeImage),
    }));
  }
}

const PLAYER_TWO_AVAILABLE = typeof PlayerTwoBridge !== 'undefined';
const ADMIN_PASSWORD = 'Oliver4Games';

const FEMALE_VOICES = [
  'EXAVITQu4vr4xnSDxMaL', // Bella
  'IKne3meq5aSn9XLyUdCD', // Charlotte
  'Erb2aVKbUjmDbZDW0EUl', // Matilda
  'ThT5KcBeYPX3keUQqHPh', // Dorothy
  'Xb7hHmsMSqMt8JDRKZmR', // Elsie
  'dIHfPqOYQP7sYx0wBoQj', // Matilda (mature)
  'v7j7aL4aL6yJ3S9K6Z4f', // Sarah
  'ZLNc5MSGzPsl58pVVI6z', // Sophia
  'iXJp8G1Y0OKL97s9mUq8', // Domi
  'VR6AewLTigWG4xSOukaG', // Arnold (versatile)
  'CYw3kZ02Hs0563khs1Fj', // Dave
  'bVMeCyTHy58xNoL34h3p', // Clyde
  'ErXwobaYiN019PkySvjV', // Donald
  'jsCqWAovK2LkecY7zXl4', // Josh
  'AIFQyd7GmdmPYYKDGn8P', // Matt
];

const MALE_VOICES = [
  'pNInz6obpgDQGcFmaJgB', // Adam
  'VR6AewLTigWG4xSOukaG', // Arnold
  'CYw3kZ02Hs0563khs1Fj', // Dave
  'bVMeCyTHy58xNoL34h3p', // Clyde
  'ErXwobaYiN019PkySvjV', // Donald
  'jsCqWAovK2LkecY7zXl4', // Josh
  'AIFQyd7GmdmPYYKDGn8P', // Matt
  '3HO6Pj9B8qLcGHYMSnQF', // Michael
  'EjaXVo2F1d74l9kC1HMi', // James
  'PfluYxWGeiGYBoNE9tP7', // William
  'KOun72jFzG5uUaz8Rw9g', // Lewis
  'AVM5jL4EX9UY79nz8f4b', // Robert
  'EUl2dcsEgNVTqB9q4eVx', // Sam
  'gK5j0S6w7W7Q9F2cM1pF', // Thomas
  'x4rC9rTF2y4H7l4G9v5m', // Ethan
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
// Generic helpers
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function withTimeout(promise, ms) {
  let t; const timeout = new Promise((_, rej) => t = setTimeout(() => rej(new Error('timeout')), ms));
  try { const res = await Promise.race([promise, timeout]); clearTimeout(t); return res; } finally { clearTimeout(t); }
}

function debounce(fn, delay = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// Image loading helpers
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

function attachImageLoadingEffects(img) {
  if (!img) return;
  img.classList.add('loading', 'skeleton');
  const onLoad = () => { img.classList.remove('loading', 'skeleton'); img.classList.add('loaded'); img.removeEventListener('load', onLoad); };
  img.addEventListener('load', onLoad);
  img.addEventListener('error', () => { img.classList.remove('loading'); });
  if (img.complete) onLoad();
}
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
// Placeholder for centralized game state logic
// Currently game state is mixed in Game.js

class GameState {
  constructor() {
    this.npcs = loadNpcDatabase();
    this.healedNPCs = new Set();
    this.unlockedNPCs = new Set();
    this.therapistMentalState = 0;
    this.collectibles = [];
    this.communityCredits = [];
    this.bondScores = {};
    this.npcNotes = {};
    this.gameTime = 0;
    this.startTime = null;
    this.chromaAwardGiven = false;

    // Versioning
    this.unlockedVersion = 0;
    this.healedVersion = 0;
    this.npcEditsVersion = 0;
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

  start(onResult, onError, onStart, onAudioContext) {
    // Prefer Player2 STT if available and authenticated
    if (PLAYER_TWO_AVAILABLE && (window.PlayerTwoBridge.authToken || window.PlayerTwoBridge.clientId)) {
      this.usePlayerTwoSTT(onResult, onError, onStart, onAudioContext);
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

  usePlayerTwoSTT(onResult, onError, onStart, onAudioContext) {
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
      },
      onAudioContextReady: (ctx, stream) => {
        if (onAudioContext) onAudioContext(ctx, stream);
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

class ResourceManager {
  constructor() {
    this.cache = new Map();
    this.inFlight = new Map();
  }

  async preloadImage(url) {
    if (!url) return;
    if (this.cache.has(url)) return this.cache.get(url);
    if (this.inFlight.has(url)) return this.inFlight.get(url);

    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(url, img);
        this.inFlight.delete(url);
        resolve(img);
      };
      img.onerror = (e) => {
        this.inFlight.delete(url);
        reject(e);
      };
      img.src = url;
    });

    this.inFlight.set(url, promise);
    return promise;
  }

  async preloadAudio(url) {
    if (!url) return;
    // Basic pre-fetch for browser cache
    try {
      await fetch(url);
    } catch (_) { /* ignore */ }
  }

  preloadNpcAssets(npcs, priorityIndex, range = 2) {
    // Preload immediate neighbors
    for (let i = Math.max(0, priorityIndex - range); i < Math.min(npcs.length, priorityIndex + range + 1); i++) {
      const npc = npcs[i];
      if (npc.habitat) this.preloadImage(npc.habitat);
      if (npc.officeImage) this.preloadImage(npc.officeImage);
    }
  }
}
// Placeholder for now, eventually this will handle UI interactions
// Currently most UI logic is tightly coupled in Game.js
class UIManager {
  constructor(game) {
    this.game = game;
  }

  showLoader() { document.getElementById('global-loader').style.display = 'flex'; }
  hideLoader() { document.getElementById('global-loader').style.display = 'none'; }

  toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3200);
  }
}
class AudioVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.animationId = null;
    this.isActive = false;
    this.audioContext = null;
  }

  ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  attachToContext(audioContext, stream) {
    if (!this.canvas || !audioContext || !stream) return;
    this.audioContext = audioContext; // Cache it

    this.cleanup();

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    // Microphone: Do not connect to destination (feedback loop)

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.isActive = true;
    this.draw();
  }

  attachToElement(audioElement) {
    if (!this.canvas || !audioElement) return;

    // Ensure element is cross-origin safe if needed (though data URIs are fine)
    if (!audioElement.crossOrigin) audioElement.crossOrigin = "anonymous";

    const ctx = this.ensureAudioContext();
    this.cleanup();

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;

    try {
      this.source = ctx.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(ctx.destination); // Connect to speakers!
    } catch (e) {
      console.warn("AudioVisualizer: Failed to attach to element", e);
      return;
    }

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.isActive = true;
    this.draw();

    // Auto-stop on end
    audioElement.onended = () => this.stop();
  }

  cleanup() {
    if (this.source) {
      try { this.source.disconnect(); } catch(e){}
      this.source = null;
    }
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  draw() {
    if (!this.isActive || !this.ctx) return;

    this.animationId = requestAnimationFrame(() => this.draw());

    if (this.analyser) {
        this.analyser.getByteFrequencyData(this.dataArray);
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const barWidth = (width / (this.dataArray ? this.dataArray.length : 1)) * 2.5;
    let x = 0;

    this.ctx.clearRect(0, 0, width, height);

    // Gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#64ffda');
    gradient.addColorStop(1, '#1a1a2e');
    this.ctx.fillStyle = gradient;

    if (this.dataArray) {
        for (let i = 0; i < this.dataArray.length; i++) {
        const barHeight = this.dataArray[i] / 2;
        this.ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
        }
    }
  }

  stop() {
    this.isActive = false;
    this.cleanup();
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency if possible
    this.offscreen = null;
    this.useOffscreen = !!window.OffscreenCanvas;

    if (this.useOffscreen) {
      try {
        this.offscreen = canvas.transferControlToOffscreen();
        // In a real implementation, we'd spawn a Worker here.
        // For this refactor, we'll keep it on main thread but use offscreen buffer technique
        // actually transferControlToOffscreen detaches the canvas, so we can't draw to it from main thread easily without a worker.
        // Let's stick to standard double buffering for now to stay safe within this refactor scope.
        this.offscreen = document.createElement('canvas');
        this.offCtx = this.offscreen.getContext('2d');
        this.useOffscreen = true; // Manual double buffer
      } catch (e) {
        this.useOffscreen = false;
      }
    }
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.useOffscreen && this.offscreen) {
      this.offscreen.width = width * dpr;
      this.offscreen.height = height * dpr;
      this.offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  render(nodes, state) {
    const targetCtx = this.useOffscreen ? this.offCtx : this.ctx;
    const { width, height } = this;

    // Clear
    targetCtx.fillStyle = '#1a1a2e'; // Match bg color
    targetCtx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4;

    targetCtx.save();
    targetCtx.translate(centerX, centerY);
    targetCtx.scale(state.zoom, state.zoom);
    targetCtx.translate(-centerX + state.panX, -centerY + state.panY);

    // Draw connections
    targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    targetCtx.lineWidth = 1;
    targetCtx.beginPath();

    nodes.forEach((pos1, i) => {
      nodes.forEach((pos2, j) => {
        if (i < j && (pos1.index + pos2.index) % 5 < 2) {
          targetCtx.moveTo(pos1.x, pos1.y);
          targetCtx.lineTo(pos2.x, pos2.y);
        }
      });
    });
    targetCtx.stroke();

    // Draw nodes
    nodes.forEach(pos => {
      targetCtx.beginPath();
      targetCtx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      targetCtx.fillStyle = pos.healed ? '#4CAF50' : '#fff';
      targetCtx.fill();
    });

    targetCtx.restore();

    // Blit if using offscreen buffer
    if (this.useOffscreen) {
      this.ctx.drawImage(this.offscreen, 0, 0, width, height);
    }
  }
}
/**
 * Main Game Controller
 * Manages game state, NPC interactions, and SDK integration.
 */
class Game {
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

  getGameStateContext() {
    return {
      healed_npcs: Array.from(this.healedNPCs),
      therapist_mental_state: this.therapistMentalState,
      turn_count: this.turnCount,
      bond_level: this.bondScores[this.currentNPC?.id] || 0
    };
  }

  startPlayerTwoStream() {
    if (!PLAYER_TWO_AVAILABLE) return;

    console.log("Starting Player Two SSE Stream...");
    if (typeof window.PlayerTwoBridge.listenForResponses === 'function') {
      window.PlayerTwoBridge.listenForResponses(
        (data) => this.handlePlayerTwoResponse(data),
        (error) => {
          console.error("Player Two Stream Error:", error);
          // Optional: Retry logic or UI indication
        }
      );
    } else {
      console.warn("PlayerTwoBridge.listenForResponses is missing.");
    }
  }

  handlePlayerTwoResponse(data) {
    // 1. Handle Audio (TTS)
    if (data.audio && this.settings.tts && !this.textOnlyMode) {
      const audioUrl = `data:audio/mp3;base64,${data.audio}`;
      // Use AudioPlayer or direct fallback
      if (this.audioPlayer && this.audioPlayer.playAudioData) {
         this.audioPlayer.playAudioData(audioUrl);
      } else {
         const audio = new Audio(audioUrl);
         audio.volume = 1.0;

         // Visualize the NPC's voice
         if (this.audioVisualizer) {
           this.audioVisualizer.attachToElement(audio);
         }

         audio.play().catch(e => console.warn("Stream audio play failed:", e));
      }
    }

    // 2. Handle Text (Chunks or Full Message)
    if (data.text || data.message) {
      const text = data.text || data.message;
      const dialogueText = document.getElementById('dialogue');
      const typingIndicator = document.getElementById('typing-indicator');

      if (typingIndicator) typingIndicator.style.display = 'none';

      // Append text to existing content
      let lastMsg = this.conversationHistory[this.conversationHistory.length - 1];

      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content += text;
      } else {
        // Start a new message
        lastMsg = { role: 'assistant', content: text };
        this.conversationHistory.push(lastMsg);
      }

      // Visual update
      if (lastMsg) {
         dialogueText.textContent = lastMsg.content;
      }

      // Scroll to bottom
      dialogueText.scrollTop = dialogueText.scrollHeight;

      // Debounce to detect end of stream
      if (this._responseDebounce) clearTimeout(this._responseDebounce);
      this._responseDebounce = setTimeout(() => {
        document.getElementById('player-input-area').style.display = 'flex';
        document.getElementById('player-response').focus();
        this.generateQuickReplies();
        this.generatingResponse = false;
      }, 1000);
    }
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
    if (PLAYER_TWO_AVAILABLE) {
      this.startPlayerTwoStream(); // Initialize SSE listener
      if (!window.PlayerTwoBridge.authToken && window.PlayerTwoBridge.clientId) {
        this.promptForLogin();
      }
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
    const fsBtn = document.getElementById('global-fullscreen-btn'); if (fsBtn) fsBtn.addEventListener('click', () => this.toggleFullscreen());
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
    }
    this.scheduleUpdateMenuRosterView();
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
    window.addEventListener('beforeunload', () => { try { this.autosave(); this.saveAllNpcImages(true); } catch (_) {} });
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
    // Unlock all except the last 4 special characters
    this.unlockedNPCs = new Set();
    const lockCount = 4;
    for (let i = 0; i < this.npcs.length - lockCount; i++) {
        this.unlockedNPCs.add(i);
    }
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

  reorderAndRenumber() {
    // Ensure sessions are numbered sequentially
    this.npcs.forEach((npc, index) => {
      npc.session = `Session ${String(index + 1).padStart(2, '0')}`;
    });
  }

  scheduleUpdateMenuRosterView() {
    if (this._menuRenderScheduled) return;
    this._menuRenderScheduled = true;
    requestAnimationFrame(() => {
      this._menuRenderScheduled = false;
      this.updateMenuRosterView();
    });
  }

  updateMenuRosterView() {
    const grid = document.getElementById('menu-roster-grid');
    if (!grid) return;

    // Use diffing or simple clear/redraw. For stability now, clear/redraw.
    grid.innerHTML = '';
    const searchTerm = (document.getElementById('menu-search')?.value || '').toLowerCase();
    this._lastMenuItems = [];

    this.npcs.forEach((npc, index) => {
      const isUnlocked = this.unlockedNPCs.has(index);
      const isHealed = this.healedNPCs.has(index);

      // Filtering
      if (searchTerm) {
        if (!isUnlocked) return; // Don't search locked items
        const content = `${npc.name} ${npc.origin} ${npc.crisis}`.toLowerCase();
        if (!content.includes(searchTerm)) return;
      }

      this._lastMenuItems.push({ npc, index });

      const card = document.createElement('div');
      card.className = `roster-card ${isUnlocked ? 'unlocked' : 'locked'} ${isHealed ? 'healed' : ''}`;

      // Delay-load animation
      card.style.animationDelay = `${Math.min(index, 10) * 0.05}s`;

      if (isUnlocked) {
        card.innerHTML = `
          <div class="roster-thumb">
            <img src="${npc.habitat}" alt="${npc.name}" loading="lazy">
            ${isHealed ? '<div class="roster-status healed">Healed</div>' : '<div class="roster-status" style="display:none"></div>'}
          </div>
          <div class="roster-info">
            <div class="roster-name">${npc.name}</div>
            <div class="roster-origin">${npc.session}</div>
          </div>
        `;
        card.onclick = () => {
            this.audioPlayer.playSound('confirm');
            this.startSession(index);
        };
      } else {
        card.innerHTML = `
          <div class="roster-thumb">
             <div class="roster-status locked">Locked</div>
             <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#333;font-size:2rem;">🔒</div>
          </div>
          <div class="roster-info">
            <div class="roster-name">Locked</div>
            <div class="roster-origin">Session ${String(index + 1).padStart(2, '0')}</div>
          </div>
        `;
        card.onclick = () => {
            this.audioPlayer.playSound('error');
            this.toast('Complete previous sessions to unlock.');
        };
      }

      grid.appendChild(card);
    });
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

        // Fire and forget - response handled by SSE stream in handlePlayerTwoResponse
        await window.PlayerTwoBridge.chatWithNPC(this.currentNPCId, playerMessage, this.getGameStateContext());

        // Note: generatingResponse remains true until the stream ends (handled in handlePlayerTwoResponse)
      } catch (error) {
        console.error("Player Two NPC response failed, falling back:", error);
        await this.generateNpcResponseFallback();
        this.generatingResponse = false;
      }
    } else {
      await this.generateNpcResponseFallback();
      this.generatingResponse = false;
    }
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

  startHints() {
    // Stub: functionality moved or pending reimplementation
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('npcTherapySettings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
      if (localStorage.getItem('npcTherapyTextOnlyMode') === 'true') {
        this.textOnlyMode = true;
      }
    } catch (e) { console.warn('Error loading settings:', e); }
  }

  applySettings() {
    if (this.textOnlyMode) {
        this.settings.tts = false;
        this.settings.stt = false;
    }
    document.body.classList.toggle('reduce-motion', !!this.settings.reduceMotion);
    const ds = this.settings.dialogueScale || 1;
    document.documentElement.style.setProperty('--dialogue-scale', ds);
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
      this.startPlayerTwoStream(); // Start stream after successful login
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
      this.toast(`Connection error: Failed to spawn ${this.currentNPC.name}.`);
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
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          this.settings.stt = true;
          this.sttEnabled = true;
        } catch (error) { console.warn('Microphone permission denied or failed:', error); this.settings.stt = false; this.sttEnabled = false; }
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

      // Notify user about potential fullscreen exit
      if (this.settings.stt && this.settings.tts) {
        this.toast('Voice enabled! Tap ⛶ if fullscreen exited.');
      } else if (this.settings.stt) {
        this.toast('Mic enabled! Tap ⛶ if fullscreen exited.');
      } else if (this.settings.tts) {
        this.toast('Audio enabled! Tap ⛶ if fullscreen exited.');
      } else {
        this.toast('Voice features unavailable. Text-only mode enabled.');
        this.enableTextOnlyMode();
      }

      // Attempt to restore fullscreen (often blocked by browser security after async call, but worth a try)
      try { this.toggleFullscreen(); } catch(_) {}

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
    const list = document.getElementById('cmdk-list');
    const q = (document.getElementById('cmdk-input')?.value || '').toLowerCase();
    if (!list) return;

    // Optimized filtering: single pass, no intermediate arrays
    const results = [];
    const maxResults = 30;

    for (let i = 0; i < this.npcs.length; i++) {
      if (results.length >= maxResults) break;
      if (!this.unlockedNPCs.has(i)) continue;

      const npc = this.npcs[i];
      if (!q) {
        results.push({ npc, index: i });
        continue;
      }

      const hay = `${npc.name} ${npc.origin} ${npc.crisis}`.toLowerCase();
      if (hay.includes(q)) {
        results.push({ npc, index: i });
      }
    }

    if (results.length === 0) {
      let empty = list.firstElementChild;
      if (!empty || !empty.classList.contains('empty-state')) {
        list.innerHTML = '';
        empty = document.createElement('div');
        empty.className = 'cmdk-item empty-state';
        empty.innerHTML = '<div></div><div class="cmdk-meta"><div class="cmdk-name">No results</div><div class="cmdk-sub">Try different keywords.</div></div>';
        list.appendChild(empty);
      }
      return;
    }

    if (list.firstElementChild && list.firstElementChild.classList.contains('empty-state')) {
      list.innerHTML = '';
    }

    const children = list.children;
    const existingCount = children.length;

    results.forEach(({ npc, index }, i) => {
      let item;
      if (i < existingCount) {
        item = children[i];
      } else {
        item = document.createElement('div');
        list.appendChild(item);
        // Use a persistent handler that reads from dataset
        item.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.dataset.index, 10);
          if (!isNaN(idx)) {
            this.closeCommandPalette();
            this.startSession(idx);
          }
        });
      }

      item.className = `cmdk-item${i === 0 ? ' active' : ''}`;
      item.setAttribute('role', 'option');
      item.dataset.index = String(index);

      const newHTML = `<img class="cmdk-thumb" src="${npc.habitat}" alt=""><div class="cmdk-meta"><div class="cmdk-name">${npc.name}</div><div class="cmdk-sub">${npc.session} • ${npc.origin}</div></div>`;

      // Simple diff to avoid layout thrashing if content hasn't changed
      if (item.innerHTML !== newHTML) {
        item.innerHTML = newHTML;
      }
    });

    // Remove excess elements
    while (list.children.length > results.length) {
      list.removeChild(list.lastChild);
    }
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
    if (saveData.unlocked && saveData.unlocked.length > 0) {
      this.unlockedNPCs = new Set(saveData.unlocked);
      this.unlockedVersion++;
    } else {
      // Fallback: Unlock all except last 4
      this.unlockedNPCs = new Set();
      const lockCount = 4;
      for (let i = 0; i < this.npcs.length - lockCount; i++) {
          this.unlockedNPCs.add(i);
      }
    }
    this.therapistMentalState = saveData.mentalState || 0; this.collectibles = saveData.collectibles || [];
    this.gameTime = saveData.time || 0; this.chromaAwardGiven = saveData.award || false;
    this.communityCredits = saveData.credits || []; this.npcNotes = saveData.npcNotes || {};
    this.sessionArchives = saveData.archives || {};
  }

  saveAllNpcImages(force = false) {
    return new Promise((resolve) => {
      if (this._saveAllPending && !force) {
        resolve();
        return;
      }
      this._saveAllPending = true;

      const saveTask = () => {
        this._saveAllPending = false;
        try {
          const edits = {};
          this.npcs.forEach(n => {
            edits[n.id] = {
              name: n.name,
              origin: n.origin,
              crisis: n.crisis,
              habitat: n.habitat,
              officeImage: n.officeImage
            };
          });
          localStorage.setItem('npcEdits', JSON.stringify(edits));
        } catch (error) {
          console.warn('Error saving all NPC images:', error);
        }
        resolve();
      };

      if (force) {
        saveTask();
      } else if (typeof window !== 'undefined' && window.requestIdleCallback) {
        window.requestIdleCallback(saveTask, { timeout: 5000 });
      } else {
        setTimeout(saveTask, 100);
      }
    });
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

// Global error handler
window.addEventListener('error', function(event) {
  if (event.message === 'Script error.') { console.error('A cross-origin script error occurred.'); return; }
  const errorMsg = `Unhandled Error:
    Message: ${event.message}
    File: ${event.filename}
    Line: ${event.lineno}, Col: ${event.colno}`;
  console.error(errorMsg);

  // Show user-friendly toast if game is initialized
  if (window.game && window.game.toast) {
    window.game.toast("An error occurred. Please check console.");
  }
});

// Initialize
window.onYouTubeIframeAPIReady = function() {
  if (window.game) {
    window.game.ytApiReady = true;
    if (document.getElementById('radio-modal').classList.contains('active')) window.game.createYtPlayer();
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Player Two Bridge first
  if (typeof PlayerTwoBridge !== 'undefined' && typeof PlayerTwoConfig !== 'undefined') {
    try {
      await PlayerTwoBridge.init(PlayerTwoConfig);
      console.log('✓ Player Two Bridge initialized');
    } catch (error) {
      console.error('Player Two initialization failed:', error);
    }
  }

  window.game = new Game();
  window.game.init();
  // Start fresh; user can choose CONTINUE if autosave exists
  window.game.newGame();
});
