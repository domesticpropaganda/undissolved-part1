import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Scene {
  constructor() {
    // --- Preloader setup ---
    this.preloader = document.createElement('div');
    this.preloader.id = 'preloader';
    this.preloader.style.position = 'fixed';
    this.preloader.style.top = '0';
    this.preloader.style.left = '0';
    this.preloader.style.width = '100vw';
    this.preloader.style.height = '100vh';
    this.preloader.style.display = 'flex';
    this.preloader.style.alignItems = 'center';
    this.preloader.style.justifyContent = 'center';
    this.preloader.style.background = 'rgba(0,0,0,0.85)';
    this.preloader.style.zIndex = '9999';
    this.preloaderText = document.createElement('span');
    this.preloaderText.style.color = 'white';
    this.preloaderText.style.fontSize = '2rem';
    this.preloaderText.textContent = 'Loading...';
    this.preloader.appendChild(this.preloaderText);
    document.body.appendChild(this.preloader);

    // --- Three.js setup ---
    this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('three-canvas'), antialias: true });
    this.renderer.setClearColor(0x000000);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 5;
    window.addEventListener('resize', () => this.onResize());

    // --- State ---
    this.pointCount = 3000;
    this.assetsLoaded = false;
    this.timeline = [];
    this.glbCache = {};
    this.points = null;

    // --- Begin asset preloading ---
    this.onAssetsLoaded = () => {
      this.showInitialCloud();
      this.animate();
      this.setupSwipeNavigation(); // Use swipe navigation instead of scroll
    };
    this.preloadAllAssets().then(() => {
      this.assetsLoaded = true;
      this.preloader.remove();
      if (this.onAssetsLoaded) this.onAssetsLoaded();
    });
  }

  async preloadAllAssets() {
    // Load timeline JSON
    const resp = await fetch('/assets/data/plastikwelt_timeline.json');
    const timeline = await resp.json();
    this.timeline = timeline;
    console.log('[DEBUG] Timeline loaded:', timeline);
    this.buildTimelineStates(); // <-- Ensure timelineStates is built after loading timeline
    // Collect unique mesh names
    const meshSet = new Set();
    timeline.forEach(entry => meshSet.add(entry.mesh));
    const meshList = Array.from(meshSet);
    // Preload all GLBs
    const loader = new GLTFLoader();
    let loadedCount = 0;
    const total = meshList.length;
    const updatePreloader = (name) => {
      loadedCount++;
      const percent = Math.round((loadedCount / total) * 100);
      this.preloaderText.textContent = `Loading ${name} (${percent}%)`;
      console.log(`[Preloader] Loaded: ${name} (${loadedCount}/${total})`);
    };
    const promises = meshList.map(meshName => {
      return new Promise(resolve => {
        loader.load(`/assets/models/${meshName}`, gltf => {
          this.glbCache[meshName] = gltf;
          updatePreloader(meshName);
          resolve();
        }, undefined, err => {
          console.error('Failed to load', meshName, err);
          updatePreloader(meshName);
          resolve();
        });
      });
    });
    await Promise.all(promises);
    console.log('[Preloader] All assets loaded.');
  }

  createRandomCloud(count = this.pointCount) {
    // Remove previous points if any
    if (this.points) this.scene.remove(this.points);
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    for (let i = 0; i < count; i++) {
      // Spherical random distribution
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 2 + Math.random() * 2;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      positions.push(x, y, z);
      colors.push(1, 1, 1, 1); // all white, alpha=1
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    // Remove bokeh/blur: ensure sharp, non-blurred particles
    const material = new THREE.PointsMaterial({
      size: 0.035, // default hardcoded value
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      sizeAttenuation: true, // keep perspective scaling
      map: null,
      alphaTest: 0.01 // ensures sharp edges
    });
    this.points = new THREE.Points(geometry, material);
    this.scene.add(this.points);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- Add camera orbit and basic animation loop for visual feedback ---
  animate() {
    // Camera orbit logic
    if (!this.orbitAngle) this.orbitAngle = 0;
    if (!this.orbitAngle2) this.orbitAngle2 = 0;
    this.orbitAngle += 0.003;
    this.orbitAngle2 += 0.007;
    const radius = 4.5; // default hardcoded value
    const x = Math.cos(this.orbitAngle) * radius;
    const y = Math.sin(this.orbitAngle2) * 2;
    const z = Math.sin(this.orbitAngle) * radius;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
    // Fade distant particles (if points exist)
    if (this.points) {
      const positions = this.points.geometry.attributes.position;
      const colors = this.points.geometry.attributes.color;
      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i);
        const py = positions.getY(i);
        const pz = positions.getZ(i);
        const dx = px - this.camera.position.x;
        const dy = py - this.camera.position.y;
        const dz = pz - this.camera.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const alpha = THREE.MathUtils.clamp(1.5 - dist * 0.3, 0.2, 1.0);
        colors.setW(i, alpha);
      }
      colors.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }

  // --- Swipe-based timeline navigation (trackpad/touchpad/keyboard first) ---
  setupSwipeNavigation() {
    this._swipeLocked = false;
    this._swipeThreshold = 60; // px, good for trackpad/touchpad, tune as needed
    this._swipeAccum = 0;
    this._activeMorphIdx = 0;
    this._lastTimelineStateIdx = 0;
    this._introFaded = false;
    // Helper: go to timeline state by offset (+1/-1)
    this._gotoTimelineState = (dir) => {
      if (this._swipeLocked) return;
      if (!this.timelineStates || !this.timelineStates.length) return; // Guard: timelineStates must exist
      // Fade out intro overlay on first interaction and morph to first mesh
      if (!this._introFaded) {
        const intro = document.getElementById('intro-overlay');
        if (intro) {
          intro.classList.add('fade-out');
          setTimeout(() => { intro.style.display = 'none'; }, 900);
        }
        this._introFaded = true;
        // Find the first mesh state (should be at index 1)
        const firstMeshIdx = this.timelineStates.findIndex(s => s.type === 'mesh');
        if (firstMeshIdx !== -1) {
          this.morphToTimelineState(firstMeshIdx, dir);
        }
        return;
      }
      let idx = this._activeMorphIdx + dir;
      idx = Math.max(0, Math.min(this.timelineStates.length - 1, idx));
      if (idx !== this._activeMorphIdx) {
        this._lastTimelineStateIdx = this._activeMorphIdx; // Track previous for direction
        this.morphToTimelineState(idx, dir);
      }
    };
    // Wheel event (trackpad/touchpad/mouse)
    window.addEventListener('wheel', (e) => {
      if (this._swipeLocked) return;
      // Only vertical
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      this._swipeAccum += e.deltaY;
      if (this._swipeAccum > this._swipeThreshold) {
        this._swipeAccum = 0;
        this._gotoTimelineState(1);
      } else if (this._swipeAccum < -this._swipeThreshold) {
        this._swipeAccum = 0;
        this._gotoTimelineState(-1);
      }
      e.preventDefault();
    }, { passive: false });
    // Keyboard navigation (up/down/PageUp/PageDown)
    window.addEventListener('keydown', (e) => {
      if (this._swipeLocked) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        this._gotoTimelineState(1);
        e.preventDefault();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        this._gotoTimelineState(-1);
        e.preventDefault();
      }
    });
  }

  // --- Call this after assets are loaded to show a random cloud ---
  showInitialCloud() {
    this.createRandomCloud();
    console.log('[Scene] Initial random cloud generated and displayed.');
    // Start at cloud state, do NOT morph to mesh or show overlay until user interacts
    this._activeMorphIdx = 0;
    this._lastTimelineStateIdx = 0;
    // No call to morphToTimelineState here!
  }

  // --- Timeline mapping with clouds between meshes ---
  buildTimelineStates() {
    // Build a new array: [cloud, mesh0, cloud, mesh1, ... cloud, meshN, cloud]
    this.timelineStates = [];
    for (let i = 0; i < this.timeline.length; i++) {
      if (i === 0) this.timelineStates.push({ type: 'cloud' });
      this.timelineStates.push({ type: 'mesh', mesh: this.timeline[i].mesh, entry: this.timeline[i] });
      this.timelineStates.push({ type: 'cloud' });
    }
  }

  // --- Elastic scroll logic (DISABLED in swipe mode) ---
  setupElasticScroll() {
    // Disabled: replaced by swipe navigation
  }

  // --- Morphing system ---
  /**
   * Morphs to the given timeline state index. Ensures robust mesh↔cloud↔mesh sequence, correct contamination highlight, and proper navigation locking.
   * @param {number} idx - Target timeline state index
   * @param {number} dir - Navigation direction (+1 for forward, -1 for backward)
   */
  async morphToTimelineState(idx, dir = 1) {
    if (!this.timelineStates || !this.timelineStates[idx]) return;
    if (this._activeMorphIdx === idx) return; // Prevent redundant morphs
    if (this._swipeLocked) return; // Ignore navigation during morphs/animations
    const prevState = this.timelineStates[this._activeMorphIdx];
    this._activeMorphIdx = idx;
    // Cancel any running contamination highlight and increment version
    this._contamHighlightVersion = (this._contamHighlightVersion || 0) + 1;
    this._cancelContaminationHighlight?.();
    const state = this.timelineStates[idx];
    this._swipeLocked = true;
    console.log('[DEBUG] morphToTimelineState', idx, state);

    // --- Mesh→cloud→mesh (forward) or mesh←cloud←mesh (backward) ---
    if (state.type === 'cloud' && prevState && prevState.type === 'mesh') {
      if (window.updateTimelineOverlay) {
        window.updateTimelineOverlay({ year: '', event: '', species: '', contaminationRate: 0, description: '', show: false });
      }
      await this._morphMeshToCloud();
      // Auto-advance to mesh after cloud, in both directions
      let nextIdx = dir > 0 ? idx + 1 : idx - 1;
      if (this.timelineStates[nextIdx] && this.timelineStates[nextIdx].type === 'mesh') {
        this._swipeLocked = false;
        setTimeout(() => {
          if (this._activeMorphIdx === idx) {
            this.morphToTimelineState(nextIdx, dir);
          }
        }, 100);
      } else {
        this._swipeLocked = false;
      }
      return;
    }

    // --- Mesh state: always morph from current (cloud or mesh) to mesh, then overlay, then contamination highlight ---
    if (state.type === 'mesh') {
      const meshMorphDuration = 3.0; // keep in sync with _morphCloudToMesh default
      await this._morphCloudToMesh(state.mesh, meshMorphDuration); // duration x2
      if (window.updateTimelineOverlay) {
        const entry = state.entry;
        console.log('[DEBUG] Calling updateTimelineOverlay for mesh:', entry);
        window.updateTimelineOverlay({
          year: entry.year,
          event: entry.event,
          species: entry.Species,
          contaminationRate: entry.contaminationRate,
          description: entry.description,
          show: true
        });
      }
      const contaminationRate = state.entry?.contaminationRate || 0;
      const version = this._contamHighlightVersion;
      // Start contamination highlight immediately with stat animation
      this.startContaminationHighlight?.(contaminationRate, version);
      // Unlock navigation after morph duration (matches mesh morph)
      setTimeout(() => { this._swipeLocked = false; },  2500);
      return;
    }

    // --- Cloud state (not after mesh): just morph to cloud, unlock after ---
    if (state.type === 'cloud') {
      if (window.updateTimelineOverlay) {
        window.updateTimelineOverlay({ year: '', event: '', species: '', contaminationRate: 0, description: '', show: false });
      }
      await this._morphMeshToCloud();
      this._swipeLocked = false;
      return;
    }
  }

  // --- Mesh→cloud morph with custom easing ---
  async _morphMeshToCloud(duration = 1.0, easing = 'easeOut') {
    if (!this.points) return this.createRandomCloud();
    const positions = this.points.geometry.attributes.position;
    const start = [];
    const end = [];
    for (let i = 0; i < positions.count; i++) {
      start.push(positions.getX(i), positions.getY(i), positions.getZ(i));
      // Target: new random cloud position
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 2 + Math.random() * 2;
      end.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    await this._startMorphAsync(start, end, duration, easing);
  }

  // --- Cloud→mesh morph with custom easing ---
  async _morphCloudToMesh(meshName, duration = 2.0, easing = 'easeIn') {
    // --- Camera orbit animation: 90deg right (clockwise), ease-in-out, match morph duration ---
    const startAngle = this.orbitAngle || 0;
    const endAngle = startAngle + Math.PI / 2; // 90deg right (CW)
    const startAngle2 = this.orbitAngle2 || 0;
    // Animate orbitAngle during morph
    let t = 0;
    const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const animateCamera = () => {
      t += 1 / 60 / duration;
      let progress = Math.min(1, t);
      progress = easeInOut(progress);
      this.orbitAngle = startAngle + (endAngle - startAngle) * progress;
      // Optionally, keep orbitAngle2 unchanged for now
      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        this.orbitAngle = endAngle;
      }
    };
    animateCamera();
    const gltf = this.glbCache[meshName];
    if (!gltf) return;
    let mesh;
    gltf.scene.traverse(child => {
      if (child.isMesh && !mesh) mesh = child;
    });
    if (!mesh) return;
    const meshPositions = mesh.geometry.attributes.position.array;
    const positions = this.points.geometry.attributes.position;
    const start = [];
    const end = [];
    for (let i = 0; i < positions.count; i++) {
      start.push(positions.getX(i), positions.getY(i), positions.getZ(i));
      const idx3 = (i * 3) % meshPositions.length;
      const scale = 3.0;
      end.push(meshPositions[idx3] * scale, meshPositions[idx3 + 1] * scale, meshPositions[idx3 + 2] * scale);
    }
    await this._startMorphAsync(start, end, duration, easing);
  }

  // --- Core morphing function (async, supports custom easing) ---
  _startMorphAsync(start, end, duration, easing = 'easeInOut') {
    return new Promise(resolve => {
      if (!this.points) return resolve();
      const positions = this.points.geometry.attributes.position;
      const count = positions.count;
      // Easing functions
      const easings = {
        easeIn: t => t * t,
        easeOut: t => 1 - Math.pow(1 - t, 2),
        easeInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
        easeOutBack: t => 1 + 1.70158 * Math.pow(t - 1, 3) + 1.70158 * (t - 1) * Math.pow(t - 1, 2)
      };
      const ease = easings[easing] || easings['easeInOut'];
      let t = 0;
      const animateMorph = () => {
        t += 1 / 60 / duration;
        let progress = Math.min(1, t);
        progress = ease(progress);
        for (let i = 0; i < count; i++) {
          const ix = i * 3;
          positions.setX(i, start[ix] + (end[ix] - start[ix]) * progress);
          positions.setY(i, start[ix + 1] + (end[ix + 1] - start[ix + 1]) * progress);
          positions.setZ(i, start[ix + 2] + (end[ix + 2] - start[ix + 2]) * progress);
        }
        positions.needsUpdate = true;
        if (progress < 1) {
          requestAnimationFrame(animateMorph);
        } else {
          resolve();
        }
      };
      animateMorph();
    });
  }

  // --- Elastic scroll loop (DISABLED in swipe mode) ---
  elasticScrollLoop() {
    // Disabled: replaced by swipe navigation
  }

  /**
   * Animate contamination highlight: smoothly transitions a percentage of points to red.
   * @param {number} rate - Fraction (0-1) of points to highlight
   * @param {number} version - Used to cancel previous highlights
   */
  startContaminationHighlight(rate = 0, version = 0) {
    this._cancelContaminationHighlight?.(); // Cancel previous effect if any
    if (!this.points || !rate || rate <= 0) return;
    const colors = this.points.geometry.attributes.color;
    const count = colors.count;
    const numRed = Math.floor(count * rate);
    // Randomly pick indices to turn red
    const indices = Array.from({length: count}, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const redIndices = indices.slice(0, numRed);
    // Store original colors
    const originalColors = new Float32Array(colors.array);
    let running = true;
    this._cancelContaminationHighlight = () => {
      running = false;
      colors.array.set(originalColors);
      colors.needsUpdate = true;
    };
    // Animate fade-in for each red particle with random delay
    const fadeDuration = 0.7; // seconds
    const delays = redIndices.map(() => Math.random() * 1.5);
    const startTime = performance.now();
    // Target color: #FF0138 (rgb: 255,1,56)
    const contamR = 255/255, contamG = 1/255, contamB = 56/255;
    const animate = () => {
      if (!running || version !== this._contamHighlightVersion) return;
      const now = performance.now();
      let anyActive = false;
      for (let i = 0; i < redIndices.length; i++) {
        const idx = redIndices[i];
        const delay = delays[i] * 1000;
        const t = Math.min(1, Math.max(0, (now - startTime - delay) / (fadeDuration * 1000)));
        if (t < 1) anyActive = true;
        // Lerp from original color to #FF0138
        const r = contamR * t + originalColors[idx * 4] * (1 - t);
        const g = contamG * t + originalColors[idx * 4 + 1] * (1 - t);
        const b = contamB * t + originalColors[idx * 4 + 2] * (1 - t);
        const a = originalColors[idx * 4 + 3];
        colors.setXYZW(idx, r, g, b, a);
      }
      colors.needsUpdate = true;
      if (anyActive) requestAnimationFrame(animate);
    };
    animate();
  }
}

// --- Overlay/stat update helper (called from morphToTimelineState) ---
// (REMOVED: Use the implementation in index.html for animated overlay/stat updates)