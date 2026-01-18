import { describe, it, expect } from 'vitest';
import { debounce, sleep } from './helpers.js';

describe('Utils: helpers', () => {
  it('sleep should resolve after delay', async () => {
    const start = Date.now();
    await sleep(100);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(90); // Allow slight tolerance
  });

  it('debounce should coalesce calls', async () => {
    let callCount = 0;
    const fn = debounce(() => {
      callCount++;
    }, 50);

    fn();
    fn();
    fn();

    await sleep(20);
    expect(callCount).toBe(0); // Not called yet

    await sleep(60);
    expect(callCount).toBe(1); // Called once
  });
});
