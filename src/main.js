import "./styles.css";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { MMDLoader } from "three-stdlib";
import { loadLocalAssetConfig, renderAssetStatus } from "./localAssetLoader.js";

const canvas = document.querySelector("#scene");
const togglePlay = document.querySelector("#togglePlay");
const cameraModeButton = document.querySelector("#cameraMode");
const stageLightingSlider = document.querySelector("#stageLighting");
const stageLightingControl = stageLightingSlider.closest(".stage-light-control");
const assetStatus = document.querySelector("#assetStatus");
const queryParams = new URLSearchParams(window.location.search);

const DEFAULT_MODEL_PREVIEW_OPTIONS = {
  mode: "textured",
  materialPreset: "native",
  lighting: "native",
  stageLighting: 0,
  materialBoost: false,
  materialBoostStrength: 0.35,
  bloomStrength: 0.02
};

const BLINK_MORPH_NAMES = ["まばたき", "blink", "Blink", "BLINK"];
const BLINK_CLOSE_RATIO = 0.32;
const BLINK_HOLD_RATIO = 0.18;

const blinkController = {
  targets: [],
  clock: 0,
  active: false,
  time: 0,
  duration: 0.16,
  nextAt: THREE.MathUtils.randFloat(1.2, 3.4),
  doubleBlinkQueued: false
};

let modelPreviewOptions = { ...DEFAULT_MODEL_PREVIEW_OPTIONS };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
scene.fog = null;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const camera = new THREE.PerspectiveCamera(
  44,
  window.innerWidth / window.innerHeight,
  0.1,
  140
);
camera.position.set(0, 4.2, 13);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.98,
  0.58,
  0.09
);
composer.addPass(bloom);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const drag = {
  active: false,
  lastX: 0,
  lastY: 0,
  yaw: 0,
  pitch: 0
};

let elapsed = 0;
let playing = true;
let cameraMode = 0;
let localAssetState = null;
let realDancer = null;
let activeDancer = null;

const materials = {
  skin: new THREE.MeshStandardMaterial({
    color: 0xffc7bd,
    roughness: 0.58
  }),
  hair: new THREE.MeshStandardMaterial({
    color: 0x42f4ff,
    emissive: 0x11d9ff,
    emissiveIntensity: 1.42,
    roughness: 0.34
  }),
  hairDark: new THREE.MeshStandardMaterial({
    color: 0x0b7585,
    emissive: 0x028fa0,
    emissiveIntensity: 0.62,
    roughness: 0.42
  }),
  outfit: new THREE.MeshStandardMaterial({
    color: 0x07090f,
    roughness: 0.35,
    metalness: 0.16
  }),
  trim: new THREE.MeshStandardMaterial({
    color: 0xd7fbff,
    emissive: 0x55efff,
    emissiveIntensity: 0.76,
    roughness: 0.28
  }),
  cyanGlow: new THREE.MeshBasicMaterial({
    color: 0x4ff6ff,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide
  }),
  whiteGlow: new THREE.MeshBasicMaterial({
    color: 0xeefbff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  }),
  pinkGlow: new THREE.MeshBasicMaterial({
    color: 0xff4fc8,
    transparent: true,
    opacity: 0.9
  }),
  metal: new THREE.MeshStandardMaterial({
    color: 0x1e2b32,
    metalness: 0.58,
    roughness: 0.25
  }),
  floor: new THREE.MeshPhysicalMaterial({
    color: 0x0b1318,
    metalness: 0.64,
    roughness: 0.18,
    clearcoat: 0.8,
    clearcoatRoughness: 0.08
  })
};

const stageAmbientLight = new THREE.HemisphereLight(0x9df9ff, 0x08080e, 0.85);
scene.add(stageAmbientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
keyLight.position.set(0, 4.4, 6.4);
scene.add(keyLight);
keyLight.target.position.set(0, 1.65, 0);
scene.add(keyLight.target);

const rimLight = new THREE.PointLight(0x4ff6ff, 9, 26, 2);
rimLight.position.set(-2.4, 3.1, 5.3);
scene.add(rimLight);

const magentaLight = new THREE.PointLight(0xff4fc8, 4.5, 22, 2);
magentaLight.position.set(2.4, 3, 5.1);
scene.add(magentaLight);

const stage = new THREE.Group();
scene.add(stage);

const modelPreview = new THREE.Group();
modelPreview.visible = false;
scene.add(modelPreview);
let modelGuideLine = null;

const modelAmbientLight = new THREE.AmbientLight(0xffffff, 1.35);
modelAmbientLight.visible = false;
scene.add(modelAmbientLight);

const modelFillLight = new THREE.DirectionalLight(0xffffff, 2.1);
modelFillLight.position.set(0, 4.5, 6);
modelFillLight.visible = false;
scene.add(modelFillLight);

const modelSideLight = new THREE.PointLight(0x9df9ff, 5, 12, 2);
modelSideLight.position.set(-3.8, 2.6, 2.5);
modelSideLight.visible = false;
scene.add(modelSideLight);

const modelHairLight = new THREE.PointLight(0xffffff, 1.8, 8, 2);
modelHairLight.position.set(2.5, 3.8, 3.2);
modelHairLight.visible = false;
scene.add(modelHairLight);

function addBox(parent, size, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, radiusTop, radiusBottom, height, position, material, radial = 64) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radial),
    material
  );
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function createTorus(radius, tube, material, position, rotation) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 16, 160),
    material
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

