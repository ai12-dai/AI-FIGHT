// The fight itself. It plays back a fight script built from the AI verdict
// (see script.js): it never decides anything, it only visualises the result.
import Phaser from 'phaser';
import { buildFight } from './script.js';

const W = 1280, H = 720;
const FONT = '"Press Start 2P", monospace';
const FIGHTER_H = 410;          // on-screen height of a standing fighter
const START_X = { p1: 300, p2: 980 };
const ENGAGE_X = { p1: 500, p2: 780 };
const CONTACT = 170;            // centre-to-centre distance on impact

export default class BattleScene extends Phaser.Scene {
  constructor() { super('battle'); }

  init(data) {
    this.cfg = data; // { verdict, arena, f1, f2, names, sfx, announce, onEnd }
    this.hp = { p1: 100, p2: 100 };
    this.dead = false;
  }

  preload() {
    const { arena, f1, f2 } = this.cfg;
    this.load.image('arena', arena.img);
    this.load.image('f_p1', f1.img);
    if (f2.img !== f1.img) this.load.image('f_p2', f2.img);
  }

  create() {
    const { arena } = this.cfg;
    this.events.once('shutdown', () => { this.dead = true; });
    this.makeTextures();

    // Arena: fill 16:9 exactly (images are prepared at 16:9, cover just in case).
    const bg = this.add.image(W / 2, H / 2, 'arena');
    bg.setScale(Math.max(W / bg.width, H / bg.height));
    this.floorY = Math.round(H * arena.floor);
    // subtle vignette to push fighters forward
    const vig = this.add.graphics();
    vig.fillGradientStyle(0x0d0420, 0x0d0420, 0x0d0420, 0x0d0420, 0.55, 0.55, 0, 0);
    vig.fillRect(0, 0, W, 150);
    vig.fillGradientStyle(0x0d0420, 0x0d0420, 0x0d0420, 0x0d0420, 0, 0, 0.5, 0.5);
    vig.fillRect(0, H - 120, W, 120);
    this.ambient(arena.ambient);

    this.fighters = {
      p1: this.makeFighter('p1', this.cfg.f1, 'f_p1', +1),
      p2: this.makeFighter('p2', this.cfg.f2, this.textures.exists('f_p2') ? 'f_p2' : 'f_p1', -1),
    };

    this.fx = this.add.particles(0, 0, 'px', {
      speed: { min: 180, max: 520 }, angle: { min: 0, max: 360 }, lifespan: { min: 250, max: 600 },
      scale: { start: 1.6, end: 0 }, gravityY: 600, emitting: false, blendMode: 'ADD',
    }).setDepth(50);
    this.dust = this.add.particles(0, 0, 'px', {
      speedX: { min: -260, max: 260 }, speedY: { min: -140, max: -20 }, lifespan: { min: 400, max: 900 },
      scale: { start: 2.2, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: 0xd8c3ff, gravityY: 200, emitting: false,
    }).setDepth(9);

    this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(80);
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x12002a, 0).setDepth(8);

    this.makeHud();
    this.run().catch((e) => { if (!this.dead) console.error(e); });
  }

