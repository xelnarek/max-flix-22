# Survival camera visibility

The Survival camera follows the operator from an elevated tactical angle. Large scenery that intersects the camera-to-operator sightline is faded locally so combat remains readable without removing the map's geometry.

## Runtime behaviour

- The occlusion ray targets the operator's upper-body position (player position plus 0.92 m).
- The raycast runs against the registered occluder list at a 75 ms cadence. It does not scan the full scene graph every frame.
- A blocker transitions toward its configured fade opacity with frame-rate-independent damping. Its material is restored smoothly when the sightline clears.
- The eight overhead lamps also fade when the operator passes directly below them (3.15 m horizontal radius), even when the camera ray does not cross the lamp.
- A small cyan ground locator appears only while one or more scenery pieces are being faded. It is hidden when the view is clear.

## Occluder registration

The registry includes the arena perimeter and overhead lights, selected warehouse columns and cargo, map landmarks (containers, refrigeration units, port gantry and loading docks), elevated signs, and large instanced structures such as racks, trusses and dock frames.

Group-based discovery uses geometry bounds and world height/span to avoid registering floor paint and other low decorative details. Some large InstancedMesh batches are faded as one object when any of their instances blocks the camera ray; the individual instances keep their existing transforms and collision/navigation data.

## Resource and performance rules

- Each registered mesh receives private fade-material clones. Shared source materials are never modified.
- Level cleanup restores each original material, disposes its fade clones and clears the raycast registry.
- The player locator owns a per-level geometry/material and is disposed during level teardown.
- Raycasts are throttled; only the opacity interpolation runs each render frame.
- Any new large scenery mesh should either be registered explicitly or be placed in a map landmark group that is passed through the bounds-based discovery helper.

The automated gameplay-quality suite checks the registered scenery categories, fade interpolation, throttled raycast path and cleanup hooks. Physical-device frame-rate and visual checks still need to be confirmed on representative hardware, including the Poco F6.