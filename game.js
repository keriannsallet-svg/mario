const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const MOVE_SPEED = 5;
const FRICTION = 0.8;

const TILE_SIZE = 40;
const MAP_WIDTH = 50;
const MAP_HEIGHT = 12;

let gameRunning = false;
let score = 0;
let lives = 3;
let timer = 300;
let timerInterval;
let cameraX = 0;
let frameCount = 0;

// Carte du niveau (0=vide, 1=sol, 2=brique, 3=bloc ?, 4=tuyau, 5=plateforme)
const levelMap = generateLevel();

function generateLevel() {
    const map = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        map[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (y >= MAP_HEIGHT - 2) {
                map[y][x] = 1;
            } else {
                map[y][x] = 0;
            }
        }
    }

    // Plateformes et obstacles
    const platforms = [
        { x: 5, y: 8, w: 4, type: 2 },
        { x: 12, y: 6, w: 3, type: 2 },
        { x: 18, y: 8, w: 5, type: 1 },
        { x: 26, y: 5, w: 3, type: 2 },
        { x: 30, y: 8, w: 6, type: 1 },
        { x: 38, y: 6, w: 4, type: 2 },
        { x: 44, y: 7, w: 3, type: 2 },
    ];

    platforms.forEach(p => {
        for (let x = p.x; x < p.x + p.w && x < MAP_WIDTH; x++) {
            map[p.y][x] = p.type;
        }
    });

    // Blocs interrogatifs
    [8, 14, 22, 28, 35, 40, 46].forEach(x => {
        map[MAP_HEIGHT - 5][x] = 3;
    });

    // Trous au sol
    [10, 25, 42].forEach(x => {
        map[MAP_HEIGHT - 2][x] = 0;
        map[MAP_HEIGHT - 1][x] = 0;
    });

    return map;
}

// Joueur
const player = {
    x: 100,
    y: 200,
    width: 32,
    height: 40,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    frame: 0,
    moving: false
};

// Pièces
let coins = [];
function spawnCoins() {
    coins = [];
    const coinPositions = [
        { x: 200, y: 280 }, { x: 280, y: 200 }, { x: 400, y: 280 },
        { x: 500, y: 180 }, { x: 600, y: 280 }, { x: 750, y: 200 },
        { x: 850, y: 280 }, { x: 1000, y: 160 }, { x: 1200, y: 280 },
        { x: 1400, y: 200 }, { x: 1600, y: 280 }, { x: 1800, y: 180 },
        { x: 2000, y: 280 }, { x: 2200, y: 200 }, { x: 2400, y: 280 }
    ];
    coinPositions.forEach(pos => {
        coins.push({ x: pos.x, y: pos.y, radius: 8, collected: false, animFrame: Math.random() * 4 });
    });
}

// Ennemis (Goomba-like)
let enemies = [];
function spawnEnemies() {
    enemies = [];
    const enemyPositions = [
        { x: 400 }, { x: 700 }, { x: 1100 }, { x: 1500 },
        { x: 1900 }, { x: 2200 }
    ];
    enemyPositions.forEach(pos => {
        enemies.push({
            x: pos.x,
            y: MAP_HEIGHT * TILE_SIZE - TILE_SIZE * 2 - 32,
            width: 32,
            height: 32,
            vx: -1.5,
            alive: true,
            frame: 0,
            startX: pos.x,
            range: 150
        });
    });
}

// Particules
let particles = [];

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            life: 30 + Math.random() * 20,
            color,
            size: 3 + Math.random() * 4
        });
    }
}

// Contrôles
const keys = {};
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', e => {
    keys[e.code] = false;
});

