export class AudioVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.animationId = null;
    this.isActive = false;
    this.audioContext = null;
  }

  ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  attachToContext(audioContext, stream) {
    if (!this.canvas || !audioContext || !stream) return;
    this.audioContext = audioContext; // Cache it

    this.cleanup();

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    // Microphone: Do not connect to destination (feedback loop)

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.isActive = true;
    this.draw();
  }

  attachToElement(audioElement) {
    if (!this.canvas || !audioElement) return;

    // Ensure element is cross-origin safe if needed (though data URIs are fine)
    if (!audioElement.crossOrigin) audioElement.crossOrigin = "anonymous";

    const ctx = this.ensureAudioContext();
    this.cleanup();

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;

    try {
      this.source = ctx.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(ctx.destination); // Connect to speakers!
    } catch (e) {
      console.warn("AudioVisualizer: Failed to attach to element", e);
      return;
    }

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.isActive = true;
    this.draw();

    // Auto-stop on end
    audioElement.onended = () => this.stop();
  }

  cleanup() {
    if (this.source) {
      try { this.source.disconnect(); } catch(e){}
      this.source = null;
    }
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  draw() {
    if (!this.isActive || !this.ctx) return;

    this.animationId = requestAnimationFrame(() => this.draw());

    if (this.analyser) {
        this.analyser.getByteFrequencyData(this.dataArray);
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const barWidth = (width / (this.dataArray ? this.dataArray.length : 1)) * 2.5;
    let x = 0;

    this.ctx.clearRect(0, 0, width, height);

    // Gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#64ffda');
    gradient.addColorStop(1, '#1a1a2e');
    this.ctx.fillStyle = gradient;

    if (this.dataArray) {
        for (let i = 0; i < this.dataArray.length; i++) {
        const barHeight = this.dataArray[i] / 2;
        this.ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
        }
    }
  }

  stop() {
    this.isActive = false;
    this.cleanup();
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
