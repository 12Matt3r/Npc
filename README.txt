# NPC Therapy - Digital Consciousness Clinic
## Player Two Deployment Package

### Files Included
This package contains all files needed to run NPC Therapy on Player Two:

**Core Files:**
- `index.html` - Main game entry point
- `game.js` - Game logic (138KB)
- `styles.css` - Visual styling (45KB)
- `config.js` - API configuration
- `p2-bridge.js` - Player Two API bridge
- `manifest.json` - Game metadata
- `npc-config.js` - NPC character configurations
- `npc-data.js` - NPC database

**Assets:**
- 55 character portraits (char_01 to char_55)
- UI icons and logos
- Audio effects (button sounds, confirm, error)

### How to Upload to Player Two

1. **ZIP the Files**
   - Compress all files in this folder into a ZIP archive
   - On Windows: Right-click → Send to → Compressed (zipped) folder
   - On Mac: Right-click → Compress
   - Or use terminal: `zip -r npc-therapy.zip .`

2. **Upload to Player Two**
   - Go to player2.game and log into your account
   - Navigate to your game dashboard
   - Upload the ZIP file to the "Web Game (optional)" section
   - The system will automatically detect index.html as the entry point

3. **Configure Settings**
   - Set Viewport Dimensions: 1280 x 720 (or leave empty for responsive)
   - Enable "SharedArrayBuffer" only if needed (usually not required)
   - Enable "Enable on Mobile Browser" for mobile support

4. **Game Name & Description**
   - Name: "NPC Therapy - Digital Consciousness Clinic"
   - Description: "An interactive therapy simulation game where you guide AI NPCs through their personal crises. Features AI-powered conversations, voice synthesis, and 50+ unique patients."

### Features
- 55 unique NPC patients with distinct personalities
- AI-powered conversation system
- Voice output (Text-to-Speech)
- Voice input (Speech-to-Text)
- Save/Load game progress
- Journal and statistics tracking
- Rorschach image analysis test
- Connection map visualization

### Notes
- The external character creator iframe has been disabled for Player Two compatibility
- Use the JSON import feature in the Create menu to add custom NPCs
- Voice features require player authentication on Player Two
- Game saves progress in localStorage

### Troubleshooting
- If the game doesn't load: Check browser console for errors
- If voices don't work: Ensure Player Two authentication is configured
- If images don't appear: Verify all PNG files were uploaded
