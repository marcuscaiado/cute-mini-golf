import './style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sfxSwing, sfxBounce, sfxHoleSink, sfxVictory, sfxClick, sfxSelect, sfxBoost, sfxBallBreak, sfxLoop, sfxRespawn } from './audio.js';

// =============================================
//  CUTE MINI GOLF 3D
//  Nintendo-inspired visuals • Click & drag aim
// =============================================

// --- STATE ---
let selectedCharKey = null;
let selectedChar = null;
let strokes = 0;
let totalStrokes = 0;
let currentHoleNumber = 1;
let isAiming = false;
let aimPower = 0;
let isBallMoving = false;
let inHole = false;
let gameStarted = false;
let isBallBroken = false;
let lastShotPos = new THREE.Vector3(0, 0.22, 8);
let charStandPos = new THREE.Vector3(0, 0, 9.2); // Where the character stands

// --- Dynamic Obstacle & Hazard Registries ---
let currentObstacleObjects = [];
let activeBoosters = [];
let activeSpikes = [];
let activeLoops = [];
let activeFragments = [];
let lastBoostSfxTime = 0;
let inLoopAnimation = false;
let loopAnimProgress = 0;
let currentLoopObj = null;

// --- DOM ---
const charSelectEl = document.getElementById('char-select');
const gameUiEl = document.getElementById('game-ui');
const scoreEl = document.getElementById('strokes');
const holeBadgeEl = document.getElementById('hole-badge');
const totalStrokesEl = document.getElementById('total-strokes');
const powerContainerEl = document.getElementById('power-bar-container');
const powerBarEl = document.getElementById('power-bar');
const messageEl = document.getElementById('message');
const charIndicatorEl = document.getElementById('char-indicator');
const aimHintEl = document.getElementById('aim-hint');
const nextHoleBtn = document.getElementById('next-hole-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const endActionsContainer = document.getElementById('end-actions-container');
const navChangeCharBtn = document.getElementById('nav-change-char-btn');
const switchCharBtn = document.getElementById('switch-char-btn');

function updateScoreDisplay() {
  if (scoreEl) scoreEl.textContent = strokes;
  if (holeBadgeEl) holeBadgeEl.textContent = `Hole ${currentHoleNumber}`;
  if (totalStrokesEl) totalStrokesEl.textContent = totalStrokes + (inHole ? 0 : strokes);
}

// =============================================
//  CHARACTER DEFINITIONS
// =============================================
const characters = {
  bunny: {
    name: 'Bunny',
    emoji: '🐰',
    bodyColor: 0xf5f0eb,    // Soft cream-white
    bellyColor: 0xfff5ee,
    earInner: 0xffb6c1,     // Pink inner ears
    noseColor: 0xff69b4,
    footColor: 0xf5f0eb,
  },
  frog: {
    name: 'Froggy',
    emoji: '🐸',
    bodyColor: 0x4caf50,    // Green
    bellyColor: 0xc8e6c9,   // Light green belly
    spotColor: 0x388e3c,    // Dark green spots
    eyeBulge: 0x66bb6a,
    mouthColor: 0xd32f2f,
    footColor: 0x388e3c,
  },
  chick: {
    name: 'Chicky',
    emoji: '🐥',
    bodyColor: 0xffd54f,    // Bright yellow
    bellyColor: 0xfff9c4,   // Lighter yellow belly
    beakColor: 0xff9800,    // Orange beak
    combColor: 0xf44336,    // Red comb
    wingColor: 0xffca28,
    footColor: 0xff9800,
  }
};

// Fill character preview panels with emojis
document.getElementById('preview-bunny').textContent = '🐰';
document.getElementById('preview-frog').textContent = '🐸';
document.getElementById('preview-chick').textContent = '🐥';

// =============================================
//  THREE.JS SETUP
// =============================================
const scene = new THREE.Scene();
scene.background = new THREE.Color('#7ec8e3');
scene.fog = new THREE.FogExp2('#7ec8e3', 0.012);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 12, 18);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('app').appendChild(renderer.domElement);

// --- LIGHTING ---
scene.add(new THREE.AmbientLight('#c8e0ff', 0.7));

const sunLight = new THREE.DirectionalLight('#fff5e0', 1.4);
sunLight.position.set(8, 18, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 60;
sunLight.shadow.camera.left = -25;
sunLight.shadow.camera.right = 25;
sunLight.shadow.camera.top = 25;
sunLight.shadow.camera.bottom = -25;
sunLight.shadow.bias = -0.001;
sunLight.shadow.radius = 4;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight('#b0d4f1', 0.4);
fillLight.position.set(-6, 8, -8);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight('#87ceeb', '#8bd973', 0.5);
scene.add(hemiLight);

// =============================================
//  CANNON.JS PHYSICS
// =============================================
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -12, 0) });
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const groundPhysMat = new CANNON.Material('ground');
const ballPhysMat = new CANNON.Material('ball');
const wallPhysMat = new CANNON.Material('wall');

world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, groundPhysMat, {
  friction: 0.2,
  restitution: 0.7
}));
world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, wallPhysMat, {
  friction: 0.02,
  restitution: 0.95
}));

const objectsToUpdate = [];

// =============================================
//  SHARED MATERIALS
// =============================================
const courseMat = new THREE.MeshStandardMaterial({ color: '#8bd973', roughness: 0.85, metalness: 0.0 });
const courseEdgeMat = new THREE.MeshStandardMaterial({ color: '#5cb85c', roughness: 0.7, metalness: 0.0 });
const wallMat = new THREE.MeshStandardMaterial({ color: '#ffb973', roughness: 0.6, metalness: 0.05 });
const obstacleMat = new THREE.MeshStandardMaterial({ color: '#a29bfe', roughness: 0.5, metalness: 0.05 });
const holeDarkMat = new THREE.MeshBasicMaterial({ color: '#1a1a2e' });
const flagPoleMat = new THREE.MeshStandardMaterial({ color: '#e0e0e0', roughness: 0.3, metalness: 0.6 });
const flagClothMat = new THREE.MeshStandardMaterial({ color: '#ff6b9d', roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide });
const waterMat = new THREE.MeshStandardMaterial({ color: '#4fc3f7', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.7 });

// --- NEW INTERACTIVE OBSTACLE MATERIALS ---
const boosterBorderMat = new THREE.MeshStandardMaterial({ color: '#2d3436', roughness: 0.35, metalness: 0.7 });
const boosterArrowMat = new THREE.MeshStandardMaterial({ color: '#00f5ff', roughness: 0.2, emissive: '#00f5ff', emissiveIntensity: 0.9 });
const spikePlateMat = new THREE.MeshStandardMaterial({ color: '#1e272e', roughness: 0.4, metalness: 0.8 });
const spikeConeMat = new THREE.MeshStandardMaterial({ color: '#ff3838', roughness: 0.25, emissive: '#c0392b', emissiveIntensity: 0.8 });
const loopNeonMat = new THREE.MeshStandardMaterial({ color: '#6c5ce7', roughness: 0.3, emissive: '#a29bfe', emissiveIntensity: 0.5 });
const loopRingMat = new THREE.MeshStandardMaterial({ color: '#fd79a8', roughness: 0.2, emissive: '#fd79a8', emissiveIntensity: 0.85 });
const terraceMat = new THREE.MeshStandardMaterial({ color: '#78e08f', roughness: 0.85 });
const terraceWallMat = new THREE.MeshStandardMaterial({ color: '#e17055', roughness: 0.7 });
const rampMat = new THREE.MeshStandardMaterial({ color: '#55efc4', roughness: 0.7 });
const shardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, metalness: 0.1 });

// =============================================
//  LEVEL BUILDER
// =============================================
function createStaticBox(sx, sy, sz, px, py, pz, material, physMat = groundPhysMat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(px, py, pz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px, py, pz),
    shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
    material: physMat
  });
  world.addBody(body);
  return { mesh, body };
}