  // ---------- helpers ----------
  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }
  tw(cfg) { return new Promise((r) => this.tweens.add({ ...cfg, onComplete: () => r() })); }
  get sfx() { return this.cfg.sfx; }
  setSpeed(mult) { this.speedBase = mult; this.tweens.timeScale = mult; this.time.timeScale = mult; }

  makeTextures() {
    if (this.textures.exists('px')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff).fillRect(0, 0, 4, 4);
    g.generateTexture('px', 4, 4); g.clear();
    // 8-point pixel star spark
    g.fillStyle(0xffffff);
    const P = [[7, 0, 2, 16], [0, 7, 16, 2], [5, 5, 6, 6], [3, 3, 2, 2], [11, 3, 2, 2], [3, 11, 2, 2], [11, 11, 2, 2]];
    P.forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
    g.generateTexture('star', 16, 16); g.clear();
    // energy orb (pixel circle with core)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 7.5) { g.fillStyle(d < 3.5 ? 0xffffff : 0xffffff, d < 3.5 ? 1 : 0.65); g.fillRect(x, y, 1, 1); }
    }
    g.generateTexture('orb', 16, 16); g.clear();
    // impact ring
    for (let a = 0; a < 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      g.fillStyle(0xffffff).fillRect(Math.round(31 + Math.cos(t) * 28), Math.round(31 + Math.sin(t) * 28), 3, 3);
    }
    g.generateTexture('ring', 64, 64);
    g.destroy();
  }

  ambient(kind) {
    const cfg = {
      petals: { tint: [0xff9ed8, 0xffc4ea, 0xff6fb8], speedX: { min: 20, max: 70 }, speedY: { min: 30, max: 70 }, scale: { min: 1, max: 2 }, frequency: 220, alpha: 0.85 },
      dust: { tint: [0xb59cff, 0xffffff], speedX: { min: -10, max: 10 }, speedY: { min: -10, max: 15 }, scale: { min: 0.5, max: 1 }, frequency: 260, alpha: 0.5 },
      fireflies: { tint: [0xffd27a, 0xffa6e6], speedX: { min: -15, max: 15 }, speedY: { min: -25, max: -5 }, scale: { min: 0.6, max: 1.2 }, frequency: 300, alpha: 0.8 },
    }[kind] || null;
    if (!cfg) return;
    this.add.particles(0, 0, 'px', {
      x: { min: -40, max: W }, y: kind === 'petals' ? -10 : { min: 120, max: H - 60 },
      lifespan: 9000, speedX: cfg.speedX, speedY: cfg.speedY, scale: cfg.scale, tint: cfg.tint,
      alpha: { start: cfg.alpha, end: 0 }, frequency: cfg.frequency, rotate: { min: 0, max: 360 }, blendMode: 'ADD',
    }).setDepth(5);
  }

  makeFighter(id, data, key, dir) {
    const c = this.add.container(START_X[id] - dir * 260, this.floorY).setDepth(10);
    const shadow = this.add.ellipse(0, 0, 230, 34, 0x0a0018, 0.55);
    const sprite = this.add.image(0, 0, key).setOrigin(0.5, 1);
    const s = FIGHTER_H / sprite.height;
    sprite.setScale(s);
    const natural = data.facing === 'left' ? -1 : 1;
    sprite.setFlipX(natural !== dir);
    c.add([shadow, sprite]);
    c.setAlpha(0);
    const f = { id, data, c, sprite, shadow, dir, baseScale: s, key };
    this.idle(f);
    return f;
  }

  idle(f, on = true) {
    f.idleTw?.stop();
    f.sprite.setScale(f.baseScale);
    if (!on) return;
    // stepped breathing: chunky, pixel-like motion rather than smooth
    f.idleTw = this.tweens.add({
      targets: f.sprite, scaleY: f.baseScale * 1.022, scaleX: f.baseScale * 0.992,
      duration: 520, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3],
      delay: f.id === 'p2' ? 260 : 0,
    });
  }

  text(x, y, str, size, color = '#ffffff', depth = 90) {
    return this.add.text(x, y, str, {
      fontFamily: FONT, fontSize: `${size}px`, color, align: 'center',
      stroke: '#1a0533', strokeThickness: Math.max(4, size / 6),
      shadow: { offsetX: size / 12, offsetY: size / 12, color: '#ff2fb4', fill: true, blur: 0 },
    }).setOrigin(0.5).setDepth(depth);
  }

  // ---------- HUD ----------
  makeHud() {
    const { names, f1, f2 } = this.cfg;
    this.hud = this.add.container(0, -140).setDepth(70);
    const g = this.add.graphics();
    const bar = (x, flip) => {
      g.fillStyle(0x12002a, 0.92).fillRect(x - 6, 22, 512, 46);
      g.lineStyle(4, 0xff3ec8, 1).strokeRect(x - 6, 22, 512, 46);
      g.lineStyle(2, 0xffb02e, 1).strokeRect(x - 1, 27, 502, 36);
      g.fillStyle(0x3a0d1a, 1).fillRect(x, 28, 500, 34);
      if (flip !== undefined) { /* shape hook */ }
    };
    bar(44, false); bar(W - 44 - 500, true);
    // centre badge
    g.fillStyle(0x12002a, 0.95).fillRoundedRect(W / 2 - 58, 12, 116, 72, 10);
    g.lineStyle(4, 0xff3ec8, 1).strokeRoundedRect(W / 2 - 58, 12, 116, 72, 10);
    this.hud.add(g);

    this.lag = { p1: this.add.rectangle(544, 28, 500, 34, 0xff4040).setOrigin(1, 0), p2: this.add.rectangle(W - 544, 28, 500, 34, 0xff4040).setOrigin(0, 0) };
    this.bars = { p1: this.add.rectangle(544, 28, 500, 34, 0x9dff3a).setOrigin(1, 0), p2: this.add.rectangle(W - 544, 28, 500, 34, 0x9dff3a).setOrigin(0, 0) };
    this.shine = { p1: this.add.rectangle(544, 30, 500, 8, 0xffffff, 0.35).setOrigin(1, 0), p2: this.add.rectangle(W - 544, 30, 500, 8, 0xffffff, 0.35).setOrigin(0, 0) };
    this.hud.add([this.lag.p1, this.lag.p2, this.bars.p1, this.bars.p2, this.shine.p1, this.shine.p2]);

    const nm = (x, y, s, size, origin, color) => this.add.text(x, y, s, {
      fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#12002a', strokeThickness: 5,
    }).setOrigin(origin, 0);
    this.hud.add([
      nm(44, 80, names.p1.toUpperCase(), 20, 0, '#ffffff'),
      nm(44, 108, `P1 · ${f1.name}`, 11, 0, '#ffb02e'),
      nm(W - 44, 80, names.p2.toUpperCase(), 20, 1, '#ffffff'),
      nm(W - 44, 108, `${f2.name} · P2`, 11, 1, '#ffb02e'),
    ]);
    this.timerText = this.add.text(W / 2, 48, '99', { fontFamily: FONT, fontSize: '34px', color: '#ffe066', stroke: '#12002a', strokeThickness: 6 }).setOrigin(0.5);
    this.hud.add(this.timerText);
    this.drawBars(true);
  }

  drawBars(instant = false) {
    for (const id of ['p1', 'p2']) {
      const w = 5 * this.hp[id];
      const color = this.hp[id] > 50 ? 0x9dff3a : this.hp[id] > 25 ? 0xffd23a : 0xff3a5c;
      this.bars[id].fillColor = color;
      this.bars[id].width = w;
      this.shine[id].width = w;
      if (instant) this.lag[id].width = w;
      else this.tweens.add({ targets: this.lag[id], width: w, duration: 520, delay: 260, ease: 'Quad.out' });
    }
  }

  startTimer() {
    let t = 99;
    this.timer = this.time.addEvent({ delay: 380, loop: true, callback: () => { t = Math.max(0, t - 1); this.timerText.setText(String(t).padStart(2, '0')); } });
  }

  // ---------- sequence ----------
  async run() {
    const { verdict, f1, f2, names, announce } = this.cfg;
    const plan = buildFight(verdict, f1, f2);
    const P = this.fighters;

    this.cameras.main.fadeIn(500, 18, 0, 42);
    await this.wait(300);
    // fighters enter
    this.sfx.whoosh();
    await Promise.all(['p1', 'p2'].map((id) => this.tw({ targets: P[id].c, x: START_X[id], alpha: 1, duration: 650, ease: 'Back.out' })));
    // name plates under fighters
    const plates = ['p1', 'p2'].map((id) => this.text(START_X[id], this.floorY - FIGHTER_H - 34, names[id].toUpperCase(), 18, '#ffffff', 60).setAlpha(0));
    this.tweens.add({ targets: plates, alpha: 1, duration: 250 });
    // HUD slides in
    await this.tw({ targets: this.hud, y: 0, duration: 450, ease: 'Back.out' });
    await this.wait(500);
    this.tweens.add({ targets: plates, alpha: 0, duration: 300, onComplete: () => plates.forEach((p) => p.destroy()) });

    // countdown
    for (const n of ['3', '2', '1']) {
      this.sfx.beep();
      const t = this.text(W / 2, H / 2 - 40, n, 120, '#ffe066');
      t.setScale(2.2).setAlpha(0);
      await this.tw({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.out' });
      await this.wait(380);
      this.tweens.add({ targets: t, alpha: 0, scale: 0.6, duration: 160, onComplete: () => t.destroy() });
      await this.wait(160);
    }
    this.sfx.fight();
    announce?.('Fight!');
    const fight = this.text(W / 2, H / 2 - 40, 'FIGHT!', 110, '#ff3ec8');
    fight.setScale(0.2);
    this.cameras.main.shake(260, 0.01);
    await this.tw({ targets: fight, scale: 1.1, duration: 240, ease: 'Back.out' });
    await this.wait(450);
    this.tweens.add({ targets: fight, alpha: 0, scale: 1.8, duration: 260, onComplete: () => fight.destroy() });
    this.startTimer();

    // approach
    this.sfx.whoosh();
    await Promise.all(['p1', 'p2'].map((id) => this.hop(P[id], ENGAGE_X[id])));
    await this.wait(250);

    for (const ev of plan.events) {
      if (this.dead) return;
      if (ev.finisher) await this.finisher(ev);
      else if (ev.clash) await this.clash(ev, plan);
      else await this.attack(ev);
      await this.wait(260);
    }
    this.timer?.remove();
    if (plan.winner === 'draw') await this.drawEnding(plan);
    else await this.victory(plan.winner);
    this.cfg.onEnd?.();
  }

  async hop(f, x) {
    const steps = 3;
    const from = f.c.x;
    for (let i = 1; i <= steps; i++) {
      const nx = from + ((x - from) * i) / steps;
      await this.tw({ targets: f.c, x: nx, y: this.floorY - 18, duration: 110, ease: 'Quad.out' });
      await this.tw({ targets: f.c, y: this.floorY, duration: 90, ease: 'Quad.in' });
    }
  }

  afterimage(f, color) {
    const ghost = this.add.image(f.c.x, f.c.y, f.key).setOrigin(0.5, 1).setScale(f.sprite.scaleX, f.sprite.scaleY)
      .setFlipX(f.sprite.flipX).setAngle(f.c.angle).setTintFill(color).setAlpha(0.45).setDepth(9).setBlendMode('ADD');
    this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
  }

  moveName(f, name, big = false) {
    const t = this.text(f.c.x, this.floorY - FIGHTER_H - 30, name, big ? 26 : 16, big ? '#ffe066' : '#ffffff', 75);
    t.setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.out' });
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, delay: 650, duration: 400, onComplete: () => t.destroy() });
  }

  impact(x, y, color, power = 1) {
    this.fx.setParticleTint(color);
    this.fx.explode(Math.round(22 * power), x, y);
    const star = this.add.image(x, y, 'star').setScale(3 * power).setTint(0xffffff).setDepth(55).setBlendMode('ADD');
    this.tweens.add({ targets: star, scale: 7 * power, alpha: 0, angle: 45, duration: 220, onComplete: () => star.destroy() });
    const ring = this.add.image(x, y, 'ring').setScale(0.4).setTint(color).setDepth(55).setBlendMode('ADD');
    this.tweens.add({ targets: ring, scale: 2.4 * power, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    this.cameras.main.shake(120 + 120 * power, 0.006 * power);
  }

  damagePop(f, dmg) {
    const t = this.text(f.c.x + Phaser.Math.Between(-40, 40), this.floorY - FIGHTER_H * 0.75, `-${dmg}`, 22, '#ff6b6b', 76);
    this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, duration: 800, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  async hitReact(def, dmg, power = 1) {
    this.hp[def.id] = Math.max(0, this.hp[def.id] - dmg);
    this.drawBars();
    this.damagePop(def, dmg);
    def.sprite.setTintFill(0xffffff);
    this.time.delayedCall(70, () => { def.sprite.clearTint(); def.sprite.setTint(0xff9aa8); });
    this.time.delayedCall(220, () => def.sprite.clearTint());
    const back = -def.dir * 34 * power;
    await this.tw({ targets: def.c, x: def.c.x + back, angle: -def.dir * 7, duration: 90, ease: 'Quad.out' });
    await this.tw({ targets: def.c, angle: 0, duration: 160, ease: 'Quad.inOut' });
  }

  async attack(ev) {
    const atk = this.fighters[ev.attacker];
    const def = this.fighters[ev.attacker === 'p1' ? 'p2' : 'p1'];
    const color = atk.data.spark;
    this.moveName(atk, ev.move);
    // wind-up
    await this.tw({ targets: atk.c, x: atk.c.x - atk.dir * 24, angle: -atk.dir * 5, duration: 140, ease: 'Quad.out' });

    if (ev.kind === 'projectile') {
      this.sfx.special();
      await this.tw({ targets: atk.c, angle: atk.dir * 6, duration: 90 });
      const y = this.floorY - FIGHTER_H * 0.62;
      const orb = this.add.image(atk.c.x + atk.dir * 90, y, 'orb').setScale(3).setTint(color).setDepth(40).setBlendMode('ADD');
      const trail = this.add.particles(0, 0, 'px', { follow: orb, lifespan: 260, scale: { start: 2, end: 0 }, tint: color, frequency: 16, blendMode: 'ADD' }).setDepth(39);
      this.tweens.add({ targets: orb, angle: 360, duration: 300, repeat: -1 });
      await this.tw({ targets: orb, x: def.c.x - def.dir * 30, duration: 300, ease: 'Linear' });
      trail.stop(); this.time.delayedCall(300, () => trail.destroy());
      orb.destroy();
      this.sfx.hit();
      this.impact(def.c.x - def.dir * 20, y, color, 1);
      await Promise.all([this.hitReact(def, ev.dmg), this.tw({ targets: atk.c, angle: 0, x: ENGAGE_X[atk.id], duration: 240 })]);
      await this.tw({ targets: def.c, x: ENGAGE_X[def.id], duration: 200 });
      return;
    }

    // dash in
    this.sfx.whoosh();
    const target = def.c.x - atk.dir * CONTACT;
    const dash = this.tween4ghost(atk, color);
    await this.tw({ targets: atk.c, x: target, angle: atk.dir * 8, duration: 120, ease: 'Quad.in' });
    dash.remove();
    const hitY = this.floorY - FIGHTER_H * (0.55 + Math.random() * 0.15);
    const hits = ev.kind === 'combo' ? 3 : 1;
    for (let i = 0; i < hits; i++) {
      const part = i === hits - 1 ? ev.dmg - Math.floor(ev.dmg / hits) * (hits - 1) : Math.floor(ev.dmg / hits);
      this.sfx.hit();
      this.impact((atk.c.x + def.c.x) / 2 + atk.dir * 30, hitY - i * 20, color, hits > 1 ? 0.7 : 1);
      await this.wait(50); // hit-stop
      if (i < hits - 1) {
        this.hitReact(def, part, 0.5);
        await this.tw({ targets: atk.c, x: atk.c.x - atk.dir * 16, duration: 80, yoyo: true });
      } else {
        await this.hitReact(def, part, 1);
      }
    }
    // recover
    await Promise.all([
      this.tw({ targets: atk.c, x: ENGAGE_X[atk.id], angle: 0, duration: 240, ease: 'Quad.out' }),
      this.tw({ targets: def.c, x: ENGAGE_X[def.id], duration: 260, ease: 'Quad.out' }),
    ]);
  }

  tween4ghost(f, color) {
    return this.time.addEvent({ delay: 30, repeat: 6, callback: () => this.afterimage(f, color) });
  }

  async clash(ev) {
    // Draw finale: both strike at the same time.
    const a = this.fighters.p1, b = this.fighters.p2;
    this.moveName(a, a.data.moves[1]); this.moveName(b, b.data.moves[1]);
    this.sfx.whoosh();
    const ga = this.tween4ghost(a, a.data.spark), gb = this.tween4ghost(b, b.data.spark);
    await Promise.all([
      this.tw({ targets: a.c, x: W / 2 - CONTACT / 2, angle: 8, duration: 140, ease: 'Quad.in' }),
      this.tw({ targets: b.c, x: W / 2 + CONTACT / 2, angle: -8, duration: 140, ease: 'Quad.in' }),
    ]);
    ga.remove(); gb.remove();
    this.sfx.heavy();
    this.flash.setAlpha(0.7);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 300 });
    this.impact(W / 2, this.floorY - FIGHTER_H * 0.6, 0xffffff, 1.6);
    await Promise.all([this.hitReact(a, ev.dmg.p1, 1.6), this.hitReact(b, ev.dmg.p2, 1.6)]);
    await Promise.all([
      this.tw({ targets: a.c, x: ENGAGE_X.p1 - 60, angle: 0, duration: 300 }),
      this.tw({ targets: b.c, x: ENGAGE_X.p2 + 60, angle: 0, duration: 300 }),
    ]);
  }

  async finisher(ev) {
    const atk = this.fighters[ev.attacker];
    const def = this.fighters[ev.attacker === 'p1' ? 'p2' : 'p1'];
    const color = atk.data.spark;
    // super freeze
    this.sfx.special();
    this.tweens.add({ targets: this.dim, alpha: 0.65, duration: 200 });
    atk.c.setDepth(30);
    let glow = null;
    if (atk.sprite.preFX) glow = atk.sprite.preFX.addGlow(color, 6, 0, false, 0.1, 12);
    const aura = this.add.particles(0, 0, 'px', {
      x: { min: atk.c.x - 90, max: atk.c.x + 90 }, y: this.floorY - 10, speedY: { min: -320, max: -120 },
      lifespan: 700, scale: { start: 2.4, end: 0 }, tint: [color, 0xffffff], frequency: 12, blendMode: 'ADD',
    }).setDepth(29);
    const title = this.text(W / 2, 210, ev.move, 40, '#ffe066', 85);
    title.setScale(0.3);
    this.tweens.add({ targets: title, scale: 1, duration: 260, ease: 'Back.out' });
    await this.tw({ targets: atk.c, y: this.floorY - 14, duration: 300, yoyo: true, ease: 'Sine.inOut' });
    await this.wait(250);
    this.tweens.add({ targets: title, alpha: 0, duration: 200, onComplete: () => title.destroy() });

    // the strike
    this.sfx.whoosh();
    const dash = this.tween4ghost(atk, color);
    await this.tw({ targets: atk.c, x: def.c.x - atk.dir * (CONTACT - 30), angle: atk.dir * 10, duration: 110, ease: 'Quad.in' });
    dash.remove();
    this.sfx.heavy();
    this.flash.setAlpha(1);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 450 });
    this.impact(def.c.x - def.dir * 40, this.floorY - FIGHTER_H * 0.6, color, 2);
    this.hp[def.id] = 0;
    this.drawBars();
    this.damagePop(def, ev.dmg);
    aura.stop(); this.time.delayedCall(800, () => aura.destroy());

    // slow motion knockback and fall
    this.setSpeedLocal(0.35);
    this.idle(def, false);
    def.sprite.setTintFill(0xffffff);
    this.time.delayedCall(60, () => def.sprite.setTint(0xff8aa0));
    const away = -def.dir; // direction the loser flies
    // lying body extends ~FIGHTER_H from the feet in the push direction: keep it on screen
    const reach = FIGHTER_H * 0.92 + 40;
    const landX = Phaser.Math.Clamp(def.c.x + away * 90, reach, W - reach);
    const lift = def.sprite.displayWidth * 0.32;
    await this.tw({ targets: def.c, x: (def.c.x + landX) / 2, y: this.floorY - 120, angle: away * 45, duration: 260, ease: 'Quad.out' });
    this.setSpeedLocal(1);
    this.sfx.fall();
    await this.tw({ targets: def.c, x: landX, y: this.floorY - lift, angle: away * 90, duration: 300, ease: 'Quad.in' });
    def.shadow.setVisible(false);
    this.dust.explode(40, landX + away * FIGHTER_H * 0.4, this.floorY);
    this.cameras.main.shake(320, 0.014);
    await this.tw({ targets: def.c, y: this.floorY - lift - 26, duration: 140, yoyo: true, ease: 'Quad.out' });
    def.sprite.clearTint();
    this.tweens.add({ targets: def.sprite, alpha: 0.88, duration: 300 });
    // KO
    if (glow) atk.sprite.preFX.remove(glow);
    this.tweens.add({ targets: this.dim, alpha: 0, duration: 400 });
    const ko = this.text(W / 2, H / 2 - 70, 'K.O.', 130, '#ff3a5c', 88);
    ko.setScale(3).setAlpha(0);
    this.cfg.announce?.('K.O.!');
    await this.tw({ targets: ko, scale: 1, alpha: 1, duration: 220, ease: 'Quad.in' });
    this.cameras.main.shake(200, 0.01);
    await this.wait(900);
    await this.tw({ targets: ko, alpha: 0, duration: 250 });
    ko.destroy();
    await this.tw({ targets: atk.c, x: ENGAGE_X[atk.id] - atk.dir * 40, angle: 0, duration: 400, ease: 'Quad.out' });
    atk.c.setDepth(10);
  }

  setSpeedLocal(m) {
    // slow-mo on top of any fast-forward the player asked for
    const base = this.speedBase || 1;
    this.tweens.timeScale = base * m;
    this.time.timeScale = base * m;
  }

  async victory(wid) {
    const win = this.fighters[wid];
    const { names } = this.cfg;
    this.idle(win, false);
    // victory jump
    this.sfx.victory();
    await this.tw({ targets: win.c, y: this.floorY - 120, angle: -win.dir * 6, duration: 300, ease: 'Quad.out' });
    await this.tw({ targets: win.c, y: this.floorY, angle: 0, duration: 260, ease: 'Bounce.out' });
    this.dust.explode(18, win.c.x, this.floorY);
    // triumphant pose loop: chest out, glow, sparkles
    if (win.sprite.preFX) win.sprite.preFX.addGlow(0xffd23a, 3, 0, false, 0.1, 10);
    this.tweens.add({ targets: win.sprite, scaleY: win.baseScale * 1.045, scaleX: win.baseScale * 1.015, duration: 420, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
    this.add.particles(0, 0, 'star', {
      x: { min: win.c.x - 140, max: win.c.x + 140 }, y: { min: this.floorY - FIGHTER_H, max: this.floorY - 40 },
      lifespan: 900, scale: { start: 1.4, end: 0 }, alpha: { start: 1, end: 0 }, speedY: { min: -60, max: -20 },
      tint: [0xffe066, 0xffffff, win.data.spark], frequency: 90, blendMode: 'ADD',
    }).setDepth(12);
    const label = wid === 'p1' ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!';
    this.cfg.announce?.(wid === 'p1' ? 'Player one wins!' : 'Player two wins!');
    const t = this.text(W / 2, 182, label, 58, '#ffe066', 90);
    t.setScale(0.2);
    await this.tw({ targets: t, scale: 1, duration: 360, ease: 'Back.out' });
    this.tweens.add({ targets: t, scale: 1.06, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const banner = this.add.rectangle(W / 2, 258, W, 60, 0x12002a, 0.82).setDepth(89);
    banner.setScale(0, 1);
    this.tweens.add({ targets: banner, scaleX: 1, duration: 300 });
    const n = this.text(W / 2, 258, `WINNER: ${names[wid].toUpperCase()}`, 28, '#ffffff', 90).setAlpha(0);
    this.tweens.add({ targets: n, alpha: 1, duration: 300, delay: 200 });
    await this.wait(1200);
  }

  async drawEnding() {
    this.timerText.setText('00');
    const t0 = this.text(W / 2, 230, 'TIME OVER', 50, '#ffffff', 90);
    this.sfx.beep();
    await this.wait(900);
    t0.destroy();
    this.sfx.draw();
    this.cfg.announce?.('Draw game!');
    const t = this.text(W / 2, 260, 'DRAW', 110, '#7fe7ff', 90);
    t.setScale(0.2);
    await this.tw({ targets: t, scale: 1, duration: 360, ease: 'Back.out' });
    const sub = this.text(W / 2, 360, 'BOTH FIGHTERS STAND', 22, '#ffffff', 90);
    sub.setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 300 });
    // both stay up, catching their breath
    for (const id of ['p1', 'p2']) {
      const f = this.fighters[id];
      this.tweens.add({ targets: f.c, x: ENGAGE_X[id] - f.dir * 40, duration: 400 });
    }
    await this.wait(1400);
  }
}
