import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

let whisperPipelinePromise = null;

/**
 * Extracts 16kHz mono Float32 PCM samples from a video file using ffmpeg-static
 */
export function extractPcmFloat32FromVideo(videoPath, startTime = 0, durationSec = 180) {
  return new Promise((resolve, reject) => {
    const args = [
      '-ss', String(Math.max(0, startTime)),
      '-t', String(Math.max(1, durationSec)),
      '-i', videoPath,
      '-vn',
      '-f', 'f32le',
      '-acodec', 'pcm_f32le',
      '-ar', '16000',
      '-ac', '1',
      'pipe:1'
    ];

    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    const chunks = [];
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('FFmpeg PCM extraction timed out'));
    }, 60000);

    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && chunks.length === 0) {
        return reject(new Error(`FFmpeg PCM exited with ${code}: ${stderr.slice(-300)}`));
      }
      const buffer = Buffer.concat(chunks);
      const sampleCount = Math.floor(buffer.byteLength / 4);
      const float32 = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        float32[i] = buffer.readFloatLE(i * 4);
      }
      resolve(float32);
    });
  });
}

/**
 * Loads the local Whisper ONNX model via @xenova/transformers
 */
async function getWhisperTranscriber() {
  if (!whisperPipelinePromise) {
    whisperPipelinePromise = (async () => {
      console.log('[ClipaCortes STT] Carregando motor local Whisper Speech-to-Text (Xenova/whisper-base)...');
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = true;
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
        quantized: true
      });
    })().catch(async (err) => {
      console.warn('[ClipaCortes STT] Fallback para Xenova/whisper-tiny:', err.message);
      const { pipeline } = await import('@xenova/transformers');
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        quantized: true
      });
    });
  }
  return whisperPipelinePromise;
}

/**
 * Splits a long Whisper chunk into short readable subtitle segments (max ~7 words per segment)
 * with proportional timestamps so captions are crisp and synchronized.
 */
function splitChunkIntoReadableSubtitles(text, chunkStart, chunkEnd, timeOffset = 0) {
  const cleanText = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleanText) return [];

  const allWords = cleanText.split(' ').filter(Boolean);
  if (allWords.length === 0) return [];

  const absStart = Math.max(0, Number(chunkStart || 0) + timeOffset);
  const absEnd = Math.max(absStart + 0.6, Number(chunkEnd || absStart + 3) + timeOffset);
  const totalDur = Math.max(0.6, absEnd - absStart);

  const maxWordsPerSegment = 7;
  const segments = [];
  const totalWords = allWords.length;

  for (let i = 0; i < totalWords; i += maxWordsPerSegment) {
    const slice = allWords.slice(i, i + maxWordsPerSegment);
    const segStartRatio = i / totalWords;
    const segEndRatio = Math.min(1, (i + slice.length) / totalWords);

    const segStart = Math.round((absStart + segStartRatio * totalDur) * 100) / 100;
    const segEnd = Math.round((absStart + segEndRatio * totalDur) * 100) / 100;
    const segText = slice.join(' ');

    const wordDur = Math.max(0.2, segEnd - segStart) / slice.length;
    const palette = ['#FACC15', '#22C55E', '#38BDF8', '#EF4444'];

    const words = slice.map((w, wIdx) => {
      const wStart = Math.round((segStart + wIdx * wordDur) * 100) / 100;
      const wEnd = Math.round((segStart + (wIdx + 1) * wordDur) * 100) / 100;
      const cleanW = w.replace(/[.,!?]/g, '');
      const isHighlight = cleanW.length >= 7 || /\d/.test(cleanW);
      return {
        word: w,
        start: wStart,
        end: wEnd,
        highlight: isHighlight,
        color: isHighlight ? palette[wIdx % palette.length] : '#FFFFFF'
      };
    });

    segments.push({
      id: `sub-whisper-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      speakerId: 'spk-1',
      speakerName: '',
      startTime: segStart,
      endTime: segEnd,
      text: segText,
      emoji: '',
      words
    });
  }

  return segments;
}

/**
 * Transcribes the actual spoken audio of a local video file using Whisper ASR
 * Returns an array of synchronized subtitle segments with word-level timestamps.
 */
export async function transcribeVideoWithLocalWhisper(videoPath, startTime = 0, maxDurationSec = 180) {
  const pcmFloat32 = await extractPcmFloat32FromVideo(videoPath, startTime, maxDurationSec);
  if (!pcmFloat32 || pcmFloat32.length < 1600) {
    return [];
  }

  // Check if audio has actual signal energy
  let sumSq = 0;
  const step = Math.max(1, Math.floor(pcmFloat32.length / 8000));
  let count = 0;
  for (let i = 0; i < pcmFloat32.length; i += step) {
    sumSq += pcmFloat32[i] * pcmFloat32[i];
    count++;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, count));
  if (rms < 0.0005) {
    console.warn('[ClipaCortes STT] Áudio em silêncio absoluto detectado (RMS < 0.0005).');
    return [];
  }

  const transcriber = await getWhisperTranscriber();
  console.log(`[ClipaCortes STT] Transcrevendo ${(pcmFloat32.length / 16000).toFixed(1)}s de áudio com Whisper Local...`);

  const result = await transcriber(pcmFloat32, {
    language: 'portuguese',
    task: 'transcribe',
    chunk_length_s: 25,
    stride_length_s: 4,
    return_timestamps: true
  });

  const rawChunks = Array.isArray(result?.chunks) && result.chunks.length > 0
    ? result.chunks
    : result?.text
    ? [{ text: result.text, timestamp: [0, pcmFloat32.length / 16000] }]
    : [];

  const allSubtitles = [];
  rawChunks.forEach((ch) => {
    const cStart = Array.isArray(ch.timestamp) && ch.timestamp[0] !== null ? ch.timestamp[0] : 0;
    const cEnd =
      Array.isArray(ch.timestamp) && ch.timestamp[1] !== null
        ? ch.timestamp[1]
        : cStart + 3.5;
    const subSegments = splitChunkIntoReadableSubtitles(ch.text, cStart, cEnd, startTime);
    allSubtitles.push(...subSegments);
  });

  console.log(`[ClipaCortes STT] Transcrição Whisper concluída: ${allSubtitles.length} legendas sincronizadas.`);
  return allSubtitles;
}