// =============================================
//  BUILD THE BASE COURSE
// =============================================
createStaticBox(10, 0.5, 22, 0, -0.25, 0, courseMat, groundPhysMat);
createStaticBox(11.2, 0.3, 23.2, 0, -0.45, 0, courseEdgeMat, groundPhysMat);

createStaticBox(11, 1.2, 0.6, 0, 0.35, -11.3, wallMat, wallPhysMat);
createStaticBox(11, 1.2, 0.6, 0, 0.35, 11.3, wallMat, wallPhysMat);
createStaticBox(0.6, 1.2, 22, -5.3, 0.35, 0, wallMat, wallPhysMat);
createStaticBox(0.6, 1.2, 22, 5.3, 0.35, 0, wallMat, wallPhysMat);

// =============================================
//  DYNAMIC PROCEDURAL OBSTACLE BUILDERS
// =============================================
function clearObstacles() {
  for (const obs of currentObstacleObjects) {
    if (obs.mesh) {
      scene.remove(obs.mesh);
      if (obs.mesh.geometry) obs.mesh.geometry.dispose();
    }
    if (obs.body) {
      world.removeBody(obs.body);
    }
  }
  currentObstacleObjects = [];
  activeBoosters = [];
  activeSpikes = [];
  activeLoops = [];
  for (const f of activeFragments) {
    if (f.mesh) scene.remove(f.mesh);
  }
  activeFragments = [];
}

function addObstacleBox(sx, sy, sz, px, py, pz, rotY = 0, material = obstacleMat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(px, py, pz);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px, py, pz),
    shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
    material: wallPhysMat
  });
  if (rotY !== 0) {
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
  }
  world.addBody(body);
  currentObstacleObjects.push({ mesh, body });
  return { mesh, body };
}

function addBumperCylinder(radius, height, px, pz, colorHex = 0xff6b9d) {
  const group = new THREE.Group();
  const cylGeo = new THREE.CylinderGeometry(radius, radius, height, 20);
  const cylMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.1 });
  const cylMesh = new THREE.Mesh(cylGeo, cylMat);
  cylMesh.position.y = height / 2;
  cylMesh.castShadow = true;
  cylMesh.receiveShadow = true;
  group.add(cylMesh);

  // Shiny white bumper ring
  const capGeo = new THREE.TorusGeometry(radius * 0.85, 0.06, 8, 24);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    emissive: 0xffffff,
    emissiveIntensity: 0.35
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.rotation.x = Math.PI / 2;
  cap.position.y = height + 0.02;
  group.add(cap);

  group.position.set(px, 0, pz);
  scene.add(group);

  const body = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px, height / 2, pz),
    shape: new CANNON.Cylinder(radius, radius, height, 16),
    material: wallPhysMat
  });
  world.addBody(body);
  currentObstacleObjects.push({ mesh: group, body });
  return { mesh: group, body };
}

/** SPEED BOOSTER / CONVEYOR BELT (Esteira Aceleradora) */
function addSpeedBooster(px, pz, width = 1.8, length = 3.2, dirX = 0, dirZ = -1, power = 24.0) {
  const group = new THREE.Group();

  // Dark metallic bezel
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.04, length),
    boosterBorderMat
  );
  bezel.position.y = 0.02;
  bezel.receiveShadow = true;
  group.add(bezel);

  // Conveyor surface strip
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.88, length * 0.94),
    new THREE.MeshStandardMaterial({ color: '#0984e3', roughness: 0.4 })
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.042;
  group.add(surface);

  // 3 Animated Glowing Chevron Arrows
  const arrows = [];
  const arrowSpacing = length / 4;
  for (let i = -1; i <= 1; i++) {
    const arrowGroup = new THREE.Group();
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(width * 0.32, 0.02, 0.12), boosterArrowMat);
    l1.position.set(-width * 0.12, 0, -0.06 * (dirZ < 0 ? 1 : -1));
    l1.rotation.y = (dirZ < 0 ? 1 : -1) * (Math.PI / 4);

    const l2 = new THREE.Mesh(new THREE.BoxGeometry(width * 0.32, 0.02, 0.12), boosterArrowMat);
    l2.position.set(width * 0.12, 0, -0.06 * (dirZ < 0 ? 1 : -1));
    l2.rotation.y = -(dirZ < 0 ? 1 : -1) * (Math.PI / 4);

    arrowGroup.add(l1);
    arrowGroup.add(l2);
    arrowGroup.position.set(0, 0.05, i * arrowSpacing);
    group.add(arrowGroup);
    arrows.push(arrowGroup);
  }

  group.position.set(px, 0, pz);
  scene.add(group);

  const boosterData = { px, pz, width, length, dirX, dirZ, power, mesh: group, arrows };
  activeBoosters.push(boosterData);
  currentObstacleObjects.push({ mesh: group });
  return boosterData;
}

/** SPIKE HAZARD TRAP (Espinhos Quebra-Bola) */
function addSpikeTrap(px, pz, radius = 0.85, count = 5) {
  const group = new THREE.Group();

  // Dark hazard plate
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.06, 8),
    spikePlateMat
  );
  base.position.y = 0.03;
  base.receiveShadow = true;
  group.add(base);

  // Warning ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.85, radius * 0.98, 8),
    new THREE.MeshBasicMaterial({ color: '#ff7675', side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.065;
  group.add(ring);

  // Center + outer circle spike cones
  const spikePositions = [[0, 0]];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    spikePositions.push([Math.cos(angle) * radius * 0.55, Math.sin(angle) * radius * 0.55]);
  }

  for (const [sx, sz] of spikePositions) {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.42, 6),
      spikeConeMat
    );
    spike.position.set(sx, 0.22, sz);
    spike.castShadow = true;
    group.add(spike);
  }

  group.position.set(px, 0, pz);
  scene.add(group);

  const body = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px, 0.2, pz),
    shape: new CANNON.Cylinder(radius * 0.8, radius * 0.8, 0.4, 8),
    material: wallPhysMat
  });
  world.addBody(body);

  const spikeData = { px, pz, radius, mesh: group, body };
  activeSpikes.push(spikeData);
  currentObstacleObjects.push({ mesh: group, body });
  return spikeData;
}

/** 3D LOOP-DE-LOOP & SLINGSHOT CHUTE (Looping 3D) */
function addLoopChute(px, pz, angle = 0, radius = 1.8) {
  const group = new THREE.Group();

  // Tubular 3D Half-Torus Loop Arch
  const loopGeo = new THREE.TorusGeometry(radius, 0.18, 12, 36, Math.PI);
  const loopMesh = new THREE.Mesh(loopGeo, loopNeonMat);
  loopMesh.rotation.x = Math.PI / 2;
  loopMesh.rotation.y = Math.PI / 2;
  loopMesh.position.set(0, radius + 0.1, 0);
  loopMesh.castShadow = true;
  group.add(loopMesh);

  // Glowing Entry & Exit Portals
  const entryRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 20), loopRingMat);
  entryRing.position.set(0, 0.4, radius);
  group.add(entryRing);

  const exitRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 20), loopRingMat);
  exitRing.position.set(0, 0.4, -radius);
  group.add(exitRing);

  group.position.set(px, 0, pz);
  group.rotation.y = angle;
  scene.add(group);

  const entryWorld = new THREE.Vector3(0, 0.2, radius).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(new THREE.Vector3(px, 0, pz));
  const exitWorld = new THREE.Vector3(0, 0.2, -radius).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(new THREE.Vector3(px, 0, pz));

  const loopData = { px, pz, radius, angle, entryPos: entryWorld, exitPos: exitWorld, mesh: group };
  activeLoops.push(loopData);
  currentObstacleObjects.push({ mesh: group });
  return loopData;
}

