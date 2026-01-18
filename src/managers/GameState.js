// Placeholder for centralized game state logic
// Currently game state is mixed in Game.js
import { loadNpcDatabase } from '../../npc-data.js';

export class GameState {
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