function createNeonLine(start, end, width, material) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, width, length), material);
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize());
  return mesh;
}

function buildStage() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(42, 34), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  stage.add(floor);

  const grid = new THREE.GridHelper(34, 34, 0x55f5ff, 0x143a42);
  grid.position.y = 0.003;
  grid.material.opacity = 0.18;
  grid.material.transparent = true;
  stage.add(grid);

  const platform = addCylinder(stage, 4.15, 4.45, 0.28, [0, 0.15, 0], materials.metal, 128);
  platform.scale.z = 0.5;
  const ring = createTorus(4.2, 0.05, materials.cyanGlow, [0, 0.34, 0], [Math.PI / 2, 0, 0]);
  ring.scale.y = 0.52;
  stage.add(ring);
  const innerRing = createTorus(2.85, 0.025, materials.whiteGlow, [0, 0.38, 0], [Math.PI / 2, 0, 0]);
  innerRing.scale.y = 0.52;
  stage.add(innerRing);

  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const radius = i % 2 ? 4.25 : 3.35;
    const rail = addBox(
      stage,
      [0.06, 0.06, 0.9],
      [Math.cos(angle) * radius, 0.48, Math.sin(angle) * radius * 0.52],
      materials.whiteGlow,
      [0, -angle, 0]
    );
    rail.scale.z = 1 + (i % 3) * 0.25;
  }

  const back = new THREE.Group();
  back.position.set(0, 3.9, -5.9);
  stage.add(back);

  const rings = [
    [3.4, 0.028, 0],
    [2.58, 0.022, 0.4],
    [4.34, 0.018, -0.3]
  ];
  for (const [radius, tube, tilt] of rings) {
    const torus = createTorus(radius, tube, materials.whiteGlow, [0, 0, 0], [0, 0, tilt]);
    back.add(torus);
  }

  const square = new THREE.Group();
  const edge = 2.35;
  square.add(createNeonLine(new THREE.Vector3(-edge, -edge, 0), new THREE.Vector3(edge, -edge, 0), 0.07, materials.cyanGlow));
  square.add(createNeonLine(new THREE.Vector3(edge, -edge, 0), new THREE.Vector3(edge, edge, 0), 0.07, materials.cyanGlow));
  square.add(createNeonLine(new THREE.Vector3(edge, edge, 0), new THREE.Vector3(-edge, edge, 0), 0.07, materials.cyanGlow));
  square.add(createNeonLine(new THREE.Vector3(-edge, edge, 0), new THREE.Vector3(-edge, -edge, 0), 0.07, materials.cyanGlow));
  square.rotation.z = Math.PI / 4;
  back.add(square);

  const zMark = new THREE.Group();
  zMark.add(addBox(zMark, [2.55, 0.15, 0.09], [0, 1.1, 0.08], materials.cyanGlow));
  zMark.add(addBox(zMark, [2.55, 0.15, 0.09], [0, -1.1, 0.08], materials.cyanGlow));
  zMark.add(addBox(zMark, [3.1, 0.16, 0.09], [0, 0, 0.08], materials.cyanGlow, [0, 0, -0.74]));
  back.add(zMark);

  for (let side = -1; side <= 1; side += 2) {
    for (let y = -1; y <= 2; y += 1) {
      addBox(stage, [6.6, 0.12, 0.15], [side * 7.4, 2.4 + y * 1.45, -5.5], materials.whiteGlow, [0, 0, side * 0.16]);
      addBox(stage, [4.8, 0.18, 0.18], [side * 8.7, 1.9 + y * 1.55, -2.8], materials.metal, [0, side * 0.4, side * 0.12]);
    }
  }

  const shards = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.16, 0.46),
    materials.whiteGlow,
    340
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 340; i += 1) {
    const side = i % 2 ? -1 : 1;
    dummy.position.set(
      side * THREE.MathUtils.randFloat(3.1, 13.5),
      THREE.MathUtils.randFloat(1.2, 9.5),
      THREE.MathUtils.randFloat(-7.8, -5.2)
    );
    dummy.rotation.set(
      THREE.MathUtils.randFloat(0, Math.PI),
      THREE.MathUtils.randFloat(0, Math.PI),
      THREE.MathUtils.randFloat(0, Math.PI)
    );
    const scale = THREE.MathUtils.randFloat(0.4, 2.2);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    shards.setMatrixAt(i, dummy.matrix);
  }
  stage.add(shards);
}

