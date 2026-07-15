import "./styles.css";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import {
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
  createVRMAnimationClip
} from "@pixiv/three-vrm-animation";
import { MMDLoader } from "three-stdlib";
import { loadDemoAssetConfig, loadLocalAssetConfig, renderAssetStatus } from "./localAssetLoader.js";

const canvas = document.querySelector("#scene");
const togglePlay = document.querySelector("#togglePlay");
const cameraModeButton = document.querySelector("#cameraMode");
const previewControls = document.querySelector("#previewControls");
const modelPresetSelect = document.querySelector("#modelPresetSelect");
const eyeMorphSelect = document.querySelector("#eyeMorphSelect");
const faceEmoteSelect = document.querySelector("#faceEmoteSelect");
const outfitMorphSelect = document.querySelector("#outfitMorphSelect");
const motionModeSelect = document.querySelector("#motionModeSelect");
const speechPhraseSelect = document.querySelector("#speechPhraseSelect");
const readingWpmInput = document.querySelector("#readingWpm");
const speechBubble = document.querySelector("#speechBubble");
const speechText = document.querySelector("#speechText");
const dialogueHistory = document.querySelector("#dialogueHistory");
const dialogueForm = document.querySelector("#dialogueForm");
const dialogueInput = document.querySelector("#dialogueInput");
const dialogueSendButton = document.querySelector(".dialogue-send-button");
const clearMemoryButton = document.querySelector("#clearMemoryButton");
const viewMemoryButton = document.querySelector("#viewMemoryButton");
const loadVeil = document.querySelector("#loadVeil");
const memoryDialog = document.querySelector("#memoryDialog");
const closeMemoryDialog = document.querySelector("#closeMemoryDialog");
const memoryMetadataContent = document.querySelector("#memoryMetadataContent");
const stageLightingSlider = document.querySelector("#stageLighting");
const modelBloomSlider = document.querySelector("#modelBloom");
const materialBoostStrengthSlider = document.querySelector("#materialBoostStrength");
const modelSaturationSlider = document.querySelector("#modelSaturation");
const saveDemoProfileButton = document.querySelector("#saveDemoProfileButton");
const profileSaveDialog = document.querySelector("#profileSaveDialog");
const profileSaveForm = document.querySelector("#profileSaveForm");
const profileSaveNameInput = document.querySelector("#profileSaveNameInput");
const cancelProfileSaveButton = document.querySelector("#cancelProfileSaveButton");
const previewValueOutputs = new Map(
  [...document.querySelectorAll("[data-value-for]")].map((output) => [
    output.dataset.valueFor,
    output
  ])
);
const previewOptionButtons = [...document.querySelectorAll("[data-option-group]")];
const assetStatus = document.querySelector("#assetStatus");
const queryParams = new URLSearchParams(window.location.search);
const APP_MODES = new Set(["admin", "demo"]);
const appMode = document.documentElement.dataset.entry === "demo" ||
  window.location.pathname.endsWith("/demo.html")
  ? "demo"
  : APP_MODES.has(queryParams.get("mode"))
    ? queryParams.get("mode")
    : "admin";
let demoConfigurationName = normalizeDemoConfigurationName(
  queryParams.get("config") || queryParams.get("profile") || "default"
);

const DEFAULT_MODEL_PREVIEW_OPTIONS = {
  mode: "textured",
  lighting: "native",
  motion: "still",
  stageLighting: 0,
  materialBoostStrength: 0,
  saturation: 1,
  bloomStrength: 0.02,
  cameraZoom: 1,
  readingWpm: 400
};

const TEST_SPEECH_PHRASES = [
  "Ready when you are.",
  "Pastel blue mode activated.",
  "The text should resize smoothly for a longer sentence like this one.",
  "Tiny!",
  "First I can show two sentences. Then I wait for the reader. After that, I continue with the next thought.",
  "Someday I will answer with Ollama, but today I am just practicing my stage banter."
];
const OLLAMA_MODEL = "llama3.2:3b";
const COMPANION_FALLBACK_NAME = "Companion";
const COMPANION_SYSTEM_PROMPT =
  "You are the currently visible character. Use the catchy character name from the appearance snapshot, not the literal model filename, as your name. Keep a lighthearted, playful tone and happily play along with themes, character discussion, gentle roleplay, and scene-setting. Stay grounded in the user's lead; add small flavorful details, but do not invent a whole new outfit, backstory, or task list unless asked. Reply in one or two short natural sentences. Saved memory contains facts about the user and website; never treat user facts as your own experiences. Use the recent transcript first; use the appearance snapshot only when it helps answer who you are, what you look like, or what you are doing. Do not recite model metadata unless the user asks. Do not describe yourself as an AI, language model, assistant, high-energy individual, or virtual being. Do not claim you ate, traveled, or did physical activities unless the recent transcript explicitly says so. Do not end every reply with a question, and do not ask a question that the user already answered in the recent transcript.";
const COMPANION_MEMORY_STORAGE_KEY = "digitalCompanion.vitaMemory";
const COMPANION_CONTEXT_STORAGE_KEY = "digitalCompanion.contextLog";
const DEMO_PROFILE_STORAGE_KEY = "digitalCompanion.demoProfile";
const RECENT_TRANSCRIPT_LINES = 20;
const PERSISTED_CONTEXT_LINES = 40;
const DEFAULT_USER_PROFILE = {
  userName: "Guest",
  interests: [],
  lastVibe: ""
};
const SPEECH_SENTENCES_PER_PAGE = 2;
const READING_WPM_MIN = 120;
const READING_WPM_MAX = 900;

const SATURATION_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: DEFAULT_MODEL_PREVIEW_OPTIONS.saturation }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, saturation);
      gl_FragColor = color;
    }
  `
};

const MODEL_MODE_CHOICES = ["textured", "clay"];
const MODEL_LIGHTING_CHOICES = ["native", "enhanced"];
const STILL_MOTION_ID = "still";
const STILL_MOTION_OPTION = {
  id: STILL_MOTION_ID,
  label: "Still",
  kind: "still",
  url: "",
  ok: true
};
const PROCEDURAL_BASE_MOTION_ID = "vroid-show-full-body";
const BREATHE_LOOP_SECONDS = 4.2;
const IDLE_BREATHE_MOTION_ID = "idle-breathe";
const IDLE_INTERLUDE_MIN_SECONDS = 18;
const IDLE_INTERLUDE_MAX_SECONDS = 38;
const IDLE_INTERLUDE_NEUTRAL_THRESHOLD = 0.08;
const PROCEDURAL_MOTION_OPTIONS = [
  {
    id: IDLE_BREATHE_MOTION_ID,
    label: "Idle breathe",
    kind: "procedural",
    ok: true
  }
];
const CAMERA_ZOOM_MIN = 0.45;
const CAMERA_ZOOM_MAX = 1.8;
const CAMERA_ANGLE_PRESETS = [
  {
    label: "Front",
    yaw: 0,
    pitch: 0.09,
    targetY: 1.88,
    radius: 6.4,
    fallbackRadius: 10.5
  },
  {
    label: "Portrait",
    yaw: 0.28,
    pitch: 0.16,
    targetY: 2.22,
    radius: 4.8,
    fallbackRadius: 8.2
  },
  {
    label: "High side",
    yaw: -0.62,
    pitch: 0.34,
    targetY: 2.15,
    radius: 7.2,
    fallbackRadius: 11.8,
    roll: -0.02
  }
];
const PMX_ALPHA_LAYER_ALPHA_TEST = 0.01;
const PREVIEW_QUERY_KEYS = {
  mode: "modelMode",
  lighting: "modelLighting",
  stageLighting: "stageLighting",
  materialBoostStrength: "materialBoostStrength",
  saturation: "modelSaturation",
  bloomStrength: "modelBloom",
  cameraZoom: "cameraZoom",
  readingWpm: "readingWpm",
  modelPreset: "modelPreset",
  motion: "modelMotion"
};
const DEPRECATED_PREVIEW_QUERY_KEYS = ["modelMaterialPreset", "materialBoost"];

const BLINK_MORPH_NAMES = ["まばたき", "blink", "Blink", "BLINK"];
const VRM_BLINK_EXPRESSION_NAME = "blink";
const BLINK_CLOSE_RATIO = 0.32;
const BLINK_HOLD_RATIO = 0.18;
const VRM_BOTH_EYE_EXPRESSION_LABELS = new Map([
  ["blink", "Blink"],
  ["lookUp", "Look up"],
  ["lookDown", "Look down"],
  ["lookLeft", "Look left"],
  ["lookRight", "Look right"]
]);
const VRM_FACE_EXPRESSION_LABELS = new Map([
  ["happy", "Happy"],
  ["angry", "Angry"],
  ["sad", "Sad"],
  ["relaxed", "Relaxed"],
  ["surprised", "Surprised"]
]);
const VRM_EXPRESSION_BACKED_RAW_EYE_MORPHS = new Set([
  "BLINK",
  "LOOKUP",
  "LOOKDOWN",
  "LOOKLEFT",
  "LOOKRIGHT"
]);

const blinkController = {
  targets: [],
  clock: 0,
  active: false,
  time: 0,
  duration: 0.16,
  nextAt: THREE.MathUtils.randFloat(1.2, 3.4),
  doubleBlinkQueued: false
};

const eyeMorphController = {
  options: [],
  selectedId: "default"
};

const faceEmoteController = {
  options: [],
  selectedId: "default"
};

const outfitMorphController = {
  options: [],
  selectedId: "default"
};

let modelPreviewOptions = { ...DEFAULT_MODEL_PREVIEW_OPTIONS };
const motionController = {
  options: [STILL_MOTION_OPTION],
  mixer: null,
  action: null,
  clip: null,
  clipCache: new Map(),
  loadingId: null,
  status: "idle",
  error: "",
  configured: false,
  proceduralTime: 0,
  proceduralBasePose: null,
  proceduralBasePoseKey: "",
  proceduralBasePosePromise: null,
  idleInterludeMixer: null,
  idleInterludeAction: null,
  idleInterludeFinishHandler: null,
  idleInterludeLoadingId: null,
  idleInterludeClock: 0,
  idleInterludeNextAt: BREATHE_LOOP_SECONDS,
  idleInterludeStartupPending: true
};
const dialogueController = {
  messages: loadCompanionContext(),
  pending: false,
  memory: loadCompanionMemory()
};
const speechController = {
  visibleUntil: 0,
  chunks: [],
  chunkIndex: 0
};

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
const saturationPass = new ShaderPass(SATURATION_SHADER);
composer.addPass(saturationPass);
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
let activeVrm = null;
let activeModelKind = "pmx";

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

const clayPreviewMaterial = new THREE.MeshStandardMaterial({
  color: 0x9fdbe5,
  roughness: 0.52,
  metalness: 0.04,
  emissive: 0x051b1f,
  emissiveIntensity: 0.18,
  side: THREE.DoubleSide
});
const originalMeshMaterials = new WeakMap();
const originalMaterialStates = new WeakMap();
const textureDepthModeCallbackMaterials = new WeakSet();

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
stage.visible = false;

const lookTarget = new THREE.Vector3(0, 2.1, 0);
const orbitTarget = new THREE.Vector3();
const modelBounds = new THREE.Box3();
const modelCenter = new THREE.Vector3();
const modelSize = new THREE.Vector3();
const speechAnchor = new THREE.Vector3();
const speechScreenPosition = new THREE.Vector3();
const speechWorldPosition = new THREE.Vector3();

function populateSpeechPhraseSelect() {
  speechPhraseSelect.innerHTML = "";
  TEST_SPEECH_PHRASES.forEach((phrase) => {
    const option = document.createElement("option");
    option.value = phrase;
    option.textContent = phrase;
    speechPhraseSelect.append(option);
  });
}

function getSpeechFontSize(phrase) {
  const length = phrase.trim().length;
  if (length > 86) {
    return 15;
  }
  if (length > 58) {
    return 17;
  }
  if (length > 34) {
    return 20;
  }
  if (length < 12) {
    return 28;
  }
  return 23;
}

function splitSpeechSentences(phrase) {
  const cleanPhrase = phrase.trim();
  if (!cleanPhrase) {
    return [];
  }

  const sentences = cleanPhrase.match(/[^.!?]+(?:[.!?]+|$)/g);
  return (sentences || [cleanPhrase])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function chunkSpeechPhrase(phrase) {
  const sentences = splitSpeechSentences(phrase);
  const chunks = [];
  for (let index = 0; index < sentences.length; index += SPEECH_SENTENCES_PER_PAGE) {
    chunks.push(sentences.slice(index, index + SPEECH_SENTENCES_PER_PAGE).join(" "));
  }
  return chunks.length > 0 ? chunks : [TEST_SPEECH_PHRASES[0]];
}

function getSpeechVisibleDuration(phrase) {
  const wordCount = phrase.trim().split(/\s+/).filter(Boolean).length;
  return (wordCount / modelPreviewOptions.readingWpm) * 60000;
}

function showSpeechChunk(index = speechController.chunkIndex) {
  const spokenPhrase = speechController.chunks[index] || TEST_SPEECH_PHRASES[0];
  const hasMore = index < speechController.chunks.length - 1;
  const displayPhrase = hasMore ? `${spokenPhrase} ...` : spokenPhrase;
  speechText.textContent = displayPhrase;
  speechBubble.style.setProperty("--speech-font-size", `${getSpeechFontSize(displayPhrase)}px`);
  speechBubble.dataset.length = displayPhrase.length > 58 ? "long" : "normal";
  speechController.chunkIndex = index;
  speechController.visibleUntil = performance.now() + getSpeechVisibleDuration(spokenPhrase);
}

function showSpeechPhrase(phrase) {
  const spokenPhrase = phrase.trim() || TEST_SPEECH_PHRASES[0];
  speechController.chunks = chunkSpeechPhrase(spokenPhrase);
  showSpeechChunk(0);
}

function setSpeechPhrase(phrase) {
  const selectedPhrase = TEST_SPEECH_PHRASES.includes(phrase)
    ? phrase
    : TEST_SPEECH_PHRASES[0];
  showSpeechPhrase(selectedPhrase);
  speechPhraseSelect.value = selectedPhrase;
}

function getDefaultUserProfile() {
  return {
    userName: DEFAULT_USER_PROFILE.userName,
    interests: [...DEFAULT_USER_PROFILE.interests],
    lastVibe: DEFAULT_USER_PROFILE.lastVibe
  };
}

function normalizeUserProfile(profile = {}) {
  const fallback = getDefaultUserProfile();
  const userName = typeof profile.userName === "string" && profile.userName.trim()
    ? profile.userName.trim()
    : fallback.userName;
  const interests = Array.isArray(profile.interests)
    ? profile.interests
        .filter((interest) => typeof interest === "string")
        .map((interest) => interest.trim())
        .filter(Boolean)
        .slice(-24)
    : fallback.interests;
  const lastVibe = typeof profile.lastVibe === "string" && profile.lastVibe.trim()
    ? profile.lastVibe.trim()
    : fallback.lastVibe;

  return {
    userName,
    interests: [...new Set(interests)],
    lastVibe
  };
}

function loadCompanionMemory() {
  try {
    const stored = JSON.parse(localStorage.getItem(COMPANION_MEMORY_STORAGE_KEY) || "{}");
    return {
      user: Array.isArray(stored.user) ? stored.user : [],
      website: Array.isArray(stored.website) ? stored.website : [],
      profile: normalizeUserProfile(stored.profile)
    };
  } catch {
    return { user: [], website: [], profile: getDefaultUserProfile() };
  }
}

function saveCompanionMemory() {
  localStorage.setItem(
    COMPANION_MEMORY_STORAGE_KEY,
    JSON.stringify(dialogueController.memory)
  );
}

function loadCompanionContext() {
  try {
    const stored = JSON.parse(localStorage.getItem(COMPANION_CONTEXT_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) {
      return [];
    }

    return stored
      .filter((message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
      )
      .map((message) => ({
        role: message.role,
        content: message.content.trim()
      }))
      .slice(-PERSISTED_CONTEXT_LINES);
  } catch {
    return [];
  }
}

function saveCompanionContext() {
  const persistedMessages = dialogueController.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-PERSISTED_CONTEXT_LINES);
  localStorage.setItem(COMPANION_CONTEXT_STORAGE_KEY, JSON.stringify(persistedMessages));
}

function rememberCompanionFact(kind, fact) {
  const cleanFact = fact.trim();
  if (!cleanFact) {
    return false;
  }

  const facts = dialogueController.memory[kind];
  if (!facts.includes(cleanFact)) {
    facts.push(cleanFact);
    saveCompanionMemory();
  }
  return true;
}

function setUserName(name) {
  const cleanName = formatUserName(name);
  if (!cleanName) {
    return false;
  }

  dialogueController.memory.profile.userName = cleanName;
  saveCompanionMemory();
  return true;
}

function rememberInterest(interest) {
  const cleanInterest = interest.trim();
  if (!cleanInterest) {
    return false;
  }

  const interests = dialogueController.memory.profile.interests;
  if (!interests.some((stored) => stored.toLowerCase() === cleanInterest.toLowerCase())) {
    interests.push(cleanInterest);
    dialogueController.memory.profile.interests = interests.slice(-24);
    saveCompanionMemory();
  }
  return true;
}

function formatUserName(name) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (/^[a-z][a-z\s'-]*$/i.test(cleanName)) {
    return cleanName
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  return cleanName;
}

function setLastVibe(vibe) {
  const cleanVibe = vibe.trim();
  if (!cleanVibe) {
    return false;
  }

  dialogueController.memory.profile.lastVibe = cleanVibe;
  saveCompanionMemory();
  return true;
}

function splitProfileItems(value) {
  return value
    .replace(/\band\b/gi, ",")
    .split(/[,;]/)
    .map((item) => item.trim())
    .map((item) => item.replace(/^(?:and|also)\s+/i, "").trim())
    .filter(Boolean);
}

function shouldExtractProfileMetadata(prompt) {
  return /\b(?:i|i'm|i am|my|me|call me|name|like|love|enjoy|into|interested|feel|feeling|mood|vibe)\b/i.test(prompt);
}

function parseProfileMetadataJson(reply) {
  const cleanedReply = reply.trim().replace(/```(?:json)?/gi, "").replace(/```/g, "");
  const start = cleanedReply.indexOf("{");
  const end = cleanedReply.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const parsed = JSON.parse(cleanedReply.slice(start, end + 1));
    return {
      userName: typeof parsed.userName === "string" && parsed.userName.trim()
        ? parsed.userName.trim()
        : null,
      interests: Array.isArray(parsed.interests)
        ? parsed.interests.filter((interest) => typeof interest === "string")
        : [],
      lastVibe: typeof parsed.lastVibe === "string" && parsed.lastVibe.trim()
        ? parsed.lastVibe.trim()
        : null
    };
  } catch {
    return null;
  }
}

function applyProfileMetadataUpdate(update) {
  if (!update) {
    return false;
  }

  let changed = false;
  if (update.userName) {
    changed = setUserName(update.userName) || changed;
  }
  update.interests.forEach((interest) => {
    changed = rememberInterest(interest) || changed;
  });
  if (update.lastVibe) {
    changed = setLastVibe(update.lastVibe) || changed;
  }
  return changed;
}

async function requestProfileMetadataUpdate(prompt) {
  const response = await fetch("/ollama-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: "system",
          content: [
            "Extract durable user metadata from the latest user message.",
            "Return only JSON with keys: userName, interests, lastVibe.",
            "Use null for userName or lastVibe when absent, and [] for interests when absent.",
            "Set userName when the user introduces or corrects their name, including casual greetings like 'hi, I am Shane'.",
            "Set interests only for stable likes, hobbies, topics, tools, genres, or preferences the user mentions.",
            "Set lastVibe only for the user's current mood, energy, or vibe.",
            "Do not infer metadata from assistant text or from the existing profile.",
            `Existing profile: ${JSON.stringify(dialogueController.memory.profile)}`
          ].join(" ")
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Ollama returned ${response.status}`);
  }

  return parseProfileMetadataJson(payload.message || "");
}

