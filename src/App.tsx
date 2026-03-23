import { OrbitControls, TransformControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { DropInViewer, SceneFormat } from '@mkkellogg/gaussian-splats-3d'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import './App.css'

type AudioSnapshot = {
  bass: number
  mid: number
  treble: number
  level: number
  source: 'demo' | 'file'
}

type Controls = {
  bassGain: number
  midGain: number
  trebleGain: number
  bloom: number
  bloomThreshold: number
  particleSpread: number
  motion: number
  cameraDrift: number
  splatScale: number
  splatLift: number
}

type SplatStatus = 'idle' | 'loading' | 'ready' | 'error'
type TransformMode = 'translate' | 'rotate' | 'scale'

type SplatTransform = {
  x: number
  y: number
  z: number
  rotationY: number
  baseScale: number
}

type LoadedSplat = {
  id: string
  fileName: string
  url: string
  format: number
  transform: SplatTransform
  status: SplatStatus
  message: string
}

type ScenePreset = {
  version: 2
  exportedAt: string
  controls: Controls
  splats: Array<{
    fileName: string
    transform: SplatTransform
  }>
  selectedSplatFileName: string | null
}

const initialControls: Controls = {
  bassGain: 1.2,
  midGain: 1,
  trebleGain: 1.35,
  bloom: 1.1,
  bloomThreshold: 0.42,
  particleSpread: 1,
  motion: 1,
  cameraDrift: 1,
  splatScale: 1,
  splatLift: 0,
}

const initialSplatTransform: SplatTransform = {
  x: 0,
  y: 0,
  z: 0,
  rotationY: 0,
  baseScale: 1,
}

const sliderDefs: Array<{
  key: keyof Controls
  label: string
  min: number
  max: number
  step: number
}> = [
  { key: 'bassGain', label: 'Bass gain', min: 0.4, max: 2.4, step: 0.01 },
  { key: 'midGain', label: 'Mid gain', min: 0.4, max: 2.4, step: 0.01 },
  { key: 'trebleGain', label: 'Treble gain', min: 0.4, max: 2.4, step: 0.01 },
  { key: 'bloom', label: 'Bloom', min: 0, max: 2.2, step: 0.01 },
  { key: 'bloomThreshold', label: 'Bloom threshold', min: 0, max: 1, step: 0.01 },
  { key: 'particleSpread', label: 'Particle spread', min: 0.4, max: 1.8, step: 0.01 },
  { key: 'motion', label: 'Motion', min: 0.2, max: 2.4, step: 0.01 },
  { key: 'cameraDrift', label: 'Camera drift', min: 0, max: 2, step: 0.01 },
  { key: 'splatScale', label: 'Global splat scale', min: 0.2, max: 3, step: 0.01 },
  { key: 'splatLift', label: 'Global splat lift', min: -3, max: 3, step: 0.01 },
]

function averageRange(data: Uint8Array, start: number, end: number) {
  let total = 0
  const safeEnd = Math.max(start + 1, end)

  for (let index = start; index < safeEnd; index += 1) {
    total += data[index]
  }

  return total / (safeEnd - start) / 255
}

function createScatter(count: number) {
  const values = new Float32Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    const radius = 1.5 + Math.random() * 5.5
    const angle = Math.random() * Math.PI * 2
    const lift = (Math.random() - 0.5) * 4.5
    const wobble = 0.3 + Math.random() * 0.7

    values[index * 3] = Math.cos(angle) * radius * wobble
    values[index * 3 + 1] = lift
    values[index * 3 + 2] = Math.sin(angle) * radius
  }

  return values
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function inferSplatFormat(fileName: string) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.ksplat')) return SceneFormat.KSplat
  if (lower.endsWith('.splat')) return SceneFormat.Splat
  if (lower.endsWith('.spz')) return SceneFormat.Spz
  return SceneFormat.Ply
}

function createSplatId() {
  return `splat-${Math.random().toString(36).slice(2, 10)}`
}

function createInitialTransform(index: number): SplatTransform {
  const spread = (index % 3) - 1

  return {
    ...initialSplatTransform,
    x: spread * 1.4,
    z: -Math.floor(index / 3) * 1.1,
  }
}