/** 2-TIER ELEVATED TERRACE & SLOPED RAMP (Nível 2 Andares) */
function addElevatedTerrace(px, py, pz, sx, sz, rampX, rampZ, rampLength, rampWidth) {
  const group = new THREE.Group();

  // 1. Upper green platform
  const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.5, sz), terraceMat);
  deckMesh.position.set(px, py - 0.25, pz);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  scene.add(deckMesh);

  const deckBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px, py - 0.25, pz),
    shape: new CANNON.Box(new CANNON.Vec3(sx / 2, 0.25, sz / 2)),
    material: groundPhysMat
  });
  world.addBody(deckBody);
  currentObstacleObjects.push({ mesh: deckMesh, body: deckBody });

  // 2. Wooden retaining facade
  const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.1, py, sz + 0.1), terraceWallMat);
  wallMesh.position.set(px, py / 2, pz);
  wallMesh.castShadow = true;
  scene.add(wallMesh);
  currentObstacleObjects.push({ mesh: wallMesh });

  // 3. Sloped fairway ramp connecting ground (Y=0) to terrace (Y=py)
  const incline = Math.atan2(py, rampLength);
  const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(rampWidth, 0.12, Math.hypot(py, rampLength)), rampMat);
  rampMesh.position.set(rampX, py / 2, rampZ);
  rampMesh.rotation.x = incline;
  rampMesh.castShadow = true;
  rampMesh.receiveShadow = true;
  scene.add(rampMesh);

  const rampBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(rampX, py / 2, rampZ),
    shape: new CANNON.Box(new CANNON.Vec3(rampWidth / 2, 0.06, Math.hypot(py, rampLength) / 2)),
    material: groundPhysMat
  });
  rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), incline);
  world.addBody(rampBody);
  currentObstacleObjects.push({ mesh: rampMesh, body: rampBody });

  // 4. Side Guide Rails on Ramp
  [-rampWidth / 2 - 0.15, rampWidth / 2 + 0.15].forEach(xOff => {
    const railMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, Math.hypot(py, rampLength)), wallMat);
    railMesh.position.set(rampX + xOff, py / 2 + 0.15, rampZ);
    railMesh.rotation.x = incline;
    scene.add(railMesh);

    const railBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(rampX + xOff, py / 2 + 0.15, rampZ),
      shape: new CANNON.Box(new CANNON.Vec3(0.1, 0.2, Math.hypot(py, rampLength) / 2)),
      material: wallPhysMat
    });
    railBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), incline);
    world.addBody(railBody);
    currentObstacleObjects.push({ mesh: railMesh, body: railBody });
  });
}

function isFarEnough(x, z, minDist = 2.0) {
  if (Math.hypot(x - holePos.x, z - holePos.z) < minDist + 0.4) return false;
  if (Math.hypot(x - teePos.x, z - teePos.z) < minDist) return false;
  return true;
}

// =============================================
//  EXPANDED PROCEDURAL ARCHETYPES (7 TOTAL)
// =============================================
function generateCourseLayout(archetypeIndex = -1) {
  clearObstacles();

  const archetypes = [
    // 0: Pinball Bumper Alley
    () => {
      const bumperColors = [0xff6b9d, 0xa29bfe, 0x48dbfb, 0xfeca57];
      const positions = [[0, -2], [-2.4, 0.5], [2.4, 0.5], [-1.3, 3.5], [1.3, 3.5]];
      positions.forEach(([x, z], i) => {
        if (isFarEnough(x, z, 1.4)) addBumperCylinder(0.7, 0.6, x, z, bumperColors[i % bumperColors.length]);
      });
      addObstacleBox(2.4, 0.75, 0.6, -3.6, 0.35, 1.5, Math.PI / 4, obstacleMat);
      addObstacleBox(2.4, 0.75, 0.6, 3.6, 0.35, -0.5, -Math.PI / 4, obstacleMat);
    },

    // 1: Turbo Speedway (Speed Boosters & Banked Rails)
    () => {
      if (isFarEnough(0, 3.5, 1.5)) addSpeedBooster(0, 3.5, 1.8, 3.2, 0, -1, 26.0);
      if (isFarEnough(-1.8, -1.5, 1.5)) addSpeedBooster(-1.8, -1.5, 1.6, 2.8, 0.4, -0.9, 22.0);
      if (isFarEnough(1.8, -1.5, 1.5)) addSpeedBooster(1.8, -1.5, 1.6, 2.8, -0.4, -0.9, 22.0);
      addObstacleBox(3.5, 0.75, 0.6, -3.5, 0.35, 0.8, Math.PI / 3, obstacleMat);
      addObstacleBox(3.5, 0.75, 0.6, 3.5, 0.35, 0.8, -Math.PI / 3, obstacleMat);
      if (isFarEnough(0, -4.5, 1.4)) addBumperCylinder(0.75, 0.6, 0, -4.5, 0xfeca57);
    },

    // 2: Spike Gauntlet (Safe Bank Angles around Hazard Spikes)
    () => {
      if (isFarEnough(0, 1.5, 1.4)) addSpikeTrap(0, 1.5, 0.85, 6);
      if (isFarEnough(-2.2, -2.5, 1.4)) addSpikeTrap(-2.2, -2.5, 0.8, 5);
      if (isFarEnough(2.2, -2.5, 1.4)) addSpikeTrap(2.2, -2.5, 0.8, 5);
      // Bank rails providing safe ricochet shots around spikes
      addObstacleBox(3.2, 0.75, 0.6, -3.8, 0.35, 3.2, 0.45, obstacleMat);
      addObstacleBox(3.2, 0.75, 0.6, 3.8, 0.35, 3.2, -0.45, obstacleMat);
      if (isFarEnough(0, 4.8, 1.4)) addSpeedBooster(0, 4.8, 1.6, 2.2, 0, -1, 20.0);
    },

    // 3: 2-Tier Castle (Sloped Ramp to Elevated Green Terrace)
    () => {
      // Elevated platform at top green where hole sits
      addElevatedTerrace(0, 1.1, -7.5, 8.5, 6.5, 0, -1.5, 5.5, 2.8);
      // Bumpers guarding the sides
      if (isFarEnough(-3.2, 2.5, 1.4)) addBumperCylinder(0.7, 0.6, -3.2, 2.5, 0x48dbfb);
      if (isFarEnough(3.2, 2.5, 1.4)) addBumperCylinder(0.7, 0.6, 3.2, 2.5, 0xff6b9d);
      if (isFarEnough(0, 5.0, 1.5)) addSpeedBooster(0, 5.0, 1.8, 2.5, 0, -1, 22.0);
    },

    // 4: 3D Looping Slingshot Chute
    () => {
      if (isFarEnough(0, 0, 1.8)) addLoopChute(0, 0, 0, 1.8);
      if (isFarEnough(0, 4.2, 1.5)) addSpeedBooster(0, 4.2, 1.8, 3.0, 0, -1, 28.0);
      addObstacleBox(3.0, 0.75, 0.6, -3.4, 0.35, -2.5, Math.PI / 4, obstacleMat);
      addObstacleBox(3.0, 0.75, 0.6, 3.4, 0.35, -2.5, -Math.PI / 4, obstacleMat);
    },

    // 5: The Chaos Mixer (Boosters + Spikes + Bumpers)
    () => {
      if (isFarEnough(-1.8, 3.2, 1.4)) addSpeedBooster(-1.8, 3.2, 1.5, 2.6, 0.3, -1, 24.0);
      if (isFarEnough(1.8, 3.2, 1.4)) addSpeedBooster(1.8, 3.2, 1.5, 2.6, -0.3, -1, 24.0);
      if (isFarEnough(0, 0.5, 1.4)) addSpikeTrap(0, 0.5, 0.85, 6);
      if (isFarEnough(-2.4, -2.8, 1.4)) addBumperCylinder(0.75, 0.6, -2.4, -2.8, 0xfeca57);
      if (isFarEnough(2.4, -2.8, 1.4)) addBumperCylinder(0.75, 0.6, 2.4, -2.8, 0x48dbfb);
    },

    // 6: Double-Deck Terrace Bridge with Drop Funnel
    () => {
      addElevatedTerrace(0, 1.2, -6.5, 9.0, 7.0, -1.8, 0.5, 6.0, 2.4);
      if (isFarEnough(2.2, 0.5, 1.4)) addSpeedBooster(2.2, 0.5, 1.6, 3.0, 0, -1, 22.0);
      if (isFarEnough(2.2, -4.5, 1.4)) addSpikeTrap(2.2, -4.5, 0.8, 5);
      if (isFarEnough(-2.8, 4.5, 1.4)) addBumperCylinder(0.7, 0.6, -2.8, 4.5, 0xff6b9d);
    }
  ];

  const chosen = (archetypeIndex >= 0 && archetypeIndex < archetypes.length)
    ? archetypeIndex
    : Math.floor(Math.random() * archetypes.length);

  archetypes[chosen]();
}

