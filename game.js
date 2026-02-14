"use strict";
/** Asteroids — classic arcade game built with HTML5 Canvas */
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const WIDTH = 900;
const HEIGHT = 600;
const SHIP_SIZE = 14;
const SHIP_THRUST = 0.12;
const SHIP_FRICTION = 0.99;
const SHIP_TURN_SPEED = 0.07;
const BULLET_SPEED = 7;
const BULLET_LIFETIME = 55;
const MAX_BULLETS = 8;
const ASTEROID_SPEED_MIN = 0.4;
const ASTEROID_SPEED_MAX = 1.8;
const ASTEROID_SIZES = [40, 20, 10];
const ASTEROID_SCORES = [20, 50, 100];
const STARTING_LIVES = 3;
const INVINCIBLE_FRAMES = 120;
const PARTICLE_COUNT = 8;
const PARTICLE_LIFETIME = 30;
const STAR_COUNT = 120;
// Colors — phosphor green CRT aesthetic
const CLR_SHIP = "#00ff88";
const CLR_THRUST = "#ff8800";
const CLR_BULLET = "#ffffff";
const CLR_ASTEROID = "#00cc66";
const CLR_TEXT = "#00ff88";
const CLR_DIM = "#005533";
const CLR_PARTICLE = "#00ffaa";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function wrap(pos) {
    if (pos.x < 0)
        pos.x += WIDTH;
    if (pos.x > WIDTH)
        pos.x -= WIDTH;
    if (pos.y < 0)
        pos.y += HEIGHT;
    if (pos.y > HEIGHT)
        pos.y -= HEIGHT;
}
function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
function rand(min, max) {
    return Math.random() * (max - min) + min;
}
function makeAsteroidVertices() {
    const count = 9 + Math.floor(Math.random() * 5);
    const verts = [];
    for (let i = 0; i < count; i++) {
        verts.push(0.7 + Math.random() * 0.4);
    }
    return verts;
}
function createAsteroid(x, y, sizeIndex) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(ASTEROID_SPEED_MIN, ASTEROID_SPEED_MAX);
    return {
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        radius: ASTEROID_SIZES[sizeIndex],
        sizeIndex,
        vertices: makeAsteroidVertices(),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: rand(-0.02, 0.02),
    };
}
function spawnAsteroids(level) {
    const count = 3 + level;
    const asteroids = [];
    for (let i = 0; i < count; i++) {
        // Spawn away from center where ship starts
        let x, y;
        do {
            x = Math.random() * WIDTH;
            y = Math.random() * HEIGHT;
        } while (dist({ x, y }, { x: WIDTH / 2, y: HEIGHT / 2 }) < 150);
        asteroids.push(createAsteroid(x, y, 0));
    }
    return asteroids;
}
function createShip() {
    return {
        pos: { x: WIDTH / 2, y: HEIGHT / 2 },
        vel: { x: 0, y: 0 },
        angle: -Math.PI / 2,
        thrusting: false,
        invincible: INVINCIBLE_FRAMES,
    };
}
function createStars() {
    return Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        brightness: rand(0.2, 0.7),
        twinkleSpeed: rand(0.01, 0.04),
        twinkleOffset: Math.random() * Math.PI * 2,
    }));
}
function spawnParticles(x, y, count, speed) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const s = rand(speed * 0.3, speed);
        const life = Math.floor(rand(PARTICLE_LIFETIME * 0.5, PARTICLE_LIFETIME));
        particles.push({
            pos: { x, y },
            vel: { x: Math.cos(angle) * s, y: Math.sin(angle) * s },
            life,
            maxLife: life,
        });
    }
    return particles;
}
// ---------------------------------------------------------------------------
// Game Setup
// ---------------------------------------------------------------------------
const canvas = document.getElementById("game");
canvas.width = WIDTH;
canvas.height = HEIGHT;
const ctx = canvas.getContext("2d");
const keys = { left: false, right: false, up: false, shoot: false };
let shootCooldown = 0;
function loadHiScore() {
    try {
        return parseInt(localStorage.getItem("asteroids-hiscore") ?? "0", 10) || 0;
    }
    catch {
        return 0;
    }
}
function saveHiScore(score) {
    try {
        localStorage.setItem("asteroids-hiscore", String(score));
    }
    catch { /* noop */ }
}
function initState() {
    return {
        ship: createShip(),
        bullets: [],
        asteroids: spawnAsteroids(1),
        particles: [],
        stars: createStars(),
        score: 0,
        lives: STARTING_LIVES,
        level: 1,
        gameOver: false,
        paused: false,
        started: false,
        hiScore: loadHiScore(),
        frame: 0,
    };
}
let state = initState();
// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
    switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
            keys.left = true;
            break;
        case "ArrowRight":
        case "KeyD":
            keys.right = true;
            break;
        case "ArrowUp":
        case "KeyW":
            keys.up = true;
            break;
        case "Space":
        case "KeyF":
            keys.shoot = true;
            break;
        case "KeyP":
            if (state.started && !state.gameOver)
                state.paused = !state.paused;
            break;
        case "Enter":
            if (!state.started) {
                state.started = true;
            }
            else if (state.gameOver) {
                state = initState();
                state.started = true;
            }
            break;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
    }
});
window.addEventListener("keyup", (e) => {
    switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
            keys.left = false;
            break;
        case "ArrowRight":
        case "KeyD":
            keys.right = false;
            break;
        case "ArrowUp":
        case "KeyW":
            keys.up = false;
            break;
        case "Space":
        case "KeyF":
            keys.shoot = false;
            break;
    }
});
// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update(s) {
    if (!s.started || s.paused || s.gameOver)
        return;
    s.frame++;
    // Ship rotation
    if (keys.left)
        s.ship.angle -= SHIP_TURN_SPEED;
    if (keys.right)
        s.ship.angle += SHIP_TURN_SPEED;
    // Thrust
    s.ship.thrusting = keys.up;
    if (keys.up) {
        s.ship.vel.x += Math.cos(s.ship.angle) * SHIP_THRUST;
        s.ship.vel.y += Math.sin(s.ship.angle) * SHIP_THRUST;
    }
    // Friction
    s.ship.vel.x *= SHIP_FRICTION;
    s.ship.vel.y *= SHIP_FRICTION;
    // Move ship
    s.ship.pos.x += s.ship.vel.x;
    s.ship.pos.y += s.ship.vel.y;
    wrap(s.ship.pos);
    // Invincibility countdown
    if (s.ship.invincible > 0)
        s.ship.invincible--;
    // Shooting
    if (shootCooldown > 0)
        shootCooldown--;
    if (keys.shoot && shootCooldown === 0 && s.bullets.length < MAX_BULLETS) {
        s.bullets.push({
            pos: {
                x: s.ship.pos.x + Math.cos(s.ship.angle) * SHIP_SIZE,
                y: s.ship.pos.y + Math.sin(s.ship.angle) * SHIP_SIZE,
            },
            vel: {
                x: Math.cos(s.ship.angle) * BULLET_SPEED + s.ship.vel.x * 0.3,
                y: Math.sin(s.ship.angle) * BULLET_SPEED + s.ship.vel.y * 0.3,
            },
            life: BULLET_LIFETIME,
        });
        shootCooldown = 8;
    }
    // Update bullets
    for (const b of s.bullets) {
        b.pos.x += b.vel.x;
        b.pos.y += b.vel.y;
        wrap(b.pos);
        b.life--;
    }
    s.bullets = s.bullets.filter((b) => b.life > 0);
    // Update asteroids
    for (const a of s.asteroids) {
        a.pos.x += a.vel.x;
        a.pos.y += a.vel.y;
        a.rotation += a.rotSpeed;
        wrap(a.pos);
    }
    // Bullet–asteroid collisions
    const newAsteroids = [];
    const bulletsToRemove = new Set();
    for (let ai = s.asteroids.length - 1; ai >= 0; ai--) {
        const a = s.asteroids[ai];
        let hit = false;
        for (let bi = 0; bi < s.bullets.length; bi++) {
            if (bulletsToRemove.has(bi))
                continue;
            if (dist(s.bullets[bi].pos, a.pos) < a.radius) {
                hit = true;
                bulletsToRemove.add(bi);
                s.score += ASTEROID_SCORES[a.sizeIndex];
                s.particles.push(...spawnParticles(a.pos.x, a.pos.y, PARTICLE_COUNT, 2.5));
                // Split into smaller asteroids
                if (a.sizeIndex < 2) {
                    newAsteroids.push(createAsteroid(a.pos.x, a.pos.y, a.sizeIndex + 1));
                    newAsteroids.push(createAsteroid(a.pos.x, a.pos.y, a.sizeIndex + 1));
                }
                break;
            }
        }
        if (hit) {
            s.asteroids.splice(ai, 1);
        }
    }
    s.bullets = s.bullets.filter((_, i) => !bulletsToRemove.has(i));
    s.asteroids.push(...newAsteroids);
    // Ship–asteroid collision
    if (s.ship.invincible <= 0) {
        for (const a of s.asteroids) {
            if (dist(s.ship.pos, a.pos) < a.radius + SHIP_SIZE * 0.6) {
                s.lives--;
                s.particles.push(...spawnParticles(s.ship.pos.x, s.ship.pos.y, 20, 3));
                if (s.lives <= 0) {
                    s.gameOver = true;
                    if (s.score > s.hiScore) {
                        s.hiScore = s.score;
                        saveHiScore(s.score);
                    }
                }
                else {
                    s.ship = createShip();
                }
                break;
            }
        }
    }
    // Update particles
    for (const p of s.particles) {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        p.vel.x *= 0.97;
        p.vel.y *= 0.97;
        p.life--;
    }
    s.particles = s.particles.filter((p) => p.life > 0);
    // Next level
    if (s.asteroids.length === 0) {
        s.level++;
        s.asteroids = spawnAsteroids(s.level);
        s.ship.invincible = INVINCIBLE_FRAMES;
    }
}
// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function drawShip(s) {
    const { ship, frame } = s;
    const blinking = ship.invincible > 0 && Math.floor(frame / 6) % 2 === 0;
    if (blinking)
        return;
    ctx.save();
    ctx.translate(ship.pos.x, ship.pos.y);
    ctx.rotate(ship.angle);
    // Ship body
    ctx.strokeStyle = CLR_SHIP;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = CLR_SHIP;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
    ctx.lineTo(-SHIP_SIZE * 0.4, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
    ctx.closePath();
    ctx.stroke();
    // Thrust flame
    if (ship.thrusting && Math.random() > 0.2) {
        ctx.strokeStyle = CLR_THRUST;
        ctx.shadowColor = CLR_THRUST;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 1.5;
        const flicker = rand(0.5, 1);
        ctx.beginPath();
        ctx.moveTo(-SHIP_SIZE * 0.5, -SHIP_SIZE * 0.25);
        ctx.lineTo(-SHIP_SIZE * (0.8 + flicker * 0.5), 0);
        ctx.lineTo(-SHIP_SIZE * 0.5, SHIP_SIZE * 0.25);
        ctx.stroke();
    }
    ctx.restore();
}
function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.pos.x, a.pos.y);
    ctx.rotate(a.rotation);
    ctx.strokeStyle = CLR_ASTEROID;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = CLR_ASTEROID;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    const vCount = a.vertices.length;
    for (let i = 0; i <= vCount; i++) {
        const angle = (i / vCount) * Math.PI * 2;
        const r = a.radius * a.vertices[i % vCount];
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0)
            ctx.moveTo(x, y);
        else
            ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}
