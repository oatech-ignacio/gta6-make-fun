// WebGL renderer, scene and camera creation plus resize handling.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { PostProcessing } from './postProcessing.js';

let post = null;

export function createRenderer(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!options.preserveDrawingBuffer });
  renderer.setPixelRatio(options.pixelRatio || Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = options.shadows !== false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;       // tone mapping happens in the post-processing composite
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 4000);
  camera.position.set(380, 30, 60);
  game.renderer = renderer; game.scene = scene; game.camera = camera;
  post = new PostProcessing(renderer);
  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);
  return { renderer, scene, camera };
}

export function resizeRenderer() {
  const w = window.innerWidth, h = window.innerHeight;
  game.renderer.setSize(w, h, false);
  game.camera.aspect = w / h; game.camera.updateProjectionMatrix();
  if (post) post.setSize(w, h, game.renderer.getPixelRatio());
}

export function renderFrame(exposure = 1) {
  post.exposure = exposure;
  post.render(game.scene, game.camera);
}

export function getPostProcessing() { return post; }
