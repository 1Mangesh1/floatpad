// src/widgets/_registry.js
import { Pomodoro } from './Pomodoro'
import { StickyNote } from './StickyNote'
import { ParticleArt } from './ParticleArt'
import { BeatPad } from './BeatPad'
import { HabitTracker } from './HabitTracker'
import { Inspiration } from './Inspiration'
import { WebClipper } from './WebClipper'
import { SketchPad } from './SketchPad'
import { MiniSynth } from './MiniSynth'
import { LavaLamp } from './LavaLamp'
import { GameOfLife } from './GameOfLife'
import { GradientMaker } from './GradientMaker'
import { Breathing } from './Breathing'
import { NoiseGen } from './NoiseGen'

export const REGISTRY = [
  { id: 'pomodoro',    label: 'Pomodoro',     icon: '⏱️', w: 300, h: 400 },
  { id: 'stickynote',  label: 'Sticky Note',  icon: '📝', w: 300, h: 320 },
  { id: 'particles',   label: 'Particle Art', icon: '✨', w: 420, h: 380 },
  { id: 'beatpad',     label: 'Beat Pad',     icon: '🎛️', w: 440, h: 360 },
  { id: 'habits',      label: 'Habits',       icon: '✅', w: 480, h: 400 },
  { id: 'inspiration', label: 'Inspiration',  icon: '💡', w: 360, h: 340 },
  { id: 'webclipper',  label: 'Web Clipper',  icon: '🌐', w: 400, h: 420 },
  { id: 'sketchpad',   label: 'Sketch Pad',   icon: '🎨', w: 440, h: 400 },
  { id: 'minisynth',   label: 'Mini Synth',   icon: '🎹', w: 480, h: 300 },
  { id: 'lavalamp',    label: 'Lava Lamp',    icon: '🫧', w: 300, h: 400 },
  { id: 'gameoflife',  label: 'Game of Life', icon: '🧬', w: 420, h: 420 },
  { id: 'gradient',    label: 'Gradients',    icon: '🌈', w: 380, h: 400 },
  { id: 'breathing',   label: 'Breathe',      icon: '🧘', w: 320, h: 400 },
  { id: 'noisegen',    label: 'Noise Gen',    icon: '🔊', w: 320, h: 380 },
]

const COMPONENTS = {
  pomodoro: Pomodoro,
  stickynote: StickyNote,
  particles: ParticleArt,
  beatpad: BeatPad,
  habits: HabitTracker,
  inspiration: Inspiration,
  webclipper: WebClipper,
  sketchpad: SketchPad,
  minisynth: MiniSynth,
  lavalamp: LavaLamp,
  gameoflife: GameOfLife,
  gradient: GradientMaker,
  breathing: Breathing,
  noisegen: NoiseGen,
}

export const widgetComponent = (type) => COMPONENTS[type] ?? null