function buildModelPreview() {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 96),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.34;
  modelPreview.add(floor);

  const ring = createTorus(
    2.82,
    0.012,
    new THREE.MeshBasicMaterial({
      color: 0x9df9ff,
      transparent: true,
      opacity: 0.36
    }),
    [0, 0.36, 0],
    [Math.PI / 2, 0, 0]
  );
  modelPreview.add(ring);

  const guideMaterial = new THREE.LineBasicMaterial({
    color: 0x9df9ff,
    transparent: true,
    opacity: 0.28
  });
  const guideGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-2.2, 1.72, 0),
    new THREE.Vector3(2.2, 1.72, 0)
  ]);
  modelGuideLine = new THREE.Line(guideGeometry, guideMaterial);
  modelGuideLine.name = "modelPreviewGuideLine";
  modelPreview.add(modelGuideLine);
}

function makeLimb(length, radius, material) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 8, 18),
    material
  );
  mesh.position.y = -length / 2;
  group.add(mesh);
  return group;
}

function ribbonCurve(points, colorMaterial, radius = 0.07) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 44, radius, 10, false), colorMaterial);
}

function createDancer() {
  const root = new THREE.Group();
  root.position.y = 0.48;

  const hips = new THREE.Group();
  hips.name = "hips";
  root.add(hips);

  const torso = new THREE.Group();
  torso.name = "torso";
  torso.position.y = 1.86;
  hips.add(torso);

  const waist = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 14), materials.outfit);
  waist.scale.set(0.88, 0.42, 0.55);
  waist.position.y = 1.05;
  hips.add(waist);

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 1.15, 0.54, 8, 1, true),
    materials.outfit
  );
  skirt.position.y = 0.86;
  hips.add(skirt);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.0, 14, 24), materials.outfit);
  body.scale.set(0.86, 1, 0.48);
  body.position.y = 0.2;
  torso.add(body);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 8, 48), materials.trim);
  collar.position.y = 0.83;
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 0.38;
  torso.add(collar);

  const tie = addBox(torso, [0.12, 0.7, 0.04], [0, 0.18, 0.48], materials.cyanGlow, [0, 0, 0.05]);
  tie.scale.x = 0.68;

  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.25, 8, 12), materials.skin);
  neck.position.y = 0.9;
  torso.add(neck);

  const head = new THREE.Group();
  head.name = "head";
  head.position.y = 1.25;
  torso.add(head);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.44, 34, 20), materials.skin);
  face.scale.set(0.92, 1.05, 0.84);
  head.add(face);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.16), materials.cyanGlow);
    eye.position.set(side * 0.14, 0.03, 0.385);
    eye.rotation.y = side * -0.12;
    head.add(eye);
  }

  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.025), materials.pinkGlow);
  mouth.position.set(0, -0.18, 0.395);
  head.add(mouth);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.47, 34, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), materials.hair);
  hairCap.rotation.x = -0.16;
  hairCap.position.y = 0.12;
  head.add(hairCap);

  const bangMat = materials.hairDark;
  for (let i = -2; i <= 2; i += 1) {
    const bang = ribbonCurve(
      [
        new THREE.Vector3(i * 0.12, 0.26, 0.36),
        new THREE.Vector3(i * 0.1, -0.02, 0.48),
        new THREE.Vector3(i * 0.07, -0.34, 0.38)
      ],
      bangMat,
      0.035
    );
    head.add(bang);
  }

  const headsetL = addBox(head, [0.11, 0.46, 0.22], [-0.48, 0.02, 0], materials.outfit, [0, 0, -0.1]);
  const headsetR = headsetL.clone();
  headsetR.position.x *= -1;
  headsetR.rotation.z *= -1;
  head.add(headsetR);
  addBox(head, [0.055, 0.9, 0.055], [-0.56, 0.18, 0], materials.pinkGlow, [0, 0, -0.65]);
  addBox(head, [0.055, 0.9, 0.055], [0.56, 0.18, 0], materials.pinkGlow, [0, 0, 0.65]);

  const leftTail = new THREE.Group();
  leftTail.name = "leftTail";
  leftTail.position.set(-0.5, 0.04, -0.03);
  head.add(leftTail);
  const rightTail = new THREE.Group();
  rightTail.name = "rightTail";
  rightTail.position.set(0.5, 0.04, -0.03);
  head.add(rightTail);

  for (const [tail, side] of [
    [leftTail, -1],
    [rightTail, 1]
  ]) {
    for (let i = 0; i < 5; i += 1) {
      const offset = (i - 2) * 0.055;
      const strand = ribbonCurve(
        [
          new THREE.Vector3(0, 0.05 + offset, 0),
          new THREE.Vector3(side * (0.75 + i * 0.04), -0.38 + offset, -0.18),
          new THREE.Vector3(side * (1.05 + i * 0.05), -1.35 + offset, -0.1),
          new THREE.Vector3(side * (0.52 + i * 0.03), -2.45 + offset, 0.08)
        ],
        i % 2 ? materials.hairDark : materials.hair,
        0.038
      );
      strand.name = "hairStrand";
      tail.add(strand);
    }
  }

  const arms = {};
  const legs = {};
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? "leftShoulder" : "rightShoulder";
    shoulder.position.set(side * 0.48, 0.55, 0);
    torso.add(shoulder);

    const upperArm = makeLimb(0.72, 0.085, materials.skin);
    upperArm.rotation.z = side * 0.35;
    shoulder.add(upperArm);
    const sleeve = makeLimb(0.18, 0.11, materials.outfit);
    sleeve.rotation.z = side * 0.35;
    shoulder.add(sleeve);
    const forearm = makeLimb(0.66, 0.073, materials.skin);
    forearm.position.y = -0.72;
    upperArm.add(forearm);
    const glove = makeLimb(0.23, 0.08, materials.outfit);
    glove.position.y = -0.63;
    forearm.add(glove);
    arms[side < 0 ? "left" : "right"] = { shoulder, upperArm, forearm };

    const thigh = new THREE.Group();
    thigh.name = side < 0 ? "leftThigh" : "rightThigh";
    thigh.position.set(side * 0.38, 0.72, 0.02);
    hips.add(thigh);
    const upperLeg = makeLimb(0.82, 0.13, materials.skin);
    thigh.add(upperLeg);
    const shin = makeLimb(0.95, 0.105, materials.outfit);
    shin.position.y = -0.78;
    upperLeg.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.14, 0.48), materials.outfit);
    boot.position.set(0, -0.96, 0.1);
    shin.add(boot);
    legs[side < 0 ? "left" : "right"] = { thigh, upperLeg, shin };
  }

  root.userData.parts = {
    hips,
    torso,
    head,
    leftTail,
    rightTail,
    arms,
    legs
  };
  scene.add(root);
  return root;
}

