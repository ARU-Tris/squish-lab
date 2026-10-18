import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsRoom, centerOf, shapeTransform, polygonArea } from '../src/physics.js';

const advance = (room, steps) => { for (let i = 0; i < steps; i++) room.step(); };
const velocityOf = e => e.nodes.reduce((v, n) => ({ x: v.x + n.velocity.x / e.nodes.length, y: v.y + n.velocity.y / e.nodes.length }), { x: 0, y: 0 });
function pressedBall(kind = 'jelly', targetY = 1830) {
  const room = new PhysicsRoom(1200, 1800), e = room.add(kind, 600, 1600);
  room.startGrab(e, centerOf(e)); room.moveGrab({ x: 600, y: targetY });
  advance(room, 180);
  return { room, e };
}
function peakHeight(kind, boosted, targetY) {
  const { room, e } = pressedBall(kind, targetY);
  const strain = shapeTransform(e).compression, startY = centerOf(e).y;
  room.endGrab(boosted);
  let top = startY;
  for (let i = 0; i < 360; i++) { room.step(); top = Math.min(top, centerOf(e).y); }
  return { height: startY - top, strain };
}

for (const kind of ['jelly', 'rubber', 'water']) {
  test(`${kind} squish release launches substantially higher in Earth gravity`, () => {
    const passive = peakHeight(kind, false), launch = peakHeight(kind, true);
    assert.ok(launch.height > 350, `${kind} reached ${launch.height.toFixed(1)}px`);
    assert.ok(launch.height > passive.height * 8, 'compression produces a visible launch instead of a small hop');
  });
}

test('a deeper squish produces a higher launch', () => {
  const light = peakHeight('jelly', true, 1770), deep = peakHeight('jelly', true, 1830);
  assert.ok(deep.strain > light.strain);
  assert.ok(deep.height > light.height * 1.3);
});

test('releases launch away from whichever room surface was pressed', () => {
  const cases = [
    { target: { x: -30, y: 600 }, direction: { x: 1, y: 0 } },
    { target: { x: 1430, y: 600 }, direction: { x: -1, y: 0 } },
    { target: { x: 700, y: -30 }, direction: { x: 0, y: 1 } },
    { target: { x: 700, y: 1230 }, direction: { x: 0, y: -1 } },
    { target: { x: -30, y: -30 }, direction: { x: Math.SQRT1_2, y: Math.SQRT1_2 } },
  ];
  for (const { target, direction } of cases) {
    const room = new PhysicsRoom(1400, 1200); room.setGravity('zero');
    const e = room.add('jelly', 700, 600);
    room.startGrab(e, centerOf(e)); room.moveGrab(target); advance(room, 180);
    room.endGrab();
    const v = velocityOf(e);
    assert.ok(v.x * direction.x + v.y * direction.y > 14, 'launch follows the supporting surface normal');
  }
});

test('holding an uncompressed object in free space never charges a launch', () => {
  const room = new PhysicsRoom(1200, 1800); room.setGravity('zero');
  const e = room.add('rubber', 600, 900);
  room.startGrab(e, centerOf(e)); advance(room, 600);
  const before = e.nodes.map(n => ({ ...n.velocity }));
  room.endGrab();
  e.nodes.forEach((n, i) => assert.deepEqual(n.velocity, before[i]));
});

test('pulling away from a surface clears the opportunity for a compression launch', () => {
  const { room, e } = pressedBall();
  room.moveGrab({ x: 600, y: 900 }); advance(room, 240);
  assert.ok(shapeTransform(e).compression < 0.025);
  const before = e.nodes.map(n => ({ ...n.velocity }));
  room.endGrab(); e.nodes.forEach((n, i) => assert.deepEqual(n.velocity, before[i]));
});

test('cancellation and viewport resizing cannot accidentally fire a launch', () => {
  for (const resize of [false, true]) {
    const { room, e } = pressedBall();
    const before = e.nodes.map(n => ({ ...n.velocity }));
    if (resize) room.resize(1000, 1600); else room.endGrab(false);
    e.nodes.forEach((n, i) => assert.deepEqual(n.velocity, before[i]));
  }
});

test('pressing against a mounted toy also produces a stronger rebound', () => {
  const room = new PhysicsRoom(1200, 1800); room.setGravity('zero');
  room.add('ramp', 600, 1100, { angle: 0, size: 1.65 });
  const e = room.add('jelly', 600, 900);
  room.startGrab(e, centerOf(e)); room.moveGrab({ x: 600, y: 1100 }); advance(room, 180);
  room.endGrab(); assert.ok(velocityOf(e).y < -15);
});

test('a release only fires once and mounted toys remain mounted', () => {
  const { room, e } = pressedBall(); room.endGrab();
  const once = e.nodes.map(n => ({ ...n.velocity }));
  room.endGrab(); e.nodes.forEach((n, i) => assert.deepEqual(n.velocity, once[i]));
  const fan = room.add('fan', 400, 700);
  room.startGrab(fan, centerOf(fan)); room.moveGrab({ x: -30, y: 700 }); advance(room, 180);
  const before = fan.nodes.map(n => ({ ...n.velocity }));
  room.endGrab();
  assert.equal(fan.mounts.length, fan.nodes.length);
  fan.nodes.forEach((n, i) => assert.deepEqual(n.velocity, before[i]));
});

test('strong releases remain contained and preserve soft bodies in a small room', () => {
  for (const kind of ['water', 'jelly', 'rubber']) {
    const room = new PhysicsRoom(390, 550), e = room.add(kind, 180, 300);
    for (const target of [{ x: 180, y: 580 }, { x: -40, y: -40 }]) {
      room.startGrab(e, centerOf(e)); room.moveGrab(target); advance(room, 180); room.endGrab();
      for (let i = 0; i < 600; i++) {
        room.step();
        assert.equal(room.entities.length, 1);
        assert.ok(polygonArea(e.nodes) > e.restArea * 0.25);
        for (const n of e.nodes) {
          assert.ok([n.position.x, n.position.y, n.velocity.x, n.velocity.y].every(Number.isFinite));
          assert.ok(n.position.x > -20 && n.position.x < room.width + 20);
          assert.ok(n.position.y > -20 && n.position.y < room.height + 20);
          assert.ok(n.speed <= 45.01);
        }
      }
    }
  }
});
