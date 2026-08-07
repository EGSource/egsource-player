/*!
 * EG Stem Player
 * Self-contained embeddable multi-stem audio player with real-time
 * semitone transpose (pitch shift without changing tempo), powered by
 * SoundTouchJS for high-quality pitch shifting (no chopping/flutter
 * artifacts like basic granular approaches).
 *
 * Usage:
 *   <script src="eg-stem-player.js"></script>
 *   <eg-stem-player
 *     title="A Thousand Hallelujahs"
 *     key="D"
 *     tracks='[
 *       {"name":"EG1","src":"https://.../eg1.mp3"},
 *       {"name":"EG2","src":"https://.../eg2.mp3"},
 *       {"name":"BAND","src":"https://.../band.mp3"},
 *       {"name":"VOCALS","src":"https://.../vocals.mp3"},
 *       {"name":"CLICK & CUES","src":"https://.../click.mp3"}
 *     ]'>
 *   </eg-stem-player>
 *
 * The "key" attribute is optional. If provided, the transpose control
 * shows the resulting musical key (e.g. "D -> E (+2)") instead of just
 * a semitone count.
 */
(function () {
  'use strict';

  const COLORS = {
    bg: '#0a0a0a',
    controlsBg: '#232323',
    played: '#5bc8e8',
    unplayed: '#8a8a8a',
    text: '#f2f2f2',
    subtext: '#9a9a9a',
    accent: '#5bc8e8'
  };

  // ---- SoundTouchJS (bundled inline, no external CDN dependency) ------
  // Source: soundtouchjs v0.1.30 (LGPL) by Olli Parviainen / Ryan Berdeen /
  // Jakub Fiala / Steve 'Cutter' Blades. Inlined here so the player has zero
  // runtime dependency on any external script host â avoids failures from
  // wifi filters, ad/tracker blockers, or CDN outages blocking a 3rd-party
  // domain.
  const SOUNDTOUCH_SRC = `/*
 * SoundTouch JS v0.1.30 audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

class FifoSampleBuffer {
  constructor() {
    this._vector = new Float32Array();
    this._position = 0;
    this._frameCount = 0;
  }
  get vector() {
    return this._vector;
  }
  get position() {
    return this._position;
  }
  get startIndex() {
    return this._position * 2;
  }
  get frameCount() {
    return this._frameCount;
  }
  get endIndex() {
    return (this._position + this._frameCount) * 2;
  }
  clear() {
    this.receive(this._frameCount);
    this.rewind();
  }
  put(numFrames) {
    this._frameCount += numFrames;
  }
  putSamples(samples, position, numFrames = 0) {
    position = position || 0;
    const sourceOffset = position * 2;
    if (!(numFrames >= 0)) {
      numFrames = (samples.length - sourceOffset) / 2;
    }
    const numSamples = numFrames * 2;
    this.ensureCapacity(numFrames + this._frameCount);
    const destOffset = this.endIndex;
    this.vector.set(samples.subarray(sourceOffset, sourceOffset + numSamples), destOffset);
    this._frameCount += numFrames;
  }
  putBuffer(buffer, position, numFrames = 0) {
    position = position || 0;
    if (!(numFrames >= 0)) {
      numFrames = buffer.frameCount - position;
    }
    this.putSamples(buffer.vector, buffer.position + position, numFrames);
  }
  receive(numFrames) {
    if (!(numFrames >= 0) || numFrames > this._frameCount) {
      numFrames = this.frameCount;
    }
    this._frameCount -= numFrames;
    this._position += numFrames;
  }
  receiveSamples(output, numFrames = 0) {
    const numSamples = numFrames * 2;
    const sourceOffset = this.startIndex;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
    this.receive(numFrames);
  }
  extract(output, position = 0, numFrames = 0) {
    const sourceOffset = this.startIndex + position * 2;
    const numSamples = numFrames * 2;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
  }
  ensureCapacity(numFrames = 0) {
    const minLength = parseInt(numFrames * 2);
    if (this._vector.length < minLength) {
      const newVector = new Float32Array(minLength);
      newVector.set(this._vector.subarray(this.startIndex, this.endIndex));
      this._vector = newVector;
      this._position = 0;
    } else {
      this.rewind();
    }
  }
  ensureAdditionalCapacity(numFrames = 0) {
    this.ensureCapacity(this._frameCount + numFrames);
  }
  rewind() {
    if (this._position > 0) {
      this._vector.set(this._vector.subarray(this.startIndex, this.endIndex));
      this._position = 0;
    }
  }
}

class AbstractFifoSamplePipe {
  constructor(createBuffers) {
    if (createBuffers) {
      this._inputBuffer = new FifoSampleBuffer();
      this._outputBuffer = new FifoSampleBuffer();
    } else {
      this._inputBuffer = this._outputBuffer = null;
    }
  }
  get inputBuffer() {
    return this._inputBuffer;
  }
  set inputBuffer(inputBuffer) {
    this._inputBuffer = inputBuffer;
  }
  get outputBuffer() {
    return this._outputBuffer;
  }
  set outputBuffer(outputBuffer) {
    this._outputBuffer = outputBuffer;
  }
  clear() {
    this._inputBuffer.clear();
    this._outputBuffer.clear();
  }
}

class RateTransposer extends AbstractFifoSamplePipe {
  constructor(createBuffers) {
    super(createBuffers);
    this.reset();
    this._rate = 1;
  }
  set rate(rate) {
    this._rate = rate;
  }
  reset() {
    this.slopeCount = 0;
    this.prevSampleL = 0;
    this.prevSampleR = 0;
  }
  clone() {
    const result = new RateTransposer();
    result.rate = this._rate;
    return result;
  }
  process() {
    const numFrames = this._inputBuffer.frameCount;
    this._outputBuffer.ensureAdditionalCapacity(numFrames / this._rate + 1);
    const numFramesOutput = this.transpose(numFrames);
    this._inputBuffer.receive();
    this._outputBuffer.put(numFramesOutput);
  }
  transpose(numFrames = 0) {
    if (numFrames === 0) {
      return 0;
    }
    const src = this._inputBuffer.vector;
    const srcOffset = this._inputBuffer.startIndex;
    const dest = this._outputBuffer.vector;
    const destOffset = this._outputBuffer.endIndex;
    let used = 0;
    let i = 0;
    while (this.slopeCount < 1.0) {
      dest[destOffset + 2 * i] = (1.0 - this.slopeCount) * this.prevSampleL + this.slopeCount * src[srcOffset];
      dest[destOffset + 2 * i + 1] = (1.0 - this.slopeCount) * this.prevSampleR + this.slopeCount * src[srcOffset + 1];
      i = i + 1;
      this.slopeCount += this._rate;
    }
    this.slopeCount -= 1.0;
    if (numFrames !== 1) {
      out: while (true) {
        while (this.slopeCount > 1.0) {
          this.slopeCount -= 1.0;
          used = used + 1;
          if (used >= numFrames - 1) {
            break out;
          }
        }
        const srcIndex = srcOffset + 2 * used;
        dest[destOffset + 2 * i] = (1.0 - this.slopeCount) * src[srcIndex] + this.slopeCount * src[srcIndex + 2];
        dest[destOffset + 2 * i + 1] = (1.0 - this.slopeCount) * src[srcIndex + 1] + this.slopeCount * src[srcIndex + 3];
        i = i + 1;
        this.slopeCount += this._rate;
      }
    }
    this.prevSampleL = src[srcOffset + 2 * numFrames - 2];
    this.prevSampleR = src[srcOffset + 2 * numFrames - 1];
    return i;
  }
}

class FilterSupport {
  constructor(pipe) {
    this._pipe = pipe;
  }
  get pipe() {
    return this._pipe;
  }
  get inputBuffer() {
    return this._pipe.inputBuffer;
  }
  get outputBuffer() {
    return this._pipe.outputBuffer;
  }
  fillInputBuffer() {
    throw new Error('fillInputBuffer() not overridden');
  }
  fillOutputBuffer(numFrames = 0) {
    while (this.outputBuffer.frameCount < numFrames) {
      const numInputFrames = 8192 * 2 - this.inputBuffer.frameCount;
      this.fillInputBuffer(numInputFrames);
      if (this.inputBuffer.frameCount < 8192 * 2) {
        break;
      }
      this._pipe.process();
    }
  }
  clear() {
    this._pipe.clear();
  }
}

const noop = function () {
  return;
};

class SimpleFilter extends FilterSupport {
  constructor(sourceSound, pipe, callback = noop) {
    super(pipe);
    this.callback = callback;
    this.sourceSound = sourceSound;
    this.historyBufferSize = 22050;
    this._sourcePosition = 0;
    this.outputBufferPosition = 0;
    this._position = 0;
  }
  get position() {
    return this._position;
  }
  set position(position) {
    if (position > this._position) {
      throw new RangeError('New position may not be greater than current position');
    }
    const newOutputBufferPosition = this.outputBufferPosition - (this._position - position);
    if (newOutputBufferPosition < 0) {
      throw new RangeError('New position falls outside of history buffer');
    }
    this.outputBufferPosition = newOutputBufferPosition;
    this._position = position;
  }
  get sourcePosition() {
    return this._sourcePosition;
  }
  set sourcePosition(sourcePosition) {
    this.clear();
    this._sourcePosition = sourcePosition;
  }
  onEnd() {
    this.callback();
  }
  fillInputBuffer(numFrames = 0) {
    const samples = new Float32Array(numFrames * 2);
    const numFramesExtracted = this.sourceSound.extract(samples, numFrames, this._sourcePosition);
    this._sourcePosition += numFramesExtracted;
    this.inputBuffer.putSamples(samples, 0, numFramesExtracted);
  }
  extract(target, numFrames = 0) {
    this.fillOutputBuffer(this.outputBufferPosition + numFrames);
    const numFramesExtracted = Math.min(numFrames, this.outputBuffer.frameCount - this.outputBufferPosition);
    this.outputBuffer.extract(target, this.outputBufferPosition, numFramesExtracted);
    const currentFrames = this.outputBufferPosition + numFramesExtracted;
    this.outputBufferPosition = Math.min(this.historyBufferSize, currentFrames);
    this.outputBuffer.receive(Math.max(currentFrames - this.historyBufferSize, 0));
    this._position += numFramesExtracted;
    return numFramesExtracted;
  }
  handleSampleData(event) {
    this.extract(event.data, 4096);
  }
  clear() {
    super.clear();
    this.outputBufferPosition = 0;
  }
}

const USE_AUTO_SEQUENCE_LEN = 0;
const DEFAULT_SEQUENCE_MS = USE_AUTO_SEQUENCE_LEN;
const USE_AUTO_SEEKWINDOW_LEN = 0;
const DEFAULT_SEEKWINDOW_MS = USE_AUTO_SEEKWINDOW_LEN;
const DEFAULT_OVERLAP_MS = 8;
const _SCAN_OFFSETS = [[124, 186, 248, 310, 372, 434, 496, 558, 620, 682, 744, 806, 868, 930, 992, 1054, 1116, 1178, 1240, 1302, 1364, 1426, 1488, 0], [-100, -75, -50, -25, 25, 50, 75, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [-20, -15, -10, -5, 5, 10, 15, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [-4, -3, -2, -1, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
const AUTOSEQ_TEMPO_LOW = 0.5;
const AUTOSEQ_TEMPO_TOP = 2.0;
const AUTOSEQ_AT_MIN = 125.0;
const AUTOSEQ_AT_MAX = 50.0;
const AUTOSEQ_K = (AUTOSEQ_AT_MAX - AUTOSEQ_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEQ_C = AUTOSEQ_AT_MIN - AUTOSEQ_K * AUTOSEQ_TEMPO_LOW;
const AUTOSEEK_AT_MIN = 25.0;
const AUTOSEEK_AT_MAX = 15.0;
const AUTOSEEK_K = (AUTOSEEK_AT_MAX - AUTOSEEK_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEEK_C = AUTOSEEK_AT_MIN - AUTOSEEK_K * AUTOSEQ_TEMPO_LOW;
class Stretch extends AbstractFifoSamplePipe {
  constructor(createBuffers) {
    super(createBuffers);
    this._quickSeek = true;
    this.midBufferDirty = false;
    this.midBuffer = null;
    this.overlapLength = 0;
    this.autoSeqSetting = true;
    this.autoSeekSetting = true;
    this._tempo = 1;
    this.setParameters(44100, DEFAULT_SEQUENCE_MS, DEFAULT_SEEKWINDOW_MS, DEFAULT_OVERLAP_MS);
  }
  clear() {
    super.clear();
    this.clearMidBuffer();
  }
  clearMidBuffer() {
    if (this.midBufferDirty) {
      this.midBufferDirty = false;
      this.midBuffer = null;
    }
  }
  setParameters(sampleRate, sequenceMs, seekWindowMs, overlapMs) {
    if (sampleRate > 0) {
      this.sampleRate = sampleRate;
    }
    if (overlapMs > 0) {
      this.overlapMs = overlapMs;
    }
    if (sequenceMs > 0) {
      this.sequenceMs = sequenceMs;
      this.autoSeqSetting = false;
    } else {
      this.autoSeqSetting = true;
    }
    if (seekWindowMs > 0) {
      this.seekWindowMs = seekWindowMs;
      this.autoSeekSetting = false;
    } else {
      this.autoSeekSetting = true;
    }
    this.calculateSequenceParameters();
    this.calculateOverlapLength(this.overlapMs);
    this.tempo = this._tempo;
  }
  set tempo(newTempo) {
    let intskip;
    this._tempo = newTempo;
    this.calculateSequenceParameters();
    this.nominalSkip = this._tempo * (this.seekWindowLength - this.overlapLength);
    this.skipFract = 0;
    intskip = Math.floor(this.nominalSkip + 0.5);
    this.sampleReq = Math.max(intskip + this.overlapLength, this.seekWindowLength) + this.seekLength;
  }
  get tempo() {
    return this._tempo;
  }
  get inputChunkSize() {
    return this.sampleReq;
  }
  get outputChunkSize() {
    return this.overlapLength + Math.max(0, this.seekWindowLength - 2 * this.overlapLength);
  }
  calculateOverlapLength(overlapInMsec = 0) {
    let newOvl;
    newOvl = this.sampleRate * overlapInMsec / 1000;
    newOvl = newOvl < 16 ? 16 : newOvl;
    newOvl -= newOvl % 8;
    this.overlapLength = newOvl;
    this.refMidBuffer = new Float32Array(this.overlapLength * 2);
    this.midBuffer = new Float32Array(this.overlapLength * 2);
  }
  checkLimits(x, mi, ma) {
    return x < mi ? mi : x > ma ? ma : x;
  }
  calculateSequenceParameters() {
    let seq;
    let seek;
    if (this.autoSeqSetting) {
      seq = AUTOSEQ_C + AUTOSEQ_K * this._tempo;
      seq = this.checkLimits(seq, AUTOSEQ_AT_MAX, AUTOSEQ_AT_MIN);
      this.sequenceMs = Math.floor(seq + 0.5);
    }
    if (this.autoSeekSetting) {
      seek = AUTOSEEK_C + AUTOSEEK_K * this._tempo;
      seek = this.checkLimits(seek, AUTOSEEK_AT_MAX, AUTOSEEK_AT_MIN);
      this.seekWindowMs = Math.floor(seek + 0.5);
    }
    this.seekWindowLength = Math.floor(this.sampleRate * this.sequenceMs / 1000);
    this.seekLength = Math.floor(this.sampleRate * this.seekWindowMs / 1000);
  }
  set quickSeek(enable) {
    this._quickSeek = enable;
  }
  clone() {
    const result = new Stretch();
    result.tempo = this._tempo;
    result.setParameters(this.sampleRate, this.sequenceMs, this.seekWindowMs, this.overlapMs);
    return result;
  }
  seekBestOverlapPosition() {
    return this._quickSeek ? this.seekBestOverlapPositionStereoQuick() : this.seekBestOverlapPositionStereo();
  }
  seekBestOverlapPositionStereo() {
    let bestOffset;
    let bestCorrelation;
    let correlation;
    let i = 0;
    this.preCalculateCorrelationReferenceStereo();
    bestOffset = 0;
    bestCorrelation = Number.MIN_VALUE;
    for (; i < this.seekLength; i = i + 1) {
      correlation = this.calculateCrossCorrelationStereo(2 * i, this.refMidBuffer);
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = i;
      }
    }
    return bestOffset;
  }
  seekBestOverlapPositionStereoQuick() {
    let bestOffset;
    let bestCorrelation;
    let correlation;
    let scanCount = 0;
    let correlationOffset;
    let tempOffset;
    this.preCalculateCorrelationReferenceStereo();
    bestCorrelation = Number.MIN_VALUE;
    bestOffset = 0;
    correlationOffset = 0;
    tempOffset = 0;
    for (; scanCount < 4; scanCount = scanCount + 1) {
      let j = 0;
      while (_SCAN_OFFSETS[scanCount][j]) {
        tempOffset = correlationOffset + _SCAN_OFFSETS[scanCount][j];
        if (tempOffset >= this.seekLength) {
          break;
        }
        correlation = this.calculateCrossCorrelationStereo(2 * tempOffset, this.refMidBuffer);
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = tempOffset;
        }
        j = j + 1;
      }
      correlationOffset = bestOffset;
    }
    return bestOffset;
  }
  preCalculateCorrelationReferenceStereo() {
    let i = 0;
    let context;
    let temp;
    for (; i < this.overlapLength; i = i + 1) {
      temp = i * (this.overlapLength - i);
      context = i * 2;
      this.refMidBuffer[context] = this.midBuffer[context] * temp;
      this.refMidBuffer[context + 1] = this.midBuffer[context + 1] * temp;
    }
  }
  calculateCrossCorrelationStereo(mixingPosition, compare) {
    const mixing = this._inputBuffer.vector;
    mixingPosition += this._inputBuffer.startIndex;
    let correlation = 0;
    let i = 2;
    const calcLength = 2 * this.overlapLength;
    let mixingOffset;
    for (; i < calcLength; i = i + 2) {
      mixingOffset = i + mixingPosition;
      correlation += mixing[mixingOffset] * compare[i] + mixing[mixingOffset + 1] * compare[i + 1];
    }
    return correlation;
  }
  overlap(overlapPosition) {
    this.overlapStereo(2 * overlapPosition);
  }
  overlapStereo(inputPosition) {
    const input = this._inputBuffer.vector;
    inputPosition += this._inputBuffer.startIndex;
    const output = this._outputBuffer.vector;
    const outputPosition = this._outputBuffer.endIndex;
    let i = 0;
    let context;
    let tempFrame;
    const frameScale = 1 / this.overlapLength;
    let fi;
    let inputOffset;
    let outputOffset;
    for (; i < this.overlapLength; i = i + 1) {
      tempFrame = (this.overlapLength - i) * frameScale;
      fi = i * frameScale;
      context = 2 * i;
      inputOffset = context + inputPosition;
      outputOffset = context + outputPosition;
      output[outputOffset + 0] = input[inputOffset + 0] * fi + this.midBuffer[context + 0] * tempFrame;
      output[outputOffset + 1] = input[inputOffset + 1] * fi + this.midBuffer[context + 1] * tempFrame;
    }
  }
  process() {
    let offset;
    let temp;
    let overlapSkip;
    if (this.midBuffer === null) {
      if (this._inputBuffer.frameCount < this.overlapLength) {
        return;
      }
      this.midBuffer = new Float32Array(this.overlapLength * 2);
      this._inputBuffer.receiveSamples(this.midBuffer, this.overlapLength);
    }
    while (this._inputBuffer.frameCount >= this.sampleReq) {
      offset = this.seekBestOverlapPosition();
      this._outputBuffer.ensureAdditionalCapacity(this.overlapLength);
      this.overlap(Math.floor(offset));
      this._outputBuffer.put(this.overlapLength);
      temp = this.seekWindowLength - 2 * this.overlapLength;
      if (temp > 0) {
        this._outputBuffer.putBuffer(this._inputBuffer, offset + this.overlapLength, temp);
      }
      const start = this._inputBuffer.startIndex + 2 * (offset + this.seekWindowLength - this.overlapLength);
      this.midBuffer.set(this._inputBuffer.vector.subarray(start, start + 2 * this.overlapLength));
      this.skipFract += this.nominalSkip;
      overlapSkip = Math.floor(this.skipFract);
      this.skipFract -= overlapSkip;
      this._inputBuffer.receive(overlapSkip);
    }
  }
}

const testFloatEqual = function (a, b) {
  return (a > b ? a - b : b - a) > 1e-10;
};

class SoundTouch {
  constructor() {
    this.transposer = new RateTransposer(false);
    this.stretch = new Stretch(false);
    this._inputBuffer = new FifoSampleBuffer();
    this._intermediateBuffer = new FifoSampleBuffer();
    this._outputBuffer = new FifoSampleBuffer();
    this._rate = 0;
    this._tempo = 0;
    this.virtualPitch = 1.0;
    this.virtualRate = 1.0;
    this.virtualTempo = 1.0;
    this.calculateEffectiveRateAndTempo();
  }
  clear() {
    this.transposer.clear();
    this.stretch.clear();
  }
  clone() {
    const result = new SoundTouch();
    result.rate = this.rate;
    result.tempo = this.tempo;
    return result;
  }
  get rate() {
    return this._rate;
  }
  set rate(rate) {
    this.virtualRate = rate;
    this.calculateEffectiveRateAndTempo();
  }
  set rateChange(rateChange) {
    this._rate = 1.0 + 0.01 * rateChange;
  }
  get tempo() {
    return this._tempo;
  }
  set tempo(tempo) {
    this.virtualTempo = tempo;
    this.calculateEffectiveRateAndTempo();
  }
  set tempoChange(tempoChange) {
    this.tempo = 1.0 + 0.01 * tempoChange;
  }
  set pitch(pitch) {
    this.virtualPitch = pitch;
    this.calculateEffectiveRateAndTempo();
  }
  set pitchOctaves(pitchOctaves) {
    this.pitch = Math.exp(0.69314718056 * pitchOctaves);
    this.calculateEffectiveRateAndTempo();
  }
  set pitchSemitones(pitchSemitones) {
    this.pitchOctaves = pitchSemitones / 12.0;
  }
  get inputBuffer() {
    return this._inputBuffer;
  }
  get outputBuffer() {
    return this._outputBuffer;
  }
  calculateEffectiveRateAndTempo() {
    const previousTempo = this._tempo;
    const previousRate = this._rate;
    this._tempo = this.virtualTempo / this.virtualPitch;
    this._rate = this.virtualRate * this.virtualPitch;
    if (testFloatEqual(this._tempo, previousTempo)) {
      this.stretch.tempo = this._tempo;
    }
    if (testFloatEqual(this._rate, previousRate)) {
      this.transposer.rate = this._rate;
    }
    if (this._rate > 1.0) {
      if (this._outputBuffer != this.transposer.outputBuffer) {
        this.stretch.inputBuffer = this._inputBuffer;
        this.stretch.outputBuffer = this._intermediateBuffer;
        this.transposer.inputBuffer = this._intermediateBuffer;
        this.transposer.outputBuffer = this._outputBuffer;
      }
    } else {
      if (this._outputBuffer != this.stretch.outputBuffer) {
        this.transposer.inputBuffer = this._inputBuffer;
        this.transposer.outputBuffer = this._intermediateBuffer;
        this.stretch.inputBuffer = this._intermediateBuffer;
        this.stretch.outputBuffer = this._outputBuffer;
      }
    }
  }
  process() {
    if (this._rate > 1.0) {
      this.stretch.process();
      this.transposer.process();
    } else {
      this.transposer.process();
      this.stretch.process();
    }
  }
}

class WebAudioBufferSource {
  constructor(buffer) {
    this.buffer = buffer;
    this._position = 0;
  }
  get dualChannel() {
    return this.buffer.numberOfChannels > 1;
  }
  get position() {
    return this._position;
  }
  set position(value) {
    this._position = value;
  }
  extract(target, numFrames = 0, position = 0) {
    this.position = position;
    let left = this.buffer.getChannelData(0);
    let right = this.dualChannel ? this.buffer.getChannelData(1) : this.buffer.getChannelData(0);
    let i = 0;
    for (; i < numFrames; i++) {
      target[i * 2] = left[i + position];
      target[i * 2 + 1] = right[i + position];
    }
    return Math.min(numFrames, left.length - position);
  }
}

const getWebAudioNode = function (context, filter, sourcePositionCallback = noop, bufferSize = 4096) {
  const node = context.createScriptProcessor(bufferSize, 2, 2);
  const samples = new Float32Array(bufferSize * 2);
  node.onaudioprocess = event => {
    let left = event.outputBuffer.getChannelData(0);
    let right = event.outputBuffer.getChannelData(1);
    let framesExtracted = filter.extract(samples, bufferSize);
    sourcePositionCallback(filter.sourcePosition);
    if (framesExtracted === 0) {
      filter.onEnd();
    }
    let i = 0;
    for (; i < framesExtracted; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
  };
  return node;
};

const pad = function (n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};
const minsSecs = function (secs) {
  const mins = Math.floor(secs / 60);
  const seconds = secs - mins * 60;
  return \`\${mins}:\${pad(parseInt(seconds), 2)}\`;
};

const onUpdate = function (sourcePosition) {
  const currentTimePlayed = this.timePlayed;
  const sampleRate = this.sampleRate;
  this.sourcePosition = sourcePosition;
  this.timePlayed = sourcePosition / sampleRate;
  if (currentTimePlayed !== this.timePlayed) {
    const timePlayed = new CustomEvent('play', {
      detail: {
        timePlayed: this.timePlayed,
        formattedTimePlayed: this.formattedTimePlayed,
        percentagePlayed: this.percentagePlayed
      }
    });
    this._node.dispatchEvent(timePlayed);
  }
};
class PitchShifter {
  constructor(context, buffer, bufferSize, onEnd = noop) {
    this._soundtouch = new SoundTouch();
    const source = new WebAudioBufferSource(buffer);
    this.timePlayed = 0;
    this.sourcePosition = 0;
    this._filter = new SimpleFilter(source, this._soundtouch, onEnd);
    this._node = getWebAudioNode(context, this._filter, sourcePostion => onUpdate.call(this, sourcePostion), bufferSize);
    this.tempo = 1;
    this.rate = 1;
    this.duration = buffer.duration;
    this.sampleRate = context.sampleRate;
    this.listeners = [];
  }
  get formattedDuration() {
    return minsSecs(this.duration);
  }
  get formattedTimePlayed() {
    return minsSecs(this.timePlayed);
  }
  get percentagePlayed() {
    return 100 * this._filter.sourcePosition / (this.duration * this.sampleRate);
  }
  set percentagePlayed(perc) {
    this._filter.sourcePosition = parseInt(perc * this.duration * this.sampleRate);
    this.sourcePosition = this._filter.sourcePosition;
    this.timePlayed = this.sourcePosition / this.sampleRate;
  }
  get node() {
    return this._node;
  }
  set pitch(pitch) {
    this._soundtouch.pitch = pitch;
  }
  set pitchSemitones(semitone) {
    this._soundtouch.pitchSemitones = semitone;
  }
  set rate(rate) {
    this._soundtouch.rate = rate;
  }
  set tempo(tempo) {
    this._soundtouch.tempo = tempo;
  }
  connect(toNode) {
    this._node.connect(toNode);
  }
  disconnect() {
    this._node.disconnect();
  }
  on(eventName, cb) {
    this.listeners.push({
      name: eventName,
      cb: cb
    });
    this._node.addEventListener(eventName, event => cb(event.detail));
  }
  off(eventName = null) {
    let listeners = this.listeners;
    if (eventName) {
      listeners = listeners.filter(e => e.name === eventName);
    }
    listeners.forEach(e => {
      this._node.removeEventListener(e.name, event => e.cb(event.detail));
    });
  }
}

export { AbstractFifoSamplePipe, PitchShifter, RateTransposer, SimpleFilter, SoundTouch, Stretch, WebAudioBufferSource, getWebAudioNode };
//# sourceMappingURL=soundtouch.js.map
`;

  let _pitchShifterPromise = null;
  function loadPitchShifter() {
    if (!_pitchShifterPromise) {
      const blob = new Blob([SOUNDTOUCH_SRC], { type: 'text/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      _pitchShifterPromise = import(/* webpackIgnore: true */ blobUrl)
        .then((mod) => {
          URL.revokeObjectURL(blobUrl);
          return mod.PitchShifter;
        })
        .catch((err) => {
          URL.revokeObjectURL(blobUrl);
          throw err;
        });
    }
    return _pitchShifterPromise;
  }

  // ---- Note name helpers for key-aware transpose display ---------------
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_ALIASES = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' };

  function parseNoteName(input) {
    if (!input) return null;
    let s = String(input).trim();
    if (!s) return null;
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (FLAT_ALIASES[s]) s = FLAT_ALIASES[s];
    const idx = NOTE_NAMES.indexOf(s);
    return idx === -1 ? null : idx;
  }

  function noteName(idx) {
    return NOTE_NAMES[((idx % 12) + 12) % 12];
  }

  // ---- Pitch-shifted track (wraps a SoundTouchJS PitchShifter) --------
  class PitchTrack {
    constructor(ctx, bus) {
      this.ctx = ctx;
      this.buffer = null;
      this.duration = 0;
      this.shifter = null;
      this.connected = false;

      this.trackGain = ctx.createGain(); // user volume
      this.muteGain = ctx.createGain();  // mute/solo gate
      this.trackGain.connect(this.muteGain);
      this.muteGain.connect(bus);

      this.volume = 1;
      this.muted = false;
      this.pitchRatio = 1;
    }

    async load(src) {
      const res = await fetch(src);
      const arr = await res.arrayBuffer();
      this.buffer = await this.ctx.decodeAudioData(arr);
      this.duration = this.buffer.duration;

      const PitchShifter = await loadPitchShifter();
      this.shifter = new PitchShifter(this.ctx, this.buffer, 4096);
      this.shifter.tempo = 1;
      this.shifter.pitch = this.pitchRatio;
      return this.buffer;
    }

    setVolume(v) {
      this.volume = v;
      this.trackGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
    }

    setMuted(m) {
      this.muted = m;
      this.muteGain.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.01);
    }

    setPitchSemitones(semitones) {
      this.pitchRatio = Math.pow(2, semitones / 12);
      if (this.shifter) this.shifter.pitch = this.pitchRatio;
    }

    seekFraction(frac) {
      if (!this.shifter) return;
      const clamped = Math.max(0, Math.min(1, frac));
      // NOTE: the underlying library's percentagePlayed getter returns
      // 0-100, but its setter expects a plain 0-1 fraction. Asymmetric
      // on purpose in the library itself â do not multiply by 100 here.
      try { this.shifter.percentagePlayed = clamped; } catch (e) { /* ignore */ }
    }

    connectOut() {
      if (this.shifter && !this.connected) {
        this.shifter.connect(this.trackGain);
        this.connected = true;
      }
    }

    disconnectOut() {
      if (this.shifter && this.connected) {
        try { this.shifter.disconnect(); } catch (e) { /* ignore */ }
        this.connected = false;
      }
    }
  }

  // ---- Waveform peak extraction ---------------------------------------
  function computePeaks(buffer, width) {
    const data = buffer.getChannelData(0);
    const samplesPerPixel = Math.max(1, Math.floor(data.length / width));
    const peaks = new Float32Array(width);
    for (let i = 0; i < width; i++) {
      const start = i * samplesPerPixel;
      let max = 0;
      for (let j = 0; j < samplesPerPixel && start + j < data.length; j++) {
        const v = Math.abs(data[start + j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  }

  const ICONS = {
    play: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    loop: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M17 17H7v-4l-5 5 5 5v-4h12v-6h-2zM7 7h10v4l5-5-5-5v4H5v6h2z"/></svg>'
  };

  class EGStemPlayer extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._tracks = [];
      this._ctx = null;
      this._masterGain = null;
      this._isPlaying = false;
      this._loop = false;
      this._duration = 0;
      this._songTitle = '';
      this._songKeyIndex = null;

      this._playStartCtxTime = 0;
      this._playStartSongPos = 0;
      this._pausedAt = 0;

      this._semitones = 0;
      this._raf = null;
    }

    connectedCallback() {
      this._render();

      const titleAttr = this.getAttribute('title');
      if (titleAttr) this._setTitle(titleAttr);

      const keyAttr = this.getAttribute('key');
      if (keyAttr) this.setSongKey(keyAttr);

      const tracksAttr = this.getAttribute('tracks');
      if (tracksAttr) {
        try {
          const parsed = JSON.parse(tracksAttr);
          this.loadTracks(parsed);
        } catch (e) {
          console.error('eg-stem-player: invalid tracks attribute JSON', e);
        }
      }
    }

    _ensureCtx() {
      if (!this._ctx) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._masterGain = this._ctx.createGain();
        this._masterGain.connect(this._ctx.destination);
      }
      return this._ctx;
    }

    async loadTracks(trackDefs) {
      this._ensureCtx();
      this._tracks.forEach(t => { if (t.pitch) t.pitch.disconnectOut(); });
      this._tracks = [];
      this._buildTrackRows(trackDefs.map(t => t.name));

      const loads = trackDefs.map(async (def, i) => {
        const pitch = new PitchTrack(this._ctx, this._masterGain);
        const buffer = await pitch.load(def.src);
        pitch.setPitchSemitones(this._semitones);
        this._tracks[i].pitch = pitch;
        this._tracks[i].buffer = buffer;
        this._duration = Math.max(this._duration, buffer.duration);
        this._drawWaveform(i);
      });

      await Promise.all(loads);
      this._updateTimeDisplay(0);
      this._els.total.textContent = this._formatTime(this._duration);
    }

    // ---- Song key / transpose display -------------------------------
    setTitle(title) {
      this._setTitle(title);
    }

    setSongKey(keyName) {
      const idx = parseNoteName(keyName);
      this._songKeyIndex = idx;
      this._els.transposeLabel.textContent = this._formatSemitones(this._semitones);
    }

    setTransposeSemitones(n) {
      this._semitones = n;
      this._tracks.forEach(t => t.pitch && t.pitch.setPitchSemitones(n));
      this._els.transposeLabel.textContent = this._formatSemitones(n);
    }

    _formatSemitones(n) {
      if (this._songKeyIndex !== null) {
        const from = noteName(this._songKeyIndex);
        if (n === 0) return `Original Key (${from})`;
        const to = noteName(this._songKeyIndex + n);
        const sign = n > 0 ? '+' : '';
        return `${from} \u2192 ${to} (${sign}${n})`;
      }
      if (n === 0) return 'Original Key';
      return (n > 0 ? '+' : '') + n + ' semitone' + (Math.abs(n) === 1 ? '' : 's');
    }

    // ---- Transport --------------------------------------------------
    _songPositionAt(ctxTime) {
      if (!this._isPlaying) return this._pausedAt;
      return this._playStartSongPos + (ctxTime - this._playStartCtxTime);
    }

    play() {
      const ctx = this._ensureCtx();
      if (ctx.state === 'suspended') ctx.resume();
      if (this._isPlaying) return;
      if (this._pausedAt >= this._duration) this._pausedAt = 0;

      const frac = this._duration ? this._pausedAt / this._duration : 0;
      this._tracks.forEach(t => t.pitch && t.pitch.seekFraction(frac));

      this._playStartCtxTime = ctx.currentTime;
      this._playStartSongPos = this._pausedAt;
      this._isPlaying = true;

      this._tracks.forEach(t => t.pitch && t.pitch.connectOut());
      this._runProgressLoop();
      this._els.playBtn.innerHTML = ICONS.pause;
    }

    pause() {
      if (!this._isPlaying) return;
      this._pausedAt = this._songPositionAt(this._ctx.currentTime);
      this._isPlaying = false;
      this._tracks.forEach(t => t.pitch && t.pitch.disconnectOut());
      cancelAnimationFrame(this._raf);
      this._els.playBtn.innerHTML = ICONS.play;
    }

    seek(songPos) {
      const wasPlaying = this._isPlaying;
      if (wasPlaying) {
        this._tracks.forEach(t => t.pitch && t.pitch.disconnectOut());
        this._isPlaying = false;
      }
      this._pausedAt = Math.max(0, Math.min(this._duration, songPos));
      this._updateTimeDisplay(this._pausedAt);
      this._drawAllWaveforms();
      if (wasPlaying) this.play();
    }

    // Like seek(), but always starts playback from the new position â
    // used for scrubber clicks, where clicking the timeline should play
    // from that point whether or not the player was already playing.
    scrubTo(songPos) {
      if (this._isPlaying) {
        this._tracks.forEach(t => t.pitch && t.pitch.disconnectOut());
        this._isPlaying = false;
      }
      this._pausedAt = Math.max(0, Math.min(this._duration, songPos));
      this._updateTimeDisplay(this._pausedAt);
      this._drawAllWaveforms();
      this.play();
    }

    _runProgressLoop() {
      const step = () => {
        if (!this._isPlaying) return;
        const pos = this._songPositionAt(this._ctx.currentTime);

        if (pos >= this._duration) {
          if (this._loop) {
            this.seek(0);
            return;
          } else {
            this.pause();
            this._pausedAt = 0;
            this._updateTimeDisplay(0);
            return;
          }
        }

        this._updateTimeDisplay(pos);
        this._drawAllWaveforms();
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    }

    _updateTimeDisplay(pos) {
      this._els.current.textContent = this._formatTime(pos);
      const pct = this._duration ? pos / this._duration : 0;
      this._els.scrubberFill.style.width = (pct * 100) + '%';
      this._els.scrubberHandle.style.left = (pct * 100) + '%';
    }

    _formatTime(t) {
      if (!isFinite(t)) t = 0;
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return m + ':' + String(s).padStart(2, '0');
    }

    // ---- Mute / Solo logic -------------------------------------------
    _recomputeGates() {
      const anySolo = this._tracks.some(t => t.solo);
      this._tracks.forEach(t => {
        if (!t.pitch) return;
        const audible = anySolo ? t.solo : !t.mute;
        t.pitch.setMuted(!audible);
      });
    }

    // ---- UI ------------------------------------------------------------
    _setTitle(title) {
      this._songTitle = title;
      if (this._els && this._els.title) this._els.title.textContent = title;
    }

    _render() {
      const style = document.createElement('style');
      style.textContent = `
        :host { display:block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .player { background:${COLORS.bg}; border-radius:6px; overflow:hidden; }
        .transport {
          display:flex; align-items:center; gap:14px; padding:14px 18px;
          background:${COLORS.controlsBg}; color:${COLORS.text}; flex-wrap:wrap;
        }
        .icon-btn { background:none; border:none; color:${COLORS.text}; cursor:pointer; display:flex; padding:4px; opacity:0.9; }
        .icon-btn:hover { opacity:1; }
        .icon-btn.active { color:${COLORS.accent}; }
        .mix-btn {
          background:#2c2c2c; border:1px solid #444; color:${COLORS.subtext};
          font-size:11px; font-weight:700; letter-spacing:0.5px;
          width:28px; height:22px; border-radius:4px; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
        }
        .mix-btn:hover { border-color:#666; color:${COLORS.text}; }
        .mix-btn.solo-btn.active { background:${COLORS.accent}; border-color:${COLORS.accent}; color:#0a0a0a; }
        .mix-btn.mute-btn.active { background:#e85b5b; border-color:#e85b5b; color:#0a0a0a; }
        .song-title { font-size:15px; font-weight:600; margin-right:8px; white-space:nowrap; }
        .time { font-size:13px; color:${COLORS.subtext}; min-width:36px; text-align:center; }
        .scrubber { position:relative; flex:1; min-width:120px; height:20px; display:flex; align-items:center; cursor:pointer; }
        .scrubber-track { position:relative; width:100%; height:3px; background:#4a4a4a; border-radius:2px; }
        .scrubber-fill { position:absolute; left:0; top:0; height:100%; background:${COLORS.subtext}; border-radius:2px; width:0%; }
        .scrubber-handle { position:absolute; top:50%; width:12px; height:12px; border-radius:50%; background:${COLORS.text}; transform:translate(-50%,-50%); left:0%; }
        .transpose { display:flex; align-items:center; gap:8px; padding-left:8px; border-left:1px solid #3a3a3a; }
        .transpose-label { font-size:12px; color:${COLORS.subtext}; min-width:110px; text-align:center; }
        .transpose-btn { background:#333; border:1px solid #4a4a4a; color:${COLORS.text}; width:24px; height:24px; border-radius:4px; cursor:pointer; font-size:15px; line-height:1; }
        .transpose-btn:hover { background:#444; }
        .tracks { background:#000; }
        .track-row { display:flex; align-items:center; padding:10px 18px; border-bottom:1px solid #161616; }
        .track-controls { display:flex; align-items:center; gap:10px; width:210px; flex-shrink:0; }
        .vol-slider { width:70px; accent-color:${COLORS.subtext}; }
        .track-name { color:${COLORS.text}; font-size:13px; font-weight:600; width:110px; flex-shrink:0; letter-spacing:0.3px; }
        .waveform-wrap { flex:1; height:44px; }
        canvas { width:100%; height:100%; display:block; }
        .credit { text-align:right; padding:4px 10px; font-size:10px; color:#555; background:#000; }
      `;

      const wrap = document.createElement('div');
      wrap.className = 'player';
      wrap.innerHTML = `
        <div class="transport">
          <button class="icon-btn" data-role="play">${ICONS.play}</button>
          <button class="icon-btn" data-role="loop">${ICONS.loop}</button>
          <div class="song-title" data-role="title"></div>
          <div class="time" data-role="current">0:00</div>
          <div class="scrubber" data-role="scrubber">
            <div class="scrubber-track">
              <div class="scrubber-fill" data-role="fill"></div>
              <div class="scrubber-handle" data-role="handle"></div>
            </div>
          </div>
          <div class="time" data-role="total">0:00</div>
          <div class="transpose">
            <button class="transpose-btn" data-role="down">\u2013</button>
            <div class="transpose-label" data-role="transposeLabel">Original Key</div>
            <button class="transpose-btn" data-role="up">+</button>
          </div>
        </div>
        <div class="tracks" data-role="tracks"></div>
        <div class="credit">EG Stem Player</div>
      `;

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(wrap);

      this._els = {
        playBtn: wrap.querySelector('[data-role="play"]'),
        loopBtn: wrap.querySelector('[data-role="loop"]'),
        title: wrap.querySelector('[data-role="title"]'),
        current: wrap.querySelector('[data-role="current"]'),
        total: wrap.querySelector('[data-role="total"]'),
        scrubber: wrap.querySelector('[data-role="scrubber"]'),
        scrubberFill: wrap.querySelector('[data-role="fill"]'),
        scrubberHandle: wrap.querySelector('[data-role="handle"]'),
        tracksWrap: wrap.querySelector('[data-role="tracks"]'),
        transposeLabel: wrap.querySelector('[data-role="transposeLabel"]'),
        transposeUp: wrap.querySelector('[data-role="up"]'),
        transposeDown: wrap.querySelector('[data-role="down"]')
      };

      this._els.playBtn.addEventListener('click', () => {
        this._isPlaying ? this.pause() : this.play();
      });
      this._els.loopBtn.addEventListener('click', () => {
        this._loop = !this._loop;
        this._els.loopBtn.classList.toggle('active', this._loop);
      });
      this._els.transposeUp.addEventListener('click', () => {
        this.setTransposeSemitones(Math.min(6, this._semitones + 1));
      });
      this._els.transposeDown.addEventListener('click', () => {
        this.setTransposeSemitones(Math.max(-6, this._semitones - 1));
      });
      this._els.scrubber.addEventListener('click', (e) => {
        const rect = this._els.scrubber.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        this.scrubTo(pct * this._duration);
      });
    }

    _buildTrackRows(names) {
      this._els.tracksWrap.innerHTML = '';
      this._tracks = names.map((name) => ({ name, mute: false, solo: false, pitch: null, buffer: null }));

      names.forEach((name, i) => {
        const row = document.createElement('div');
        row.className = 'track-row';
        row.innerHTML = `
          <div class="track-controls">
            <button class="mix-btn solo-btn" data-i="${i}" data-role="solo" title="Solo">S</button>
            <button class="mix-btn mute-btn" data-i="${i}" data-role="mute" title="Mute">M</button>
            <input type="range" class="vol-slider" data-i="${i}" data-role="vol" min="0" max="1" step="0.01" value="1">
          </div>
          <div class="track-name">${name}</div>
          <div class="waveform-wrap"><canvas data-role="canvas"></canvas></div>
        `;
        this._els.tracksWrap.appendChild(row);

        const soloBtn = row.querySelector('[data-role="solo"]');
        const muteBtn = row.querySelector('[data-role="mute"]');
        const volSlider = row.querySelector('[data-role="vol"]');
        const canvas = row.querySelector('canvas');

        this._tracks[i].els = { row, soloBtn, muteBtn, volSlider, canvas };

        soloBtn.addEventListener('click', () => {
          const t = this._tracks[i];
          t.solo = !t.solo;
          soloBtn.classList.toggle('active', t.solo);
          this._recomputeGates();
        });
        muteBtn.addEventListener('click', () => {
          const t = this._tracks[i];
          t.mute = !t.mute;
          muteBtn.classList.toggle('active', t.mute);
          this._recomputeGates();
        });
        volSlider.addEventListener('input', () => {
          const t = this._tracks[i];
          const v = parseFloat(volSlider.value);
          if (t.pitch) t.pitch.setVolume(v);
        });
      });
    }

    _drawWaveform(i) {
      const t = this._tracks[i];
      if (!t || !t.buffer) return;
      const canvas = t.els.canvas;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(200, rect.width || 600);
      const h = 44;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const peaks = computePeaks(t.buffer, Math.floor(w));
      t._peaks = peaks;
      t._canvasW = w;
      t._canvasH = h;
      this._paintWaveform(i, 0);
    }

    _paintWaveform(i, playedFrac) {
      const t = this._tracks[i];
      if (!t || !t._peaks) return;
      const canvas = t.els.canvas;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const w = t._canvasW, h = t._canvasH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;
      const peaks = t._peaks;
      const playedX = Math.floor(playedFrac * w);
      for (let x = 0; x < peaks.length; x++) {
        const amp = Math.max(2, peaks[x] * (h - 4));
        ctx.fillStyle = x <= playedX ? COLORS.played : COLORS.unplayed;
        ctx.fillRect(x, mid - amp / 2, 1, amp);
      }
    }

    _drawAllWaveforms() {
      if (!this._duration) return;
      const pos = this._songPositionAt(this._ctx ? this._ctx.currentTime : 0);
      const frac = Math.max(0, Math.min(1, pos / this._duration));
      this._tracks.forEach((t, i) => this._paintWaveform(i, frac));
    }
  }

  customElements.define('eg-stem-player', EGStemPlayer);
  window.EGStemPlayer = EGStemPlayer;
})();