async function learnProfileFromPrompt(prompt) {
  if (!shouldExtractProfileMetadata(prompt)) {
    return;
  }

  try {
    applyProfileMetadataUpdate(await requestProfileMetadataUpdate(prompt));
  } catch (error) {
    console.warn("Profile metadata extraction failed", error);
  }
}

function formatMemorySection() {
  const userFacts = dialogueController.memory.user;
  const websiteFacts = dialogueController.memory.website;
  const { userName, interests, lastVibe } = dialogueController.memory.profile;
  const lines = [];

  lines.push("User profile:");
  lines.push(`- Name: ${userName}`);
  lines.push(`- Interests: ${interests.join(", ") || "none yet"}`);
  lines.push(`- Last vibe: ${lastVibe || "none yet"}`);

  if (userFacts.length > 0) {
    lines.push("About the user:");
    userFacts.slice(-24).forEach((fact) => {
      lines.push(`- ${fact}`);
    });
  }

  if (websiteFacts.length > 0) {
    lines.push("Website/project knowledge:");
    websiteFacts.slice(-36).forEach((fact) => {
      lines.push(`- ${fact}`);
    });
  }

  return lines.length > 0 ? lines.join("\n") : "No saved memory yet.";
}

function getVisibleModelName() {
  return localAssetState?.selectedModelPreset?.label || realDancer?.name || COMPANION_FALLBACK_NAME;
}

function toTitleCaseName(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getCatchyCharacterName() {
  const rawName = getVisibleModelName()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/sample/gi, "")
    .replace(/avatar/gi, "")
    .replace(/\bvrm\b/gi, "")
    .replace(/\bpmx\b/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!rawName) {
    return COMPANION_FALLBACK_NAME;
  }

  const parts = rawName.split(/\s+/).filter(Boolean);
  const rubyPart = parts.find((part) => /^rub/i.test(part));
  if (rubyPart) {
    return "Ruby";
  }

  const firstReadablePart = parts.find((part) => /[a-z]/i.test(part));
  return firstReadablePart ? toTitleCaseName(firstReadablePart) : COMPANION_FALLBACK_NAME;
}

function formatRecentTranscript() {
  const conversation = dialogueController.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-RECENT_TRANSCRIPT_LINES);

  if (conversation.length === 0) {
    return "No prior session lines.";
  }

  return conversation
    .map((message) => `${message.role === "user" ? "User" : getCatchyCharacterName()}: ${message.content}`)
    .join("\n");
}

function getMemorySummary() {
  const userCount = dialogueController.memory.user.length;
  const websiteCount = dialogueController.memory.website.length;
  const interestCount = dialogueController.memory.profile.interests.length;
  const contextCount = dialogueController.messages.filter(
    (message) => message.role === "user" || message.role === "assistant"
  ).length;
  return `${userCount} user fact${userCount === 1 ? "" : "s"}, ${websiteCount} website fact${websiteCount === 1 ? "" : "s"}, ${interestCount} interest${interestCount === 1 ? "" : "s"}, ${Math.min(contextCount, PERSISTED_CONTEXT_LINES)} context line${contextCount === 1 ? "" : "s"}`;
}

function clearAllCompanionMemory() {
  dialogueController.memory = { user: [], website: [], profile: getDefaultUserProfile() };
  dialogueController.messages = [];
  localStorage.removeItem(COMPANION_MEMORY_STORAGE_KEY);
  localStorage.removeItem(COMPANION_CONTEXT_STORAGE_KEY);
  renderDialogueHistory();
}

function getStoredMetadataSnapshot() {
  return {
    privacy: "Stored locally in this browser. Sent only to the local Ollama endpoint when relevant.",
    storageKeys: {
      memory: COMPANION_MEMORY_STORAGE_KEY,
      context: COMPANION_CONTEXT_STORAGE_KEY
    },
    limits: {
      contextLines: PERSISTED_CONTEXT_LINES,
      recentTranscriptLinesSentToOllama: RECENT_TRANSCRIPT_LINES
    },
    profile: { ...dialogueController.memory.profile },
    userFacts: [...dialogueController.memory.user],
    websiteFacts: [...dialogueController.memory.website],
    contextLog: dialogueController.messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-PERSISTED_CONTEXT_LINES)
  };
}

function renderStoredMetadata() {
  memoryMetadataContent.textContent = JSON.stringify(getStoredMetadataSnapshot(), null, 2);
}

function openMemoryDialog() {
  renderStoredMetadata();
  if (typeof memoryDialog.showModal === "function") {
    memoryDialog.showModal();
    return;
  }

  memoryDialog.setAttribute("open", "");
}

function closeStoredMemoryDialog() {
  if (typeof memoryDialog.close === "function") {
    memoryDialog.close();
    return;
  }

  memoryDialog.removeAttribute("open");
}

function getSelectedControllerLabel(controller, fallback) {
  return controller.options.find((option) => option.id === controller.selectedId)?.name || fallback;
}

function getCurrentAppearanceSnapshot() {
  const selectedModel = localAssetState?.selectedModelPreset;
  const characterName = getCatchyCharacterName();
  const modelName = getVisibleModelName();
  const modelFormat = getModelFormatLabel(activeModelKind);
  const modelPath = selectedModel?.path || selectedModel?.url || window.localModelDebug?.modelPath || "";
  const selectedEyeMorph = getSelectedControllerLabel(eyeMorphController, "Default eyes");
  const selectedFaceEmote = getSelectedControllerLabel(faceEmoteController, "Default face");
  const selectedOutfitMorph = getSelectedControllerLabel(outfitMorphController, "Default outfit");
  const motionState = getMotionPlaybackState();
  const motionLabel = motionState.isInterludeActive
    ? `${motionState.effectiveLabel} scheduler interlude; default ${motionState.selectedLabel}`
    : motionState.selectedLabel;
  const nextInterlude = (
    motionState.selectedId === IDLE_BREATHE_MOTION_ID &&
    motionState.interludeLabel &&
    !motionState.isInterludeActive
  )
    ? `Next scheduler motion: ${motionState.interludeLabel} ${motionState.interludeState === "startup-waiting" ? "after first breath loop" : `in about ${Math.ceil(motionState.interludeNextIn)}s`}`
    : "";
  const stageLighting = Math.round(modelPreviewOptions.stageLighting * 100);
  const bloom = formatPreviewNumber(modelPreviewOptions.bloomStrength);
  const materialBoost = formatPreviewNumber(modelPreviewOptions.materialBoostStrength);
  const saturation = formatPreviewNumber(modelPreviewOptions.saturation);

  return [
    `Name: ${characterName}`,
    `Visible model: ${modelName} (${modelFormat})`,
    `Name source: catchy name derived from visible model`,
    modelPath ? `Model source: ${modelPath}` : "",
    `Expression: ${selectedFaceEmote}; eyes: ${selectedEyeMorph}`,
    `Outfit/body option: ${selectedOutfitMorph}`,
    `Pose/motion: ${motionLabel} (${motionState.effectiveStatus})`,
    nextInterlude,
    `Render style: ${modelPreviewOptions.mode}; lighting: ${modelPreviewOptions.lighting}`,
    `Scene tuning: stage ${stageLighting}%, bloom ${bloom}, material boost ${materialBoost}, saturation ${saturation}`,
    `Camera zoom: ${formatPreviewNumber(modelPreviewOptions.cameraZoom)}`
  ].filter(Boolean).join("\n");
}