// Physique
function updatePlayer() {
    // Friction en premier (décélération quand pas d'input)
    player.vx *= FRICTION;
    if (Math.abs(player.vx) < 0.1) {
        player.vx = 0;
        player.moving = false;
    }

    // Mouvement horizontal (accélération APRES friction)
    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.vx -= 1.2;
        player.facing = -1;
        player.moving = true;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        player.vx += 1.2;
        player.facing = 1;
        player.moving = true;
    }

    // Saut
    if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && player.onGround) {
        player.vy = JUMP_FORCE;
        player.onGround = false;
        createParticles(player.x + player.width / 2, player.y + player.height, '#aaa', 5);
    }

    // Gravité
    player.vy += GRAVITY;

    // Limiter la vitesse
    player.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, player.vx));
    player.vy = Math.min(15, player.vy);

    // Collision X
    player.x += player.vx;
    resolveCollisionX();

    // Collision Y
    player.y += player.vy;
    player.onGround = false;
    resolveCollisionY();

    // Animation
    if (player.moving && player.onGround) {
        player.frame += 0.2;
    } else {
        player.frame = 0;
    }

    // Limites du monde
    if (player.x < 0) player.x = 0;
    if (player.x > MAP_WIDTH * TILE_SIZE - player.width) {
        player.x = MAP_WIDTH * TILE_SIZE - player.width;
    }

    // Chute dans le vide
    if (player.y > canvas.height + 100) {
        loseLife();
    }
}

function getTile(x, y) {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return 0;
    return levelMap[ty][tx];
}

function resolveCollisionX() {
    const top = player.y + 1;
    const bottom = player.y + player.height - 1;
    const left = player.x;
    const right = player.x + player.width - 1;

    for (let y = Math.floor(top / TILE_SIZE); y <= Math.floor(bottom / TILE_SIZE); y++) {
        for (let x = Math.floor(left / TILE_SIZE); x <= Math.floor(right / TILE_SIZE); x++) {
            const tile = getTile(x * TILE_SIZE, y * TILE_SIZE);
            if (tile > 0) {
                if (player.vx > 0) {
                    player.x = x * TILE_SIZE - player.width;
                    player.vx = 0;
                } else if (player.vx < 0) {
                    player.x = (x + 1) * TILE_SIZE;
                    player.vx = 0;
                }
            }
        }
    }
}

function resolveCollisionY() {
    const left = player.x + 1;
    const right = player.x + player.width - 1;
    const top = player.y;
    const bottom = player.y + player.height - 1;

    for (let y = Math.floor(top / TILE_SIZE); y <= Math.floor(bottom / TILE_SIZE); y++) {
        for (let x = Math.floor(left / TILE_SIZE); x <= Math.floor(right / TILE_SIZE); x++) {
            const tile = getTile(x * TILE_SIZE, y * TILE_SIZE);
            if (tile > 0) {
                if (player.vy > 0) {
                    player.y = y * TILE_SIZE - player.height;
                    player.vy = 0;
                    player.onGround = true;
                } else if (player.vy < 0) {
                    player.y = (y + 1) * TILE_SIZE;
                    player.vy = 0;
                    // Frapper un bloc ?
                    if (tile === 3) {
                        levelMap[y][x] = 0;
                        score += 50;
                        createParticles(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE, '#f1c40f', 8);
                    }
                }
            }
        }
    }
}

// Ennemis
function updateEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive) return;

        enemy.x += enemy.vx;
        enemy.frame += 0.15;

        // Patrouille
        if (enemy.x < enemy.startX - enemy.range || enemy.x > enemy.startX + enemy.range) {
            enemy.vx *= -1;
        }

        // Collision avec le sol
        const onGround = getTile(enemy.x + enemy.width / 2, enemy.y + enemy.height + 2) > 0;
        if (!onGround) {
            enemy.x -= enemy.vx;
            enemy.vx *= -1;
        }

        // Collision avec le joueur
        if (player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {

            // Saut sur l'ennemi
            if (player.vy > 0 && player.y + player.height - enemy.y < 20) {
                enemy.alive = false;
                player.vy = JUMP_FORCE * 0.7;
                score += 100;
                createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#e74c3c', 10);
            } else {
                loseLife();
            }
        }
    });
}

