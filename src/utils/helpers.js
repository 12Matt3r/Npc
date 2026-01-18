// Generic helpers
export function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function withTimeout(promise, ms) {
  let t; const timeout = new Promise((_, rej) => t = setTimeout(() => rej(new Error('timeout')), ms));
  try { const res = await Promise.race([promise, timeout]); clearTimeout(t); return res; } finally { clearTimeout(t); }
}

export function debounce(fn, delay = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// Image loading helpers
export async function preloadBackground(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export async function loadImage(url, timeout = 15000) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(false); img.src = ''; } }, timeout);
    img.onload = () => { if (!done) { done = true; clearTimeout(t); resolve(true); } };
    img.onerror = () => { if (!done) { done = true; clearTimeout(t); resolve(false); } };
    img.src = url;
  });
}

export function attachImageLoadingEffects(img) {
  if (!img) return;
  img.classList.add('loading', 'skeleton');
  const onLoad = () => { img.classList.remove('loading', 'skeleton'); img.classList.add('loaded'); img.removeEventListener('load', onLoad); };
  img.addEventListener('load', onLoad);
  img.addEventListener('error', () => { img.classList.remove('loading'); });
  if (img.complete) onLoad();
}
