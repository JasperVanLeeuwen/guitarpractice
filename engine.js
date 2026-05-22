// Chord practice engine — instantiable so multiple variants can coexist on a page.
// Wraps the music theory, timing scheduler, metronome, and piano playback.
// The view layer subscribes via callbacks; the engine knows nothing about the DOM.

export const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const PROGRESSION_TYPES = [
  { id: 'ii-V-I',       name: 'ii–V–I',       steps: [
      { semitones: 2, quality: 'm7',   degree: 'ii' },
      { semitones: 7, quality: '7',    degree: 'V'  },
      { semitones: 0, quality: 'maj7', degree: 'I'  },
  ]},
  { id: 'ii-V-I-VI',    name: 'ii–V–I–VI',    steps: [
      { semitones: 2, quality: 'm7',   degree: 'ii' },
      { semitones: 7, quality: '7',    degree: 'V'  },
      { semitones: 0, quality: 'maj7', degree: 'I'  },
      { semitones: 9, quality: '7',    degree: 'VI' },
  ]},
  { id: 'I-IV-V',       name: 'I–IV–V',       steps: [
      { semitones: 0, quality: '', degree: 'I'  },
      { semitones: 5, quality: '', degree: 'IV' },
      { semitones: 7, quality: '', degree: 'V'  },
  ]},
  { id: 'I-IV-ii-V',    name: 'I–IV–ii–V',    steps: [
      { semitones: 0, quality: '',  degree: 'I'  },
      { semitones: 5, quality: '',  degree: 'IV' },
      { semitones: 2, quality: 'm', degree: 'ii' },
      { semitones: 7, quality: '',  degree: 'V'  },
  ]},
  { id: 'I-V-vi-IV',    name: 'I–V–vi–IV',    steps: [
      { semitones: 0, quality: '',  degree: 'I'  },
      { semitones: 7, quality: '',  degree: 'V'  },
      { semitones: 9, quality: 'm', degree: 'vi' },
      { semitones: 5, quality: '',  degree: 'IV' },
  ]},
  { id: 'I-vi-IV-V',    name: 'I–vi–IV–V',    steps: [
      { semitones: 0, quality: '',  degree: 'I'  },
      { semitones: 9, quality: 'm', degree: 'vi' },
      { semitones: 5, quality: '',  degree: 'IV' },
      { semitones: 7, quality: '',  degree: 'V'  },
  ]},
  { id: 'I-iii-IV-V',   name: 'I–iii–IV–V',   steps: [
      { semitones: 0, quality: '',  degree: 'I'   },
      { semitones: 4, quality: 'm', degree: 'iii' },
      { semitones: 5, quality: '',  degree: 'IV'  },
      { semitones: 7, quality: '',  degree: 'V'   },
  ]},
  { id: 'i-iv-V',       name: 'i–iv–V',       steps: [
      { semitones: 0, quality: 'm', degree: 'i'  },
      { semitones: 5, quality: 'm', degree: 'iv' },
      { semitones: 7, quality: '7', degree: 'V'  },
  ]},
  { id: 'i-VII-VI-V',   name: 'i–VII–VI–V',   steps: [
      { semitones:  0, quality: 'm', degree: 'i'   },
      { semitones: 10, quality: '',  degree: 'VII' },
      { semitones:  8, quality: '',  degree: 'VI'  },
      { semitones:  7, quality: '',  degree: 'V'   },
  ]},
  { id: 'i-VI-III-VII', name: 'i–VI–III–VII', steps: [
      { semitones:  0, quality: 'm', degree: 'i'   },
      { semitones:  8, quality: '',  degree: 'VI'  },
      { semitones:  3, quality: '',  degree: 'III' },
      { semitones: 10, quality: '',  degree: 'VII' },
  ]},
];

const CHORD_INTERVALS = {
  '':     [0, 4, 7],
  'm':    [0, 3, 7],
  '7':    [0, 4, 7, 10],
  'maj7': [0, 4, 7, 11],
  'm7':   [0, 3, 7, 10],
};

export function buildProgression(typeId, keyIndex) {
  const type = PROGRESSION_TYPES.find(t => t.id === typeId);
  return {
    name:    type.name,
    key:     NOTES[keyIndex],
    chords:  type.steps.map(s => NOTES[(keyIndex + s.semitones) % 12] + s.quality),
    degrees: type.steps.map(s => s.degree),
  };
}

const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;

export class ChordEngine {
  constructor() {
    this.state = {
      bpm: 80,
      beatsPerMeasure: 4,
      measuresPerChord: 2,
      progressionTypeId: 'ii-V-I',
      keyIndex: 0,
      isRunning: false,
      metronomeEnabled: false,
      chordsHidden: false,
      pianoEnabled: false,
    };
    this.audioCtx = null;
    this.scheduler = null;
    this.nextBeatTime = 0;
    this.currentBeat = 0;
    this.measureCount = 0;
    this.currentProgression = null;
    this.currentChordIndex = -1;
    this.piano = null;
    this.pianoReady = false;
    this.pianoLoading = false;
    this.listeners = { beat: [], chord: [], state: [], pianoStatus: [] };
  }

  on(event, fn) {
    this.listeners[event].push(fn);
    return () => {
      this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    };
  }

  emit(event, payload) {
    (this.listeners[event] || []).forEach(fn => fn(payload));
  }

