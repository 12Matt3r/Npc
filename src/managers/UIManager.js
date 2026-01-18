// Placeholder for now, eventually this will handle UI interactions
// Currently most UI logic is tightly coupled in Game.js
export class UIManager {
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
