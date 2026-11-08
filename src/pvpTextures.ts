import * as THREE from 'three';

type ObstacleTextureKind = 'crate' | 'barrier' | 'wall';

function makeCanvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable for PvP textures');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Seam-friendly top-down concrete/steel floor with readable tile joints and hazard accents. */
export function createPvpFloorTexture(): THREE.CanvasTexture {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#343d4b';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 128) {
      for (let x = 0; x < size; x += 128) {
        const shade = ((x / 128 + y / 128) % 3) * 5;
        ctx.fillStyle = `rgb(${55 + shade},${64 + shade},${77 + shade})`;
        ctx.fillRect(x + 2, y + 2, 124, 124);
        ctx.strokeStyle = 'rgba(13,20,30,.8)';
        ctx.lineWidth = 5;
        ctx.strokeRect(x + 2.5, y + 2.5, 123, 123);
        ctx.strokeStyle = 'rgba(190,205,220,.18)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 7, y + 7, 113, 113);
        for (const [nx, ny] of [[12,12],[116,12],[12,116],[116,116]]) {
          ctx.fillStyle = '#aab4c1';
          ctx.beginPath(); ctx.arc(x + nx, y + ny, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // Subtle scuffs and speckle: deterministic, no per-frame work.
    for (let i = 0; i < 190; i++) {
      const x = (i * 73 + 19) % size, y = (i * 137 + 41) % size;
      ctx.fillStyle = i % 3 ? 'rgba(8,14,23,.18)' : 'rgba(220,226,232,.12)';
      ctx.fillRect(x, y, 2 + i % 5, 1 + i % 2);
    }
    // Small hazard marks near alternating tile corners.
    ctx.fillStyle = '#d89b25';
    for (let x = 0; x < size; x += 256) {
      ctx.fillRect(x + 18, 18, 34, 5);
      ctx.fillRect(x + 18, size - 23, 34, 5);
    }

    // Recessed drainage plates in the concrete. The geometry stays inside each
    // 128px tile so the repeated surface does not introduce visible edge seams.
    for (let y = 0; y < size; y += 128) {
      for (let x = 0; x < size; x += 128) {
        const gx = x + 76;
        const gy = y + 76;
        ctx.fillStyle = 'rgba(8,14,23,.58)';
        ctx.fillRect(gx, gy, 36, 18);
        ctx.strokeStyle = 'rgba(182,196,211,.48)';
        ctx.lineWidth = 2;
        ctx.strokeRect(gx + 1, gy + 1, 34, 16);
        ctx.beginPath();
        for (let line = 0; line < 6; line++) {
          const ly = gy + 3 + line * 2.4;
          ctx.moveTo(gx + 4, ly);
          ctx.lineTo(gx + 32, ly);
        }
        ctx.stroke();
      }
    }

    // Forklift tyre polishing and small painted aisle arrows add scale and
    // direction cues while remaining a static, low-cost canvas texture.
    for (let track = 0; track < 8; track++) {
      const tx = 34 + (track * 61) % 410;
      const ty = 44 + (track * 97) % 408;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(((track % 3) - 1) * 0.16);
      ctx.strokeStyle = 'rgba(10,16,25,.28)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-23, -8);
      ctx.lineTo(23, -8);
      ctx.moveTo(-23, 8);
      ctx.lineTo(23, 8);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(205,214,225,.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-17, -10);
      ctx.lineTo(18, -10);
      ctx.moveTo(-17, 10);
      ctx.lineTo(18, 10);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(226,232,240,.34)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 11]);
    ctx.beginPath();
    ctx.moveTo(250, 150);
    ctx.lineTo(250, 362);
    ctx.stroke();
    ctx.setLineDash([]);
  }, 2, 2);
}

