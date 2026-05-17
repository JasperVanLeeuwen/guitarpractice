'use strict';

// ── Music Theory ──────────────────────────────────────────────────────
const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Each step: semitones above the root, chord quality suffix, Roman numeral degree
const PROGRESSION_TYPES = [
  {
    id: 'ii-V-I',
    name: 'ii–V–I',
    steps: [
      { semitones: 2, quality: 'm7',   degree: 'ii'  },
      { semitones: 7, quality: '7',    degree: 'V'   },
      { semitones: 0, quality: 'maj7', degree: 'I'   },
    ]
  },
  {
    id: 'ii-V-I-VI',
    name: 'ii–V–I–VI',
    steps: [
      { semitones: 2, quality: 'm7',   degree: 'ii'  },
      { semitones: 7, quality: '7',    degree: 'V'   },
      { semitones: 0, quality: 'maj7', degree: 'I'   },
      { semitones: 9, quality: '7',    degree: 'VI'  },
    ]
  },
  {
    id: 'I-IV-V',
    name: 'I–IV–V',
    steps: [
      { semitones: 0, quality: '', degree: 'I'  },
      { semitones: 5, quality: '', degree: 'IV' },
      { semitones: 7, quality: '', degree: 'V'  },
    ]
  },
  {
    id: 'I-IV-ii-V',
    name: 'I–IV–ii–V',
    steps: [
      { semitones: 0, quality: ''  , degree: 'I'  },
      { semitones: 5, quality: ''  , degree: 'IV' },
      { semitones: 2, quality: 'm' , degree: 'ii' },
      { semitones: 7, quality: ''  , degree: 'V'  },
    ]
  },
  {
    id: 'I-V-vi-IV',
    name: 'I–V–vi–IV',
    steps: [
      { semitones: 0, quality: ''  , degree: 'I'  },
      { semitones: 7, quality: ''  , degree: 'V'  },
      { semitones: 9, quality: 'm' , degree: 'vi' },
      { semitones: 5, quality: ''  , degree: 'IV' },
    ]
  },
  {
    id: 'I-vi-IV-V',
    name: 'I–vi–IV–V',
    steps: [
      { semitones: 0, quality: ''  , degree: 'I'  },
      { semitones: 9, quality: 'm' , degree: 'vi' },
      { semitones: 5, quality: ''  , degree: 'IV' },
      { semitones: 7, quality: ''  , degree: 'V'  },
    ]
  },
  {
    id: 'I-iii-IV-V',
    name: 'I–iii–IV–V',
    steps: [
      { semitones: 0, quality: ''  , degree: 'I'   },
      { semitones: 4, quality: 'm' , degree: 'iii' },
      { semitones: 5, quality: ''  , degree: 'IV'  },
      { semitones: 7, quality: ''  , degree: 'V'   },
    ]
  },
  {
    id: 'i-iv-V',
    name: 'i–iv–V',
    steps: [
      { semitones: 0, quality: 'm' , degree: 'i'  },
      { semitones: 5, quality: 'm' , degree: 'iv' },
      { semitones: 7, quality: '7' , degree: 'V'  },
    ]
  },
  {
    id: 'i-VII-VI-V',
    name: 'i–VII–VI–V',
    steps: [
      { semitones:  0, quality: 'm', degree: 'i'   },
      { semitones: 10, quality: '' , degree: 'VII' },
      { semitones:  8, quality: '' , degree: 'VI'  },
      { semitones:  7, quality: '' , degree: 'V'   },
    ]
  },
  {
    id: 'i-VI-III-VII',
    name: 'i–VI–III–VII',
    steps: [
      { semitones:  0, quality: 'm', degree: 'i'   },
      { semitones:  8, quality: '' , degree: 'VI'  },
      { semitones:  3, quality: '' , degree: 'III' },
      { semitones: 10, quality: '' , degree: 'VII' },
    ]
  },
];

function buildProgression(typeId, keyIndex) {
  const type = PROGRESSION_TYPES.find(t => t.id === typeId);
  const chords  = type.steps.map(step => NOTES[(keyIndex + step.semitones) % 12] + step.quality);
  const degrees = type.steps.map(step => step.degree);
  return { name: type.name, key: NOTES[keyIndex], chords, degrees };
}

// ── State ─────────────────────────────────────────────────────────────
const state = {
  bpm: 80,
  beatsPerMeasure: 4,
  measuresPerChord: 2,
  progressionTypeId: 'ii-V-I',
  keyIndex: 0,  // C
  isRunning: false,
  metronomeEnabled: false,
  chordsHidden: false,
};

// ── Timing State ──────────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let schedulerTimer = null;
let nextBeatTime = 0;
let currentBeat = 0;

// ── Progression State ─────────────────────────────────────────────────
let currentProgression = null;
let currentChordIndex  = -1;
let measureCount       = 0;