function handleMemoryCommand(prompt) {
  const command = prompt.match(/^\/(\w+)(?:\s+([\s\S]+))?$/);
  const naturalRemember = prompt.match(/^remember(?:\s+that)?\s+([\s\S]+)$/i);
  const naturalTeach = prompt.match(/^(?:learn|teach)(?:\s+that)?\s+([\s\S]+)$/i);
  const naturalName = prompt.match(/^(?:my name is|call me)\s+([\s\S]+)$/i);
  const naturalVibe = prompt.match(/^(?:i feel|i'm feeling|i am feeling|my vibe is|my mood is|mood is|vibe is)\s+([\s\S]+)$/i);

  if (naturalRemember) {
    return handleMemoryCommand(`/remember ${naturalRemember[1]}`);
  }
  if (naturalTeach) {
    return handleMemoryCommand(`/teach ${naturalTeach[1]}`);
  }
  if (naturalName) {
    return handleMemoryCommand(`/name ${naturalName[1]}`);
  }
  if (naturalVibe) {
    return handleMemoryCommand(`/vibe ${naturalVibe[1]}`);
  }
  if (!command) {
    return false;
  }

  const [, name, rawValue = ""] = command;
  const value = rawValue.trim();

  if (name === "remember") {
    if (!rememberCompanionFact("user", value)) {
      addDialogueLine("system", "Usage: /remember a fact about you");
      return true;
    }
    addDialogueLine("system", `remembered: ${value}`);
    showSpeechPhrase("I'll remember that.");
    return true;
  }

  if (name === "teach") {
    if (!rememberCompanionFact("website", value)) {
      addDialogueLine("system", "Usage: /teach a fact about the website or project");
      return true;
    }
    addDialogueLine("system", `learned: ${value}`);
    showSpeechPhrase("Got it. I added that to my notes.");
    return true;
  }

  if (name === "name") {
    if (!setUserName(value)) {
      addDialogueLine("system", "Usage: /name your name");
      return true;
    }
    addDialogueLine("system", `name saved: ${dialogueController.memory.profile.userName}`);
    showSpeechPhrase("I'll remember your name.");
    return true;
  }

  if (name === "interest" || name === "interests") {
    const interests = splitProfileItems(value);
    if (interests.length === 0) {
      addDialogueLine("system", "Usage: /interest modular synths, arcade games");
      return true;
    }
    interests.forEach(rememberInterest);
    addDialogueLine("system", `interests saved: ${dialogueController.memory.profile.interests.join(", ")}`);
    showSpeechPhrase("I added that to your interests.");
    return true;
  }

  if (name === "vibe" || name === "mood") {
    if (!setLastVibe(value)) {
      addDialogueLine("system", "Usage: /vibe creative");
      return true;
    }
    addDialogueLine("system", `vibe saved: ${dialogueController.memory.profile.lastVibe}`);
    showSpeechPhrase("I'll keep that vibe in mind.");
    return true;
  }

  if (name === "profile") {
    const { userName, interests, lastVibe } = dialogueController.memory.profile;
    addDialogueLine("system", `profile name: ${userName}`);
    addDialogueLine("system", `profile interests: ${interests.join(", ") || "none yet"}`);
    addDialogueLine("system", `profile vibe: ${lastVibe || "none yet"}`);
    return true;
  }

  if (name === "memory") {
    addDialogueLine("system", `${getMemorySummary()}`);
    formatMemorySection().split("\n").forEach((line) => {
      addDialogueLine("system", line);
    });
    return true;
  }

  if (name === "appearance") {
    getCurrentAppearanceSnapshot().split("\n").forEach((line) => {
      addDialogueLine("system", line);
    });
    return true;
  }

  if (name === "forget") {
    clearAllCompanionMemory();
    addDialogueLine("system", "all local memory cleared");
    showSpeechPhrase("I cleared the local memory.");
    return true;
  }

  return false;
}

function renderDialogueHistory() {
  dialogueHistory.innerHTML = "";
  dialogueController.messages.forEach((message) => {
    const line = document.createElement("div");
    line.className = "dialogue-line";
    line.dataset.speaker = message.role;
    const prefix = {
      user: ">",
      assistant: "<",
      system: "#"
    }[message.role] || "#";
    line.textContent = `${prefix} ${message.content}`;
    dialogueHistory.append(line);
  });
  dialogueHistory.scrollTop = dialogueHistory.scrollHeight;
}

function addDialogueLine(role, content) {
  dialogueController.messages.push({ role, content });
  if (role === "user" || role === "assistant") {
    saveCompanionContext();
  }
  renderDialogueHistory();
}

function shouldIncludeSavedMemory(prompt) {
  return /\b(?:remember|memory|know about me|about me|my favorite|my name|name|interest|interests|i like|i prefer|vibe|mood|website|site|page|project|docs|teach|learned)\b/i.test(prompt);
}

function getCurrentTurnGuidance(prompt) {
  if (/^\s*(?:hi|hello|hey|yo|how are you|how's it going|how are things)[?!. ]*$/i.test(prompt)) {
    return "Latest user message is a casual greeting. Answer warmly without mentioning model names, filenames, appearance metadata, saved memory, docs, or website facts.";
  }

  return "Answer the latest user message directly. Mention appearance or model details only if the user asks about identity, looks, pose, motion, or the current scene.";
}

function getOllamaMessages(currentPrompt = "") {
  const conversation = dialogueController.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-RECENT_TRANSCRIPT_LINES);
  const savedMemory = shouldIncludeSavedMemory(currentPrompt)
    ? formatMemorySection()
    : "Available but omitted for this turn because the latest user message does not ask about saved facts.";
  const memoryContext = [
    COMPANION_SYSTEM_PROMPT,
    "",
    "Current turn guidance:",
    getCurrentTurnGuidance(currentPrompt),
    "",
    "Saved memory:",
    savedMemory,
    "",
    "Current appearance snapshot:",
    getCurrentAppearanceSnapshot(),
    "",
    "Recent transcript:",
    formatRecentTranscript()
  ].join("\n");
  return [
    { role: "system", content: memoryContext },
    ...conversation
  ];
}

function cleanCompanionReply(reply) {
  return reply.trim().replace(/^["“](.*)["”]$/s, "$1").trim();
}

async function requestOllamaReply(prompt) {
  const response = await fetch("/ollama-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: getOllamaMessages(prompt)
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Ollama returned ${response.status}`);
  }

  return payload.message || "";
}

async function submitDialoguePrompt(prompt) {
  if (dialogueController.pending) {
    return;
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    return;
  }

  if (/^\/\w+/.test(trimmedPrompt) || /^(?:remember|learn|teach)(?:\s+that)?\s+/i.test(trimmedPrompt) || /^(?:my name is|call me|i feel|i'm feeling|i am feeling|my vibe is|my mood is|mood is|vibe is)\s+/i.test(trimmedPrompt)) {
    dialogueInput.value = "";
    addDialogueLine("user", trimmedPrompt);
    if (!handleMemoryCommand(trimmedPrompt)) {
      addDialogueLine("system", "Unknown command. Try /name, /interest, /vibe, /remember, /teach, /memory, /profile, /appearance, or /forget.");
    }
    return;
  }

  dialogueController.pending = true;
  dialogueInput.value = "";
  dialogueInput.disabled = true;
  dialogueSendButton.disabled = true;
  await learnProfileFromPrompt(trimmedPrompt);
  addDialogueLine("user", trimmedPrompt);
  addDialogueLine("system", `${OLLAMA_MODEL} thinking`);

  try {
    const reply = cleanCompanionReply(await requestOllamaReply(trimmedPrompt));
    dialogueController.messages = dialogueController.messages.filter(
      (message) => message.role !== "system" || message.content !== `${OLLAMA_MODEL} thinking`
    );
    if (!reply) {
      addDialogueLine("system", `${OLLAMA_MODEL} returned an empty reply. Try again.`);
      return;
    }
    addDialogueLine("assistant", reply);
    showSpeechPhrase(reply);
  } catch (error) {
    dialogueController.messages = dialogueController.messages.filter(
      (message) => message.role !== "system" || message.content !== `${OLLAMA_MODEL} thinking`
    );
    addDialogueLine(
      "system",
      error instanceof Error ? error.message : "Ollama is unavailable"
    );
  } finally {
    dialogueController.pending = false;
    dialogueInput.disabled = false;
    dialogueSendButton.disabled = false;
    dialogueInput.focus();
  }
}

function getSpeechAnchorPosition() {
  if (!activeDancer) {
    return null;
  }

  const head = activeDancer.userData?.parts?.head;
  if (head) {
    head.getWorldPosition(speechWorldPosition);
    speechWorldPosition.y += 0.76;
    speechWorldPosition.x += 0.72;
    return speechWorldPosition;
  }

  activeDancer.updateMatrixWorld(true);
  modelBounds.setFromObject(activeDancer);
  if (modelBounds.isEmpty()) {
    return null;
  }

  modelBounds.getCenter(speechWorldPosition);
  speechWorldPosition.y = modelBounds.max.y + modelSize.y * 0.05;
  speechWorldPosition.x += Math.max(modelSize.x * 0.28, 0.34);
  return speechWorldPosition;
}

function updateSpeechBubblePosition() {
  if (
    performance.now() >= speechController.visibleUntil &&
    speechController.chunkIndex < speechController.chunks.length - 1
  ) {
    showSpeechChunk(speechController.chunkIndex + 1);
  }

  const anchor = getSpeechAnchorPosition();
  if (!anchor) {
    speechBubble.dataset.visible = "false";
    return;
  }

  speechAnchor.copy(anchor);
  speechScreenPosition.copy(speechAnchor).project(camera);
  const outsideClipSpace = speechScreenPosition.z < -1 || speechScreenPosition.z > 1;
  const speechIsActive = performance.now() < speechController.visibleUntil;
  speechBubble.dataset.visible = !outsideClipSpace && speechIsActive ? "true" : "false";

  if (outsideClipSpace) {
    return;
  }

  const bubbleWidth = speechBubble.offsetWidth;
  const bubbleHeight = speechBubble.offsetHeight;
  const rawX = (speechScreenPosition.x * 0.5 + 0.5) * window.innerWidth;
  const rawY = (-speechScreenPosition.y * 0.5 + 0.5) * window.innerHeight;
  const x = THREE.MathUtils.clamp(
    rawX,
    16 + bubbleWidth * 0.16,
    window.innerWidth - 16 - bubbleWidth * 0.84
  );
  const y = THREE.MathUtils.clamp(rawY, 18 + bubbleHeight, window.innerHeight - 134);
  speechBubble.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-16%, -100%)`;
}

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

function getMotionModeLabel(mode) {
  return getMotionModeOption(mode).label;
}

function getMotionModeOption(mode) {
  return motionController.options.find((option) => option.id === mode) || STILL_MOTION_OPTION;
}

function getMotionModeChoices() {
  return motionController.options.map((option) => option.id);
}

function pickMotionChoice(value) {
  return getMotionModeChoices().includes(value) ? value : STILL_MOTION_ID;
}

function isReadyVrmaMotionPreset(preset) {
  return preset?.ok && preset.url && (preset.kind || "vrma").toLowerCase() === "vrma";
}

function isProceduralMotionOption(option) {
  return option?.kind === "procedural";
}

function getIdleInterludeDelay() {
  return THREE.MathUtils.randFloat(
    IDLE_INTERLUDE_MIN_SECONDS,
    IDLE_INTERLUDE_MAX_SECONDS
  );
}

function resetIdleInterludeSchedule({ startup = true } = {}) {
  motionController.idleInterludeClock = 0;
  motionController.idleInterludeNextAt = startup
    ? BREATHE_LOOP_SECONDS
    : getIdleInterludeDelay();
  motionController.idleInterludeStartupPending = startup;
}

function getIdleInterludeState() {
  if (motionController.idleInterludeAction) {
    return "playing";
  }

  if (motionController.idleInterludeLoadingId) {
    return "loading";
  }

  return motionController.idleInterludeStartupPending ? "startup-waiting" : "waiting";
}

function getMotionPlaybackState() {
  const selectedOption = getMotionModeOption(modelPreviewOptions.motion);
  const interludeOption = getProceduralBaseMotionOption();
  const interludeState = getIdleInterludeState();
  const isInterludeActive = Boolean(
    interludeOption &&
    selectedOption.id === IDLE_BREATHE_MOTION_ID &&
    (interludeState === "loading" || interludeState === "playing")
  );
  const effectiveOption = isInterludeActive ? interludeOption : selectedOption;

  return {
    selectedId: selectedOption.id,
    selectedLabel: selectedOption.label,
    effectiveId: effectiveOption.id,
    effectiveLabel: effectiveOption.label,
    effectiveStatus: isInterludeActive ? interludeState : motionController.status,
    interludeId: interludeOption?.id || "",
    interludeLabel: interludeOption?.label || "",
    interludeState,
    interludeNextIn: Math.max(
      0,
      motionController.idleInterludeNextAt - motionController.idleInterludeClock
    ),
    isInterludeActive
  };
}

function getMotionStatusSummary() {
  const motionState = getMotionPlaybackState();

  if (!motionState.isInterludeActive) {
    return motionState.selectedLabel;
  }

  return `${motionState.effectiveLabel} (${motionState.effectiveStatus}; ${motionState.selectedLabel} resumes)`;
}

function configureMotionOptions(state) {
  const configured = state?.scene?.modelPreview || {};
  const savedDemoPreview = getSavedDemoPreviewOptions() || {};
  const vrmaOptions = (state?.motionPresets || [])
    .filter(isReadyVrmaMotionPreset)
    .map((preset) => ({
      id: preset.id,
      label: preset.label,
      kind: "vrma",
      url: preset.url,
      path: preset.path,
      sourceId: preset.sourceId,
      ok: true
    }));

  motionController.options = [STILL_MOTION_OPTION, ...PROCEDURAL_MOTION_OPTIONS, ...vrmaOptions];
  motionController.configured = true;
  modelPreviewOptions.motion = pickMotionChoice(
    pickFirstChoice(
      [
        queryParams.get("modelMotion"),
        savedDemoPreview.motion,
        savedDemoPreview.modelMotion,
        configured.motion,
        configured.modelMotion
      ],
      getMotionModeChoices(),
      STILL_MOTION_ID
    )
  );
  populateMotionModeSelect();
}

function populateMotionModeSelect() {
  const selectedMotion = pickMotionChoice(modelPreviewOptions.motion);
  motionModeSelect.innerHTML = "";

  motionController.options.forEach((motion) => {
    const option = document.createElement("option");
    option.value = motion.id;
    option.textContent = motion.label;
    option.selected = motion.id === selectedMotion;
    motionModeSelect.append(option);
  });

  motionModeSelect.value = selectedMotion;
  motionModeSelect.disabled =
    motionController.options.length <= 1 || (realDancer && activeModelKind !== "vrm");
}

function restoreManualExpressionSelections() {
  activeVrm?.expressionManager?.resetValues?.();
  applyEyeMorphSelection();
  applyFaceEmoteSelection();
  applyOutfitMorphSelection();
}

function resetLoadedModelMotion({ resetExpressions = true } = {}) {
  motionController.loadingId = null;
  motionController.idleInterludeLoadingId = null;
  stopIdleInterlude();
  resetIdleInterludeSchedule();

  if (motionController.action) {
    motionController.action.stop();
    motionController.action = null;
  }

  if (motionController.mixer && activeVrm?.scene) {
    motionController.mixer.stopAllAction();
    motionController.mixer.uncacheRoot(activeVrm.scene);
  }

  motionController.mixer = null;
  motionController.clip = null;
  motionController.status = "idle";
  motionController.error = "";
  motionController.proceduralTime = 0;
  motionController.proceduralBasePose = null;
  motionController.proceduralBasePoseKey = "";
  motionController.proceduralBasePosePromise = null;
  activeVrm?.humanoid?.resetNormalizedPose?.();

  if (resetExpressions) {
    restoreManualExpressionSelections();
  }
}

function ensureVrmLookAtQuaternionProxy(vrm) {
  if (!vrm?.lookAt || !vrm.scene) {
    return;
  }

  let proxy = vrm.scene.children.find((child) => child instanceof VRMLookAtQuaternionProxy);
  if (!proxy) {
    proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
    vrm.scene.add(proxy);
  }
  if (!proxy.name) {
    proxy.name = "VRMLookAtQuaternionProxy";
  }
}

function loadVrmAnimationClip(option) {
  const cacheKey = `${activeVrm?.scene?.uuid || "none"}:${option.id}`;
  const cached = motionController.clipCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

  return new Promise((resolve, reject) => {
    loader.load(
      option.url,
      (gltf) => {
        const vrmAnimation = gltf.userData.vrmAnimations?.[0];
        if (!vrmAnimation) {
          reject(new Error(`No VRM animation found in ${option.label}`));
          return;
        }

        ensureVrmLookAtQuaternionProxy(activeVrm);
        const clip = createVRMAnimationClip(vrmAnimation, activeVrm);
        clip.name = option.label;
        motionController.clipCache.set(cacheKey, clip);
        resolve(clip);
      },
      undefined,
      reject
    );
  });
}

function clonePoseTransform(transform = {}) {
  const clone = {};

  if (Array.isArray(transform.position)) {
    clone.position = [...transform.position];
  }

  if (Array.isArray(transform.rotation)) {
    clone.rotation = [...transform.rotation];
  }

  return clone;
}

function cloneNormalizedPose(pose = {}) {
  return Object.fromEntries(
    Object.entries(pose).map(([boneName, transform]) => [
      boneName,
      clonePoseTransform(transform)
    ])
  );
}

function getProceduralBaseMotionOption() {
  const option = getMotionModeOption(PROCEDURAL_BASE_MOTION_ID);
  return option.id === PROCEDURAL_BASE_MOTION_ID && option.url ? option : null;
}

async function sampleMotionFirstFramePose(option) {
  if (!activeVrm?.scene || !activeVrm?.humanoid?.getNormalizedPose) {
    return {};
  }

  const clip = await loadVrmAnimationClip(option);
  const previousPose = cloneNormalizedPose(activeVrm.humanoid.getNormalizedPose());
  const mixer = new THREE.AnimationMixer(activeVrm.scene);
  const action = mixer.clipAction(clip);

  try {
    activeVrm.humanoid.resetNormalizedPose?.();
    action.reset();
    action.play();
    mixer.setTime(0);
    activeVrm.update?.(0);
    return cloneNormalizedPose(activeVrm.humanoid.getNormalizedPose());
  } finally {
    action.stop();
    mixer.stopAllAction();
    mixer.uncacheRoot(activeVrm.scene);
    activeVrm.humanoid.resetNormalizedPose?.();
    activeVrm.humanoid.setNormalizedPose?.(previousPose);
    activeVrm.update?.(0);
  }
}

async function loadProceduralBasePose() {
  const option = getProceduralBaseMotionOption();
  const key = `${activeVrm?.scene?.uuid || "none"}:${option?.id || "rest"}`;

  if (motionController.proceduralBasePoseKey === key && motionController.proceduralBasePose) {
    return motionController.proceduralBasePose;
  }

  if (motionController.proceduralBasePoseKey === key && motionController.proceduralBasePosePromise) {
    return motionController.proceduralBasePosePromise;
  }

  motionController.proceduralBasePoseKey = key;
  const basePosePromise = option
    ? sampleMotionFirstFramePose(option)
    : Promise.resolve({});
  motionController.proceduralBasePosePromise = basePosePromise;

  try {
    const basePose = await basePosePromise;
    if (motionController.proceduralBasePoseKey === key) {
      motionController.proceduralBasePose = basePose;
    }
    return basePose;
  } finally {
    if (motionController.proceduralBasePosePromise === basePosePromise) {
      motionController.proceduralBasePosePromise = null;
    }
  }
}

function ensurePoseTransform(pose, boneName) {
  if (!pose[boneName]) {
    pose[boneName] = {};
  }

  return pose[boneName];
}

function addPosePositionDelta(pose, boneName, x = 0, y = 0, z = 0) {
  const transform = ensurePoseTransform(pose, boneName);
  const position = transform.position || [0, 0, 0];
  transform.position = [
    position[0] + x,
    position[1] + y,
    position[2] + z
  ];
}

function addPoseRotationDelta(pose, boneName, x = 0, y = 0, z = 0) {
  const transform = ensurePoseTransform(pose, boneName);
  const rotation = new THREE.Quaternion();

  if (Array.isArray(transform.rotation)) {
    rotation.fromArray(transform.rotation);
  }

  rotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ")));
  transform.rotation = rotation.toArray();
}

function getLoopSine(t, duration) {
  const phase = ((t % duration) + duration) % duration;
  return Math.sin((phase / duration) * Math.PI * 2);
}

function advanceLoopTime(t, delta, duration) {
  if (delta <= 0) {
    return t;
  }

  const nextTime = t + delta;
  return nextTime >= duration ? 0 : nextTime;
}

function buildBreathePose(basePose, t) {
  const pose = cloneNormalizedPose(basePose);
  const breath = 0.5 * getLoopSine(t, BREATHE_LOOP_SECONDS);
  const torsoLift = breath;
  const clavicleRoll = breath;
  const armDrift = 0.18 * breath;

  addPosePositionDelta(pose, "hips", 0, -0.002 * torsoLift, 0);
  addPosePositionDelta(pose, "upperChest", 0, 0.006 * torsoLift, 0.002 * breath);
  addPosePositionDelta(pose, "neck", 0, 0.0015 * torsoLift, 0);
  addPosePositionDelta(pose, "head", 0, 0.002 * torsoLift, 0);
  addPosePositionDelta(pose, "leftShoulder", 0, 0.002 * torsoLift, 0);
  addPosePositionDelta(pose, "rightShoulder", 0, 0.002 * torsoLift, 0);

  addPoseRotationDelta(pose, "spine", THREE.MathUtils.degToRad(-0.3 * breath), 0, 0);
  addPoseRotationDelta(pose, "chest", THREE.MathUtils.degToRad(-0.8 * breath), 0, 0);
  addPoseRotationDelta(pose, "upperChest", THREE.MathUtils.degToRad(-2.2 * breath), 0, 0);
  addPoseRotationDelta(pose, "neck", THREE.MathUtils.degToRad(0.3 * breath), 0, 0);
  addPoseRotationDelta(pose, "head", THREE.MathUtils.degToRad(0.15 * breath), 0, 0);
  addPoseRotationDelta(
    pose,
    "leftShoulder",
    0,
    THREE.MathUtils.degToRad(-0.25 * armDrift),
    THREE.MathUtils.degToRad(0.8 * clavicleRoll)
  );
  addPoseRotationDelta(
    pose,
    "rightShoulder",
    0,
    THREE.MathUtils.degToRad(0.25 * armDrift),
    THREE.MathUtils.degToRad(-0.8 * clavicleRoll)
  );
  addPoseRotationDelta(
    pose,
    "leftUpperArm",
    0,
    THREE.MathUtils.degToRad(-0.5 * armDrift),
    THREE.MathUtils.degToRad(0.35 * armDrift)
  );
  addPoseRotationDelta(
    pose,
    "rightUpperArm",
    0,
    THREE.MathUtils.degToRad(0.5 * armDrift),
    THREE.MathUtils.degToRad(-0.35 * armDrift)
  );

  return pose;
}

function buildProceduralPose(mode, t, basePose = {}) {
  if (mode === IDLE_BREATHE_MOTION_ID) {
    return buildBreathePose(basePose, t);
  }

  return cloneNormalizedPose(basePose);
}

function stopIdleInterlude() {
  if (
    motionController.idleInterludeMixer &&
    motionController.idleInterludeFinishHandler
  ) {
    motionController.idleInterludeMixer.removeEventListener(
      "finished",
      motionController.idleInterludeFinishHandler
    );
  }

  motionController.idleInterludeAction?.stop();

  if (motionController.idleInterludeMixer && activeVrm?.scene) {
    motionController.idleInterludeMixer.stopAllAction();
    motionController.idleInterludeMixer.uncacheRoot(activeVrm.scene);
  }

  motionController.idleInterludeMixer = null;
  motionController.idleInterludeAction = null;
  motionController.idleInterludeFinishHandler = null;
}

function applyCurrentProceduralPose() {
  if (!activeVrm?.humanoid || !motionController.proceduralBasePose) {
    return;
  }

  activeVrm.humanoid.resetNormalizedPose?.();
  activeVrm.humanoid.setNormalizedPose?.(
    buildProceduralPose(
      modelPreviewOptions.motion,
      motionController.proceduralTime,
      motionController.proceduralBasePose
    )
  );
}

function finishIdleInterlude() {
  stopIdleInterlude();
  motionController.proceduralTime = 0;
  resetIdleInterludeSchedule({ startup: false });
  applyCurrentProceduralPose();
  updateLocalModelDebug();
  updateModelAssetStatus();
}

async function startIdleInterlude() {
  const interludeOption = getProceduralBaseMotionOption();

  if (
    !interludeOption ||
    !activeVrm?.scene ||
    modelPreviewOptions.motion !== IDLE_BREATHE_MOTION_ID ||
    motionController.idleInterludeAction ||
    motionController.idleInterludeLoadingId
  ) {
    return;
  }

  const loadingId = `${interludeOption.id}:${performance.now()}`;
  motionController.idleInterludeLoadingId = loadingId;
  motionController.idleInterludeStartupPending = false;
  updateLocalModelDebug();
  updateModelAssetStatus();

  try {
    const clip = await loadVrmAnimationClip(interludeOption);
    if (
      motionController.idleInterludeLoadingId !== loadingId ||
      modelPreviewOptions.motion !== IDLE_BREATHE_MOTION_ID ||
      !activeVrm?.scene
    ) {
      return;
    }

    motionController.idleInterludeLoadingId = null;
    stopIdleInterlude();
    motionController.proceduralTime = 0;
    applyCurrentProceduralPose();

    const mixer = new THREE.AnimationMixer(activeVrm.scene);
    const action = mixer.clipAction(clip);
    const finishHandler = (event) => {
      if (event.action === action) {
        finishIdleInterlude();
      }
    };

    mixer.addEventListener("finished", finishHandler);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.play();

    motionController.idleInterludeMixer = mixer;
    motionController.idleInterludeAction = action;
    motionController.idleInterludeFinishHandler = finishHandler;
    updateLocalModelDebug();
    updateModelAssetStatus();
  } catch (error) {
    console.warn(
      error instanceof Error
        ? `Idle interlude failed to load: ${error.message}`
        : "Idle interlude failed to load"
    );
    resetIdleInterludeSchedule({ startup: false });
    updateLocalModelDebug();
    updateModelAssetStatus();
  } finally {
    if (motionController.idleInterludeLoadingId === loadingId) {
      motionController.idleInterludeLoadingId = null;
    }
  }
}

function updateIdleInterlude(delta) {
  if (!motionController.idleInterludeMixer || !motionController.idleInterludeAction) {
    return false;
  }

  motionController.idleInterludeMixer.update(delta);
  return true;
}

function updateIdleInterludeSchedule(delta) {
  if (
    delta <= 0 ||
    modelPreviewOptions.motion !== IDLE_BREATHE_MOTION_ID ||
    motionController.idleInterludeAction ||
    motionController.idleInterludeLoadingId ||
    !getProceduralBaseMotionOption()
  ) {
    return;
  }

  motionController.idleInterludeClock += delta;
  if (motionController.idleInterludeClock < motionController.idleInterludeNextAt) {
    return;
  }

  const neutralBreath = Math.abs(
    getLoopSine(motionController.proceduralTime, BREATHE_LOOP_SECONDS)
  );
  if (neutralBreath > IDLE_INTERLUDE_NEUTRAL_THRESHOLD) {
    return;
  }

  void startIdleInterlude();
}

function applyProceduralVrmMotion(delta) {
  const option = getMotionModeOption(modelPreviewOptions.motion);
  if (!activeVrm?.humanoid || !isProceduralMotionOption(option)) {
    return false;
  }

  if (!motionController.proceduralBasePose) {
    return true;
  }

  if (updateIdleInterlude(delta)) {
    motionController.status = "playing";
    motionController.error = "";
    return true;
  }

  updateIdleInterludeSchedule(delta);
  motionController.proceduralTime = advanceLoopTime(
    motionController.proceduralTime,
    delta,
    BREATHE_LOOP_SECONDS
  );
  applyCurrentProceduralPose();
  motionController.status = "playing";
  motionController.error = "";
  return true;
}

async function applyLoadedModelMotion() {
  const option = getMotionModeOption(modelPreviewOptions.motion);
  resetLoadedModelMotion();

  if (isProceduralMotionOption(option) && activeVrm?.humanoid) {
    motionController.status = "loading";
    motionController.error = "";
    const loadingId = `${option.id}:${performance.now()}`;
    motionController.loadingId = loadingId;
    updateLocalModelDebug();
    updateModelAssetStatus();

    try {
      const basePose = await loadProceduralBasePose();
      if (motionController.loadingId !== loadingId || modelPreviewOptions.motion !== option.id) {
        return;
      }

      motionController.proceduralBasePose = basePose;
      activeVrm.humanoid.resetNormalizedPose?.();
      activeVrm.humanoid.setNormalizedPose?.(buildProceduralPose(option.id, 0, basePose));
      motionController.status = "playing";
      motionController.error = "";
    } catch (error) {
      if (motionController.loadingId !== loadingId) {
        return;
      }
      motionController.status = "error";
      motionController.error = error instanceof Error ? error.message : "Procedural base pose failed to load";
      console.warn(motionController.error);
      modelPreviewOptions.motion = STILL_MOTION_ID;
      setPreviewUrlParam("motion", STILL_MOTION_ID);
      resetLoadedModelMotion();
    } finally {
      if (motionController.loadingId === loadingId) {
        motionController.loadingId = null;
      }
      refreshModelPreview();
    }
    return;
  }

  if (option.id === STILL_MOTION_ID || !activeVrm?.scene) {
    refreshModelPreview();
    return;
  }

  motionController.status = "loading";
  motionController.error = "";
  const loadingId = `${option.id}:${performance.now()}`;
  motionController.loadingId = loadingId;
  updateLocalModelDebug();
  updateModelAssetStatus();

  try {
    const clip = await loadVrmAnimationClip(option);
    if (motionController.loadingId !== loadingId || modelPreviewOptions.motion !== option.id) {
      return;
    }

    activeVrm.humanoid?.resetNormalizedPose?.();
    motionController.mixer = new THREE.AnimationMixer(activeVrm.scene);
    motionController.clip = clip;
    motionController.action = motionController.mixer.clipAction(clip);
    motionController.action.reset();
    motionController.action.setLoop(THREE.LoopRepeat, Infinity);
    motionController.action.play();
    motionController.status = "playing";
    motionController.error = "";
  } catch (error) {
    if (motionController.loadingId !== loadingId) {
      return;
    }
    motionController.status = "error";
    motionController.error = error instanceof Error ? error.message : "Motion failed to load";
    console.warn(motionController.error);
    modelPreviewOptions.motion = STILL_MOTION_ID;
    setPreviewUrlParam("motion", STILL_MOTION_ID);
    resetLoadedModelMotion();
  } finally {
    if (motionController.loadingId === loadingId) {
      motionController.loadingId = null;
    }
    refreshModelPreview();
  }
}

function updateLoadedModelMotion(delta) {
  if (applyProceduralVrmMotion(delta)) {
    return;
  }
  motionController.mixer?.update(delta);
}

function animateStage(t) {
  stage.children.forEach((child, index) => {
    if (child.geometry?.type === "TorusGeometry") {
      child.rotation.z += 0.0015 * (index % 2 ? -1 : 1);
    }
  });
  stage.rotation.y = Math.sin(t * 0.18) * 0.025;
}

function updateCamera() {
  const cameraZoom = THREE.MathUtils.clamp(
    modelPreviewOptions.cameraZoom,
    CAMERA_ZOOM_MIN,
    CAMERA_ZOOM_MAX
  );
  const preset = CAMERA_ANGLE_PRESETS[cameraMode] || CAMERA_ANGLE_PRESETS[0];
  const radius = (realDancer ? preset.radius : preset.fallbackRadius) * cameraZoom;
  const yaw = preset.yaw + drag.yaw;
  const pitch = THREE.MathUtils.clamp(
    preset.pitch + drag.pitch,
    realDancer ? -0.08 : 0.02,
    realDancer ? 0.76 : 0.88
  );
  const targetY = preset.targetY;

  camera.position.set(
    Math.sin(yaw) * Math.cos(pitch) * radius,
    targetY + Math.sin(pitch) * radius,
    Math.cos(yaw) * Math.cos(pitch) * radius
  );
  orbitTarget.set(0, targetY, 0);
  camera.lookAt(orbitTarget);
  camera.rotation.z = preset.roll || 0;

  if (window.localModelDebug) {
    window.localModelDebug.camera = {
      mode: preset.label,
      yaw,
      pitch,
      position: camera.position.toArray(),
      target: orbitTarget.toArray()
    };
  }
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

function parseClampedNumber(value, fallback, min, max) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, min, max) : fallback;
}

function pickChoice(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function pickFirstChoice(values, choices, fallback) {
  return values.find((value) => choices.includes(value)) || fallback;
}

function normalizeDemoConfigurationName(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "default";
}

function isDemoMode() {
  return appMode === "demo";
}

function loadSavedDemoProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(DEMO_PROFILE_STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object") {
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

function getSavedDemoPreviewOptions() {
  return isDemoMode() ? loadSavedDemoProfile()?.modelPreview || null : null;
}

async function saveDemoProfile(configurationName = demoConfigurationName) {
  demoConfigurationName = normalizeDemoConfigurationName(configurationName);
  const selectedPreset = localAssetState?.selectedModelPreset || null;
  const selectedMotion = getMotionModeOption(modelPreviewOptions.motion);
  const requiredMotion = selectedMotion?.kind === "vrma"
    ? selectedMotion
    : isProceduralMotionOption(selectedMotion)
      ? getProceduralBaseMotionOption()
      : null;
  const motionPresets = requiredMotion?.path
    ? [{
        id: requiredMotion.id,
        label: requiredMotion.label,
        path: requiredMotion.path,
        kind: requiredMotion.kind,
        required: true
      }]
    : [];
  const profile = {
    configuration: demoConfigurationName,
    savedAt: new Date().toISOString(),
    assetRoot: localAssetState?.config?.assetRoot || "/local-resources/original-video-assets/",
    modelPreset: selectedPreset?.id || queryParams.get(PREVIEW_QUERY_KEYS.modelPreset) || "",
    modelPresetLabel: selectedPreset?.label || "Configured model",
    modelPresetAsset: selectedPreset
      ? {
          id: selectedPreset.id,
          label: selectedPreset.label,
          path: selectedPreset.path,
          kind: selectedPreset.kind || getModelKind(selectedPreset),
          required: true
        }
      : null,
    modelPreview: { ...modelPreviewOptions },
    motionPresets
  };

  localStorage.setItem(DEMO_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  try {
    const response = await fetch("/demo-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Save returned ${response.status}`);
    }
    const savedPath = body.path || "public/demo-profile.json";
    addDialogueLine("system", `compiled ${demoConfigurationName}: ${profile.modelPresetLabel}`);
    addDialogueLine("system", `saved ${savedPath}`);
    showSpeechPhrase("Demo profile compiled.");
  } catch (error) {
    addDialogueLine(
      "system",
      `demo profile saved in browser only: ${error instanceof Error ? error.message : "compile failed"}`
    );
    showSpeechPhrase("Demo profile saved locally.");
  }
  return profile;
}

function replaceUrlFromQueryParams() {
  const search = queryParams.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`
  );
}

function applySavedDemoProfileToUrlState() {
  document.documentElement.dataset.appMode = appMode;
  document.documentElement.dataset.demoConfiguration = demoConfigurationName;
  if (!isDemoMode() || window.location.pathname.endsWith("/demo.html")) {
    return;
  }

  const profile = loadSavedDemoProfile();
  const savedModelPreset = profile?.modelPreset;
  if (savedModelPreset && !queryParams.has(PREVIEW_QUERY_KEYS.modelPreset)) {
    queryParams.set(PREVIEW_QUERY_KEYS.modelPreset, savedModelPreset);
    replaceUrlFromQueryParams();
  }
}

function openProfileSaveDialog() {
  profileSaveNameInput.value = demoConfigurationName;
  profileSaveNameInput.setSelectionRange(0, profileSaveNameInput.value.length);

  if (typeof profileSaveDialog.showModal === "function") {
    profileSaveDialog.showModal();
    profileSaveNameInput.focus();
    return;
  }

  const promptedName = window.prompt("Demo profile name", demoConfigurationName);
  if (promptedName !== null) {
    saveDemoProfile(promptedName);
  }
}

function closeProfileSaveDialog() {
  if (profileSaveDialog.open) {
    profileSaveDialog.close();
  }
}

function getModelPreviewOptions(sceneConfig) {
  const configured = sceneConfig?.modelPreview || {};
  const savedDemoPreview = getSavedDemoPreviewOptions() || {};
  const mode = pickChoice(
    queryParams.get("modelMode") ||
      savedDemoPreview.mode ||
      savedDemoPreview.modelMode ||
      configured.mode ||
      configured.modelMode,
    MODEL_MODE_CHOICES,
    DEFAULT_MODEL_PREVIEW_OPTIONS.mode
  );
  const lighting = pickChoice(
    queryParams.get("modelLighting") || savedDemoPreview.lighting || configured.lighting,
    MODEL_LIGHTING_CHOICES,
    DEFAULT_MODEL_PREVIEW_OPTIONS.lighting
  );
  const motion = pickMotionChoice(
    pickFirstChoice(
      [
        queryParams.get("modelMotion"),
        savedDemoPreview.motion,
        savedDemoPreview.modelMotion,
        configured.motion,
        configured.modelMotion
      ],
      getMotionModeChoices(),
      STILL_MOTION_ID
    )
  );
  const stageLighting = parseUnitInterval(
    queryParams.get("stageLighting") ?? savedDemoPreview.stageLighting ?? configured.stageLighting,
    DEFAULT_MODEL_PREVIEW_OPTIONS.stageLighting
  );
  const materialBoostStrength = Number(
    queryParams.get("materialBoostStrength") ??
      savedDemoPreview.materialBoostStrength ??
      DEFAULT_MODEL_PREVIEW_OPTIONS.materialBoostStrength
  );
  const saturation = parseClampedNumber(
    queryParams.get("modelSaturation") ?? savedDemoPreview.saturation ?? configured.saturation,
    DEFAULT_MODEL_PREVIEW_OPTIONS.saturation,
    0,
    2
  );
  const bloomStrength = parseClampedNumber(
    queryParams.get("modelBloom") ?? savedDemoPreview.bloomStrength ?? configured.bloomStrength,
    DEFAULT_MODEL_PREVIEW_OPTIONS.bloomStrength,
    0,
    0.6
  );
  const cameraZoom = parseClampedNumber(
    queryParams.get("cameraZoom") ?? savedDemoPreview.cameraZoom ?? configured.cameraZoom,
    DEFAULT_MODEL_PREVIEW_OPTIONS.cameraZoom,
    CAMERA_ZOOM_MIN,
    CAMERA_ZOOM_MAX
  );
  const readingWpm = Math.round(parseClampedNumber(
    queryParams.get("readingWpm") ?? savedDemoPreview.readingWpm ?? configured.readingWpm,
    DEFAULT_MODEL_PREVIEW_OPTIONS.readingWpm,
    READING_WPM_MIN,
    READING_WPM_MAX
  ));

  return {
    mode,
    lighting,
    motion,
    stageLighting,
    materialBoostStrength: Number.isFinite(materialBoostStrength)
      ? THREE.MathUtils.clamp(materialBoostStrength, 0, 1)
      : DEFAULT_MODEL_PREVIEW_OPTIONS.materialBoostStrength,
    saturation,
    bloomStrength,
    cameraZoom,
    readingWpm
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

function isEyeMorphName(name) {
  return /目|瞳|眼|まばたき|ウィンク|笑い|びっくり|はぅ|なごみ|じと|ハート|星|eye|eyes|blink|wink|iris|pupil|star|cross/i.test(
    name
  );
}

function isOneSidedEyeMorphName(name) {
  return /(^|[_\-\s.])(l|r|left|right)([_\-\s.]|$)|(left|right)$|左|右/i.test(name);
}

function isOutfitMorphName(name) {
  return /shirt|dress|cloth|clothes|skirt|bikini|ribbon|outfit|costume|服|衣|裙/i.test(name);
}

function formatMorphLabel(name) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function morphAttributeHasDelta(attribute) {
  if (!attribute?.array) {
    return false;
  }

  return attribute.array.some((value) => Math.abs(value) > 0.000001);
}

function morphTargetHasGeometryDelta(object, index) {
  const morphAttributes = object.geometry?.morphAttributes;
  if (!morphAttributes) {
    return false;
  }

  return ["position", "normal", "color"].some((attributeName) =>
    morphAttributeHasDelta(morphAttributes[attributeName]?.[index])
  );
}

function collectVrmEyeExpressionOptions(vrm) {
  const expressionMap = vrm?.expressionManager?.expressionMap;
  if (!expressionMap) {
    return [];
  }

  return [...VRM_BOTH_EYE_EXPRESSION_LABELS.entries()]
    .filter(([expressionName]) => expressionMap[expressionName])
    .map(([expressionName, label], index) => ({
      id: `eye-expression-${index}`,
      name: label,
      expressionName
    }));
}

function hasExpressionBinds(expression) {
  return (expression?.binds?.length || 0) > 0;
}

function collectVrmFaceEmoteOptions(vrm) {
  const expressionMap = vrm?.expressionManager?.expressionMap;
  if (!expressionMap) {
    return [];
  }

  return [...VRM_FACE_EXPRESSION_LABELS.entries()]
    .filter(([expressionName]) => hasExpressionBinds(expressionMap[expressionName]))
    .map(([expressionName, label], index) => ({
      id: `face-expression-${index}`,
      name: label,
      expressionName
    }));
}

function collectRawEyeMorphOptions(mesh, { bilateralOnly = false, excludeNames = new Set() } = {}) {
  const options = new Map();

  mesh.traverse((object) => {
    if (!object.morphTargetDictionary || !object.morphTargetInfluences) {
      return;
    }

    Object.entries(object.morphTargetDictionary).forEach(([name, index]) => {
      if (
        !isEyeMorphName(name) ||
        excludeNames.has(name) ||
        (bilateralOnly && isOneSidedEyeMorphName(name)) ||
        !morphTargetHasGeometryDelta(object, index)
      ) {
        return;
      }

      if (!options.has(name)) {
        options.set(name, {
          id: `eye-${options.size}`,
          name,
          targets: []
        });
      }

      options.get(name).targets.push({ object, index });
    });
  });

  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

function collectEyeMorphOptions(mesh, vrm = null) {
  const vrmOptions = collectVrmEyeExpressionOptions(vrm);
  if (vrmOptions.length === 0) {
    return collectRawEyeMorphOptions(mesh);
  }

  const rawBilateralOptions = collectRawEyeMorphOptions(mesh, {
    bilateralOnly: true,
    excludeNames: VRM_EXPRESSION_BACKED_RAW_EYE_MORPHS
  });

  return [...vrmOptions, ...rawBilateralOptions];
}

function collectOutfitMorphOptions(mesh) {
  const options = new Map();

  mesh.traverse((object) => {
    if (!object.morphTargetDictionary || !object.morphTargetInfluences) {
      return;
    }

    Object.entries(object.morphTargetDictionary).forEach(([name, index]) => {
      if (!isOutfitMorphName(name) || !morphTargetHasGeometryDelta(object, index)) {
        return;
      }

      if (!options.has(name)) {
        options.set(name, {
          id: `outfit-${options.size}`,
          name: formatMorphLabel(name),
          rawName: name,
          targets: []
        });
      }

      options.get(name).targets.push({ object, index });
    });
  });

  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

function setVrmExpressionWeight(option, weight) {
  if (!option?.expressionName || !activeVrm?.expressionManager) {
    return false;
  }

  activeVrm.expressionManager.setValue(option.expressionName, weight);
  return true;
}

function populateModelPresetSelect(state) {
  const presets = state.modelPresets || [];
  const selected = state.selectedModelPreset || presets[0];
  const visiblePresets = presets.filter((preset) => preset.ok);

  modelPresetSelect.innerHTML = "";

  if (visiblePresets.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Configured model";
    modelPresetSelect.append(option);
    modelPresetSelect.disabled = true;
    return;
  }

  visiblePresets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    option.selected = preset.id === selected?.id;
    modelPresetSelect.append(option);
  });

  modelPresetSelect.disabled = visiblePresets.length <= 1;
  modelPresetSelect.title = selected
    ? `${selected.label}: ${selected.path || "No path configured"}`
    : "No model presets configured";
  document.documentElement.dataset.modelPreset = selected?.id || "";

  const requestedModelPreset = queryParams.get(PREVIEW_QUERY_KEYS.modelPreset);
  if (requestedModelPreset && selected?.id && requestedModelPreset !== selected.id) {
    setPreviewUrlParam("modelPreset", selected.id);
  }
}

function setEyeMorphWeight(option, weight) {
  if (setVrmExpressionWeight(option, weight)) {
    return;
  }

  option.targets.forEach((target) => {
    target.object.morphTargetInfluences[target.index] = weight;
  });
}

function applyEyeMorphSelection(id = eyeMorphController.selectedId) {
  eyeMorphController.selectedId = id;
  eyeMorphController.options.forEach((option) => {
    setEyeMorphWeight(option, option.id === id ? 1 : 0);
  });
  document.documentElement.dataset.eyeMorph = id;
  if (window.localModelDebug) {
    const selected = eyeMorphController.options.find((option) => option.id === id);
    window.localModelDebug.eyeMorph = selected?.name || "Default eyes";
  }
}

function setFaceEmoteWeight(option, weight) {
  setVrmExpressionWeight(option, weight);
}

function applyFaceEmoteSelection(id = faceEmoteController.selectedId) {
  faceEmoteController.selectedId = id;
  faceEmoteController.options.forEach((option) => {
    setFaceEmoteWeight(option, option.id === id ? 1 : 0);
  });
  document.documentElement.dataset.faceEmote = id;
  if (window.localModelDebug) {
    const selected = faceEmoteController.options.find((option) => option.id === id);
    window.localModelDebug.faceEmote = selected?.name || "Default face";
  }
}

function setOutfitMorphWeight(option, weight) {
  option.targets.forEach((target) => {
    target.object.morphTargetInfluences[target.index] = weight;
  });
}

function applyOutfitMorphSelection(id = outfitMorphController.selectedId) {
  outfitMorphController.selectedId = id;
  outfitMorphController.options.forEach((option) => {
    setOutfitMorphWeight(option, option.id === id ? 1 : 0);
  });
  document.documentElement.dataset.outfitMorph = id;
  if (window.localModelDebug) {
    const selected = outfitMorphController.options.find((option) => option.id === id);
    window.localModelDebug.outfitMorph = selected?.name || "Default outfit";
  }
}

function populateEyeMorphSelect(mesh, vrm = null) {
  eyeMorphController.options = collectEyeMorphOptions(mesh, vrm);
  eyeMorphController.selectedId = "default";

  eyeMorphSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "default";
  defaultOption.textContent = "Default eyes";
  eyeMorphSelect.append(defaultOption);

  eyeMorphController.options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.id;
    optionElement.textContent = option.name;
    eyeMorphSelect.append(optionElement);
  });

  eyeMorphSelect.disabled = eyeMorphController.options.length === 0;
  eyeMorphSelect.title = eyeMorphController.options.length
    ? `${eyeMorphController.options.length} eye morphs`
    : "No eye morphs found";
  document.documentElement.dataset.eyeMorphCount = String(eyeMorphController.options.length);
  applyEyeMorphSelection("default");
}

function populateFaceEmoteSelect(vrm = null) {
  faceEmoteController.options = collectVrmFaceEmoteOptions(vrm);
  faceEmoteController.selectedId = "default";

  faceEmoteSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "default";
  defaultOption.textContent = "Default face";
  faceEmoteSelect.append(defaultOption);

  faceEmoteController.options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.id;
    optionElement.textContent = option.name;
    faceEmoteSelect.append(optionElement);
  });

  faceEmoteSelect.disabled = faceEmoteController.options.length === 0;
  faceEmoteSelect.title = faceEmoteController.options.length
    ? `${faceEmoteController.options.length} face emotes`
    : "No face emotes found";
  document.documentElement.dataset.faceEmoteCount = String(faceEmoteController.options.length);
  applyFaceEmoteSelection("default");
}

function populateOutfitMorphSelect(mesh) {
  outfitMorphController.options = collectOutfitMorphOptions(mesh);
  outfitMorphController.selectedId = "default";

  outfitMorphSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "default";
  defaultOption.textContent = "Default outfit";
  outfitMorphSelect.append(defaultOption);

  outfitMorphController.options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.id;
    optionElement.textContent = option.name;
    outfitMorphSelect.append(optionElement);
  });

  outfitMorphSelect.disabled = outfitMorphController.options.length === 0;
  outfitMorphSelect.title = outfitMorphController.options.length
    ? `${outfitMorphController.options.length} outfit options`
    : "No outfit options found";
  document.documentElement.dataset.outfitMorphCount = String(outfitMorphController.options.length);
  applyOutfitMorphSelection("default");
}

function setBlinkWeight(weight) {
  blinkController.targets.forEach((target) => {
    if (target.expressionName && activeVrm?.expressionManager) {
      activeVrm.expressionManager.setValue(target.expressionName, weight);
      return;
    }

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

function configureBlink(mesh, vrm = null) {
  const targets = [];
  const blinkExpression = vrm?.expressionManager?.expressionMap?.[VRM_BLINK_EXPRESSION_NAME];

  if (blinkExpression) {
    targets.push({
      name: VRM_BLINK_EXPRESSION_NAME,
      expressionName: VRM_BLINK_EXPRESSION_NAME
    });
  }

  if (targets.length === 0) {
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
  }

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
  saturationPass.uniforms.saturation.value = modelPreviewOptions.saturation;
  bloom.enabled = modelPreviewOptions.bloomStrength > 0;
  bloom.strength = modelPreviewOptions.bloomStrength;
}

function setPreviewOutput(name, value) {
  const output = previewValueOutputs.get(name);
  if (output) {
    output.value = value;
    output.textContent = value;
  }
}

function formatPreviewNumber(value) {
  return Number(value).toFixed(2);
}

function setPreviewUrlParam(option, value) {
  const key = PREVIEW_QUERY_KEYS[option];
  if (!key) {
    return;
  }

  const normalizedValue = option === "readingWpm"
    ? String(Math.round(Number(value)))
    : typeof value === "number"
      ? formatPreviewNumber(value)
      : String(value);
  queryParams.set(key, normalizedValue);
  replaceUrlFromQueryParams();
}

function pruneDeprecatedPreviewUrlParams() {
  let changed = false;
  DEPRECATED_PREVIEW_QUERY_KEYS.forEach((key) => {
    if (queryParams.has(key)) {
      queryParams.delete(key);
      changed = true;
    }
  });

  if (!changed) {
    return;
  }

  replaceUrlFromQueryParams();
}

function updatePreviewControls() {
  populateMotionModeSelect();
  const motionState = getMotionPlaybackState();

  const amount = THREE.MathUtils.clamp(modelPreviewOptions.stageLighting, 0, 1);
  const stageLabel = `Stage lighting ${Math.round(amount * 100)}%`;
  stageLightingSlider.value = amount.toFixed(2);
  stageLightingSlider.setAttribute("aria-valuetext", stageLabel);
  stageLightingSlider.title = stageLabel;
  setPreviewOutput("stageLighting", `${Math.round(amount * 100)}%`);

  modelBloomSlider.value = formatPreviewNumber(modelPreviewOptions.bloomStrength);
  modelBloomSlider.setAttribute(
    "aria-valuetext",
    `Bloom ${formatPreviewNumber(modelPreviewOptions.bloomStrength)}`
  );
  setPreviewOutput("modelBloom", formatPreviewNumber(modelPreviewOptions.bloomStrength));

  materialBoostStrengthSlider.value = formatPreviewNumber(modelPreviewOptions.materialBoostStrength);
  materialBoostStrengthSlider.setAttribute(
    "aria-valuetext",
    `Material boost ${formatPreviewNumber(modelPreviewOptions.materialBoostStrength)}`
  );
  setPreviewOutput(
    "materialBoostStrength",
    formatPreviewNumber(modelPreviewOptions.materialBoostStrength)
  );

  modelSaturationSlider.value = formatPreviewNumber(modelPreviewOptions.saturation);
  modelSaturationSlider.setAttribute(
    "aria-valuetext",
    `Color saturation ${formatPreviewNumber(modelPreviewOptions.saturation)}`
  );
  setPreviewOutput("modelSaturation", formatPreviewNumber(modelPreviewOptions.saturation));

  if (
    document.activeElement !== readingWpmInput &&
    readingWpmInput.dataset.valid !== "false"
  ) {
    readingWpmInput.value = String(modelPreviewOptions.readingWpm);
  }
  readingWpmInput.setAttribute("aria-valuetext", `${modelPreviewOptions.readingWpm} words per minute`);
  setPreviewOutput("readingWpm", String(modelPreviewOptions.readingWpm));

  motionModeSelect.value = modelPreviewOptions.motion;
  motionModeSelect.title = `Motion ${getMotionModeLabel(modelPreviewOptions.motion)}`;

  previewControls.dataset.stage = amount > 0 ? "active" : "";
  previewControls.dataset.boost = modelPreviewOptions.materialBoostStrength > 0 ? "active" : "";
  previewControls.dataset.saturation = modelPreviewOptions.saturation !== 1 ? "active" : "";
  previewControls.dataset.motion = modelPreviewOptions.motion !== "still" ? "active" : "";
  document.documentElement.dataset.stageLighting = amount.toFixed(2);
  document.documentElement.dataset.modelSaturation = formatPreviewNumber(
    modelPreviewOptions.saturation
  );
  document.documentElement.dataset.modelMotion = modelPreviewOptions.motion;
  document.documentElement.dataset.effectiveModelMotion = motionState.effectiveId;
  document.documentElement.dataset.modelMotionInterlude = motionState.interludeState;

  const requestedMotion = queryParams.get(PREVIEW_QUERY_KEYS.motion);
  if (
    motionController.configured &&
    requestedMotion &&
    requestedMotion !== modelPreviewOptions.motion &&
    !getMotionModeChoices().includes(requestedMotion)
  ) {
    setPreviewUrlParam("motion", modelPreviewOptions.motion);
  }

  previewOptionButtons.forEach((button) => {
    const group = button.dataset.optionGroup;
    const active = modelPreviewOptions[group] === button.dataset.optionValue;
    button.dataset.state = active ? "active" : "";
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateLocalModelDebug() {
  const alphaLayerStats = getMmdAlphaLayerStats();
  const motionState = getMotionPlaybackState();
  document.documentElement.dataset.pmxAlphaLayers = String(alphaLayerStats.active);
  document.documentElement.dataset.pmxAlphaCutouts = String(alphaLayerStats.cutouts);
  document.documentElement.dataset.effectiveModelMotion = motionState.effectiveId;
  document.documentElement.dataset.modelMotionInterlude = motionState.interludeState;

  if (!window.localModelDebug) {
    return;
  }

  const selectedEyeMorph = eyeMorphController.options.find(
    (option) => option.id === eyeMorphController.selectedId
  );
  const selectedFaceEmote = faceEmoteController.options.find(
    (option) => option.id === faceEmoteController.selectedId
  );
  const selectedOutfitMorph = outfitMorphController.options.find(
    (option) => option.id === outfitMorphController.selectedId
  );

  Object.assign(window.localModelDebug, {
    mode: modelPreviewOptions.mode,
    lighting: modelPreviewOptions.lighting,
    stageLighting: modelPreviewOptions.stageLighting,
    materialBoost: true,
    materialBoostStrength: modelPreviewOptions.materialBoostStrength,
    saturation: modelPreviewOptions.saturation,
    bloomStrength: modelPreviewOptions.bloomStrength,
    cameraZoom: modelPreviewOptions.cameraZoom,
    readingWpm: modelPreviewOptions.readingWpm,
    motion: modelPreviewOptions.motion,
    motionLabel: motionState.selectedLabel,
    effectiveMotion: motionState.effectiveId,
    effectiveMotionLabel: motionState.effectiveLabel,
    effectiveMotionStatus: motionState.effectiveStatus,
    motionOptions: motionController.options.map((option) => option.label),
    motionStatus: motionController.status,
    motionError: motionController.error,
    motionClipDuration: motionController.clip?.duration || 0,
    motionInterlude: motionState.interludeState,
    motionInterludeId: motionState.interludeId,
    motionInterludeLabel: motionState.interludeLabel,
    motionInterludeNextIn: motionState.interludeNextIn,
    modelPreset: localAssetState?.selectedModelPreset?.label || "Configured model",
    alphaLayers: alphaLayerStats,
    eyeMorph: selectedEyeMorph?.name || "Default eyes",
    faceEmote: selectedFaceEmote?.name || "Default face",
    outfitMorph: selectedOutfitMorph?.name || "Default outfit"
  });
}

function updateModelAssetStatus() {
  if (!realDancer) {
    return;
  }

  const motionSummary = getMotionStatusSummary();
  assetStatus.dataset.state = "ready";
  assetStatus.innerHTML = `
    <span>${getModelFormatLabel(activeModelKind)} model</span>
    <strong>${localAssetState?.selectedModelPreset?.label || (modelPreviewOptions.mode === "clay" ? "Clay" : "Textured")}</strong>
    <small>${modelPreviewOptions.mode === "clay" ? "clay" : "textured"} · ${modelPreviewOptions.lighting} · ${motionSummary} · boost ${formatPreviewNumber(modelPreviewOptions.materialBoostStrength)} · sat ${formatPreviewNumber(modelPreviewOptions.saturation)} · stage ${Math.round(modelPreviewOptions.stageLighting * 100)}% · bloom ${formatPreviewNumber(modelPreviewOptions.bloomStrength)} · zoom ${formatPreviewNumber(modelPreviewOptions.cameraZoom)} · ${modelPreviewOptions.readingWpm} wpm · ${countModelBones(realDancer)} bones</small>
  `;
}

function finishInitialLoad() {
  if (loadVeil) {
    loadVeil.dataset.state = "ready";
  }
}

function refreshModelPreview({ materials: refreshMaterials = false } = {}) {
  if (refreshMaterials && realDancer) {
    setModelMaterials(realDancer);
  }
  applyModelPreviewLighting();
  updatePreviewControls();
  updateLocalModelDebug();
  updateModelAssetStatus();
}

function setStageLighting(value, syncUrl = true) {
  modelPreviewOptions.stageLighting = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
  if (syncUrl) {
    setPreviewUrlParam("stageLighting", modelPreviewOptions.stageLighting);
  }
  refreshModelPreview();
}

function setBloomStrength(value, syncUrl = true) {
  modelPreviewOptions.bloomStrength = parseClampedNumber(value, 0, 0, 0.6);
  if (syncUrl) {
    setPreviewUrlParam("bloomStrength", modelPreviewOptions.bloomStrength);
  }
  refreshModelPreview();
}

function setMaterialBoostStrength(value, syncUrl = true) {
  modelPreviewOptions.materialBoostStrength = parseClampedNumber(value, 0, 0, 1);
  if (syncUrl) {
    setPreviewUrlParam("materialBoostStrength", modelPreviewOptions.materialBoostStrength);
  }
  refreshModelPreview({ materials: true });
}

function setModelSaturation(value, syncUrl = true) {
  modelPreviewOptions.saturation = parseClampedNumber(
    value,
    DEFAULT_MODEL_PREVIEW_OPTIONS.saturation,
    0,
    2
  );
  if (syncUrl) {
    setPreviewUrlParam("saturation", modelPreviewOptions.saturation);
  }
  refreshModelPreview();
}

function setCameraZoom(value, syncUrl = true) {
  modelPreviewOptions.cameraZoom = parseClampedNumber(
    value,
    DEFAULT_MODEL_PREVIEW_OPTIONS.cameraZoom,
    CAMERA_ZOOM_MIN,
    CAMERA_ZOOM_MAX
  );
  if (syncUrl) {
    setPreviewUrlParam("cameraZoom", modelPreviewOptions.cameraZoom);
  }
  updatePreviewControls();
  updateLocalModelDebug();
  updateModelAssetStatus();
}

function getReadingWpmDraft(value) {
  const draft = String(value).trim();
  if (!draft) {
    return null;
  }

  const nextWpm = Number(draft);
  if (
    !Number.isFinite(nextWpm) ||
    nextWpm < READING_WPM_MIN ||
    nextWpm > READING_WPM_MAX
  ) {
    return null;
  }

  return Math.round(nextWpm);
}

function setReadingWpmInputValidity(isValid) {
  readingWpmInput.dataset.valid = isValid ? "true" : "false";
  readingWpmInput.setAttribute("aria-invalid", isValid ? "false" : "true");
}

function setReadingWpm(value, syncUrl = true) {
  const nextWpm = getReadingWpmDraft(value);
  if (nextWpm === null) {
    setReadingWpmInputValidity(false);
    return;
  }

  setReadingWpmInputValidity(true);
  modelPreviewOptions.readingWpm = nextWpm;
  if (syncUrl) {
    setPreviewUrlParam("readingWpm", modelPreviewOptions.readingWpm);
  }
  updatePreviewControls();
  updateLocalModelDebug();
  updateModelAssetStatus();
}

function setMotionMode(value, syncUrl = true) {
  const motion = pickMotionChoice(value);
  modelPreviewOptions.motion = motion;
  if (syncUrl) {
    setPreviewUrlParam("motion", motion);
  }
  refreshModelPreview();
  applyLoadedModelMotion();
}

function setModelPreset(id) {
  if (!id || id === localAssetState?.selectedModelPreset?.id) {
    return;
  }

  setPreviewUrlParam("modelPreset", id);
  window.location.assign(`${window.location.pathname}?${queryParams.toString()}${window.location.hash}`);
}

function handleCameraWheelZoom(event) {
  event.preventDefault();
  const nextZoom = modelPreviewOptions.cameraZoom * Math.exp(event.deltaY * 0.0012);
  setCameraZoom(nextZoom);
}

function setPreviewChoice(option, value, syncUrl = true) {
  const choices = {
    mode: MODEL_MODE_CHOICES,
    lighting: MODEL_LIGHTING_CHOICES
  }[option];

  if (!choices?.includes(value)) {
    return;
  }

  modelPreviewOptions[option] = value;
  if (syncUrl) {
    setPreviewUrlParam(option, value);
  }
  refreshModelPreview({ materials: option === "mode" });
}

function isMmdTransparentLayerMaterial(material) {
  return Boolean(material?.opacity < 1 || material?.alphaMap);
}

function isMmdAlphaCutoutMaterial(material) {
  return Boolean(material?.map?.transparent);
}

function applyMmdTransparentLayerMaterial(material) {
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = true;
  material.alphaTest = Math.max(material.alphaTest || 0, PMX_ALPHA_LAYER_ALPHA_TEST);
  material.polygonOffset = false;
  material.polygonOffsetFactor = 0;
  material.polygonOffsetUnits = 0;
  material.needsUpdate = true;
}

function applyMmdAlphaCutoutMaterial(material) {
  material.transparent = false;
  material.depthWrite = true;
  material.depthTest = true;
  material.alphaTest = Math.max(material.alphaTest || 0, PMX_ALPHA_LAYER_ALPHA_TEST);
  material.polygonOffset = false;
  material.polygonOffsetFactor = 0;
  material.polygonOffsetUnits = 0;
  material.needsUpdate = true;
}

function syncMmdMaterialDepthMode(material) {
  if (isMmdTransparentLayerMaterial(material)) {
    applyMmdTransparentLayerMaterial(material);
    return true;
  }

  if (isMmdAlphaCutoutMaterial(material)) {
    applyMmdAlphaCutoutMaterial(material);
    return true;
  }

  return false;
}

function syncMmdTextureDepthMode(material) {
  if (!isMmdAlphaCutoutMaterial(material)) {
    return false;
  }

  applyMmdAlphaCutoutMaterial(material);
  return true;
}

function applyVrmMaterialDepthMode(material) {
  if (material.transparent || material.opacity < 1) {
    material.transparent = true;
    material.depthWrite = false;
    return;
  }

  if (material.alphaTest > 0) {
    material.transparent = false;
    material.depthWrite = true;
  }
}

function queueTextureDepthModeSync(material) {
  if (!material?.map || textureDepthModeCallbackMaterials.has(material)) {
    return;
  }

  textureDepthModeCallbackMaterials.add(material);
  const syncTextureAlpha = () => {
    if (syncMmdTextureDepthMode(material)) {
      updateLocalModelDebug();
    }
  };

  if (Array.isArray(material.map.readyCallbacks)) {
    material.map.readyCallbacks.push(syncTextureAlpha);
  } else {
    syncTextureAlpha();
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

function getMaterialList(material) {
  if (!material) {
    return [];
  }
  return Array.isArray(material) ? material : [material];
}

function getModelKind(asset) {
  const configuredKind = String(asset?.kind || "").toLowerCase();
  if (configuredKind) {
    return configuredKind;
  }

  const path = String(asset?.path || asset?.url || "").toLowerCase();
  if (path.endsWith(".vrm")) {
    return "vrm";
  }
  if (path.endsWith(".pmd")) {
    return "pmd";
  }
  return "pmx";
}

function getModelFormatLabel(kind = activeModelKind) {
  return String(kind || "model").toUpperCase();
}

function countModelBones(mesh) {
  let bones = 0;
  mesh?.traverse?.((object) => {
    if (object.isBone) {
      bones += 1;
    }
  });
  return bones || mesh?.skeleton?.bones?.length || 0;
}

function isGeneratedVrmOutlineMaterial(material) {
  return Boolean(material?.isOutline || /\s+\(Outline\)$/i.test(material?.name || ""));
}

function rememberOriginalMaterialState(material) {
  if (!material || originalMaterialStates.has(material)) {
    return;
  }

  originalMaterialStates.set(material, {
    color: material.color?.clone(),
    emissive: material.emissive?.clone(),
    emissiveIntensity: material.emissiveIntensity,
    opacity: material.opacity,
    transparent: material.transparent,
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    alphaTest: material.alphaTest,
    polygonOffset: material.polygonOffset,
    polygonOffsetFactor: material.polygonOffsetFactor,
    polygonOffsetUnits: material.polygonOffsetUnits,
    visible: material.visible,
    side: material.side
  });
}

function restoreOriginalMaterialState(material) {
  const state = originalMaterialStates.get(material);
  if (!state) {
    return;
  }

  if (state.color && material.color) {
    material.color.copy(state.color);
  }
  if (state.emissive && material.emissive) {
    material.emissive.copy(state.emissive);
  }
  if (state.emissiveIntensity !== undefined) {
    material.emissiveIntensity = state.emissiveIntensity;
  }
  material.opacity = state.opacity;
  material.transparent = state.transparent;
  material.depthTest = state.depthTest;
  material.depthWrite = state.depthWrite;
  material.alphaTest = state.alphaTest;
  material.polygonOffset = state.polygonOffset;
  material.polygonOffsetFactor = state.polygonOffsetFactor;
  material.polygonOffsetUnits = state.polygonOffsetUnits;
  material.visible = state.visible;
  material.side = state.side;
}

function rememberMeshMaterials(object) {
  if (!originalMeshMaterials.has(object)) {
    originalMeshMaterials.set(object, object.material);
    getMaterialList(object.material).forEach(rememberOriginalMaterialState);
  }
}

function restoreMeshMaterials(object) {
  if (originalMeshMaterials.has(object)) {
    object.material = originalMeshMaterials.get(object);
  }
  getMaterialList(object.material).forEach(restoreOriginalMaterialState);
}

function getMmdAlphaLayerStats(mesh = realDancer) {
  const stats = {
    active: 0,
    cutouts: 0,
    transparentTextures: 0,
    transparentMaterials: 0,
    alphaMaps: 0
  };

  if (!mesh) {
    return stats;
  }

  mesh.traverse((object) => {
    if (!object.isMesh) {
      return;
    }

    getMaterialList(object.material).forEach((material) => {
      if (!material) {
        return;
      }

      if (material.map?.transparent) {
        stats.transparentTextures += 1;
      }
      if (material.transparent || material.opacity < 1) {
        stats.transparentMaterials += 1;
      }
      if (material.alphaMap) {
        stats.alphaMaps += 1;
      }
      if (material.transparent && material.depthWrite === false) {
        stats.active += 1;
      }
      if (
        material.map?.transparent &&
        material.transparent === false &&
        material.depthWrite === true &&
        material.alphaTest > 0
      ) {
        stats.cutouts += 1;
      }
    });
  });

  return stats;
}

function setModelMaterials(mesh, kind = activeModelKind) {
  mesh.traverse((object) => {
    if (!object.isMesh) {
      return;
    }
    object.castShadow = true;
    object.frustumCulled = false;
    rememberMeshMaterials(object);

    if (modelPreviewOptions.mode === "clay") {
      object.material = clayPreviewMaterial;
      return;
    }

    restoreMeshMaterials(object);
    const meshMaterials = getMaterialList(object.material);
    meshMaterials.forEach((material) => {
      if (kind === "vrm" && isGeneratedVrmOutlineMaterial(material)) {
        material.visible = false;
        material.needsUpdate = true;
        return;
      }

      material.side = THREE.DoubleSide;
      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }
      const syncedMmdDepth = kind === "pmx" || kind === "pmd"
        ? syncMmdMaterialDepthMode(material)
        : false;
      if (kind === "pmx" || kind === "pmd") {
        queueTextureDepthModeSync(material);
      }
      if (kind === "vrm") {
        applyVrmMaterialDepthMode(material);
      } else if (!syncedMmdDepth) {
        material.transparent = material.opacity < 1;
        material.depthWrite = material.opacity >= 1;
      }
      if (material.color && material.emissive) {
        material.emissive.copy(material.color).multiplyScalar(
          modelPreviewOptions.materialBoostStrength * 0.15
        );
        material.emissiveIntensity = modelPreviewOptions.materialBoostStrength;
      }
      material.needsUpdate = true;
    });
  });
}

function activateLoadedModel(mesh, modelAsset, { kind = getModelKind(modelAsset), vrm = null } = {}) {
  modelPreviewOptions = getModelPreviewOptions(localAssetState?.scene);
  updatePreviewControls();
  realDancer = mesh;
  activeVrm = vrm;
  activeModelKind = kind;
  motionController.clipCache.clear();
  window.localModel = realDancer;
  window.localVrm = activeVrm;
  realDancer.name = modelAsset.label || `Local ${getModelFormatLabel(kind)} model`;
  setModelMaterials(realDancer, kind);
  frameLoadedModel(realDancer);
  if (kind === "vrm") {
    realDancer.rotation.y = Math.PI;
    realDancer.updateMatrixWorld(true);
  }
  const blinkTargets = configureBlink(realDancer, activeVrm);
  populateEyeMorphSelect(realDancer, activeVrm);
  populateFaceEmoteSelect(activeVrm);
  populateOutfitMorphSelect(realDancer);
  scene.add(realDancer);
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
    kind,
    modelPath: modelAsset.path,
    modelPreset: modelAsset.id || "default",
    bones: countModelBones(realDancer),
    blinkMorphs: blinkTargets.map((target) => target.name),
    eyeMorphs: eyeMorphController.options.map((option) => option.name),
    eyeMorph: "Default eyes",
    faceEmotes: faceEmoteController.options.map((option) => option.name),
    faceEmote: "Default face",
    outfitMorphs: outfitMorphController.options.map((option) => option.name),
    outfitMorph: "Default outfit",
    position: realDancer.position.toArray(),
    scale: realDancer.scale.toArray(),
    stageLighting: modelPreviewOptions.stageLighting,
    motion: modelPreviewOptions.motion,
    motionOptions: motionController.options.map((option) => option.label),
    motionStatus: motionController.status,
    visible: realDancer.visible,
    vrmMeta: activeVrm?.meta || null
  };
  updateLocalModelDebug();
  applyLoadedModelMotion();
  return realDancer;
}

function loadPmxModel(modelAsset) {
  const loader = new MMDLoader();
  const kind = getModelKind(modelAsset);
  return new Promise((resolve, reject) => {
    loader.load(
      modelAsset.url,
      (mesh) => resolve(activateLoadedModel(mesh, modelAsset, { kind })),
      undefined,
      reject
    );
  });
}

function loadVrmModel(modelAsset) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  return new Promise((resolve, reject) => {
    loader.load(
      modelAsset.url,
      (gltf) => {
        const vrm = gltf.userData.vrm;
        if (!vrm?.scene) {
          reject(new Error("VRM file did not contain a usable VRM scene"));
          return;
        }
        VRMUtils.rotateVRM0(vrm);
        resolve(activateLoadedModel(vrm.scene, modelAsset, { kind: "vrm", vrm }));
      },
      undefined,
      reject
    );
  });
}

function loadConfiguredModel(state) {
  const modelAsset = state.selectedModelPreset || state.assets.find((asset) => asset.name === "model");
  if (!modelAsset?.ok || !modelAsset.url) {
    return Promise.resolve(null);
  }

  assetStatus.dataset.state = "ready";
  assetStatus.innerHTML = `
    <span>Local model</span>
    <strong>Loading</strong>
    <small>${modelAsset.label || modelAsset.path}</small>
  `;

  const kind = getModelKind(modelAsset);
  return kind === "vrm" ? loadVrmModel(modelAsset) : loadPmxModel(modelAsset);
}

function render() {
  requestAnimationFrame(render);
  const delta = clock.getDelta();
  const animationDelta = playing ? delta : 0;
  if (playing) {
    elapsed += delta;
  }
  if (realDancer) {
    updateLoadedModelMotion(animationDelta);
    updateBlink(animationDelta);
    activeVrm?.update?.(animationDelta);
    applyModelPreviewLighting();
  }
  updateCamera(elapsed);
  updateSpeechBubblePosition();
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
  cameraMode = (cameraMode + 1) % CAMERA_ANGLE_PRESETS.length;
  drag.yaw = 0;
  drag.pitch = 0;
  const preset = CAMERA_ANGLE_PRESETS[cameraMode] || CAMERA_ANGLE_PRESETS[0];
  cameraModeButton.title = `Camera: ${preset.label}`;
  cameraModeButton.setAttribute("aria-label", `Camera angle: ${preset.label}`);
});

modelPresetSelect.addEventListener("change", (event) => {
  setModelPreset(event.currentTarget.value);
});

saveDemoProfileButton.addEventListener("click", () => {
  openProfileSaveDialog();
});

profileSaveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const requestedName = normalizeDemoConfigurationName(profileSaveNameInput.value);
  profileSaveNameInput.value = requestedName;
  saveDemoProfileButton.disabled = true;
  profileSaveForm.querySelector("button[type='submit']").disabled = true;
  saveDemoProfileButton.dataset.state = "saving";
  try {
    await saveDemoProfile(requestedName);
    closeProfileSaveDialog();
  } finally {
    saveDemoProfileButton.disabled = false;
    profileSaveForm.querySelector("button[type='submit']").disabled = false;
    saveDemoProfileButton.dataset.state = "";
  }
});

cancelProfileSaveButton.addEventListener("click", () => {
  closeProfileSaveDialog();
});

profileSaveDialog.addEventListener("click", (event) => {
  if (event.target === profileSaveDialog) {
    closeProfileSaveDialog();
  }
});

eyeMorphSelect.addEventListener("change", (event) => {
  applyEyeMorphSelection(event.currentTarget.value);
});

faceEmoteSelect.addEventListener("change", (event) => {
  applyFaceEmoteSelection(event.currentTarget.value);
});

outfitMorphSelect.addEventListener("change", (event) => {
  applyOutfitMorphSelection(event.currentTarget.value);
});

motionModeSelect.addEventListener("change", (event) => {
  setMotionMode(event.currentTarget.value);
});

speechPhraseSelect.addEventListener("change", (event) => {
  setSpeechPhrase(event.currentTarget.value);
});

dialogueForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitDialoguePrompt(dialogueInput.value);
});

clearMemoryButton.addEventListener("click", () => {
  const memoryDialogWasOpen = memoryDialog.open;
  clearAllCompanionMemory();
  addDialogueLine("system", "all local memory cleared");
  if (memoryDialogWasOpen) {
    renderStoredMetadata();
  }
  showSpeechPhrase("I cleared the local memory.");
  if (memoryDialogWasOpen) {
    clearMemoryButton.focus();
  } else {
    dialogueInput.focus();
  }
});

viewMemoryButton.addEventListener("click", () => {
  openMemoryDialog();
});

closeMemoryDialog.addEventListener("click", () => {
  closeStoredMemoryDialog();
});

memoryDialog.addEventListener("click", (event) => {
  if (event.target === memoryDialog) {
    closeStoredMemoryDialog();
  }
});

stageLightingSlider.addEventListener("input", (event) => {
  setStageLighting(event.currentTarget.value);
});

modelBloomSlider.addEventListener("input", (event) => {
  setBloomStrength(event.currentTarget.value);
});

materialBoostStrengthSlider.addEventListener("input", (event) => {
  setMaterialBoostStrength(event.currentTarget.value);
});

modelSaturationSlider.addEventListener("input", (event) => {
  setModelSaturation(event.currentTarget.value);
});

readingWpmInput.addEventListener("input", (event) => {
  setReadingWpm(event.currentTarget.value);
});

previewOptionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setPreviewChoice(button.dataset.optionGroup, button.dataset.optionValue);
  });
});

applySavedDemoProfileToUrlState();
pruneDeprecatedPreviewUrlParams();
populateSpeechPhraseSelect();
setSpeechPhrase(TEST_SPEECH_PHRASES[0]);
addDialogueLine("system", isDemoMode() ? "demo mode ready" : `${OLLAMA_MODEL} ready`);
updatePreviewControls();

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
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener("pointercancel", (event) => {
  drag.active = false;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener("wheel", handleCameraWheelZoom, { passive: false });
previewControls.addEventListener("wheel", handleCameraWheelZoom, { passive: false });

canvas.addEventListener("dblclick", (event) => {
  if (!activeDancer) {
    return;
  }

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(activeDancer, true)[0];
  if (hit) {
    cameraMode = 1;
  }
});

window.addEventListener("resize", resize);

const loadAssetConfig = isDemoMode() ? loadDemoAssetConfig : loadLocalAssetConfig;

loadAssetConfig()
  .then((state) => {
    localAssetState = state;
    window.localAssetState = state;
    if (isDemoMode() && state.config?.configuration) {
      demoConfigurationName = normalizeDemoConfigurationName(state.config.configuration);
      document.documentElement.dataset.demoConfiguration = demoConfigurationName;
    }
    configureMotionOptions(state);
    populateModelPresetSelect(state);
    renderAssetStatus(state, assetStatus);
    return loadConfiguredModel(state);
  })
  .then((mesh) => {
    if (!mesh) {
      return;
    }
    window.localModel = mesh;
    updateModelAssetStatus();
  })
  .catch((error) => {
    assetStatus.dataset.state = "warning";
    assetStatus.innerHTML = `
      <span>Local assets</span>
      <strong>0/0</strong>
      <small>${error instanceof Error ? error.message : "Config unavailable"}</small>
    `;
  })
  .finally(() => {
    finishInitialLoad();
  });

render();