buildStage();
buildModelPreview();
const dancer = createDancer();
activeDancer = dancer;

const lookTarget = new THREE.Vector3(0, 2.1, 0);
const orbitTarget = new THREE.Vector3();
const modelBounds = new THREE.Box3();
const modelCenter = new THREE.Vector3();
const modelSize = new THREE.Vector3();

function animateDancer(t) {
  const parts = dancer.userData.parts;
  const beat = Math.sin(t * 6.2);
  const halfBeat = Math.sin(t * 3.1);
  const quick = Math.sin(t * 12.4);

  dancer.position.y = 0.48 + Math.abs(beat) * 0.08;
  dancer.rotation.y = Math.PI + Math.sin(t * 1.15) * 0.22 + Math.sin(t * 0.47) * 0.1;

  parts.hips.rotation.z = halfBeat * 0.16;
  parts.hips.rotation.x = Math.sin(t * 3.1 + 0.8) * 0.08;
  parts.torso.rotation.z = -halfBeat * 0.14;
  parts.torso.rotation.x = Math.sin(t * 4.1) * 0.075;
  parts.head.rotation.z = Math.sin(t * 2.4 + 1.5) * 0.1;
  parts.head.rotation.y = Math.sin(t * 2.0) * 0.16;

  parts.arms.left.shoulder.rotation.set(0.16 + beat * 0.22, 0, -0.85 + halfBeat * 0.38);
  parts.arms.left.upperArm.rotation.z = -0.16 + Math.sin(t * 5.7) * 0.24;
  parts.arms.left.forearm.rotation.z = -0.4 + Math.sin(t * 6.2 + 0.6) * 0.35;

  parts.arms.right.shoulder.rotation.set(-0.18 + beat * 0.18, 0, 0.95 + halfBeat * 0.34);
  parts.arms.right.upperArm.rotation.z = 0.12 + Math.sin(t * 5.4 + 2.2) * 0.25;
  parts.arms.right.forearm.rotation.z = 0.42 + Math.sin(t * 6.1 + 1.7) * 0.32;

  parts.legs.left.thigh.rotation.x = 0.18 + Math.sin(t * 3.1) * 0.24;
  parts.legs.left.thigh.rotation.z = -0.12 + quick * 0.03;
  parts.legs.left.shin.rotation.x = -0.2 + Math.max(0, beat) * 0.18;
  parts.legs.right.thigh.rotation.x = 0.08 + Math.sin(t * 3.1 + Math.PI) * 0.2;
  parts.legs.right.thigh.rotation.z = 0.16 - quick * 0.03;
  parts.legs.right.shin.rotation.x = -0.12 + Math.max(0, -beat) * 0.2;

  parts.leftTail.rotation.z = -0.35 + Math.sin(t * 2.7 + 0.4) * 0.18;
  parts.leftTail.rotation.y = Math.sin(t * 3.4) * 0.2;
  parts.rightTail.rotation.z = 0.35 + Math.sin(t * 2.7 + 2.6) * 0.18;
  parts.rightTail.rotation.y = Math.sin(t * 3.4 + Math.PI) * 0.2;

  rimLight.intensity = 8.5 + Math.max(0, quick) * 2.4;
  magentaLight.intensity = 3.8 + Math.max(0, -quick) * 2;
  bloom.strength = 0.88 + Math.max(0, Math.sin(t * 6.2)) * 0.28;
}