// ── DOM References ────────────────────────────────────────────────────
const chordDisplay      = document.getElementById('chord-display');
const chordNameEl       = document.getElementById('chord-name');
const beatIndicator     = document.getElementById('beat-indicator');
const progressionLabel  = document.getElementById('progression-label');
const progressionDotsEl = document.getElementById('progression-dots');
const bpmSlider         = document.getElementById('bpm-slider');
const bpmInput          = document.getElementById('bpm-input');
const startStopBtn      = document.getElementById('start-stop-btn');
const clickToggleBtn    = document.getElementById('click-toggle-btn');
const chordsToggleBtn   = document.getElementById('chords-toggle-btn');
const typeGrid          = document.getElementById('type-grid');
const keyGrid           = document.getElementById('key-grid');

// ── Timing Engine ─────────────────────────────────────────────────────
function getSecondsPerBeat() {
  return 60 / state.bpm;
}

function advanceBeat() {
  nextBeatTime += getSecondsPerBeat();
  currentBeat = (currentBeat + 1) % state.beatsPerMeasure;
}

function scheduleClick(time, isDownbeat) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = isDownbeat ? 1000 : 750;
  gain.gain.setValueAtTime(isDownbeat ? 0.4 : 0.25, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
  osc.start(time);
  osc.stop(time + 0.04);
}

function scheduler() {
  const lookAhead = 0.1;
  while (nextBeatTime < audioCtx.currentTime + lookAhead) {
    const delay = Math.max(0, (nextBeatTime - audioCtx.currentTime) * 1000);
    const beat = currentBeat;
    setTimeout(() => onBeatVisual(beat), delay);
    if (state.metronomeEnabled) scheduleClick(nextBeatTime, currentBeat === 0);
    advanceBeat();
  }
}

// ── Visual Beat Handler ───────────────────────────────────────────────
function onBeatVisual(beatNumber) {
  updateBeatDots(beatNumber);
  if (beatNumber === 0) {
    if (measureCount % state.measuresPerChord === 0) {
      transitionToNextChord();
    }
    measureCount++;
  }
}

function updateBeatDots(activeBeat) {
  beatIndicator.querySelectorAll('.beat-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === activeBeat);
    dot.classList.toggle('downbeat', i === activeBeat && activeBeat === 0);
  });
}

function resetBeatDots() {
  beatIndicator.querySelectorAll('.beat-dot').forEach(dot => {
    dot.classList.remove('active', 'downbeat');
  });
}

// ── Chord Advancement ─────────────────────────────────────────────────
function advanceChord() {
  if (!currentProgression) {
    currentProgression = buildProgression(state.progressionTypeId, state.keyIndex);
    currentChordIndex = 0;
    buildProgressionDots();
  } else {
    currentChordIndex = (currentChordIndex + 1) % currentProgression.chords.length;
  }
  return currentProgression.chords[currentChordIndex];
}

// ── Chord Transition ──────────────────────────────────────────────────
function transitionToNextChord() {
  const nextChord = advanceChord();

  chordDisplay.classList.remove('exiting', 'entering');
  void chordDisplay.offsetWidth;

  chordDisplay.classList.add('exiting');

  setTimeout(() => {
    chordNameEl.textContent = state.chordsHidden
      ? currentProgression.degrees[currentChordIndex]
      : nextChord;
    chordNameEl.classList.toggle('roman', state.chordsHidden);
    updateProgressionInfo();

    chordDisplay.classList.remove('exiting');
    chordDisplay.classList.add('entering');

    setTimeout(() => chordDisplay.classList.remove('entering'), 220);
  }, 220);
}

// ── Progression Info Display ──────────────────────────────────────────
function buildProgressionDots() {
  progressionDotsEl.innerHTML = '';
  if (!currentProgression) return;
  currentProgression.chords.forEach(() => {
    const dot = document.createElement('div');
    dot.className = 'prog-dot';
    progressionDotsEl.appendChild(dot);
  });
}

function updateProgressionInfo() {
  if (!currentProgression) return;
  progressionLabel.textContent = `${currentProgression.name}  ·  ${currentProgression.key}`;
  progressionDotsEl.querySelectorAll('.prog-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentChordIndex);
  });
}

// ── Selection ─────────────────────────────────────────────────────────
function selectProgression(typeId, keyIndex) {
  state.progressionTypeId = typeId;
  state.keyIndex = keyIndex;

  // Update button highlights
  typeGrid.querySelectorAll('.sel-btn').forEach(b =>
    b.classList.toggle('active-selection', b.dataset.typeId === typeId));
  keyGrid.querySelectorAll('.sel-btn').forEach(b =>
    b.classList.toggle('active-selection', parseInt(b.dataset.keyIndex) === keyIndex));

  if (state.isRunning) {
    // Queue switch: takes effect on next downbeat
    currentProgression = buildProgression(typeId, keyIndex);
    currentChordIndex = -1;
    measureCount = 0;
    buildProgressionDots();
    progressionLabel.textContent = `${currentProgression.name}  ·  ${currentProgression.key}`;
  }
}