// =============================================
//  DYNAMIC HOLE & TEE POSITIONING
// =============================================
const holePos = new THREE.Vector3(0, 0.02, -8);
const teePos = new THREE.Vector3(0, 0.22, 8);

// --- Hole ---
const holeRadius = 0.45;
const holeMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(holeRadius, holeRadius, 0.08, 32),
  holeDarkMat
);
holeMesh.position.set(holePos.x, 0.02, holePos.z);
holeMesh.receiveShadow = true;
scene.add(holeMesh);

const ringMesh = new THREE.Mesh(
  new THREE.RingGeometry(holeRadius, holeRadius + 0.12, 32),
  new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, side: THREE.DoubleSide })
);
ringMesh.rotation.x = -Math.PI / 2;
ringMesh.position.set(holePos.x, 0.04, holePos.z);
scene.add(ringMesh);

const holeBody = new CANNON.Body({
  mass: 0,
  position: new CANNON.Vec3(holePos.x, -0.3, holePos.z),
  shape: new CANNON.Sphere(holeRadius * 0.7),
  isTrigger: true
});
world.addBody(holeBody);

// --- Flag ---
const flagGroup = new THREE.Group();
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 8), flagPoleMat);
pole.position.y = 1.5;
pole.castShadow = true;
flagGroup.add(pole);

const flagShapeGeo = new THREE.BufferGeometry();
flagShapeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
  0, 0, 0, 0.8, 0.15, 0, 0, 0.5, 0
]), 3));
flagShapeGeo.computeVertexNormals();
const flagMeshObj = new THREE.Mesh(flagShapeGeo, flagClothMat);
flagMeshObj.position.set(0.04, 2.3, 0);
flagMeshObj.castShadow = true;
flagGroup.add(flagMeshObj);
flagGroup.position.set(holePos.x, 0, holePos.z);
scene.add(flagGroup);

function setRandomHoleAndTee(randomizeTee = true) {
  // Green zone: X in [-3.2, 3.2], Z in [-9.2, -5.5] (safe margin from walls)
  const hx = Number(((Math.random() * 6.4) - 3.2).toFixed(2));
  const hz = Number(((Math.random() * 3.7) - 9.2).toFixed(2));
  holePos.set(hx, 0.02, hz);

  if (randomizeTee) {
    const tx = Number(((Math.random() * 3.6) - 1.8).toFixed(2));
    const tz = Number(((Math.random() * 1.5) + 7.5).toFixed(2));
    teePos.set(tx, 0.22, tz);
  } else {
    teePos.set(0, 0.22, 8);
  }

  // Update hole & flag meshes and physics trigger
  holeMesh.position.set(holePos.x, 0.02, holePos.z);
  ringMesh.position.set(holePos.x, 0.04, holePos.z);
  holeBody.position.set(holePos.x, -0.3, holePos.z);
  flagGroup.position.set(holePos.x, 0, holePos.z);

  // Position ball at tee
  ballStartPos.set(teePos.x, 0.4, teePos.z);
  ballBody.position.copy(ballStartPos);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballMesh.position.copy(ballStartPos);

  // Generate dynamic course layout with obstacle clearance around tee & hole
  generateCourseLayout();

  // Re-orient character toward the hole
  charStandPos.set(teePos.x, 0, teePos.z + 1.2);
  if (charGroup) {
    charGroup.position.copy(charStandPos);
    charGroup.lookAt(holePos.x, 0, holePos.z);
  }
}

// =============================================
//  DECORATIONS
// =============================================
function createTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#b5651d', roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, 1.5 * scale, 8), trunkMat);
  trunk.position.y = 0.75 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  const leafColors = [0x2ecc71, 0x27ae60, 0x1abc9c];
  const sizes = [1.0, 0.8, 0.55];
  const heights = [1.8, 2.5, 3.0];
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(sizes[i] * scale, 8, 6),
      new THREE.MeshStandardMaterial({ color: leafColors[i], roughness: 0.8 })
    );
    leaf.position.y = heights[i] * scale;
    leaf.castShadow = true;
    group.add(leaf);
  }
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

createTree(-8, -6, 1.2);
createTree(8, -3, 0.9);
createTree(-7, 5, 1.0);
createTree(9, 8, 1.3);
createTree(7, -9, 0.7);
createTree(-9, -12, 1.1);
createTree(10, 3, 0.8);

function createFlower(x, z) {
  const group = new THREE.Group();
  const colors = [0xff6b9d, 0xffd166, 0xa29bfe, 0xff9f43, 0x06d6a0];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.9 })
  );
  stem.position.y = 0.25;
  group.add(stem);
  const petalMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), petalMat);
    petal.position.set(Math.cos(angle) * 0.1, 0.55, Math.sin(angle) * 0.1);
    group.add(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5 })
  );
  center.position.y = 0.55;
  group.add(center);
  group.position.set(x, 0, z);
  scene.add(group);
}

[[-6.5, -2], [6.5, 1], [-6.8, 7], [7, -7], [-7.5, 10],
 [6, 10], [-8.5, -9], [8, -11], [-6, 4], [7.5, 5]]
  .forEach(([x, z]) => createFlower(x, z));

function createCloud(x, y, z, scale = 1) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1.0, transparent: true, opacity: 0.9 });
  [[0, 0, 0, 1.0], [0.8, 0.1, 0, 0.7], [-0.7, 0.05, 0.2, 0.75], [0.3, 0.3, -0.1, 0.6], [-0.3, 0.25, 0.1, 0.65]]
    .forEach(([px, py, pz, s]) => {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(s * scale, 8, 6), mat);
      sphere.position.set(px * scale, py * scale, pz * scale);
      group.add(sphere);
    });
  group.position.set(x, y, z);
  group.userData.speed = 0.1 + Math.random() * 0.15;
  group.userData.baseX = x;
  scene.add(group);
  return group;
}

const clouds = [];
clouds.push(createCloud(-10, 15, -15, 2));
clouds.push(createCloud(12, 18, -20, 1.5));
clouds.push(createCloud(5, 13, -10, 1.8));
clouds.push(createCloud(-15, 16, 5, 2.2));
clouds.push(createCloud(8, 20, 10, 1.2));

const pondMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(1.5, 1.5, 0.1, 24),
  waterMat
);
pondMesh.position.set(-8, 0.02, 2);
pondMesh.receiveShadow = true;
scene.add(pondMesh);

const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: '#7bc47f', roughness: 1.0 })
);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.position.y = -0.5;
groundPlane.receiveShadow = true;
scene.add(groundPlane);

// =============================================
//  GOLF BALL — Always white
// =============================================
const ballRadius = 0.22;
const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 24, 24),
  new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, metalness: 0.1 })
);
ballMesh.castShadow = true;
scene.add(ballMesh);

const ballStartPos = new CANNON.Vec3(0, 1, 8);
const ballBody = new CANNON.Body({
  mass: 0.03,
  position: ballStartPos.clone(),
  shape: new CANNON.Sphere(ballRadius),
  material: ballPhysMat,
  linearDamping: 0.55,
  angularDamping: 0.7
});
world.addBody(ballBody);
objectsToUpdate.push({ mesh: ballMesh, body: ballBody });

