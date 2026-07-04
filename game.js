(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const finalScoreEl = document.getElementById('final-score');
  const restartBtn = document.getElementById('restart');

  const CONFIG = {
    cooldownMs: 100,
    maxOfficeWorkers: 5,
    officeSpeed: 120,
    officeSpawnMs: 1800,
    tyshchenkoSpeed: 70,
    tyshchenkoMoveRange: 0.22,
    hitFlashMs: 1000,
    tomatoSpeed: 680,
    tomatoRadius: 14,
    loseEdgePadding: 8,
    playerLineRatio: 0.92,
    tyshchenkoTopRatio: 0.05,
    throwFrameMs: 90,
    throwReleaseFrame: 6,
    walkerFrameMs: 110,
    walkerMinScale: 0.72,
    walkerMaxScale: 1.12,
  };

  const THROW_ASSETS = Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => {
      const num = String(index + 1).padStart(2, '0');
      return [`throwPixel${num}`, `assets/throw-pixel-${num}.png`];
    }),
  );

  const ASSETS = {
    background: 'assets/restaurant.png',
    mainFigure: 'assets/main-figure.png',
    faceHit1: 'assets/face-hit-1.png',
    faceHit2: 'assets/face-hit-2.png',
    faceGameover: 'assets/face-gameover.png',
    officeIqos: 'assets/office-iqos.png',
    officeStand: 'assets/office-stand.png',
    meatball: 'assets/meatball.svg',
    ...THROW_ASSETS,
    walker1: 'assets/walker-01.png',
    walker2: 'assets/walker-02.png',
    walker3: 'assets/walker-03.png',
    walker4: 'assets/walker-04.png',
    walker5: 'assets/walker-05.png',
  };

  const THROW_FRAME_KEYS = Array.from({ length: 15 }, (_, index) => {
    const num = String(index + 1).padStart(2, '0');
    return `throwPixel${num}`;
  });
  const WALKER_FRAME_KEYS = ['walker1', 'walker2', 'walker3', 'walker4', 'walker5'];

  const ENEMY_TYPES = [
    { kind: 'office', sprite: 'officeIqos', aspect: 224 / 506 },
    { kind: 'office', sprite: 'officeStand', aspect: 194 / 482 },
    { kind: 'walker', aspect: 115 / 344 },
  ];

  const images = {};
  let loadedCount = 0;
  const totalAssets = Object.keys(ASSETS).length;

  function loadImage(key, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        images[key] = img;
        loadedCount += 1;
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  const pointer = { x: 0, y: 0, active: false };
  let lastThrow = 0;
  let score = 0;
  let gameOver = false;
  let started = false;
  let lastSpawn = 0;
  let gameStartTime = 0;
  let lastFrame = 0;
  let nextHitFace = 1;
  let throwAnimStart = 0;
  let throwAnimActive = false;
  let throwProjectilePending = null;

  const tyshchenko = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    baseX: 0,
    phase: 0,
    hitUntil: 0,
    hitFaceKey: null,
  };

  const tomatoes = [];
  const enemies = [];
  const meatballs = [];

  function playerLineY() {
    return window.innerHeight * CONFIG.playerLineRatio;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutEntities();
    if (!started && !gameOver) {
      pointer.x = window.innerWidth * 0.5;
      pointer.y = window.innerHeight * 0.5;
    }
  }

  function layoutEntities() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const mainAspect = images.mainFigure
      ? images.mainFigure.width / images.mainFigure.height
      : 308 / 649;

    tyshchenko.height = Math.min(h * 0.26, 220);
    tyshchenko.width = tyshchenko.height * mainAspect;
    tyshchenko.baseX = w * 0.78;
    tyshchenko.y = h * CONFIG.tyshchenkoTopRatio;
    tyshchenko.x = tyshchenko.baseX;
  }

  function throwHandLayout(now) {
    const h = window.innerHeight;
    const w = window.innerWidth;
    const frameKey = THROW_FRAME_KEYS[getThrowFrameIndex(now)];
    const img = images[frameKey];
    const aspect = img ? img.width / img.height : 224 / 213;
    const drawHeight = Math.min(h * 0.48, 420);
    const drawWidth = drawHeight * aspect;

    return {
      x: (w - drawWidth) / 2,
      y: h - drawHeight,
      width: drawWidth,
      height: drawHeight,
    };
  }

  function playerOrigin(now) {
    const layout = throwHandLayout(now || performance.now());
    return {
      x: layout.x + layout.width * 0.52,
      y: layout.y + layout.height * 0.32,
    };
  }

  function getThrowFrameIndex(now) {
    if (throwAnimActive) {
      const elapsed = now - throwAnimStart;
      const idx = Math.floor(elapsed / CONFIG.throwFrameMs);
      return Math.min(idx, THROW_FRAME_KEYS.length - 1);
    }
    return 0;
  }

  function resetGame() {
    score = 0;
    gameOver = false;
    started = true;
    lastThrow = 0;
    lastSpawn = 0;
    gameStartTime = performance.now();
    nextHitFace = 1;
    tyshchenko.phase = 0;
    tyshchenko.hitUntil = 0;
    tyshchenko.hitFaceKey = null;
    tomatoes.length = 0;
    enemies.length = 0;
    meatballs.length = 0;
    throwAnimActive = false;
    throwProjectilePending = null;
    scoreEl.textContent = '0';
    overlay.classList.add('hidden');
    layoutEntities();
  }

  function setPointer(clientX, clientY) {
    pointer.x = clientX;
    pointer.y = clientY;
    pointer.active = true;
  }

  function spawnTomatoProjectile(aim) {
    const now = performance.now();
    const origin = playerOrigin(now);
    const dx = aim.x - origin.x;
    const dy = aim.y - origin.y;
    const dist = Math.hypot(dx, dy) || 1;

    tomatoes.push({
      x: origin.x,
      y: origin.y,
      vx: (dx / dist) * CONFIG.tomatoSpeed,
      vy: (dy / dist) * CONFIG.tomatoSpeed,
      radius: CONFIG.tomatoRadius,
    });
  }

  function throwTomato() {
    if (gameOver || loadedCount < totalAssets) return;

    const now = performance.now();
    if (now - lastThrow < CONFIG.cooldownMs) return;

    throwAnimStart = now;
    throwAnimActive = true;
    throwProjectilePending = { x: pointer.x, y: pointer.y };
    lastThrow = now;
  }

  function processThrowAnimation(now) {
    if (!throwAnimActive) return;

    const elapsed = now - throwAnimStart;
    const frameIndex = Math.floor(elapsed / CONFIG.throwFrameMs);

    if (frameIndex === CONFIG.throwReleaseFrame && throwProjectilePending) {
      spawnTomatoProjectile(throwProjectilePending);
      throwProjectilePending = null;
    }

    if (frameIndex >= THROW_FRAME_KEYS.length) {
      throwAnimActive = false;
      throwProjectilePending = null;
    }
  }

  function spawnEnemy() {
    if (enemies.length >= CONFIG.maxOfficeWorkers) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const height = Math.min(h * 0.22, 200);
    const width = height * type.aspect;
    const minX = w * 0.12;
    const maxX = w * 0.88 - width;
    const laneOffset = (enemies.length % 3) * 14;

    const spawnX = minX + Math.random() * Math.max(maxX - minX, 1);

    enemies.push({
      kind: type.kind,
      sprite: type.sprite || null,
      x: spawnX,
      y: -height - laneOffset,
      width,
      height,
      baseWidth: width,
      baseHeight: height,
      centerX: spawnX + width / 2,
      spawnY: -height - laneOffset,
      hp: 1,
      animTime: Math.random() * CONFIG.walkerFrameMs * WALKER_FRAME_KEYS.length,
    });
  }

  function updateWalkerScale(enemy) {
    const playerY = playerLineY();
    const travel = playerY - enemy.spawnY;
    const progress = travel <= 0 ? 0 : Math.min(1, (enemy.y - enemy.spawnY) / travel);
    const scale =
      CONFIG.walkerMinScale + (CONFIG.walkerMaxScale - CONFIG.walkerMinScale) * progress;

    enemy.width = enemy.baseWidth * scale;
    enemy.height = enemy.baseHeight * scale;
    enemy.x = enemy.centerX - enemy.width / 2;
  }

  function enemySpriteKey(enemy) {
    if (enemy.kind === 'walker') {
      const frameIndex = Math.floor(enemy.animTime / CONFIG.walkerFrameMs) % WALKER_FRAME_KEYS.length;
      return WALKER_FRAME_KEYS[frameIndex];
    }
    return enemy.sprite;
  }

  function enemyLoseMessage(enemy) {
    return enemy.kind === 'walker' ? 'Незнайомець дійшов до гравця!' : 'Офісник дійшов до гравця!';
  }

  function triggerTyshchenkoHit() {
    score += 1;
    scoreEl.textContent = String(score);
    tyshchenko.hitFaceKey = nextHitFace === 1 ? 'faceHit1' : 'faceHit2';
    nextHitFace = nextHitFace === 1 ? 2 : 1;
    tyshchenko.hitUntil = performance.now() + CONFIG.hitFlashMs;

    meatballs.push({
      x: tyshchenko.x + tyshchenko.width * 0.45,
      y: tyshchenko.y + tyshchenko.height * 0.82,
      vy: 80,
      vx: (Math.random() - 0.5) * 80,
      size: Math.min(tyshchenko.height * 0.2, 64),
      rotation: 0,
      spin: (Math.random() - 0.5) * 6,
    });
  }

  function circleRectHit(cx, cy, radius, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  function tyshchenkoRect() {
    return {
      x: tyshchenko.x + tyshchenko.width * 0.22,
      y: tyshchenko.y + tyshchenko.height * 0.06,
      width: tyshchenko.width * 0.56,
      height: tyshchenko.height * 0.9,
    };
  }

  function enemyRect(enemy) {
    return {
      x: enemy.x + enemy.width * 0.18,
      y: enemy.y + enemy.height * 0.04,
      width: enemy.width * 0.64,
      height: enemy.height * 0.92,
    };
  }

  function endGame(reason) {
    gameOver = true;
    overlayTitle.textContent = 'Програш';
    overlayText.textContent = reason;
    finalScoreEl.textContent = String(score);
    overlay.classList.remove('hidden');
  }

  function update(dt, now) {
    if (gameOver) return;

    processThrowAnimation(now);

    const w = window.innerWidth;
    tyshchenko.phase += dt;
    tyshchenko.x = tyshchenko.baseX - Math.sin(tyshchenko.phase * CONFIG.tyshchenkoSpeed * 0.02) * (w * CONFIG.tyshchenkoMoveRange);

    if (tyshchenko.hitFaceKey && now >= tyshchenko.hitUntil) {
      tyshchenko.hitFaceKey = null;
    }

    if (now - gameStartTime > 2500 && now - lastSpawn >= CONFIG.officeSpawnMs) {
      spawnEnemy();
      lastSpawn = now;
    }

    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const enemy = enemies[i];
      enemy.y += CONFIG.officeSpeed * dt;
      if (enemy.kind === 'walker') {
        enemy.animTime += dt * 1000;
        updateWalkerScale(enemy);
      }

      if (enemy.y + enemy.height * 0.92 >= playerLineY() - CONFIG.loseEdgePadding) {
        endGame(enemyLoseMessage(enemy));
        return;
      }
    }

    for (let i = tomatoes.length - 1; i >= 0; i -= 1) {
      const tomato = tomatoes[i];
      tomato.x += tomato.vx * dt;
      tomato.y += tomato.vy * dt;

      if (
        tomato.x < -40 ||
        tomato.x > w + 40 ||
        tomato.y < -40 ||
        tomato.y > window.innerHeight + 40
      ) {
        tomatoes.splice(i, 1);
        continue;
      }

      let consumed = false;

      for (let j = enemies.length - 1; j >= 0; j -= 1) {
        const enemy = enemies[j];
        if (circleRectHit(tomato.x, tomato.y, tomato.radius, enemyRect(enemy))) {
          enemy.hp -= 1;
          if (enemy.hp <= 0) enemies.splice(j, 1);
          tomatoes.splice(i, 1);
          consumed = true;
          break;
        }
      }

      if (consumed) continue;

      if (circleRectHit(tomato.x, tomato.y, tomato.radius, tyshchenkoRect())) {
        triggerTyshchenkoHit();
        tomatoes.splice(i, 1);
      }
    }

    for (let i = meatballs.length - 1; i >= 0; i -= 1) {
      const ball = meatballs[i];
      ball.vy += 900 * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.rotation += ball.spin * dt;

      if (ball.y > playerLineY() + 30) {
        meatballs.splice(i, 1);
      }
    }
  }

  function drawBackground() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const img = images.background;

    if (!img) {
      ctx.fillStyle = '#120d0a';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (w - dw) / 2;
    const dy = 0;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function drawThrowHand(now) {
    const frameKey = THROW_FRAME_KEYS[getThrowFrameIndex(now)];
    const img = images[frameKey];
    if (!img) return;

    const layout = throwHandLayout(now);
    drawEntityImage(img, layout.x, layout.y, layout.width, layout.height);
  }

  function drawTomato(tomato) {
    ctx.save();
    ctx.translate(tomato.x, tomato.y);

    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.arc(0, 0, tomato.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(2, -tomato.radius + 2, 5, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-4, -4, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawCrosshair() {
    if (!pointer.active || gameOver) return;

    const x = pointer.x;
    const y = pointer.y;
    const size = 16;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - size - 8, y);
    ctx.lineTo(x - 6, y);
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + size + 8, y);
    ctx.moveTo(x, y - size - 8);
    ctx.lineTo(x, y - 6);
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x, y + size + 8);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 80, 80, 0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.stroke();

    const origin = playerOrigin(performance.now());
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
  }

  function drawCooldown(now) {
    const elapsed = now - lastThrow;
    if (elapsed >= CONFIG.cooldownMs) return;

    const t = 1 - elapsed / CONFIG.cooldownMs;
    const origin = playerOrigin(performance.now());

    ctx.save();
    ctx.strokeStyle = `rgba(255, 180, 80, ${0.35 + t * 0.45})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.stroke();
    ctx.restore();
  }

  function drawEntityImage(img, x, y, width, height) {
    ctx.drawImage(img, x, y, width, height);
  }

  function drawTyshchenko() {
    if (tyshchenko.hitFaceKey && images[tyshchenko.hitFaceKey]) {
      const faceImg = images[tyshchenko.hitFaceKey];
      const faceAspect = faceImg.width / faceImg.height;
      const faceHeight = tyshchenko.height * 0.78;
      const faceWidth = faceHeight * faceAspect;
      drawEntityImage(
        faceImg,
        tyshchenko.x + (tyshchenko.width - faceWidth) / 2,
        tyshchenko.y + tyshchenko.height * 0.04,
        faceWidth,
        faceHeight,
      );
      return;
    }

    drawEntityImage(images.mainFigure, tyshchenko.x, tyshchenko.y, tyshchenko.width, tyshchenko.height);
  }

  function drawScene(now) {
    drawBackground();

    drawTyshchenko();

    for (const enemy of enemies) {
      drawEntityImage(
        images[enemySpriteKey(enemy)],
        enemy.x,
        enemy.y,
        enemy.width,
        enemy.height,
      );
    }

    for (const ball of meatballs) {
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rotation);
      drawEntityImage(images.meatball, -ball.size / 2, -ball.size / 2, ball.size, ball.size);
      ctx.restore();
    }

    for (const tomato of tomatoes) {
      drawTomato(tomato);
    }

    drawThrowHand(now);
    drawCrosshair();
    drawCooldown(now);

    if (loadedCount < totalAssets) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Завантаження...', window.innerWidth / 2, window.innerHeight / 2);
    }
  }

  function frame(now) {
    if (!lastFrame) lastFrame = now;
    const dt = Math.min(0.033, (now - lastFrame) / 1000);
    lastFrame = now;

    if (started && loadedCount >= totalAssets) {
      update(dt, now);
    }

    drawScene(now);
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('mousemove', (event) => {
    setPointer(event.clientX, event.clientY);
  });

  canvas.addEventListener('mousedown', (event) => {
    setPointer(event.clientX, event.clientY);
    if (!started) resetGame();
    throwTomato();
  });

  canvas.addEventListener(
    'touchstart',
    (event) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      setPointer(touch.clientX, touch.clientY);
      if (!started) resetGame();
      throwTomato();
    },
    { passive: false },
  );

  canvas.addEventListener(
    'touchmove',
    (event) => {
      event.preventDefault();
      const touch = event.touches[0];
      setPointer(touch.clientX, touch.clientY);
    },
    { passive: false },
  );

  restartBtn.addEventListener('click', resetGame);
  window.addEventListener('resize', resize);

  Promise.all(Object.entries(ASSETS).map(([key, src]) => loadImage(key, src)))
    .then(() => {
      resize();
      pointer.x = window.innerWidth * 0.5;
      pointer.y = window.innerHeight * 0.5;
      pointer.active = true;
      requestAnimationFrame(frame);
    })
    .catch(() => {
      overlayTitle.textContent = 'Помилка';
      overlayText.textContent = 'Не вдалося завантажити зображення.';
      overlay.classList.remove('hidden');
    });
})();
