import { Game } from './Game.js';

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
