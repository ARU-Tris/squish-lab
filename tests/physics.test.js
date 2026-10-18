import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsRoom, centerOf, polygonArea, MAX_OBJECTS, MATERIALS, shapeTransform, poseOf } from '../src/physics.js';

function advance(room, seconds) { for (let i = 0; i < seconds * 120; i++) room.step(); }
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

test('a wooden block collides with the floor and settles instead of falling through', () => {
  const room = new PhysicsRoom(1000, 700), block = room.add('crate', 500, 100);
  advance(room, 8);
  assert.ok(Math.abs(centerOf(block).y - 668) < 3);
  assert.ok(block.nodes[0].speed < 0.1);
});

for (const kind of ['water', 'jelly', 'rubber']) {
  test(`${kind} survives sustained corner compression and unfolds after release`, () => {
    for (let variation = 0; variation < 10; variation++) {
    const room = new PhysicsRoom(1000, 700); room.setGravity('zero');
    const e = room.add(kind, 500 + variation * 0.013, 350, { angle: variation * 0.000001 });
    room.startGrab(e, centerOf(e)); room.moveGrab({ x: -200, y: -200 });
    for (let i = 0; i < 480; i++) {
      room.step();
      assert.ok(polygonArea(e.nodes) > e.restArea * 0.25, 'corner pressure cannot invert the membrane');
    }
    room.endGrab(); advance(room, 3);
    assert.ok(shapeTransform(e).compression < 0.03, 'a folded edge cannot remain stuck inside the blob');
    assertFiniteAndContained(room);
    }
  });
}

for (const kind of Object.keys(MATERIALS)) {
  test(`${kind} can be compressed with the normal grab and recovers after release`, () => {
    const room = new PhysicsRoom(1000, 700); room.setGravity('zero');
    const e = room.add(kind, 500, 550, { angle: 0 });
    room.startGrab(e, centerOf(e)); room.moveGrab({ x: 500, y: 730 });
    advance(room, 1.5);
    assert.ok(shapeTransform(e).compression > 0.001, `${kind} collision shape responds to pressure`);
    assert.ok(polygonArea(e.nodes) > e.restArea * 0.30, 'mesh keeps its orientation and volume');
    const velocities = e.nodes.map(n => ({ ...n.velocity }));
    room.endGrab();
    assert.equal(room.grab, null);
    e.nodes.forEach((n, i) => assert.deepEqual(n.velocity, velocities[i], 'release adds no artificial launch velocity'));
    advance(room, 0.17);
    if (e.mat.soft) assert.ok(e.nodes.reduce((y,n) => y + n.velocity.y / e.nodes.length, 0) < -1, 'stored deformation springs away from floor');
    advance(room, 2);
    assert.ok(shapeTransform(e).compression < 0.03, `${kind} regains its shape`);
    assertFiniteAndContained(room);
  });
}

for (const wall of ['left', 'right', 'ceiling', 'floor']) {
  test(`normal grabbing squishes a ball against the ${wall}`, () => {
    const room = new PhysicsRoom(1000, 700); room.setGravity('zero');
    const e = room.add('jelly', 500, 350);
    const targets = { left: {x:-30,y:350}, right: {x:1030,y:350}, ceiling: {x:500,y:-30}, floor: {x:500,y:730} };
    const beforeBodies = room.engine.world.bodies.length;
    room.startGrab(e, centerOf(e)); room.moveGrab(targets[wall]); advance(room, 1.5);
    assert.ok(shapeTransform(e).compression > 0.25);
    assert.equal(room.engine.world.bodies.length, beforeBodies, 'no compression jaws or invisible press objects');
    room.endGrab(); advance(room, 2);
    assert.ok(shapeTransform(e).compression < 0.03);
    assertFiniteAndContained(room);
  });
}

test('harder materials deform progressively less under the same grabbing pressure', () => {
  const compression = ['water','jelly','rubber','bouncy','steel'].map(kind => {
    const room = new PhysicsRoom(1000,700); room.setGravity('zero');
    const e = room.add(kind,500,550);
    room.startGrab(e,centerOf(e)); room.moveGrab({x:500,y:730}); advance(room,1.5);
    return shapeTransform(e).compression;
  });
  for (let i = 1; i < compression.length; i++) assert.ok(compression[i] < compression[i-1], JSON.stringify(compression));
  assert.ok(compression[0] > 0.45);
  assert.ok(compression.at(-1) < 0.03);
});

test('grabbing in free space transports the object without automatically charging a squish', () => {
  const room = new PhysicsRoom(1500,1000); room.setGravity('zero');
  const e = room.add('jelly',550,500);
  room.startGrab(e,centerOf(e)); room.moveGrab({x:750,y:400}); advance(room,1.5);
  assert.ok(Math.abs(centerOf(e).x-750)<1);
  assert.ok(Math.abs(centerOf(e).y-400)<1);
  assert.ok(shapeTransform(e).compression<0.01);
  const bodyCount = room.engine.world.bodies.length;
  room.endGrab(); assert.equal(room.engine.world.bodies.length,bodyCount);
});

test('a ball also squishes against another mounted object', () => {
  const room = new PhysicsRoom(1000,700); room.setGravity('zero');
  room.add('ramp',500,550,{angle:0,size:1.65});
  const e=room.add('jelly',500,350);
  room.startGrab(e,centerOf(e)); room.moveGrab({x:500,y:545}); advance(room,1.5);
  assert.ok(shapeTransform(e).compression>0.15);
  assert.ok(centerOf(e).y<545);
  room.endGrab(); advance(room,2); assertFiniteAndContained(room);
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

test('mounted toys can be moved with the same grab and stay mounted after release', () => {
  const room = new PhysicsRoom(); room.setGravity('zero');
  const ramp = room.add('ramp',400,300,{angle:0});
  room.startGrab(ramp, {x:400,y:300}); room.moveGrab({x:600,y:200}); advance(room,1);
  assert.ok(Math.abs(centerOf(ramp).x-600)<1); assert.ok(Math.abs(centerOf(ramp).y-200)<1);
  assert.equal(ramp.mounts.length,0);
  room.endGrab(); assert.equal(room.grab,null); assert.equal(ramp.mounts.length,ramp.nodes.length);
  const c=centerOf(ramp); advance(room,2);
  assert.ok(Math.hypot(centerOf(ramp).x-c.x,centerOf(ramp).y-c.y)<2);
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

test('existing version 1 rooms migrate every former solid body to an elastic mesh', () => {
  const original = new PhysicsRoom(1100,700); original.scene('sandbox');
  const legacy=original.serialize(); legacy.version=1;
  legacy.entities=legacy.entities.map(e=>MATERIALS[e.kind].soft?e:{...e,nodes:[{x:e.position.x,y:e.position.y,vx:1,vy:2,angle:e.angle,angularVelocity:0}]});
  const copy = new PhysicsRoom(1100,700); copy.restore(legacy);
  assert.equal(copy.entities.length,legacy.entities.length);
  for(let i=0;i<copy.entities.length;i++){
    const e=copy.entities[i],old=legacy.entities[i];
    assert.ok(e.nodes.length>1);
    assert.ok(Math.hypot(centerOf(e).x-old.position.x,centerOf(e).y-old.position.y)<0.001);
    if(!e.mat.soft) assert.ok(Math.abs(poseOf(e).angle-old.angle)<0.001);
  }
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
