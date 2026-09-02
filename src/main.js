import './style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sfxSwing, sfxBounce, sfxHoleSink, sfxVictory, sfxClick, sfxSelect, sfxBoost, sfxBallBreak, sfxLoop, sfxRespawn } from './audio.js';

// =============================================
//  CUTE MINI GOLF 3D — 1v1 MULTIPLAYER & SOLO
//  Nintendo-inspired visuals • Dual Ball Physics • Pass & Play & AI Bot
// =============================================

// --- GAME STATE ---
let selectedGameMode = 'solo'; // 'solo' | '1v1_local' | '1v1_bot'
let selectStep = 1; // 1 = Picking P1, 2 = Picking P2

const p1 = {
  charKey: 'bunny',
  strokes: 0,
  totalStrokes: 0,
  holesWon: 0,
  inHole: false,
  isBroken: false,
  lastShotPos: new THREE.Vector3(0, 0.22, 8),
  standPos: new THREE.Vector3(0, 0, 9.2),
  charGroup: null,
  charClub: null,
  isSwinging: false,
  swingProgress: 0
};

const p2 = {
  charKey: 'frog',
  strokes: 0,
  totalStrokes: 0,
  holesWon: 0,
  inHole: false,
  isBroken: false,
  lastShotPos: new THREE.Vector3(0.6, 0.22, 8),
  standPos: new THREE.Vector3(0.6, 0, 9.2),
  charGroup: null,
  charClub: null,
  isSwinging: false,
  swingProgress: 0
};

let activePlayerIndex = 1; // 1 or 2
let currentHoleNumber = 1;
let isAiming = false;
let aimPower = 0;
let isBallMoving = false;
let gameStarted = false;
let currentTerraceHeight = 0;
let isBotExecuting = false;

// --- Dynamic Obstacle & Hazard Registries ---
let currentObstacleObjects = [];
let activeBoosters = [];
let activeSpikes = [];
let activeWindmills = [];
let activeFragments = [];
let lastBoostSfxTime = 0;
let lastWindmillHitTime = 0;

// --- DOM ELEMENTS ---
const charSelectEl = document.getElementById('char-select');
const charSelectSubtitleEl = document.getElementById('char-select-subtitle');
const modeTabs = document.querySelectorAll('.mode-tab');
const gameUiEl = document.getElementById('game-ui');
const soloHudEl = document.getElementById('ui');
const pvpHudEl = document.getElementById('pvp-ui');
const scoreEl = document.getElementById('strokes');
const holeBadgeEl = document.getElementById('hole-badge');
const totalStrokesEl = document.getElementById('total-strokes');
const p1CardEl = document.getElementById('p1-card');
const p2CardEl = document.getElementById('p2-card');
const p1CharLabelEl = document.getElementById('p1-char-label');
const p2CharLabelEl = document.getElementById('p2-char-label');
const p2BadgeLabelEl = document.getElementById('p2-badge-label');
const p1StrokesEl = document.getElementById('p1-strokes');
const p2StrokesEl = document.getElementById('p2-strokes');
const p1WinsEl = document.getElementById('p1-wins');
const p2WinsEl = document.getElementById('p2-wins');
const pvpHoleBadgeEl = document.getElementById('pvp-hole-badge');
const pvpTurnBannerEl = document.getElementById('pvp-turn-banner');
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

// =============================================
//  CHARACTER DEFINITIONS
// =============================================
const characters = {
  bunny: {
    name: 'Bunny',
    emoji: '🐰',
    bodyColor: 0xf5f0eb,
    bellyColor: 0xfff5ee,
    earInner: 0xffb6c1,
    noseColor: 0xff69b4,
    footColor: 0xf5f0eb,
  },
  frog: {
    name: 'Froggy',
    emoji: '🐸',
    bodyColor: 0x4caf50,
    bellyColor: 0xc8e6c9,
    spotColor: 0x388e3c,
    eyeBulge: 0x66bb6a,
    mouthColor: 0xd32f2f,
    footColor: 0x388e3c,
  },
  chick: {
    name: 'Chicky',
    emoji: '🐥',
    bodyColor: 0xffd54f,
    bellyColor: 0xfff9c4,
    beakColor: 0xff9800,
    combColor: 0xf44336,
    wingColor: 0xffca28,
    footColor: 0xff9800,
  }
};

// Character previews
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
world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, ballPhysMat, {
  friction: 0.05,
  restitution: 0.85
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

// --- INTERACTIVE OBSTACLE MATERIALS ---
const boosterBorderMat = new THREE.MeshStandardMaterial({ color: '#2d3436', roughness: 0.35, metalness: 0.7 });
const boosterArrowMat = new THREE.MeshStandardMaterial({ color: '#00f5ff', roughness: 0.2, emissive: '#00f5ff', emissiveIntensity: 0.9 });
const spikePlateMat = new THREE.MeshStandardMaterial({ color: '#1e272e', roughness: 0.4, metalness: 0.8 });
const spikeConeMat = new THREE.MeshStandardMaterial({ color: '#ff3838', roughness: 0.25, emissive: '#c0392b', emissiveIntensity: 0.8 });
const windmillWallMat = new THREE.MeshStandardMaterial({ color: '#fff9e6', roughness: 0.5 });
const windmillRoofMat = new THREE.MeshStandardMaterial({ color: '#ff7675', roughness: 0.3 });
const windmillWoodMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.4 });
const windmillSailMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, side: THREE.DoubleSide });
const windmillGlowMat = new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffd166', emissiveIntensity: 0.6 });
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

// Base course
createStaticBox(10, 0.5, 22, 0, -0.25, 0, courseMat, groundPhysMat);
createStaticBox(11.2, 0.3, 23.2, 0, -0.45, 0, courseEdgeMat, groundPhysMat);
createStaticBox(11, 1.2, 0.6, 0, 0.35, -11.3, wallMat, wallPhysMat);
createStaticBox(11, 1.2, 0.6, 0, 0.35, 11.3, wallMat, wallPhysMat);
createStaticBox(0.6, 1.2, 22, -5.3, 0.35, 0, wallMat, wallPhysMat);
createStaticBox(0.6, 1.2, 22, 5.3, 0.35, 0, wallMat, wallPhysMat);

// =============================================
//  DYNAMIC PROCEDURAL OBSTACLES
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
  activeWindmills = [];
  currentTerraceHeight = 0;
  holePos.y = 0.02;
  holeMesh.position.set(holePos.x, 0.02, holePos.z);
  ringMesh.position.set(holePos.x, 0.04, holePos.z);
  holeBody.position.set(holePos.x, -0.3, holePos.z);
  flagGroup.position.set(holePos.x, 0, holePos.z);
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
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
  world.addBody(body);

  currentObstacleObjects.push({ mesh, body });
  return { mesh, body };
}

function addBumperCylinder(radius, height, px, pz, color = 0xff6b9d) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.2,
    metalness: 0.1,
    emissive: color,
    emissiveIntensity: 0.35
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), mat);
  mesh.position.set(px, height / 2, pz);
  mesh.castShadow = true;
  scene.add(mesh);

  const ringGeo = new THREE.TorusGeometry(radius + 0.08, 0.05, 8, 24);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = height * 0.45;
  mesh.add(ring);

  const body = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px, height / 2, pz),
    shape: new CANNON.Cylinder(radius, radius, height, 16),
    material: wallPhysMat
  });
  world.addBody(body);
  currentObstacleObjects.push({ mesh, body });
  return { mesh, body };
}

function addSpeedBooster(px, pz, width = 1.8, length = 3.0, dirX = 0, dirZ = -1, power = 24.0) {
  const group = new THREE.Group();
  const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, length), boosterBorderMat);
  baseMesh.position.y = 0.03;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  const arrows = [];
  const arrowCount = 3;
  for (let i = 0; i < arrowCount; i++) {
    const arrowGeo = new THREE.ConeGeometry(0.28, 0.5, 3);
    const arrowMesh = new THREE.Mesh(arrowGeo, boosterArrowMat);
    arrowMesh.rotation.x = -Math.PI / 2;
    const normAngle = Math.atan2(dirX, -dirZ);
    arrowMesh.rotation.z = normAngle;
    arrowMesh.position.set(0, 0.07, (i - 1) * (length / 3.8));
    group.add(arrowMesh);
    arrows.push(arrowMesh);
  }

  group.position.set(px, 0, pz);
  scene.add(group);

  const boosterData = { px, pz, width, length, dirX, dirZ, power, group, arrows, mesh: group };
  activeBoosters.push(boosterData);
  currentObstacleObjects.push({ mesh: group });
  return boosterData;
}

