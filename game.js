// ==========================================
// 1. DATA & CONFIG
// ==========================================

const CORE_BALLS = [
    { tier: 1, cost: 23, name: 'lell', color: '#FFFF00', idle: '/ball1-idle.png', win: '/ball1-win.png', hitboxScale: 0.8 },
    { tier: 2, cost: 46, name: "lil' bro", color: '#9370DB', idle: '/ball2-idle.png', win: '/ball2-win.png' },
    { tier: 3, cost: 92, name: 'zed', color: '#1E90FF', idle: '/ball3-idle.png', win: '/ball3-win.png' },
    { tier: 4, cost: 185, name: 'reenie', color: '#32CD32', idle: '/ball4-idle (1).png', win: '/ball4-win (1).png' },
    { tier: 5, cost: 370, name: 'RG1', color: '#A9A9A9', idle: '/ball5-idle.png', win: '/ball5-win.png' },
    { tier: 6, cost: 739, name: 'rang', color: '#FF4500', idle: '/ball6-idle.png', win: '/ball6-win.png' },
    { tier: 7, cost: 1478, name: 'rob', color: '#00FFFF', idle: '/ball7-idle.png', win: '/ball7-win.png' },
    { tier: 8, cost: 2957, name: 'ogre', color: '#696969', idle: '/ball8-idle.png', win: '/ball8-win.png' },
    { tier: 9, cost: 5914, name: 'highguy', color: '#111111', idle: '/ball9-idle.png', win: '/ball9-win.png' },
    { tier: 10, cost: 16500, name: 'bomb', color: '#FF0000', idle: '/ball10-idle.png', win: '/ball10-win.png' }
];

const ITEMS_DATA = [
    { tier: 101, cost: 148, name: 'sapling tree', color: '#228B22', idle: '/item1.png', win: '/item1.png', targetSize: 50, hitboxScale: 0.9 },
    { tier: 102, cost: 99, name: 'party hat', color: '#708090', idle: '/item2.png', win: '/item2.png', targetSize: 50, hitboxScale: 0.9 }
];

const SPECIAL_BALLS_DATA = [
    { tier: 11, cost: 33000, name: 'jumpline', color: '#FFFFFF', idle: '/ball11-idle.png', win: '/ball11-win.png', targetSize: 145, hitboxScale: 0.5, isSpecial: true, locked: true },
    { tier: 12, cost: 329999, name: 'party', color: '#9370DB', idle: '/ball12-idle.png', win: '/ball12-win.png', targetSize: 200, hitboxScale: 0.5, isSpecial: true, locked: true },
    { tier: 13, cost: 330, name: 'orange', color: '#FFA500', idle: '/ball13-idle.gif', win: '/ball13-win.png', targetSize: 110, hitboxScale: 0.8, isSpecial: true, locked: true }
];
for(let i = 14; i <= 22; i++) {
    SPECIAL_BALLS_DATA.push({ tier: i, cost: 329999, name: '???', color: '#444', idle: '/ball11-idle.png', win: '/ball11-win.png', targetSize: 145, hitboxScale: 0.5, locked: true, isSpecial: true });
}
SPECIAL_BALLS_DATA.push({ tier: 23, cost: 1, name: 'GIANT MANGO', color: '#FF8C00', idle: '/ball23-idle.png', win: '/ball23-win.png', targetSize: 450, hitboxScale: 0.9, isSpecial: true, locked: true });

const ALL_BALLS = [...CORE_BALLS, ...SPECIAL_BALLS_DATA, ...ITEMS_DATA];
const ASSETS_MAP = {};
ALL_BALLS.forEach(b => {
    ASSETS_MAP[b.tier] = { idle: b.idle, win: b.win, hitboxScale: b.hitboxScale, targetSize: b.targetSize };
});

const CONFIG = {
    BASE_SCALE: 0.13333, 
    SCALE_MULTIPLIER: 1.1,
    GRAVITY_Y: 0.32,
    BOUNCINESS: 0.35,
    FRICTION: 0.997,
    HITBOX_BASE_SIZE: 528,
    ANIMATION_DURATION: 1900,
    ASSETS: ASSETS_MAP,
    RECIPES: { '6,101': 13, '3,102': 12, '4,101': 23 },
    CORE_BALLS: CORE_BALLS,
    SPECIAL_BALLS: SPECIAL_BALLS_DATA,
    ITEMS: ITEMS_DATA
};

// ==========================================
// 2. SYSTEMS
// ==========================================

class AssetManager {
    constructor() { this.cache = {}; this.isLoaded = false; }
    async loadAll() {
        const promises = [];
        for (const [tierStr, paths] of Object.entries(CONFIG.ASSETS)) {
            const tier = parseInt(tierStr);
            this.cache[tier] = {};
            promises.push(new Promise((resolve) => {
                const img = new Image();
                img.src = paths.idle;
                img.onload = () => {
                    let scale, width, height, radius;
                    const config = CONFIG.ASSETS[tier];
                    if (config.targetSize) {
                        scale = config.targetSize / img.width;
                        width = config.targetSize;
                        height = img.height * scale;
                        radius = (Math.max(width, height) / 2) * 0.95;
                        if (config.hitboxScale) radius *= config.hitboxScale;
                    } else {
                        scale = CONFIG.BASE_SCALE * Math.pow(CONFIG.SCALE_MULTIPLIER, tier - 1);
                        width = img.width * scale;
                        height = img.height * scale;
                        radius = (CONFIG.HITBOX_BASE_SIZE * scale) / 2;
                        if (config.hitboxScale) radius *= config.hitboxScale;
                    }
                    this.cache[tier].idle = { img, width, height, radius };
                    resolve();
                };
                img.onerror = resolve;
            }));
            promises.push(new Promise((resolve) => {
                const img = new Image();
                img.src = paths.win;
                img.onload = () => { this.cache[tier].win = { img }; resolve(); };
                img.onerror = resolve;
            }));
        }
        await Promise.all(promises);
        this.isLoaded = true;
    }
    getAsset(tier) { return this.cache[tier]; }
}
const assets = new AssetManager();

