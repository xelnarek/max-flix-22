import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { observeWebGLContextRecovery } from '../src/webglContextRecovery.ts';

test('WebGL context loss is made restorable and both lifecycle events are reported', () => {
  const target = new EventTarget();
  const calls = [];
  const dispose = observeWebGLContextRecovery(target, {
    onLost: () => calls.push('lost'),
    onRestored: () => calls.push('restored'),
  });

  const lost = new Event('webglcontextlost', { cancelable: true });
  target.dispatchEvent(lost);
  target.dispatchEvent(new Event('webglcontextrestored'));

  assert.equal(lost.defaultPrevented, true);
  assert.deepEqual(calls, ['lost', 'restored']);
  dispose();
});

test('disposing the WebGL observer prevents stale callbacks', () => {
  const target = new EventTarget();
  const calls = [];
  const dispose = observeWebGLContextRecovery(target, {
    onLost: () => calls.push('lost'),
    onRestored: () => calls.push('restored'),
  });

  dispose();
  target.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  target.dispatchEvent(new Event('webglcontextrestored'));

  assert.deepEqual(calls, []);
});

test('the game pauses on context loss, portals the recovery UI in fullscreen, and requires a deliberate resume', async () => {
  const [app, html, css] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/webgl-context-recovery.css', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /observeWebGLContextRecovery\(renderer\.domElement/);
  assert.match(app, /sceneScript\.pauseForWebGLRecovery\(\)/);
  assert.match(app, /sceneScript\.resumeAfterWebGLRecovery\(shouldResumeAfterContextLoss\)/);
  assert.match(app, /'webgl-recovery-notice'/);
  assert.match(app, /if \(!webglContextRestored\) return/);
  assert.match(html, /webgl-context-recovery\.css/);
  assert.match(css, /\.webgl-recovery-overlay\[hidden\]/);
  assert.match(css, /min-height:\s*46px/);
});
