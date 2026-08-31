import './style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sfxSwing, sfxBounce, sfxHoleSink, sfxVictory, sfxClick, sfxSelect } from './audio.js';

// =============================================
//  CUTE MINI GOLF 3D
//  Nintendo-inspired visuals • Click & drag aim
// =============================================

// --- STATE ---
let selectedCharKey = null;
let selectedChar = null;
let strokes = 0;
let isAiming = false;
let aimPower = 0;
let isBallMoving = false;
let inHole = false;
let gameStarted = false;
let charStandPos = new THREE.Vector3(0, 0, 9.2); // Where the character stands

// --- DOM ---
const charSelectEl = document.getElementById('char-select');
const gameUiEl = document.getElementById('game-ui');
const scoreEl = document.getElementById('strokes');
const powerContainerEl = document.getElementById('power-bar-container');
const powerBarEl = document.getElementById('power-bar');
const messageEl = document.getElementById('message');
const charIndicatorEl = document.getElementById('char-indicator');
const aimHintEl = document.getElementById('aim-hint');
const playAgainBtn = document.getElementById('play-again-btn');

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
  friction: 0.4,
  restitution: 0.25
}));
world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, wallPhysMat, {
  friction: 0.1,
  restitution: 0.6
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
//  BUILD THE COURSE
// =============================================
createStaticBox(10, 0.5, 22, 0, -0.25, 0, courseMat, groundPhysMat);
createStaticBox(11.2, 0.3, 23.2, 0, -0.45, 0, courseEdgeMat, groundPhysMat);

createStaticBox(11, 1.2, 0.6, 0, 0.35, -11.3, wallMat, wallPhysMat);
createStaticBox(11, 1.2, 0.6, 0, 0.35, 11.3, wallMat, wallPhysMat);
createStaticBox(0.6, 1.2, 22, -5.3, 0.35, 0, wallMat, wallPhysMat);
createStaticBox(0.6, 1.2, 22, 5.3, 0.35, 0, wallMat, wallPhysMat);

createStaticBox(3.5, 0.8, 0.8, -1.5, 0.4, -2.5, obstacleMat, wallPhysMat);
createStaticBox(3.5, 0.8, 0.8, 1.5, 0.4, 2, obstacleMat, wallPhysMat);

const bumpMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.8, 1, 0.5, 16),
  obstacleMat
);
bumpMesh.position.set(3, 0.25, -5);
bumpMesh.castShadow = true;
bumpMesh.receiveShadow = true;
scene.add(bumpMesh);
world.addBody(new CANNON.Body({
  mass: 0,
  position: new CANNON.Vec3(3, 0.25, -5),
  shape: new CANNON.Cylinder(0.8, 1, 0.5, 16),
  material: wallPhysMat
}));

// --- Hole ---
const holeRadius = 0.45;
const holeMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(holeRadius, holeRadius, 0.08, 32),
  holeDarkMat
);
holeMesh.position.set(0, 0.02, -8);
holeMesh.receiveShadow = true;
scene.add(holeMesh);

const ringMesh = new THREE.Mesh(
  new THREE.RingGeometry(holeRadius, holeRadius + 0.12, 32),
  new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, side: THREE.DoubleSide })
);
ringMesh.rotation.x = -Math.PI / 2;
ringMesh.position.set(0, 0.04, -8);
scene.add(ringMesh);

const holeBody = new CANNON.Body({
  mass: 0,
  position: new CANNON.Vec3(0, -0.3, -8),
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
flagGroup.position.set(0, 0, -8);
scene.add(flagGroup);

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
  mass: 0.045,
  position: ballStartPos.clone(),
  shape: new CANNON.Sphere(ballRadius),
  material: ballPhysMat,
  linearDamping: 0.35,
  angularDamping: 0.4
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
  charIndicatorEl.textContent = `Playing as ${selectedChar.emoji} ${selectedChar.name}`;

  // Remove old character if restarting
  if (charGroup) {
    scene.remove(charGroup);
    charGroup = null;
  }

  charGroup = createCharModel(charKey);

  // Place character at start position behind ball
  charStandPos.set(0, 0, 9.2);
  charGroup.position.copy(charStandPos);
  charGroup.lookAt(0, 0, -8);

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

  if (aimPower > 0.05) {
    const dx = dragStart.x - cx;
    const dy = dragStart.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      strokes++;
      scoreEl.textContent = strokes;
      sfxSwing(aimPower);

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
  ballMesh.position.set(0, -0.15, -8);

  setTimeout(() => {
    ballMesh.visible = false;
    playAgainBtn.style.display = 'block';
  }, 700);
}

// =============================================
//  COLLISIONS (Wall bounces)
// =============================================
world.addEventListener('beginContact', (e) => {
  const a = e.bodyA, b = e.bodyB;
  if (a === ballBody || b === ballBody) {
    if (ballBody.velocity.length() > 0.4) {
      sfxBounce();
    }
  }
});

// =============================================
//  PLAY AGAIN
// =============================================
playAgainBtn.addEventListener('click', () => {
  sfxClick();
  // Reset state
  inHole = false;
  isBallMoving = false;
  strokes = 0;
  scoreEl.textContent = '0';
  messageEl.style.display = 'none';
  messageEl.className = '';
  playAgainBtn.style.display = 'none';
  aimHintEl.style.display = 'block';

  // Reset ball
  ballBody.position.copy(ballStartPos);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.wakeUp();
  ballMesh.visible = true;

  // Reset character position
  charStandPos.set(0, 0, 9.2);
  if (charGroup) {
    charGroup.position.copy(charStandPos);
    charGroup.lookAt(0, 0, -8);
  }

  // Reset camera
  camera.position.set(0, 12, 18);
  camera.lookAt(0, 0, 0);
});

// =============================================
//  RESET (Out of bounds)
// =============================================
function resetBall() {
  ballBody.position.copy(ballStartPos);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.wakeUp();
  isBallMoving = false;
  charStandPos.set(0, 0, 9.2);
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

  // Physics
  world.step(1 / 60, dt, 3);

  // Sync ball mesh to physics (unless sunk in hole)
  if (!inHole) {
    for (const obj of objectsToUpdate) {
      obj.mesh.position.copy(obj.body.position);
      obj.mesh.quaternion.copy(obj.body.quaternion);
    }
  }

  // HOLE DETECTION: Check if ball enters hole cup (0, 0, -8)
  const HOLE_X = 0;
  const HOLE_Z = -8;
  const HOLE_RADIUS = 0.52;
  const distToHole = Math.hypot(ballMesh.position.x - HOLE_X, ballMesh.position.z - HOLE_Z);

  if (!inHole && gameStarted) {
    // Gravitational suction when rolling near the hole rim
    if (distToHole < HOLE_RADIUS * 1.4) {
      const pull = 10.0;
      ballBody.velocity.x += (HOLE_X - ballMesh.position.x) * pull * dt;
      ballBody.velocity.z += (HOLE_Z - ballMesh.position.z) * pull * dt;
      ballBody.velocity.y -= 14.0 * dt;

      // When ball drops inside the cup perimeter
      if (distToHole < HOLE_RADIUS * 0.78) {
        triggerHoleSink();
      }
    }
  }

  // Ball stopped check — character walks to ball when it stops
  if (isBallMoving && !inHole) {
    const vel = ballBody.velocity;
    if (vel.x * vel.x + vel.y * vel.y + vel.z * vel.z < 0.008) {
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

  // Character: smoothly walks to charStandPos, does NOT follow the ball in real-time
  if (charGroup && gameStarted) {
    // Smoothly lerp character to the target stand position
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
