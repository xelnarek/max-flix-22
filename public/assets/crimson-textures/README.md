# MAX FLIX 22 — Crimson Texture Pack v1

A tileable, resolution-independent SVG material pack for the existing Three.js 0.186 renderer.

## Surface set
- Floors: B4 worn concrete, Port 17 asphalt, Cold Storage sealed floor, Night Sorter rubber.
- Props: corrugated container steel, rusted steel plate, pallet timber, hazard chevron.

## Runtime notes
- Load the SVGs with Three.js `TextureLoader` or Vite URL imports.
- Set color/albedo textures to `THREE.SRGBColorSpace`.
- Use `THREE.RepeatWrapping` and adjust repeat values to world-space scale.
- These are color/surface-detail textures, not baked lighting. Keep arena lighting and fog independent.
- The current Survival floor is a generated CanvasTexture with biome blending. These files are additive source materials; do not replace that atlas blindly. Blend/sample per biome or assign the matching material only after a mobile performance and seam check.
- All surfaces are designed to tile; test a 3x3 repeat before shipping.

## Quality gate
Check seams, texel density, mobile GPU memory, anisotropic filtering, readability under gameplay lighting, and 60 FPS on the target Android device.

## Licensing
Original vector artwork authored for MAX FLIX 22; no third-party texture files included.