  setBpm(bpm) {
    this.state.bpm = Math.max(40, Math.min(200, parseInt(bpm) || 80));
    this.emit('state', this.state);
  }
  setBeatsPerMeasure(n) {
    this.state.beatsPerMeasure = n;
    this.currentBeat = 0;
    this.emit('state', this.state);
  }
  setMeasuresPerChord(n) {
    this.state.measuresPerChord = n;
    this.measureCount = 0;
    this.emit('state', this.state);
  }
  setMetronomeEnabled(v) {
    this.state.metronomeEnabled = v;
    this.emit('state', this.state);
  }
  setChordsHidden(v) {
    this.state.chordsHidden = v;
    this.emit('state', this.state);
    if (this.currentProgression && this.currentChordIndex >= 0) {
      const c = this.currentProgression;
      this.emit('chord', {
        chord: v ? c.degrees[this.currentChordIndex] : c.chords[this.currentChordIndex],
        roman: v,
        index: this.currentChordIndex,
        progression: c,
        transition: false,
      });
    }
  }
  async setPianoEnabled(v) {
    this.state.pianoEnabled = v;
    this.emit('state', this.state);
    if (v) {
      this._ensureAudio();
      await this._initPiano();
    }
  }

  selectProgression(typeId, keyIndex) {
    this.state.progressionTypeId = typeId;
    this.state.keyIndex = keyIndex;
    this.emit('state', this.state);
    if (this.state.isRunning) {
      this.currentProgression = buildProgression(typeId, keyIndex);
      this.currentChordIndex = -1;
      this.measureCount = 0;
      this.emit('chord', {
        chord: null, index: -1, progression: this.currentProgression, transition: false,
      });
    }
  }

  selectRandom() {
    const t = PROGRESSION_TYPES[Math.floor(Math.random() * PROGRESSION_TYPES.length)].id;
    const k = Math.floor(Math.random() * 12);
    this.selectProgression(t, k);
  }

  _ensureAudio() {
    if (!this.audioCtx) this.audioCtx = new AudioCtxCtor();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
  }

  async _initPiano() {
    if (this.piano || this.pianoLoading) return;
    this.pianoLoading = true;
    this.emit('pianoStatus', { ready: false, loading: true });
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/smplr/+esm');
      this.piano = new mod.SplendidGrandPiano(this.audioCtx);
      await this.piano.load;
      this.pianoReady = true;
      this.pianoLoading = false;
      this.emit('pianoStatus', { ready: true, loading: false });
    } catch (err) {
      console.warn('Piano failed to load', err);
      this.pianoLoading = false;
      this.emit('pianoStatus', { ready: false, loading: false, error: true });
    }
  }

  _playChord(chordName) {
    if (!this.pianoReady || !this.state.pianoEnabled) return;
    const m = chordName.match(/^([A-G][b#]?)(.*)$/);
    if (!m) return;
    const root = NOTES.indexOf(m[1]);
    if (root < 0) return;
    const ivs = CHORD_INTERVALS[m[2]] ?? CHORD_INTERVALS[''];
    const base = 48 + root;
    const dur = this.state.measuresPerChord * this.state.beatsPerMeasure * (60 / this.state.bpm);
    ivs.forEach(s => this.piano.start({ note: base + s, velocity: 80, duration: dur }));
  }

  _scheduleClick(time, isDownbeat) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = isDownbeat ? 1000 : 750;
    gain.gain.setValueAtTime(isDownbeat ? 0.4 : 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.start(time); osc.stop(time + 0.04);
  }

  _onBeatVisual(beat) {
    this.emit('beat', { beat, beatsPerMeasure: this.state.beatsPerMeasure });
    if (beat === 0) {
      if (this.measureCount % this.state.measuresPerChord === 0) {
        this._transitionToNextChord();
      }
      this.measureCount++;
    }
  }

  _advanceChord() {
    if (!this.currentProgression) {
      this.currentProgression = buildProgression(this.state.progressionTypeId, this.state.keyIndex);
      this.currentChordIndex = 0;
    } else {
      this.currentChordIndex = (this.currentChordIndex + 1) % this.currentProgression.chords.length;
    }
    return this.currentProgression.chords[this.currentChordIndex];
  }

  _transitionToNextChord() {
    const next = this._advanceChord();
    this._playChord(next);
    const p = this.currentProgression;
    this.emit('chord', {
      chord:   this.state.chordsHidden ? p.degrees[this.currentChordIndex] : next,
      roman:   this.state.chordsHidden,
      index:   this.currentChordIndex,
      progression: p,
      transition: true,
    });
  }

  _scheduler() {
    const lookAhead = 0.1;
    while (this.nextBeatTime < this.audioCtx.currentTime + lookAhead) {
      const delay = Math.max(0, (this.nextBeatTime - this.audioCtx.currentTime) * 1000);
      const beat = this.currentBeat;
      setTimeout(() => this._onBeatVisual(beat), delay);
      if (this.state.metronomeEnabled) this._scheduleClick(this.nextBeatTime, this.currentBeat === 0);
      this.nextBeatTime += 60 / this.state.bpm;
      this.currentBeat = (this.currentBeat + 1) % this.state.beatsPerMeasure;
    }
  }

  start() {
    this._ensureAudio();
    if (this.state.pianoEnabled) this._initPiano();
    this.currentBeat = 0;
    this.currentProgression = null;
    this.currentChordIndex = -1;
    this.measureCount = 0;
    this.nextBeatTime = this.audioCtx.currentTime + 0.05;
    this.scheduler = setInterval(() => this._scheduler(), 25);
    this.state.isRunning = true;
    this.emit('state', this.state);
  }

  stop() {
    clearInterval(this.scheduler);
    this.scheduler = null;
    this.state.isRunning = false;
    this.currentProgression = null;
    this.currentChordIndex = -1;
    this.emit('state', this.state);
    this.emit('beat', { beat: -1, beatsPerMeasure: this.state.beatsPerMeasure });
    this.emit('chord', { chord: null, index: -1, progression: null, transition: false });
  }

  toggle() {
    if (this.state.isRunning) this.stop(); else this.start();
  }
}
