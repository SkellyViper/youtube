import {useFrame, useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import React, {useContext, useEffect, useLayoutEffect, useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {MountOffsetContext, TimelineContext} from '../../../engine/context';
import {cyber} from '../../../styles/cyber';
import {ThemeContext} from '../../../styles/ThemeContext';
import type {Rig} from './rig';

export type BloomSettings = {
  readonly strength?: number;
  readonly radius?: number;
  readonly threshold?: number;
};

/**
 * The one 3D stage every sample uses. It wraps Remotion's <ThreeCanvas> and adds
 * the shared look:
 *
 *  - engine contexts are bridged into the R3F tree, so `useBeat()`,
 *    `useActiveTime()`, `useCameraRig()` work inside 3D components;
 *  - the camera is set from a `Rig` every frame (no orbit controls, no clocks);
 *  - HDR render target (MSAA x4) -> bloom -> neutral tone mapping -> sRGB.
 *    Only colours brighter than `bloom.threshold` glow, so glow is opt-in:
 *    multiply a colour with `hdr(hex, cyber.emissive.strong)`;
 *  - exponential fog in the void colour for depth.
 *
 * Nothing in here animates by itself: a frame's pixels depend only on the
 * props, which depend only on the Remotion frame. In the live Player the
 * canvas renders on demand (when a frame changes), so holds cost nothing.
 */
export const Stage3D: React.FC<{
  readonly rig: Rig;
  readonly bloom?: BloomSettings | false;
  /** Fog density; 0 disables. */
  readonly fog?: number;
  readonly fogColor?: string;
  readonly background?: string;
  readonly exposure?: number;
  readonly style?: React.CSSProperties;
  readonly children?: React.ReactNode;
}> = ({rig, bloom, fog = cyber.fog.density, fogColor = cyber.fog.color, background = cyber.color.void, exposure = 1, style, children}) => {
  const {width, height} = useVideoConfig();
  const timeline = useContext(TimelineContext);
  const offset = useContext(MountOffsetContext);
  // R3F renders into its own reconciler: contexts must be bridged explicitly.
  const theme = useContext(ThemeContext);

  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={1}
      frameloop="demand"
      gl={{antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false}}
      camera={{fov: rig.fov, near: cyber.camera.near, far: cyber.camera.far, position: rig.position as [number, number, number]}}
      style={{position: 'absolute', inset: 0, ...style}}
    >
      <TimelineContext.Provider value={timeline}>
        <MountOffsetContext.Provider value={offset}>
         <ThemeContext.Provider value={theme}>
          <RigCamera rig={rig} />
          <color attach="background" args={[background]} />
          {fog > 0 ? <fogExp2 attach="fog" args={[fogColor, fog]} /> : null}
          <PostFX bloom={bloom} exposure={exposure} />
          {children}
         </ThemeContext.Provider>
        </MountOffsetContext.Provider>
      </TimelineContext.Provider>
    </ThreeCanvas>
  );
};

/** Applies the rig to the default camera and requests a redraw whenever the frame changes. */
const RigCamera: React.FC<{readonly rig: Rig}> = ({rig}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  // Subscribing to the frame makes this component re-run on every frame, even
  // if the rig object happens to be referentially stable.
  const frame = useCurrentFrame();

  useLayoutEffect(() => {
    const roll = rig.roll ?? 0;
    camera.position.set(rig.position[0], rig.position[1], rig.position[2]);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(rig.target[0], rig.target[1], rig.target[2]);
    if (camera.fov !== rig.fov) {
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  });

  useEffect(() => {
    invalidate();
  }, [frame, rig, invalidate]);

  return null;
};

/**
 * Final pass: static triangular dither of about one 8-bit step. Dark
 * gradients (sky haze, fog, bloom tails) would otherwise band visibly,
 * especially after H.264. The pattern depends only on the pixel position,
 * so holds stay pixel-identical.
 */
const DitherShader = {
  uniforms: {tDiffuse: {value: null}, uAmount: {value: 1.6 / 255}},
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float n = hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 71.7) - 1.0;
      gl_FragColor = vec4(c.rgb + n * uAmount, 1.0);
    }
  `,
};

const PostFX: React.FC<{readonly bloom?: BloomSettings | false; readonly exposure: number}> = ({bloom, exposure}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  const fx = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(width, height, {type: THREE.HalfFloatType, samples: 4});
    const composer = new EffectComposer(gl, target);
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1, 1, 1);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(DitherShader));
    return {composer, bloomPass, target};
  }, [gl, scene, camera, width, height]);

  useEffect(
    () => () => {
      fx.composer.dispose();
      fx.target.dispose();
    },
    [fx],
  );

  gl.toneMapping = THREE.NeutralToneMapping;
  gl.toneMappingExposure = exposure;
  fx.bloomPass.enabled = bloom !== false;
  const b = bloom === false ? {} : (bloom ?? {});
  fx.bloomPass.strength = b.strength ?? cyber.bloom.strength;
  fx.bloomPass.radius = b.radius ?? cyber.bloom.radius;
  fx.bloomPass.threshold = b.threshold ?? cyber.bloom.threshold;

  // Taking over the render call (priority 1) is not an animation loop: it only
  // draws the current, frame-determined scene through the composer.
  useFrame(() => {
    fx.composer.render();
  }, 1);

  return null;
};
