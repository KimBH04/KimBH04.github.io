// FBX 뷰어. three.js 는 index.html 의 import map 으로 jsDelivr 에서 불러오며,
// 이 모듈은 Arts 모델 페이지에서만 동적으로 import 되므로 블로그 페이지에는 로드되지 않는다.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

/**
 * host 안에 캔버스를 만들고 url 의 FBX 를 렌더링한다.
 * host 가 문서에서 빠지면(다른 페이지로 이동) 스스로 정리된다.
 * @returns {Promise<{ resetView(): void, clips: string[], playClip(index: number): void }>}
 */
export async function mountViewer(host, url, onProgress) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const resize = () => {
        const { clientWidth: w, clientHeight: h } = host;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
    let mixer = null;
    let model = null;

    const dispose = () => {
        renderer.setAnimationLoop(null);
        observer.disconnect();
        controls.dispose();
        model?.traverse(obj => {
            obj.geometry?.dispose();
            for (const m of [obj.material].flat()) {
                if (!m) continue;
                for (const value of Object.values(m)) if (value?.isTexture) value.dispose();
                m.dispose();
            }
        });
        renderer.dispose();
    };

    renderer.setAnimationLoop(() => {
        if (!host.isConnected) return dispose();
        mixer?.update(clock.getDelta());
        controls.update();
        renderer.render(scene, camera);
    });

    try {
        model = await new FBXLoader().loadAsync(url, e => {
            if (e.lengthComputable) onProgress?.(e.loaded / e.total);
        });
    } catch (e) {
        dispose();
        renderer.domElement.remove();
        throw e;
    }
    scene.add(model);

    const clips = model.animations ?? [];
    const animation = clips.length > 0 ? createAnimation(model, clips) : null;
    mixer = animation?.mixer ?? null;

    // 모델 크기(블렌더 FBX 는 cm 단위인 경우가 많다)에 맞춰 카메라·조명을 둔다.
    // 애니메이션 첫 자세를 적용한 뒤, 스키닝까지 반영한 정확한 범위로 잰다.
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    const center = box.getCenter(new THREE.Vector3());
    camera.near = size / 100;
    camera.far = size * 100;
    sun.position.copy(center).add(new THREE.Vector3(1, 2, 1.5).multiplyScalar(size));
    sun.target.position.copy(center);
    scene.add(sun.target);

    const resetView = () => {
        camera.position.copy(center).add(new THREE.Vector3(0.6, 0.4, 1).normalize().multiplyScalar(size * 1.2));
        camera.updateProjectionMatrix();
        controls.target.copy(center);
        controls.update();
    };
    resetView();

    return { resetView, animation };
}

/** 클립 하나를 재생/정지하고 프레임 단위로 옮길 수 있게 한다. onUpdate 는 재생 중 매 프레임 불린다. */
function createAnimation(model, clips) {
    const mixer = new THREE.AnimationMixer(model);
    let action = null;
    let fps = 30;
    let playing = true;

    const animation = {
        mixer,
        clips: clips.map((c, i) => c.name || `Clip ${i + 1}`),
        onUpdate: null,
        get playing() { return playing; },
        get frames() { return Math.max(1, Math.round(action.getClip().duration * fps)); },
        get frame() { return Math.min(this.frames, Math.round(action.time * fps)); },
        select(index) {
            action?.stop();
            action = mixer.clipAction(clips[index]).play();
            action.paused = !playing;
            fps = frameRate(clips[index]);
            mixer.update(0);
        },
        play() {
            // 마지막 프레임에서 멈춰 있었다면 처음부터 다시 재생한다.
            if (this.frame >= this.frames) action.time = 0;
            playing = true;
            action.paused = false;
        },
        pause() {
            playing = false;
            action.paused = true;
        },
        seek(frame) {
            action.time = Math.min(frame / fps, action.getClip().duration);
            mixer.update(0); // 멈춘 상태에서도 해당 자세를 적용한다
        },
    };

    // 렌더 루프의 mixer.update 뒤에 슬라이더를 갱신할 수 있게 감싼다.
    const update = mixer.update.bind(mixer);
    mixer.update = delta => {
        update(delta);
        if (playing && delta > 0) animation.onUpdate?.();
        return mixer;
    };

    animation.select(0);
    return animation;
}

// FBX 는 키 시각만 초 단위로 담고 있으므로, 가장 촘촘한 키 간격으로 프레임레이트를 추정한다.
function frameRate(clip) {
    let step = Infinity;
    for (const track of clip.tracks) {
        for (let i = 1; i < track.times.length; i++) {
            const d = track.times[i] - track.times[i - 1];
            if (d > 1e-4 && d < step) step = d;
        }
    }
    return Number.isFinite(step) ? Math.min(240, Math.max(1, Math.round(1 / step))) : 30;
}
