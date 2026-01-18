export class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency if possible
    this.offscreen = null;
    this.useOffscreen = !!window.OffscreenCanvas;

    if (this.useOffscreen) {
      try {
        this.offscreen = canvas.transferControlToOffscreen();
        // In a real implementation, we'd spawn a Worker here.
        // For this refactor, we'll keep it on main thread but use offscreen buffer technique
        // actually transferControlToOffscreen detaches the canvas, so we can't draw to it from main thread easily without a worker.
        // Let's stick to standard double buffering for now to stay safe within this refactor scope.
        this.offscreen = document.createElement('canvas');
        this.offCtx = this.offscreen.getContext('2d');
        this.useOffscreen = true; // Manual double buffer
      } catch (e) {
        this.useOffscreen = false;
      }
    }
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.useOffscreen && this.offscreen) {
      this.offscreen.width = width * dpr;
      this.offscreen.height = height * dpr;
      this.offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  render(nodes, state) {
    const targetCtx = this.useOffscreen ? this.offCtx : this.ctx;
    const { width, height } = this;

    // Clear
    targetCtx.fillStyle = '#1a1a2e'; // Match bg color
    targetCtx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4;

    targetCtx.save();
    targetCtx.translate(centerX, centerY);
    targetCtx.scale(state.zoom, state.zoom);
    targetCtx.translate(-centerX + state.panX, -centerY + state.panY);

    // Draw connections
    targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    targetCtx.lineWidth = 1;
    targetCtx.beginPath();

    nodes.forEach((pos1, i) => {
      nodes.forEach((pos2, j) => {
        if (i < j && (pos1.index + pos2.index) % 5 < 2) {
          targetCtx.moveTo(pos1.x, pos1.y);
          targetCtx.lineTo(pos2.x, pos2.y);
        }
      });
    });
    targetCtx.stroke();

    // Draw nodes
    nodes.forEach(pos => {
      targetCtx.beginPath();
      targetCtx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      targetCtx.fillStyle = pos.healed ? '#4CAF50' : '#fff';
      targetCtx.fill();
    });

    targetCtx.restore();

    // Blit if using offscreen buffer
    if (this.useOffscreen) {
      this.ctx.drawImage(this.offscreen, 0, 0, width, height);
    }
  }
}
