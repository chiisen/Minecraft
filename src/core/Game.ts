import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

import { buildWorld } from '../world/World';

/**
 * Game —— 唯一持有 renderer / scene / camera 的地方（避免 global mutable state）。
 * 負責渲染迴圈與自由攝影機。
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: PointerLockControls;
  private readonly container: HTMLElement;
  private readonly keys = new Set<string>();
  private readonly clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fc7e8);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      3000,
    );
    this.camera.position.set(38, 30, 58);

    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.controls.getObject().position.copy(this.camera.position);
    this.scene.add(this.controls.getObject());

    this.setupLighting();
    buildWorld(this.scene);

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.addEventListener('click', this.handlePointerLock);
  }

  start(): void {
    this.renderer.setAnimationLoop(this.update);
  }

  private setupLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x4a5a4a, 1.1);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(80, 140, 60);
    this.scene.add(sun);
  }

  private readonly update = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.moveCamera(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private moveCamera(delta: number): void {
    const speed = (this.keys.has('shiftleft') ? 60 : 24) * delta;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();

    const move = new THREE.Vector3();
    if (this.keys.has('keyw')) move.add(forward);
    if (this.keys.has('keys')) move.sub(forward);
    if (this.keys.has('keyd')) move.add(right);
    if (this.keys.has('keya')) move.sub(right);
    if (this.keys.has('space')) move.y += 1;
    if (this.keys.has('controlleft')) move.y -= 1;

    if (move.lengthSq() === 0) return;
    move.normalize().multiplyScalar(speed);
    this.controls.getObject().position.add(move);
  }

  private readonly handleResize = (): void => {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code.toLowerCase());
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code.toLowerCase());
  };

  private readonly handlePointerLock = (): void => {
    this.controls.lock();
  };
}