function ReactiveCore({ snapshot, controls }: { snapshot: AudioSnapshot; controls: Controls }) {
  const shellRef = useRef<THREE.Mesh>(null)
  const knotRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const beat = snapshot.level * controls.motion
    const bassLift = snapshot.bass * controls.bassGain
    const trebleLift = snapshot.treble * controls.trebleGain
    const elapsed = state.clock.elapsedTime

    if (shellRef.current) {
      shellRef.current.rotation.y = elapsed * 0.22 * controls.motion
      shellRef.current.rotation.x = elapsed * 0.08 * controls.motion
      shellRef.current.scale.setScalar(1 + bassLift * 0.35)
      shellRef.current.position.y = Math.sin(elapsed * 0.8) * 0.18 * controls.motion
      const material = shellRef.current.material as THREE.MeshPhysicalMaterial
      material.emissiveIntensity = 0.8 + beat * 1.6
      material.roughness = 0.16 + snapshot.mid * 0.28
    }

    if (knotRef.current) {
      knotRef.current.rotation.x = elapsed * 0.35 * controls.motion
      knotRef.current.rotation.y = elapsed * 0.65 * controls.motion
      knotRef.current.rotation.z = elapsed * 0.18 * controls.motion
      knotRef.current.scale.setScalar(0.95 + bassLift * 0.28 + trebleLift * 0.08)
      const material = knotRef.current.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = 0.6 + trebleLift * 2.4
    }
  })

  return (
    <group>
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[1.85, 32]} />
        <meshPhysicalMaterial color="#59f3ff" emissive="#0dd4ff" emissiveIntensity={1} metalness={0.22} roughness={0.24} transparent opacity={0.16} clearcoat={1} clearcoatRoughness={0.12} />
      </mesh>
      <mesh ref={knotRef}>
        <torusKnotGeometry args={[0.78, 0.24, 240, 32]} />
        <meshStandardMaterial color="#ff8d4d" emissive="#ff5f1f" emissiveIntensity={1.1} metalness={0.35} roughness={0.2} />
      </mesh>
    </group>
  )
}

function ReactiveRings({ snapshot, controls }: { snapshot: AudioSnapshot; controls: Controls }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    const elapsed = state.clock.elapsedTime
    const spread = controls.particleSpread + snapshot.treble * controls.trebleGain * 0.5

    groupRef.current.rotation.y = elapsed * 0.18 * controls.motion
    groupRef.current.rotation.z = elapsed * 0.11 * controls.motion
    groupRef.current.scale.setScalar(1 + snapshot.mid * controls.midGain * 0.14)
    groupRef.current.children.forEach((child, index) => {
      child.position.z = (index - 1) * 0.65 * spread
      child.rotation.x = elapsed * (0.2 + index * 0.08) * controls.motion
      child.rotation.y = elapsed * (0.4 + index * 0.1) * controls.motion
    })
  })

  return (
    <group ref={groupRef}>
      {[1.7, 2.45, 3.1].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI / 2.5, 0, index * 0.45]}>
          <torusGeometry args={[radius, 0.028 + index * 0.012, 24, 180]} />
          <meshBasicMaterial color={index === 1 ? '#59f3ff' : '#ffd166'} transparent opacity={0.35 - index * 0.08} />
        </mesh>
      ))}
    </group>
  )
}

