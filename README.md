# Squish Lab

A little room for big experiments. A free browser physics playground with soft elastic balls, wooden blocks, and a shelf full of toys.

**[Play Squish Lab](https://aru-tris.github.io/squish-lab/)**

## Play

- **Grab & squish:** grab any object and push it into a wall, the floor, ceiling, or another toy. Push harder to compress it more, then release to launch away from that surface. Rubber gives a particularly strong rebound. Move quickly and let go to throw it.
- **Every toy is elastic.** Water and jelly compress easily, rubber resists more, and wood and metal need much more pressure. Mounted ramps and machines can also be moved and compressed with the same grab.
- **Blast:** click to send nearby objects flying.
- **Erase:** remove individual objects. Undo restores your last edit.
- Click the shelf to add toys, or drag a toy into the room to place it precisely. On phones, swipe the toy shelf sideways.
- Select a preset: **The play room**, **Knock ’em down**, **Marble mischief**, or **Zero-G daydream**.
- Open settings for Earth, Moon, zero, or reverse gravity; slow motion; toy sizes; motion trails; local saves; and JSON import/export.
- Fans push nearby objects upward, magnets attract steel balls, bumpers kick objects away, and trampolines give a springy bounce.
- Sound is optional and starts muted. Saved rooms stay in this browser on this device; JSON export lets you move them elsewhere.

| Key | Action |
| --- | --- |
| `1`–`3` | Grab & squish, blast, erase |
| `Space` | Pause / resume |
| `R` | Reset the current scene |
| `B` | A surprise shower of balls |
| `G` | Cycle gravity |
| `Ctrl+Z` / `Cmd+Z` | Undo an edit |
| `Delete` | Remove selected object |
| `Esc` | Cancel interaction / close settings |
| `?` or `H` | How to play |

## Physics

Matter.js handles mass, gravity, rotation, contact, friction, and restitution. **Every toy uses an elastic collision mesh**: 20 membrane particles for soft blobs, 16 for firm balls, and a sampled rectangular perimeter for blocks and machines. Edge, bending, and internal spring constraints preserve shape, while an area-based pressure force resists collapse. Hard materials use stronger springs and extra internal links. The drawn outline follows the physical membrane; markings deform with it.

A normal grab applies a damped force across the object. In free space this moves the whole toy. Against a surface, contact blocks the leading particles while the hand continues pushing, so the mesh compresses naturally. Releasing a compressed toy adds a bounded launch impulse based on its current deformation and material, directed away from the supporting contacts. This compensates for energy lost by the stable membrane solver and gives a stronger, more playful rebound. There are no compression jaws or timer-based charges: holding an uncompressed toy never stores launch power. Cancellation, changing tools, pausing, and resizing do not trigger the launch assist. Mounted toys use world anchors that detach during a grab and remount on release.

Signed bending, self-contact, and volume constraints resist inversion during deep corner compression. Elastic projection clears outdated solver corrections, and material damping reduces internal jitter while preserving the toy's thrown motion.

Simulation runs at a fixed **120 physics steps per second**, independently of display refresh rate and time controls. Extreme velocities are bounded to keep the sandbox stable. Springy trampolines, bumper boosts, and field strengths are tuned for play. This is an approximate 2D game simulation, not an engineering or laboratory model.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

```sh
npm test        # deterministic physics and persistence checks
npm run build  # production static files in dist/
npm run preview
```

Source is vanilla JavaScript, CSS, Canvas 2D, and Matter.js. There is no game server, account, advertising, or analytics. Game code and physics are bundled locally; the page requests DM Sans and Manrope from Google Fonts and falls back to system fonts when unavailable.

## Deployment

GitHub Pages serves the production build. The deploy workflow runs the physics tests and build before publishing, with Pages set to **GitHub Actions** in repository settings. All asset paths are relative so the game works under `/squish-lab/` and on other static hosts.

## Validation

The 46 Node tests check equal gravitational acceleration across masses, floor contact, natural grab compression and recovery for **all 13 toy types**, all four room walls, sustained corner compression and unfolding, compression against another object, progressively stronger material resistance, free-space grabbing, fan and magnet behavior, mounted-toy movement, save/import preservation, version 1 saved-room migration, atomic rejection of malformed imports, all four presets, and a 65-object stress scene with repeated blasts and a viewport resize. Rebound tests compare Earth-gravity launch heights against passive recovery, check stronger compression produces stronger launches, verify surface direction and cancellation behavior, and exercise repeated releases in a small room.

Browser review covers desktop and 390px phone layouts, normal dragging against a wall, adding toys, undo, scene switching, gravity, trails, slow motion, pause, and local save/restore. Existing version 1 saves continue to open and are upgraded to elastic meshes when loaded. Performance depends on device and object count. Mobile layout has been checked in a desktop browser viewport; physical touch hardware has not been tested.

## License

MIT. Matter.js is MIT licensed; bundled attribution is retained by the build. Google Fonts are provided under their respective open font licenses.