// Pièces
function updateCoins() {
    coins.forEach(coin => {
        if (coin.collected) return;
        coin.animFrame += 0.08;

        const dx = (player.x + player.width / 2) - coin.x;
        const dy = (player.y + player.height / 2) - coin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 30) {
            coin.collected = true;
            score += 10;
            createParticles(coin.x, coin.y, '#f1c40f', 6);
        }
    });
}

// Particules
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Caméra
function updateCamera() {
    const targetX = player.x - canvas.width / 3;
    cameraX += (targetX - cameraX) * 0.1;
    cameraX = Math.max(0, Math.min(MAP_WIDTH * TILE_SIZE - canvas.width, cameraX));
}

// Vies
function loseLife() {
    lives--;
    document.getElementById('lives').textContent = lives;
    if (lives <= 0) {
        gameOver();
    } else {
        respawn();
    }
}

function respawn() {
    player.x = Math.max(100, cameraX + 100);
    player.y = 100;
    player.vx = 0;
    player.vy = 0;
}

// Rendu
function draw() {
    // Ciel dégradé
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.6, '#98d8f0');
    gradient.addColorStop(1, '#b8e8b0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Nuages
    drawClouds();

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Tuiles
    drawTiles();

    // Pièces
    drawCoins();

    // Ennemis
    drawEnemies();

    // Joueur
    drawPlayer();

    // Particules
    drawParticles();

    ctx.restore();
}

function drawClouds() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const cloudOffset = (cameraX * 0.3) % (canvas.width + 200);

    for (let i = 0; i < 5; i++) {
        const cx = ((i * 250 - cloudOffset) % (canvas.width + 200)) - 100;
        const cy = 40 + (i % 3) * 50;
        drawCloud(cx, cy, 40 + (i % 2) * 20);
    }
}

function drawCloud(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.8, y, size * 0.45, 0, Math.PI * 2);
    ctx.arc(x + size * 0.4, y + size * 0.15, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
}

function drawTiles() {
    const startX = Math.floor(cameraX / TILE_SIZE);
    const endX = Math.ceil((cameraX + canvas.width) / TILE_SIZE);

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = startX; x <= endX; x++) {
            if (x < 0 || x >= MAP_WIDTH) continue;
            const tile = levelMap[y][x];
            if (tile === 0) continue;

            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;

            if (tile === 1) {
                // Herbe
                ctx.fillStyle = '#4a7c23';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#6db33f';
                ctx.fillRect(px, py, TILE_SIZE, 8);
                ctx.fillStyle = '#3d6b1c';
                for (let i = 0; i < 3; i++) {
                    ctx.fillRect(px + 4 + i * 14, py + 12, 6, 4);
                }
            } else if (tile === 2) {
                // Brique
                ctx.fillStyle = '#c0392b';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#922b21';
                ctx.fillRect(px, py + TILE_SIZE / 2 - 1, TILE_SIZE, 2);
                ctx.fillRect(px + TILE_SIZE / 2 - 1, py, 2, TILE_SIZE / 2);
                ctx.fillRect(px + TILE_SIZE / 4 - 1, py + TILE_SIZE / 2, 2, TILE_SIZE / 2);
                ctx.fillRect(px + TILE_SIZE * 3 / 4 - 1, py + TILE_SIZE / 2, 2, TILE_SIZE / 2);
            } else if (tile === 3) {
                // Bloc ?
                ctx.fillStyle = '#f39c12';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#d68910';
                ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px monospace';
                ctx.fillText('?', px + 14, py + 26);
            }
        }
    }
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;

    ctx.save();
    ctx.translate(px + player.width / 2, py);
    ctx.scale(player.facing, 1);
    ctx.translate(-player.width / 2, 0);

    // Corps
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(4, 12, 24, 20);

    // Tête
    ctx.fillStyle = '#fdbcb4';
    ctx.fillRect(8, 0, 16, 14);

    // Chapeau
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(4, -2, 24, 8);
    ctx.fillRect(2, 4, 28, 4);

    // Œil
    ctx.fillStyle = '#000';
    ctx.fillRect(18, 6, 4, 4);

    // Moustache
    ctx.fillStyle = '#4a2c0a';
    ctx.fillRect(16, 12, 12, 3);

    // Bras
    ctx.fillStyle = '#e74c3c';
    const armOffset = player.moving && player.onGround ? Math.sin(player.frame * 2) * 3 : 0;
    ctx.fillRect(-2, 14 + armOffset, 6, 10);
    ctx.fillRect(28, 14 - armOffset, 6, 10);

    // Jambes
    ctx.fillStyle = '#2c3e50';
    const legOffset = player.moving && player.onGround ? Math.sin(player.frame * 2) * 4 : 0;
    if (!player.onGround) {
        ctx.fillRect(6, 32, 8, 8);
        ctx.fillRect(18, 32, 8, 8);
    } else {
        ctx.fillRect(6, 32 + legOffset, 8, 8 - legOffset);
        ctx.fillRect(18, 32 - legOffset, 8, 8 + legOffset);
    }

    ctx.restore();
}

