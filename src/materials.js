// Stiffness controls the actual collision mesh, not just its drawing.
export const MATERIALS = {
  jelly: { name: 'Jelly', color: '#97c5ef', dark: '#537fa8', radius: 48, soft: true, stiffness: 0.045, pressure: 0.00032, restitution: 0.40, rebound: 0.95, firmness: 'Very soft' },
  rubber: { name: 'Rubber', color: '#f5aa9c', dark: '#ba6555', radius: 40, soft: true, stiffness: 0.12, pressure: 0.00065, restitution: 0.72, rebound: 1.35, firmness: 'Springy' },
  water: { name: 'Water blob', color: '#b6abd9', dark: '#80709d', radius: 51, soft: true, stiffness: 0.018, pressure: 0.00024, restitution: 0.22, rebound: 0.70, firmness: 'Extra soft' },
  bouncy: { name: 'Super ball', color: '#ebcd64', dark: '#ac8b2e', radius: 24, stiffness: 0.21, pressure: 0.0011, restitution: 0.96, rebound: 1.50, firmness: 'Firm rubber' },
  steel: { name: 'Steel ball', color: '#a6afb3', dark: '#646e73', radius: 27, stiffness: 0.88, pressure: 0.006, density: 0.012, restitution: 0.3, firmness: 'Very hard' },
  crate: { name: 'Wooden block', color: '#d7ad7c', dark: '#926d46', width: 64, height: 64, stiffness: 0.36, pressure: 0.0021, firmness: 'Hard wood' },
  plank: { name: 'Plank', color: '#c8b08b', dark: '#8c7350', width: 145, height: 20, stiffness: 0.30, pressure: 0.0018, firmness: 'Hard wood' },
  ramp: { name: 'Ramp', color: '#d5d8d0', dark: '#969f8c', width: 150, height: 16, fixed: true, stiffness: 0.65, pressure: 0.003, firmness: 'Hard · mounted' },
  trampoline: { name: 'Trampoline', color: '#91bba4', dark: '#5a886b', width: 132, height: 18, fixed: true, stiffness: 0.16, pressure: 0.0009, restitution: 1.18, firmness: 'Springy · mounted' },
  bumper: { name: 'Bumper', color: '#f6c15e', dark: '#b98531', radius: 33, fixed: true, stiffness: 0.25, pressure: 0.0013, firmness: 'Firm · mounted' },
  fan: { name: 'Fan', color: '#a6c5c5', dark: '#5f8c8c', width: 60, height: 45, fixed: true, stiffness: 0.48, pressure: 0.0025, firmness: 'Hard · mounted' },
  magnet: { name: 'Magnet', color: '#df9295', dark: '#a4535d', width: 54, height: 48, fixed: true, stiffness: 0.75, pressure: 0.004, firmness: 'Very hard · mounted' },
  pin: { name: 'Bowling pin', color: '#faf7ea', dark: '#9b9b8a', width: 22, height: 73, stiffness: 0.31, pressure: 0.0018, firmness: 'Hard wood' },
};

export function restShape(mat, size) {
  if (mat.radius) {
    const radius = mat.radius * size, count = mat.soft ? 20 : 16;
    const nodeRadius = radius * (mat.soft ? 0.165 : 0.20);
    return { nodeRadius, points: Array.from({ length: count }, (_, i) => ({ x: Math.cos(i / count * Math.PI * 2) * (radius - nodeRadius), y: Math.sin(i / count * Math.PI * 2) * (radius - nodeRadius) })) };
  }
  const w = mat.width * size, h = mat.height * size;
  const nodeRadius = Math.min(6 * size, Math.min(w, h) * 0.27);
  const corners = [{ x: -w / 2 + nodeRadius, y: -h / 2 + nodeRadius }, { x: w / 2 - nodeRadius, y: -h / 2 + nodeRadius }, { x: w / 2 - nodeRadius, y: h / 2 - nodeRadius }, { x: -w / 2 + nodeRadius, y: h / 2 - nodeRadius }];
  const points = [];
  for (let edge = 0; edge < 4; edge++) {
    const a = corners[edge], b = corners[(edge + 1) % 4];
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (nodeRadius * 1.75)));
    for (let i = 0; i < count; i++) points.push({ x: a.x + (b.x - a.x) * i / count, y: a.y + (b.y - a.y) * i / count });
  }
  return { nodeRadius, points };
}
