'use client'

import { memo, Suspense, useEffect, useRef, useMemo, useState, FC, ComponentProps } from 'react'
import { Texture, RenderTarget, Color, Program, Mesh, Triangle, Vec2, Flowmap } from 'ogl'
import { Canvas, useOGL, useFrame } from 'react-ogl'
import { cnoise } from '@/shaders/cnoise'
import { fbm } from '@/shaders/fbm'

// Constants
const FLOW_CONFIG = {
  DISSIPATION: 0.9925,
  FALLOFF: 0.3,
  LERP_FACTOR: 0.18,
  VELOCITY_LERP: 0.15,
  COLOR_LERP: 0.075,
  MOUSE_THRESHOLD: 10,
  MOUSE_MULTIPLIER: 1000,
}

const PERLIN_CONFIG = {
  SPEED: 0.05,
  TIME_MULTIPLIER: 0.002,
  SCROLL_MULTIPLIER: 0.001,
  SCROLL_LERP: 0.08,
  DITHER_BIAS: 0.2,
  FREQUENCY: 30.0,
}

const COLORS = {
  DARK: '#101216',
  LIGHT: '#C9C9C9',
  ACCENT_LIGHT: '#E1FF00',
  ACCENT_DARK: '#E6FE52'
}

const DARK_IDS = ['performance', 'lead-gen']

const lerp = (a: number, b: number, t: number) => a + t * (b - a)

const calculateViewport = (camera) => {
  const fov = camera.fov * (Math.PI / 180)
  const height = 2 * Math.tan(fov / 2) * camera.position.z
  const width = height * camera.aspect
  return { width, height }
}

interface GenerativeBackgroundProps extends ComponentProps<'div'> {
  dark?: boolean
  fixed?: boolean
  bias?: number
  frequency?: number
}

export const GenerativeBackground: FC<GenerativeBackgroundProps> = memo((props) => {
  const {
    dark,
    className,
    fixed = true,
    bias = PERLIN_CONFIG.DITHER_BIAS,
    frequency = PERLIN_CONFIG.FREQUENCY,
    ...rest
  } = props;
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} className={`${className} ${fixed ? 'fixed' : 'absolute'} inset-0 w-full h-screen -z-[1] transform-gpu`} {...rest}>
      <Suspense fallback={null}>
        <Canvas camera={{ fov: 35 }} dpr={[1, 2]}>
          <Models
            dark={dark}
            fixed={fixed}
            bias={bias}
            frequency={frequency}
            container={ref}
          />
        </Canvas>
      </Suspense>
    </div>
  )
})

interface ModelsProps extends GenerativeBackgroundProps {
  container: RefObject<HTMLDivElement>
}