function animateStage(t) {
  stage.children.forEach((child, index) => {
    if (child.geometry?.type === "TorusGeometry") {
      child.rotation.z += 0.0015 * (index % 2 ? -1 : 1);
    }
  });
  stage.rotation.y = Math.sin(t * 0.18) * 0.025;
}

function updateCamera(t) {
  if (realDancer && !drag.active && Math.abs(drag.yaw) <= 0.001 && Math.abs(drag.pitch) <= 0.001) {
    camera.position.set(0, 2.45, 6.4);
    camera.rotation.z = 0;
    camera.lookAt(0, 1.88, 0);
    return;
  }

  if (drag.active || Math.abs(drag.yaw) > 0.001 || Math.abs(drag.pitch) > 0.001) {
    const radius = realDancer ? 6.4 : 10.5;
    const yaw = drag.yaw + t * 0.08;
    const pitch = THREE.MathUtils.clamp(0.36 + drag.pitch, 0.05, realDancer ? 0.62 : 0.88);
    camera.position.set(
      Math.sin(yaw) * radius,
      1.25 + Math.sin(pitch) * (realDancer ? 3.3 : 5.6),
      Math.cos(yaw) * radius
    );
    camera.lookAt(lookTarget);
    return;
  }

  if (cameraMode === 0) {
    const narrowBoost = camera.aspect < 0.72 ? 4.2 : 0;
    const radius = 13.2 + narrowBoost + Math.sin(t * 0.85) * 1.1;
    const angle = 0.22 + t * 0.36;
    camera.position.set(
      Math.sin(angle) * radius,
      2.6 + Math.sin(t * 0.92) * 0.95,
      Math.cos(angle) * radius
    );
    orbitTarget.set(Math.sin(t * 1.3) * 0.3, 2 + Math.sin(t * 1.7) * 0.24, 0);
    camera.lookAt(orbitTarget);
  } else if (cameraMode === 1) {
    camera.position.set(Math.sin(t * 1.2) * 1.8, 2.85 + Math.sin(t * 2.1) * 0.28, 4.2);
    orbitTarget.set(Math.sin(t * 2.4) * 0.25, 2.35, -0.25);
    camera.lookAt(orbitTarget);
  } else {
    camera.position.set(-3.8 + Math.sin(t * 0.7) * 0.6, 3.9, 6.2 + Math.cos(t * 0.5) * 0.5);
    camera.rotation.z = Math.sin(t * 1.6) * 0.08;
    camera.lookAt(0, 2.4, 0);
  }
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseUnitInterval(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const normalized = String(value).toLowerCase();
  if (["true", "yes", "on"].includes(normalized)) {
    return 1;
  }
  if (["false", "no", "off"].includes(normalized)) {
    return 0;
  }

  const amount = Number(value);
  return Number.isFinite(amount)
    ? THREE.MathUtils.clamp(amount, 0, 1)
    : fallback;
}

function pickChoice(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function getModelPreviewOptions(sceneConfig) {
  const configured = sceneConfig?.modelPreview || {};
  const mode = pickChoice(
    queryParams.get("modelMode") || configured.mode || configured.modelMode,
    ["textured", "clay"],
    DEFAULT_MODEL_PREVIEW_OPTIONS.mode
  );
  const lighting = pickChoice(
    queryParams.get("modelLighting") || configured.lighting,
    ["native", "enhanced"],
    DEFAULT_MODEL_PREVIEW_OPTIONS.lighting
  );
  const materialPreset = pickChoice(
    queryParams.get("modelMaterialPreset") || configured.materialPreset,
    ["native", "video"],
    DEFAULT_MODEL_PREVIEW_OPTIONS.materialPreset
  );
  const materialBoost = parseBoolean(
    queryParams.get("materialBoost") ?? configured.materialBoost,
    DEFAULT_MODEL_PREVIEW_OPTIONS.materialBoost
  );
  const stageLighting = parseUnitInterval(
    queryParams.get("stageLighting") ?? configured.stageLighting,
    DEFAULT_MODEL_PREVIEW_OPTIONS.stageLighting
  );
  const materialBoostStrength = Number(
    queryParams.get("materialBoostStrength") ??
      configured.materialBoostStrength ??
      DEFAULT_MODEL_PREVIEW_OPTIONS.materialBoostStrength
  );
  const bloomStrength = Number(
    queryParams.get("modelBloom") ?? configured.bloomStrength ?? DEFAULT_MODEL_PREVIEW_OPTIONS.bloomStrength
  );

  return {
    mode,
    materialPreset,
    lighting,
    stageLighting,
    materialBoost,
    materialBoostStrength: Number.isFinite(materialBoostStrength)
      ? THREE.MathUtils.clamp(materialBoostStrength, 0, 1)
      : DEFAULT_MODEL_PREVIEW_OPTIONS.materialBoostStrength,
    bloomStrength: Number.isFinite(bloomStrength)
      ? THREE.MathUtils.clamp(bloomStrength, 0, 0.6)
      : DEFAULT_MODEL_PREVIEW_OPTIONS.bloomStrength
  };
}

function randomBlinkDelay() {
  return THREE.MathUtils.randFloat(2.6, 6.4);
}

function randomBlinkDuration() {
  return THREE.MathUtils.randFloat(0.12, 0.18);
}

function smoothStep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function setBlinkWeight(weight) {
  blinkController.targets.forEach((target) => {
    target.object.morphTargetInfluences[target.index] = weight;
  });
  document.documentElement.dataset.blinkWeight = weight > 0.001 ? weight.toFixed(2) : "0";
}

function scheduleNextBlink(delay = randomBlinkDelay()) {
  blinkController.nextAt = blinkController.clock + delay;
}

function startBlink() {
  blinkController.active = true;
  blinkController.time = 0;
  blinkController.duration = randomBlinkDuration();
  blinkController.doubleBlinkQueued = Math.random() < 0.12;
}

function configureBlink(mesh) {
  const targets = [];

  mesh.traverse((object) => {
    if (!object.morphTargetDictionary || !object.morphTargetInfluences) {
      return;
    }

    const morphName = BLINK_MORPH_NAMES.find(
      (name) => object.morphTargetDictionary[name] !== undefined
    );

    if (morphName) {
      targets.push({
        object,
        name: morphName,
        index: object.morphTargetDictionary[morphName]
      });
    }
  });

  blinkController.targets = targets;
  blinkController.clock = 0;
  blinkController.active = false;
  blinkController.time = 0;
  blinkController.doubleBlinkQueued = false;
  scheduleNextBlink(THREE.MathUtils.randFloat(1.2, 3.2));
  document.documentElement.dataset.blinkMorphs = targets.map((target) => target.name).join(",");
  setBlinkWeight(0);

  return targets;
}

function updateBlink(delta) {
  if (blinkController.targets.length === 0) {
    return;
  }

  blinkController.clock += delta;

  if (!blinkController.active && blinkController.clock >= blinkController.nextAt) {
    startBlink();
  }

  if (!blinkController.active) {
    return;
  }

  blinkController.time += delta;

  const closeTime = blinkController.duration * BLINK_CLOSE_RATIO;
  const holdTime = blinkController.duration * BLINK_HOLD_RATIO;
  const openStart = closeTime + holdTime;
  const openTime = Math.max(blinkController.duration - openStart, 0.001);
  let weight = 0;

  if (blinkController.time < closeTime) {
    weight = smoothStep(blinkController.time / closeTime);
  } else if (blinkController.time < openStart) {
    weight = 1;
  } else if (blinkController.time < blinkController.duration) {
    weight = 1 - smoothStep((blinkController.time - openStart) / openTime);
  } else {
    blinkController.active = false;
    weight = 0;
    scheduleNextBlink(
      blinkController.doubleBlinkQueued
        ? THREE.MathUtils.randFloat(0.14, 0.28)
        : randomBlinkDelay()
    );
    blinkController.doubleBlinkQueued = false;
  }

  setBlinkWeight(weight);
}

function includesAny(value, words) {
  return words.some((word) => value.includes(word));
}

function setMaterialColor(material, color) {
  if (material.color) {
    material.color.set(color);
  }
}

function setMaterialEmissive(material, color, intensity) {
  if (material.emissive) {
    material.emissive.set(color);
    material.emissiveIntensity = intensity;
  }
}

function applyModelPreviewLighting() {
  const enhanced = modelPreviewOptions.lighting === "enhanced";
  const previewingModel = Boolean(realDancer);
  const stageLightingAmount = previewingModel ? modelPreviewOptions.stageLighting : 1;

  stageAmbientLight.intensity = 0.85 * stageLightingAmount;
  keyLight.intensity = 2.7 * stageLightingAmount;
  modelAmbientLight.intensity = enhanced ? 1.35 : 0.35;
  modelFillLight.intensity = enhanced ? 2.1 : 0.75;
  modelSideLight.intensity = enhanced ? 5 : 0.9;
  modelHairLight.intensity = enhanced ? 1.8 : 0.45;
  rimLight.intensity = enhanced ? 2.5 : 0.7;
  magentaLight.intensity = enhanced ? 1.2 : 0.25;
  bloom.enabled = modelPreviewOptions.bloomStrength > 0;
  bloom.strength = modelPreviewOptions.bloomStrength;
}

function updateStageLightingSlider() {
  const amount = THREE.MathUtils.clamp(modelPreviewOptions.stageLighting, 0, 1);
  const label = `Stage lighting ${Math.round(amount * 100)}%`;

  stageLightingSlider.value = amount.toFixed(2);
  stageLightingSlider.setAttribute("aria-valuetext", label);
  stageLightingSlider.title = label;
  stageLightingControl.dataset.state = amount > 0 ? "active" : "";
  stageLightingControl.title = label;
  document.documentElement.dataset.stageLighting = amount.toFixed(2);
}

function setStageLighting(value) {
  modelPreviewOptions.stageLighting = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
  updateStageLightingSlider();
  applyModelPreviewLighting();
  if (window.localModelDebug) {
    window.localModelDebug.stageLighting = modelPreviewOptions.stageLighting;
  }
}

function applyVideoMaterialPreset(material) {
  const name = `${material.name || ""}`.toLowerCase();

  if (includesAny(name, ["髪", "ツインテ"])) {
    setMaterialColor(material, 0x7df6ff);
    setMaterialEmissive(material, 0x002c32, 0.08);
  } else if (includesAny(name, ["ネクタイ"])) {
    setMaterialColor(material, 0x58f2f5);
    setMaterialEmissive(material, 0x00383b, 0.08);
  } else if (includesAny(name, ["ブーツ", "アームカバー", "スカート", "スパッツ", "下着"])) {
    setMaterialColor(material, 0x32383d);
    setMaterialEmissive(material, 0x000000, 0);
  } else if (includesAny(name, ["上着", "タンクトップ"])) {
    setMaterialColor(material, 0xd8e0e2);
    setMaterialEmissive(material, 0x000000, 0);
  } else if (includesAny(name, ["頭", "顔", "体"])) {
    setMaterialColor(material, 0xffe1d4);
    setMaterialEmissive(material, 0x000000, 0);
  } else if (includesAny(name, ["白目"])) {
    setMaterialColor(material, 0xe8fbff);
  } else if (includesAny(name, ["黒目", "瞳"])) {
    setMaterialColor(material, 0x86f3ff);
    setMaterialEmissive(material, 0x001b24, 0.04);
  }
}

function frameLoadedModel(mesh) {
  mesh.updateMatrixWorld(true);
  modelBounds.setFromObject(mesh);
  modelBounds.getCenter(modelCenter);
  modelBounds.getSize(modelSize);

  const height = Math.max(modelSize.y, 0.001);
  const scale = 3.05 / height;
  mesh.scale.setScalar(scale);
  mesh.updateMatrixWorld(true);

  modelBounds.setFromObject(mesh);
  modelBounds.getCenter(modelCenter);
  modelBounds.getSize(modelSize);
  mesh.position.x -= modelCenter.x;
  mesh.position.y -= modelBounds.min.y - 0.36;
  mesh.position.z -= modelCenter.z;
  mesh.rotation.y = 0;
  mesh.updateMatrixWorld(true);

  lookTarget.set(0, 2.05, 0);
  cameraMode = 1;
  drag.yaw = 0;
  drag.pitch = 0;
}

function setModelMaterials(mesh) {
  const previewMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fdbe5,
    roughness: 0.52,
    metalness: 0.04,
    emissive: 0x051b1f,
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide
  });

  mesh.traverse((object) => {
    if (!object.isMesh) {
      return;
    }
    object.castShadow = true;
    object.frustumCulled = false;

    if (modelPreviewOptions.mode === "clay") {
      object.material = previewMaterial;
      return;
    }

    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    meshMaterials.forEach((material) => {
      material.side = THREE.DoubleSide;
      material.transparent = material.transparent || material.opacity < 1;
      material.depthWrite = material.opacity >= 1;
      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }
      if (modelPreviewOptions.materialPreset === "video") {
        applyVideoMaterialPreset(material);
      }
      if (modelPreviewOptions.materialBoost && material.color && material.emissive) {
        material.emissive.copy(material.color).multiplyScalar(
          modelPreviewOptions.materialBoostStrength * 0.15
        );
        material.emissiveIntensity = modelPreviewOptions.materialBoostStrength;
      }
      material.needsUpdate = true;
    });
  });
}

