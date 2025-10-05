class MazeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        // Device-aware sizing
        this.isMobile = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth <= 900;
        this.gridSize = this.isMobile ? 16 : 32;
        this.tileSize = 28; // keep tile size constant; canvas size adapts by gridSize
        // Match canvas size to grid so the map is centered and not offset
        this.canvas.width = this.gridSize * this.tileSize;
        this.canvas.height = this.gridSize * this.tileSize;

        this.gameState = 'menu';
        this.currentLevel = 1;
        this.score = 0;
        this.timeLimit = 120;
        this.timeRemaining = this.timeLimit;
        this.gameStartTime = 0;
        this.keys = 0;
        // this.keysRequired = 1;

        this.player = {
            x: 1,
            y: 1,
            moveSpeed: 1,
            lastMoveTime: 0,
            moveDelay: 1,
            lastDirection: null,
            powerupSlowdownEnd: 0,
            trapSlowdownEnd: 0,
            trapImmunity: 0,
            invisibility: 0
        };

        this.playerTrail = [];

        this.activeEffects = [];

        this.tiles = {
            WALL: 0,
            GRASS: 1,
            SNOW: 2,
            WATER: 3,
            STONE: 4,
            SAND: 5,
            TREE: 6,
            KEY: 7,
            EXIT: 8,
            TRAP: 9,
            TRIGGER: 10,
            POWERUP: 11
        };
        const tilesBackground = '#57b037'; // 'transparent'
        this.tileColors = {
            [this.tiles.WALL]: tilesBackground, // #34495e
            [this.tiles.GRASS]: tilesBackground, // #57b037
            [this.tiles.SNOW]: '#ecf0f1', // #ecf0f1
            [this.tiles.WATER]: '#3498db', // #3498db
            [this.tiles.STONE]: tilesBackground, // #7f8c8d
            [this.tiles.SAND]: '#f39c12', // #f39c12
            [this.tiles.TREE]: tilesBackground, // #228b22
            [this.tiles.KEY]: tilesBackground, // #f1c40f
            [this.tiles.EXIT]: tilesBackground, // #5a3105
            [this.tiles.TRAP]: tilesBackground, // #8e44ad
            [this.tiles.TRIGGER]: tilesBackground, // #e67e22
            [this.tiles.POWERUP]: tilesBackground // #ffd700
        };

        this.tileIcons = {
            [this.tiles.WALL]: 'icons/wall.svg',
            [this.tiles.GRASS]: 'icons/grass.svg',
            [this.tiles.SNOW]: 'icons/snow.svg',
            [this.tiles.WATER]: 'icons/water.svg',
            [this.tiles.STONE]: 'icons/stone.svg',
            [this.tiles.SAND]: 'icons/sand.svg',
            [this.tiles.TREE]: 'icons/tree.svg',
            [this.tiles.KEY]: 'icons/key.svg',
            [this.tiles.EXIT]: 'icons/exit.svg',
            [this.tiles.TRAP]: 'icons/trap.svg',
            [this.tiles.TRIGGER]: 'icons/trigger.svg',
            [this.tiles.POWERUP]: 'icons/powerup.svg'
        };

        this.loadedImages = {};
        this.playerIcon = 'icons/player.svg';
        this.playerImage = null;

        // Cached canvases for better performance
        this.tileCanvases = {};
        this.tilesLoaded = false;

        // Secret portal easter egg state (session-scoped)
        this.secretBuffer = '';
        this.portalModeUntil = 0; // timestamp until when portal mode is active
        this.portalUsed = false;  // can be activated only once per session
        this.portalCycleIndex = 0;

        this.tileSpeeds = {
            [this.tiles.GRASS]: 25,
            [this.tiles.SNOW]: 700,
            [this.tiles.STONE]: 1500,
            [this.tiles.SAND]: 400,
            [this.tiles.KEY]: 200,
            [this.tiles.EXIT]: 500,
            [this.tiles.TRAP]: 1500,
            [this.tiles.TRIGGER]: 25,
            [this.tiles.POWERUP]: 25
        };

        // On mobile, slow down movement to better match PC arrow key repeat speed
        if (this.isMobile) {
            const factor = 2.75; // empirically chosen to approximate desktop feel
            Object.keys(this.tileSpeeds).forEach(k => {
                this.tileSpeeds[k] = Math.round(this.tileSpeeds[k] * factor);
            });
        }

        this.impassableTiles = [this.tiles.WALL, this.tiles.WATER, this.tiles.TREE];

        this.currentMap = this.generateEmptyMap();
        this.predefinedLevels = this.createPredefinedLevels();

        this.editorMode = false;
        this.selectedTile = this.tiles.WALL;

        // Input state for continuous controls
        this.heldKey = null; // e.g., 'ArrowUp', 'ArrowDown', etc.
        this.dragControl = { active: false, startX: 0, startY: 0 };

        this.soundEnabled = localStorage.getItem('mazeGameSoundEnabled') !== 'false';

        this.initSounds();
        this.setupEventListeners();
        this.setupUI();
        this.applyResponsiveUI();
        this.loadImages();
        this.gameLoop();
    }

    initSounds() {
        this.audioContext = null;
        this.sounds = {};

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not supported');
        }

        this.updateSoundToggleButton();
    }

    loadImages() {
        // Load player icon
        this.playerImage = new Image();
        this.playerImage.src = this.playerIcon;

        // Load all tile icons and create cached canvases
        let loadedCount = 0;
        const totalImages = Object.keys(this.tileIcons).length;

        Object.entries(this.tileIcons).forEach(([tileType, iconPath]) => {
            const img = new Image();
            img.onload = () => {
                this.loadedImages[tileType] = img;
                this.createTileCanvas(parseInt(tileType), img);
                loadedCount++;

                if (loadedCount === totalImages) {
                    this.tilesLoaded = true;
                }
            };
            img.onerror = () => {
                // Create fallback canvas if image fails to load
                this.createFallbackTileCanvas(parseInt(tileType));
                loadedCount++;

                if (loadedCount === totalImages) {
                    this.tilesLoaded = true;
                }
            };
            img.src = iconPath;
        });
    }

    createTileCanvas(tileType, img) {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');

        // Draw background color
        ctx.fillStyle = this.tileColors[tileType];
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);

        // Draw border
        // ctx.strokeStyle = '#2c3e50';
        // ctx.lineWidth = 1;
        // ctx.strokeRect(0, 0, this.tileSize, this.tileSize);

        // Draw icon if available
        if (img && img.complete) {
            ctx.drawImage(img, 0, 0, this.tileSize, this.tileSize);
        }

        this.tileCanvases[tileType] = canvas;
    }

    createFallbackTileCanvas(tileType) {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');

        // Draw background color
        ctx.fillStyle = this.tileColors[tileType];
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);

        // Draw border
        // ctx.strokeStyle = '#2c3e50';
        // ctx.lineWidth = 1;
        // ctx.strokeRect(0, 0, this.tileSize, this.tileSize);

        this.tileCanvases[tileType] = canvas;
    }

    playSound(frequency, duration = 200, type = 'sine') {
        if (!this.soundEnabled || !this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = type;

            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
        } catch (e) {
            console.log('Error playing sound:', e);
        }
    }

    generateEmptyMap() {
        const map = [];
        for (let y = 0; y < this.gridSize; y++) {
            map[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                map[y][x] = this.tiles.GRASS;
            }
        }
        return map;
    }

    createPredefinedLevels() {
        const levels = [];
        for (let i = 1; i <= 10; i++) {
            levels.push(this.generateProgressiveLevel(i));
        }
        return levels;
    }

    generateProgressiveLevel(levelNumber) {
        const complexity = Math.min(30 + levelNumber * 8, 80);
        const wallTiles = [this.tiles.WALL, this.tiles.TREE];
        const floorTile = this.tiles.GRASS;
        const wallTile = wallTiles[Math.floor(Math.random() * wallTiles.length)];
        const map = this.generateMaze(complexity, floorTile, wallTile, levelNumber);

        return map;
    }

    generateMaze(complexity = 50, floorTile = this.tiles.GRASS, wallTile = this.tiles.WALL, levelNumber = 1) {
        const map = [];

        for (let y = 0; y < this.gridSize; y++) {
            map[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                if (x === 0 || y === 0 || x === this.gridSize - 1 || y === this.gridSize - 1) {
                    map[y][x] = wallTile;
                } else {
                    map[y][x] = floorTile;
                }
            }
        }

        for (let i = 0; i < complexity; i++) {
            const x = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
            const y = Math.floor(Math.random() * (this.gridSize - 4)) + 2;

            if (!(x === 1 && y === 1)) {
                map[y][x] = wallTile;
            }
        }

        const numKeys = Math.max(1, Math.floor(levelNumber / 3));
        // this.keysRequired = numKeys;

        for (let i = 0; i < numKeys; i++) {
            let keyX, keyY;
            do {
                keyX = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
                keyY = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
            } while (map[keyY][keyX] !== floorTile || (keyX === 1 && keyY === 1));
            map[keyY][keyX] = this.tiles.KEY;
        }

        const exitX = this.gridSize - 2;
        const exitY = this.gridSize - 2;
        map[exitY][exitX] = this.tiles.EXIT;

        const numTraps = Math.min(levelNumber + 1, 8);
        for (let i = 0; i < numTraps; i++) {
            let trapX, trapY;
            do {
                trapX = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
                trapY = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
            } while (map[trapY][trapX] !== floorTile || (trapX === 1 && trapY === 1) || (trapX === exitX && trapY === exitY));
            map[trapY][trapX] = this.tiles.TRAP;
        }

        const numTriggers = Math.min(Math.floor(levelNumber / 2), 5);
        for (let i = 0; i < numTriggers; i++) {
            let triggerX, triggerY;
            do {
                triggerX = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
                triggerY = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
            } while (map[triggerY][triggerX] !== floorTile || (triggerX === 1 && triggerY === 1) || (triggerX === exitX && triggerY === exitY));
            map[triggerY][triggerX] = this.tiles.TRIGGER;
        }

        // Add powerups starting from level 3
        if (levelNumber >= 3) {
            const numPowerups = Math.min(Math.floor(levelNumber / 3) + 1, 4);
            for (let i = 0; i < numPowerups; i++) {
                let powerupX, powerupY;
                do {
                    powerupX = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
                    powerupY = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
                } while (map[powerupY][powerupX] !== floorTile || (powerupX === 1 && powerupY === 1) || (powerupX === exitX && powerupY === exitY));
                map[powerupY][powerupX] = this.tiles.POWERUP;
            }
        }

        if (levelNumber > 5) {
            this.addMixedTiles(map, floorTile, levelNumber);
        }

        return map;
    }

    addMixedTiles(map, baseTile, levelNumber) {
        const mixedTiles = [this.tiles.SNOW, this.tiles.SAND];
        const numMixed = Math.min(levelNumber * 3, 30);
        const exitX = this.gridSize - 2;
        const exitY = this.gridSize - 2;

        for (let i = 0; i < numMixed; i++) {
            const mixedTile = mixedTiles[Math.floor(Math.random() * mixedTiles.length)];
            let x, y;
            do {
                x = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
                y = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
            } while (map[y][x] !== baseTile || (x === 1 && y === 1) || (x === exitX && y === exitY));
            map[y][x] = mixedTile;
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            // Prevent arrow keys from scrolling the page
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }

            // Secret phrase detection: "keyportal"
            const isCharKey = typeof e.key === 'string' && e.key.length === 1;
            if (isCharKey) {
                this.secretBuffer = (this.secretBuffer + e.key.toLowerCase()).slice(-20);
                if (!this.portalUsed && this.secretBuffer.endsWith('keyportal')) {
                    this.portalUsed = true;
                    this.portalModeUntil = Date.now() + 2000; // 2s window
                    this.portalCycleIndex = 0;
                    this.showMagicMessage('🌀 Key Portal aktivní na 2s! Šipkami se portuj.', '#9b59b6');
                    this.addMagicEffect('🔑 Portál', 2000);
                    if (this.soundEnabled) this.playSound(1200, 250, 'square');
                }
            }

            if (this.gameState === 'playing' && !this.editorMode) {
                // Quick save level with Ctrl+S
                if ((e.key === 's' || e.key === 'S') && e.ctrlKey) {
                    e.preventDefault();
                    this.quickSaveCurrentLevel();
                    return;
                }
                this.handlePlayerMovement(e.key);
            }

            // Prevent Enter from triggering default actions when playing
            if (e.key === 'Enter' && this.gameState === 'playing') {
                e.preventDefault();
            }
        });

        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('regenerateBtn').addEventListener('click', () => this.regenerateLevel());
        document.getElementById('editorBtn').addEventListener('click', () => this.toggleEditor());
        document.getElementById('soundToggleBtn').addEventListener('click', () => this.toggleSound());
        document.getElementById('saveScoreBtn').addEventListener('click', () => this.saveScore());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('closeGameOverBtn').addEventListener('click', () => this.closeGameOver());

        document.getElementById('clearLevelBtn').addEventListener('click', () => this.clearLevel());
        document.getElementById('saveLevelBtn').addEventListener('click', () => this.saveLevel());
        document.getElementById('loadLevelBtn').addEventListener('click', () => this.loadLevel());
        document.getElementById('testLevelBtn').addEventListener('click', () => this.testLevel());
        document.getElementById('closeEditorBtn').addEventListener('click', () => this.toggleEditor());

        document.getElementById('exportLeaderboardBtn').addEventListener('click', () => this.exportLeaderboard());
        document.getElementById('importLeaderboardBtn').addEventListener('click', () => this.importLeaderboard());
        document.getElementById('clearLeaderboardBtn').addEventListener('click', () => this.clearLeaderboard());

        this.canvas.addEventListener('click', (e) => {
            if (this.editorMode) {
                this.handleEditorClick(e);
            }
        });

        // Mobile: on-screen buttons (hold to move)
        const btnUp = document.getElementById('btnUp');
        const btnDown = document.getElementById('btnDown');
        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');
        const triggerBtn = (key) => {
            if (this.gameState === 'playing' && !this.editorMode) {
                this.handlePlayerMovement(key);
            }
        };
        const setHeld = (key) => {
            if (this.gameState !== 'playing' || this.editorMode) return;
            this.heldKey = key;
        };
        const clearHeldIf = (key) => {
            if (this.heldKey === key) this.heldKey = null;
        };
        const bindBtn = (el, key) => {
            if (!el) return;
            // Use pointer events only to avoid duplicate triggers on mobile
            el.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try { el.setPointerCapture(e.pointerId); } catch {}
                setHeld(key);
                triggerBtn(key); // Immediate step for responsiveness
            });
            const end = () => clearHeldIf(key);
            el.addEventListener('pointerup', (e) => { e.preventDefault(); end(); });
            el.addEventListener('pointercancel', end);
            el.addEventListener('pointerleave', end);
            el.addEventListener('pointerout', end);
        };
        bindBtn(btnUp, 'ArrowUp');
        bindBtn(btnDown, 'ArrowDown');
        bindBtn(btnLeft, 'ArrowLeft');
        bindBtn(btnRight, 'ArrowRight');

        // Mobile: drag on canvas for continuous movement
        this.canvas.addEventListener('pointerdown', (e) => {
            if (this.editorMode) return; // editor uses clicks
            e.preventDefault();
            try { this.canvas.setPointerCapture(e.pointerId); } catch {}
            this.dragControl.active = true;
            this.dragControl.startX = e.clientX;
            this.dragControl.startY = e.clientY;
            this.heldKey = null; // wait until movement exceeds dead zone
        });
        const updateDragDirection = (e) => {
            if (!this.dragControl.active) return;
            const dx = e.clientX - this.dragControl.startX;
            const dy = e.clientY - this.dragControl.startY;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            const deadZone = 10;
            if (absX < deadZone && absY < deadZone) {
                this.heldKey = null;
                return;
            }
            if (absX > absY) {
                this.heldKey = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
            } else {
                this.heldKey = dy > 0 ? 'ArrowDown' : 'ArrowUp';
            }
        };
        this.canvas.addEventListener('pointermove', (e) => {
            if (this.editorMode) return;
            e.preventDefault();
            updateDragDirection(e);
        });
        const endDrag = () => {
            this.dragControl.active = false;
            this.heldKey = null;
        };
        this.canvas.addEventListener('pointerup', (e) => { e.preventDefault(); endDrag(); });
        this.canvas.addEventListener('pointercancel', endDrag);
        this.canvas.addEventListener('pointerleave', endDrag);
        this.canvas.addEventListener('pointerout', endDrag);
    }

    setupUI() {
        const tileSelector = document.getElementById('tileSelector');
        const tileTypes = [
            { type: this.tiles.WALL, name: 'Zeď' },
            { type: this.tiles.GRASS, name: 'Tráva' },
            { type: this.tiles.SNOW, name: 'Sníh' },
            { type: this.tiles.WATER, name: 'Voda' },
            { type: this.tiles.STONE, name: 'Kámen' },
            { type: this.tiles.SAND, name: 'Písek' },
            { type: this.tiles.TREE, name: 'Strom' },
            { type: this.tiles.KEY, name: 'Klíč' },
            { type: this.tiles.EXIT, name: 'Východ' },
            { type: this.tiles.TRAP, name: 'Past' },
            { type: this.tiles.TRIGGER, name: 'Spouštěč' },
            { type: this.tiles.POWERUP, name: 'Powerup' }
        ];

        tileTypes.forEach(tile => {
            const btn = document.createElement('div');
            btn.className = 'tile-btn';
            // btn.style.backgroundColor = this.tileColors[tile.type];
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.title = tile.name;

            // Create image element for SVG icon
            const img = document.createElement('img');
            img.src = this.tileIcons[tile.type];
            img.style.width = '30px';
            img.style.height = '30px';
            img.style.objectFit = 'contain';
            btn.appendChild(img);

            btn.addEventListener('click', () => {
                document.querySelectorAll('.tile-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedTile = tile.type;
            });
            tileSelector.appendChild(btn);
        });

        tileSelector.children[0].classList.add('selected');
    }

    applyResponsiveUI() {
        if (!this.isMobile) return;
        // Collapse legend/controls by default on mobile
        const controlsContent = document.getElementById('controlsContent');
        const controlsIcon = document.getElementById('controlsIcon');
        if (controlsContent && !controlsContent.classList.contains('collapsed')) {
            controlsContent.classList.add('collapsed');
        }
        if (controlsIcon) {
            controlsIcon.classList.add('collapsed');
            controlsIcon.textContent = '▶';
        }
        // Hide editor on mobile completely
        const editorBtn = document.getElementById('editorBtn');
        const levelEditor = document.getElementById('levelEditor');
        if (editorBtn) editorBtn.style.display = 'none';
        if (levelEditor) levelEditor.style.display = 'none';
        // Hide leaderboard by default and add a toggle button
        const leaderboard = document.getElementById('leaderboard');
        const ui = document.getElementById('ui');
        if (leaderboard && ui) {
            leaderboard.style.display = 'none';
            let toggleBtn = document.getElementById('toggleLeaderboardBtn');
            if (!toggleBtn) {
                toggleBtn = document.createElement('button');
                toggleBtn.id = 'toggleLeaderboardBtn';
                toggleBtn.textContent = '📊 Žebříček';
                toggleBtn.style.gridColumn = '1 / -1';
                // Insert after sound toggle
                const btnContainer = ui.querySelector('div > #soundToggleBtn')?.parentElement || ui;
                btnContainer.appendChild(toggleBtn);
            }
            const toggle = () => {
                const isHidden = leaderboard.style.display === 'none';
                leaderboard.style.display = isHidden ? 'block' : 'none';
                // Optionally scroll into view when opening
                if (isHidden) leaderboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
            toggleBtn.onclick = toggle;
        }
    }

    handlePlayerMovement(key) {
        const now = Date.now();

        let direction = null;
        let newX = this.player.x;
        let newY = this.player.y;

        switch (key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                direction = 'up';
                newY--;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                direction = 'down';
                newY++;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                direction = 'left';
                newX--;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                direction = 'right';
                newX++;
                break;
            default:
                return;
        }

        // Portal mode: intercept arrow keys to teleport through keys and exit (2s window)
        if (now < this.portalModeUntil && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
            const targets = [];
            // Collect all active keys
            for (let ty = 0; ty < this.gridSize; ty++) {
                for (let tx = 0; tx < this.gridSize; tx++) {
                    if (this.currentMap[ty][tx] === this.tiles.KEY) targets.push({x: tx, y: ty});
                }
            }
            // Find exit and push last
            let exitPos = null;
            for (let ty = 0; ty < this.gridSize; ty++) {
                for (let tx = 0; tx < this.gridSize; tx++) {
                    if (this.currentMap[ty][tx] === this.tiles.EXIT) { exitPos = {x: tx, y: ty}; break; }
                }
                if (exitPos) break;
            }
            if (exitPos) targets.push(exitPos);

            if (targets.length > 0) {
                const idx = this.portalCycleIndex % targets.length;
                const dest = targets[idx];
                this.portalCycleIndex++;

                // Teleport: add trail from current position
                this.addTrailPoint(this.player.x, this.player.y, now);
                this.player.x = dest.x;
                this.player.y = dest.y;
                this.player.lastMoveTime = now;
                this.player.lastDirection = direction;
                const tileAtDest = this.currentMap[dest.y][dest.x];
                // Minimal delay to allow quick chaining during portal window
                const minStep = this.isMobile ? 90 : 25;
                this.player.moveDelay = minStep;
                if (this.soundEnabled) this.playSound(900, 80, 'triangle');
                this.handleTileInteraction(tileAtDest, dest.x, dest.y);
                return; // consume this key press
            } else {
                // No targets - fall through to normal movement
            }
        }

        // If direction changed, reduce delay for more responsive controls
        const directionChanged = this.player.lastDirection !== direction;
        let effectiveDelay = this.player.moveDelay;

        const minStep = this.isMobile ? 90 : 25;
        const minTurnStep = this.isMobile ? 110 : 50;
        if (directionChanged) {
            // Reduce delay when changing direction for more responsive feel
            effectiveDelay = Math.max(this.player.moveDelay * 0.3, minTurnStep);
        }

        if (!directionChanged && now - this.player.lastMoveTime < effectiveDelay) return;

        if (this.isValidMove(newX, newY)) {
            // Add current position to trail before moving
            this.addTrailPoint(this.player.x, this.player.y, now);

            this.player.x = newX;
            this.player.y = newY;
            this.player.lastMoveTime = now;
            this.player.lastDirection = direction;

            const currentTile = this.currentMap[newY][newX];
            let baseMoveDelay = this.tileSpeeds[currentTile] || minStep;

            // Apply powerup speedup if active
            if (now < this.player.powerupSlowdownEnd) {
                baseMoveDelay = Math.max(baseMoveDelay / 2, minStep); // Half delay but cap minimum
            }

            // Apply trap slowdown if active
            if (now < this.player.trapSlowdownEnd) {
                baseMoveDelay = baseMoveDelay * 2; // Double delay (slower movement)
            }

            this.player.moveDelay = baseMoveDelay;

            this.handleTileInteraction(currentTile, newX, newY);
        }
    }

    isValidMove(x, y) {
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) {
            return false;
        }

        const tile = this.currentMap[y][x];
        return !this.impassableTiles.includes(tile);
    }

    handleTileInteraction(tile, x, y) {
        switch (tile) {
            case this.tiles.KEY:
                this.keys++;
                this.currentMap[y][x] = this.tiles.GRASS;
                this.score += 100;
                this.playSound(880, 300, 'sine');
                break;
            case this.tiles.EXIT:
                // Count remaining keys on the map
                let remainingKeys = 0;
                for (let mapY = 0; mapY < this.gridSize; mapY++) {
                    for (let mapX = 0; mapX < this.gridSize; mapX++) {
                        if (this.currentMap[mapY][mapX] === this.tiles.KEY) {
                            remainingKeys++;
                        }
                    }
                }
                // Player can proceed if they collected all keys (no keys remaining on map)
                if (remainingKeys === 0) {
                    this.playSound(660, 500, 'triangle');
                    this.nextLevel();
                }
                break;
            case this.tiles.TRAP:
                const now = Date.now();
                if (this.player.trapImmunity > 0 && now < this.player.trapImmunity) {
                    const bonus = 150;
                    this.score += bonus;
                    this.showMagicMessage("🛡️ Imunita!", "#27ae60");
                    this.showMagicMessage("💰 Bonus +" + bonus, "#27ae60");
                    this.playSound(800, 200, 'triangle');
                } else {
                    this.timeRemaining -= 10;
                    this.score -= 1500;
                    const duration = 5000;
                    this.player.trapSlowdownEnd = Date.now() + duration;
                    this.showMagicMessage("🐌 Zpomalení aktivní!", "#e74c3c");
                    this.addMagicEffect("🐌 Zpomalení", duration);
                    this.playSound(200, 400, 'sawtooth');
                }
                this.currentMap[y][x] = this.tiles.GRASS;
                break;
            case this.tiles.TRIGGER:
                this.playSound(1200, 200, 'square');
                this.triggerEffect();
                this.currentMap[y][x] = this.tiles.GRASS;
                break;
            case this.tiles.POWERUP:
                this.score += 150;
                this.currentMap[y][x] = this.tiles.GRASS;
                this.player.powerupSlowdownEnd = Date.now() + 10000; // 10 seconds speedup
                this.showMagicMessage("⚡ Rychlost zvýšena!", "#f1c40f");
                this.addMagicEffect("⚡ Rychlost", 5000);
                this.playSound(1000, 400, 'triangle');
                break;
        }
    }

    addTrailPoint(x, y, timestamp) {
        const isSpeedActive = timestamp < this.player.powerupSlowdownEnd;
        const isSlowdownActive = timestamp < this.player.trapSlowdownEnd;
        this.playerTrail.push({
            x: x,
            y: y,
            timestamp: timestamp,
            isSpeedActive: isSpeedActive,
            isSlowdownActive: isSlowdownActive
        });

        // Keep only last 15 trail points for performance
        if (this.playerTrail.length > 15) {
            this.playerTrail.shift();
        }
    }

    updateTrail() {
        const now = Date.now();
        const maxAge = 1500; // Trail lasts 1.5 seconds

        // Remove old trail points
        this.playerTrail = this.playerTrail.filter(point =>
            now - point.timestamp < maxAge
        );
    }

    triggerEffect() {
        const effects = [
            // Časové efekty
            () => {
                this.timeRemaining += 10;
                this.showMagicMessage("🕐 +10 sekund!", "#3498db");
                this.addMagicEffect("Čas +10s", 0);
            },
            // Skóre efekty
            () => {
                this.score += 700;
                this.showMagicMessage("💰 +700 bodů!", "#f1c40f");
                this.addMagicEffect("Skóre +700", 0);
            },
            // Rychlost efekty
            () => {
                this.player.moveDelay = Math.max(50, this.player.moveDelay - 15);
                this.showMagicMessage("🏃 Rychlost zvýšena!", "#2ecc71");
                this.addMagicEffect("Rychlost zvýšena", 0);
            },
            // Teleportace k náhodnému klíči
            () => {
                const keys = [];
                for (let y = 0; y < this.gridSize; y++) {
                    for (let x = 0; x < this.gridSize; x++) {
                        if (this.currentMap[y][x] === this.tiles.KEY) {
                            keys.push({x, y});
                        }
                    }
                }
                if (keys.length > 0) {
                    const randomKey = keys[Math.floor(Math.random() * keys.length)];
                    this.player.x = Math.max(0, randomKey.x - 1);
                    this.player.y = Math.max(0, randomKey.y - 1);
                    this.showMagicMessage("🌀 Teleportace ke klíči!", "#9b59b6");
                    this.addMagicEffect("Teleportován", 0);
                } else {
                    this.score += 100;
                    this.showMagicMessage("✨ Žádný klíč k teleportaci! +200 bodů", "#e67e22");
                    this.addMagicEffect("Bonus +200", 0);
                }
            },
            // Dočasná imunita vůči pastím
            () => {
                this.player.trapImmunity = Date.now() + 10000; // 10 sekund
                this.showMagicMessage("🛡️ Imunita vůči pastím!", "#e74c3c");
                this.addMagicEffect("🛡️ Imunita past", 10000);
            },
            // Bonus za všechny sebrané klíče
            () => {
                const bonusPoints = this.keys * 350;
                this.score += bonusPoints;
                this.showMagicMessage(`🗝️ Bonus za klíče: +${bonusPoints}!`, "#f39c12");
                this.addMagicEffect("Bonus klíče", 0);
            },
            // Dočasná neviditelnost
            () => {
                const duration = 8000;
                this.player.invisibility = Date.now() + duration;
                this.showMagicMessage("👻 Neviditelnost aktivní!", "#9b59b6");
                this.addMagicEffect("👻 Neviditelnost", duration);
            }
        ];

        const effect = effects[Math.floor(Math.random() * effects.length)];
        effect();
    }

    addMagicEffect(effectName, duration) {
        const effect = {
            name: effectName,
            expiry: duration > 0 ? Date.now() + duration : 0
        };
        this.activeEffects.push(effect);
    }

    showMagicMessage(text, color) {
        const message = document.createElement('div');
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${color};
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 1000;
            font-size: 18px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: magicPulse 2s ease-out forwards;
        `;

        // Přidáme CSS animaci pro efekt
        if (!document.getElementById('magicAnimations')) {
            const style = document.createElement('style');
            style.id = 'magicAnimations';
            style.textContent = `
                @keyframes magicPulse {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(message);

        setTimeout(() => {
            if (document.body.contains(message)) {
                document.body.removeChild(message);
            }
        }, 2000);
    }

    nextLevel() {
        this.currentLevel++;
        this.score += Math.floor(this.timeRemaining * 10);
        this.keys = 0;

        if (this.currentLevel <= this.predefinedLevels.length) {
            this.currentMap = JSON.parse(JSON.stringify(this.predefinedLevels[this.currentLevel - 1]));
        } else {
            this.currentMap = this.generateProgressiveLevel(this.currentLevel);
        }

        this.timeLimit = Math.max(45, 120 - (this.currentLevel - 1) * 8);
        this.timeRemaining = this.timeLimit;
        this.gameStartTime = Date.now();  // Reset start time for new level
        this.player.x = 1;
        this.player.y = 1;
        this.player.moveDelay = 200;
        this.player.lastDirection = null;
        this.player.powerupSlowdownEnd = 0;
        this.player.trapSlowdownEnd = 0;
        this.player.trapImmunity = 0;
        this.player.invisibility = 0;
        this.activeEffects = [];
        this.playerTrail = [];

        // Removed level 20 limit - game continues indefinitely for infinite scoring
    }

    startGame() {
        this.gameState = 'playing';
        this.currentLevel = 1;
        this.score = 0;
        this.keys = 0;
        this.timeLimit = 120;
        this.timeRemaining = this.timeLimit;
        this.gameStartTime = Date.now();
        this.player.x = 1;
        this.player.y = 1;
        this.player.moveDelay = 200;
        this.player.lastDirection = null;
        this.player.powerupSlowdownEnd = 0;
        this.player.trapSlowdownEnd = 0;
        this.player.trapImmunity = 0;
        this.player.invisibility = 0;
        this.activeEffects = [];
        this.playerTrail = [];
        this.currentMap = JSON.parse(JSON.stringify(this.predefinedLevels[0]));
        document.getElementById('gameOver').style.display = 'none';
    }

    restartGame() {
        this.startGame();
    }

    regenerateLevel() {
        if (this.gameState !== 'playing') return;

        if (this.currentLevel <= this.predefinedLevels.length) {
            this.predefinedLevels[this.currentLevel - 1] = this.generateProgressiveLevel(this.currentLevel);
            this.currentMap = JSON.parse(JSON.stringify(this.predefinedLevels[this.currentLevel - 1]));
        } else {
            this.currentMap = this.generateProgressiveLevel(this.currentLevel);
        }

        this.keys = 0;
        this.player.x = 1;
        this.player.y = 1;
        this.player.moveDelay = 200;
        this.player.lastDirection = null;
        this.player.powerupSlowdownEnd = 0;
        this.player.trapSlowdownEnd = 0;
        this.player.trapImmunity = 0;
        this.player.invisibility = 0;
        this.activeEffects = [];
        this.playerTrail = [];
        this.playSound(440, 100);
    }

    gameOver() {
        this.gameState = 'gameOver';
        this.playSound(150, 800, 'sawtooth');
        document.getElementById('gameOver').style.display = 'block';
        document.getElementById('gameOverTitle').textContent = 'Čas vypršel!';
        document.getElementById('gameOverMessage').textContent = 'Nestihli jste dokončit patro včas.';
        document.getElementById('finalScore').textContent = this.score;
    }

    closeGameOver() {
        document.getElementById('gameOver').style.display = 'none';
        this.gameState = 'menu';
    }

    gameWin() {
        this.gameState = 'gameOver';
        this.playWinSound();
        document.getElementById('gameOver').style.display = 'block';
        document.getElementById('gameOverTitle').textContent = 'Vítězství!';
        document.getElementById('gameOverMessage').textContent = 'Gratulujeme! Prošli jste všechna patra!';
        document.getElementById('finalScore').textContent = this.score;
    }

    playWinSound() {
        if (!this.soundEnabled || !this.audioContext) return;

        setTimeout(() => this.playSound(523, 200), 0);
        setTimeout(() => this.playSound(659, 200), 200);
        setTimeout(() => this.playSound(784, 200), 400);
        setTimeout(() => this.playSound(1047, 400), 600);
    }

    saveScore() {
        const playerName = document.getElementById('playerNameInput').value.trim();
        if (!playerName) {
            alert('Prosím zadejte jméno');
            return;
        }

        let leaderboard = JSON.parse(localStorage.getItem('mazeGameLeaderboard')) || [];
        leaderboard.push({
            name: playerName,
            score: this.score,
            level: this.currentLevel,
            gridSize: this.gridSize,
            date: new Date().toLocaleDateString()
        });

        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 10);

        localStorage.setItem('mazeGameLeaderboard', JSON.stringify(leaderboard));
        this.updateLeaderboard();
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('playerNameInput').value = '';
    }

    updateLeaderboard() {
        const leaderboard = JSON.parse(localStorage.getItem('mazeGameLeaderboard')) || [];
        const leaderboardList = document.getElementById('leaderboardList');

        leaderboardList.innerHTML = '';
        leaderboard.forEach((entry, index) => {
            const div = document.createElement('div');
            div.className = 'leaderboard-entry';
            const gs = entry.gridSize ? `, GS ${entry.gridSize}` : '';
            div.innerHTML = `
                <span>${index + 1}. ${entry.name}</span>
                <span>${entry.score} b. (Patro ${entry.level}${gs})</span>
            `;
            leaderboardList.appendChild(div);
        });
    }

    toggleEditor() {
        // Disable editor on mobile devices
        if (this.isMobile) {
            alert('Editor není dostupný na mobilu.');
            return;
        }
        this.editorMode = !this.editorMode;
        document.getElementById('levelEditor').style.display = this.editorMode ? 'block' : 'none';

        if (this.editorMode) {
            this.gameState = 'editor';
            this.currentMap = this.generateEmptyMap();
        } else {
            this.gameState = 'menu';
        }
    }

    handleEditorClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.tileSize);
        const y = Math.floor((e.clientY - rect.top) / this.tileSize);

        if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
            this.currentMap[y][x] = this.selectedTile;
        }
    }

    clearLevel() {
        this.currentMap = this.generateEmptyMap();
    }

    saveLevel() {
        const levelName = document.getElementById('levelNameInput').value.trim() || 'level';
        const timeLimit = parseInt(prompt('Časový limit (sekundy):', '120')) || 120;

        const levelData = {
            name: levelName,
            map: this.currentMap,
            timeLimit: timeLimit,
            created: new Date().toISOString()
        };

        const dataStr = JSON.stringify(levelData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${levelName}.json`;
        link.click();

        alert(`Patro "${levelName}" bylo uloženo!`);
    }

    loadLevel() {
        document.getElementById('levelFileInput').click();

        document.getElementById('levelFileInput').onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const levelData = JSON.parse(e.target.result);
                        this.currentMap = levelData.map || levelData;
                        this.timeLimit = levelData.timeLimit || 120;

                        if (levelData.name) {
                            document.getElementById('levelNameInput').value = levelData.name;
                        }

                        alert(`Patro ${levelData.name ? `"${levelData.name}"` : ''} načteno úspěšně!`);
                    } catch (error) {
                        alert('Chyba při načítání souboru! Ujistěte se, že je soubor ve správném formátu.');
                    }
                };
                reader.readAsText(file);
            }
        };
    }

    testLevel() {
        if (!this.validateLevel()) {
            alert('Patro není validní! Ujistěte se, že obsahuje počáteční pozici (1,1), alespoň jeden klíč a jeden východ.');
            return;
        }

        this.editorMode = false;
        document.getElementById('levelEditor').style.display = 'none';
        this.gameState = 'playing';
        this.currentLevel = 1;
        this.score = 0;
        this.keys = 0;
        this.timeRemaining = this.timeLimit;
        this.gameStartTime = Date.now();
        this.player.x = 1;
        this.player.y = 1;
        this.player.moveDelay = 200;
        this.player.lastDirection = null;
        this.player.powerupSlowdownEnd = 0;
        this.player.trapSlowdownEnd = 0;
        this.player.trapImmunity = 0;
        this.player.invisibility = 0;
        this.activeEffects = [];
        this.playerTrail = [];
        document.getElementById('gameOver').style.display = 'none';
    }

    validateLevel() {
        let hasKey = false;
        let hasExit = false;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const tile = this.currentMap[y][x];
                if (tile === this.tiles.KEY) hasKey = true;
                if (tile === this.tiles.EXIT) hasExit = true;
            }
        }

        const startTile = this.currentMap[1][1];
        const canStartOn = !this.impassableTiles.includes(startTile);

        return hasKey && hasExit && canStartOn;
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('mazeGameSoundEnabled', this.soundEnabled.toString());
        this.updateSoundToggleButton();

        if (this.soundEnabled && this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.playSound(440, 100);
    }

    updateSoundToggleButton() {
        const button = document.getElementById('soundToggleBtn');
        if (button) {
            button.textContent = this.soundEnabled ? '🔊 Zvuky: ZAP' : '🔇 Zvuky: VYP';
        }
        const mSoundImg = document.querySelector('#mSoundBtn img');
        if (mSoundImg) {
            mSoundImg.src = this.soundEnabled ? 'icons/sound-on.svg' : 'icons/sound-off.svg';
        }
    }

    exportLeaderboard() {
        const leaderboard = JSON.parse(localStorage.getItem('mazeGameLeaderboard')) || [];

        if (leaderboard.length === 0) {
            alert('Žebříček je prázdný!');
            return;
        }

        const exportData = {
            leaderboard: leaderboard,
            exported: new Date().toISOString(),
            gameVersion: '1.0'
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `maze-leaderboard-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        alert('Žebříček byl exportován!');
    }

    importLeaderboard() {
        document.getElementById('leaderboardFileInput').click();

        document.getElementById('leaderboardFileInput').onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importData = JSON.parse(e.target.result);
                        let importedLeaderboard;

                        if (importData.leaderboard && Array.isArray(importData.leaderboard)) {
                            importedLeaderboard = importData.leaderboard;
                        } else if (Array.isArray(importData)) {
                            importedLeaderboard = importData;
                        } else {
                            throw new Error('Invalid format');
                        }

                        const currentLeaderboard = JSON.parse(localStorage.getItem('mazeGameLeaderboard')) || [];
                        const mergedLeaderboard = [...currentLeaderboard, ...importedLeaderboard];

                        mergedLeaderboard.sort((a, b) => b.score - a.score);
                        const uniqueLeaderboard = mergedLeaderboard.filter((entry, index, self) =>
                            index === self.findIndex(e => e.name === entry.name && e.score === entry.score && e.date === entry.date)
                        ).slice(0, 20);

                        localStorage.setItem('mazeGameLeaderboard', JSON.stringify(uniqueLeaderboard));
                        this.updateLeaderboard();

                        alert(`Importováno ${importedLeaderboard.length} záznamů! Duplicity byly odstraněny.`);
                    } catch (error) {
                        alert('Chyba při importu! Ujistěte se, že soubor je ve správném formátu.');
                    }
                };
                reader.readAsText(file);
            }
        };
    }

    clearLeaderboard() {
        if (confirm('Opravdu chcete vymazat celý žebříček? Tato akce je nevratná!')) {
            localStorage.removeItem('mazeGameLeaderboard');
            this.updateLeaderboard();
            alert('Žebříček byl vymazán!');
        }
    }

    quickSaveCurrentLevel() {
        const levelName = `patro-${this.currentLevel}-${new Date().toISOString().split('T')[0]}`;

        const levelData = {
            name: levelName,
            map: this.currentMap,
            timeLimit: this.timeLimit,
            level: this.currentLevel,
            created: new Date().toISOString()
        };

        const dataStr = JSON.stringify(levelData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${levelName}.json`;
        link.click();

        // Show temporary notification
        const notification = document.createElement('div');
        notification.textContent = `Patro "${levelName}" uloženo!`;
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #27ae60; color: white; padding: 10px; border-radius: 5px; z-index: 1000;';
        document.body.appendChild(notification);

        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }

    update() {
        if (this.gameState === 'playing') {
            const now = Date.now();
            const elapsed = Math.floor((now - this.gameStartTime) / 1000);
            this.timeRemaining = Math.max(0, this.timeLimit - elapsed);

            if (this.timeRemaining <= 0) {
                this.gameOver();
            }

            // Remove expired effects
            this.activeEffects = this.activeEffects.filter(effect =>
                effect.expiry === 0 || now < effect.expiry
            );

            // Update trail
            this.updateTrail();
        }

        // Count actual keys on the map
        let totalKeysOnMap = 0;
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.currentMap[y][x] === this.tiles.KEY) {
                    totalKeysOnMap++;
                }
            }
        }
        const totalKeysForLevel = this.keys + totalKeysOnMap;

        document.getElementById('level').textContent = this.currentLevel;
        document.getElementById('timer').textContent = this.timeRemaining;
        document.getElementById('score').textContent = this.score;
        document.getElementById('keys').textContent = `${this.keys}/${totalKeysForLevel}`;
        document.getElementById('playerSpeed').textContent = this.player.moveDelay;

        // Update magic effect display
        let magicEffectText = "Žádný";
        if (this.activeEffects.length > 0) {
            const now = Date.now();
            const effectTexts = this.activeEffects.map(effect => {
                if (effect.expiry > 0) {
                    const remainingTime = Math.ceil((effect.expiry - now) / 1000);
                    return `${effect.name} (${remainingTime}s)`;
                }
                return effect.name;
            });
            magicEffectText = effectTexts.join(", ");
        }
        document.getElementById('magicEffect').textContent = magicEffectText;

        // Update visual effects panel
        this.updateEffectsPanel();

        // Continuous input handling (mobile hold/drag)
        if (this.gameState === 'playing' && !this.editorMode && this.heldKey) {
            this.handlePlayerMovement(this.heldKey);
        }
    }

    updateEffectsPanel() {
        const panel = document.getElementById('effectsPanel');
        if (!panel) return;

        panel.innerHTML = '';

        const now = Date.now();

        // Check for active player effects
        const playerEffects = [];

        // Speed effect
        if (this.player.powerupSlowdownEnd > now) {
            const remainingTime = Math.ceil((this.player.powerupSlowdownEnd - now) / 1000);
            playerEffects.push({
                name: 'Rychlost',
                time: remainingTime,
                class: 'speed',
                icon: 'icon-speed'
            });
        }

        // Slowdown effect
        if (this.player.trapSlowdownEnd > now) {
            const remainingTime = Math.ceil((this.player.trapSlowdownEnd - now) / 1000);
            playerEffects.push({
                name: 'Zpomalení',
                time: remainingTime,
                class: 'slowdown',
                icon: 'icon-slowdown'
            });
        }

        // Immunity effect
        if (this.player.trapImmunity > now) {
            const remainingTime = Math.ceil((this.player.trapImmunity - now) / 1000);
            playerEffects.push({
                name: 'Imunita',
                time: remainingTime,
                class: 'immunity',
                icon: 'icon-shield'
            });
        }

        // Invisibility effect
        if (this.player.invisibility > now) {
            const remainingTime = Math.ceil((this.player.invisibility - now) / 1000);
            playerEffects.push({
                name: 'Neviditelnost',
                time: remainingTime,
                class: 'invisibility',
                icon: 'icon-invisibility'
            });
        }

        // Create badges for each effect
        playerEffects.forEach(effect => {
            const badge = document.createElement('span');
            badge.className = `effect-badge ${effect.class}`;

            // Create SVG icon
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.setAttribute('viewBox', '0 0 16 16');
            svg.style.marginRight = '4px';
            svg.style.verticalAlign = 'middle';

            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${effect.icon}`);
            svg.appendChild(use);

            badge.appendChild(svg);
            badge.appendChild(document.createTextNode(`${effect.name} ${effect.time}s`));
            panel.appendChild(badge);
        });

        // Show "Žádné efekty" if no effects are active
        if (playerEffects.length === 0) {
            const noBadge = document.createElement('span');
            noBadge.style.color = '#bdc3c7';
            noBadge.style.fontStyle = 'italic';
            noBadge.textContent = 'Žádné aktivní efekty';
            panel.appendChild(noBadge);
        }
    }

    render() {
        // Clear canvas efficiently
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Performance optimization: Batch similar operations and minimize state changes
        // Draw each tile using cached canvases for better performance
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const tile = this.currentMap[y][x];

                // Use cached canvas if available, otherwise fall back to basic rendering
                const cachedCanvas = this.tileCanvases[tile];
                if (cachedCanvas) {
                    // Optimized: Use cached pre-rendered tiles
                    this.ctx.drawImage(
                        cachedCanvas,
                        x * this.tileSize,
                        y * this.tileSize
                    );
                } else {
                    // Fallback rendering if cache not ready
                    this.ctx.fillStyle = this.tileColors[tile];
                    this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);

                    this.ctx.strokeStyle = '#2c3e50';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
                }
            }
        }

        // Render player trail
        if (this.gameState === 'playing' && this.playerTrail.length > 0) {
            const now = Date.now();
            const maxAge = 1500;

            this.playerTrail.forEach(point => {
                const age = now - point.timestamp;
                const opacity = Math.max(0, 1 - (age / maxAge));

                if (opacity > 0) {
                    const size = this.tileSize * 0.6 * opacity;
                    const x = point.x * this.tileSize + this.tileSize / 2;
                    const y = point.y * this.tileSize + this.tileSize / 2;

                    // Different colors for effects
                    if (point.isSpeedActive) {
                        // Colorful gradient for speed trail
                        const hue = (age / 50) % 360; // Cycling rainbow
                        this.ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${opacity * 0.8})`;
                    } else if (point.isSlowdownActive) {
                        // Red trail for slowdown
                        this.ctx.fillStyle = `rgba(231, 76, 60, ${opacity * 0.7})`;
                    } else {
                        // Normal trail - soft blue
                        this.ctx.fillStyle = `rgba(52, 152, 219, ${opacity * 0.6})`;
                    }

                    this.ctx.beginPath();
                    this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            });
        }

        // Render player (always on top)
        if (this.gameState === 'playing' || this.gameState === 'editor') {
            const now = Date.now();
            let playerOpacity = 1;

            // Check if player is invisible (but keep them visible enough to see)
            if (this.player.invisibility > 0 && now < this.player.invisibility) {
                playerOpacity = 0.05;
            }

            this.ctx.save();
            this.ctx.globalAlpha = playerOpacity;

            // Draw player SVG icon if loaded
            if (this.playerImage && this.playerImage.complete) {
                this.ctx.drawImage(
                    this.playerImage,
                    this.player.x * this.tileSize,
                    this.player.y * this.tileSize,
                    this.tileSize,
                    this.tileSize
                );
            } else {
                // Fallback: Draw player as a simple circle with eyes (chick-like)
                const centerX = this.player.x * this.tileSize + this.tileSize / 2;
                const centerY = this.player.y * this.tileSize + this.tileSize / 2;
                const radius = this.tileSize * 0.3;

                // Body
                this.ctx.fillStyle = '#ffd700'; // Gold color
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Eyes
                this.ctx.fillStyle = '#000000';
                this.ctx.beginPath();
                this.ctx.arc(centerX - radius * 0.3, centerY - radius * 0.2, radius * 0.15, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(centerX + radius * 0.3, centerY - radius * 0.2, radius * 0.15, 0, Math.PI * 2);
                this.ctx.fill();

                // Beak
                this.ctx.fillStyle = '#ff8c00';
                this.ctx.beginPath();
                this.ctx.moveTo(centerX, centerY);
                this.ctx.lineTo(centerX - radius * 0.2, centerY + radius * 0.3);
                this.ctx.lineTo(centerX + radius * 0.2, centerY + radius * 0.3);
                this.ctx.fill();
            }

            this.ctx.restore();
        }
    }

    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new MazeGame();
    game.updateLeaderboard();
});