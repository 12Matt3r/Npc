export class AudioVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.animationId = null;
    this.isActive = false;
  }

  attachToContext(audioContext, stream) {
    if (!this.canvas || !audioContext || !stream) return;

    if (this.source) { try { this.source.disconnect(); } catch(e){} }

    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.source = audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    // Do not connect to destination (speakers) to avoid feedback loop

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.isActive = true;
    this.draw();
  }

  draw() {
    if (!this.isActive || !this.ctx) return;

    this.animationId = requestAnimationFrame(() => this.draw());

    this.analyser.getByteFrequencyData(this.dataArray);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const barWidth = (width / this.dataArray.length) * 2.5;
    let x = 0;

    this.ctx.clearRect(0, 0, width, height);

    // Gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#64ffda');
    gradient.addColorStop(1, '#1a1a2e');
    this.ctx.fillStyle = gradient;

    for (let i = 0; i < this.dataArray.length; i++) {
      const barHeight = this.dataArray[i] / 2;
      this.ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  }

  stop() {
    this.isActive = false;
    if (this.source) { try { this.source.disconnect(); } catch(e){} this.source = null; }
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