function ReactiveParticles({ snapshot, controls }: { snapshot: AudioSnapshot; controls: Controls }) {
  const pointsRef = useRef<THREE.Points>(null)
  const [positions] = useState(() => createScatter(2200))

  useFrame((state) => {
    if (!pointsRef.current) return
    const elapsed = state.clock.elapsedTime
    const level = snapshot.level * controls.motion
    const spread = controls.particleSpread + snapshot.treble * controls.trebleGain * 0.9

    pointsRef.current.rotation.y = elapsed * 0.05 * controls.motion
    pointsRef.current.rotation.x = Math.sin(elapsed * 0.18) * 0.2
    pointsRef.current.scale.setScalar(spread)
    pointsRef.current.position.y = Math.sin(elapsed * 0.7) * 0.12 * controls.motion
    const material = pointsRef.current.material as THREE.PointsMaterial
    material.size = 0.03 + level * 0.07
    material.opacity = 0.45 + snapshot.mid * 0.4
    material.color.setHSL(0.5 + snapshot.treble * 0.08, 0.9, 0.6)
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#59f3ff" size={0.06} sizeAttenuation transparent depthWrite={false} opacity={0.8} />
    </points>
  )
}

function CameraDrift({ snapshot, controls }: { snapshot: AudioSnapshot; controls: Controls }) {
  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    const drift = controls.cameraDrift
    const targetX = Math.sin(elapsed * 0.18) * 0.8 * drift
    const targetY = Math.cos(elapsed * 0.16) * 0.55 * drift + snapshot.mid * 0.18
    const targetZ = 8 - snapshot.bass * controls.bassGain * 0.45

    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, 0.025)
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.025)
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.04)
    state.camera.lookAt(0, 0, 0)
  })

  return null
}

function ReactiveSplat({ splat, controls, snapshot, selected, transformMode, gizmoEnabled, dragging, onDraggingChange, onTransformChange, onStatusChange }: { splat: LoadedSplat; controls: Controls; snapshot: AudioSnapshot; selected: boolean; transformMode: TransformMode; gizmoEnabled: boolean; dragging: boolean; onDraggingChange: (dragging: boolean) => void; onTransformChange: (id: string, transform: SplatTransform) => void; onStatusChange: (id: string, status: SplatStatus, message: string) => void }) {
  const [viewer] = useState(() => new DropInViewer({ gpuAcceleratedSort: true, integerBasedSort: false, sharedMemoryForWorkers: false }))
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    let cancelled = false
    onStatusChange(splat.id, 'loading', `Loading ${splat.fileName}`)
    viewer.addSplatScene(splat.url, { format: splat.format, showLoadingUI: false, splatAlphaRemovalThreshold: 1 }).then(() => {
      if (!cancelled) onStatusChange(splat.id, 'ready', `${splat.fileName} loaded`)
    }).catch((error: unknown) => {
      if (!cancelled) {
        const message = error instanceof Error ? error.message : 'Failed to load splat file'
        onStatusChange(splat.id, 'error', message)
      }
    })

    return () => {
      cancelled = true
      void viewer.dispose()
    }
  }, [onStatusChange, splat.fileName, splat.format, splat.id, splat.url, viewer])

  useFrame((state) => {
    const host = groupRef.current
    if (!host) return
    if (selected && gizmoEnabled && dragging) return

    const pulse = snapshot.bass * controls.bassGain * 0.18
    const animatedScale = splat.transform.baseScale * (controls.splatScale + pulse)
    host.position.set(splat.transform.x, splat.transform.y + controls.splatLift + Math.sin(state.clock.elapsedTime * 0.8) * snapshot.mid * 0.2, splat.transform.z)
    host.rotation.set(0, splat.transform.rotationY, 0)
    host.scale.setScalar(animatedScale)
  })

  function commitTransform() {
    const host = groupRef.current
    if (!host) return

    onTransformChange(splat.id, {
      x: Number(host.position.x.toFixed(3)),
      y: Number((host.position.y - controls.splatLift).toFixed(3)),
      z: Number(host.position.z.toFixed(3)),
      rotationY: Number(host.rotation.y.toFixed(3)),
      baseScale: Number((host.scale.x / Math.max(controls.splatScale, 0.001)).toFixed(3)),
    })
  }

  return (
    <>
      <group ref={groupRef}>
        <primitive object={viewer} />
      </group>
      {selected && groupRef.current ? (
        <TransformControls object={groupRef.current} mode={transformMode} enabled={gizmoEnabled} onMouseDown={() => onDraggingChange(true)} onMouseUp={() => { commitTransform(); onDraggingChange(false) }} onObjectChange={commitTransform} size={0.8} />
      ) : null}
    </>
  )
}

