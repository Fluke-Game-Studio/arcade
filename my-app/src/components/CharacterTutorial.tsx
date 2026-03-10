import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function CharacterTutorial() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let scene: THREE.Scene | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let model: THREE.Object3D | null = null;
    let neck: THREE.Bone | null = null;
    let waist: THREE.Bone | null = null;
    let possibleAnims: THREE.AnimationAction[] = [];
    let mixer: THREE.AnimationMixer | null = null;
    let idle: THREE.AnimationAction | null = null;
    let currentlyAnimating = false;
    let animationFrameId = 0;

    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const MODEL_PATH =
      "https://s3-us-west-2.amazonaws.com/s.cdpn.io/1376484/stacy_lightweight.glb";
    const TEXTURE_PATH =
      "https://s3-us-west-2.amazonaws.com/s.cdpn.io/1376484/stacy.jpg";

    const canvas = canvasRef.current;
    if (!canvas) return;

    function init() {
      const backgroundColor = 0xf1f1f1;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(backgroundColor);
      scene.fog = new THREE.Fog(backgroundColor, 60, 100);

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
      });
      renderer.shadowMap.enabled = true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight, false);

      camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.set(0, -3, 30);

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.61);
      hemiLight.position.set(0, 50, 0);
      scene.add(hemiLight);

      const d = 8.25;
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.54);
      dirLight.position.set(-8, 12, 8);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize = new THREE.Vector2(1024, 1024);
      dirLight.shadow.camera.near = 0.1;
      dirLight.shadow.camera.far = 1500;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      scene.add(dirLight);

      const floorGeometry = new THREE.PlaneGeometry(5000, 5000, 1, 1);
      const floorMaterial = new THREE.MeshPhongMaterial({
        color: 0xeeeeee,
        shininess: 0,
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI * 0.5;
      floor.receiveShadow = true;
      floor.position.y = -11;
      scene.add(floor);

      const sphereGeometry = new THREE.SphereGeometry(8, 32, 32);
      const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x9bffaf });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(-0.25, -2.5, -15);
      scene.add(sphere);

      loadModel();
      update();
    }

    function loadModel() {
      const textureLoader = new THREE.TextureLoader();
      const stacyTexture = textureLoader.load(TEXTURE_PATH);
      stacyTexture.flipY = false;

      const stacyMaterial = new THREE.MeshPhongMaterial({
        map: stacyTexture,
        color: 0xffffff,
        skinning: true,
      });

      const loader = new GLTFLoader();

      loader.load(
        MODEL_PATH,
        (gltf) => {
          model = gltf.scene;
          const fileAnimations = gltf.animations;

          model.traverse((o: any) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              o.material = stacyMaterial;
            }

            if (o.isBone && o.name === "mixamorigNeck") neck = o;
            if (o.isBone && o.name === "mixamorigSpine") waist = o;
          });

          model.scale.set(7, 7, 7);
          model.position.y = -11;
          scene?.add(model);

          mixer = new THREE.AnimationMixer(model);

          const clips = fileAnimations.filter((clip) => clip.name !== "idle");

          possibleAnims = clips.map((clipData) => {
            const clip = clipData.clone();
            if (clip.tracks.length >= 12) {
              clip.tracks.splice(3, 3);
              clip.tracks.splice(9, 3);
            }
            return mixer!.clipAction(clip);
          });

          const idleAnim = THREE.AnimationClip.findByName(fileAnimations, "idle");
          if (idleAnim) {
            const idleClip = idleAnim.clone();
            if (idleClip.tracks.length >= 12) {
              idleClip.tracks.splice(3, 3);
              idleClip.tracks.splice(9, 3);
            }
            idle = mixer.clipAction(idleClip);
            idle.play();
          }

          setIsLoaded(true);
        },
        undefined,
        (error) => {
          console.error("Error loading GLB:", error);
        }
      );
    }

    function resizeRendererToDisplaySize() {
      if (!renderer) return false;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const canvasPixelWidth = renderer.domElement.width / window.devicePixelRatio;
      const canvasPixelHeight = renderer.domElement.height / window.devicePixelRatio;

      const needResize =
        canvasPixelWidth !== width || canvasPixelHeight !== height;

      if (needResize) renderer.setSize(width, height, false);
      return needResize;
    }

    function update() {
      if (mixer) mixer.update(clock.getDelta());

      if (renderer && camera && resizeRendererToDisplaySize()) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      }

      if (renderer && scene && camera) renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(update);
    }

    function getMouseDegrees(x: number, y: number, degreeLimit: number) {
      let dx = 0;
      let dy = 0;
      const w = { x: window.innerWidth, y: window.innerHeight };

      if (x <= w.x / 2) {
        const xdiff = w.x / 2 - x;
        const xPercentage = (xdiff / (w.x / 2)) * 100;
        dx = ((degreeLimit * xPercentage) / 100) * -1;
      }

      if (x >= w.x / 2) {
        const xdiff = x - w.x / 2;
        const xPercentage = (xdiff / (w.x / 2)) * 100;
        dx = (degreeLimit * xPercentage) / 100;
      }

      if (y <= w.y / 2) {
        const ydiff = w.y / 2 - y;
        const yPercentage = (ydiff / (w.y / 2)) * 100;
        dy = (((degreeLimit * 0.5) * yPercentage) / 100) * -1;
      }

      if (y >= w.y / 2) {
        const ydiff = y - w.y / 2;
        const yPercentage = (ydiff / (w.y / 2)) * 100;
        dy = (degreeLimit * yPercentage) / 100;
      }

      return { x: dx, y: dy };
    }

    function moveJoint(
      mouseCoords: { x: number; y: number },
      joint: THREE.Bone,
      degreeLimit: number
    ) {
      const degrees = getMouseDegrees(mouseCoords.x, mouseCoords.y, degreeLimit);
      joint.rotation.y = THREE.MathUtils.degToRad(degrees.x);
      joint.rotation.x = THREE.MathUtils.degToRad(degrees.y);
    }

    function handleMouseMove(e: MouseEvent) {
      if (!neck || !waist) return;
      const mouseCoords = { x: e.clientX, y: e.clientY };
      moveJoint(mouseCoords, neck, 50);
      moveJoint(mouseCoords, waist, 30);
    }

    function getRootName(object: THREE.Object3D | null) {
      let current: THREE.Object3D | null = object;
      while (current) {
        if (current.name === "stacy") return "stacy";
        current = current.parent;
      }
      return null;
    }

    function playModifierAnimation(
      from: THREE.AnimationAction,
      fSpeed: number,
      to: THREE.AnimationAction,
      tSpeed: number
    ) {
      to.setLoop(THREE.LoopOnce, 1);
      to.clampWhenFinished = true;
      to.reset();
      to.play();
      from.crossFadeTo(to, fSpeed, true);

      setTimeout(() => {
        from.enabled = true;
        to.crossFadeTo(from, tSpeed, true);
        currentlyAnimating = false;
      }, to.getClip().duration * 1000 - (tSpeed + fSpeed) * 1000);
    }

    function playOnClick() {
      if (!possibleAnims.length || !idle) return;
      const animIndex = Math.floor(Math.random() * possibleAnims.length);
      playModifierAnimation(idle, 0.25, possibleAnims[animIndex], 0.25);
    }

    function raycast(clientX: number, clientY: number) {
      if (!camera || !scene) return;

      mouse.x = (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (!intersects.length) return;

      const hitObject = intersects[0].object;
      const rootName = getRootName(hitObject);

      if (rootName === "stacy" && !currentlyAnimating) {
        currentlyAnimating = true;
        playOnClick();
      }
    }

    function handleClick(e: MouseEvent) {
      raycast(e.clientX, e.clientY);
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!e.changedTouches?.length) return;
      const touch = e.changedTouches[0];
      raycast(touch.clientX, touch.clientY);
    }

    function handleResize() {
      if (!renderer || !camera) return;
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }

    init();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("resize", handleResize);

      cancelAnimationFrame(animationFrameId);

      if (mixer) mixer.stopAllAction();

      if (scene) {
        scene.traverse((obj: any) => {
          if (obj.isMesh) {
            obj.geometry?.dispose?.();

            if (Array.isArray(obj.material)) {
              obj.material.forEach((mat: any) => {
                mat.map?.dispose?.();
                mat.dispose?.();
              });
            } else if (obj.material) {
              obj.material.map?.dispose?.();
              obj.material.dispose?.();
            }
          }
        });
      }

      renderer?.dispose();
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        background: "#f1f1f1",
      }}
    >
      {!isLoaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "grid",
            placeItems: "center",
            background: "rgba(241,241,241,0.96)",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              border: "4px solid #d9d9d9",
              borderTop: "4px solid #555",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}