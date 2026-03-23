# 3GS Audio Reactive Visualiser 現状仕様書

更新日: 2026-03-23

## 1. コンセプト

このプロジェクトの主目的は、GaussianSplatting データを主役にした Web ビューワー兼プレイグラウンドを作ることです。

中心価値は以下です。

- Gaussian Splat を複数読み込んで眺める
- 配置、変形、演出を加えて遊ぶ
- 後続で画像、動画、3D モデルを添景として重ねる
- 画面録画や素材制作に使える操作系を持つ

音声反応は主機能ではなく、追加演出レイヤーです。

## 2. 現在の位置づけ

現時点の実装は、Splat 主体のステージャーに向けた MVP です。

- 複数 Splat のローカル読込
- Splat の選択
- 選択中 Splat の transform 編集
- gizmo による直接編集
- scene 設定の export / import
- procedural な背景演出
- 音声反応による補助演出

## 3. 技術構成

- Vite
- React 19
- TypeScript
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- `@react-three/postprocessing`
- `postprocessing`
- `@mkkellogg/gaussian-splats-3d`

## 4. 現在の実装範囲

### 4.1 Gaussian Splat 表示

- `DropInViewer` を Three scene に統合
- 対応形式
  - `.ply`
  - `.splat`
  - `.ksplat`
  - `.spz`
- ローカルファイルを object URL として読込
- 複数 Splat の同時配置に対応
- 各 Splat ごとに状態を保持
  - `idle`
  - `loading`
  - `ready`
  - `error`

### 4.2 Splat 選択と編集

- Splat outliner から選択対象を切替可能
- 選択中 Splat に対して以下を数値編集可能
  - `x`
  - `y`
  - `z`
  - `rotationY`
  - `baseScale`
- `TransformControls` による直接編集
- gizmo mode
  - `translate`
  - `rotate`
  - `scale`
- gizmo enable / disable 切替

### 4.3 Scene 設定の保存と読込

- scene 設定を JSON として export
- scene 設定を JSON から import
- 保存対象
  - `controls`
  - 複数 Splat の `fileName`
  - 複数 Splat の `transform`
  - `selectedSplatFileName`
  - `version`
  - `exportedAt`
- import 時に不足ファイルがあれば pending remap 状態に移行
- pending remap 中は以下が可能
  - 後から不足 Splat を読み込む
  - 現在の選択 Splat に強制適用する
  - pending を破棄する

### 4.4 補助演出

- procedural な背景シーン
  - 発光シェル
  - Torus Knot コア
  - 回転リング
  - 粒子群
- Bloom
- Noise
- Vignette

### 4.5 音声反応

音声反応は補助機能です。

- ローカル音声ファイルの読込
- 再生 / 一時停止
- `AnalyserNode` による周波数解析
- `bass / mid / treble / level` の簡易指標
- Splat や背景演出への軽いリアクティブ変化

補足:
- `mid` は MIDI ではなく、中域を意味する周波数帯ラベルです

## 5. 現在の UI

- Splat 追加
- 選択中 Splat 削除
- Splat outliner
- 選択中 Splat の status 表示
- gizmo 操作切替
- scene export / import
- transform 数値入力
- realtime band 表示
- 演出スライダー
- pending remap 表示

## 6. 未実装項目

- 複数選択
- pointer-based placement
- 画像パネル配置
- 動画パネル配置
- glTF / GLB 配置
- scene graph / layer 管理
- 録画向けプリセット
- asset 自動再解決付き import

## 7. 現在の制約

- outliner は単純な一次リストで、階層や grouping は未対応
- scene JSON は設定保存であり、実ファイル自体は含まない
- 音声解析は簡易平均帯域ベース
- bundle サイズが大きい

## 8. 次フェーズの推奨順

1. scene graph / layer 管理
2. 画像 / 動画 / glTF を添景として統合
3. pointer-based placement と multi-select
4. 録画向けプリセットと burst / converge 演出
5. bundle 分割と遅延ロード

## 9. 主要ファイル

- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `src/types/gaussian-splats-3d.d.ts`
- `docs/DEVLOG_2026-03-23.md`
- `docs/GPTlog`