function drawCoins() {
    coins.forEach(coin => {
        if (coin.collected) return;

        const bounce = Math.sin(coin.animFrame) * 3;

        ctx.save();
        ctx.translate(coin.x, coin.y + bounce);

        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f7dc6f';
        ctx.beginPath();
        ctx.arc(-2, -2, coin.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#b7950b';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 3);

        ctx.restore();
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive) return;

        const bounce = Math.abs(Math.sin(enemy.frame)) * 2;

        ctx.save();
        ctx.translate(enemy.x, enemy.y + bounce);

        // Corps
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(2, 8, 28, 22);

        // Tête
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(4, 0, 24, 14);

        // Yeux
        ctx.fillStyle = '#fff';
        ctx.fillRect(8, 4, 6, 6);
        ctx.fillRect(18, 4, 6, 6);
        ctx.fillStyle = '#000';
        ctx.fillRect(10, 6, 3, 3);
        ctx.fillRect(20, 6, 3, 3);

        // Sourcils
        ctx.fillStyle = '#000';
        ctx.fillRect(7, 2, 8, 2);
        ctx.fillRect(17, 2, 8, 2);

        // Pieds
        ctx.fillStyle = '#5d3a1a';
        const footOffset = Math.sin(enemy.frame * 2) * 2;
        ctx.fillRect(2 + footOffset, 30, 10, 2);
        ctx.fillRect(20 - footOffset, 30, 10, 2);

        ctx.restore();
    });
}

function drawParticles() {
    particles.forEach(p => {
        const alpha = p.life / 40;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

// Boucle de jeu
function gameLoop() {
    if (!gameRunning) return;

    frameCount++;

    updatePlayer();
    updateEnemies();
    updateCoins();
    updateParticles();
    updateCamera();
    draw();

    document.getElementById('score').textContent = score;

    requestAnimationFrame(gameLoop);
}

// Timer
function startTimer() {
    timerInterval = setInterval(() => {
        timer--;
        document.getElementById('timer').textContent = timer;
        if (timer <= 0) {
            gameOver();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function startGame() {
    gameRunning = true;
    score = 0;
    lives = 3;
    timer = 300;
    cameraX = 0;
    particles = [];

    player.x = 100;
    player.y = 200;
    player.vx = 0;
    player.vy = 0;

    spawnCoins();
    spawnEnemies();

    document.getElementById('score').textContent = '0';
    document.getElementById('lives').textContent = '3';
    document.getElementById('timer').textContent = '300';
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');

    startTimer();
    gameLoop();
}

function gameOver() {
    gameRunning = false;
    stopTimer();
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
