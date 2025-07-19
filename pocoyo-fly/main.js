// Optionally, preload intro asset if different from bg

// Pocoyo Flying Game – Phaser 3
// main.js

// --- CONSTANTS & CONFIG ---
let GAME_WIDTH = window.innerWidth;
let GAME_HEIGHT = window.innerHeight;
const GRAVITY = 900;
const FLY_VELOCITY = -350;
let STAR_SPEED = 200;
const STAR_SPEED_INCREMENT = 10; // Increase per star

// --- GAME STATE ---
let score = 0;
let scoreText;
let bgMusic;
let gameOver = false;
let missedStars = 0;

// --- PHASER CONFIGURATION ---
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GRAVITY },
      debug: false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);

// --- STEP 3: PRELOAD ASSETS ---
function preload() {
  // Load all assets from local assets/ folder
  this.load.image('bg', 'assets/bg.png'); // Background
  this.load.image('intro', 'assets/Intro.png'); // Intro overlay image
  this.load.image('pocoyo', 'assets/pocoyo.png'); // Main character
  this.load.image('star', 'assets/star.png'); // Collectible
  this.load.audio('jump', 'assets/jump.mp3'); // Jump sound
  this.load.audio('bgmusic', 'assets/bg-music.mp3'); // Background music
  this.load.audio('catch', 'assets/catch.mp3'); // Catch sound for collecting a star
  this.load.video('bgvideo', 'assets/background.mp4', 'loadeddata', false, true);

}