function addSpikeTrap(px, pz, radius = 0.8, spikeCount = 5) {
  const group = new THREE.Group();
  const plateMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.1, 0.06, 16), spikePlateMat);
  plateMesh.position.y = 0.03;
  plateMesh.receiveShadow = true;
  group.add(plateMesh);

  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2;
    const r = radius * 0.55;
    const spikeGeo = new THREE.ConeGeometry(0.12, 0.5, 6);
    const spikeMesh = new THREE.Mesh(spikeGeo, spikeConeMat);
    spikeMesh.position.set(Math.cos(angle) * r, 0.28, Math.sin(angle) * r);
    spikeMesh.castShadow = true;
    group.add(spikeMesh);
  }

  const centerSpike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 6), spikeConeMat);
  centerSpike.position.set(0, 0.35, 0);
  centerSpike.castShadow = true;
  group.add(centerSpike);

  group.position.set(px, 0, pz);
  scene.add(group);

  const spikeData = { px, pz, radius, mesh: group };
  activeSpikes.push(spikeData);
  currentObstacleObjects.push({ mesh: group });
  return spikeData;
}

function addWindmill(px, pz, angle = 0) {
  const group = new THREE.Group();

  // 1. Left Tower Pillar
  const pillarW = 0.85;
  const pillarH = 2.0;
  const pillarD = 1.6;
  const tunnelW = 1.35;

  const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, pillarH, pillarD), windmillWallMat);
  leftPillar.position.set(-tunnelW / 2 - pillarW / 2, pillarH / 2, 0);
  leftPillar.castShadow = true;
  leftPillar.receiveShadow = true;
  group.add(leftPillar);

  const leftBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px + (-tunnelW / 2 - pillarW / 2), pillarH / 2, pz),
    shape: new CANNON.Box(new CANNON.Vec3(pillarW / 2, pillarH / 2, pillarD / 2)),
    material: wallPhysMat
  });
  world.addBody(leftBody);
  currentObstacleObjects.push({ mesh: leftPillar, body: leftBody });

  // 2. Right Tower Pillar
  const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, pillarH, pillarD), windmillWallMat);
  rightPillar.position.set(tunnelW / 2 + pillarW / 2, pillarH / 2, 0);
  rightPillar.castShadow = true;
  rightPillar.receiveShadow = true;
  group.add(rightPillar);

  const rightBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px + (tunnelW / 2 + pillarW / 2), pillarH / 2, pz),
    shape: new CANNON.Box(new CANNON.Vec3(pillarW / 2, pillarH / 2, pillarD / 2)),
    material: wallPhysMat
  });
  world.addBody(rightBody);
  currentObstacleObjects.push({ mesh: rightPillar, body: rightBody });

  // 3. Arch Overhead Lintel
  const totalW = tunnelW + pillarW * 2;
  const lintelH = 0.9;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(totalW, lintelH, pillarD), windmillWallMat);
  lintel.position.set(0, pillarH + lintelH / 2, 0);
  lintel.castShadow = true;
  group.add(lintel);

  // 4. Conical Roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(totalW * 0.65, 1.4, 8), windmillRoofMat);
  roof.position.set(0, pillarH + lintelH + 0.7, 0);
  roof.castShadow = true;
  group.add(roof);

  // 5. Glowing Attic Window
  const windowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), windmillGlowMat);
  windowMesh.position.set(0, pillarH + lintelH * 0.6, pillarD / 2 + 0.02);
  group.add(windowMesh);

  // 6. Spinning Rotor Hub & 4 Blades
  const bladesGroup = new THREE.Group();
  bladesGroup.position.set(0, pillarH + 0.35, pillarD / 2 + 0.18);

  const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 16), windmillWoodMat);
  hubCap.rotation.x = Math.PI / 2;
  bladesGroup.add(hubCap);

  const bladeLength = 2.05;
  const bladeWidth = 0.42;
  for (let i = 0; i < 4; i++) {
    const bladeArm = new THREE.Group();
    bladeArm.rotation.z = (Math.PI / 2) * i + (Math.PI / 4); // Initial "X" open position

    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.08, bladeLength, 0.06), windmillWoodMat);
    spar.position.set(0, bladeLength / 2, 0);
    bladeArm.add(spar);

    const sail = new THREE.Mesh(new THREE.PlaneGeometry(bladeWidth, bladeLength * 0.72), windmillSailMat);
    sail.position.set(bladeWidth / 2 - 0.04, bladeLength * 0.58, 0.02);
    sail.castShadow = true;
    bladeArm.add(sail);

    bladesGroup.add(bladeArm);
  }

  group.add(bladesGroup);

  group.position.set(px, 0, pz);
  group.rotation.y = angle;
  scene.add(group);
  currentObstacleObjects.push({ mesh: group });

  const windmillData = {
    px,
    pz,
    tunnelW,
    doorZ: pz + pillarD / 2,
    exitZ: pz - pillarD / 2,
    bladesGroup,
    bladeAngle: 0,
    bladeSpeed: 1.65,
    mesh: group
  };

  activeWindmills.push(windmillData);
  return windmillData;
}

