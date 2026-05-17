# Guitar Chord Practice

> This project is completely vibe-coded.

A progressive web app for practicing guitar chord changes. Select a progression and key, set a tempo, and a new chord is shown at the start of each measure.

## Usage

Open `index.html` directly in any modern browser — no server or build step required. On mobile, use "Add to Home Screen" to install as a standalone app (works offline).

## Files

```
index.html      — markup and structure
styles.css      — visual design and animations
app.js          — timing engine, music theory, UI logic
manifest.json   — PWA manifest
sw.js           — service worker (offline caching)
icon.svg        — app icon
```

## Features

### Playback
- **BPM control** — slider and numeric input, range 40–200; adjustable while running
- **Time signature** — 4/4 or 3/4
- **Measures per chord** — 1, 2, or 4 measures per chord change (default 2)
- **Beat indicator** — one dot per beat; current beat highlighted, downbeat flashes white
- **Metronome click** — optional audio click (toggle with the **Click** button); downbeat accented at 1000 Hz, other beats at 750 Hz; scheduled via AudioContext for sample-accurate timing

### Chord Display
- Large centered chord name with smooth fade/slide transition each measure
- Progression name and key shown below (e.g. `ii–V–I · C`)
- Position dots indicating which chord in the progression is active

### Progression Selection
- **10 progression types:**
  - `ii–V–I` — jazz (e.g. Dm7 – G7 – Cmaj7)
  - `ii–V–I–VI` — jazz turnaround with secondary dominant
  - `I–IV–V` — blues / rock
  - `I–IV–ii–V` — jazz / bossa nova
  - `I–V–vi–IV` — pop
  - `I–vi–IV–V` — 50s
  - `I–iii–IV–V` — ascending classic rock
  - `i–iv–V` — natural minor
  - `i–VII–VI–V` — Andalusian cadence (descending)
  - `i–VI–III–VII` — natural minor cycle
- **All 12 keys** — C C# D Eb E F F# G Ab A Bb B; chord names computed from intervals
- Click any **Type** or **Key** button to switch immediately (takes effect on next downbeat while running)
- **Random** button picks a random type and key

## Technical Notes

**Timing:** Web Audio API `AudioContext.currentTime` with a lookahead scheduler (25 ms tick, 100 ms lookahead). Visual updates use `setTimeout` offset from the scheduled beat time. BPM changes take effect immediately — no restart needed.

**Metronome audio:** Oscillator nodes with exponential gain decay (40 ms), scheduled at exact beat times in the AudioContext timeline.

**Music theory:** Chord names are generated from semitone intervals applied to the selected root — no hardcoded chord lists per key.

**PWA:** Service worker caches all app assets for offline use. Manifest enables "Add to Home Screen" on Android and iOS.

**Responsive:** Mobile-first layout using `100dvh`, `env(safe-area-inset-*)` for notched phones, and touch targets ≥ 34 px. Header wraps to two rows on narrow screens.