function loadConfiguredModel(state) {
  const modelAsset = state.assets.find((asset) => asset.name === "model");
  if (!modelAsset?.ok || !modelAsset.url) {
    return Promise.resolve(null);
  }

  assetStatus.dataset.state = "ready";
  assetStatus.innerHTML = `
    <span>Local model</span>
    <strong>Loading</strong>
    <small>${modelAsset.path}</small>
  `;

  const loader = new MMDLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      modelAsset.url,
      (mesh) => {
        modelPreviewOptions = getModelPreviewOptions(state.scene);
        updateStageLightingSlider();
        realDancer = mesh;
        realDancer.name = "Tsumi Miku local PMX";
        setModelMaterials(realDancer);
        frameLoadedModel(realDancer);
        const blinkTargets = configureBlink(realDancer);
        scene.add(realDancer);
        dancer.visible = false;
        stage.visible = false;
        modelPreview.visible = true;
        if (modelGuideLine) {
          modelGuideLine.visible = false;
        }
        modelAmbientLight.visible = true;
        modelFillLight.visible = true;
        modelSideLight.visible = true;
        modelHairLight.visible = true;
        scene.fog = null;
        applyModelPreviewLighting();
        activeDancer = realDancer;
        window.localModelDebug = {
          name: realDancer.name,
          bones: realDancer.skeleton?.bones?.length || 0,
          blinkMorphs: blinkTargets.map((target) => target.name),
          position: realDancer.position.toArray(),
          scale: realDancer.scale.toArray(),
          stageLighting: modelPreviewOptions.stageLighting,
          visible: realDancer.visible
        };
        resolve(realDancer);
      },
      undefined,
      reject
    );
  });
}