/** 2-TIER ELEVATED GREEN TERRACE & FAIRWAY RAMP */
function addElevatedTerrace(px, py, pz, sx, sz, rampX, rampZ, rampLength, rampWidth, isHoleOnTerrace = true) {
  currentTerraceHeight = py;

  const totalDeckHeight = py + 0.1;
  const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(sx, totalDeckHeight, sz), courseMat);
  deckMesh.position.set(px, (py - 0.1) / 2, pz);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  scene.add(deckMesh);

  const deckBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px, (py - 0.1) / 2, pz),
    shape: new CANNON.Box(new CANNON.Vec3(sx / 2, totalDeckHeight / 2, sz / 2)),
    material: groundPhysMat
  });
  world.addBody(deckBody);
  currentObstacleObjects.push({ mesh: deckMesh, body: deckBody });

  // Perimeter Rails
  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, sz), wallMat);
  leftRail.position.set(px - sx / 2 + 0.15, py + 0.15, pz);
  scene.add(leftRail);
  const leftBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px - sx / 2 + 0.15, py + 0.15, pz),
    shape: new CANNON.Box(new CANNON.Vec3(0.15, 0.225, sz / 2)),
    material: wallPhysMat
  });
  world.addBody(leftBody);
  currentObstacleObjects.push({ mesh: leftRail, body: leftBody });

  const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, sz), wallMat);
  rightRail.position.set(px + sx / 2 - 0.15, py + 0.15, pz);
  scene.add(rightRail);
  const rightBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px + sx / 2 - 0.15, py + 0.15, pz),
    shape: new CANNON.Box(new CANNON.Vec3(0.15, 0.225, sz / 2)),
    material: wallPhysMat
  });
  world.addBody(rightBody);
  currentObstacleObjects.push({ mesh: rightRail, body: rightBody });

  const backRail = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.45, 0.3), wallMat);
  backRail.position.set(px, py + 0.15, pz - sz / 2 + 0.15);
  scene.add(backRail);
  const backBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(px, py + 0.15, pz - sz / 2 + 0.15),
    shape: new CANNON.Box(new CANNON.Vec3(sx / 2, 0.225, 0.15)),
    material: wallPhysMat
  });
  world.addBody(backBody);
  currentObstacleObjects.push({ mesh: backRail, body: backBody });

  // Front Facade Framing
  const frontZ = pz + sz / 2;
  const leftWallWidth = Math.max(0.1, (rampX - rampWidth / 2) - (px - sx / 2));
  if (leftWallWidth > 0.3) {
    const leftFrontMesh = new THREE.Mesh(new THREE.BoxGeometry(leftWallWidth, py + 0.35, 0.35), wallMat);
    leftFrontMesh.position.set((px - sx / 2 + rampX - rampWidth / 2) / 2, (py + 0.35) / 2 - 0.05, frontZ);
    leftFrontMesh.castShadow = true;
    scene.add(leftFrontMesh);
    const leftFrontBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3((px - sx / 2 + rampX - rampWidth / 2) / 2, (py + 0.35) / 2 - 0.05, frontZ),
      shape: new CANNON.Box(new CANNON.Vec3(leftWallWidth / 2, (py + 0.35) / 2, 0.175)),
      material: wallPhysMat
    });
    world.addBody(leftFrontBody);
    currentObstacleObjects.push({ mesh: leftFrontMesh, body: leftFrontBody });
  }

  const rightWallWidth = Math.max(0.1, (px + sx / 2) - (rampX + rampWidth / 2));
  if (rightWallWidth > 0.3) {
    const rightFrontMesh = new THREE.Mesh(new THREE.BoxGeometry(rightWallWidth, py + 0.35, 0.35), wallMat);
    rightFrontMesh.position.set((rampX + rampWidth / 2 + px + sx / 2) / 2, (py + 0.35) / 2 - 0.05, frontZ);
    rightFrontMesh.castShadow = true;
    scene.add(rightFrontMesh);
    const rightFrontBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3((rampX + rampWidth / 2 + px + sx / 2) / 2, (py + 0.35) / 2 - 0.05, frontZ),
      shape: new CANNON.Box(new CANNON.Vec3(rightWallWidth / 2, (py + 0.35) / 2, 0.175)),
      material: wallPhysMat
    });
    world.addBody(rightFrontBody);
    currentObstacleObjects.push({ mesh: rightFrontMesh, body: rightFrontBody });
  }

  // Sloped Ramp (Always slopes UP gently from fairway ground to elevated terrace)
  const inclineAngle = Math.atan2(py, rampLength);
  const rampHypot = Math.hypot(py, rampLength);
  const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(rampWidth, 0.12, rampHypot), courseMat);
  rampMesh.position.set(rampX, py / 2, rampZ);
  rampMesh.rotation.x = inclineAngle;
  rampMesh.castShadow = true;
  rampMesh.receiveShadow = true;
  scene.add(rampMesh);

  const rampBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(rampX, py / 2, rampZ),
    shape: new CANNON.Box(new CANNON.Vec3(rampWidth / 2, 0.06, rampHypot / 2)),
    material: groundPhysMat
  });
  rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), inclineAngle);
  world.addBody(rampBody);
  currentObstacleObjects.push({ mesh: rampMesh, body: rampBody });

  [-rampWidth / 2 - 0.1, rampWidth / 2 + 0.1].forEach(xOff => {
    const rRail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, rampHypot), wallMat);
    rRail.position.set(rampX + xOff, py / 2 + 0.12, rampZ);
    rRail.rotation.x = inclineAngle;
    scene.add(rRail);

    const rBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(rampX + xOff, py / 2 + 0.12, rampZ),
      shape: new CANNON.Box(new CANNON.Vec3(0.1, 0.19, rampHypot / 2)),
      material: wallPhysMat
    });
    rBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), inclineAngle);
    world.addBody(rBody);
    currentObstacleObjects.push({ mesh: rRail, body: rBody });
  });

  if (isHoleOnTerrace) {
    holePos.x = THREE.MathUtils.clamp(holePos.x, px - sx / 2 + 1.4, px + sx / 2 - 1.4);
    holePos.y = py + 0.02;
    holePos.z = THREE.MathUtils.clamp(holePos.z, pz - sz / 2 + 1.4, pz + sz / 2 - 1.4);
    holeMesh.position.set(holePos.x, holePos.y, holePos.z);
    ringMesh.position.set(holePos.x, holePos.y + 0.02, holePos.z);
    holeBody.position.set(holePos.x, py - 0.3, holePos.z);
    flagGroup.position.set(holePos.x, py, holePos.z);
  }
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
      addObstacleBox(3.2, 0.75, 0.6, -3.8, 0.35, 3.2, 0.45, obstacleMat);
      addObstacleBox(3.2, 0.75, 0.6, 3.8, 0.35, 3.2, -0.45, obstacleMat);
      if (isFarEnough(0, 4.8, 1.4)) addSpeedBooster(0, 4.8, 1.6, 2.2, 0, -1, 20.0);
    },

    // 3: 2-Tier Castle (Sloped Ramp to Elevated Green Terrace)
    () => {
      // Terrace: pz = -8.0, sz = 8.0 (Front edge at z = -4.0). Ramp: rampLength = 4.8, rampZ = -1.6 (Connects z = +0.8 to -4.0 seamlessly!)
      addElevatedTerrace(0, 0.75, -8.0, 9.6, 8.0, 0, -1.6, 4.8, 3.8, true);
      if (isFarEnough(-3.2, 3.0, 1.4)) addBumperCylinder(0.7, 0.6, -3.2, 3.0, 0x48dbfb);
      if (isFarEnough(3.2, 3.0, 1.4)) addBumperCylinder(0.7, 0.6, 3.2, 3.0, 0xff6b9d);
      if (isFarEnough(0, 5.0, 1.5)) addSpeedBooster(0, 5.0, 1.8, 2.5, 0, -1, 24.0);
    },

    // 4: The Dutch Windmill Challenge (Spinning Blades & Gateway Tunnel)
    () => {
      if (isFarEnough(0, 0, 2.0)) addWindmill(0, 0, 0);
      if (isFarEnough(0, 4.5, 1.5)) addSpeedBooster(0, 4.5, 1.8, 2.8, 0, -1, 24.0);
      addObstacleBox(2.8, 0.75, 0.6, -3.5, 0.35, 0, 0, obstacleMat);
      addObstacleBox(2.8, 0.75, 0.6, 3.5, 0.35, 0, 0, obstacleMat);
      if (isFarEnough(-2.8, 2.5, 1.4)) addBumperCylinder(0.7, 0.6, -2.8, 2.5, 0xfeca57);
      if (isFarEnough(2.8, 2.5, 1.4)) addBumperCylinder(0.7, 0.6, 2.8, 2.5, 0x48dbfb);
    },

    // 5: The Chaos Mixer (Boosters + Spikes + Bumpers)
    () => {
      if (isFarEnough(-1.8, 3.2, 1.4)) addSpeedBooster(-1.8, 3.2, 1.5, 2.6, 0.3, -1, 24.0);
      if (isFarEnough(1.8, 3.2, 1.4)) addSpeedBooster(1.8, 3.2, 1.5, 2.6, -0.3, -1, 24.0);
      if (isFarEnough(0, 0.5, 1.4)) addSpikeTrap(0, 0.5, 0.85, 6);
      if (isFarEnough(-2.4, -2.8, 1.4)) addBumperCylinder(0.75, 0.6, -2.4, -2.8, 0xfeca57);
      if (isFarEnough(2.4, -2.8, 1.4)) addBumperCylinder(0.75, 0.6, 2.4, -2.8, 0x48dbfb);
    },

    // 6: Candy Carousel Slalom (Fairway Banks & Bumper Funnel)
    () => {
      addObstacleBox(3.4, 0.75, 0.6, -3.2, 0.35, 1.8, Math.PI / 4, obstacleMat);
      addObstacleBox(3.4, 0.75, 0.6, 3.2, 0.35, 1.8, -Math.PI / 4, obstacleMat);
      if (isFarEnough(0, 2.5, 1.5)) addSpeedBooster(0, 2.5, 1.8, 2.8, 0, -1, 24.0);
      if (isFarEnough(-2.4, -2.0, 1.4)) addBumperCylinder(0.75, 0.6, -2.4, -2.0, 0xfeca57);
      if (isFarEnough(2.4, -2.0, 1.4)) addBumperCylinder(0.75, 0.6, 2.4, -2.0, 0x48dbfb);
      if (isFarEnough(0, -4.8, 1.4)) addBumperCylinder(0.75, 0.6, 0, -4.8, 0xff6b9d);
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
const holeRadius = 0.45;

const holeMesh = new THREE.Mesh(
  new THREE.CircleGeometry(holeRadius, 32),
  holeDarkMat
);
holeMesh.position.set(holePos.x, 0.02, holePos.z);
holeMesh.rotation.x = -Math.PI / 2;
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

// =============================================
//  GOLF BALLS (P1 White Ball & P2 Sun Amber Ball)
// =============================================
const ballRadius = 0.22;

// Player 1 Golf Ball
const ballMesh1 = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 24, 24),
  new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, metalness: 0.1 })
);
ballMesh1.castShadow = true;
scene.add(ballMesh1);

