# NPC Therapy - Digital Consciousness Clinic
## Player Two Deployment Package

### Files Included
This package contains source code. For production deployment, you should run the build process.

**Source Files:**
- `src/` - Modular game logic
- `index.html` - Main game entry point
- `styles.css` - Visual styling
- `config.js` - API configuration
- `p2-bridge.js` - Player Two API bridge

**Assets:**
- 55 character portraits (char_01 to char_55)
- UI icons and logos
- Audio effects (button sounds, confirm, error)

### How to Upload to Player Two

1. **Build the Game**
   - Run `npm install`
   - Run `npm run build`
   - This creates a `dist/` folder with the optimized game.

2. **ZIP the Files**
   - Enter the `dist/` folder: `cd dist`
   - Compress all files in this folder into a ZIP archive
   - On Windows: Select all -> Right-click → Send to → Compressed (zipped) folder
   - On Mac: Select all -> Right-click → Compress
   - Or use terminal: `zip -r npc-therapy.zip .`

3. **Upload to Player Two**
   - Go to player2.game and log into your account
   - Navigate to your game dashboard
   - Upload the ZIP file to the "Web Game (optional)" section
   - The system will automatically detect index.html as the entry point

4. **Configure Settings**
   - Set Viewport Dimensions: 1280 x 720 (or leave empty for responsive)
   - Enable "SharedArrayBuffer" only if needed (usually not required)
   - Enable "Enable on Mobile Browser" for mobile support

5. **Game Name & Description**
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