export function createPvpObstacleTexture(kind: ObstacleTextureKind): THREE.CanvasTexture {
  return makeCanvasTexture((ctx, size) => {
    const base = kind === 'crate' ? '#9b5b2b' : kind === 'barrier' ? '#596678' : '#293748';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const edge = kind === 'crate' ? '#e5a35b' : '#aab6c5';
    ctx.strokeStyle = edge;
    ctx.lineWidth = 16;
    ctx.strokeRect(10, 10, size - 20, size - 20);
    ctx.strokeStyle = 'rgba(5,12,22,.65)';
    ctx.lineWidth = 8;
    ctx.strokeRect(30, 30, size - 60, size - 60);
    if (kind === 'crate') {
      ctx.fillStyle = 'rgba(30,18,12,.35)';
      ctx.fillRect(54, 54, size - 108, size - 108);
      ctx.strokeStyle = '#d69a58';
      ctx.lineWidth = 24;
      ctx.beginPath(); ctx.moveTo(65, 65); ctx.lineTo(size - 65, size - 65); ctx.moveTo(size - 65, 65); ctx.lineTo(65, size - 65); ctx.stroke();
      ctx.fillStyle = '#f0c27a';
      for (const [x,y] of [[42,42],[size-42,42],[42,size-42],[size-42,size-42]]) {
        ctx.beginPath(); ctx.arc(x,y,9,0,Math.PI*2); ctx.fill();
      }
      // Board grain and a compact inventory stamp make the crate read as
      // wooden freight rather than a flat brown cube at camera distance.
      ctx.strokeStyle = 'rgba(45,25,14,.30)';
      ctx.lineWidth = 3;
      for (let y = 104; y < size - 96; y += 58) {
        ctx.beginPath();
        ctx.moveTo(82, y);
        ctx.bezierCurveTo(170, y - 9, 300, y + 10, size - 82, y - 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#f1e5cc';
      ctx.fillRect(size - 154, size - 118, 88, 42);
      ctx.fillStyle = '#263444';
      ctx.font = '900 22px monospace';
      ctx.fillText('B4', size - 142, size - 90);
      ctx.fillRect(size - 139, size - 82, 60, 3);
      ctx.fillRect(size - 139, size - 74, 60, 3);
    } else {
      ctx.fillStyle = kind === 'barrier' ? '#f2b632' : '#263b50';
      if (kind === 'barrier') {
        for (let x = -size; x < size * 2; x += 112) {
          ctx.beginPath(); ctx.moveTo(x, size); ctx.lineTo(x + 72, size); ctx.lineTo(x + 184, 0); ctx.lineTo(x + 112, 0); ctx.closePath(); ctx.fill();
        }
      } else {
        for (let y = 72; y < size; y += 112) {
          ctx.fillStyle = y % 224 ? '#40556c' : '#1d2b3d';
          ctx.fillRect(40, y, size - 80, 42);
        }
      }
      if (kind === 'barrier') {
        // Reflective panels, end caps and fixing bolts break up the warning tape.
        ctx.fillStyle = 'rgba(255,255,255,.72)';
        for (let x = 48; x < size - 20; x += 128) {
          ctx.fillRect(x, 34, 26, 18);
          ctx.fillRect(x, size - 52, 26, 18);
        }
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(20, 18, 28, size - 36);
        ctx.fillRect(size - 48, 18, 28, size - 36);
        ctx.fillStyle = '#cbd5e1';
        for (const x of [31, size - 31]) {
          for (const y of [54, size * 0.5, size - 54]) {
            ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else {
        // Concrete wall seams, anchor plates and shallow damp streaks.
        ctx.strokeStyle = 'rgba(7,15,25,.48)';
        ctx.lineWidth = 5;
        for (let y = 112; y < size; y += 128) {
          ctx.beginPath(); ctx.moveTo(52, y); ctx.lineTo(size - 52, y); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(10,18,29,.32)';
        for (let x = 94; x < size - 60; x += 132) {
          ctx.fillRect(x, 58, 8, size - 116);
        }
        ctx.fillStyle = '#cbd5e1';
        for (const [x,y] of [[58,58],[size-58,58],[58,size-58],[size-58,size-58]]) {
          ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
        }
      }
      ctx.fillStyle = '#6ee7f9';
      ctx.fillRect(0, size - 30, size, 10);
    }
  });
}


/**
 * Shared floor footprint for warehouse cover in both PvP and Survival.
 * Dimensions are the same world-space collision dimensions used by the arena.
 */
export function createArenaObstacleFootprint(
  width: number,
  depth: number,
  color: number,
  padding = 0.12,
): THREE.LineLoop {
  const safeWidth = Number.isFinite(width) ? Math.max(0.25, width) : 1;
  const safeDepth = Number.isFinite(depth) ? Math.max(0.25, depth) : 1;
  const safePadding = Number.isFinite(padding) ? Math.max(0, Math.min(0.5, padding)) : 0.12;
  const halfWidth = safeWidth * 0.5 + safePadding;
  const halfDepth = safeDepth * 0.5 + safePadding;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfWidth, 0, -halfDepth),
    new THREE.Vector3(halfWidth, 0, -halfDepth),
    new THREE.Vector3(halfWidth, 0, halfDepth),
    new THREE.Vector3(-halfWidth, 0, halfDepth),
  ]);
  const footprint = new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  footprint.position.y = 0.045;
  footprint.renderOrder = 3;
  footprint.frustumCulled = false;
  return footprint;
}
