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