class PhysicsEngine {
    constructor(callbacks) {
        this.bodies = [];
        this.width = 100; this.height = 100;
        this.callbacks = callbacks || {};
        this.dragState = { active: false, clientId: null, bodyId: null, targetX: 0, targetY: 0 };
        this.dragHistory = [];
    }
    init(w, h) { this.width = w; this.height = h; }
    spawnBall(tier, x, y, id) {
        const asset = assets.getAsset(tier);
        if (!asset) return;
        const radius = asset.idle.radius;
        const body = { id, tier, x, y, vx: 0, vy: 0, angle: 0, radius, mass: radius * radius, restitution: CONFIG.BOUNCINESS };
        this.bodies.push(body);
        return body;
    }
    removeBodyByGameId(id) {
        const idx = this.bodies.findIndex(b => b.id === id);
        if (idx !== -1) this.bodies.splice(idx, 1);
    }
    update() {
        if (this.dragState.active) {
            this.dragHistory.push({ x: this.dragState.targetX, y: this.dragState.targetY });
            if (this.dragHistory.length > 17) this.dragHistory.shift();
        } else { this.dragHistory = []; }
        const steps = 8; const dt = 1 / steps;
        for (let s = 0; s < steps; s++) this.step(dt);
    }
    step(dt) {
        this.bodies.forEach(b => {
            if (this.dragState.active && this.dragState.bodyId === b.id) {
                b.vx = (this.dragState.targetX - b.x) * 0.3;
                b.vy = (this.dragState.targetY - b.y) * 0.3;
            } else {
                b.vy += CONFIG.GRAVITY_Y * dt;
                b.vx *= CONFIG.FRICTION; b.vy *= CONFIG.FRICTION;
            }
            b.x += b.vx; b.y += b.vy;
            b.angle += b.vx / b.radius;
        });
        this.bodies.forEach(b => {
            const r = b.radius; const floorY = this.height - 50;
            if (b.y + r > floorY) { b.y = floorY - r; b.vy *= -0.32; }
            if (b.x - r < 0) { b.x = r; b.vx *= -0.35; }
            if (b.x + r > this.width) { b.x = this.width - r; b.vx *= -0.35; }
        });
        this.solveCollisions();
    }
    solveCollisions() {
        const cellSize = 150; const grid = {};
        this.bodies.forEach(b => {
            const key = ((b.x/cellSize)|0) + ',' + ((b.y/cellSize)|0);
            if (!grid[key]) grid[key] = [];
            grid[key].push(b);
        });
        this.bodies.forEach(b1 => {
            const cx = (b1.x/cellSize)|0; const cy = (b1.y/cellSize)|0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const key = (cx+dx) + ',' + (cy+dy);
                    const cell = grid[key];
                    if (cell) cell.forEach(b2 => { if (b1.id < b2.id) this.resolveCollision(b1, b2); });
                }
            }
        });
    }
    resolveCollision(b1, b2) {
        const dx = b2.x - b1.x; const dy = b2.y - b1.y;
        const distSq = dx*dx + dy*dy; const radSum = b1.radius + b2.radius;
        if (distSq < radSum * radSum && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            let newTier = null;
            if (b1.tier !== b2.tier) {
                const k = b1.tier < b2.tier ? `${b1.tier},${b2.tier}` : `${b2.tier},${b1.tier}`;
                if (CONFIG.RECIPES[k]) newTier = CONFIG.RECIPES[k];
            } else if (b1.tier <= 10) { newTier = b1.tier + 1; }
            if (newTier) {
                this.callbacks.onMerge?.({ id1: b1.id, id2: b2.id, tier: b1.tier, newTier, x: (b1.x+b2.x)/2, y: (b1.y+b2.y)/2 });
                return;
            }
            const overlap = radSum - dist; const nx = dx / dist; const ny = dy / dist;
            const totalMass = b1.mass + b2.mass;
            b1.x -= nx * overlap * (b2.mass / totalMass); b1.y -= ny * overlap * (b2.mass / totalMass);
            b2.x += nx * overlap * (b1.mass / totalMass); b2.y += ny * overlap * (b1.mass / totalMass);
            const rvx = b2.vx - b1.vx; const rvy = b2.vy - b1.vy;
            const vln = rvx * nx + rvy * ny;
            if (vln > 0) return;
            const j = -(1 + Math.min(b1.restitution, b2.restitution)) * vln;
            const impulse = j / (1/b1.mass + 1/b2.mass);
            b1.vx -= (impulse * nx) / b1.mass; b1.vy -= (impulse * ny) / b1.mass;
            b2.vx += (impulse * nx) / b2.mass; b2.vy += (impulse * ny) / b2.mass;
        }
    }
    getState() {
        const state = {};
        this.bodies.forEach(b => {
            state[b.id] = { x: b.x, y: b.y, angle: b.angle, tier: b.tier, id: b.id, isDragged: (this.dragState.active && this.dragState.bodyId === b.id) };
        });
        return state;
    }
    startDrag(cid, gid, x, y) {
        const b = this.bodies.find(b => b.id === gid);
        if (b) { this.dragState = { active: true, clientId: cid, bodyId: gid, targetX: x, targetY: y }; this.dragHistory = []; }
    }
    updateDrag(cid, x, y) { if (this.dragState.active && this.dragState.clientId === cid) { this.dragState.targetX = x; this.dragState.targetY = y; } }
    endDrag(cid) {
        if (this.dragState.active && this.dragState.clientId === cid) {
            const b = this.bodies.find(b => b.id === this.dragState.bodyId);
            if (b && this.dragHistory.length >= 2) {
                let tx = 0, ty = 0;
                for (let i = 0; i < this.dragHistory.length - 1; i++) {
                    tx += this.dragHistory[i+1].x - this.dragHistory[i].x;
                    ty += this.dragHistory[i+1].y - this.dragHistory[i].y;
                }
                b.vx = tx / (this.dragHistory.length - 1); b.vy = ty / (this.dragHistory.length - 1);
            }
            this.dragState.active = false; this.dragState.bodyId = null;
        }
    }
}