// =============================================
//  CHARACTER MODELS — Fully distinct
// =============================================
let charGroup = null;

function createBunny() {
  const c = characters.bunny;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: c.bodyColor, roughness: 0.6 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: c.bellyColor, roughness: 0.5 });

  // Body — slightly oval, taller than wide
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), bodyMat);
  body.scale.set(1, 1.15, 0.95);
  body.position.y = 0.52;
  body.castShadow = true;
  group.add(body);

  // Belly patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), bellyMat);
  belly.position.set(0, 0.42, 0.25);
  group.add(belly);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), bodyMat);
  head.position.y = 1.1;
  head.castShadow = true;
  group.add(head);

  // Long floppy ears
  const earMat = new THREE.MeshStandardMaterial({ color: c.bodyColor, roughness: 0.6 });
  const earInnerMat = new THREE.MeshStandardMaterial({ color: c.earInner, roughness: 0.5 });
  [-0.14, 0.14].forEach(xOff => {
    // Outer ear
    const earGeo = new THREE.CapsuleGeometry(0.07, 0.6, 4, 8);
    const ear = new THREE.Mesh(earGeo, earMat);
    ear.position.set(xOff, 1.65, -0.05);
    ear.rotation.z = xOff > 0 ? -0.2 : 0.2;
    ear.rotation.x = -0.1;
    ear.castShadow = true;
    group.add(ear);

    // Inner ear (pink)
    const innerGeo = new THREE.CapsuleGeometry(0.04, 0.45, 4, 8);
    const inner = new THREE.Mesh(innerGeo, earInnerMat);
    inner.position.set(xOff, 1.65, 0.0);
    inner.rotation.z = xOff > 0 ? -0.2 : 0.2;
    inner.rotation.x = -0.1;
    group.add(inner);
  });

  // Eyes — big and cute
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const eyePupilMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.3 });
  const eyeHighlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.3 });
  [-0.12, 0.12].forEach(xOff => {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), eyeWhiteMat);
    eyeWhite.position.set(xOff, 1.15, 0.28);
    group.add(eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyePupilMat);
    pupil.position.set(xOff, 1.15, 0.36);
    group.add(pupil);
    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), eyeHighlightMat);
    highlight.position.set(xOff + 0.02, 1.18, 0.38);
    group.add(highlight);
  });

  // Pink nose
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 6),
    new THREE.MeshStandardMaterial({ color: c.noseColor, roughness: 0.4 })
  );
  nose.position.set(0, 1.05, 0.34);
  group.add(nose);

  // Blush
  const blushMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.8, transparent: true, opacity: 0.5 });
  [-0.2, 0.2].forEach(xOff => {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 4), blushMat);
    blush.position.set(xOff, 1.05, 0.3);
    group.add(blush);
  });

  // Fluffy tail
  const tail = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    bodyMat
  );
  tail.position.set(0, 0.35, -0.45);
  group.add(tail);

  // Feet
  const footMat = new THREE.MeshStandardMaterial({ color: c.footColor, roughness: 0.6 });
  [-0.18, 0.18].forEach(xOff => {
    const footGeo = new THREE.SphereGeometry(0.1, 8, 6);
    footGeo.scale(1.2, 0.5, 1.5);
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(xOff, 0.05, 0.12);
    foot.castShadow = true;
    group.add(foot);
  });

  scene.add(group);
  return group;
}

function createFrog() {
  const c = characters.frog;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: c.bodyColor, roughness: 0.5 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: c.bellyColor, roughness: 0.5 });

  // Body — wide and squat
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), bodyMat);
  body.scale.set(1.15, 0.8, 1.0);
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);

  // Belly
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), bellyMat);
  belly.position.set(0, 0.35, 0.2);
  group.add(belly);

  // Head (merged with body, wider)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), bodyMat);
  head.scale.set(1.2, 0.9, 1.0);
  head.position.y = 0.85;
  head.castShadow = true;
  group.add(head);

  // Big bulging eyes on top of head
  const eyeBulgeMat = new THREE.MeshStandardMaterial({ color: c.eyeBulge, roughness: 0.5 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const eyePupilMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.3 });
  [-0.22, 0.22].forEach(xOff => {
    // Bulge
    const bulge = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), eyeBulgeMat);
    bulge.position.set(xOff, 1.15, 0.15);
    group.add(bulge);
    // Eye white
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), eyeWhiteMat);
    eyeWhite.position.set(xOff, 1.18, 0.28);
    group.add(eyeWhite);
    // Pupil (vertical slit-style, using a tall thin sphere)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyePupilMat);
    pupil.scale.set(0.6, 1.2, 1);
    pupil.position.set(xOff, 1.18, 0.38);
    group.add(pupil);
  });

  // Wide smile
  const smileMat = new THREE.MeshStandardMaterial({ color: c.mouthColor, roughness: 0.5 });
  const smileGeo = new THREE.TorusGeometry(0.18, 0.03, 8, 16, Math.PI);
  const smile = new THREE.Mesh(smileGeo, smileMat);
  smile.position.set(0, 0.72, 0.38);
  smile.rotation.x = 0;
  smile.rotation.z = Math.PI;
  group.add(smile);

  // Dark spots on back
  const spotMat = new THREE.MeshStandardMaterial({ color: c.spotColor, roughness: 0.6 });
  [[0.15, 0.6, -0.35, 0.08], [-0.2, 0.55, -0.3, 0.07], [0.05, 0.7, -0.38, 0.06]].forEach(([x, y, z, r]) => {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), spotMat);
    spot.position.set(x, y, z);
    group.add(spot);
  });

  // Webbed back legs (bigger, splayed)
  const legMat = new THREE.MeshStandardMaterial({ color: c.footColor, roughness: 0.5 });
  [-0.35, 0.35].forEach(xOff => {
    // Thigh
    const thighGeo = new THREE.SphereGeometry(0.12, 8, 6);
    thighGeo.scale(1, 0.7, 1.3);
    const thigh = new THREE.Mesh(thighGeo, bodyMat);
    thigh.position.set(xOff * 1.2, 0.2, -0.15);
    group.add(thigh);
    // Foot (wide and flat)
    const footGeo = new THREE.SphereGeometry(0.12, 8, 6);
    footGeo.scale(1.4, 0.3, 2.0);
    const foot = new THREE.Mesh(footGeo, legMat);
    foot.position.set(xOff * 1.3, 0.04, 0.2);
    foot.castShadow = true;
    group.add(foot);
  });

  // Blush
  const blushMat = new THREE.MeshStandardMaterial({ color: 0xff8a80, roughness: 0.8, transparent: true, opacity: 0.4 });
  [-0.28, 0.28].forEach(xOff => {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 4), blushMat);
    blush.position.set(xOff, 0.78, 0.35);
    group.add(blush);
  });

  scene.add(group);
  return group;
}