function ReactiveScene({ snapshot, controls, splats, selectedSplatId, transformMode, gizmoEnabled, dragging, onDraggingChange, onSplatTransformChange, onSplatStatusChange }: { snapshot: AudioSnapshot; controls: Controls; splats: LoadedSplat[]; selectedSplatId: string | null; transformMode: TransformMode; gizmoEnabled: boolean; dragging: boolean; onDraggingChange: (dragging: boolean) => void; onSplatTransformChange: (id: string, transform: SplatTransform) => void; onSplatStatusChange: (id: string, status: SplatStatus, message: string) => void }) {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 42 }} dpr={[1, 1.8]}>
      <color attach="background" args={['#040712']} />
      <fog attach="fog" args={['#040712', 6, 18]} />
      <ambientLight intensity={0.45} color="#9ad8ff" />
      <directionalLight position={[3, 4, 3]} intensity={2.2} color="#fff1d0" />
      <pointLight position={[-4, -2, 3]} intensity={15} color="#00d7ff" distance={12} />
      <pointLight position={[4, 2, -2]} intensity={12} color="#ff7b39" distance={12} />
      <group>
        {splats.map((splat) => (
          <ReactiveSplat key={splat.id} splat={splat} controls={controls} snapshot={snapshot} selected={selectedSplatId === splat.id} transformMode={transformMode} gizmoEnabled={gizmoEnabled} dragging={dragging} onDraggingChange={onDraggingChange} onTransformChange={onSplatTransformChange} onStatusChange={onSplatStatusChange} />
        ))}
        <ReactiveParticles snapshot={snapshot} controls={controls} />
        <ReactiveRings snapshot={snapshot} controls={controls} />
        <ReactiveCore snapshot={snapshot} controls={controls} />
      </group>
      <EffectComposer enableNormalPass={false}>
        <Bloom intensity={controls.bloom + snapshot.level * 1.1} luminanceThreshold={controls.bloomThreshold} mipmapBlur />
        <Noise opacity={0.03} />
        <Vignette eskil={false} offset={0.15} darkness={0.9} />
      </EffectComposer>
      <CameraDrift snapshot={snapshot} controls={controls} />
      <OrbitControls enablePan={!gizmoEnabled || !dragging} maxDistance={12} minDistance={4} />
    </Canvas>
  )
}