class BehaviorSystem {
    constructor() { this.physics = null; this.bubbles = []; this.timer = 0; this.phrases = ["wassup", "WTH??", "YOLO", "LAG??", "dont smoke kids.", "follow @sarge for more!", "pls like...", "comment ur fav char", "DRAW ME PLS", "Who dis?", "Bruh.", "MY EYES!!!!", "boing", "pov: ur the best", "ima big ball", "this game is EASY", "jump-line", "get gud", "what r those", "tra la lero tra la la"]; }
    init(physics) { this.physics = physics; this.timer = Date.now() + 5000; }
    update() {
        if (!this.physics) return; const now = Date.now();
        if (now >= this.timer) {
            const bodies = this.physics.bodies.filter(b => !(this.physics.dragState.active && this.physics.dragState.bodyId === b.id));
            if (bodies.length > 0) { const b = bodies[Math.floor(Math.random() * bodies.length)]; b.vy = -1.2; this.speak(b.id); }
        }
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const bub = this.bubbles[i];
            if (now > bub.expires) { bub.el.remove(); this.bubbles.splice(i, 1); continue; }
            const b = this.physics.bodies.find(b => b.id === bub.ballId);
            if (b) { bub.el.style.left = `${b.x + b.radius*0.7}px`; bub.el.style.top = `${b.y - b.radius*0.7}px`; }
            else { bub.el.remove(); this.bubbles.splice(i, 1); }
        }
    }
    speak(id) {
        this.timer = Date.now() + 16000;
        const text = this.phrases[Math.floor(Math.random() * this.phrases.length)];
        const el = document.createElement('div'); el.className = 'chat-bubble'; el.innerText = text;
        document.body.appendChild(el);
        this.bubbles.push({ el, ballId: id, expires: Date.now() + 5000 });
    }
    onDrag(id) { if (Date.now() >= this.timer && Math.random() < 0.25) this.speak(id); }
}
const behavior = new BehaviorSystem();

class SpecialEventManager {
    constructor() { this.activeEntity = null; this.isCompleted = false; }
    init(layer, spawnFn, maxTierFn) { this.layer = layer; this.spawnCallback = spawnFn; this.getMaxTier = maxTierFn; setInterval(() => { if (this.getMaxTier() >= 3 && Math.random() < 0.39) this.spawnRandomItem(); }, 45000); }
    spawnRandomItem() {
        const item = CONFIG.ITEMS[Math.floor(Math.random() * CONFIG.ITEMS.length)];
        const x = 50 + Math.random() * (window.innerWidth - 100);
        this.spawnCallback(item.tier, x, -50);
        const banner = document.createElement('div'); banner.className = 'event-banner'; banner.innerText = `${item.name.toUpperCase()} SPAWNED!`;
        document.body.appendChild(banner);
        setTimeout(() => { banner.classList.add('fade-out'); setTimeout(() => banner.remove(), 1000); }, 3000);
    }
    spawn() {
        if (this.activeEntity || this.isCompleted) return;
        const el = document.createElement('img'); el.src = '/ball11-baloon.gif'; el.style.position = 'absolute'; el.style.width = '150px'; el.style.imageRendering = 'pixelated'; el.style.zIndex = '10'; el.style.transform = 'translate(-200px, 0)';
        this.layer.appendChild(el);
        this.activeEntity = { el, x: -200, y: 50 + Math.random()*100, width: 150, height: 150, speed: (2+Math.random()*1.5)*0.5, bubbles: [] };
        setTimeout(() => this.say("help me"), 500);
        setTimeout(() => this.say("throw a ball at me to get me down"), 2000);
    }
    update(bodies) {
        if (!this.activeEntity) return;
        const ent = this.activeEntity; ent.x += ent.speed; ent.el.style.transform = `translate(${ent.x}px, ${ent.y}px)`;
        ent.bubbles.forEach(b => { b.el.style.left = (ent.x + b.offsetX) + 'px'; b.el.style.top = (ent.y + b.offsetY) + 'px'; });
        if (ent.x > window.innerWidth) return this.despawn();
        const cx = ent.x + ent.width/2; const cy = ent.y + ent.height/2;
        for (const b of Object.values(bodies)) {
            if (Math.hypot(b.x - cx, b.y - cy) < ent.width/2 + 30) {
                this.spawnCallback(11, cx, cy); this.isCompleted = true; return this.despawn();
            }
        }
    }
    say(text) {
        if (!this.activeEntity) return;
        const bubble = document.createElement('div'); bubble.className = 'chat-bubble'; bubble.innerText = text; bubble.style.zIndex = '11'; this.layer.appendChild(bubble);
        this.activeEntity.bubbles.push({ el: bubble, offsetX: 40, offsetY: -10 });
        setTimeout(() => { bubble.remove(); if (this.activeEntity) this.activeEntity.bubbles = this.activeEntity.bubbles.filter(b => b.el !== bubble); }, 3000);
    }
    despawn() { if (this.activeEntity) { this.activeEntity.el.remove(); this.activeEntity.bubbles.forEach(b => b.el.remove()); this.activeEntity = null; } }
}
const specialEvents = new SpecialEventManager();