const ballStartPos1 = new CANNON.Vec3(0, 1, 8);
const ballBody1 = new CANNON.Body({
  mass: 0.03,
  position: ballStartPos1.clone(),
  shape: new CANNON.Sphere(ballRadius),
  material: ballPhysMat,
  linearDamping: 0.55,
  angularDamping: 0.7
});
world.addBody(ballBody1);
objectsToUpdate.push({ mesh: ballMesh1, body: ballBody1 });

// Player 2 Golf Ball (Golden Amber Sun / Aqua)
const ballMesh2 = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 24, 24),
  new THREE.MeshStandardMaterial({
    color: '#ffd166',
    roughness: 0.2,
    metalness: 0.3,
    emissive: '#ffd166',
    emissiveIntensity: 0.15
  })
);
ballMesh2.castShadow = true;
ballMesh2.visible = false;
scene.add(ballMesh2);

const ballStartPos2 = new CANNON.Vec3(0.6, 1, 8);
const ballBody2 = new CANNON.Body({
  mass: 0.03,
  position: ballStartPos2.clone(),
  shape: new CANNON.Sphere(ballRadius),
  material: ballPhysMat,
  linearDamping: 0.55,
  angularDamping: 0.7
});
world.addBody(ballBody2);
objectsToUpdate.push({ mesh: ballMesh2, body: ballBody2 });

function getActiveBall() {
  return activePlayerIndex === 1
    ? { body: ballBody1, mesh: ballMesh1, player: p1, startPos: ballStartPos1 }
    : { body: ballBody2, mesh: ballMesh2, player: p2, startPos: ballStartPos2 };
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

const clouds = [];
function createCloud(x, y, z, scale = 1) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1.0, transparent: true, opacity: 0.9 });
  [[0, 0, 0, 1.0], [0.8, 0.1, 0, 0.7], [-0.7, 0.05, 0.2, 0.75], [0.3, 0.3, -0.1, 0.6], [-0.3, 0.25, 0.1, 0.65]]
    .forEach(([px, py, pz, s]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.8 * s * scale, 8, 6), mat);
      puff.position.set(px * scale, py * scale, pz * scale);
      group.add(puff);
    });
  group.position.set(x, y, z);
  group.userData = { baseX: x, speed: 0.02 + Math.random() * 0.02 };
  scene.add(group);
  clouds.push(group);
}

createCloud(-15, 14, -10, 1.8);
createCloud(14, 16, -5, 2.2);
createCloud(-8, 15, 12, 1.5);
createCloud(18, 13, 8, 1.6);
createCloud(0, 18, -18, 2.5);

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
//  CHARACTER MODELS
// =============================================
function createBunny() {
  const c = characters.bunny;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: c.bodyColor, roughness: 0.6 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: c.bellyColor, roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), bodyMat);
  body.scale.set(1, 1.15, 0.95);
  body.position.y = 0.52;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), bellyMat);
  belly.position.set(0, 0.42, 0.25);
  group.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), bodyMat);
  head.position.y = 1.1;
  head.castShadow = true;
  group.add(head);

  const earMat = new THREE.MeshStandardMaterial({ color: c.bodyColor, roughness: 0.6 });
  const earInnerMat = new THREE.MeshStandardMaterial({ color: c.earInner, roughness: 0.5 });
  [-0.14, 0.14].forEach(xOff => {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.6, 4, 8), earMat);
    ear.position.set(xOff, 1.65, -0.05);
    ear.rotation.z = xOff > 0 ? -0.2 : 0.2;
    ear.rotation.x = -0.1;
    ear.castShadow = true;
    group.add(ear);

    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.45, 4, 8), earInnerMat);
    inner.position.set(xOff, 1.65, 0.0);
    inner.rotation.z = xOff > 0 ? -0.2 : 0.2;
    inner.rotation.x = -0.1;
    group.add(inner);
  });

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

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 6),
    new THREE.MeshStandardMaterial({ color: c.noseColor, roughness: 0.4 })
  );
  nose.position.set(0, 1.05, 0.34);
  group.add(nose);

  const blushMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.8, transparent: true, opacity: 0.5 });
  [-0.2, 0.2].forEach(xOff => {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 4), blushMat);
    blush.position.set(xOff, 1.05, 0.3);
    group.add(blush);
  });

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bodyMat);
  tail.position.set(0, 0.35, -0.45);
  group.add(tail);

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

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), bodyMat);
  body.scale.set(1.15, 0.8, 1.0);
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), bellyMat);
  belly.position.set(0, 0.35, 0.2);
  group.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), bodyMat);
  head.scale.set(1.2, 0.9, 1.0);
  head.position.y = 0.85;
  head.castShadow = true;
  group.add(head);

  const eyeBulgeMat = new THREE.MeshStandardMaterial({ color: c.eyeBulge, roughness: 0.5 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const eyePupilMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.3 });
  [-0.22, 0.22].forEach(xOff => {
    const bulge = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), eyeBulgeMat);
    bulge.position.set(xOff, 1.15, 0.15);
    group.add(bulge);
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), eyeWhiteMat);
    eyeWhite.position.set(xOff, 1.18, 0.28);
    group.add(eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyePupilMat);
    pupil.scale.set(0.6, 1.2, 1);
    pupil.position.set(xOff, 1.18, 0.38);
    group.add(pupil);
  });

  const smileMat = new THREE.MeshStandardMaterial({ color: c.mouthColor, roughness: 0.5 });
  const smileGeo = new THREE.TorusGeometry(0.18, 0.03, 8, 16, Math.PI);
  const smile = new THREE.Mesh(smileGeo, smileMat);
  smile.position.set(0, 0.72, 0.38);
  smile.rotation.z = Math.PI;
  group.add(smile);

  const spotMat = new THREE.MeshStandardMaterial({ color: c.spotColor, roughness: 0.6 });
  [[0.15, 0.6, -0.35, 0.08], [-0.2, 0.55, -0.3, 0.07], [0.05, 0.7, -0.38, 0.06]].forEach(([x, y, z, r]) => {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), spotMat);
    spot.position.set(x, y, z);
    group.add(spot);
  });

  const legMat = new THREE.MeshStandardMaterial({ color: c.footColor, roughness: 0.5 });
  [-0.35, 0.35].forEach(xOff => {
    const thighGeo = new THREE.SphereGeometry(0.12, 8, 6);
    thighGeo.scale(1, 0.7, 1.3);
    const thigh = new THREE.Mesh(thighGeo, bodyMat);
    thigh.position.set(xOff * 1.2, 0.2, -0.15);
    group.add(thigh);
    const footGeo = new THREE.SphereGeometry(0.12, 8, 6);
    footGeo.scale(1.4, 0.3, 2.0);
    const foot = new THREE.Mesh(footGeo, legMat);
    foot.position.set(xOff * 1.3, 0.04, 0.2);
    foot.castShadow = true;
    group.add(foot);
  });

  scene.add(group);
  return group;
}

function createChick() {
  const c = characters.chick;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: c.bodyColor, roughness: 0.5 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: c.bellyColor, roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), bodyMat);
  body.position.y = 0.45;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), bellyMat);
  belly.position.set(0, 0.38, 0.2);
  group.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), bodyMat);
  head.position.y = 0.95;
  head.castShadow = true;
  group.add(head);

  const combMat = new THREE.MeshStandardMaterial({ color: c.combColor, roughness: 0.5 });
  const combGroup = new THREE.Group();
  [[-0.05, 0], [0.0, 0.07], [0.05, 0]].forEach(([xOff, yOff]) => {
    const piece = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), combMat);
    piece.position.set(xOff, 1.25 + yOff, 0);
    combGroup.add(piece);
  });
  group.add(combGroup);

  const beakMat = new THREE.MeshStandardMaterial({ color: c.beakColor, roughness: 0.4 });
  const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), beakMat);
  upperBeak.position.set(0, 0.97, 0.35);
  upperBeak.rotation.x = Math.PI / 2 + 0.15;
  group.add(upperBeak);
  const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), beakMat);
  lowerBeak.position.set(0, 0.91, 0.33);
  lowerBeak.rotation.x = Math.PI / 2 - 0.2;
  group.add(lowerBeak);

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

