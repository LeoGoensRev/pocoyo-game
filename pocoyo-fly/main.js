// Pocoyo Flying Game – Phaser 3
// main.js (Refactored with improvements and responsive fixes)

// --- CONSTANTS & CONFIG ---
const GRAVITY = 400;
const FLY_VELOCITY = -400;
let STAR_SPEED = 150;
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
    this.load.audio('jump', 'assets/jump.mp3');
    this.load.audio('bgmusic', 'assets/bg-music.mp3');
    this.load.audio('catch', 'assets/catch.mp3');
    this.load.video('bgvideo', 'assets/background.mp4', 'loadeddata', false, true);
  }

  create() {
    this.bgVideo = this.add.video(this.scale.width / 2, this.scale.height / 2, 'bgvideo');
    this.bgVideo.setDisplaySize(this.scale.width, this.scale.height);
    this.bgVideo.play(true);
    this.scale.on('resize', (gameSize) => {
      this.bgVideo.setDisplaySize(gameSize.width, gameSize.height);
      this.bgVideo.setPosition(gameSize.width / 2, gameSize.height / 2);
    });

    this.topMargin = Math.max(MIN_MARGIN, this.scale.height * UI_MARGIN_RATIO);
    this.bottomMargin = Math.max(MIN_MARGIN, this.scale.height * UI_MARGIN_RATIO);

    this.introBg = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x1c91d2
    ).setOrigin(0.5);

    this.introImg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'intro');
    this.setIntroImgSize();

    this.introBtn = this.add.text(this.scale.width / 2, this.scale.height * 0.75, '', {
      fontFamily: 'POCOYO TV, Arial, sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.input.once('pointerdown', () => {
      this.introBg.destroy();
      this.introImg.destroy();
      this.introBtn.destroy();
      this.startGame();
    });

    this.scale.on('resize', function(gameSize) {
      this.topMargin = Math.max(MIN_MARGIN, gameSize.height * UI_MARGIN_RATIO);
      this.bottomMargin = Math.max(MIN_MARGIN, gameSize.height * UI_MARGIN_RATIO);
      if (this.introBg) {
        this.introBg.setSize(gameSize.width, gameSize.height);
        this.introBg.setPosition(gameSize.width / 2, gameSize.height / 2);
      }
      this.setIntroImgSize();
      this.introBtn.setPosition(gameSize.width / 2, gameSize.height * 0.75);
      this.introBtn.setFontSize(Math.max(32, Math.floor(gameSize.width / 18)));
    }, this);
  }

  setIntroImgSize() {
    if (!this.introImg) return;
    const sw = this.scale.width;
    const sh = this.scale.height;
    const tex = this.textures.get('intro').getSourceImage();
    if (!tex) return;
    const iw = tex.width;
    const ih = tex.height;
    let scale = Math.min(sw * 0.9 / iw, sh * 0.9 / ih);
    this.introImg.displayWidth = iw * scale;
    this.introImg.displayHeight = ih * scale;
    this.introImg.setPosition(sw / 2, sh / 2);
  }

  startGame() {
    score = 0;
    missedStars = 0;
    STAR_SPEED = 200;

    this.createPocoyoContainer();

    this.input.keyboard.on('keydown-SPACE', this.fly, this);
    this.input.on('pointerdown', this.fly, this);

    this.stars = this.physics.add.group();
    this.spawnStar();

    this.createScoreAndLivesUI();

    this.jumpSound = this.sound.add('jump');
    this.catchSound = this.sound.add('catch');
    bgMusic = this.sound.add('bgmusic', { loop: true, volume: 0.5 });
    bgMusic.play();

    this.physics.add.overlap(this.pocoyoContainer, this.stars, this.collectStar, null, this);

    this.scale.on('resize', this.resizeGame, this);
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

  // Remove makeHearts, not needed anymore

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
    if (this.pocoyoContainer?.body && this.pocoyo) {
      const pocoyoHeight = this.pocoyo.displayHeight;
      const minY = this.topMargin + pocoyoHeight / 2;
      const maxY = this.scale.height - this.bottomMargin - (pocoyoHeight / 2);
      if (this.pocoyoContainer.y < minY) {
        this.pocoyoContainer.y = minY;
        this.pocoyoContainer.body.setVelocityY(0);
      } else if (this.pocoyoContainer.y > maxY) {
        this.pocoyoContainer.y = maxY - 1; // Nudge up slightly to allow smoother jump
        this.pocoyoContainer.body.setVelocityY(-30); // Help Pocoyo lift off again
      }
    }
  }

  resizeGame(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    this.topMargin = Math.max(MIN_MARGIN, height * UI_MARGIN_RATIO);
    this.bottomMargin = Math.max(MIN_MARGIN, height * UI_MARGIN_RATIO);

    this.bgVideo?.setDisplaySize(width, height).setPosition(width / 2, height / 2);

    if (scoreText) {
      const scoreFontSize = Math.max(16, Math.floor(width / FONT_RATIO));
      const yUI = this.topMargin;
      scoreText.setFontSize(scoreFontSize).setPosition(32, yUI);
    }

    if (this.livesHearts && this.livesBg) {
      const scoreFontSize = Math.max(16, Math.floor(width / FONT_RATIO));
      const yUI = this.topMargin;
      const livesBgWidth = Math.max(160, Math.floor(width * 0.13));
      const livesBgHeight = scoreFontSize + 24;
      this.livesHearts.setFontSize(scoreFontSize + 10).setPosition(width - 32, yUI + livesBgHeight / 2);
      this.livesBg.clear();
      this.livesBg.fillStyle(0xffffff, 0.7);
      this.livesBg.fillRoundedRect(width - livesBgWidth, yUI, livesBgWidth, livesBgHeight, 10);
    }

    const rexAnchor = this.plugins.get('rexAnchor');
    if (!rexAnchor && this.pocoyoContainer) {
      const x = Math.max(width * 0.15, 120);
      const y = height * 0.5;
      this.pocoyoContainer.setPosition(x, y);
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
    const fontSize = Math.max(24, Math.floor(this.scale.width / 20)) + 'px';
    this.add.text(this.scale.width / 2, this.scale.height / 2,
      `GAME OVER\nYOU MISSED ${MAX_LIVES} STARS!\nCLICK OR TAP TO RESTART`, {
        fontFamily: 'POCOYO TV, Arial, sans-serif',
        fontSize,
        color: '#fff',
        stroke: '#000',
        strokeThickness: 8,
        align: 'center'
      }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      gameOver = false;
      missedStars = 0;
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
