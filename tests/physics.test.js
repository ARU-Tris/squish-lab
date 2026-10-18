import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsRoom, centerOf, polygonArea, MAX_OBJECTS } from '../src/physics.js';

function advance(room, seconds) { for (let i = 0; i < seconds * 120; i++) room.step(); }
function height(e) { return Math.max(...e.nodes.map(n => n.position.y)) - Math.min(...e.nodes.map(n => n.position.y)); }
function assertFiniteAndContained(room) {
  for (const e of room.entities) for (const n of e.nodes) {
    assert.ok([n.position.x, n.position.y, n.velocity.x, n.velocity.y].every(Number.isFinite), `${e.kind} remains finite`);
    assert.ok(n.position.x > -60 && n.position.x < room.width + 60, `${e.kind} stays in horizontal bounds`);
    assert.ok(n.position.y > -60 && n.position.y < room.height + 60, `${e.kind} stays in vertical bounds`);
  }
}

test('different masses experience the same gravitational acceleration', () => {
  const room = new PhysicsRoom(1000, 900);
  const light = room.add('bouncy', 250, 100), heavy = room.add('steel', 750, 100);
  advance(room, 0.3);
  assert.ok(heavy.nodes[0].mass > light.nodes[0].mass * 5);
  assert.ok(Math.abs(centerOf(light).y - centerOf(heavy).y) < 0.01);
  assert.ok(centerOf(light).y > 135);
});

test('a rigid block collides with the floor and settles instead of falling through', () => {
  const room = new PhysicsRoom(1000, 700), block = room.add('crate', 500, 100);
  advance(room, 8);
  assert.ok(Math.abs(centerOf(block).y - 668) < 3);
  assert.ok(block.nodes[0].speed < 0.1);
});

for (const kind of ['jelly', 'rubber', 'water']) {
  test(`${kind} physically compresses between jaws, launches, and regains its shape`, () => {
    const room = new PhysicsRoom(1000, 900);
    room.setGravity('zero');
    const blob = room.add(kind, 500, 450), initial = height(blob);
    assert.ok(room.startPress(blob, { x: 500, y: 450 }));
    advance(room, 1.4);
    assert.ok(height(blob) < initial * 0.63, `${kind} height compressed to ${height(blob) / initial}`);
    assert.ok(polygonArea(blob.nodes) > blob.restArea * 0.2, 'membrane does not invert');
    room.releasePress();
    assert.equal(room.press, null);
    assert.ok(blob.nodes.every(n => n.velocity.y < -15), 'release produces upward launch');
    advance(room, 4);
    assert.ok(height(blob) > initial * 0.75, 'shape recovers after release');
    assert.ok(polygonArea(blob.nodes) > blob.restArea * 0.7);
    assertFiniteAndContained(room);
  });
}

test('pulling back while squishing changes the direction of the launch', () => {
  const room = new PhysicsRoom(), blob = room.add('rubber', 450, 350);
  room.startPress(blob, { x: 450, y: 350 });
  advance(room, 1);
  room.press.point = { x: 350, y: 430 };
  room.releasePress();
  assert.ok(blob.nodes.every(n => n.velocity.x > 10 && n.velocity.y < -8));
});

test('fan provides upward lift and magnet attracts only steel balls', () => {
  const room = new PhysicsRoom(); room.setGravity('zero');
  room.add('fan', 200, 500); const ball = room.add('bouncy', 200, 300);
  room.add('magnet', 900, 400); const steel = room.add('steel', 730, 400);
  const jelly = room.add('jelly', 730, 200);
  advance(room, 0.4);
  assert.ok(centerOf(ball).y < 285, 'fan lifts ball');
  assert.ok(centerOf(steel).x > 745, 'steel moves toward magnet');
  assert.ok(Math.abs(centerOf(jelly).x - 730) < 1, 'magnet leaves nonmetal alone');
});

test('grabbing fixed toys moves them without unfixing them; releasing removes grab joints', () => {
  const room = new PhysicsRoom(); const ramp = room.add('ramp', 400, 300);
  room.startGrab(ramp, { x: 400, y: 300 }); room.moveGrab({ x: 600, y: 200 }); room.endGrab();
  assert.equal(centerOf(ramp).x, 600); assert.equal(centerOf(ramp).y, 200); assert.equal(ramp.nodes[0].isStatic, true);
  const blob = room.add('jelly', 300, 300); room.startGrab(blob, { x: 300, y: 300 });
  assert.ok(room.grab.joint); room.endGrab(); assert.equal(room.grab, null);
});

test('room export/import preserves objects, material, gravity, and motion', () => {
  const room = new PhysicsRoom(1000, 700); room.scene('zero'); advance(room, 0.5);
  const data = room.serialize(), copy = new PhysicsRoom(1000, 700); copy.restore(JSON.parse(JSON.stringify(data)));
  assert.equal(copy.gravity, 'zero'); assert.equal(copy.entities.length, room.entities.length);
  copy.entities.forEach((e, i) => {
    assert.equal(e.kind, room.entities[i].kind);
    assert.ok(Math.abs(centerOf(e).x - centerOf(room.entities[i]).x) < 0.00001);
    assert.ok(Math.abs(e.nodes[0].velocity.y - room.entities[i].nodes[0].velocity.y) < 0.00001);
  });
});

test('invalid imports are rejected before any existing objects are changed', () => {
  const room = new PhysicsRoom(); room.scene(); const before = JSON.stringify(room.serialize());
  const invalid = room.serialize(); invalid.entities[2].nodes[0].x = null;
  assert.throws(() => room.restore(invalid));
  assert.equal(JSON.stringify(room.serialize()), before);
  assert.throws(() => room.restore({ version: 1, width: 100, height: 100, entities: Array(MAX_OBJECTS + 1).fill({}) }));
  const unknown = room.serialize(); unknown.entities[0].kind = '__proto__';
  assert.throws(() => room.restore(unknown));
  assert.equal(JSON.stringify(room.serialize()), before);
});

for (const scene of ['sandbox', 'bowling', 'marbles', 'zero']) {
  test(`${scene} scene stays stable through 20 simulated seconds`, () => {
    const room = new PhysicsRoom(1100, 700); room.scene(scene);
    const count = room.entities.length;
    advance(room, 4); room.blast(550, 400); advance(room, 16);
    assert.equal(room.entities.length, count, 'no bodies lost to numerical failure');
    assertFiniteAndContained(room);
    for (const blob of room.entities.filter(e => e.mat.soft)) assert.ok(polygonArea(blob.nodes) > blob.restArea * 0.30, `${blob.kind} retains volume`);
  });
}

test('65-object stress room survives repeated blasts and a viewport resize', () => {
  const room = new PhysicsRoom(1200, 850);
  for (let i = 0; i < MAX_OBJECTS; i++) room.add(['bouncy','crate','jelly','steel','rubber'][i % 5], 90 + (i % 10) * 100, 90 + Math.floor(i / 10) * 100, { size: 0.6 });
  assert.equal(room.add('crate', 300, 300), null);
  for (let i = 0; i < 6; i++) { room.blast(300 + i * 100, 450); advance(room, 0.8); }
  room.resize(600, 700); advance(room, 3);
  assert.equal(room.entities.length, MAX_OBJECTS);
  assertFiniteAndContained(room);
});