const Models: FC<ModelsProps> = memo(({ dark, fixed, bias, frequency, container }: ModelsProps) => {
  const [texture, setTexture] = useState(null);
  const perlinRef = useRef<any>(null)
  const lastTime = useRef<number | null>(null);

  const { gl, size, scene, camera, renderer } = useOGL();

  const mouse = useRef(new Vec2(0, 0));
  const mouseLerp = useRef(new Vec2(0, 0));
  const lastMouse = useRef(new Vec2(0, 0));
  const velocity = useRef(new Vec2(0, 0));
  const darkMultiplier = useRef(dark ? 1 : 0);
  const darkProgress = useRef(dark ? 1 : 0);
  const opacityFade = useRef(0);

  const blueNoise = useMemo(() => {
    if (!gl) return null;

    if (texture !== null) return texture;

    const loader = new Texture(gl, {
      generateMipmaps: false,
    });

    return loader;
  }, [gl])

  useEffect(() => {
    if (blueNoise.image) return;

    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.src = '/bn-dither-rect.png';

    image.onload = () => {
      blueNoise.image = image;
      blueNoise.image.width = image.naturalWidth;
      blueNoise.image.height = image.naturalHeight;
      blueNoise.wrapS = blueNoise.WrapR = blueNoise.WrapT = gl.REPEAT;
      blueNoise.update();

      perlinRef.current.program.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }
  }, [blueNoise])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const { clientX, clientY } = event;

      const topOffset = container.current?.getBoundingClientRect()?.top ?? 0;

      const xPos = clientX;
      const yPos = clientY - topOffset;

      const normalizedX = (xPos / window.innerWidth)
      const normalizedY = 1 - (yPos / window.innerHeight)

      mouse.current.set(normalizedX, normalizedY);

      if (!lastTime.current) {
        lastTime.current = performance.now();
        lastMouse.current.set(xPos, yPos);
      }

      const deltaX = xPos - lastMouse.current.x;
      const deltaY = yPos - lastMouse.current.y;

      lastMouse.current.set(xPos, yPos);

      const time = performance.now();

      const delta = Math.max(8, time - lastTime.current);

      lastTime.current = time;

      velocity.current.set(deltaX / delta, deltaY / delta)

      velocity.current.needsUpdate = true;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mousemove', handleMouseMove);
      }
    }
  }, [gl])

  useEffect(() => {
    if (typeof window === 'undefined' || dark) return;

    const sections = document.querySelectorAll('[data-section-id]');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.dataset.sectionId;
          const isDark = DARK_IDS.includes(id);

          if (isDark) {
            // perlinRef.current.program.uniforms.uColorOne.value = new Color(COLORS.DARK);
            darkMultiplier.current = 1;
          } else {
            // perlinRef.current.program.uniforms.uColorOne.value = new Color(COLORS.LIGHT);
            darkMultiplier.current = 0;
          }
        }
      })
    }, {
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0
    })

    sections?.forEach((section) => observer.observe(section));

    return () => observer?.disconnect();
  }, [])

  const flowmap = useMemo(() => {
    if (!gl) return null;
    return new Flowmap(gl, {
      dissipation: FLOW_CONFIG.DISSIPATION,
      falloff: FLOW_CONFIG.FALLOFF,
      size: 128,
      alpha: 0.25
    })
  }, [gl])

  const viewport = useMemo(() => calculateViewport(camera), [size])

  const perlinProgram = useMemo(() => {
    if (!gl) return null;
    return new Program(gl, {
      vertex: `
        attribute vec2 uv;
        attribute vec2 position;

        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position, 0, 1);
        }
      `,
      fragment: `
        precision highp float;

        uniform vec3 uColorOne;
        uniform vec3 uColorTwo;
        uniform float uTime;
        uniform float uScroll;
        uniform float uFrequency;
        uniform float uDarkProgress;
        
        varying vec2 vUv;

        ${cnoise}
        ${fbm}

        void main() {
          float speed = 0.075;
          float frequency = uFrequency;

          vec2 normalizedUv = vUv * frequency * 0.5 + 0.5;

          normalizedUv.y += uScroll;
          normalizedUv.x += (uScroll * 0.01);

          float noise2Multiplier = mix(1.25, 1.5, uDarkProgress);

          float noise = cnoise(vec3(normalizedUv / 1.02, uTime * speed));
          float noise2 = fbm(vec3(normalizedUv / noise2Multiplier, uTime * speed));
          
          vec3 color = mix(uColorTwo, uColorOne, noise + (noise2 * 1.35)) - abs(0.275 + uTime * 0.001);
          
          gl_FragColor = vec4(color, 1.0);
        }  
      `,
      uniforms: {
        uColorOne: { value: new Color('#ffffff') },
        uColorTwo: { value: new Color('#000000') },
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uFrequency: { value: frequency },
        uDarkProgress: { value: 0 }
      }
    })
  }, [gl])

  const perlinMesh = useMemo(() => {
    if (!gl) return null;
    return new Mesh(gl, {
      geometry: new Triangle(gl),
      program: perlinProgram
    })
  }, [gl, perlinProgram])

  const renderTarget = useMemo(() => new RenderTarget(gl, {
    width: 128,
    height: 128,
  }), [gl])

  useFrame((state, time, frame) => {
    perlinRef.current.program.uniforms.uTime.value = time * PERLIN_CONFIG.TIME_MULTIPLIER;

    perlinProgram.uniforms.uTime.value = time * PERLIN_CONFIG.TIME_MULTIPLIER;

    if (fixed) {
      perlinProgram.uniforms.uScroll.value = lerp(perlinProgram.uniforms.uScroll.value, -1 * (window.scrollY * PERLIN_CONFIG.SCROLL_MULTIPLIER), PERLIN_CONFIG.SCROLL_LERP);
    }

    perlinRef.current.program.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    flowmap.aspect = window.innerWidth / window.innerHeight;

    if (flowmap) {
      const mouseDelta = Math.max(mouse.current.x * FLOW_CONFIG.MOUSE_MULTIPLIER, mouse.current.y * FLOW_CONFIG.MOUSE_MULTIPLIER)
      const mouseLerpDelta = Math.max(mouseLerp.current.x * FLOW_CONFIG.MOUSE_MULTIPLIER, mouseLerp.current.y * FLOW_CONFIG.MOUSE_MULTIPLIER)

      if (!velocity.current.needsUpdate && (mouseDelta - mouseLerpDelta) < FLOW_CONFIG.MOUSE_THRESHOLD) {
        velocity.current.lerp(new Vec2(0, 0), FLOW_CONFIG.VELOCITY_LERP);
      }

      velocity.current.needsUpdate = false;

      mouseLerp.current.x = lerp(mouseLerp.current.x, mouse.current.x, FLOW_CONFIG.LERP_FACTOR);
      mouseLerp.current.y = lerp(mouseLerp.current.y, mouse.current.y, FLOW_CONFIG.LERP_FACTOR);

      flowmap.mouse.copy(mouseLerp.current);
      flowmap.velocity.lerp(velocity.current, FLOW_CONFIG.LERP_FACTOR);

      flowmap.update();
    }

    darkProgress.current = lerp(darkProgress.current, darkMultiplier.current, FLOW_CONFIG.COLOR_LERP);
    opacityFade.current = lerp(opacityFade.current, 1, FLOW_CONFIG.COLOR_LERP);
    perlinRef.current.program.uniforms.uDarkProgress.value = darkProgress.current;
    perlinRef.current.program.uniforms.uOpacity.value = opacityFade.current;
    perlinProgram.uniforms.uDarkProgress.value = darkProgress.current;

    renderer.render({
      scene: perlinMesh,
      camera,
      target: renderTarget
    })
  })

  return (
    <>
      <mesh
        ref={perlinRef}
        position={[0, 0, 0]}
        scale={[viewport.width / 2, viewport.height / 2, 1]}
      >
        <triangle />
        <program
          transparent
          vertex={`
            attribute vec2 uv;
            attribute vec2 position;

            varying vec2 vUv;
            varying vec2 pos;

            void main() {
              vUv = uv;
              pos = position.xy;
              gl_Position = vec4(position, 0, 1);
            }
          `}
          fragment={`
            precision highp float;

            uniform vec3 uColorOneLight;
            uniform vec3 uColorOneDark;
            uniform float uDarkProgress;
            uniform vec3 uColorTwoLight;
            uniform vec3 uColorTwoDark;
            uniform float uTime;
            uniform sampler2D uTexture;
            uniform sampler2D uBlueNoise;
            uniform vec2 uResolution;
            uniform sampler2D uFlow;
            uniform float uBias;
            uniform float uOpacity;

            varying vec2 pos;
            varying vec2 vUv;

            ${cnoise}

            vec3 blueNoiseDither(vec2 uv, float lum) {
              vec3 color = vec3(0.0);

              vec2 centeredUv = uv - 0.5;

              vec2 blueNoiseUv = fract((centeredUv * uResolution.xy + 0.5 * uResolution.xy) / 200.0);

              float threshold = texture2D(uBlueNoise, blueNoiseUv).r;

              if (lum < threshold + uBias) {
                  color = vec3(0.0);
              } else {
                  color = vec3(1.0); 
              }

              return color;
            }

            void main() {
              vec2 uv = vUv;

              float noise = cnoise(vec3(vUv * 5.0, sin(uTime * 0.5)));

              vec3 flow = texture2D(uFlow, vUv + (vec2(noise) * 0.05)).rgb;
              float sharpness = 5.0;

              vec3 flowColor = mix(vec3(0.0), vec3(1.0), pow(smoothstep(0.0, 0.9, flow.b), sharpness));
              vec3 squaredFlow = sign(flowColor - 0.5) * pow(abs(flowColor - 0.5) * 2.0, vec3(0.5)) * 0.5 + 0.5;
              
              float flowStrength = length(squaredFlow.xy);

              vec2 noisyFlow = squaredFlow.xy + vec2(noise) * 0.05;

              // Create a smooth transition from -1.0 to 1.0 based on x position
              // Using smoothstep to create an S-curve that transitions more rapidly in the center
              float t = smoothstep(0.1, 0.9, uv.x); // Wider transition zone for smoothness
              float screenPosition = mix(-2.0, 2.0, t);
              
              // Amplify the effect in the center to maintain visibility
              float centerIntensity = 4.0 * t * (1.0 - t); // Parabolic curve peaking at 0.5
              screenPosition *= 1.0 + centerIntensity;

              uv += screenPosition * (sin(squaredFlow.xy * 0.075));

              vec4 color = texture2D(uTexture, uv);

              color.xy += (squaredFlow.xy * 0.025);
              
              float lum = dot(vec3(0.2126, 0.7152, 0.0722), color.rgb);

              vec3 blueNoiseDithered = blueNoiseDither(vUv, lum);

              vec3 black = vec3(0.0);
              vec3 white = vec3(1.0);

              vec3 mixedColor = mix(black, white, step(0.1, blueNoiseDithered.r));

              vec3 colorOne = mix(uColorOneLight, uColorOneDark, uDarkProgress);
              vec3 colorTwo = mix(uColorTwoLight, uColorTwoDark, uDarkProgress);
              vec3 finalColor = mix(colorOne, colorTwo, mixedColor);

              finalColor = pow(finalColor, vec3(1.0 / 1.6));
              
              gl_FragColor = vec4(finalColor, uOpacity);
            }  
          `}
          uniforms={{
            uColorOneLight: { value: COLORS.LIGHT },
            uColorOneDark: { value: COLORS.DARK },
            uColorTwoLight: { value: COLORS.ACCENT_LIGHT },
            uColorTwoDark: { value: COLORS.ACCENT_DARK },
            uDarkProgress: { value: 0 },
            uTexture: { value: renderTarget.texture },
            uBlueNoise: { value: blueNoise },
            uResolution: { value: new Vec2(gl.canvas.width, gl.canvas.height) },
            uTime: { value: 0 },
            uBias: { value: bias },
            uOpacity: { value: 0 },
            uFlow: flowmap.uniform,
          }}
        />
      </mesh>
    </>
  )
})
