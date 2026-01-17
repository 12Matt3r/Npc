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

  // Request queue for rate limiting
  requestQueue: [],
  processing: false,
  maxRetries: 3,
  retryDelay: 1000,
  
  /**
   * Initialize the bridge with authentication
   * Called automatically when the game loads
   */
  async init(config) {
    this.apiBase = config.apiBase || 'https://api.player2.game/v1';
    this.authToken = config.authToken;
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
      commands: null,
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
      tts: 'server'
    };
    
    try {
      const response = await this.makeRequest(`${this.apiBase}/npcs/${npcId}/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(chatPayload)
      });
      
      if (!response.ok) {
        throw new Error(`Chat failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        message: data.message,
        audio: data.audio,
        npcId: npcId,
        timestamp: Date.now()
      };
      
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
      const femaleVoices = config.voices?.female || [
        'EXAVITQu4vr4xnSDxMaL',  // Bella
        'IKne3meq5aSn9XLyUdCD',  // Charlotte
        'Erb2aVKbUjmDbZDW0EUl'   // Matilda
      ];

      const maleVoices = config.voices?.male || [
        'pNInz6obpgDQGcFmaJgB',  // Adam
        'VR6AewLTigWG4xSOukaG',  // Arnold
        'CYw3kZ02Hs0563khs1Fj'   // Dave
      ];
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
    const femaleNames = [
      'sarah', 'emma', 'sophie', 'chloe', 'ava', 'mia', 'isabella', 'emily', 
      'grace', 'hannah', 'lily', 'zoe', 'leah', 'lucy', 'ella', 'freya', 
      'ivy', 'scarlett', 'imogen', 'poppy', 'alice', 'ruby', 'brooke', 
      'daisy', 'mira', 'luna', 'seraphina', 'zara', 'aria', 'melancholy',
      'daisy', 'elara', 'luna'
    ];
    const lowerName = name.toLowerCase();
    
    if (femaleNames.some(n => lowerName.includes(n))) {
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
  }
});

// Auto-initialize if PlayerTwoConfig is available
if (typeof window !== 'undefined' && window.PlayerTwoConfig) {
  window.addEventListener('DOMContentLoaded', () => {
    PlayerTwoBridge.init(window.PlayerTwoConfig).catch(err => {
      console.error('PlayerTwoBridge initialization failed:', err);
    });
  });
}
