class MazeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 32;
        this.tileSize = 20;

        this.gameState = 'menu';
        this.currentLevel = 1;
        this.score = 0;
        this.timeLimit = 120;
        this.timeRemaining = this.timeLimit;
        this.gameStartTime = 0;
        this.keys = 0;
        this.keysRequired = 1;

        this.player = {
            x: 1,
            y: 1,
            moveSpeed: 1,
            lastMoveTime: 0,
            moveDelay: 25,
            powerupSlowdownEnd: 0
        };

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

        this.tileColors = {
            [this.tiles.WALL]: '#34495e',
            [this.tiles.GRASS]: '#57b037',
            [this.tiles.SNOW]: '#ecf0f155',
            [this.tiles.WATER]: '#3498db55',
            [this.tiles.STONE]: '#7f8c8d55',
            [this.tiles.SAND]: '#f39c1255',
            [this.tiles.TREE]: '#228b2255',
            [this.tiles.KEY]: '#f1c40f55',
            [this.tiles.EXIT]: '#e74c3c55',
            [this.tiles.TRAP]: '#8e44ad55',
            [this.tiles.TRIGGER]: '#e67e2255',
            [this.tiles.POWERUP]: '#ffd70055'
        };

        this.tileEmojis = {
            [this.tiles.WALL]: '⬛',
            [this.tiles.GRASS]: '',
            [this.tiles.SNOW]: '❄️',
            [this.tiles.WATER]: '🌊',
            [this.tiles.STONE]: '🗿',
            [this.tiles.SAND]: '🏖️',
            [this.tiles.TREE]: '🌳',
            [this.tiles.KEY]: '🗝️',
            [this.tiles.EXIT]: '🚪',
            [this.tiles.TRAP]: '🕳️',
            [this.tiles.TRIGGER]: '⚡',
            [this.tiles.POWERUP]: '⚡'
        };

        this.tileSpeeds = {
            [this.tiles.GRASS]: 25,
            [this.tiles.SNOW]: 200,
            [this.tiles.STONE]: 1500,
            [this.tiles.SAND]: 200,
            [this.tiles.KEY]: 200,
            [this.tiles.EXIT]: 200,
            [this.tiles.TRAP]: 1000,
            [this.tiles.TRIGGER]: 200,
            [this.tiles.POWERUP]: 200
        };

        this.impassableTiles = [this.tiles.WALL, this.tiles.WATER, this.tiles.TREE];

        this.currentMap = this.generateEmptyMap();
        this.predefinedLevels = this.createPredefinedLevels();

        this.editorMode = false;
        this.selectedTile = this.tiles.WALL;

        this.soundEnabled = localStorage.getItem('mazeGameSoundEnabled') !== 'false';
        this.initSounds();

        this.setupEventListeners();
        this.setupUI();
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
        const wallTiles = [this.tiles.WALL, this.tiles.TREE, this.tiles.WATER];

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
        this.keysRequired = numKeys;

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
            if (this.gameState === 'playing' && !this.editorMode) {
                // Quick save level with 'S' key
                if (e.key === 's' || e.key === 'S') {
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
            { type: this.tiles.POWERUP, name: 'Powerup' }
        ];

        tileTypes.forEach(tile => {
            const btn = document.createElement('div');
            btn.className = 'tile-btn';
            btn.style.backgroundColor = this.tileColors[tile.type];
            btn.style.fontSize = '20px';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.textContent = this.tileEmojis[tile.type] || '';
            btn.title = tile.name;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tile-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedTile = tile.type;
            });
            tileSelector.appendChild(btn);
        });

        tileSelector.children[0].classList.add('selected');
    }

    handlePlayerMovement(key) {
        const now = Date.now();
        if (now - this.player.lastMoveTime < this.player.moveDelay) return;

        let newX = this.player.x;
        let newY = this.player.y;

        switch (key) {
            case 'ArrowUp':
                newY--;
                break;
            case 'ArrowDown':
                newY++;
                break;
            case 'ArrowLeft':
                newX--;
                break;
            case 'ArrowRight':
                newX++;
                break;
            default:
                return;
        }

        if (this.isValidMove(newX, newY)) {
            this.player.x = newX;
            this.player.y = newY;
            this.player.lastMoveTime = now;

            const currentTile = this.currentMap[newY][newX];
            let baseMoveDelay = this.tileSpeeds[currentTile] || 200;

            // Apply powerup slowdown if active
            if (now < this.player.powerupSlowdownEnd) {
                baseMoveDelay = Math.max(baseMoveDelay * 2, 100); // Double delay but cap minimum
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
                this.timeRemaining -= 10;
                this.score -= 50;
                this.currentMap[y][x] = this.tiles.GRASS;
                this.playSound(200, 400, 'sawtooth');
                break;
            case this.tiles.TRIGGER:
                this.playSound(1200, 200, 'square');
                this.triggerEffect();
                break;
            case this.tiles.POWERUP:
                this.score += 150;
                this.currentMap[y][x] = this.tiles.GRASS;
                this.player.powerupSlowdownEnd = Date.now() + 8000; // 8 seconds slowdown
                this.playSound(1000, 400, 'triangle');
                break;
        }
    }

    triggerEffect() {
        const effects = [
            () => { this.timeRemaining += 15; },
            () => { this.score += 50; },
            () => { this.player.moveDelay = Math.max(100, this.player.moveDelay - 50); }
        ];

        const effect = effects[Math.floor(Math.random() * effects.length)];
        effect();
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
        this.player.powerupSlowdownEnd = 0;

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
        this.player.powerupSlowdownEnd = 0;
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
        this.player.powerupSlowdownEnd = 0;
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
            div.innerHTML = `
                <span>${index + 1}. ${entry.name}</span>
                <span>${entry.score} b. (Patro ${entry.level})</span>
            `;
            leaderboardList.appendChild(div);
        });
    }

    toggleEditor() {
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
        this.player.powerupSlowdownEnd = 0;
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
        const totalKeys = this.keys + totalKeysOnMap;

        document.getElementById('level').textContent = this.currentLevel;
        document.getElementById('timer').textContent = this.timeRemaining;
        document.getElementById('score').textContent = this.score;
        document.getElementById('keys').textContent = `${this.keys}/${totalKeys}`;
    }

    render() {
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const tile = this.currentMap[y][x];
                this.ctx.fillStyle = this.tileColors[tile];
                this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);

                this.ctx.strokeStyle = '#2c3e50';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);

                const emoji = this.tileEmojis[tile];
                if (emoji) {
                    this.ctx.font = `${this.tileSize * 0.7}px serif`;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(
                        emoji,
                        x * this.tileSize + this.tileSize / 2,
                        y * this.tileSize + this.tileSize / 2
                    );
                }
            }
        }

        if (this.gameState === 'playing' || this.gameState === 'editor') {
            this.ctx.font = `${this.tileSize * 0.8}px serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                '🔴',
                this.player.x * this.tileSize + this.tileSize / 2,
                this.player.y * this.tileSize + this.tileSize / 2
            );
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