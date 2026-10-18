# Squish Lab

A little room for big experiments. A free browser physics playground with soft elastic balls, wooden blocks, and a shelf full of toys.

**[Play Squish Lab](https://aru-tris.github.io/squish-lab/)**

## Play

- **Grab:** drag anything and let go to throw it. Fixed ramps and machines can be repositioned, too.
- **Squish:** hold a jelly, rubber, or water blob to compress it between a pair of jaws. Pull back to aim; release to launch. Without a pull, it launches upward.
- **Blast:** click to send nearby objects flying.
- **Erase:** remove individual objects. Undo restores your last edit.
- Click the shelf to add toys, or drag a toy into the room to place it precisely. On phones, swipe the toy shelf sideways.
- Select a preset: **The play room**, **Knock ’em down**, **Marble mischief**, or **Zero-G daydream**.
- Open settings for Earth, Moon, zero, or reverse gravity; slow motion; toy sizes; motion trails; local saves; and JSON import/export.
- Fans push nearby objects upward, magnets attract steel balls, bumpers kick objects away, and trampolines give a springy bounce.
- Sound is optional and starts muted. Saved rooms stay in this browser on this device; JSON export lets you move them elsewhere.

| Key | Action |
| --- | --- |
| `1`–`4` | Grab, squish, blast, erase |
| `Space` | Pause / resume |
| `R` | Reset the current scene |
| `B` | A surprise shower of balls |
| `G` | Cycle gravity |
| `Ctrl+Z` / `Cmd+Z` | Undo an edit |
| `Delete` | Remove selected object |
| `Esc` | Cancel interaction / close settings |
| `?` or `H` | How to play |

## Physics

Matter.js handles rigid-body mass, gravity, rotation, contact, friction, and restitution. Each soft ball is a closed membrane of **20 colliding particles**, connected by edge, bending, and internal spring constraints. An area-based internal pressure force resists collapse. Materials use different spring stiffness, pressure, and restitution, so they deform differently. Grabs use spring constraints and squeezing uses two actual colliding platens, rather than scaling a circle drawing.

Simulation runs at a fixed **120 physics steps per second**, independently of display refresh rate and time controls. Extreme velocities are bounded to keep the sandbox stable. Launch impulses, springy trampolines, bumper boosts, and field strengths are tuned for play. This is an approximate 2D game simulation, not an engineering or laboratory model.

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

The Node test suite checks equal gravitational acceleration across masses, floor contact, soft-body compression and recovery for all three elastic materials, release direction, fan and magnet behavior, fixed-toy movement, save/import preservation, atomic rejection of malformed imports, all four presets, and a 65-object stress scene with repeated blasts and a viewport resize.

Browser review covers desktop and 390px phone layouts, a real hold/release launch, adding toys, undo, scene switching, gravity, trails, slow motion, pause, and local save/restore. Performance depends on device and object count. Mobile layout has been checked in a desktop browser viewport; physical touch hardware has not been tested.

## License

MIT. Matter.js is MIT licensed; bundled attribution is retained by the build. Google Fonts are provided under their respective open font licenses.
