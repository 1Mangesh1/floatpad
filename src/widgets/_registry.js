// src/widgets/_registry.js
import { Pomodoro } from './Pomodoro'
import { StickyNote } from './StickyNote'
import { ParticleArt } from './ParticleArt'
import { BeatPad } from './BeatPad'
import { HabitTracker } from './HabitTracker'
import { Inspiration } from './Inspiration'
import { WebClipper } from './WebClipper'

export const REGISTRY = [
  { id: 'pomodoro',     label: 'Pomodoro',      icon: '⏱️' },
  { id: 'stickynote',  label: 'Sticky Note',   icon: '📝' },
  { id: 'particles',   label: 'Particle Art',  icon: '✨' },
  { id: 'beatpad',     label: 'Beat Pad',      icon: '🎛️' },
  { id: 'habits',      label: 'Habits',        icon: '✅' },
  { id: 'inspiration', label: 'Inspiration',   icon: '💡' },
  { id: 'webclipper',  label: 'Web Clipper',   icon: '🌐' },
]

const COMPONENTS = {
  pomodoro: Pomodoro,
  stickynote: StickyNote,
  particles: ParticleArt,
  beatpad: BeatPad,
  habits: HabitTracker,
  inspiration: Inspiration,
  webclipper: WebClipper,
}

export const widgetComponent = (type) => COMPONENTS[type] ?? null