function createChick() {
  const c = characters.chick;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: c.bodyColor, roughness: 0.5 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: c.bellyColor, roughness: 0.5 });

  // Body — round and fluffy
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), bodyMat);
  body.position.y = 0.45;
  body.castShadow = true;
  group.add(body);

  // Belly
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), bellyMat);
  belly.position.set(0, 0.38, 0.2);
  group.add(belly);

  // Head (slightly smaller, on top)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), bodyMat);
  head.position.y = 0.95;
  head.castShadow = true;
  group.add(head);

  // Red comb on top
  const combMat = new THREE.MeshStandardMaterial({ color: c.combColor, roughness: 0.5 });
  const combGroup = new THREE.Group();
  [[-0.05, 0], [0.0, 0.07], [0.05, 0]].forEach(([xOff, yOff]) => {
    const piece = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), combMat);
    piece.position.set(xOff, 1.25 + yOff, 0);
    combGroup.add(piece);
  });
  group.add(combGroup);

  // Big orange beak (two cones = open beak)
  const beakMat = new THREE.MeshStandardMaterial({ color: c.beakColor, roughness: 0.4 });
  // Upper beak
  const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), beakMat);
  upperBeak.position.set(0, 0.97, 0.35);
  upperBeak.rotation.x = Math.PI / 2 + 0.15;
  group.add(upperBeak);
  // Lower beak
  const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), beakMat);
  lowerBeak.position.set(0, 0.91, 0.33);
  lowerBeak.rotation.x = Math.PI / 2 - 0.2;
  group.add(lowerBeak);

  // Eyes
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const eyePupilMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.3 });
  const eyeHighlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.3 });
  [-0.1, 0.1].forEach(xOff => {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), eyeWhiteMat);
    eyeWhite.position.set(xOff, 1.0, 0.24);
    group.add(eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyePupilMat);
    pupil.position.set(xOff, 1.0, 0.3);
    group.add(pupil);
    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), eyeHighlightMat);
    highlight.position.set(xOff + 0.02, 1.03, 0.32);
    group.add(highlight);
  });

  // Wings (little stubs that stick out)
  const wingMat = new THREE.MeshStandardMaterial({ color: c.wingColor, roughness: 0.5 });
  [-0.42, 0.42].forEach(xOff => {
    const wingGeo = new THREE.SphereGeometry(0.14, 8, 6);
    wingGeo.scale(0.5, 0.8, 1.2);
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(xOff, 0.5, 0);
    wing.rotation.z = xOff > 0 ? -0.3 : 0.3;
    wing.castShadow = true;
    group.add(wing);
  });

  // Blush
  const blushMat = new THREE.MeshStandardMaterial({ color: 0xff8a65, roughness: 0.8, transparent: true, opacity: 0.5 });
  [-0.18, 0.18].forEach(xOff => {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 4), blushMat);
    blush.position.set(xOff, 0.92, 0.27);
    group.add(blush);
  });

  // Little orange feet
  const footMat = new THREE.MeshStandardMaterial({ color: c.footColor, roughness: 0.5 });
  [-0.14, 0.14].forEach(xOff => {
    const footGeo = new THREE.SphereGeometry(0.08, 8, 6);
    footGeo.scale(1.3, 0.4, 1.6);
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(xOff, 0.04, 0.1);
    foot.castShadow = true;
    group.add(foot);
  });

  scene.add(group);
  return group;
}

// =============================================
//  GOLF CLUB (Taco de Golfe)
// =============================================
let charClub = null;
let isSwingingClub = false;
let swingAnimProgress = 0;

function createGolfClub() {
  const clubGroup = new THREE.Group();

  // Grip handle
  const gripGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8);
  const gripMat = new THREE.MeshStandardMaterial({ color: '#2d3436', roughness: 0.8 });
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.y = 0.55;
  grip.castShadow = true;
  clubGroup.add(grip);

  // Metallic chrome shaft
  const shaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.75, 8);
  const shaftMat = new THREE.MeshStandardMaterial({ color: '#dfe6e9', metalness: 0.95, roughness: 0.1 });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = 0.1;
  shaft.castShadow = true;
  clubGroup.add(shaft);

  // Metallic Putter Head (Taco)
  const headGeo = new THREE.BoxGeometry(0.12, 0.06, 0.22);
  const headMat = new THREE.MeshStandardMaterial({ color: '#b2bec3', metalness: 0.9, roughness: 0.2 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, -0.27, 0.06);
  head.castShadow = true;
  clubGroup.add(head);

  // Position relative to character's hands
  clubGroup.position.set(0.38, 0.35, 0.25);
  clubGroup.rotation.set(0.2, 0, -0.2);

  return clubGroup;
}

function createCharModel(charKey) {
  let model;
  if (charKey === 'bunny') model = createBunny();
  else if (charKey === 'frog') model = createFrog();
  else if (charKey === 'chick') model = createChick();

  // Attach Taco de Golfe to golfer
  charClub = createGolfClub();
  model.add(charClub);

  return model;
}

// =============================================
//  AIM LINE
// =============================================
const aimLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
const aimLineGeo = new THREE.BufferGeometry();
aimLineGeo.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const aimLine = new THREE.Line(aimLineGeo, aimLineMat);
aimLine.visible = false;
scene.add(aimLine);

const arrowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.3 });
const arrowMesh = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), arrowMat);
arrowMesh.visible = false;
scene.add(arrowMesh);

// =============================================
//  CHARACTER SELECTION
// =============================================
document.querySelectorAll('.char-card').forEach(card => {
  card.addEventListener('click', () => {
    sfxSelect();
    selectedCharKey = card.dataset.char;
    selectedChar = characters[selectedCharKey];
    startGame(selectedCharKey);
  });
});

function startGame(charKey) {
  charSelectEl.style.display = 'none';
  gameUiEl.style.display = 'block';
  if (navChangeCharBtn) navChangeCharBtn.style.display = 'inline-flex';
  charIndicatorEl.textContent = `Playing as ${selectedChar.emoji} ${selectedChar.name}`;

  strokes = 0;
  totalStrokes = 0;
  currentHoleNumber = 1;
  updateScoreDisplay();

  // Remove old character if restarting
  if (charGroup) {
    scene.remove(charGroup);
    charGroup = null;
  }

  charGroup = createCharModel(charKey);

  // Generate random hole layout on game start
  setRandomHoleAndTee(true);

  gameStarted = true;
  camera.position.set(0, 12, 18);
  camera.lookAt(0, 0, 0);
}

// =============================================
//  INPUT — Click & Drag Aim
// =============================================
const dragStart = new THREE.Vector2();

renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mouseup', onMouseUp);
renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
renderer.domElement.addEventListener('touchend', onTouchEnd);

function onMouseDown(e) {
  if (!gameStarted || inHole || isBallMoving) return;
  startAim(e.clientX, e.clientY);
}
function onMouseMove(e) {
  if (!isAiming) return;
  updateAim(e.clientX, e.clientY);
}
function onMouseUp(e) {
  if (!isAiming) return;
  endAim(e.clientX, e.clientY);
}
function onTouchStart(e) {
  e.preventDefault();
  if (!gameStarted || inHole || isBallMoving) return;
  startAim(e.touches[0].clientX, e.touches[0].clientY);
}
function onTouchMove(e) {
  e.preventDefault();
  if (!isAiming) return;
  updateAim(e.touches[0].clientX, e.touches[0].clientY);
}
function onTouchEnd(e) {
  if (!isAiming) return;
  endAim(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
}

function startAim(cx, cy) {
  isAiming = true;
  dragStart.set(cx, cy);
  powerContainerEl.style.display = 'block';
  aimLine.visible = true;
  arrowMesh.visible = true;
  aimHintEl.style.display = 'none';
}

function updateAim(cx, cy) {
  const dx = dragStart.x - cx;
  const dy = dragStart.y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDrag = 250;
  aimPower = Math.min(dist / maxDrag, 1.0);
  powerBarEl.style.width = `${aimPower * 100}%`;

  if (dist > 5) {
    const dir = new THREE.Vector3(dx, 0, dy).normalize();
    const ballPos = ballMesh.position.clone();
    ballPos.y = 0.15;
    const tipPos = ballPos.clone().add(dir.clone().multiplyScalar(aimPower * 6 + 0.5));
    tipPos.y = 0.15;
    aimLineGeo.setFromPoints([ballPos, tipPos]);
    arrowMesh.position.copy(tipPos);
    arrowMesh.position.y = 0.3;
    arrowMesh.lookAt(ballPos.x, 0.3, ballPos.z);
    arrowMesh.rotateX(Math.PI / 2);
  }
}

function endAim(cx, cy) {
  isAiming = false;
  powerContainerEl.style.display = 'none';
  aimLine.visible = false;
  arrowMesh.visible = false;

  if (aimPower > 0.05 && !isBallBroken && !inLoopAnimation) {
    const dx = dragStart.x - cx;
    const dy = dragStart.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      strokes++;
      updateScoreDisplay();
      sfxSwing(aimPower);

      // Save safe shot position for respawns if ball breaks on spikes
      lastShotPos.copy(ballMesh.position);

      // Trigger putting swing animation on taco de golfe
      isSwingingClub = true;
      swingAnimProgress = 0;

      // Save character position before shot (stays here while ball moves)
      charStandPos.copy(charGroup.position);

      const dir = new THREE.Vector3(dx, 0, dy).normalize();
      const maxImpulse = 0.6;
      const impulseStrength = aimPower * maxImpulse;
      ballBody.wakeUp();
      ballBody.applyImpulse(
        new CANNON.Vec3(dir.x * impulseStrength, 0, dir.z * impulseStrength),
        new CANNON.Vec3(0, 0, 0)
      );
      isBallMoving = true;
    }
  }
  aimPower = 0;
  powerBarEl.style.width = '0%';
}