function App() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [controls, setControls] = useState(initialControls)
  const [splats, setSplats] = useState<LoadedSplat[]>([])
  const [selectedSplatId, setSelectedSplatId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const [gizmoEnabled, setGizmoEnabled] = useState(false)
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false)
  const [pendingScenePreset, setPendingScenePreset] = useState<ScenePreset | null>(null)
  const [snapshot, setSnapshot] = useState<AudioSnapshot>({ bass: 0.28, mid: 0.22, treble: 0.35, level: 0.29, source: 'demo' })

  const selectedSplat = useMemo(() => splats.find((splat) => splat.id === selectedSplatId) ?? null, [selectedSplatId, splats])

  useEffect(() => {
    let frameId = 0
    const tick = () => {
      const analyser = analyserRef.current
      const data = dataRef.current

      if (analyser && data) {
        analyser.getByteFrequencyData(data)
        const bass = averageRange(data, 2, 24)
        const mid = averageRange(data, 24, 120)
        const treble = averageRange(data, 120, 320)
        const level = bass * 0.5 + mid * 0.3 + treble * 0.2
        setSnapshot({ bass, mid, treble, level, source: audioUrl ? 'file' : 'demo' })
      } else {
        const now = performance.now() / 1000
        const bass = 0.24 + (Math.sin(now * 1.9) + 1) * 0.14
        const mid = 0.18 + (Math.sin(now * 2.7 + 1.2) + 1) * 0.12
        const treble = 0.22 + (Math.sin(now * 4.8 + 0.5) + 1) * 0.1
        setSnapshot({ bass, mid, treble, level: bass * 0.5 + mid * 0.3 + treble * 0.2, source: 'demo' })
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = async () => {
      if (!audioContextRef.current) {
        const context = new window.AudioContext()
        const analyser = context.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.82
        const sourceNode = context.createMediaElementSource(audio)
        sourceNode.connect(analyser)
        analyser.connect(context.destination)
        audioContextRef.current = context
        analyserRef.current = analyser
        dataRef.current = new Uint8Array(analyser.frequencyBinCount)
      }

      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume()
      }

      setIsPlaying(true)
    }

    const handlePause = () => setIsPlaying(false)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handlePause)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handlePause)
      void audioContextRef.current?.close()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      splats.forEach((splat) => URL.revokeObjectURL(splat.url))
    }
  }, [audioUrl, splats])

  useEffect(() => {
    if (!pendingScenePreset) return

    const loadedFileNames = new Set(splats.map((splat) => splat.fileName))
    const allResolved = pendingScenePreset.splats.every((item) => loadedFileNames.has(item.fileName))
    if (!allResolved) return

    setControls((current) => ({ ...current, ...pendingScenePreset.controls }))
    setSplats((current) => current.map((splat) => {
      const matched = pendingScenePreset.splats.find((item) => item.fileName === splat.fileName)
      return matched ? { ...splat, transform: matched.transform } : splat
    }))
    if (pendingScenePreset.selectedSplatFileName) {
      const matched = splats.find((splat) => splat.fileName === pendingScenePreset.selectedSplatFileName)
      setSelectedSplatId(matched?.id ?? null)
    }
    setPendingScenePreset(null)
  }, [pendingScenePreset, splats])

  function updateControl(key: keyof Controls, value: number) {
    setControls((current) => ({ ...current, [key]: value }))
  }

  function updateSelectedSplatTransform(key: keyof SplatTransform, value: number) {
    if (!selectedSplatId) return
    setSplats((current) => current.map((splat) => splat.id === selectedSplatId ? { ...splat, transform: { ...splat.transform, [key]: value } } : splat))
  }

  function updateSplatTransformById(id: string, transform: SplatTransform) {
    setSplats((current) => current.map((splat) => (splat.id === id ? { ...splat, transform } : splat)))
  }

  function updateSplatStatus(id: string, status: SplatStatus, message: string) {
    setSplats((current) => current.map((splat) => (splat.id === id ? { ...splat, status, message } : splat)))
  }

  function getSliderPct(slider: (typeof sliderDefs)[number]) {
    const pct = ((controls[slider.key] - slider.min) / (slider.max - slider.min)) * 100
    return `${pct.toFixed(1)}%`
  }

  function handleAudioFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
  }

  function handleSplatFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    let firstAddedId: string | null = null
    setSplats((current) => {
      const next = [...current]
      files.forEach((file, index) => {
        const id = createSplatId()
        if (!firstAddedId) firstAddedId = id
        next.push({ id, fileName: file.name, url: URL.createObjectURL(file), format: inferSplatFormat(file.name), transform: createInitialTransform(current.length + index), status: 'loading', message: `Preparing ${file.name}` })
      })
      return next
    })
    if (firstAddedId) setSelectedSplatId(firstAddedId)
    event.target.value = ''
  }

  function removeSelectedSplat() {
    if (!selectedSplatId) return
    setSplats((current) => {
      const target = current.find((splat) => splat.id === selectedSplatId)
      if (target) URL.revokeObjectURL(target.url)
      const next = current.filter((splat) => splat.id !== selectedSplatId)
      setSelectedSplatId(next[0]?.id ?? null)
      return next
    })
  }

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    if (audio.paused) {
      await audio.play()
      return
    }
    audio.pause()
  }

  function exportScenePreset() {
    const payload: ScenePreset = { version: 2, exportedAt: new Date().toISOString(), controls, splats: splats.map((splat) => ({ fileName: splat.fileName, transform: splat.transform })), selectedSplatFileName: selectedSplat?.fileName ?? null }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `threegs-scene-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleSceneImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ScenePreset
        const loadedFileNames = new Set(splats.map((splat) => splat.fileName))
        const allResolved = parsed.splats.every((item) => loadedFileNames.has(item.fileName))
        if (allResolved) {
          setControls((current) => ({ ...current, ...parsed.controls }))
          setSplats((current) => current.map((splat) => {
            const matched = parsed.splats.find((item) => item.fileName === splat.fileName)
            return matched ? { ...splat, transform: matched.transform } : splat
          }))
          if (parsed.selectedSplatFileName) {
            const matched = splats.find((splat) => splat.fileName === parsed.selectedSplatFileName)
            setSelectedSplatId(matched?.id ?? null)
          }
        } else {
          setPendingScenePreset(parsed)
        }
      } catch {
        // ignore malformed JSON import for now
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function applyPendingPresetToCurrentSplat() {
    if (!pendingScenePreset || !selectedSplat) return
    const fallbackTransform = pendingScenePreset.splats[0]?.transform ?? initialSplatTransform
    setControls((current) => ({ ...current, ...pendingScenePreset.controls }))
    setSplats((current) => current.map((splat) => splat.id === selectedSplat.id ? { ...splat, transform: fallbackTransform } : splat))
    setPendingScenePreset(null)
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">3GS splat playground</p>
        <h1>GaussianSplatting を主役にしたステージャー</h1>
        <p className="lede">複数の Splat をロードして選択し、その場で transform を編集できる状態まで進めています。音声反応は補助演出で、主軸は Splat の配置と見せ方です。</p>
        <div className="status-row">
          <div><span className="status-label">Loaded splats</span><strong>{splats.length}</strong></div>
          <div><span className="status-label">Selected</span><strong>{selectedSplat?.fileName ?? 'None'}</strong></div>
          <div><span className="status-label">Playback</span><strong>{isPlaying ? 'Playing' : 'Idle'}</strong></div>
          <div><span className="status-label">Source</span><strong>{audioUrl ? 'Local audio file' : 'Demo pulse generator'}</strong></div>
        </div>
        <div className="transport-row">
          <label className="file-input" aria-label="音声ファイルを読み込む"><span>Load audio</span><input type="file" accept="audio/*" onChange={handleAudioFileChange} /></label>
          <button className="play-button" onClick={() => void togglePlayback()} disabled={!audioUrl} data-playing={isPlaying} aria-label={isPlaying ? '一時停止' : '再生'}>{isPlaying ? 'Pause' : 'Play'}</button>
          <audio ref={audioRef} src={audioUrl ?? undefined} controls className="audio-element" />
        </div>
        <div className="asset-row">
          <label className="file-input secondary-input"><span>Add splat</span><input type="file" accept=".ply,.splat,.ksplat,.spz" multiple onChange={handleSplatFileChange} /></label>
          <button className="play-button" onClick={removeSelectedSplat} disabled={!selectedSplat}>Remove selected</button>
        </div>
        <div className="asset-row">
          <button className="play-button" onClick={exportScenePreset}>Export scene</button>
          <label className="file-input secondary-input"><span>Import scene</span><input type="file" accept=".json,application/json" onChange={handleSceneImport} /></label>
        </div>
        <div className="asset-row">
          <button className="play-button" onClick={() => setGizmoEnabled((current) => !current)} disabled={!selectedSplat} data-playing={gizmoEnabled}>{gizmoEnabled ? 'Disable gizmo' : 'Enable gizmo'}</button>
          <div className="mode-switch" aria-label="Transform mode">
            {(['translate', 'rotate', 'scale'] as const).map((mode) => (
              <button key={mode} className={`mode-chip ${transformMode === mode ? 'mode-chip-active' : ''}`} onClick={() => setTransformMode(mode)} disabled={!selectedSplat}>{mode}</button>
            ))}
          </div>
        </div>
        <div className={`splat-state splat-${selectedSplat?.status ?? 'idle'}`}>
          <span className="status-label">Selected status</span>
          <strong>{selectedSplat ? `${selectedSplat.status}: ${selectedSplat.message}` : 'No splat selected'}</strong>
        </div>
        {pendingScenePreset ? (
          <div className="splat-state splat-loading">
            <span className="status-label">Scene remap</span>
            <strong>{pendingScenePreset.splats.filter((item) => !splats.some((splat) => splat.fileName === item.fileName)).map((item) => item.fileName).join(', ')}</strong>
            <div className="asset-row">
              <button className="play-button" onClick={applyPendingPresetToCurrentSplat} disabled={!selectedSplat}>Apply to current splat</button>
              <button className="play-button" onClick={() => setPendingScenePreset(null)}>Clear pending</button>
            </div>
          </div>
        ) : null}
      </section>
      <section className="viewport-panel">
        <ReactiveScene snapshot={snapshot} controls={controls} splats={splats} selectedSplatId={selectedSplatId} transformMode={transformMode} gizmoEnabled={gizmoEnabled} dragging={isDraggingGizmo} onDraggingChange={setIsDraggingGizmo} onSplatTransformChange={updateSplatTransformById} onSplatStatusChange={updateSplatStatus} />
        <div className="overlay-card metrics-card">
          <p>Realtime bands</p>
          <div className="metric-grid">
            {[
              ['Bass', snapshot.bass, 'bass'],
              ['Mid', snapshot.mid, ''],
              ['Treble', snapshot.treble, ''],
              ['Level', snapshot.level, ''],
            ].map(([label, value, extra]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{formatPercent(value as number)}</strong>
                <div className="metric-bar-track"><div className={`metric-bar-fill ${extra}`.trim()} style={{ width: `${(value as number) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="control-panel">
        <div className="overlay-card">
          <p className="panel-title">Splat outliner</p>
          <div className="splat-list">
            {splats.length ? splats.map((splat) => (
              <button key={splat.id} className={`splat-list-item ${selectedSplatId === splat.id ? 'splat-list-item-active' : ''}`} onClick={() => setSelectedSplatId(splat.id)}>
                <span>{splat.fileName}</span>
                <strong>{splat.status}</strong>
              </button>
            )) : <div className="splat-empty">No splats loaded</div>}
          </div>
        </div>
        <div className="overlay-card">
          <p className="panel-title">Performance knobs</p>
          <div className="slider-list">
            {sliderDefs.map((slider) => (
              <div key={slider.key} className="slider-row">
                <div className="slider-row-header"><span>{slider.label}</span><strong>{controls[slider.key].toFixed(2)}</strong></div>
                <input type="range" min={slider.min} max={slider.max} step={slider.step} value={controls[slider.key]} style={{ '--pct': getSliderPct(slider) } as React.CSSProperties} onChange={(event) => updateControl(slider.key, Number(event.target.value))} aria-label={slider.label} />
              </div>
            ))}
          </div>
        </div>
        <div className="overlay-card roadmap-card">
          <p className="panel-title">Selected splat</p>
          <div className="status-row transform-status">
            <div><span className="status-label">Gizmo</span><strong>{gizmoEnabled ? transformMode : 'Off'}</strong></div>
            <div><span className="status-label">Drag state</span><strong>{isDraggingGizmo ? 'Editing' : 'Idle'}</strong></div>
          </div>
          <div className="mini-grid">
            <label className="mini-field"><span>X</span><input type="number" step="0.1" value={selectedSplat?.transform.x ?? 0} onChange={(event) => updateSelectedSplatTransform('x', Number(event.target.value))} disabled={!selectedSplat} /></label>
            <label className="mini-field"><span>Y</span><input type="number" step="0.1" value={selectedSplat?.transform.y ?? 0} onChange={(event) => updateSelectedSplatTransform('y', Number(event.target.value))} disabled={!selectedSplat} /></label>
            <label className="mini-field"><span>Z</span><input type="number" step="0.1" value={selectedSplat?.transform.z ?? 0} onChange={(event) => updateSelectedSplatTransform('z', Number(event.target.value))} disabled={!selectedSplat} /></label>
            <label className="mini-field"><span>Rot Y</span><input type="number" step="0.05" value={selectedSplat?.transform.rotationY ?? 0} onChange={(event) => updateSelectedSplatTransform('rotationY', Number(event.target.value))} disabled={!selectedSplat} /></label>
            <label className="mini-field mini-field-wide"><span>Base scale</span><input type="number" step="0.1" min="0.1" value={selectedSplat?.transform.baseScale ?? 1} onChange={(event) => updateSelectedSplatTransform('baseScale', Number(event.target.value))} disabled={!selectedSplat} /></label>
          </div>
        </div>
        <div className="overlay-card roadmap-card">
          <p className="panel-title">Next hooks</p>
          <ul>
            <li>Pointer-based placement and multi-select</li>
            <li>Image / video planes with timeline-safe parameters</li>
            <li>Scene JSON save/load with full asset remapping</li>
            <li>Recording-oriented presets for burst / converge shots</li>
          </ul>
        </div>
      </section>
    </main>
  )
}

export default App
