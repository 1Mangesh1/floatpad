// src/widgets/_registry.js
import { Pomodoro } from './Pomodoro'
import { StickyNote } from './StickyNote'
import { ParticleArt } from './ParticleArt'
import { BeatPad } from './BeatPad'
import { HabitTracker } from './HabitTracker'
import { Inspiration } from './Inspiration'
import { SketchPad } from './SketchPad'
import { MiniSynth } from './MiniSynth'
import { LavaLamp } from './LavaLamp'
import { GameOfLife } from './GameOfLife'
import { GradientMaker } from './GradientMaker'
import { Breathing } from './Breathing'
import { NoiseGen } from './NoiseGen'
import { DigitalGarden } from './DigitalGarden'
import { PixelArt } from './PixelArt'
import { AnalogClock } from './AnalogClock'
import { ZenGarden } from './ZenGarden'
import { TarotDraw } from './TarotDraw'
import { KanbanBoard } from './KanbanBoard'
import { MatrixRain } from './MatrixRain'
import { Magic8Ball } from './Magic8Ball'
import { VirtualPet } from './VirtualPet'
import { BubblePop } from './BubblePop'

export const REGISTRY = [
  { id: 'pomodoro',      label: 'Pomodoro',        icon: '⏱️', w: 300, h: 400 },
  { id: 'stickynote',    label: 'Sticky Note',     icon: '📝', w: 300, h: 320 },
  { id: 'particles',     label: 'Particle Art',    icon: '✨', w: 420, h: 380 },
  { id: 'beatpad',       label: 'Beat Pad',        icon: '🎛️', w: 440, h: 360 },
  { id: 'habits',        label: 'Habits',          icon: '✅', w: 480, h: 400 },
  { id: 'inspiration',   label: 'Inspiration',     icon: '💡', w: 360, h: 340 },
  { id: 'sketchpad',     label: 'Sketch Pad',      icon: '🎨', w: 440, h: 400 },
  { id: 'minisynth',     label: 'Mini Synth',      icon: '🎹', w: 480, h: 300 },
  { id: 'lavalamp',      label: 'Lava Lamp',       icon: '🫧', w: 300, h: 400 },
  { id: 'gameoflife',    label: 'Game of Life',    icon: '🧬', w: 420, h: 420 },
  { id: 'gradient',      label: 'Gradients',       icon: '🌈', w: 380, h: 400 },
  { id: 'breathing',     label: 'Breathe',         icon: '🧘', w: 320, h: 400 },
  { id: 'noisegen',      label: 'Noise Gen',       icon: '🔊', w: 320, h: 380 },
  { id: 'digitalgarden', label: 'Digital Garden',  icon: '🌱', w: 520, h: 460 },
  { id: 'pixelart',      label: 'Pixel Art',       icon: '👾', w: 400, h: 440 },
  { id: 'analogclock',   label: 'Clock',           icon: '🕐', w: 280, h: 320 },
  { id: 'zengarden',     label: 'Zen Garden',      icon: '🪨', w: 400, h: 380 },
  { id: 'tarot',         label: 'Tarot',           icon: '🔮', w: 340, h: 440 },
  { id: 'kanban',        label: 'Kanban',          icon: '📋', w: 520, h: 400 },
  { id: 'matrixrain',    label: 'Matrix Rain',     icon: '🟩', w: 360, h: 400 },
  { id: 'magic8ball',    label: '8-Ball',          icon: '🎱', w: 300, h: 380 },
  { id: 'virtualpet',    label: 'Pet',             icon: '🐱', w: 300, h: 340 },
  { id: 'bubblepop',     label: 'Bubble Pop',      icon: '🫧', w: 360, h: 400 },
]

const COMPONENTS = {
  pomodoro: Pomodoro,
  stickynote: StickyNote,
  particles: ParticleArt,
  beatpad: BeatPad,
  habits: HabitTracker,
  inspiration: Inspiration,
  sketchpad: SketchPad,
  minisynth: MiniSynth,
  lavalamp: LavaLamp,
  gameoflife: GameOfLife,
  gradient: GradientMaker,
  breathing: Breathing,
  noisegen: NoiseGen,
  digitalgarden: DigitalGarden,
  pixelart: PixelArt,
  analogclock: AnalogClock,
  zengarden: ZenGarden,
  tarot: TarotDraw,
  kanban: KanbanBoard,
  matrixrain: MatrixRain,
  magic8ball: Magic8Ball,
  virtualpet: VirtualPet,
  bubblepop: BubblePop,
}

export const widgetComponent = (type) => COMPONENTS[type] ?? null
