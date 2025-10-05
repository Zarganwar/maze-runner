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
            moveDelay: 25
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
            TRIGGER: 10
        };

        this.tileColors = {
            [this.tiles.WALL]: '#34495e',
            [this.tiles.GRASS]: '#27ae60',
            [this.tiles.SNOW]: '#ecf0f1',
            [this.tiles.WATER]: '#3498db',
            [this.tiles.STONE]: '#7f8c8d',
            [this.tiles.SAND]: '#f39c12',
            [this.tiles.TREE]: '#228b22',
            [this.tiles.KEY]: '#f1c40f',
            [this.tiles.EXIT]: '#e74c3c',
            [this.tiles.TRAP]: '#8e44ad',
            [this.tiles.TRIGGER]: '#e67e22'
        };

        this.tileSpeeds = {
            [this.tiles.GRASS]: 50,
            [this.tiles.SNOW]: 400,
            [this.tiles.STONE]: 1500,
            [this.tiles.SAND]: 400,
            [this.tiles.KEY]: 200,
            [this.tiles.EXIT]: 200,
            [this.tiles.TRAP]: 1000,
            [this.tiles.TRIGGER]: 200
        };

        this.impassableTiles = [this.tiles.WALL, this.tiles.WATER, this.tiles.TREE];

        this.currentMap = this.generateEmptyMap();
        this.predefinedLevels = this.createPredefinedLevels();

        this.editorMode = false;
        this.selectedTile = this.tiles.WALL;

        this.setupEventListeners();
        this.setupUI();
        this.gameLoop();
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
        return [
            this.generateMaze(60, this.tiles.GRASS, this.tiles.WALL),
            this.generateMaze(50, this.tiles.SNOW, this.tiles.TREE),
            this.generateMaze(40, this.tiles.SAND, this.tiles.STONE),
            this.generateMaze(35, this.tiles.GRASS, this.tiles.WATER),
            this.generateMaze(30, this.tiles.STONE, this.tiles.WALL)
        ];
    }

    generateMaze(complexity = 50, floorTile = this.tiles.GRASS, wallTile = this.tiles.WALL) {
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

        const keyX = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
        const keyY = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
        map[keyY][keyX] = this.tiles.KEY;

        const exitX = this.gridSize - 2;
        const exitY = this.gridSize - 2;
        map[exitY][exitX] = this.tiles.EXIT;

        const numTraps = Math.floor(Math.random() * 5) + 2;
        for (let i = 0; i < numTraps; i++) {
            const trapX = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
            const trapY = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
            if (map[trapY][trapX] === floorTile) {
                map[trapY][trapX] = this.tiles.TRAP;
            }
        }

        return map;
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (this.gameState === 'playing' && !this.editorMode) {
                this.handlePlayerMovement(e.key);
            }
        });

        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('editorBtn').addEventListener('click', () => this.toggleEditor());
        document.getElementById('saveScoreBtn').addEventListener('click', () => this.saveScore());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.restartGame());

        document.getElementById('clearLevelBtn').addEventListener('click', () => this.clearLevel());
        document.getElementById('saveLevelBtn').addEventListener('click', () => this.saveLevel());
        document.getElementById('loadLevelBtn').addEventListener('click', () => this.loadLevel());
        document.getElementById('closeEditorBtn').addEventListener('click', () => this.toggleEditor());

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
            { type: this.tiles.TRAP, name: 'Past' }
        ];

        tileTypes.forEach(tile => {
            const btn = document.createElement('div');
            btn.className = 'tile-btn';
            btn.style.backgroundColor = this.tileColors[tile.type];
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
            this.player.moveDelay = this.tileSpeeds[currentTile] || 200;

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
                break;
            case this.tiles.EXIT:
                if (this.keys >= this.keysRequired) {
                    this.nextLevel();
                }
                break;
            case this.tiles.TRAP:
                this.timeRemaining -= 10;
                this.score -= 50;
                this.currentMap[y][x] = this.tiles.GRASS;
                break;
            case this.tiles.TRIGGER:
                this.triggerEffect();
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
            this.timeLimit = Math.max(60, 120 - (this.currentLevel - 1) * 15);
            this.timeRemaining = this.timeLimit;
            this.player.x = 1;
            this.player.y = 1;
            this.player.moveDelay = 200;
        } else {
            this.gameWin();
        }
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
        this.currentMap = JSON.parse(JSON.stringify(this.predefinedLevels[0]));
        document.getElementById('gameOver').style.display = 'none';
    }

    restartGame() {
        this.startGame();
    }

    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('gameOver').style.display = 'block';
        document.getElementById('gameOverTitle').textContent = 'Čas vypršel!';
        document.getElementById('gameOverMessage').textContent = 'Nestihli jste dokončit patro včas.';
        document.getElementById('finalScore').textContent = this.score;
    }

    gameWin() {
        this.gameState = 'gameOver';
        document.getElementById('gameOver').style.display = 'block';
        document.getElementById('gameOverTitle').textContent = 'Vítězství!';
        document.getElementById('gameOverMessage').textContent = 'Gratulujeme! Prošli jste všechna patra!';
        document.getElementById('finalScore').textContent = this.score;
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
        const levelData = {
            map: this.currentMap,
            timeLimit: parseInt(prompt('Časový limit (sekundy):', '120')) || 120
        };

        const dataStr = JSON.stringify(levelData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'level.json';
        link.click();
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
                        this.currentMap = levelData.map;
                        this.timeLimit = levelData.timeLimit || 120;
                        alert('Patro načteno úspěšně!');
                    } catch (error) {
                        alert('Chyba při načítání souboru!');
                    }
                };
                reader.readAsText(file);
            }
        };
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

        document.getElementById('level').textContent = this.currentLevel;
        document.getElementById('timer').textContent = this.timeRemaining;
        document.getElementById('score').textContent = this.score;
        document.getElementById('keys').textContent = `${this.keys}/${this.keysRequired}`;
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
            }
        }

        if (this.gameState === 'playing' || this.gameState === 'editor') {
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(
                this.player.x * this.tileSize + 2,
                this.player.y * this.tileSize + 2,
                this.tileSize - 4,
                this.tileSize - 4
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