function createGolfClub() {
  const clubGroup = new THREE.Group();
  const gripGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8);
  const gripMat = new THREE.MeshStandardMaterial({ color: '#2d3436', roughness: 0.8 });
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.y = 0.55;
  grip.castShadow = true;
  clubGroup.add(grip);

  const shaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.75, 8);
  const shaftMat = new THREE.MeshStandardMaterial({ color: '#dfe6e9', metalness: 0.95, roughness: 0.1 });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = 0.1;
  shaft.castShadow = true;
  clubGroup.add(shaft);

  const headGeo = new THREE.BoxGeometry(0.12, 0.06, 0.22);
  const headMat = new THREE.MeshStandardMaterial({ color: '#b2bec3', metalness: 0.9, roughness: 0.2 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, -0.27, 0.06);
  head.castShadow = true;
  clubGroup.add(head);

  clubGroup.position.set(0.38, 0.35, 0.25);
  clubGroup.rotation.set(0.2, 0, -0.2);
  return clubGroup;
}

function createCharModel(charKey) {
  let model;
  if (charKey === 'bunny') model = createBunny();
  else if (charKey === 'frog') model = createFrog();
  else if (charKey === 'chick') model = createChick();
  else model = createBunny();

  const club = createGolfClub();
  model.add(club);
  return { model, club };
}

// =============================================
//  AIM LINE & TRAJECTORY
// =============================================
const aimLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
const aimLineGeo = new THREE.BufferGeometry();
aimLineGeo.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const aimLine = new THREE.Line(aimLineGeo, aimLineMat);
aimLine.visible = false;
scene.add(aimLine);

const arrowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.4 });
const arrowMesh = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), arrowMat);
arrowMesh.visible = false;
scene.add(arrowMesh);

// =============================================
//  SCORE DISPLAY & HUD
// =============================================
function updateScoreDisplay() {
  if (selectedGameMode === 'solo') {
    if (soloHudEl) soloHudEl.style.display = 'block';
    if (pvpHudEl) pvpHudEl.style.display = 'none';
    if (scoreEl) scoreEl.textContent = p1.strokes;
    if (holeBadgeEl) holeBadgeEl.textContent = `Hole ${currentHoleNumber}`;
    if (totalStrokesEl) totalStrokesEl.textContent = p1.totalStrokes + (p1.inHole ? 0 : p1.strokes);
  } else {
    if (soloHudEl) soloHudEl.style.display = 'none';
    if (pvpHudEl) pvpHudEl.style.display = 'flex';
    if (pvpHoleBadgeEl) pvpHoleBadgeEl.textContent = `Hole ${currentHoleNumber}`;
    if (p1CharLabelEl) p1CharLabelEl.textContent = `${characters[p1.charKey]?.emoji || ''} ${characters[p1.charKey]?.name || 'P1'}`;
    if (p2CharLabelEl) p2CharLabelEl.textContent = `${characters[p2.charKey]?.emoji || ''} ${selectedGameMode === '1v1_bot' ? 'Bot ' : ''}${characters[p2.charKey]?.name || 'P2'}`;
    if (p2BadgeLabelEl) p2BadgeLabelEl.textContent = selectedGameMode === '1v1_bot' ? 'BOT' : 'P2';
    if (p1StrokesEl) p1StrokesEl.textContent = p1.strokes;
    if (p2StrokesEl) p2StrokesEl.textContent = p2.strokes;
    if (p1WinsEl) p1WinsEl.textContent = p1.holesWon;
    if (p2WinsEl) p2WinsEl.textContent = p2.holesWon;

    if (p1CardEl) {
      if (activePlayerIndex === 1 && !p1.inHole) p1CardEl.classList.add('active');
      else p1CardEl.classList.remove('active');
    }
    if (p2CardEl) {
      if (activePlayerIndex === 2 && !p2.inHole) p2CardEl.classList.add('active');
      else p2CardEl.classList.remove('active');
    }

    if (pvpTurnBannerEl) {
      if (p1.inHole && p2.inHole) {
        pvpTurnBannerEl.textContent = 'Hole Finished! 🎉';
      } else if (activePlayerIndex === 1) {
        pvpTurnBannerEl.textContent = `${characters[p1.charKey]?.emoji || ''} P1's Turn ⛳`;
      } else {
        pvpTurnBannerEl.textContent = selectedGameMode === '1v1_bot'
          ? `🤖 Bot's Turn...`
          : `${characters[p2.charKey]?.emoji || ''} P2's Turn ⛳`;
      }
    }
  }
}

// =============================================
//  MODE & CHARACTER SELECTION
// =============================================
modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    sfxClick();
    modeTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    selectedGameMode = tab.dataset.mode;
    selectStep = 1;

    if (selectedGameMode === 'solo') {
      charSelectSubtitleEl.textContent = 'Pick Your Golfer!';
    } else if (selectedGameMode === '1v1_local') {
      charSelectSubtitleEl.textContent = 'Player 1: Pick Your Golfer!';
    } else if (selectedGameMode === '1v1_bot') {
      charSelectSubtitleEl.textContent = 'Pick Your Golfer (vs AI Bot)!';
    }
  });
});

document.querySelectorAll('.char-card').forEach(card => {
  card.addEventListener('click', () => {
    sfxSelect();
    const charKey = card.dataset.char;

    if (selectedGameMode === 'solo') {
      p1.charKey = charKey;
      startGame();
    } else if (selectedGameMode === '1v1_local') {
      if (selectStep === 1) {
        p1.charKey = charKey;
        selectStep = 2;
        charSelectSubtitleEl.textContent = 'Player 2: Pick Your Golfer!';
      } else {
        p2.charKey = charKey;
        startGame();
      }
    } else if (selectedGameMode === '1v1_bot') {
      p1.charKey = charKey;
      const keys = Object.keys(characters).filter(k => k !== charKey);
      p2.charKey = keys[Math.floor(Math.random() * keys.length)];
      startGame();
    }
  });
});

function setRandomHoleAndTee(randomizeTee = true) {
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

  holeMesh.position.set(holePos.x, 0.02, holePos.z);
  ringMesh.position.set(holePos.x, 0.04, holePos.z);
  holeBody.position.set(holePos.x, -0.3, holePos.z);
  flagGroup.position.set(holePos.x, 0, holePos.z);

  // Position Ball 1 at tee
  ballStartPos1.set(teePos.x - 0.35, 0.4, teePos.z);
  ballBody1.position.copy(ballStartPos1);
  ballBody1.velocity.set(0, 0, 0);
  ballBody1.angularVelocity.set(0, 0, 0);
  ballMesh1.position.copy(ballStartPos1);
  ballMesh1.visible = true;
  p1.inHole = false;
  p1.isBroken = false;
  p1.lastShotPos.copy(ballStartPos1);
  p1.standPos.set(teePos.x - 0.35, 0, teePos.z + 1.2);

  // Position Ball 2 if 1v1
  if (selectedGameMode !== 'solo') {
    ballStartPos2.set(teePos.x + 0.35, 0.4, teePos.z);
    ballBody2.position.copy(ballStartPos2);
    ballBody2.velocity.set(0, 0, 0);
    ballBody2.angularVelocity.set(0, 0, 0);
    ballMesh2.position.copy(ballStartPos2);
    ballMesh2.visible = true;
    p2.inHole = false;
    p2.isBroken = false;
    p2.lastShotPos.copy(ballStartPos2);
    p2.standPos.set(teePos.x + 0.9, 0, teePos.z + 1.2);
  } else {
    ballMesh2.visible = false;
    ballBody2.position.set(0, -10, 0);
    ballBody2.sleep();
  }

  generateCourseLayout();

  if (p1.charGroup) {
    p1.charGroup.position.copy(p1.standPos);
    p1.charGroup.lookAt(holePos.x, 0, holePos.z);
  }
  if (p2.charGroup) {
    p2.charGroup.position.copy(p2.standPos);
    p2.charGroup.lookAt(holePos.x, 0, holePos.z);
  }
}

