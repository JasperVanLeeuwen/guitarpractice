# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step, no package manager. Open `index.html` directly in a browser, or serve it with any static file server:

```
npx serve .
# or
python -m http.server
```

Because `app.js` uses `type="module"` (for the smplr import), it must be served over HTTP — `file://` will hit CORS errors in most browsers.

## Architecture

Everything lives in three files: `index.html` (structure), `styles.css` (design + animations), `app.js` (all logic).

### app.js layers

**Music theory** — `NOTES` array (12 chromatic notes) and `PROGRESSION_TYPES` (array of progressions, each defined as semitone offsets + chord quality + Roman numeral). `buildProgression(typeId, keyIndex)` computes concrete chord names on the fly from intervals; nothing is hardcoded per key.

**Timing engine** — Web Audio API lookahead scheduler: `setInterval` fires every 25 ms, the `scheduler()` function looks 100 ms ahead and queues beats into the AudioContext timeline. `scheduleClick()` places oscillator nodes at exact `AudioContext.currentTime` offsets. Visual updates (`onBeatVisual`) fire via `setTimeout` calculated from the same beat time, keeping audio and UI in sync without blocking the main thread.

**Chord advancement** — `onBeatVisual` → `transitionToNextChord` → `advanceChord`. Chord changes happen on beat 0 of every Nth measure (`measuresPerChord`). `measureCount` tracks how many downbeats have elapsed since the last chord change.

**Piano playback** — `SplendidGrandPiano` from [smplr](https://github.com/danigb/smplr) imported as an ES module from jsDelivr CDN. `initPiano()` is called lazily on first use (when the Piano button is toggled or Start is pressed with piano enabled). `playChord()` parses the chord name string (root + quality suffix), maps quality to semitone intervals via `CHORD_INTERVALS`, computes MIDI note numbers from C3 (MIDI 48) as base, and calls `piano.start()` with a duration equal to the current measures-per-chord window.

**State** — single `state` object (bpm, time sig, measuresPerChord, progression/key selection, running flags). No framework; DOM is updated imperatively. Progression/key changes while running take effect on the next downbeat by resetting `currentChordIndex = -1` and `measureCount = 0`.

### PWA

`sw.js` uses install-time precaching (cache-first for local assets, network fallback for everything else). The smplr CDN and its sample audio files are fetched from the network and not cached by the service worker.