// =============================================
//  SPIKE HAZARD BALL SHATTER & RESPAWN
// =============================================
function triggerBallBreak(hazardX, hazardZ) {
  if (isBallBroken || inHole) return;
  isBallBroken = true;
  isBallMoving = false;

  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.sleep();
  ballMesh.visible = false;

  sfxBallBreak();

  // Spawn 12 bouncing 3D geometric fragments
  const ballPos = ballMesh.position.clone();
  for (let i = 0; i < 12; i++) {
    const shardGeo = new THREE.DodecahedronGeometry(0.06 + Math.random() * 0.04, 0);
    const shardMesh = new THREE.Mesh(shardGeo, shardMat);
    shardMesh.position.copy(ballPos);
    shardMesh.castShadow = true;
    scene.add(shardMesh);

    const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5);
    const speed = 2.0 + Math.random() * 3.5;
    activeFragments.push({
      mesh: shardMesh,
      vx: Math.cos(angle) * speed,
      vy: 2.8 + Math.random() * 3.2,
      vz: Math.sin(angle) * speed,
      rx: (Math.random() - 0.5) * 12,
      ry: (Math.random() - 0.5) * 12,
      rz: (Math.random() - 0.5) * 12,
      life: 1.0
    });
  }

  strokes++;
  updateScoreDisplay();

  messageEl.textContent = 'Ouch! 💥 Ball Broken (+1 Stroke)';
  messageEl.className = 'show danger';
  messageEl.style.display = 'block';

  setTimeout(() => {
    // Clear fragment meshes
    for (const f of activeFragments) {
      scene.remove(f.mesh);
      if (f.mesh.geometry) f.mesh.geometry.dispose();
    }
    activeFragments = [];

    sfxRespawn();
    ballStartPos.copy(lastShotPos);
    ballBody.position.copy(ballStartPos);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballBody.wakeUp();
    ballMesh.position.copy(ballStartPos);
    ballMesh.visible = true;

    charStandPos.set(lastShotPos.x, 0, lastShotPos.z + 1.2);
    if (charGroup) {
      charGroup.position.copy(charStandPos);
      charGroup.lookAt(holePos.x, 0, holePos.z);
    }

    messageEl.style.display = 'none';
    messageEl.className = '';
    isBallBroken = false;
  }, 950);
}

// =============================================
//  HOLE SINK & CELEBRATION
// =============================================
function triggerHoleSink() {
  if (inHole) return;
  inHole = true;
  sfxHoleSink();
  setTimeout(() => sfxVictory(), 300);

  const msgs = {
    1: 'Hole in One! ⛳✨',
    2: 'Eagle! 🦅',
    3: 'Birdie! 🐦',
    4: 'Par! ⛳',
  };
  messageEl.textContent = msgs[strokes] || 'Nice shot! 🎉';
  messageEl.className = 'show';
  messageEl.style.display = 'block';

  // Ball stops and sits inside the hole cup
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.sleep();
  ballMesh.position.set(holePos.x, -0.15, holePos.z);

  totalStrokes += strokes;
  updateScoreDisplay();

  setTimeout(() => {
    ballMesh.visible = false;
    if (endActionsContainer) endActionsContainer.style.display = 'flex';
    try {
      if (window.ArcadeLeaderboard) {
        const golfScore = Math.max(10, 1000 - (strokes - 1) * 200);
        window.ArcadeLeaderboard.submitScore('cute-mini-golf', golfScore);
      }
    } catch(e){}
  }, 700);
}

// =============================================
//  COLLISIONS (Wall bounces)
// =============================================
world.addEventListener('beginContact', (e) => {
  const a = e.bodyA, b = e.bodyB;
  if (a === ballBody || b === ballBody) {
    const other = a === ballBody ? b : a;
    const speed = ballBody.velocity.length();
    if (speed > 0.25) {
      const intensity = Math.min(speed / 7, 1.4);
      sfxBounce(intensity);
    }
  }
});

// =============================================
//  RESET & PLAY AGAIN
// =============================================
function resetGameState(fullReset = true) {
  inHole = false;
  isBallMoving = false;
  isBallBroken = false;
  inLoopAnimation = false;
  strokes = 0;
  if (fullReset) {
    totalStrokes = 0;
    currentHoleNumber = 1;
  }
  updateScoreDisplay();
  messageEl.style.display = 'none';
  messageEl.className = '';
  if (endActionsContainer) endActionsContainer.style.display = 'none';
  aimHintEl.style.display = 'block';

  // Clear broken fragments
  for (const f of activeFragments) {
    scene.remove(f.mesh);
    if (f.mesh.geometry) f.mesh.geometry.dispose();
  }
  activeFragments = [];

  // Generate new randomized hole & tee & obstacle layout
  setRandomHoleAndTee(true);
  lastShotPos.copy(teePos);
  ballMesh.visible = true;

  // Reset camera
  camera.position.set(0, 12, 18);
  camera.lookAt(0, 0, 0);
}

if (nextHoleBtn) {
  nextHoleBtn.addEventListener('click', () => {
    sfxClick();
    currentHoleNumber++;
    resetGameState(false);
  });
}

playAgainBtn.addEventListener('click', () => {
  sfxClick();
  resetGameState(true);
});

function openCharacterSelect() {
  sfxClick();
  resetGameState(true);
  gameStarted = false;
  gameUiEl.style.display = 'none';
  if (navChangeCharBtn) navChangeCharBtn.style.display = 'none';
  charSelectEl.style.display = 'flex';
}

if (switchCharBtn) switchCharBtn.addEventListener('click', openCharacterSelect);
if (navChangeCharBtn) navChangeCharBtn.addEventListener('click', openCharacterSelect);

// =============================================
//  RESET (Out of bounds)
// =============================================
function resetBall() {
  ballBody.position.copy(ballStartPos);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.wakeUp();
  isBallMoving = false;
  isBallBroken = false;
  inLoopAnimation = false;
  charStandPos.set(teePos.x, 0, teePos.z + 1.2);
}