function initClouds() {
    const layer = document.getElementById('cloud-layer'); if (!layer) return;
    const assets_c = ['/cloud1.gif', '/cloud2.gif', '/cloud3.gif', '/cloud4.gif'];
    const clouds = Array.from({length: 6}, () => ({ el: document.createElement('img'), x: Math.random()*window.innerWidth, y: 0, s: 0, sc: 0 }));
    clouds.forEach(c => { c.el.className = 'cloud'; layer.appendChild(c.el); reset(c, true); });
    function reset(c, init) {
        c.x = init ? c.x : -250;
        if (!init && Math.random() < 0.1) { specialEvents.spawn(); c.el.style.display = 'none'; } else { c.el.style.display = 'block'; }
        c.y = Math.random()*(window.innerHeight*0.15); c.s = 0.375 + Math.random()*0.625; c.sc = 0.1 * (0.7 + Math.random()*0.6);
        c.el.src = assets_c[Math.floor(Math.random()*assets_c.length)];
    }
    (function loop() { clouds.forEach(c => { c.x += c.s; if (c.x > window.innerWidth) reset(c); c.el.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.sc})`; }); requestAnimationFrame(loop); })();
}

// ==========================================
// 3. BOSS FIGHT & NARRATIVE
// ==========================================

function startBossFight() {
    const bLayer = document.getElementById('boss-layer'); const bCanvas = document.getElementById('boss-canvas'); const bCtx = bCanvas.getContext('2d');
    const bMusic = document.getElementById('boss-music'); const hpF = document.getElementById('boss-hp-fill'); const pHpF = document.getElementById('player-hp-fill');
    let bHp = 50, bMax = 50, pHp = 100, active = true, phase = 1, trans = false, frame = 0, bullets = [], hazards = [], eBullets = [];
    const spr = { p: new Image(), b: new Image(), ba: new Image(), bul: new Image(), haz: new Image() };
    spr.p.src = '/ball8-idle.png'; spr.b.src = '/ball6-idle.png'; spr.ba.src = '/ball6-win.png'; spr.bul.src = '/ball1-win.png'; spr.haz.src = '/ball10-idle.png';
    const player = { x: 0, y: 0, w: 32, h: 32, speed: 5 }; const boss = { x: 0, y: 150 };
    bLayer.style.display = 'flex'; bCanvas.width = window.innerWidth; bCanvas.height = window.innerHeight;
    player.x = bCanvas.width/2 - 16; player.y = bCanvas.height - 150; boss.x = bCanvas.width/2;
    if (bMusic) { bMusic.volume = 0.5; bMusic.currentTime = 0; bMusic.play().catch(console.log); }
    const keys = {}; window.addEventListener('keydown', e => keys[e.code] = true); window.addEventListener('keyup', e => keys[e.code] = false);
    const takeDmg = (a) => { pHp -= a; pHpF.style.width = pHp + '%'; bLayer.classList.add('glitch-effect'); setTimeout(() => bLayer.classList.remove('glitch-effect'), 100); };
    (function loop() {
        if (!active) return; frame++;
        if (!trans) {
            if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed; if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed;
            if (keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed; if (keys['ArrowDown'] || keys['KeyS']) player.y += player.speed;
            player.x = Math.max(0, Math.min(bCanvas.width - player.w, player.x)); player.y = Math.max(0, Math.min(bCanvas.height - player.h, player.y));
            const moveFreq = phase === 1 ? 0.02 : 0.05; const moveDist = phase === 1 ? bCanvas.width*0.25 : bCanvas.width*0.35;
            boss.x = (bCanvas.width/2) + Math.sin(frame*moveFreq)*moveDist; boss.y = 150 + Math.cos(frame*moveFreq*1.5)*50;
            if (frame % 8 === 0) bullets.push({ x: player.x+16-8, y: player.y, w: 16, h: 16 });
            bullets.forEach((b, i) => { b.y -= 10; if (Math.hypot(b.x-boss.x, b.y-boss.y) < 60) { bHp -= 0.5; bullets.splice(i,1); hpF.style.width = (Math.max(0,bHp)/bMax*100)+'%'; } });
            if (frame % (phase === 1 ? 60 : 30) === 0) {
                const count = phase === 1 ? 8 : 12; for (let i=0; i<count; i++) {
                    const a = (i/count)*Math.PI*2 + (frame*0.05); eBullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a)*(phase===1?4:6), vy: Math.sin(a)*(phase===1?4:6), size: phase===1?24:26 });
                }
            }
            if (phase === 2 && frame % 45 === 0) {
                const dx = (player.x+16)-boss.x, dy = (player.y+16)-boss.y, d = Math.hypot(dx,dy);
                eBullets.push({ x: boss.x, y: boss.y, vx: (dx/d)*8, vy: (dy/d)*8, size: 28, warning: true });
            }
            if (frame % 45 === 0) hazards.push({ x: Math.random()*bCanvas.width, y: -50, vy: (phase===1?4:8)+Math.random()*4, size: 40 });
            eBullets.forEach((b,i) => { b.x += b.vx; b.y += b.vy; if (Math.hypot(b.x-(player.x+16), b.y-(player.y+16)) < b.size/2 + 16) { takeDmg(phase===1?5:10); eBullets.splice(i,1); } });
            hazards.forEach((h,i) => { h.y += h.vy; if (Math.hypot(h.x-(player.x+16), h.y-(player.y+16)) < h.size/2 + 16) { takeDmg(10); hazards.splice(i,1); } });
            if (bHp <= 0) { if (phase === 1) { phase = 2; bHp = 10; bMax = 10; trans = true; bLayer.classList.add('glitch-effect'); setTimeout(() => { bLayer.classList.remove('glitch-effect'); trans = false; hpF.style.backgroundColor='#ff00ff'; hpF.style.width='100%'; }, 1500); } else { win(); } }
            if (pHp <= 0) lose();
        }
        bCtx.clearRect(0, 0, bCanvas.width, bCanvas.height);
        bCtx.drawImage(spr.p, player.x, player.y, player.w, player.h);
        const bImg = phase === 2 ? spr.ba : spr.b; const bS = (phase===2?160:120) + Math.sin(frame*0.1)*10;
        bCtx.save(); bCtx.translate(boss.x, boss.y); if (phase===2) bCtx.rotate(Math.sin(frame*0.2)*0.1); bCtx.drawImage(bImg, -bS/2, -bS/2, bS, bS); bCtx.restore();
        bullets.forEach(b => bCtx.drawImage(spr.bul, b.x, b.y, b.w, b.h));
        eBullets.forEach(b => { bCtx.fillStyle = b.warning?'#ff00ff':'#f00'; bCtx.beginPath(); bCtx.arc(b.x, b.y, b.size/2, 0, Math.PI*2); bCtx.fill(); bCtx.strokeStyle='#fff'; bCtx.lineWidth=2; bCtx.stroke(); });
        hazards.forEach(h => bCtx.drawImage(spr.haz, h.x-h.size/2, h.y-h.size/2, h.size, h.size));
        requestAnimationFrame(loop);
    })();
    const win = async () => {
        active = false; if (bMusic) { const f = setInterval(() => { if (bMusic.volume > 0.05) bMusic.volume -= 0.05; else { bMusic.pause(); clearInterval(f); } }, 100); }
        const d = document.createElement('div'); d.className = 'chat-bubble'; d.style.position = 'absolute'; d.style.left = '50%'; d.style.top = '30%'; d.style.transform = 'translate(-50%, -50%)'; d.style.zIndex = '30000'; d.innerText = "NO... THIS... THIS WAS MY KINGDOM..."; bLayer.appendChild(d);
        await new Promise(r => setTimeout(r, 2000)); d.innerText = "YOU... ARE NOTHING... BUT A...";
        let v = 0; const vi = setInterval(() => { v += 0.5; boss.x = (bCanvas.width/2) + (Math.random()-0.5)*v*0.31; boss.y = 150 + (Math.random()-0.5)*v*0.31; }, 16);
        await new Promise(r => setTimeout(r, 2000)); d.innerText = "GRAAAAAAAHHHHH!!!"; bLayer.classList.add('glitch-effect');
        await new Promise(r => setTimeout(r, 1000)); clearInterval(vi);
        const fl = document.createElement('div'); fl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:40000;opacity:0;transition:opacity 2s;'; document.body.appendChild(fl);
        setTimeout(() => fl.style.opacity = '1', 50); await new Promise(r => setTimeout(r, 2500));
        bLayer.style.display = 'none'; startBossDefeatCinematic();
        setTimeout(() => { fl.style.opacity = '0'; setTimeout(() => fl.remove(), 2000); }, 500);
    };
    const lose = () => { active = false; if (bMusic) bMusic.pause(); bLayer.classList.add('glitch-effect'); bLayer.innerHTML = '<div style="font-size:64px; color: red; text-align:center;">YOU WERE ERASED<br><div style="font-size:18px; margin-top:50px; cursor:pointer; color:white;" onclick="location.reload()">TRY AGAIN?</div></div>'; };
}

async function typewriter(text, element) {
    element.textContent = ""; let skip = false; const next = () => skip = true; window.addEventListener('click', next, {once: true});
    for (let i = 0; i < text.length; i++) { if (skip) { element.textContent = text; break; } element.textContent += text[i]; await new Promise(r => setTimeout(r, 80)); }
    const p = document.createElement('div'); p.style.cssText = 'font-size:18px;margin-top:20px;opacity:0.7;'; p.textContent = "(Click to continue)"; element.appendChild(p);
}

async function startIntro() {
    const ov = document.getElementById('intro-overlay'); const tx = document.getElementById('intro-text');
    const story = ["Long ago, a king ruled over his kingdom as a tyrant.", "No one was powerful enough to stop him...", "until...", "The king suddenly died from unusual circumstances...", "With no one to rule his kingdom, it fell into chaos.", "This is the story of YOU, player, and how you brought control back to the kingdom.", "It is up to YOU to bring order back to this civilization."];
    ov.style.display = 'flex'; setTimeout(() => ov.style.opacity = '1', 50);
    for (let i=0; i<story.length; i++) { await typewriter(story[i], tx); await new Promise(r => ov.addEventListener('click', r, {once: true})); }
    ov.style.opacity = '0'; setTimeout(() => { ov.style.display = 'none'; const m = document.getElementById('bg-music'); if (m) { m.volume = 0.4; m.play().catch(console.log); } window.dispatchEvent(new Event('game-start')); startTutorial(); }, 1000);
}

function startTutorial() {
    const c = document.getElementById('tutorial-container'); const b = document.getElementById('tutorial-bubble');
    const msg = ["Hi there! I'm here to help you restore the kingdom. I remember the old days well!", "It's quite simple really! If we work together, we can bring back the glory of the crown.", "We just need to find the right combinations to bring back a King. A kind, noble King.", "First, why not buy one of me? I'd love to help out from down on the ground!", "Wonderful! See? Merging creates something even better. It's the path to progress.", "There are 13 unique friends to find. Each one is special in its own way!", "Some secrets are hidden in recipes. I'll help you remember them when the time is right.", "Don't forget those items! They hold so much potential for our little kingdom.", "I'll stay close by. Let's find our King and make everything perfect for everyone!"];
    let step = 0; c.style.display = 'flex'; c.style.opacity = '1'; b.innerText = msg[0];
    const adv = () => { step++; if (msg[step]) b.innerText = msg[step]; };
    let t = setInterval(() => { if (step < 3) adv(); else clearInterval(t); }, 6000);
    window.addEventListener('ball-bought', (e) => { if (step <= 3 && e.detail.tier === 1) { clearInterval(t); step = 4; b.innerText = msg[step]; } });
    window.addEventListener('ball-merged', (e) => { if (step === 4 && e.detail.fromTier === 1) { step = 5; b.innerText = msg[step]; let ti = setInterval(() => { step++; if (step < 9) b.innerText = msg[step]; else { clearInterval(ti); c.style.opacity='0'; setTimeout(() => c.style.display='none', 2000); } }, 5000); } });
    window.addEventListener('suggest-bomb-merge', () => { c.style.display = 'flex'; c.style.opacity = '1'; b.innerText = "DO IT! Buy another bomb! Trust me... it's the only way to... 'fix' the kingdom. Mwahahaha— I mean, yay!"; });
}

async function startEnding() {
    const m = document.getElementById('bg-music'); if (m) m.pause();
    const ov = document.getElementById('ending-overlay'); const sp = document.getElementById('ending-sprite'); const tx = document.getElementById('ending-text'); const fl = document.getElementById('ending-flash');
    const story = [{ t: "So... the core is complete.", s: "/ball1-idle.png" }, { t: "A vessel for absolute power.", s: "/ball1-idle.png" }, { t: "Did you really think I wanted to restore the 'King'?", s: "/ball1-idle.png", sh: true }, { t: "I am the only King this world will ever need.", s: "/ball1-idle.png", r: true }, { t: "And you... you're just another fragment of history to be erased.", s: "/ball1-idle.png", g: true }, { t: "WITNESS TRUE PERFECTION.", s: "/ball6-idle.png", tr: true }, { t: "DIE.", s: "/ball6-win.png", b: true }];
    ov.style.display = 'flex'; ov.style.opacity = '1';
    for (let i=0; i<story.length; i++) {
        const c = story[i]; sp.src = c.s;
        if (c.tr) { fl.style.opacity = '1'; setTimeout(() => fl.style.opacity = '0', 300); }
        if (c.sh) ov.style.animation = 'screenGlitch 0.2s 3';
        if (c.r) ov.style.boxShadow = 'inset 0 0 200px rgba(255,0,0,0.8)';
        if (c.g) { document.body.classList.add('glitch-effect'); ov.classList.add('glitch-effect'); }
        await typewriter(c.t, tx);
        if (c.b) { setTimeout(() => { ov.style.opacity = '0'; setTimeout(() => { ov.style.display = 'none'; startBossFight(); }, 1000); }, 1500); break; }
        await new Promise(r => ov.addEventListener('click', r, {once: true}));
    }
}

async function startGoodEnding() {
    const m = document.getElementById('bg-music'); if (m) m.pause();
    const ov = document.getElementById('ending-overlay'); const sp = document.getElementById('ending-sprite'); const ex = document.getElementById('ending-extra-sprite'); const tx = document.getElementById('ending-text'); const fl = document.getElementById('ending-flash');
    ov.style.display = 'flex'; ov.style.opacity = '1'; ov.style.background = 'radial-gradient(circle, #222 0%, #000 100%)'; sp.src = "/ball1-idle.png"; sp.style.cssText = 'display:block;opacity:1;transform:scale(1.5);'; ex.src = "/ball10-idle.png"; ex.style.cssText = 'display:block;left:-300px;top:50%;transform:translateY(-50%) scale(1.2);filter:drop-shadow(0 0 10px red);';
    await typewriter("Wait... what is that?", tx); await new Promise(r => setTimeout(r, 500)); ex.style.transition = 'left 1.5s cubic-bezier(0.6, -0.28, 0.735, 0.045)'; ex.style.left = 'calc(50% - 60px)'; await new Promise(r => setTimeout(r, 1200));
    const sInt = setInterval(() => ov.style.transform = `translate(${(Math.random()-0.5)*6.2}px, ${(Math.random()-0.5)*6.2}px)`, 50); await new Promise(r => setTimeout(r, 300)); clearInterval(sInt); ov.style.transform = 'translate(0,0)';
    fl.style.opacity = '1'; setTimeout(() => { fl.style.transition = 'opacity 2s'; fl.style.opacity = '0'; sp.style.display = 'none'; ex.style.display = 'none'; ov.style.background = 'black'; }, 100); await new Promise(r => setTimeout(r, 500));
    await typewriter("THE TYRANT HAS BEEN PURGED.", tx); await new Promise(r => setTimeout(r, 1000)); await typewriter("THE KINGDOM IS FINALLY FREE.", tx);
    const tit = document.createElement('div'); tit.style.cssText = 'font-size:64px;margin-top:40px;color:#00ff00;text-shadow:0 0 20px #00ff00;'; tit.textContent = "TRUE ENDING"; tx.appendChild(tit);
    const sub = document.createElement('div'); sub.style.cssText = 'font-size:24px;margin-top:20px;cursor:pointer;'; sub.textContent = "(Click to reload)"; sub.onclick = () => location.reload(); tx.appendChild(sub);
}

async function startBossDefeatCinematic() {
    const ov = document.getElementById('ending-overlay'); const sp = document.getElementById('ending-sprite'); const tx = document.getElementById('ending-text');
    ov.style.display = 'flex'; ov.style.opacity = '1'; ov.style.background = 'black'; document.body.classList.remove('glitch-effect'); ov.classList.remove('glitch-effect'); ov.style.boxShadow = 'none';
    sp.src = "/ball8-idle.png"; sp.style.cssText = 'display:block;opacity:0;transform:scale(0.5);'; await new Promise(r => setTimeout(r, 1000)); sp.style.transition = 'all 2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; sp.style.opacity = '1'; sp.style.transform = 'scale(1.5)';
    await typewriter("The shadow has lifted.", tx); await new Promise(r => setTimeout(r, 1500)); await typewriter("The tyrant's loop is broken.", tx); await new Promise(r => setTimeout(r, 1500));
    ["/ball1-idle.png", "/ball2-idle.png", "/ball3-idle.png", "/ball4-idle (1).png"].forEach((src, i) => { const s = document.createElement('img'); s.src = src; s.style.cssText = `position:absolute;width:64px;bottom:-100px;left:${20+i*20}%;image-rendering:pixelated;transition:bottom 2s ease-out ${i*0.5}s;`; ov.appendChild(s); setTimeout(() => s.style.bottom = '100px', 100); });
    await typewriter("A new era begins for the kingdom. One of peace, and true balance.", tx); await new Promise(r => setTimeout(r, 2000));
    const tit = document.createElement('div'); tit.style.cssText = 'font-size:72px;color:#fff;margin-top:20px;text-shadow:0 0 20px rgba(255,255,255,0.5);opacity:0;transition:opacity 3s;'; tit.innerText = "FREEDOM ENDING"; tx.appendChild(tit); setTimeout(() => tit.style.opacity = '1', 100);
    const res = document.createElement('div'); res.style.cssText = 'font-size:24px;margin-top:30px;cursor:pointer;color:#ffd700;'; res.innerText = "RETURN TO MENU"; res.onclick = () => location.reload(); tx.appendChild(res);
}

// ==========================================
// 4. MAIN APP LOGIC
// ==========================================

let credits = 0, displayCredits = 0, maxUnlockedTier = 1, unlockedSpecialTiers = new Set(), gameStarted = false, balls = {}, effects = [], physics = null, currentDrag = null, lastCreditTick = 0;
const gameCanvas = document.getElementById('canvas'), gameCtx = gameCanvas.getContext('2d'), bgCanvas = document.getElementById('bg-canvas'), bgCtx = bgCanvas.getContext('2d');

async function initGame() {
    gameResize(); window.addEventListener('resize', gameResize);
    window.addEventListener('game-start', () => { gameStarted = true; gameCanvas.style.pointerEvents = 'auto'; document.getElementById('ui-layer').style.display = 'flex'; });
    window.addEventListener('add-credits', e => { credits += e.detail; updateShopButtons(); });
    await assets.loadAll(); window.dispatchEvent(new Event('game-loaded'));
    setupUI(); setupInput(); initClouds();
    specialEvents.init(document.body, (t, x, y) => { updateUnlockedTier(t); physics.spawnBall(t, x, y, Math.random().toString(36).substr(2, 9)); }, () => maxUnlockedTier);
    physics = new PhysicsEngine({ onMerge: (d) => {
        physics.removeBodyByGameId(d.id1); physics.removeBodyByGameId(d.id2);
        if (d.tier === 10) { gameStarted = false; return window.dispatchEvent(new Event('game-ending')); }
        physics.spawnBall(d.newTier, d.x, d.y, Math.random().toString(36).substr(2, 9));
        effects.push({ x: d.x, y: d.y, tier: d.tier, start: Date.now(), duration: CONFIG.ANIMATION_DURATION });
        updateUnlockedTier(d.newTier);
        window.dispatchEvent(new CustomEvent('ball-merged', { detail: { fromTier: d.tier, toTier: d.newTier } }));
    }});
    physics.init(gameCanvas.width, gameCanvas.height); behavior.init(physics);
    (function loop() { if (gameStarted && physics) { physics.update(); balls = physics.getState(); behavior.update(); } renderLoop(); requestAnimationFrame(loop); })();
    setInterval(() => { if (!gameStarted) return; lastCreditTick = Date.now(); credits += 15; Object.values(balls).forEach(b => { if (b.tier === 23) credits -= 1; else if (b.tier <= 22) credits += b.tier; }); updateShopButtons(); }, 1000);
    setInterval(() => { if (!gameStarted || Math.random() >= 0.09) return; const mId = Object.keys(balls).find(id => balls[id].tier === 23); if (mId && physics) { const m = balls[mId]; physics.removeBodyByGameId(mId); const bu = document.createElement('div'); bu.className='chat-bubble'; bu.innerText="EATEN BY TREY"; bu.style.left=(m.x-50)+'px'; bu.style.top=(m.y-150)+'px'; document.body.appendChild(bu); setTimeout(() => { bu.style.transition='opacity 1s, transform 1s'; bu.style.opacity='0'; bu.style.transform='translateY(-30px)'; setTimeout(()=>bu.remove(), 1000); }, 1000); } }, 1000);
}

function updateUnlockedTier(t) {
    let up = false; if (t <= 10 && t > maxUnlockedTier) { maxUnlockedTier = t; up = true; } else if (t > 10 && !unlockedSpecialTiers.has(t)) { unlockedSpecialTiers.add(t); up = true; }
    if (up) { setupUI(); if (maxUnlockedTier === 10 && [11, 12, 13].every(st => unlockedSpecialTiers.has(st)) && gameStarted) { gameStarted = false; window.dispatchEvent(new Event('game-good-ending')); } }
}

function setupInput() {
    const start = (x, y) => { const al = Object.values(balls); for (let i = al.length-1; i >= 0; i--) { const b = al[i]; const as = assets.getAsset(b.tier); if (as && Math.hypot(b.x-x, b.y-y) < as.idle.radius) { currentDrag = { gameId: b.id }; physics.startDrag('local', b.id, x, y); behavior.onDrag(b.id); return; } } };
    const move = (x, y) => { if (currentDrag) physics.updateDrag('local', x, y); };
    const end = () => { if (currentDrag) { physics.endDrag('local'); currentDrag = null; } };
    gameCanvas.addEventListener('mousedown', e => start(e.clientX, e.clientY)); window.addEventListener('mousemove', e => move(e.clientX, e.clientY)); window.addEventListener('mouseup', end);
    gameCanvas.addEventListener('touchstart', e => { e.preventDefault(); start(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
    window.addEventListener('touchmove', e => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
    window.addEventListener('touchend', end);
}

function updateShopButtons() { const btns = document.querySelectorAll('.shop-btn'); btns.forEach(b => { const cost = parseInt(b.dataset.cost); if (credits < cost) b.classList.add('disabled'); else b.classList.remove('disabled'); }); if (Object.values(balls).filter(b => b.tier === 10).length === 1 && credits >= 16500) window.dispatchEvent(new Event('suggest-bomb-merge')); }

function buy(tier, cost) { if (tier > 100 && maxUnlockedTier < 3) return; if (credits >= cost) { credits -= cost; physics.spawnBall(tier, 100 + Math.random()*(gameCanvas.width-200), 100, Math.random().toString(36).substr(2, 9)); window.dispatchEvent(new CustomEvent('ball-bought', { detail: { tier } })); updateShopButtons(); } }

function setupUI() {
    const core = document.getElementById('shop-core'), spec = document.getElementById('special-grid'), itemsC = document.getElementById('items-container');
    document.getElementById('shop-toggle').onclick = (e) => { const s = document.getElementById('shop-sidebar'); s.classList.toggle('expanded'); e.target.innerText = s.classList.contains('expanded')?'➤':'◀'; e.target.style.transform = s.classList.contains('expanded')?'rotate(180deg)':'rotate(0deg)'; };
    document.getElementById('items-toggle').onclick = (e) => { const i = document.getElementById('items-sidebar'); i.classList.toggle('expanded'); e.target.innerText = i.classList.contains('expanded')?'◀':'➤'; e.target.style.transform = i.classList.contains('expanded')?'rotate(180deg)':'rotate(0deg)'; };
    core.innerHTML = ''; CONFIG.CORE_BALLS.forEach(i => { if (i.tier <= maxUnlockedTier) core.appendChild(createBtn(i)); });
    spec.innerHTML = ''; CONFIG.SPECIAL_BALLS.forEach(i => { const b = createBtn(i); if (i.locked && !unlockedSpecialTiers.has(i.tier)) { b.classList.add('disabled'); b.style.opacity = '0.5'; b.onclick = null; } spec.appendChild(b); });
    itemsC.innerHTML = ''; if (maxUnlockedTier >= 3) CONFIG.ITEMS.forEach(i => itemsC.appendChild(createBtn(i)));
}

function createBtn(i) {
    const b = document.createElement('div'); b.className = 'shop-btn'; b.dataset.cost = i.cost; b.dataset.tier = i.tier;
    const zoom = [2, 5, 8].includes(i.tier) ? 'shop-img-zoomed' : '';
    b.innerHTML = `<div class="img-container"><img src="${i.idle}" class="img-idle ${zoom}"><img src="${i.win}" class="img-win ${zoom}"></div><div class="shop-name" style="color:${i.color}">${i.name}</div><div class="shop-cost">${i.cost}c</div>`;
    b.onclick = () => buy(i.tier, i.cost); if (credits < i.cost) b.classList.add('disabled'); return b;
}

function renderLoop() {
    const crE = document.getElementById('credits-count'), crC = document.getElementById('credits-container');
    if (crE && crC) { displayCredits += (credits - displayCredits) * 0.15; crE.innerText = Math.round(displayCredits); const t = Date.now()*0.003; crC.style.transform = `translateX(-50%) translateY(${Math.sin(t)*8}px) scale(${1+Math.cos(t*0.7)*0.05})`; }
    gameCtx.clearRect(0,0,gameCanvas.width,gameCanvas.height); bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
    bgCtx.fillStyle = '#8B4513'; bgCtx.fillRect(0, bgCanvas.height-50, bgCanvas.width, 50); bgCtx.fillStyle = '#4CAF50'; bgCtx.fillRect(0, bgCanvas.height-50, bgCanvas.width, 10);
    if (assets.isLoaded) {
        Object.values(balls).forEach(b => {
            const as = assets.getAsset(b.tier); if (as) {
                const img = b.isDragged ? as.win.img : as.idle.img; const w = as.idle.width, h = as.idle.height;
                gameCtx.save(); gameCtx.translate(b.x, b.y); gameCtx.rotate(b.angle); gameCtx.drawImage(img, -w/2, -h/2, w, h); gameCtx.restore();
                if ((Date.now() - lastCreditTick) < 600) {
                    gameCtx.save(); gameCtx.font='24px VT323, monospace'; gameCtx.fillStyle=b.tier===23?'#FF4500':'#FFD700'; gameCtx.textAlign='center'; gameCtx.shadowColor='black'; gameCtx.shadowBlur=4;
                    let val = b.tier===23 ? -1 : (b.tier<=22 ? b.tier : 0); if (val !== 0) gameCtx.fillText(`${val>0?'+':''}${val} a sec`, b.x, b.y-h/2-10); gameCtx.restore();
                }
            }
        });
        const now = Date.now(); for (let i = effects.length-1; i >= 0; i--) {
            const e = effects[i]; const p = (now-e.start)/e.duration; if (p>=1) { effects.splice(i,1); continue; }
            const as = assets.getAsset(e.tier); if (as && as.win) {
                const s = 1+Math.sin(p*Math.PI)*0.5; const w = as.idle.width*s, h = as.idle.height*s;
                gameCtx.globalAlpha = 1-p; gameCtx.drawImage(as.win.img, e.x-w/2, e.y-h/2-(p*50), w, h); gameCtx.globalAlpha = 1;
            }
        }
    }
}

function gameResize() {
    gameCanvas.width = bgCanvas.width = window.innerWidth; gameCanvas.height = bgCanvas.height = window.innerHeight;
    gameCtx.imageSmoothingEnabled = bgCtx.imageSmoothingEnabled = false; if (physics) physics.init(gameCanvas.width, gameCanvas.height);
}

// ==========================================
// 5. MENU LOGIC
// ==========================================

function initMenu() {
    const mC = document.getElementById('menu-canvas'), mCtx = mC.getContext('2d'), mE = document.getElementById('main-menu');
    let mw, mh; const resize = () => { mw = mC.width = window.innerWidth; mh = mC.height = window.innerHeight; mCtx.imageSmoothingEnabled = false; };
    window.addEventListener('resize', resize); resize();
    const imgs = ['/ball1-idle.png','/ball2-idle.png','/ball3-idle.png','/ball4-idle (1).png','/ball5-idle.png','/ball6-idle.png','/ball7-idle.png','/ball8-idle.png','/ball9-idle.png','/ball10-idle.png'].map(s => { const i = new Image(); i.src=s; return i; });
    const sam = new Image(); sam.src = '/sammy.png';
    const resetD = (d={}) => { d.x = Math.random()*mw; d.y = d.y ? -50 : Math.random()*mh; d.size = 32+Math.random()*32; d.speed = 2+Math.random()*4; d.rot = Math.random()*6; d.rotSpeed = (Math.random()-0.5)*0.1; d.img = Math.random()<0.02?sam:imgs[Math.floor(Math.random()*imgs.length)]; return d; };
    const drops = Array.from({length: 20}, () => resetD({y:1}));
    (function loop() {
        if (mE.style.display === 'none') return; mCtx.clearRect(0,0,mw,mh); mCtx.globalAlpha = 0.6;
        drops.forEach(d => { d.y += d.speed; d.rot += d.rotSpeed; if (d.y > mh+50) resetD(d); if (d.img.complete && d.y+d.size > 0) { mCtx.save(); mCtx.translate(d.x, d.y); mCtx.rotate(d.rot); mCtx.drawImage(d.img, -d.size/2, -d.size/2, d.size, d.size); mCtx.restore(); } });
        mCtx.globalAlpha = 1; requestAnimationFrame(loop);
    })();
    let gr = false, tr = false; const ck = () => { const pb = document.getElementById('menu-logo'); if (gr && tr) { pb.style.opacity = '1'; pb.classList.add('ready'); pb.onclick = () => { mE.style.opacity = '0'; setTimeout(() => { mE.style.display = 'none'; startIntro(); }, 1000); }; } };
    window.addEventListener('game-loaded', () => { gr = true; ck(); }); setTimeout(() => { tr = true; ck(); }, 1000);
}

// ==========================================
// 6. STARTUP
// ==========================================
window.addEventListener('start-intro', startIntro);
window.addEventListener('game-ending', startEnding);
window.addEventListener('game-good-ending', startGoodEnding);
window.addEventListener('boss-defeated-cinematic', startBossDefeatCinematic);

initMenu();
initGame();