import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FloatingToastPool } from '../src/floatingToastPool.ts';

function makeFakeElement() {
  return {
    className: '',
    textContent: '',
    parentNode: null,
    style: { position: '', top: '', left: '', willChange: '', pointerEvents: '', display: '', opacity: '', transform: '' },
    remove() {
      if (!this.parentNode) return;
      const siblings = this.parentNode.children;
      const index = siblings.indexOf(this);
      if (index >= 0) siblings.splice(index, 1);
      this.parentNode = null;
    },
  };
}

function withFakeDocument(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => makeFakeElement() },
  });
  try {
    run();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
}

test('floating toast pool preallocates a bounded set and reuses entries and vectors', () => {
  withFakeDocument(() => {
    const container = {
      children: [],
      appendChild(element) {
        element.parentNode = this;
        this.children.push(element);
        return element;
      },
    };
    const pool = new FloatingToastPool(container, 2);

    try {
      assert.equal(pool.capacity, 2);
      assert.equal(pool.availableCount, 2);
      assert.equal(container.children.length, 2);

      const first = pool.acquire('+10', 1, 2, 3, 'points', 1.6);
      const second = pool.acquire('-5 HP', 4, 5, 6, 'damage', 0.7);
      assert.ok(first);
      assert.ok(second);
      assert.equal(pool.activeCount, 2);
      assert.equal(pool.availableCount, 0);
      assert.equal(pool.acquire('overflow', 0, 0, 0, 'points', 1), null);

      const firstVector = first.worldPos;
      assert.deepEqual(firstVector.toArray(), [1, 2, 3]);
      assert.equal(first.element.textContent, '+10');
      assert.equal(first.element.style.display, 'flex');

      assert.equal(pool.releaseAt(0), true);
      assert.equal(pool.activeCount, 1);
      assert.equal(pool.availableCount, 1);
      assert.equal(first.element.style.display, 'none');

      const reused = pool.acquire('COMBO', 7, 8, 9, 'combo', 2);
      assert.equal(reused, first);
      assert.equal(reused.worldPos, firstVector);
      assert.deepEqual(reused.worldPos.toArray(), [7, 8, 9]);
      assert.equal(pool.activeCount, 2);

      pool.dispose();
      pool.dispose();
      assert.equal(pool.activeCount, 0);
      assert.equal(pool.availableCount, 0);
      assert.equal(container.children.length, 0);
      assert.equal(pool.acquire('after dispose', 0, 0, 0, 'points', 1), null);
    } finally {
      pool.dispose();
    }
  });
});

test('floating toast pool validates capacity and coordinates without leaking inventory', () => {
  withFakeDocument(() => {
    const container = { children: [], appendChild(element) { this.children.push(element); element.parentNode = this; } };
    assert.throws(() => new FloatingToastPool(container, 0), RangeError);
    assert.throws(() => new FloatingToastPool(container, 1.5), RangeError);

    const pool = new FloatingToastPool(container, 1);
    assert.equal(pool.acquire('bad', Number.NaN, 0, 0, 'points', 1), null);
    assert.equal(pool.activeCount, 0);
    assert.equal(pool.availableCount, 1);
    pool.dispose();
  });
});

test('main game tick caps frame delta and routes floating labels through the pool', async () => {
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(source, /const dt = Math\.min\(Math\.max\(rawDt \|\| 0\.016, 0\.001\), 0\.05\)/);
  assert.match(source, /new FloatingToastPool\(popupsLayer, 36\)/);
  assert.match(source, /floatingToastPool\.releaseAt\(i\);\s*\/\/ Reverse iteration[\s\S]*?continue;/);
  assert.doesNotMatch(source, /activeToasts\.push\(/);
  assert.doesNotMatch(source, /activeToasts\.splice\(/);
});