function selectRandom() {
  const typeId   = PROGRESSION_TYPES[Math.floor(Math.random() * PROGRESSION_TYPES.length)].id;
  const keyIndex = Math.floor(Math.random() * 12);
  selectProgression(typeId, keyIndex);
}

// ── Start / Stop ──────────────────────────────────────────────────────
function start() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  currentBeat = 0;
  currentProgression = null;
  currentChordIndex = -1;
  measureCount = 0;
  nextBeatTime = audioCtx.currentTime + 0.05;

  schedulerTimer = setInterval(scheduler, 25);
  state.isRunning = true;
  startStopBtn.textContent = 'Stop';
  startStopBtn.classList.add('running');
}

function stop() {
  clearInterval(schedulerTimer);
  schedulerTimer = null;
  state.isRunning = false;
  startStopBtn.textContent = 'Start';
  startStopBtn.classList.remove('running');
  resetBeatDots();
  progressionLabel.textContent = '';
  progressionDotsEl.innerHTML = '';
  chordNameEl.textContent = '–';
}

// ── BPM Controls ──────────────────────────────────────────────────────
function clampBpm(val) {
  return Math.min(200, Math.max(40, parseInt(val) || 80));
}

bpmSlider.addEventListener('input', () => {
  state.bpm = clampBpm(bpmSlider.value);
  bpmInput.value = state.bpm;
});

bpmInput.addEventListener('change', () => {
  state.bpm = clampBpm(bpmInput.value);
  bpmInput.value = state.bpm;
  bpmSlider.value = state.bpm;
});

// ── Time Signature ────────────────────────────────────────────────────
function buildBeatDots() {
  beatIndicator.innerHTML = '';
  for (let i = 0; i < state.beatsPerMeasure; i++) {
    const dot = document.createElement('div');
    dot.className = 'beat-dot';
    beatIndicator.appendChild(dot);
  }
}

document.querySelectorAll('.time-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.beatsPerMeasure = parseInt(btn.dataset.beats);
    currentBeat = 0;
    buildBeatDots();
  });
});

document.querySelectorAll('.measures-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.measures-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.measuresPerChord = parseInt(btn.dataset.measures);
    measureCount = 0;
  });
});

// ── Progression Grid ──────────────────────────────────────────────────
function buildTypeGrid() {
  typeGrid.innerHTML = '';
  PROGRESSION_TYPES.forEach(type => {
    const btn = document.createElement('button');
    btn.className = 'sel-btn';
    btn.textContent = type.name;
    btn.dataset.typeId = type.id;
    btn.title = type.steps.map((s, i) => {
      const degree = ['I','ii','iii','IV','V','vi','vii'][Math.round(s.semitones / 2)];
      return degree + s.quality;
    }).join(' – ');
    if (type.id === state.progressionTypeId) btn.classList.add('active-selection');
    btn.addEventListener('click', () => selectProgression(type.id, state.keyIndex));
    typeGrid.appendChild(btn);
  });
}

function buildKeyGrid() {
  keyGrid.innerHTML = '';
  NOTES.forEach((note, i) => {
    const btn = document.createElement('button');
    btn.className = 'sel-btn key-btn';
    btn.textContent = note;
    btn.dataset.keyIndex = i;
    if (i === state.keyIndex) btn.classList.add('active-selection');
    btn.addEventListener('click', () => selectProgression(state.progressionTypeId, i));
    keyGrid.appendChild(btn);
  });
}

// ── Start/Stop & Random Buttons ───────────────────────────────────────
startStopBtn.addEventListener('click', () => {
  state.isRunning ? stop() : start();
});

clickToggleBtn.addEventListener('click', () => {
  state.metronomeEnabled = !state.metronomeEnabled;
  clickToggleBtn.classList.toggle('active', state.metronomeEnabled);
  clickToggleBtn.setAttribute('aria-pressed', state.metronomeEnabled);
});

chordsToggleBtn.addEventListener('click', () => {
  state.chordsHidden = !state.chordsHidden;
  chordsToggleBtn.classList.toggle('active', state.chordsHidden);
  chordsToggleBtn.setAttribute('aria-pressed', state.chordsHidden);
  // Update the currently shown chord immediately
  if (currentProgression && currentChordIndex >= 0) {
    chordNameEl.textContent = state.chordsHidden
      ? currentProgression.degrees[currentChordIndex]
      : currentProgression.chords[currentChordIndex];
    chordNameEl.classList.toggle('roman', state.chordsHidden);
  }
});

document.getElementById('random-btn').addEventListener('click', selectRandom);

// ── Init ──────────────────────────────────────────────────────────────
buildTypeGrid();
buildKeyGrid();
buildBeatDots();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
