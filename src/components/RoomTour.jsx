"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

gsap.registerPlugin(ScrollTrigger);

export default function RoomTour() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [explorerMode, setExplorerMode] = useState(false);
  
  // Detect mobile for FOV and touch handling
  const isMobileRef = useRef(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // Keep track of mouse positions for parallax effect (only active when not in Explorer mode)
  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Refs to share references between the main canvas mounting useEffect and the state change useEffect
  const controlsRef = useRef(null);
  const scrollTlRef = useRef(null);
  const scrollTriggerRef = useRef(null);
  const cameraRef = useRef(null);
  const cameraTargetRef = useRef(new THREE.Vector3(0, 1.5, 0));
  const explorerModeRef = useRef(false);

  // Drag look-around state references
  const isDraggingRef = useRef(false);
  const dragRotationRef = useRef({ x: 0, y: 0 });
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  // Touch direction lock: null = undecided, 'horizontal' = look-around, 'vertical' = scroll
  const touchDirectionRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const lastScrollYRef = useRef(0);
  
  // Shared state of camera position for animation
  const camStateRef = useRef({
    // Initial camera coordinates (Entrance - wide overview)
    x: 5.5,
    y: 7.5,
    z: 11.0,
    tx: -1.0,
    ty: 1.0,
    tz: 1.0,
  });

  // Track state change
  useEffect(() => {
    explorerModeRef.current = explorerMode;
    if (controlsRef.current && scrollTriggerRef.current && cameraRef.current) {
      if (explorerMode) {
        // Disable GSAP ScrollTrigger
        scrollTriggerRef.current.disable();
        controlsRef.current.enabled = true;
        
        // Lock page scroll to let OrbitControls handle all mousewheel zooms cleanly
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";

        // Set camera FOV closer (narrower angle for detailed close-ups)
        cameraRef.current.fov = isMobileRef.current ? 55 : 42;
        cameraRef.current.updateProjectionMatrix();

        // Reset controls target to the current lookAt coordinate
        controlsRef.current.target.copy(cameraTargetRef.current);
        controlsRef.current.update();
      } else {
        // Disable OrbitControls, re-enable ScrollTrigger
        controlsRef.current.enabled = false;
        scrollTriggerRef.current.enable();
        
        // Restore page scroll
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";

        // Restore camera FOV wider for scroll tour (wider on mobile)
        cameraRef.current.fov = isMobileRef.current ? 90 : 75;
        cameraRef.current.updateProjectionMatrix();

        // Return camera to animated timeline state
        const state = camStateRef.current;
        cameraRef.current.position.set(state.x, state.y, state.z);
        cameraTargetRef.current.set(state.tx, state.ty, state.tz);
        cameraRef.current.lookAt(cameraTargetRef.current);
      }
    }
  }, [explorerMode]);

  // Main canvas initialization
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050409");
    scene.fog = new THREE.FogExp2("#050409", 0.03);

    // Detect mobile screen width for FOV and touch adjustments
    isMobileRef.current = window.innerWidth <= 768;
    const baseFOV = isMobileRef.current ? 90 : 75; // Much wider FOV on mobile for broader view

    const camera = new THREE.PerspectiveCamera(
      baseFOV,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // --- Lighting Setup ---
    // Soft Ambient Light to prevent pitch black interior rooms
    const ambientLight = new THREE.AmbientLight("#eae8ff", 1.8);
    scene.add(ambientLight);

    // Warm Sun Directional Light for outside-in light and shadows
    const dirLight = new THREE.DirectionalLight("#fff9e6", 3.0);
    dirLight.position.set(12, 18, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    const d = 15;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Dynamic blue filler light from the opposite direction
    const fillLight = new THREE.DirectionalLight("#5a7fff", 1.5);
    fillLight.position.set(-12, 10, -12);
    scene.add(fillLight);

    // --- Orbit Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false; // Disable default orbit zoom to handle walk-forward scroll zoom ourselves
    controls.enabled = false; // start disabled, toggleable via state
    controlsRef.current = controls;

    // --- Starfield Background (Outside environment) ---
    const starsCount = 500;
    const starsGeo = new THREE.BufferGeometry();
    const starsPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount; i++) {
      const idx = i * 3;
      // Position them high and far away as a dome
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 80 + Math.random() * 20; // far away sphere radius
      starsPositions[idx] = r * Math.sin(phi) * Math.cos(theta);
      starsPositions[idx + 1] = Math.abs(r * Math.sin(phi) * Math.sin(theta)) + 5; // keep them above floor
      starsPositions[idx + 2] = r * Math.cos(phi);
    }
    starsGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(starsPositions, 3)
    );
    const starsMat = new THREE.PointsMaterial({
      color: "#ffffff",
      size: 0.25,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // Grid Floor underneath everything
    const gridHelper = new THREE.GridHelper(50, 50, "#4d1d8a", "#1b1130");
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // --- GLB Model Loading ---
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const loader = new GLTFLoader();
    loader.load(
      "/appartement/source/appartement.glb",
      (gltf) => {
        const model = gltf.scene;

        // Bounding Box calculations to center and scale
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Standardize dimensions (Scale to make maximum size around 14 units)
        const maxDim = Math.max(size.x, size.y, size.z);
        const desiredScale = 14 / maxDim;
        model.scale.set(desiredScale, desiredScale, desiredScale);

        // Center model geometry offset inside the group
        model.position.set(
          -center.x * desiredScale,
          -center.y * desiredScale,
          -center.z * desiredScale
        );

        // Move parent group up so the bottom floor of the model aligns with y = 0
        modelGroup.position.y = (size.y * desiredScale) / 2;

        // Traverse mesh to enable shadow casting/receiving & double-sided walls
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (child.material) {
              child.material.side = THREE.DoubleSide; // Prevents backface wall clipping
              // Enhance material metallic/roughness values if present for premium look
              if (child.material.roughness !== undefined) {
                child.material.roughness = Math.max(child.material.roughness, 0.15);
              }
            }
          }
        });

        modelGroup.add(model);
        setLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          const progress = Math.round((xhr.loaded / xhr.total) * 100);
          setLoadingProgress(progress);
        }
      },
      (error) => {
        console.error("An error occurred loading the GLB model:", error);
        setLoading(false); // hide overlay in case of failure
      }
    );

    // --- Camera Paths & Scrollytelling Setup ---
    let isLoopJumping = false;
    const handleBlockScroll = (e) => {
      if (isLoopJumping) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", handleBlockScroll, { passive: false });
    window.addEventListener("touchmove", handleBlockScroll, { passive: false });

    // Custom first-person zoom/dolly along look vector in Explorer Mode
    const handleWheelInExplorer = (e) => {
      if (!explorerModeRef.current) return;
      
      e.preventDefault();
      
      // Calculate look direction of camera
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      
      // Translate both camera and controls target along look direction (dolly speed 0.0015 for precise walk speed)
      const step = -e.deltaY * 0.0015;
      camera.position.addScaledVector(forward, step);
      controls.target.addScaledVector(forward, step);
      controls.update();
    };
    window.addEventListener("wheel", handleWheelInExplorer, { passive: false });

    const camState = camStateRef.current;
    camera.position.set(camState.x, camState.y, camState.z);
    cameraRef.current = camera;
    cameraTargetRef.current.set(camState.tx, camState.ty, camState.tz);
    camera.lookAt(cameraTargetRef.current);

    // GSAP ScrollTrigger timeline
    const scrollTl = gsap.timeline();
    scrollTlRef.current = scrollTl;

    // Attach ScrollTrigger separately and store its reference
    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 2.5, // Increased from 1.5 to 2.5 for a slower, heavier cinematic camera glide
      animation: scrollTl,
      invalidateOnRefresh: true,
      snap: {
        snapTo: 1 / 6,
        duration: { min: 0.3, max: 0.8 }, // Slower snap animation
        delay: 0.1,
        ease: "power2.out",
      },
      onLeave: (self) => {
        isLoopJumping = true;
        
        // When we reach the absolute bottom (Section 7), instantly jump back to Section 2 (Living Room)
        // Section 2 is located at exactly 1/6 of the total scroll height
        const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, totalScroll / 6);
        
        // Instantly force ScrollTrigger's scrub lag to catch up to the new scroll position
        self.update();
        const scrubTween = self.getTween();
        if (scrubTween) {
          scrubTween.progress(1);
        }
        
        // Force the timeline to instantly render the progress at 1/6 (Section 2)
        scrollTl.progress(1 / 6);

        // Temporarily block scroll momentum from immediately scrolling into the bedroom
        gsap.delayedCall(0.35, () => {
          isLoopJumping = false;
        });
      }
    });
    scrollTriggerRef.current = trigger;

    // Scroll progress bar indicator mapping (duration 6 matches 6 segments)
    scrollTl.to(".pagination-bar", {
      scaleY: 1,
      ease: "none",
      duration: 6,
    }, 0);

    // Camera animation stages (100vh per transition, total 6 segments for 7 sections)
    scrollTl
      // Stage 1: Move from Lobby to Living Room & Kitchen (scrub 0% to 16.7%)
      .to(camState, {
        x: -2.0,
        y: 2.2,
        z: 5.0,
        tx: 1.5,
        ty: 1.2,
        tz: 3.8,
        duration: 1,
        ease: "power2.inOut",
      }, 0)
      // Stage 2: Move from Living Room to Master Bedroom (scrub 16.7% to 33.3%)
      .to(camState, {
        x: 1.2,
        y: 1.8,
        z: -1.2,
        tx: 2.0,
        ty: 1.1,
        tz: -3.0,
        duration: 1,
        ease: "power2.inOut",
      }, 1)
      // Stage 3: Move from Master Bedroom to Second Bedroom (scrub 33.3% to 50%)
      .to(camState, {
        x: 2.2,
        y: 1.8,
        z: -5.0,
        tx: 3.0,
        ty: 1.2,
        tz: -6.5,
        duration: 1,
        ease: "power2.inOut",
      }, 2)
      // Stage 4: Move from Second Bedroom to Restroom (scrub 50% to 66.7%)
      .to(camState, {
        x: -2.0,
        y: 1.6,
        z: -2.0,
        tx: -3.5,
        ty: 1.4,
        tz: -3.5,
        duration: 1,
        ease: "power2.inOut",
      }, 3)
      // Stage 5: Move from Restroom to Bathroom (scrub 66.7% to 83.3%)
      .to(camState, {
        x: -2.0,
        y: 1.6,
        z: 0.5,
        tx: -3.5,
        ty: 1.4,
        tz: -1.0,
        duration: 1,
        ease: "power2.inOut",
      }, 4)
      // Stage 6: Move from Bathroom back to Living Room (scrub 83.3% to 100%)
      // This coordinate must MATCH Stage 1 exactly for a seamless spatial loop!
      .to(camState, {
        x: -2.0,
        y: 2.2,
        z: 5.0,
        tx: 1.5,
        ty: 1.2,
        tz: 3.8,
        duration: 1,
        ease: "power2.inOut",
      }, 5);

    // --- Mouse Move for Subtle Parallax ---
    const handleMouseMove = (e) => {
      mouse.current.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // --- Drag Look-around Handlers ---
    const DIRECTION_LOCK_THRESHOLD = 8; // px before we decide horizontal vs vertical

    const handleDragStart = (e) => {
      if (explorerModeRef.current) return;
      isDraggingRef.current = true;
      touchDirectionRef.current = null; // reset direction lock for new gesture
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      previousMousePositionRef.current = { x: clientX, y: clientY };
      touchStartPosRef.current = { x: clientX, y: clientY };
    };

    const handleDragMove = (e) => {
      if (!isDraggingRef.current || explorerModeRef.current) return;
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      // --- Direction lock logic for touch ---
      if (e.touches && touchDirectionRef.current === null) {
        const totalDX = Math.abs(clientX - touchStartPosRef.current.x);
        const totalDY = Math.abs(clientY - touchStartPosRef.current.y);
        // Wait until we have enough movement to determine intent
        if (totalDX < DIRECTION_LOCK_THRESHOLD && totalDY < DIRECTION_LOCK_THRESHOLD) {
          return; // not enough movement yet, wait
        }
        // Lock direction based on dominant axis
        touchDirectionRef.current = totalDX >= totalDY ? 'horizontal' : 'vertical';
      }

      // If locked to vertical on touch, allow default scroll and skip look-around
      if (e.touches && touchDirectionRef.current === 'vertical') {
        return;
      }

      // Horizontal gesture on touch → block scroll, apply look-around
      if (e.touches && e.cancelable) {
        e.preventDefault();
      }
      
      const deltaX = clientX - previousMousePositionRef.current.x;
      const deltaY = clientY - previousMousePositionRef.current.y;
      
      // Update look rotation angles (higher sensitivity on mobile for easier look-around)
      const sensitivity = isMobileRef.current ? 0.003 : 0.001;
      dragRotationRef.current.y -= deltaX * sensitivity;
      dragRotationRef.current.x = Math.max(-0.9, Math.min(0.9, dragRotationRef.current.x - deltaY * sensitivity));
      
      previousMousePositionRef.current = { x: clientX, y: clientY };
    };

    const handleDragEnd = () => {
      isDraggingRef.current = false;
      touchDirectionRef.current = null; // reset for next gesture
    };

    window.addEventListener("mousedown", handleDragStart);
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    
    window.addEventListener("touchstart", handleDragStart, { passive: true });
    // Must be non-passive so we can preventDefault to stop page scroll during look-around
    window.addEventListener("touchmove", handleDragMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);

    // --- Render Loop ---
    let animationFrameId;
    const tick = () => {
      // 1. If in Explorer mode, let OrbitControls handle camera position
      if (explorerModeRef.current) {
        controls.update();
        
        // Sync cameraTargetRef with OrbitControls target so returning back to scroll is smooth
        cameraTargetRef.current.copy(controls.target);

        // Update coordinate HUD directly in DOM for performance
        const pos = camera.position;
        const tar = controls.target;
        const hudEl = document.getElementById("coords-hud-text");
        if (hudEl) {
          hudEl.innerText = `x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}\ntx: ${tar.x.toFixed(2)}, ty: ${tar.y.toFixed(2)}, tz: ${tar.z.toFixed(2)}`;
        }
      } else {
        // 2. Otherwise, let GSAP drive camera animation + mouse parallax lag
        mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.05;
        mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.05;

        const currentX = camState.x + mouse.current.x * 0.4;
        const currentY = camState.y - mouse.current.y * 0.4;
        const currentZ = camState.z;
        camera.position.set(currentX, currentY, currentZ);

        cameraTargetRef.current.set(
          camState.tx + mouse.current.x * 0.6,
          camState.ty - mouse.current.y * 0.6,
          camState.tz
        );

        // --- Calculate drag-look rotation relative to default look direction ---
        const dir = new THREE.Vector3().subVectors(cameraTargetRef.current, camera.position);
        
        // Check if user is scrolling to slowly reset look-around offsets
        const currentScrollY = window.scrollY;
        const isScrolling = Math.abs(currentScrollY - lastScrollYRef.current) > 1.5;
        lastScrollYRef.current = currentScrollY;

        if (isScrolling && !isDraggingRef.current) {
          dragRotationRef.current.x += (0 - dragRotationRef.current.x) * 0.08;
          dragRotationRef.current.y += (0 - dragRotationRef.current.y) * 0.08;
        }

        // Calculate pitch (around default right axis) and yaw (world Y)
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(right, dragRotationRef.current.x);
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dragRotationRef.current.y);
        
        dir.applyQuaternion(pitchQuat).applyQuaternion(yawQuat);
        
        const finalTarget = new THREE.Vector3().addVectors(camera.position, dir);
        camera.lookAt(finalTarget);
      }

      // Render scene
      renderer.render(scene, camera);

      animationFrameId = requestAnimationFrame(tick);
    };
    tick();

    // --- Resize handler ---
    const handleResize = () => {
      isMobileRef.current = window.innerWidth <= 768;
      camera.aspect = window.innerWidth / window.innerHeight;
      // Update FOV dynamically on resize/orientation change
      if (!explorerModeRef.current) {
        camera.fov = isMobileRef.current ? 90 : 75;
      }
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousedown", handleDragStart);
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchstart", handleDragStart);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
      window.removeEventListener("wheel", handleBlockScroll);
      window.removeEventListener("touchmove", handleBlockScroll);
      window.removeEventListener("wheel", handleWheelInExplorer);
      
      // Ensure scrollbar is restored on component unmount
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      
      cancelAnimationFrame(animationFrameId);

      renderer.dispose();
      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      });

      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  // Copy coordinates function
  const copyCoordinates = () => {
    const hudEl = document.getElementById("coords-hud-text");
    if (hudEl) {
      const text = hudEl.innerText;
      navigator.clipboard.writeText(text).then(() => {
        const copyBtn = document.getElementById("coords-copy-btn");
        if (copyBtn) {
          copyBtn.innerText = "COPIED!";
          setTimeout(() => {
            copyBtn.innerText = "COPY CONFIG";
          }, 1500);
        }
      });
    }
  };

  return (
    <div ref={containerRef} className="scrollytelling-container">
      {/* 3D WebGL Canvas */}
      <div className={`canvas-wrapper ${explorerMode ? "interactive" : ""}`}>
        <canvas ref={canvasRef} className="webgl-canvas" />
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">LOADING APARTMENT {loadingProgress}%</div>
          </div>
        </div>
      )}

      {/* HTML Narrative Overlay Cards (Only visible when NOT in explorer mode) */}
      <div className={`overlay-content ${explorerMode ? "hidden" : ""}`}>
        <section className="narrative-section">
          <div className="glass-card">
            <span className="card-tag">Sảnh đón</span>
            <h2>Căn Hộ Hiện Đại</h2>
            <p>
              Chào mừng bạn đến với tour tham quan căn hộ 3D kiến trúc hiện đại. Hãy cuộn chuột để bắt đầu khám phá từng không gian phòng theo hành trình vòng tròn khép kín.
            </p>
            <div className="scroll-hint">
              <span className="mouse-wheel"></span>
              Cuộn chuột để bắt đầu
            </div>
          </div>
        </section>

        <section className="narrative-section">
          <div className="glass-card">
            <h2>Phòng Khách & Bếp</h2>
            <p>
              Không gian sinh hoạt chung rộng rãi nằm ở nửa trước căn hộ, kết hợp hài hòa giữa phòng khách tiện nghi tràn ngập ánh sáng và bếp ăn ấm cúng.
            </p>
          </div>
        </section>

        <section className="narrative-section">
          <div className="glass-card">
            <h2>Phòng Ngủ Master</h2>
            <p>
              Phòng ngủ chính rộng rãi nằm ở góc sau bên phải căn hộ. Tích hợp giường ngủ cỡ lớn, thiết kế màu sắc tối giản và sang trọng.
            </p>
          </div>
        </section>

        <section className="narrative-section">
          <div className="glass-card">
            <h2>Phòng Ngủ Thứ Hai</h2>
            <p>
              Phòng ngủ phụ nằm kế bên phòng ngủ chính, có diện tích vừa vặn, thích hợp làm phòng cho trẻ nhỏ, phòng làm việc hoặc phòng đón khách nghỉ ngơi.
            </p>
          </div>
        </section>

        <section className="narrative-section">
          <div className="glass-card">
            <h2>Nhà Tắm</h2>
            <p>
              Phòng tắm kính đứng sang trọng ngăn nước vách ngăn hiện đại, hệ thống vòi hoa sen cao cấp đem lại không gian thư giãn lý tưởng sau ngày dài.
            </p>
          </div>
        </section>

        <section className="narrative-section">
          <div className="glass-card">
            <h2>Nhà Vệ Sinh</h2>
            <p>
              Khu vực vệ sinh được thiết kế tối giản, sạch sẽ, trang bị đầy đủ các vật dụng tiện nghi hiện đại và lát gạch ốp chống trơn trượt sang trọng.
            </p>
          </div>
        </section>

        <section className="narrative-section">
          <div className="glass-card">
            <h2>Phòng Khách & Bếp</h2>
            <p>
              Không gian sinh hoạt chung rộng rãi nằm ở nửa trước căn hộ, kết hợp hài hòa giữa phòng khách tiện nghi tràn ngập ánh sáng và bếp ăn ấm cúng.
            </p>
          </div>
        </section>
      </div>

      {/* Explorer Mode Floating HUD */}
      {explorerMode && (
        <div className="coords-hud glass-card">
          <span className="card-tag">Explorer Active</span>
          <h3>Camera Coordinates</h3>
          <p className="hud-instruction">Drag mouse to orbit. Scroll wheel to zoom. Right-click + drag to pan.</p>
          <pre id="coords-hud-text" className="coords-display">
            x: 0.00, y: 0.00, z: 0.00{"\n"}
            tx: 0.00, ty: 0.00, tz: 0.00
          </pre>
          <button id="coords-copy-btn" className="coords-copy-btn" onClick={copyCoordinates}>
            COPY CONFIG
          </button>
        </div>
      )}

      {/* UI Elements */}
      <div className="fixed-ui">
        <h1 className="logo-text">APARTMENT TOUR</h1>
        
        {/* Toggle Explorer Mode Button */}
        <button 
          className={`explorer-toggle-btn ${explorerMode ? "active" : ""}`}
          onClick={() => setExplorerMode(!explorerMode)}
        >
          {explorerMode ? "Tắt chế độ tham quan" : "Chế độ tham quan"}
        </button>

        {/* Scroll Progress indicators (hidden in explorer) */}
        {!explorerMode && (
          <div className="pagination">
            <div className="pagination-bar"></div>
          </div>
        )}
      </div>
    </div>
  );
}
