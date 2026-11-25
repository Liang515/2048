// 勝利彩帶特效（Canvas 粒子）

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  decay: number;
}

const BURST_COLORS = ["#f43f5e", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
const SIDE_COLORS = ["#f43f5e", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

const pick = (colors: string[]) => colors[Math.floor(Math.random() * colors.length)];

export class ConfettiEffect {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private active = false;
  private animationFrame: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    window.addEventListener("resize", () => {
      if (this.active) this.resize();
    });
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start(durationMs = 3000): void {
    this.active = true;
    this.resize();
    this.canvas.classList.remove("hidden");
    this.particles = [];

    for (let i = 0; i < 120; i++) {
      this.particles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
        y: window.innerHeight * 0.65,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 15 - 5,
        color: pick(BURST_COLORS),
        size: Math.random() * 5 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        opacity: 1,
        decay: Math.random() * 0.008 + 0.004,
      });
    }

    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.loop();
    setTimeout(() => {
      this.active = false;
    }, durationMs);
  }

  private sideParticle(fromLeft: boolean): Particle {
    return {
      x: fromLeft ? 0 : window.innerWidth,
      y: window.innerHeight * 0.3,
      vx: (fromLeft ? 1 : -1) * (Math.random() * 8 + 4),
      vy: -Math.random() * 8 - 4,
      color: pick(SIDE_COLORS),
      size: Math.random() * 5 + 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      opacity: 1,
      decay: Math.random() * 0.012 + 0.004,
    };
  }

  private loop(): void {
    if (!this.active && this.particles.length === 0) {
      this.canvas.classList.add("hidden");
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4; // 重力
      p.vx *= 0.98;
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      this.ctx.restore();
    }

    if (this.active && Math.random() < 0.25) {
      this.particles.push(this.sideParticle(true), this.sideParticle(false));
    }

    this.animationFrame = requestAnimationFrame(() => this.loop());
  }
}
