declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three'

  export const SceneFormat: {
    Ply: number
    Splat: number
    KSplat: number
    Spz: number
  }

  export class DropInViewer extends THREE.Group {
    constructor(options?: Record<string, unknown>)
    addSplatScene(
      path: string,
      options?: {
        format?: number
        splatAlphaRemovalThreshold?: number
        showLoadingUI?: boolean
        position?: [number, number, number]
        rotation?: [number, number, number, number]
        scale?: [number, number, number]
        progressiveLoad?: boolean
      },
    ): Promise<unknown>
    removeSplatScene(index: number, showLoadingUI?: boolean): Promise<unknown>
    getSceneCount(): number
    dispose(): Promise<void>
  }
}
