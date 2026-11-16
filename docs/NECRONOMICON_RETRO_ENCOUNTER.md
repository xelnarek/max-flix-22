# Necronomicon / R'lyeh retro encounter

The Survival pickup pauses the warehouse simulation and launches a separate, full-screen pixel-art arena. Closing the encounter or finishing it returns to the paused Survival run; victory grants the 6,000-point secret reward.

## Arena and art
- 480×270 internal pixel buffer with nearest-neighbour scaling to the device canvas.
- Bespoke drowned-city skyline, broken obelisks, violet moon, sea mist, stone combat lane and a unique dark-teal / violet / neon-magenta palette.
- Cthulhu is an oversized pixel boss with crown spikes, seven facial tentacles, six lower tendrils, broad bat wings, glowing eyes and a chest iris.

## Combat
- 180 boss HP, two phases, and three deterministic attack patterns.
- Slam: a floor shockwave that can be cleared by jumping; Phase II sends a second following wave.
- Lash: a low horizontal sweep. Jump above the attack lane.
- Grab: locks onto the player's current horizontal position; move away or jump before the grasp resolves.
- A resolved boss attack exposes the core for 2.15 seconds. Hits on the core deal 50% extra damage.
- Phase II begins at half boss health and shortens warning windows. Attacks are faster and more damaging.

## Controls
- Desktop: A/D or arrows to move, Space/Up/Shift/Q to evade-jump, J/K/X/F to fire.
- Mobile: independent left/right hold buttons, dodge-jump with visible cooldown, and hold-to-fire.
- Pointer Events and native Touch Events are tracked separately so one path cannot release another. Blur, app backgrounding, touch cancellation and exit clear every held control.
- Projectiles are automatically angled toward the chest core and the operator faces the boss while firing.

## Audio and feedback
- Synthesised layered sub-bass, mid-bass and short transient punch; no external copyrighted audio.
- Stronger impacts on boss strikes, player hits and phase transitions.
- Victory plays the boss sinking animation and pixel fractures through the city before the result panel appears.
