
export class ResourceManager {
  constructor() {
    this.cache = new Map();
    this.inFlight = new Map();
  }

  async preloadImage(url) {
    if (!url) return;
    if (this.cache.has(url)) return this.cache.get(url);
    if (this.inFlight.has(url)) return this.inFlight.get(url);

    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(url, img);
        this.inFlight.delete(url);
        resolve(img);
      };
      img.onerror = (e) => {
        this.inFlight.delete(url);
        reject(e);
      };
      img.src = url;
    });

    this.inFlight.set(url, promise);
    return promise;
  }

  async preloadAudio(url) {
    if (!url) return;
    // Basic pre-fetch for browser cache
    try {
      await fetch(url);
    } catch (_) { /* ignore */ }
  }

  preloadNpcAssets(npcs, priorityIndex, range = 2) {
    // Preload immediate neighbors
    for (let i = Math.max(0, priorityIndex - range); i < Math.min(npcs.length, priorityIndex + range + 1); i++) {
      const npc = npcs[i];
      if (npc.habitat) this.preloadImage(npc.habitat);
      if (npc.officeImage) this.preloadImage(npc.officeImage);
    }
  }
}
