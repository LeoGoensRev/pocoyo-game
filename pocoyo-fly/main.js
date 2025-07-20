// Pocoyo Flying Game – Phaser 3
// main.js (Refactored with improvements and responsive fixes)

// --- CONSTANTS & CONFIG ---
const GRAVITY = 400;
const FLY_VELOCITY = -400;
let STAR_SPEED = 200;
const STAR_SPEED_INCREMENT = 10;
const MAX_LIVES = 3;
const UI_MARGIN_RATIO = 0.04;
const MIN_MARGIN = 32;
const FONT_RATIO = 25;

// --- GAME STATE ---
let score = 0;
let scoreText;
let bgMusic;
let gameOver = false;
let missedStars = 0;
let alienActive = false;
let alienTimer = null;

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  getCharacterScale() {
    const sw = this.scale.width;
    if (sw < 600) return 0.18; // xs
    if (sw < 900) return 0.25; // sm
    if (sw < 1200) return 0.30; // md
    if (sw < 1536) return 0.40; // lg
    return 0.55; // xl
  }

  preload() {
    this.load.image('bg', 'assets/bg.png');
    this.load.image('intro', 'assets/Intro.png');
    this.load.image('pocoyo', 'assets/pocoyo.png');
    this.load.image('star', 'assets/star.png');
    this.load.image('propeller', 'assets/propeller.png');
    this.load.image('life', 'assets/life.jpg');
    this.load.image('alien', 'assets/alien.png');
    this.load.audio('jump', 'assets/jump.mp3');
    this.load.audio('bgmusic', 'assets/bg-music.mp3');
    this.load.audio('catch', 'assets/catch.mp3');
    this.load.audio('gameover', 'assets/gameover.mp3');
    this.load.audio('punch', 'assets/punch.mp3');
    this.load.video('bgvideo', 'assets/background.mp4', 'loadeddata', false, true);
  }

  spawnAlien() {
    if (alienActive || gameOver) return;
    alienActive = true;
    // Make alien smaller than star and pocoyo
    const alienScale = this.getCharacterScale() * 0.05; // slightly larger than star
    // Randomize y, avoid overlap with star (star yFrac: 0.2-0.8)
    let yFrac = Phaser.Math.FloatBetween(0.15, 0.85);
    if (this.stars && this.stars.getChildren().length > 0) {
      const star = this.stars.getChildren()[0];
      if (star) {
        // If too close to star, nudge alien up or down
        const starYFrac = star.y / this.scale.height;
        if (Math.abs(yFrac - starYFrac) < 0.18) {
          yFrac = (yFrac > 0.5) ? yFrac - 0.18 : yFrac + 0.18;
          yFrac = Phaser.Math.Clamp(yFrac, 0.15, 0.85);
        }
      }
    }
    const y = this.scale.height * yFrac;
    const alien = this.alienGroup.create(this.scale.width + 10, y, 'alien').setScale(alienScale);
    alien.body.allowGravity = false;
    alien.wavePhase = Math.random() * Math.PI * 2;
    alien.waveSpeed = 0.9 + Math.random() * 0.8; // slightly faster wave
    alien.waveAmplitude = 40 + Math.random() * 30;
    alien.baseY = y;
    alien.alienSpeed = (STAR_SPEED + 90); // faster than star
    // Optionally, add anchor plugin support here if needed
  }

  create() {
    this.bgVideo = this.add.video(this.scale.width / 2, this.scale.height / 2, 'bgvideo');
    this.bgVideo.setDisplaySize(this.scale.width, this.scale.height);
    this.bgVideo.play(true);

    this.topMargin = Math.max(MIN_MARGIN, this.scale.height * UI_MARGIN_RATIO);
    this.bottomMargin = Math.max(MIN_MARGIN, this.scale.height * UI_MARGIN_RATIO);

    this.introBg = this.add.rectangle(
      0,
      0,
      this.scale.width,
      this.scale.height,
      0x1c91d2
    ).setOrigin(0, 0);

    this.introImg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'intro');
    this.setIntroImgSize?.();

    this.introBtn = this.add.text(this.scale.width / 2, this.scale.height * 0.75, '', {
      fontFamily: 'POCOYO TV, Arial, sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Initialize sounds here so they're ready for startGame
    this.jumpSound = this.sound.add('jump');
    this.catchSound = this.sound.add('catch');
    this.punchSound = this.sound.add('punch');
    this.gameOverSound = this.sound.add('gameover');

    this.input.once('pointerdown', () => {
      this.introBg.destroy();
      this.introImg.destroy();
      this.introBtn.destroy();
      this.startGame();
    });

    // Unified resize handler for both intro and game
    this.scale.on('resize', this.handleResize, this);
    // Initial layout
    this.handleResize({ width: this.scale.width, height: this.scale.height });
  }
  startGame() {
    score = 0;
    missedStars = 0;
    STAR_SPEED = 200;

    this.createPocoyoContainer();

    this.input.keyboard.on('keydown-SPACE', this.fly, this);
    this.input.on('pointerdown', this.fly, this);

    // Create groups for stars and alien
    this.stars = this.physics.add.group();
    this.alienGroup = this.physics.add.group();
    this.spawnStar();
    this.scheduleAlien();

    this.createScoreAndLivesUI();
    if (scoreText) scoreText.setVisible(true);

    // Play background music
    bgMusic = this.sound.add('bgmusic', { loop: true, volume: 0.5 });
    bgMusic.play();

    // Overlaps
    this.physics.add.overlap(this.pocoyoContainer, this.stars, this.collectStar, null, this);
    this.physics.add.overlap(this.pocoyoContainer, this.alienGroup, this.hitAlien, null, this);

    // Layout
    this.handleResize({ width: this.scale.width, height: this.scale.height });
  }

  handleResize(gameSize) {
    const sw = gameSize.width;
    const sh = gameSize.height;
    this.topMargin = Math.max(MIN_MARGIN, this.scale.height * UI_MARGIN_RATIO);
    this.bottomMargin = Math.max(MIN_MARGIN, this.scale.height * UI_MARGIN_RATIO);

    // --- INTRO SCREEN ---
    if (this.introBg && this.introBg.active !== false && typeof this.introBg.setSize === 'function') {
      this.introBg.setSize(sw, sh);
      this.introBg.setPosition(0, 0);
    }
    let imgBottom = sh / 2;
    if (this.introImg && this.introImg.active !== false) {
      const tex = this.textures.get('intro')?.getSourceImage();
      if (tex) {
        const iw = tex.width;
        const ih = tex.height;
        const btnFont = Math.max(32, Math.floor(sw / 18));
        const maxImgHeight = sh * 0.98 - btnFont * 2.2;
        let scale = Math.min(sw * 0.98 / iw, maxImgHeight / ih);
        this.introImg.displayWidth = iw * scale;
        this.introImg.displayHeight = ih * scale;
        this.introImg.setPosition(sw / 2, sh / 2 - btnFont * 0.7);
        imgBottom = this.introImg.y + this.introImg.displayHeight / 2;
      }
    }
    if (this.introBtn && this.introBtn.active !== false) {
      const btnFont = Math.max(32, Math.floor(sw / 18));
      let btnY = imgBottom + btnFont * 1.1;
      if (btnY > sh - btnFont * 1.2) btnY = sh - btnFont * 1.2;
      this.introBtn.setPosition(sw / 2, btnY);
      this.introBtn.setFontSize(btnFont);
    }

    // --- GAME SCREEN ---
    if (this.bgVideo && this.bgVideo.active !== false) {
      this.bgVideo.setDisplaySize(sw, sh);
      this.bgVideo.setPosition(sw / 2, sh / 2);
    }
    if (scoreText) {
      const scoreFontSize = Math.max(16, Math.floor(sw / FONT_RATIO));
      const yUI = this.topMargin;
      scoreText.setFontSize(scoreFontSize).setPosition(32, yUI);
    }
    if (this.livesImages && this.livesBg) {
      const scoreFontSize = Math.max(16, Math.floor(sw / FONT_RATIO));
      const yUI = this.topMargin;
      const livesBgWidth = Math.max(350, Math.floor(sw * 0.13));
      const livesBgHeight = scoreFontSize + 24;
      this.livesBg.clear();
      this.livesBg.fillStyle(0xffffff, 0.7);
      this.livesBg.fillRoundedRect(sw - livesBgWidth, yUI, livesBgWidth, livesBgHeight, 10);
      // Update life images
      const lifeSize = scoreFontSize + 10;
      for (let i = 0; i < this.livesImages.length; i++) {
        this.livesImages[i].setDisplaySize(lifeSize, lifeSize);
        this.livesImages[i].setPosition(sw - livesBgWidth + 8 + i * (lifeSize + 8), yUI + livesBgHeight / 2);
      }
    }
    // Responsive alien(s)
    if (this.alienGroup) {
      const alienScale = this.getCharacterScale();
      this.alienGroup.children.iterate((alien) => {
        if (alien) alien.setScale(alienScale);
      });
    }
    // Reposition player if needed (when not using rexAnchor)
    const rexAnchor = this.plugins.get('rexAnchor');
    if (!rexAnchor && this.pocoyoContainer) {
      const x = Math.max(sw * 0.15, 120);
      // Always clamp y to valid range after resize
      if (this.pocoyo && this.pocoyoContainer.body) {
        const pocoyoHeight = this.pocoyo.displayHeight;
        const minY = this.topMargin + pocoyoHeight / 2;
        const maxY = this.scale.height - this.bottomMargin - (pocoyoHeight / 2);
        // Clamp current y or use minY if undefined
        let newY = this.pocoyoContainer.y;
        if (typeof newY !== 'number' || isNaN(newY)) newY = minY;
        newY = Math.max(minY, Math.min(maxY, newY));
        this.pocoyoContainer.setPosition(x, newY);
        this.pocoyoContainer.body.setVelocityY(0);
      } else {
        this.pocoyoContainer.setPosition(x, sh * 0.5);
      }
    }
  }

  createPocoyoContainer() {
    const pocoyoScale = this.getCharacterScale();
    this.pocoyoContainer = this.add.container(0, 0);
    this.pocoyo = this.add.sprite(0, 0, 'pocoyo').setScale(pocoyoScale);
    this.propeller = this.add.sprite(350 * pocoyoScale, 120 * pocoyoScale, 'propeller')
      .setScale(pocoyoScale * 0.67)
      .setOrigin(0.5);
    this.pocoyoContainer.add([this.pocoyo, this.propeller]);
    this.physics.world.enable(this.pocoyoContainer);
    this.pocoyoContainer.body.setCollideWorldBounds(true);
    this.pocoyoContainer.body.setSize(420 * pocoyoScale, 120 * pocoyoScale);
    this.pocoyoContainer.body.setOffset(0, 25 * pocoyoScale / 0.3); // 0.3 is base scale reference

    const rexAnchor = this.plugins.get('rexAnchor');
    if (rexAnchor && typeof rexAnchor.add === 'function') {
      rexAnchor.add(this.pocoyoContainer, {
        left: '20%',
        centerY: '50%'
      });
    } else {
      const x = Math.max(this.scale.width * 0.15, 120);
      const y = this.scale.height * 0.5;
      this.pocoyoContainer.setPosition(x, y);
      console.warn('rexAnchor plugin not found');
    }
  }

  createScoreAndLivesUI() {
    const yUI = this.topMargin;
    const scoreFontSize = Math.max(16, Math.floor(this.scale.width / FONT_RATIO));
    scoreText = this.add.text(32, yUI, 'STARS: 0', {
      fontFamily: 'POCOYO TV, Arial, sans-serif',
      fontSize: scoreFontSize + 'px',
      color: '#709450',
      align: 'left'
    }).setOrigin(0, 0);

    const livesBgWidth = Math.max(190, Math.floor(this.scale.width * 0.13));
    const livesBgHeight = scoreFontSize + 24;
    this.livesBg = this.add.graphics();
    this.livesBg.fillStyle(0xffffff, 0.7);
    this.livesBg.fillRoundedRect(this.scale.width - livesBgWidth, yUI, livesBgWidth, livesBgHeight, 10);

    // Add life images instead of text hearts
    this.livesImages = [];
    const lifeSize = scoreFontSize + 10;
    for (let i = 0; i < MAX_LIVES; i++) {
      const img = this.add.image(
        this.scale.width - livesBgWidth + 8 + i * (lifeSize + 8),
        yUI + livesBgHeight / 2,
        'life'
      ).setDisplaySize(lifeSize, lifeSize).setOrigin(0, 0.5);
      this.livesImages.push(img);
    }
  }

  updateLivesDisplay() {
    if (!this.livesImages) return;
    for (let i = 0; i < this.livesImages.length; i++) {
      this.livesImages[i].setVisible(i < (MAX_LIVES - missedStars));
    }
  }

  update() {
    if (gameOver) return;
    if (this.propeller) this.propeller.rotation += 0.10;

    const t = this.time.now / 1000;
    // Move stars
    this.stars?.children?.iterate((star) => {
      if (!star) return;
      star.x -= STAR_SPEED * (1/60);
      if (star.wavePhase !== undefined) {
        star.y = star.baseY + Math.sin(t * star.waveSpeed + star.wavePhase) * star.waveAmplitude;
      }
      star.rotation += 0.008;
      if (star.x < -32) {
        star.destroy();
        missedStars++;
        this.updateLivesDisplay();
        if (missedStars >= MAX_LIVES && !gameOver) return this.endGame();
        this.spawnStar();
      }
    });
    // Move alien(s)
    if (this.alienGroup) {
      this.alienGroup.children.iterate((alien) => {
        if (!alien) return;
        alien.x -= (STAR_SPEED + 100) * (1/20); // Alien moves a bit faster than stars
        if (alien.wavePhase !== undefined) {
          alien.y = alien.baseY + Math.sin(t * alien.waveSpeed + alien.wavePhase) * alien.waveAmplitude;
        }
        if (alien.x < -48) {
          alien.destroy();
          alienActive = false;
          this.scheduleAlien();
        }
      });
    }
    if (this.pocoyoContainer?.body && this.pocoyo) {
      const pocoyoHeight = this.pocoyo.displayHeight;
      const minY = this.topMargin + pocoyoHeight / 2;
      const maxY = this.scale.height - this.bottomMargin - (pocoyoHeight / 3);
      if (this.pocoyoContainer.y < minY) {
        this.pocoyoContainer.y = minY;
        this.pocoyoContainer.body.setVelocityY(0);
      } else if (this.pocoyoContainer.y > maxY) {
        this.pocoyoContainer.y = maxY - 1; // Nudge up slightly to allow smoother jump
        this.pocoyoContainer.body.setVelocityY(-30); // Help Pocoyo lift off again
      }
    }
  }
  // --- ALIEN LOGIC ---
  scheduleAlien() {
    // Only one alien at a time
    if (alienActive) return;
    // Random delay between 2.5s and 7s
    const delay = Phaser.Math.Between(2500, 7000);
    if (alienTimer) clearTimeout(alienTimer);
    alienTimer = setTimeout(() => {
      this.spawnAlien();
    }, delay);
  }

  spawnAlien() {
    if (alienActive || gameOver) return;
    alienActive = true;
    const alienScale = this.getCharacterScale();
    const yFrac = Phaser.Math.FloatBetween(0.18, 0.82);
    const y = this.scale.height * yFrac;
    const alien = this.alienGroup.create(this.scale.width + 48, y, 'alien').setScale(alienScale);
    alien.body.allowGravity = false;
    alien.baseY = y;
  }

  hitAlien(_, alien) {
    if (!alienActive || gameOver) return;
    alien.destroy();
    alienActive = false;
    if (this.punchSound) this.punchSound.play();
    missedStars++;
    this.updateLivesDisplay();
    if (missedStars >= MAX_LIVES && !gameOver) {
      this.endGame();
    } else {
      this.scheduleAlien();
    }
  }

  fly() {
    if (gameOver) return;
    this.pocoyoContainer?.body?.setVelocityY(FLY_VELOCITY);
    this.jumpSound.play();
  }

  spawnStar() {
    const starScale = this.getCharacterScale();
    const yFrac = Phaser.Math.FloatBetween(0.2, 0.8);
    const y = this.scale.height * yFrac;
    const star = this.stars.create(this.scale.width + 32, y, 'star').setScale(starScale);
    star.body.allowGravity = false;
    star.wavePhase = Math.random() * Math.PI * 2;
    star.waveSpeed = 0.8 + Math.random() * 0.5;
    star.waveAmplitude = 36 + Math.random() * 24;
    star.baseY = y;

    const rexAnchor = this.plugins.get('rexAnchor');
    if (rexAnchor && typeof rexAnchor.add === 'function') {
      rexAnchor.add(star, {
        right: '100%',
        centerY: `${Math.round(yFrac * 100)}%`
      });
    }
  }

  collectStar(_, star) {
    star.destroy();
    score++;
    this.updateScoreText();
    this.catchSound.play();
    STAR_SPEED += STAR_SPEED_INCREMENT;
    this.spawnStar();
  }

  updateScoreText() {
    scoreText.setText(`STARS: ${score}`);
  }

  endGame() {
    gameOver = true;
    this.physics.pause();
    bgMusic.stop();
    if (this.gameOverSound) this.gameOverSound.play();
    // Hide the top score UI
    if (scoreText) scoreText.setVisible(false);
    // Remove alien(s) and clear timer
    if (this.alienGroup) this.alienGroup.clear(true, true);
    alienActive = false;
    if (alienTimer) clearTimeout(alienTimer);
    // Show final score big and colored
    const finalScoreFont = Math.max(10, Math.floor(this.scale.width / 15)) + 'px';
    this.add.text(this.scale.width / 2, this.scale.height / 2,
      `FINAL STARS\n${score}`, {
        fontFamily: 'POCOYO TV, Arial, sans-serif',
        fontSize: finalScoreFont,
        color: '#ffb300',
        stroke: '#000',
        strokeThickness: 10,
        align: 'center',
        fontStyle: 'bold'
      }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      gameOver = false;
      missedStars = 0;
      alienActive = false;
      if (alienTimer) clearTimeout(alienTimer);
      this.scene.restart();
    });
  }
}

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GRAVITY },
      debug: false
    }
  },
  scene: MainScene,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);