function render() {
  requestAnimationFrame(render);
  const delta = clock.getDelta();
  if (playing) {
    elapsed += delta;
  }
  if (!realDancer) {
    animateDancer(elapsed);
    animateStage(elapsed);
  } else {
    updateBlink(delta);
    applyModelPreviewLighting();
  }
  updateCamera(elapsed);
  composer.render();
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

togglePlay.addEventListener("click", () => {
  playing = !playing;
  togglePlay.dataset.state = playing ? "" : "paused";
  togglePlay.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
  togglePlay.title = playing ? "Pause" : "Play";
});

cameraModeButton.addEventListener("click", () => {
  cameraMode = (cameraMode + 1) % 3;
  drag.yaw = 0;
  drag.pitch = 0;
});

stageLightingSlider.addEventListener("input", (event) => {
  setStageLighting(event.currentTarget.value);
});

updateStageLightingSlider();

canvas.addEventListener("pointerdown", (event) => {
  drag.active = true;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!drag.active) {
    return;
  }
  const dx = event.clientX - drag.lastX;
  const dy = event.clientY - drag.lastY;
  drag.yaw -= dx * 0.006;
  drag.pitch += dy * 0.004;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
});

canvas.addEventListener("pointerup", (event) => {
  drag.active = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("dblclick", (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(activeDancer, true)[0];
  if (hit) {
    cameraMode = 1;
  }
});

window.addEventListener("resize", resize);

loadLocalAssetConfig()
  .then((state) => {
    localAssetState = state;
    window.localAssetState = state;
    renderAssetStatus(state, assetStatus);
    return loadConfiguredModel(state);
  })
  .then((mesh) => {
    if (!mesh) {
      return;
    }
    window.localModel = mesh;
    assetStatus.dataset.state = "ready";
    assetStatus.innerHTML = `
      <span>PMX model</span>
      <strong>${modelPreviewOptions.mode === "clay" ? "Clay" : "Textured"} T-pose</strong>
      <small>${modelPreviewOptions.materialPreset} · ${modelPreviewOptions.lighting}${modelPreviewOptions.materialBoost ? ` + boost ${modelPreviewOptions.materialBoostStrength}` : ""} · bloom ${modelPreviewOptions.bloomStrength} · ${mesh.skeleton?.bones?.length || 0} bones</small>
    `;
  })
  .catch((error) => {
    assetStatus.dataset.state = "warning";
    assetStatus.innerHTML = `
      <span>Local assets</span>
      <strong>0/0</strong>
      <small>${error instanceof Error ? error.message : "Config unavailable"}</small>
    `;
  });

render();