// --- STEP 4: CREATE GAME OBJECTS ---
function create() {
  this.bgVideo = this.add.video(this.scale.width / 2, this.scale.height / 2, 'bgvideo');
  this.bgVideo.setDisplaySize(this.scale.width, this.scale.height);
  this.bgVideo.play(true); // true = loop
  // On resize, update video size/position
  this.scale.on('resize', function(gameSize) {
    this.bgVideo.setDisplaySize(gameSize.width, gameSize.height);
    this.bgVideo.setPosition(gameSize.width / 2, gameSize.height / 2);
  }, this);

  // --- INTRO SCREEN ---
  // (Removed static background image, only bgVideo is used)

  // Show intro overlay using Intro.png
  this.introImg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'intro');
  // Aspect-ratio-preserving scaling for intro image to cover the screen
  const setIntroImgSize = () => {
    if (!this.introImg) return;
    const sw = this.scale.width;
    const sh = this.scale.height;
    const tex = this.textures.get('intro').getSourceImage();
    if (!tex) return;
    const iw = tex.width;
    const ih = tex.height;
    const screenRatio = sw / sh;
    const imgRatio = iw / ih;
    let dw, dh;
    if (screenRatio > imgRatio) {
      // Screen is wider than image: match width, scale height
      dw = sw;
      dh = sw / imgRatio;
    } else {
      // Screen is taller than image: match height, scale width
      dh = sh;
      dw = sh * imgRatio;
    }
    this.introImg.displayWidth = dw;
    this.introImg.displayHeight = dh;
    this.introImg.setPosition(sw / 2, sh / 2);
    return { dw, dh };
  };
  const introImgDims = setIntroImgSize();
  // Title and button on top of intro image
  const introBtnY = this.scale.height / 2 + (introImgDims ? introImgDims.dh : this.scale.height) / 3;
  this.introBtn = this.add.text(this.scale.width / 2, introBtnY, '', {
    fontFamily: 'POCOYO TV, Arial, sans-serif',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  // Start game on any tap/click
  this.input.once('pointerdown', () => {
    this.introImg.destroy();
    this.introBtn.destroy();
    startGame.call(this);
  });

  // Responsive resize for intro
  this.scale.on('resize', function(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    this.bgVideo.setDisplaySize(width, height);
    this.bgVideo.setPosition(width / 2, height / 2);
    if (this.introImg && this.introBtn) {
      // Re-apply aspect-ratio-preserving scaling
      const tex = this.textures.get('intro').getSourceImage();
      if (tex) {
        const iw = tex.width;
        const ih = tex.height;
        const screenRatio = width / height;
        const imgRatio = iw / ih;
        let dw, dh;
        if (screenRatio > imgRatio) {
          dw = width;
          dh = width / imgRatio;
        } else {
          dh = height;
          dw = height * imgRatio;
        }
        this.introImg.displayWidth = dw;
        this.introImg.displayHeight = dh;
        this.introImg.setPosition(width / 2, height / 2);
        this.introBtn.setPosition(width / 2, height / 2 + dh / 4);
        this.introBtn.setFontSize(Math.max(32, Math.floor(width / 18)));
      }
    }
  }, this);
}

// --- START GAME LOGIC ---
function startGame() {
  // 2. Pocoyo sprite with physics
  this.pocoyo = this.physics.add.sprite(100, this.scale.height / 2, 'pocoyo').setScale(0.3);
  this.pocoyo.setCollideWorldBounds(true);

  // 3. Input: spacebar (desktop), or any tap/touch (mobile/tablet)
  this.input.keyboard.on('keydown-SPACE', fly, this);
  this.input.on('pointerdown', fly, this);
  // 4. Stars group (collectibles)
  this.stars = this.physics.add.group();
  spawnStar.call(this);

  // 5. Score text (left) and lives hearts (right)
  score = 0;
  let scoreFontSize = Math.max(10, Math.floor(this.scale.width / 25));
  scoreText = this.add.text(32, 60, 'STARS: 0', {
    fontFamily: 'POCOYO TV, Arial, sans-serif',
    fontSize: scoreFontSize + 'px',
    color: '#709450',
    align: 'left'
  }).setOrigin(0, 0.5);

  // Add a semi-transparent rounded rectangle background for hearts
  const livesBgWidth = 160;
  const livesBgHeight = scoreFontSize + 24;
  this.livesBg = this.add.graphics();
  this.livesBg.fillStyle(0xffffff, 0.7);
  this.livesBg.fillRoundedRect(this.scale.width - livesBgWidth, 60 - livesBgHeight/2, livesBgWidth, livesBgHeight, 10);

  // Add ASCII hearts for lives
  const makeHearts = (lives) => '♥'.repeat(lives) + ''.repeat(3 - lives);
  this.livesHearts = this.add.text(this.scale.width - 32, 60, makeHearts(3), {
    fontFamily: 'POCOYO TV, Arial, sans-serif',
    fontSize: scoreFontSize + 10 + 'px',
    color: '#e63946',
    align: 'right'
  }).setOrigin(1, 0.5);

  // 6. Sounds
  this.jumpSound = this.sound.add('jump');
  this.catchSound = this.sound.add('catch');
  bgMusic = this.sound.add('bgmusic', { loop: true, volume: 0.2 });
  bgMusic.play();

  // 7. Collisions: Pocoyo <-> Stars
  this.physics.add.overlap(this.pocoyo, this.stars, collectStar, null, this);

  // --- Handle resizing ---
  this.scale.on('resize', resizeGame, this);
}

// --- STEP 5: CONTROLS, GRAVITY, INFINITE BACKGROUND ---
function update() {
  if (gameOver) return;

  // 1. Scroll background for endless effect
  // No background scrolling needed for a static, stretched background

  // 2. Move stars left, respawn if off screen, rotate, and move up/down in a wavy pattern
  if (this.stars && this.stars.children && typeof this.stars.children.iterate === 'function') {
    const t = this.time.now / 1000; // seconds
    this.stars.children.iterate(function(star) {
      if (star) {
        star.x -= STAR_SPEED * (1/60);
        // Wavy up/down movement
        if (star.wavePhase !== undefined) {
          star.y = star.baseY + Math.sin(t * star.waveSpeed + star.wavePhase) * star.waveAmplitude;
        }
        star.rotation += 0.008; // Rotate star each frame (slower)
        if (star.x < -32) {
          star.destroy();
          missedStars += 1;
          if (this.livesHearts) {
            const lives = Math.max(0, 3 - missedStars);
            this.livesHearts.setText('♥'.repeat(lives) + ''.repeat(3 - lives));
          }
          if (missedStars >= 3 && !gameOver) {
            endGame.call(this);
            return;
          }
          spawnStar.call(this);
        }
      }
    }, this);
  }

  // 3. Game over if Pocoyo falls off screen (just reset position, not game over)
  if (this.pocoyo && (this.pocoyo.y > this.scale.height || this.pocoyo.y < 0)) {
    this.pocoyo.setPosition(100, this.scale.height / 2);
    this.pocoyo.setVelocity(0, 0);
  }
}

// --- Handle Phaser resize event ---
function resizeGame(gameSize) {
  const width = gameSize.width;
  const height = gameSize.height;
  // Resize video background to always cover the screen
  if (this.bgVideo) {
    this.bgVideo.setDisplaySize(width, height);
    this.bgVideo.setPosition(width / 2, height / 2);
  }
  // Responsive font size and position for score and lives
  if (scoreText) {
    let scoreFontSize = Math.max(60, Math.floor(width / 8));
    scoreText.setFontSize(scoreFontSize);
    scoreText.setPosition(32, 60);
  }
  if (this.livesHearts && this.livesBg) {
    let scoreFontSize = Math.max(60, Math.floor(width / 8));
    this.livesHearts.setFontSize(scoreFontSize + 10);
    this.livesHearts.setPosition(width - 32, 60);
    // Redraw and reposition the background
    const livesBgWidth = 120;
    const livesBgHeight = scoreFontSize + 24;
    this.livesBg.clear();
    this.livesBg.fillStyle(0xffffff, 0.7);
    this.livesBg.fillRoundedRect(width - 32 - livesBgWidth, 60 - livesBgHeight/2, livesBgWidth, livesBgHeight, 24);
  }
  // Responsive position and size for jump hint
  if (this.jumpHint) {
    this.jumpHint.setPosition(width / 2, height - 80);
    let hintFontSize = Math.max(32, Math.floor(width / 18));
    this.jumpHint.setFontSize(hintFontSize);
  }
}

// --- STEP 5: FLY CONTROL ---
function fly() {
  if (gameOver) return;
  this.pocoyo.setVelocityY(FLY_VELOCITY);
  this.jumpSound.play();
}

// --- STEP 6: SPAWN COLLECTIBLES ---
function spawnStar() {
  const y = Phaser.Math.Between(80, this.scale.height - 80);
  const star = this.stars.create(this.scale.width + 32, y, 'star').setScale(0.3);
  star.body.allowGravity = false;
  // Give each star a random wave phase and amplitude for up/down movement
  star.wavePhase = Math.random() * Math.PI * 2;
  star.waveSpeed = 0.8 + Math.random() * 0.5; // radians per second, slow
  star.waveAmplitude = 36 + Math.random() * 24; // pixels (more pronounced)
  star.baseY = y;
}

// --- STEP 6: SCORING SYSTEM ---
function collectStar(pocoyo, star) {
  star.destroy();
  score += 1;
  scoreText.setText('STARS: ' + score);
  this.catchSound.play(); // Play catch sound when collecting a star
  // Increase star speed each time a star is collected
  STAR_SPEED += STAR_SPEED_INCREMENT;
  spawnStar.call(this);
}

// --- STEP 8: GAME OVER & RESTART ---
function endGame() {
  gameOver = true;
  this.physics.pause();
  bgMusic.stop();
  const gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER\nYOU MISSED 3 STARS!\nCLICK OR TAP TO RESTART', {
    fontFamily: 'POCOYO TV, Arial, sans-serif',
    fontSize: '48px',
    color: '#fff',
    stroke: '#000',
    strokeThickness: 8,
    align: 'center'
  }).setOrigin(0.5);
  if (this.livesHearts) {
    this.livesHearts.setText('♡♡♡');
  }
  // Block input until restart, then re-enable
  this.input.once('pointerdown', () => {
    gameOver = false;
    missedStars = 0;
    this.scene.restart();
  });
}