function startGame() {
  charSelectEl.style.display = 'none';
  gameUiEl.style.display = 'block';
  if (navChangeCharBtn) navChangeCharBtn.style.display = 'inline-flex';

  p1.strokes = 0;
  p2.strokes = 0;
  p1.totalStrokes = 0;
  p2.totalStrokes = 0;
  p1.holesWon = 0;
  p2.holesWon = 0;
  activePlayerIndex = 1;
  currentHoleNumber = 1;

  if (selectedGameMode === 'solo') {
    charIndicatorEl.textContent = `Playing as ${characters[p1.charKey]?.emoji} ${characters[p1.charKey]?.name}`;
  }

  // Build character models
  if (p1.charGroup) scene.remove(p1.charGroup);
  if (p2.charGroup) scene.remove(p2.charGroup);

  const c1 = createCharModel(p1.charKey);
  p1.charGroup = c1.model;
  p1.charClub = c1.club;

  if (selectedGameMode !== 'solo') {
    const c2 = createCharModel(p2.charKey);
    p2.charGroup = c2.model;
    p2.charClub = c2.club;
  } else {
    p2.charGroup = null;
    p2.charClub = null;
  }

  setRandomHoleAndTee(true);
  updateScoreDisplay();

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
  if (!gameStarted || isBallMoving || isBotExecuting) return;
  const currBall = getActiveBall();
  if (currBall.player.inHole || currBall.player.isBroken) return;
  if (selectedGameMode === '1v1_bot' && activePlayerIndex === 2) return;
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
  if (!gameStarted || isBallMoving || isBotExecuting) return;
  const currBall = getActiveBall();
  if (currBall.player.inHole || currBall.player.isBroken) return;
  if (selectedGameMode === '1v1_bot' && activePlayerIndex === 2) return;
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

  const currBall = getActiveBall();
  if (dist > 5) {
    const dir = new THREE.Vector3(dx, 0, dy).normalize();
    const ballPos = currBall.mesh.position.clone();
    const tipPos = ballPos.clone().add(dir.clone().multiplyScalar(aimPower * 6 + 0.5));
    aimLineGeo.setFromPoints([ballPos, tipPos]);
    arrowMesh.position.copy(tipPos);
    arrowMesh.position.y = ballPos.y + 0.15;
    arrowMesh.lookAt(ballPos.x, arrowMesh.position.y, ballPos.z);
    arrowMesh.rotateX(Math.PI / 2);
  }
}