function drawBullets(s) {
    ctx.shadowColor = CLR_BULLET;
    ctx.shadowBlur = 6;
    for (const b of s.bullets) {
        const alpha = Math.min(1, b.life / 10);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}
function drawParticles(s) {
    for (const p of s.particles) {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = `rgba(0, 255, 170, ${alpha})`;
        ctx.shadowColor = CLR_PARTICLE;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, 1.5 * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
}
function drawStars(s) {
    ctx.shadowBlur = 0;
    for (const star of s.stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(s.frame * star.twinkleSpeed + star.twinkleOffset);
        const alpha = star.brightness * twinkle;
        ctx.fillStyle = `rgba(200, 255, 220, ${alpha})`;
        ctx.fillRect(star.x, star.y, 1, 1);
    }
}
function drawHUD(s) {
    ctx.shadowBlur = 0;
    ctx.font = "18px 'Share Tech Mono', monospace";
    ctx.fillStyle = CLR_TEXT;
    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${String(s.score).padStart(6, "0")}`, 20, 30);
    ctx.textAlign = "right";
    ctx.fillText(`HI  ${String(s.hiScore).padStart(6, "0")}`, WIDTH - 20, 30);
    // Lives as small ship icons
    ctx.textAlign = "left";
    for (let i = 0; i < s.lives; i++) {
        const lx = 25 + i * 22;
        const ly = 52;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(-Math.PI / 2);
        ctx.strokeStyle = CLR_SHIP;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, -4);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-5, 4);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
    // Level
    ctx.fillStyle = CLR_DIM;
    ctx.font = "13px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`WAVE ${s.level}`, WIDTH / 2, HEIGHT - 15);
}
function drawTitleScreen(s) {
    drawStars(s);
    s.frame++;
    ctx.shadowColor = CLR_SHIP;
    ctx.shadowBlur = 20;
    ctx.font = "52px 'Share Tech Mono', monospace";
    ctx.fillStyle = CLR_TEXT;
    ctx.textAlign = "center";
    ctx.fillText("ASTEROIDS", WIDTH / 2, HEIGHT / 2 - 60);
    ctx.shadowBlur = 0;
    ctx.font = "16px 'Share Tech Mono', monospace";
    ctx.fillStyle = CLR_DIM;
    ctx.fillText("ARROWS / WASD  to move", WIDTH / 2, HEIGHT / 2 + 10);
    ctx.fillText("SPACE  to shoot    P  to pause", WIDTH / 2, HEIGHT / 2 + 35);
    const blink = Math.sin(s.frame * 0.06) > 0;
    if (blink) {
        ctx.fillStyle = CLR_TEXT;
        ctx.font = "20px 'Share Tech Mono', monospace";
        ctx.fillText("PRESS ENTER TO START", WIDTH / 2, HEIGHT / 2 + 90);
    }
    if (s.hiScore > 0) {
        ctx.fillStyle = CLR_DIM;
        ctx.font = "14px 'Share Tech Mono', monospace";
        ctx.fillText(`HIGH SCORE  ${s.hiScore}`, WIDTH / 2, HEIGHT / 2 + 140);
    }
}
function drawGameOver(s) {
    ctx.shadowColor = "#ff3344";
    ctx.shadowBlur = 15;
    ctx.font = "42px 'Share Tech Mono', monospace";
    ctx.fillStyle = "#ff3344";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.shadowBlur = 0;
    ctx.font = "18px 'Share Tech Mono', monospace";
    ctx.fillStyle = CLR_TEXT;
    ctx.fillText(`FINAL SCORE  ${s.score}`, WIDTH / 2, HEIGHT / 2 + 20);
    const blink = Math.sin(s.frame * 0.06) > 0;
    s.frame++;
    if (blink) {
        ctx.fillStyle = CLR_DIM;
        ctx.font = "16px 'Share Tech Mono', monospace";
        ctx.fillText("PRESS ENTER TO PLAY AGAIN", WIDTH / 2, HEIGHT / 2 + 65);
    }
}
function drawPaused() {
    ctx.font = "30px 'Share Tech Mono', monospace";
    ctx.fillStyle = CLR_DIM;
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2);
}
function render(s) {
    // Clear with slight trail effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (!s.started) {
        drawTitleScreen(s);
        return;
    }
    drawStars(s);
    drawParticles(s);
    drawBullets(s);
    for (const a of s.asteroids) {
        drawAsteroid(a);
    }
    if (!s.gameOver) {
        drawShip(s);
    }
    drawHUD(s);
    if (s.gameOver) {
        drawGameOver(s);
    }
    else if (s.paused) {
        drawPaused();
    }
}
// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------
function loop() {
    update(state);
    render(state);
    requestAnimationFrame(loop);
}
loop();