// =============================================
//  RESIZE
// =============================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =============================================
//  ANIMATION LOOP
// =============================================
const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  elapsed = clock.getElapsedTime();

  // Physics Step
  world.step(1 / 60, dt, 3);

  // Sync ball mesh to physics (unless sunk or in 3D loop animation)
  if (!inHole && !inLoopAnimation && !isBallBroken) {
    for (const obj of objectsToUpdate) {
      obj.mesh.position.copy(obj.body.position);
      obj.mesh.quaternion.copy(obj.body.quaternion);
    }
  }

  // 1. SPEED BOOSTER / CONVEYOR BELT PHYSICS
  if (!isBallBroken && !inHole && gameStarted) {
    for (const b of activeBoosters) {
      // Animate chevron arrows
      if (b.arrows) {
        b.arrows.forEach((arr, i) => {
          arr.position.y = 0.05 + Math.sin(elapsed * 6 + i * 1.5) * 0.02;
        });
      }

      const dx = Math.abs(ballMesh.position.x - b.px);
      const dz = Math.abs(ballMesh.position.z - b.pz);
      if (dx < b.width / 2 + 0.1 && dz < b.length / 2 + 0.1 && ballMesh.position.y < 0.6) {
        ballBody.wakeUp();
        ballBody.velocity.x += b.dirX * b.power * dt;
        ballBody.velocity.z += b.dirZ * b.power * dt;
        isBallMoving = true;

        if (elapsed - lastBoostSfxTime > 0.26) {
          sfxBoost();
          lastBoostSfxTime = elapsed;
        }
      }
    }
  }

  // 2. SPIKE HAZARD COLLISION CHECK
  if (!isBallBroken && !inHole && gameStarted) {
    for (const sp of activeSpikes) {
      const dist = Math.hypot(ballMesh.position.x - sp.px, ballMesh.position.z - sp.pz);
      if (dist < sp.radius * 0.9 && ballMesh.position.y < 0.65) {
        triggerBallBreak(sp.px, sp.pz);
        break;
      }
    }
  }

  // 3. 3D LOOP-DE-LOOP INTERACTION
  if (!isBallBroken && !inHole && !inLoopAnimation && gameStarted) {
    for (const lp of activeLoops) {
      const distEntry = Math.hypot(ballMesh.position.x - lp.entryPos.x, ballMesh.position.z - lp.entryPos.z);
      if (distEntry < 0.8 && ballBody.velocity.length() > 1.0) {
        inLoopAnimation = true;
        loopAnimProgress = 0;
        currentLoopObj = lp;
        sfxLoop();
        ballBody.velocity.set(0, 0, 0);
        ballBody.sleep();
        break;
      }
    }
  }

  // 3D Loop Animation Trajectory
  if (inLoopAnimation && currentLoopObj) {
    loopAnimProgress += dt * 2.8;
    const lp = currentLoopObj;
    const loopY = Math.max(0.2, Math.sin(loopAnimProgress * Math.PI) * lp.radius * 1.8 + 0.2);
    const loopZ = lp.entryPos.z + (lp.exitPos.z - lp.entryPos.z) * loopAnimProgress;
    const loopX = lp.px + Math.sin(loopAnimProgress * Math.PI * 2) * 0.25;
    ballMesh.position.set(loopX, loopY, loopZ);
    ballBody.position.copy(ballMesh.position);

    if (loopAnimProgress >= 1.0) {
      inLoopAnimation = false;
      ballBody.wakeUp();
      const exitDirZ = lp.exitPos.z < lp.entryPos.z ? -1 : 1;
      ballBody.velocity.set(0, 0, exitDirZ * 9.0);
      isBallMoving = true;
    }
  }

  // 4. BALL SHATTER FRAGMENTS SIMULATION
  for (let i = activeFragments.length - 1; i >= 0; i--) {
    const f = activeFragments[i];
    f.vy -= 18.0 * dt; // gravity
    f.mesh.position.x += f.vx * dt;
    f.mesh.position.y += f.vy * dt;
    f.mesh.position.z += f.vz * dt;
    f.mesh.rotation.x += f.rx * dt;
    f.mesh.rotation.y += f.ry * dt;
    f.mesh.rotation.z += f.rz * dt;

    if (f.mesh.position.y < 0.05) {
      f.mesh.position.y = 0.05;
      f.vy = -f.vy * 0.45;
      f.vx *= 0.8;
      f.vz *= 0.8;
    }
    f.life -= dt * 1.1;
    if (f.life <= 0) {
      scene.remove(f.mesh);
      if (f.mesh.geometry) f.mesh.geometry.dispose();
      activeFragments.splice(i, 1);
    }
  }

  // HOLE DETECTION: Gravitational suction when rolling near the hole rim
  const HOLE_RADIUS = 0.52;
  const distToHole = Math.hypot(ballMesh.position.x - holePos.x, ballMesh.position.z - holePos.z);

  if (!inHole && gameStarted && !isBallBroken && !inLoopAnimation) {
    if (distToHole < HOLE_RADIUS * 1.4) {
      const pull = 10.0;
      ballBody.velocity.x += (holePos.x - ballMesh.position.x) * pull * dt;
      ballBody.velocity.z += (holePos.z - ballMesh.position.z) * pull * dt;
      ballBody.velocity.y -= 14.0 * dt;

      // When ball drops inside the cup perimeter
      if (distToHole < HOLE_RADIUS * 0.78) {
        triggerHoleSink();
      }
    }
  }

  // Ball stopped check — ping-pong ball snappy deceleration and decisive stop
  if (isBallMoving && !inHole && !inLoopAnimation && !isBallBroken) {
    const vel = ballBody.velocity;
    const horizontalSpeedSq = vel.x * vel.x + vel.z * vel.z;
    const totalSpeedSq = horizontalSpeedSq + vel.y * vel.y;

    // Ping-pong style air/surface braking when ball slows down
    if (totalSpeedSq < 2.2) {
      const brakeFactor = Math.max(0, 1 - 4.5 * dt);
      ballBody.velocity.x *= brakeFactor;
      ballBody.velocity.z *= brakeFactor;
      ballBody.angularVelocity.scale(brakeFactor, ballBody.angularVelocity);
    }

    // Snappy stop cutoff
    if (totalSpeedSq < 0.12 || (horizontalSpeedSq < 0.08 && Math.abs(vel.y) < 0.15)) {
      ballBody.velocity.set(0, 0, 0);
      ballBody.angularVelocity.set(0, 0, 0);
      ballBody.sleep();
      isBallMoving = false;

      // Update character target to walk to ball
      charStandPos.set(ballMesh.position.x, 0, ballMesh.position.z + 1.2);
    }
  }

  // Out of bounds reset
  if (ballBody.position.y < -5) {
    resetBall();
  }

  // Character: smoothly walks to charStandPos
  if (charGroup && gameStarted) {
    charGroup.position.x += (charStandPos.x - charGroup.position.x) * 0.05;
    charGroup.position.z += (charStandPos.z - charGroup.position.z) * 0.05;

    // Idle bounce
    charGroup.position.y = Math.sin(elapsed * 2.5) * 0.04;

    // Look toward ball
    const bp = ballMesh.position;
    charGroup.lookAt(bp.x, 0, bp.z);

    // GOLF CLUB ANIMATION (Taco de Golfe)
    if (charClub) {
      if (isSwingingClub) {
        swingAnimProgress += dt * 4.5;
        if (swingAnimProgress < 0.35) {
          charClub.rotation.x = 0.2 + (swingAnimProgress / 0.35) * 0.9;
        } else if (swingAnimProgress < 1.0) {
          charClub.rotation.x = 0.2 + (1.0 - (swingAnimProgress - 0.35) / 0.65) * 0.9;
        } else {
          isSwingingClub = false;
          charClub.rotation.set(0.2, 0, -0.2);
        }
      } else if (isAiming) {
        // Backswing proportional to aim power
        charClub.rotation.x = 0.2 - aimPower * 0.9;
        charClub.rotation.z = -0.2 - aimPower * 0.3;
      } else {
        charClub.rotation.set(0.2, 0, -0.2);
      }
    }
  }

  // Animate clouds
  for (const cloud of clouds) {
    cloud.position.x = cloud.userData.baseX + Math.sin(elapsed * cloud.userData.speed) * 3;
  }

  // Animate flag
  if (flagMeshObj) {
    flagMeshObj.rotation.y = Math.sin(elapsed * 3) * 0.15;
  }

  // Animate pond
  if (pondMesh) {
    pondMesh.material.opacity = 0.6 + Math.sin(elapsed * 2) * 0.1;
  }

  // Camera follows ball smoothly
  if (gameStarted && !inHole) {
    const targetCamPos = new THREE.Vector3(
      ballMesh.position.x * 0.3,
      12,
      ballMesh.position.z + 16
    );
    camera.position.lerp(targetCamPos, 0.02);
    camera.lookAt(ballMesh.position.x * 0.5, 0, ballMesh.position.z - 2);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