function endAim(cx, cy) {
  isAiming = false;
  powerContainerEl.style.display = 'none';
  aimLine.visible = false;
  arrowMesh.visible = false;

  const currBall = getActiveBall();
  if (aimPower > 0.05 && !currBall.player.isBroken) {
    const dx = dragStart.x - cx;
    const dy = dragStart.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      currBall.player.strokes++;
      updateScoreDisplay();
      sfxSwing(aimPower);

      currBall.player.lastShotPos.copy(currBall.mesh.position);
      currBall.player.isSwinging = true;
      currBall.player.swingProgress = 0;

      const dir = new THREE.Vector3(dx, 0, dy).normalize();
      const maxImpulse = 0.6;
      const impulseStrength = aimPower * maxImpulse;
      currBall.body.wakeUp();
      currBall.body.applyImpulse(
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
//  AI BOT AUTOMATED PUTTING ENGINE
// =============================================
function triggerBotShot() {
  if (isBotExecuting || p2.inHole || isBallMoving || isAiming || !gameStarted) return;
  isBotExecuting = true;
  if (aimHintEl) aimHintEl.textContent = '🤖 Bot is analyzing green...';

  setTimeout(() => {
    if (p2.inHole || !gameStarted) { isBotExecuting = false; return; }

    const bp = ballMesh2.position;
    const dx = holePos.x - bp.x;
    const dz = holePos.z - bp.z;
    const dist = Math.hypot(dx, dz);

    // Realistic human-like angle jitter (+- 2.5 deg)
    const angleJitter = (Math.random() - 0.5) * 0.08;
    const baseAngle = Math.atan2(dx, dz) + angleJitter;
    const dirX = Math.sin(baseAngle);
    const dirZ = Math.cos(baseAngle);

    const elevationDiff = holePos.y - bp.y;
    let power = Math.min(1.0, Math.max(0.2, dist / 15.5 + (elevationDiff > 0.3 ? 0.22 : 0) + (Math.random() - 0.5) * 0.07));

    p2.strokes++;
    updateScoreDisplay();
    sfxSwing(power);

    if (p2.charClub) {
      p2.isSwinging = true;
      p2.swingProgress = 0;
    }

    p2.lastShotPos.copy(ballMesh2.position);
    const maxImpulse = 0.6;
    const impulseStrength = power * maxImpulse;
    ballBody2.wakeUp();
    ballBody2.applyImpulse(
      new CANNON.Vec3(dirX * impulseStrength, 0, dirZ * impulseStrength),
      new CANNON.Vec3(0, 0, 0)
    );
    isBallMoving = true;
    isBotExecuting = false;
    if (aimHintEl) aimHintEl.textContent = 'Click & drag to aim and shoot!';
  }, 950);
}

// =============================================
//  SPIKE HAZARD BALL SHATTER & RESPAWN
// =============================================
function triggerBallBreak(playerIndex) {
  const p = playerIndex === 1 ? p1 : p2;
  const ballBody = playerIndex === 1 ? ballBody1 : ballBody2;
  const ballMesh = playerIndex === 1 ? ballMesh1 : ballMesh2;

  if (p.isBroken || p.inHole) return;
  p.isBroken = true;
  isBallMoving = false;

  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.sleep();
  ballMesh.visible = false;

  sfxBallBreak();

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

  p.strokes++;
  updateScoreDisplay();

  const pName = selectedGameMode === 'solo' ? 'Ball' : (playerIndex === 1 ? 'Player 1' : (selectedGameMode === '1v1_bot' ? 'Bot' : 'Player 2'));
  messageEl.textContent = `💥 ${pName} Ball Broken (+1 Stroke)`;
  messageEl.className = 'show danger';
  messageEl.style.display = 'block';

  setTimeout(() => {
    for (const f of activeFragments) {
      scene.remove(f.mesh);
      if (f.mesh.geometry) f.mesh.geometry.dispose();
    }
    activeFragments = [];

    sfxRespawn();
    ballBody.position.copy(p.lastShotPos);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballBody.wakeUp();
    ballMesh.position.copy(p.lastShotPos);
    ballMesh.visible = true;

    const respawnY = p.lastShotPos.y > 0.35 ? (p.lastShotPos.y - ballRadius) : 0;
    p.standPos.set(p.lastShotPos.x, respawnY, p.lastShotPos.z + 1.2);
    if (p.charGroup) {
      p.charGroup.position.copy(p.standPos);
      p.charGroup.lookAt(holePos.x, p.standPos.y, holePos.z);
    }

    messageEl.style.display = 'none';
    messageEl.className = '';
    p.isBroken = false;
  }, 950);
}

// =============================================
//  HOLE SINK & CELEBRATION
// =============================================
function triggerHoleSink(playerIndex) {
  const p = playerIndex === 1 ? p1 : p2;
  const ballBody = playerIndex === 1 ? ballBody1 : ballBody2;
  const ballMesh = playerIndex === 1 ? ballMesh1 : ballMesh2;

  if (p.inHole) return;
  p.inHole = true;
  sfxHoleSink();

  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.sleep();
  ballMesh.position.set(holePos.x, holePos.y - 0.17, holePos.z);

  if (selectedGameMode === 'solo') {
    sfxVictory();
    const msgs = { 1: 'Hole in One! ⛳✨', 2: 'Eagle! 🦅', 3: 'Birdie! 🐦', 4: 'Par! ⛳' };
    messageEl.textContent = msgs[p1.strokes] || 'Nice shot! 🎉';
    messageEl.className = 'show';
    messageEl.style.display = 'block';

    p1.totalStrokes += p1.strokes;
    updateScoreDisplay();

    setTimeout(() => {
      ballMesh1.visible = false;
      if (endActionsContainer) endActionsContainer.style.display = 'flex';
      try {
        if (window.ArcadeLeaderboard) {
          const golfScore = Math.max(10, 1000 - (p1.strokes - 1) * 200);
          window.ArcadeLeaderboard.submitScore('cute-mini-golf', golfScore);
        }
      } catch (e) {}
    }, 700);
  } else {
    updateScoreDisplay();
    if (p1.inHole && p2.inHole) {
      finalizePvPHole();
    }
  }
}

function finalizePvPHole() {
  sfxVictory();
  let winMsg = '';
  if (p1.strokes < p2.strokes) {
    p1.holesWon++;
    winMsg = `🏆 Player 1 wins Hole ${currentHoleNumber}! (${p1.strokes} vs ${p2.strokes})`;
  } else if (p2.strokes < p1.strokes) {
    p2.holesWon++;
    const p2Label = selectedGameMode === '1v1_bot' ? 'Bot' : 'Player 2';
    winMsg = `🏆 ${p2Label} wins Hole ${currentHoleNumber}! (${p2.strokes} vs ${p1.strokes})`;
  } else {
    winMsg = `🤝 Halved / Tied Hole! (${p1.strokes} strokes each)`;
  }

  p1.totalStrokes += p1.strokes;
  p2.totalStrokes += p2.strokes;
  updateScoreDisplay();

  messageEl.textContent = winMsg;
  messageEl.className = 'show';
  messageEl.style.display = 'block';

  setTimeout(() => {
    ballMesh1.visible = false;
    ballMesh2.visible = false;
    if (endActionsContainer) endActionsContainer.style.display = 'flex';
  }, 800);
}

// =============================================
//  COLLISIONS (Wall & Ball bounces)
// =============================================
world.addEventListener('beginContact', (e) => {
  const a = e.bodyA, b = e.bodyB;
  if (a === ballBody1 || b === ballBody1 || a === ballBody2 || b === ballBody2) {
    const activeB = (a === ballBody1 || b === ballBody1) ? ballBody1 : ballBody2;
    const speed = activeB.velocity.length();
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
  isBallMoving = false;
  p1.strokes = 0;
  p2.strokes = 0;
  p1.inHole = false;
  p2.inHole = false;
  p1.isBroken = false;
  p2.isBroken = false;
  activePlayerIndex = 1;

  if (fullReset) {
    p1.totalStrokes = 0;
    p2.totalStrokes = 0;
    p1.holesWon = 0;
    p2.holesWon = 0;
    currentHoleNumber = 1;
  }

  updateScoreDisplay();
  messageEl.style.display = 'none';
  messageEl.className = '';
  if (endActionsContainer) endActionsContainer.style.display = 'none';
  if (aimHintEl) aimHintEl.style.display = 'block';

  for (const f of activeFragments) {
    scene.remove(f.mesh);
    if (f.mesh.geometry) f.mesh.geometry.dispose();
  }
  activeFragments = [];

  setRandomHoleAndTee(true);

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

if (playAgainBtn) {
  playAgainBtn.addEventListener('click', () => {
    sfxClick();
    resetGameState(true);
  });
}

function openCharacterSelect() {
  sfxClick();
  resetGameState(true);
  gameStarted = false;
  gameUiEl.style.display = 'none';
  if (navChangeCharBtn) navChangeCharBtn.style.display = 'none';
  charSelectEl.style.display = 'flex';
  selectStep = 1;
  if (selectedGameMode === '1v1_local') {
    charSelectSubtitleEl.textContent = 'Player 1: Pick Your Golfer!';
  } else {
    charSelectSubtitleEl.textContent = 'Pick Your Golfer!';
  }
}

if (switchCharBtn) switchCharBtn.addEventListener('click', openCharacterSelect);
if (navChangeCharBtn) navChangeCharBtn.addEventListener('click', openCharacterSelect);

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

  world.step(1 / 60, dt, 3);

  // Sync ball meshes
  if (!p1.inHole && !p1.isBroken) {
    ballMesh1.position.copy(ballBody1.position);
    ballMesh1.quaternion.copy(ballBody1.quaternion);
  }
  if (selectedGameMode !== 'solo' && !p2.inHole && !p2.isBroken) {
    ballMesh2.position.copy(ballBody2.position);
    ballMesh2.quaternion.copy(ballBody2.quaternion);
  }

  // 1. SPEED BOOSTERS
  if (gameStarted) {
    for (const b of activeBoosters) {
      if (b.arrows) {
        b.arrows.forEach((arr, i) => {
          arr.position.y = 0.05 + Math.sin(elapsed * 6 + i * 1.5) * 0.02;
        });
      }

      // Check Ball 1
      if (!p1.isBroken && !p1.inHole) {
        const dx1 = Math.abs(ballMesh1.position.x - b.px);
        const dz1 = Math.abs(ballMesh1.position.z - b.pz);
        if (dx1 < b.width / 2 + 0.1 && dz1 < b.length / 2 + 0.1 && ballMesh1.position.y < 0.6) {
          ballBody1.wakeUp();
          ballBody1.velocity.x += b.dirX * b.power * dt;
          ballBody1.velocity.z += b.dirZ * b.power * dt;
          isBallMoving = true;
          if (elapsed - lastBoostSfxTime > 0.26) { sfxBoost(); lastBoostSfxTime = elapsed; }
        }
      }

      // Check Ball 2
      if (selectedGameMode !== 'solo' && !p2.isBroken && !p2.inHole) {
        const dx2 = Math.abs(ballMesh2.position.x - b.px);
        const dz2 = Math.abs(ballMesh2.position.z - b.pz);
        if (dx2 < b.width / 2 + 0.1 && dz2 < b.length / 2 + 0.1 && ballMesh2.position.y < 0.6) {
          ballBody2.wakeUp();
          ballBody2.velocity.x += b.dirX * b.power * dt;
          ballBody2.velocity.z += b.dirZ * b.power * dt;
          isBallMoving = true;
          if (elapsed - lastBoostSfxTime > 0.26) { sfxBoost(); lastBoostSfxTime = elapsed; }
        }
      }
    }
  }

  // 2. SPIKE HAZARDS
  if (gameStarted) {
    for (const sp of activeSpikes) {
      if (!p1.isBroken && !p1.inHole) {
        if (Math.hypot(ballMesh1.position.x - sp.px, ballMesh1.position.z - sp.pz) < sp.radius * 0.9 && ballMesh1.position.y < 0.65) {
          triggerBallBreak(1);
        }
      }
      if (selectedGameMode !== 'solo' && !p2.isBroken && !p2.inHole) {
        if (Math.hypot(ballMesh2.position.x - sp.px, ballMesh2.position.z - sp.pz) < sp.radius * 0.9 && ballMesh2.position.y < 0.65) {
          triggerBallBreak(2);
        }
      }
    }
  }

  // 3. ANIMATED WINDMILL BLADES & DOOR TIMING
  if (gameStarted) {
    for (const wm of activeWindmills) {
      wm.bladeAngle += dt * wm.bladeSpeed;
      wm.bladesGroup.rotation.z = wm.bladeAngle;

      const currBall = getActiveBall();
      if (!currBall.player.isBroken && !currBall.player.inHole) {
        const bPos = currBall.mesh.position;
        const distToDoor = Math.hypot(bPos.x - wm.px, bPos.z - wm.doorZ);

        // Check if ball is rolling towards doorway from fairway (velocity.z < -0.1)
        if (distToDoor < 0.85 && currBall.body.velocity.z < -0.1 && Math.abs(bPos.x - wm.px) < wm.tunnelW / 2) {
          // Check if a blade is currently blocking the bottom archway (near 6 o'clock)
          const cycle = Math.abs(((wm.bladeAngle + Math.PI / 4) % (Math.PI / 2)) - (Math.PI / 4));
          const isBladeBlocking = cycle < 0.26;

          const nowTime = performance.now();
          if (isBladeBlocking) {
            if (nowTime - lastWindmillHitTime > 320) {
              lastWindmillHitTime = nowTime;
              sfxBounce();
              // Rebound backwards off rotating wooden blade
              currBall.body.velocity.z = Math.abs(currBall.body.velocity.z) * 0.72 + 1.8;
              currBall.body.velocity.x += (Math.random() - 0.5) * 2.2;
              currBall.body.velocity.y = 0.5;
              isBallMoving = true;
            }
          } else {
            // Door is clear! Shot sails smoothly through the windmill archway
            if (nowTime - lastWindmillHitTime > 800) {
              lastWindmillHitTime = nowTime;
              sfxBoost();
              currBall.body.velocity.x *= 0.4;
              currBall.body.velocity.z = Math.min(currBall.body.velocity.z, -6.8);
              isBallMoving = true;
            }
          }
        }
      }
    }
  }

  // 4. FRAGMENTS SIMULATION
  for (let i = activeFragments.length - 1; i >= 0; i--) {
    const f = activeFragments[i];
    f.vy -= 18.0 * dt;
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

  // HOLE SUCTION & SINK DETECTION
  const HOLE_RADIUS = 0.52;
  if (gameStarted) {
    if (!p1.inHole && !p1.isBroken) {
      const d1 = Math.hypot(ballMesh1.position.x - holePos.x, ballMesh1.position.z - holePos.z);
      const vd1 = Math.abs(ballMesh1.position.y - holePos.y);
      if (d1 < HOLE_RADIUS * 1.4 && vd1 < 0.85) {
        ballBody1.velocity.x += (holePos.x - ballMesh1.position.x) * 10.0 * dt;
        ballBody1.velocity.z += (holePos.z - ballMesh1.position.z) * 10.0 * dt;
        ballBody1.velocity.y -= 14.0 * dt;
        if (d1 < HOLE_RADIUS * 0.78) triggerHoleSink(1);
      }
    }

    if (selectedGameMode !== 'solo' && !p2.inHole && !p2.isBroken) {
      const d2 = Math.hypot(ballMesh2.position.x - holePos.x, ballMesh2.position.z - holePos.z);
      const vd2 = Math.abs(ballMesh2.position.y - holePos.y);
      if (d2 < HOLE_RADIUS * 1.4 && vd2 < 0.85) {
        ballBody2.velocity.x += (holePos.x - ballMesh2.position.x) * 10.0 * dt;
        ballBody2.velocity.z += (holePos.z - ballMesh2.position.z) * 10.0 * dt;
        ballBody2.velocity.y -= 14.0 * dt;
        if (d2 < HOLE_RADIUS * 0.78) triggerHoleSink(2);
      }
    }
  }

  // BALL STOPPED CHECK & 1V1 TURN TRANSITIONS
  if (isBallMoving && gameStarted) {
    const currBall = getActiveBall();
    const vel = currBall.body.velocity;
    const hSpeedSq = vel.x * vel.x + vel.z * vel.z;
    const totalSpeedSq = hSpeedSq + vel.y * vel.y;

    if (totalSpeedSq < 2.2) {
      const brakeFactor = Math.max(0, 1 - 4.5 * dt);
      currBall.body.velocity.x *= brakeFactor;
      currBall.body.velocity.z *= brakeFactor;
      currBall.body.angularVelocity.scale(brakeFactor, currBall.body.angularVelocity);
    }

    if (totalSpeedSq < 0.12 || (hSpeedSq < 0.08 && Math.abs(vel.y) < 0.15)) {
      currBall.body.velocity.set(0, 0, 0);
      currBall.body.angularVelocity.set(0, 0, 0);
      currBall.body.sleep();
      isBallMoving = false;

      const groundY = (currBall.mesh.position.y > 0.4) ? (currentTerraceHeight || (currBall.mesh.position.y - ballRadius)) : 0;
      currBall.player.standPos.set(currBall.mesh.position.x, groundY, currBall.mesh.position.z + 1.2);

      if (selectedGameMode !== 'solo') {
        if (p1.inHole && p2.inHole) {
          // both in hole
        } else if (p1.inHole) {
          activePlayerIndex = 2;
          updateScoreDisplay();
          if (selectedGameMode === '1v1_bot') triggerBotShot();
        } else if (p2.inHole) {
          activePlayerIndex = 1;
          updateScoreDisplay();
        } else {
          // Furthest ball puts next
          const dist1 = Math.hypot(ballMesh1.position.x - holePos.x, ballMesh1.position.z - holePos.z);
          const dist2 = Math.hypot(ballMesh2.position.x - holePos.x, ballMesh2.position.z - holePos.z);
          activePlayerIndex = (dist1 >= dist2) ? 1 : 2;
          updateScoreDisplay();
          if (selectedGameMode === '1v1_bot' && activePlayerIndex === 2) triggerBotShot();
        }
      }
    }
  }

  // Out of bounds reset
  if (ballBody1.position.y < -5) {
    ballBody1.position.copy(ballStartPos1);
    ballBody1.velocity.set(0, 0, 0);
    ballBody1.wakeUp();
  }
  if (ballBody2.position.y < -5) {
    ballBody2.position.copy(ballStartPos2);
    ballBody2.velocity.set(0, 0, 0);
    ballBody2.wakeUp();
  }

  // ANIMATE PLAYER 1 CHARACTER
  if (p1.charGroup && gameStarted) {
    p1.charGroup.position.x += (p1.standPos.x - p1.charGroup.position.x) * 0.06;
    p1.charGroup.position.y += (p1.standPos.y - p1.charGroup.position.y) * 0.06;
    p1.charGroup.position.z += (p1.standPos.z - p1.charGroup.position.z) * 0.06;

    p1.charGroup.position.y = p1.standPos.y + Math.sin(elapsed * 2.5) * 0.04;
    p1.charGroup.lookAt(ballMesh1.position.x, p1.charGroup.position.y, ballMesh1.position.z);

    if (p1.charClub) {
      if (p1.isSwinging) {
        p1.swingProgress += dt * 4.5;
        if (p1.swingProgress < 0.35) {
          p1.charClub.rotation.x = 0.2 + (p1.swingProgress / 0.35) * 0.9;
        } else if (p1.swingProgress < 1.0) {
          p1.charClub.rotation.x = 0.2 + (1.0 - (p1.swingProgress - 0.35) / 0.65) * 0.9;
        } else {
          p1.isSwinging = false;
          p1.charClub.rotation.set(0.2, 0, -0.2);
        }
      } else if (isAiming && activePlayerIndex === 1) {
        p1.charClub.rotation.x = 0.2 - aimPower * 0.9;
        p1.charClub.rotation.z = -0.2 - aimPower * 0.3;
      } else {
        p1.charClub.rotation.set(0.2, 0, -0.2);
      }
    }
  }

  // ANIMATE PLAYER 2 CHARACTER
  if (p2.charGroup && selectedGameMode !== 'solo' && gameStarted) {
    p2.charGroup.position.x += (p2.standPos.x - p2.charGroup.position.x) * 0.06;
    p2.charGroup.position.y += (p2.standPos.y - p2.charGroup.position.y) * 0.06;
    p2.charGroup.position.z += (p2.standPos.z - p2.charGroup.position.z) * 0.06;

    p2.charGroup.position.y = p2.standPos.y + Math.sin(elapsed * 2.5 + 1.0) * 0.04;
    p2.charGroup.lookAt(ballMesh2.position.x, p2.charGroup.position.y, ballMesh2.position.z);

    if (p2.charClub) {
      if (p2.isSwinging) {
        p2.swingProgress += dt * 4.5;
        if (p2.swingProgress < 0.35) {
          p2.charClub.rotation.x = 0.2 + (p2.swingProgress / 0.35) * 0.9;
        } else if (p2.swingProgress < 1.0) {
          p2.charClub.rotation.x = 0.2 + (1.0 - (p2.swingProgress - 0.35) / 0.65) * 0.9;
        } else {
          p2.isSwinging = false;
          p2.charClub.rotation.set(0.2, 0, -0.2);
        }
      } else if (isAiming && activePlayerIndex === 2) {
        p2.charClub.rotation.x = 0.2 - aimPower * 0.9;
        p2.charClub.rotation.z = -0.2 - aimPower * 0.3;
      } else {
        p2.charClub.rotation.set(0.2, 0, -0.2);
      }
    }
  }

  // Environment Animations
  for (const cloud of clouds) {
    cloud.position.x = cloud.userData.baseX + Math.sin(elapsed * cloud.userData.speed) * 3;
  }
  if (flagMeshObj) {
    flagMeshObj.rotation.y = Math.sin(elapsed * 3) * 0.15;
  }
  if (pondMesh) {
    pondMesh.material.opacity = 0.6 + Math.sin(elapsed * 2) * 0.1;
  }

  // Camera tracking
  if (gameStarted) {
    const activeB = getActiveBall();
    const targetCamPos = new THREE.Vector3(
      activeB.mesh.position.x * 0.3,
      12 + activeB.mesh.position.y * 0.4,
      activeB.mesh.position.z + 16
    );
    camera.position.lerp(targetCamPos, 0.035);
    camera.lookAt(activeB.mesh.position.x * 0.5, activeB.mesh.position.y * 0.5, activeB.mesh.position.z - 2);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
