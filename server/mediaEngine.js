import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { VIDEOS_DIR, EXPORTS_DIR } from './db.js';

const ffprobePath = ffprobeInstaller.path;

/**
 * Runs a command via child_process.spawn and returns stdout/stderr
 */
function runProcess(bin, args, timeoutMs = 120000, cwd = undefined) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true, ...(cwd ? { cwd } : {}) });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Process exited with code ${code}: ${stderr.slice(-800)}`));
      }
    });
  });
}

/**
 * Generates a real 60-second 1280x720 MP4 studio podcast demo video using FFmpeg
 */
export async function ensureDemoVideo() {
  const demoPath = path.join(VIDEOS_DIR, 'demo_podcast.mp4');
  if (fs.existsSync(demoPath)) {
    const stat = fs.statSync(demoPath);
    if (stat.size > 50000) {
      return demoPath;
    }
  }

  console.log('[ClipaCortes MediaEngine] Gerando vídeo demo de estúdio (demo_podcast.mp4) via FFmpeg...');
  const vfGraph = [
    'drawbox=x=70:y=90:w=520:h=540:color=0x1e293b@0.95:t=fill',
    'drawbox=x=70:y=90:w=520:h=540:color=0x38bdf8@0.8:t=4',
    'drawbox=x=250:y=200:w=160:h=180:color=0x0284c7@0.9:t=fill',
    'drawbox=x=210:y=400:w=240:h=190:color=0x0369a1@0.85:t=fill',
    'drawbox=x=690:y=90:w=520:h=540:color=0x1e1b4b@0.95:t=fill',
    'drawbox=x=690:y=90:w=520:h=540:color=0xa855f7@0.8:t=4',
    'drawbox=x=870:y=200:w=160:h=180:color=0x9333ea@0.9:t=fill',
    'drawbox=x=830:y=400:w=240:h=190:color=0x7e22ce@0.85:t=fill',
    'drawbox=x=70:y=650:w=1140:h=18:color=0x8b5cf6@0.8:t=fill'
  ].join(',');

  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=0x0f172a:s=1280x720:r=30:d=60',
    '-f', 'lavfi',
    '-i', 'sine=frequency=220:sample_rate=48000:duration=60',
    '-vf', vfGraph,
    '-af', 'volume=0.08',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    demoPath
  ];

  try {
    await runProcess(ffmpegPath, args, 60000);
    console.log('[ClipaCortes MediaEngine] Vídeo demo_podcast.mp4 gerado com sucesso!');
    return demoPath;
  } catch (err) {
    console.error('[ClipaCortes MediaEngine] Erro ao gerar vídeo demo:', err.message);
    return null;
  }
}

/**
 * Inspects a video file with FFprobe (Section 2.1 of PDF documentation)
 */
export async function probeVideo(filePath) {
  try {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];
    const { stdout } = await runProcess(ffprobePath, args, 20000);
    const info = JSON.parse(stdout);
    const videoStream = (info.streams || []).find((s) => s.codec_type === 'video') || {};
    const audioStream = (info.streams || []).find((s) => s.codec_type === 'audio') || {};
    const format = info.format || {};

    let fps = 30;
    if (videoStream.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split('/');
      if (parts.length === 2 && Number(parts[1]) > 0) {
        fps = Math.round((Number(parts[0]) / Number(parts[1])) * 100) / 100;
      }
    }

    const width = Number(videoStream.width) || 1280;
    const height = Number(videoStream.height) || 720;
    const duration = Math.round((Number(format.duration) || Number(videoStream.duration) || 60) * 10) / 10;
    const bitrateKbps = Math.round((Number(format.bit_rate) || 2500000) / 1000);

    return {
      duration,
      width,
      height,
      fps,
      videoCodec: videoStream.codec_name || 'h264',
      audioCodec: audioStream.codec_name || 'aac',
      sampleRate: Number(audioStream.sample_rate) || 48000,
      bitrateKbps,
      aspectRatio: width >= height ? '16:9' : '9:16',
      sizeBytes: Number(format.size) || 0
    };
  } catch (err) {
    console.warn('[FFprobe fallback]', err.message);
    return {
      duration: 60,
      width: 1280,
      height: 720,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      sampleRate: 48000,
      bitrateKbps: 2400,
      aspectRatio: '16:9',
      sizeBytes: 0
    };
  }
}

/**
 * Extracts a compact mono audio file (.mp3) for Gemini Multimodal Speech-to-Text
 * Supports extracting a specific window [startTime, startTime + durationSec]
 */
export async function extractAudioForSTT(videoPath, maxDurationSec = 300, startTimeSec = 0) {
  const outPath = path.join(VIDEOS_DIR, `audio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`);
  const args = [
    '-y',
    '-ss', String(Math.max(0, Number(startTimeSec) || 0)),
    '-t', String(Math.max(1, Number(maxDurationSec) || 60)),
    '-i', videoPath,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-b:a', '64k',
    outPath
  ];
  try {
    await runProcess(ffmpegPath, args, 45000);
    return outPath;
  } catch (err) {
    console.warn('[Audio Extraction Warning]:', err.message);
    return null;
  }
}

/**
 * Uses FFmpeg silencedetect to find real speech/audio activity segments in a newly uploaded video
 * so that fresh, video-accurate subtitle intervals are created for every newly added video.
 */
export async function detectSpeechIntervals(videoPath, totalDuration) {
  const safeDur = Math.max(3, Number(totalDuration) || 20);
  try {
    const args = [
      '-i', videoPath,
      '-af', 'silencedetect=noise=-32dB:d=0.45',
      '-f', 'null',
      '-'
    ];
    const { stderr } = await runProcess(ffmpegPath, args, 25000);
    const silenceStarts = [];
    const silenceEnds = [];

    const startRegex = /silence_start:\s*([0-9.]+)/g;
    const endRegex = /silence_end:\s*([0-9.]+)/g;
    let m;
    while ((m = startRegex.exec(stderr)) !== null) {
      silenceStarts.push(parseFloat(m[1]));
    }
    while ((m = endRegex.exec(stderr)) !== null) {
      silenceEnds.push(parseFloat(m[1]));
    }

    const intervals = [];
    let cursor = 0.1;
    for (let i = 0; i < silenceStarts.length; i++) {
      const sStart = silenceStarts[i];
      if (sStart - cursor >= 1.2) {
        intervals.push({
          start: Math.round(cursor * 10) / 10,
          end: Math.min(safeDur, Math.round(sStart * 10) / 10)
        });
      }
      if (silenceEnds[i] !== undefined) {
        cursor = silenceEnds[i];
      }
    }
    if (safeDur - cursor >= 1.2) {
      intervals.push({
        start: Math.round(cursor * 10) / 10,
        end: Math.round(safeDur * 10) / 10
      });
    }

    // If video has continuous audio without silences, split into clean ~4s intervals
    if (intervals.length === 0) {
      const step = Math.min(4.5, Math.max(2.0, safeDur / Math.ceil(safeDur / 4)));
      for (let t = 0; t < safeDur - 0.5; t += step) {
        intervals.push({
          start: Math.round(t * 10) / 10,
          end: Math.min(safeDur, Math.round((t + step - 0.1) * 10) / 10)
        });
      }
    }
    return intervals.slice(0, 40);
  } catch {
    const intervals = [];
    const step = Math.min(4.5, Math.max(2.0, safeDur / Math.ceil(safeDur / 4)));
    for (let t = 0; t < safeDur - 0.5; t += step) {
      intervals.push({
        start: Math.round(t * 10) / 10,
        end: Math.min(safeDur, Math.round((t + step - 0.1) * 10) / 10)
      });
    }
    return intervals;
  }
}

/**
 * Helper to format seconds into SRT timestamp (HH:MM:SS,mmm)
 */
export function formatSrtTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Generates an SRT content string from a clip's subtitles shifted by clip.startTime
 */
export function generateSrtForClip(clip) {
  const clipStart = Number(clip.startTime) || 0;
  const subs = clip.subtitles || [];
  return subs
    .map((sub, idx) => {
      const relStart = Math.max(0, sub.startTime - clipStart);
      const relEnd = Math.max(relStart + 0.5, sub.endTime - clipStart);
      const text = clip.captionStyle?.uppercase ? (sub.text || '').toUpperCase() : (sub.text || '');
      return `${idx + 1}\n${formatSrtTime(relStart)} --> ${formatSrtTime(relEnd)}\n${text}\n`;
    })
    .join('\n');
}

/**
 * Formats seconds into ASS timestamp format (H:MM:SS.cc)
 */
function formatAssTime(seconds) {
  const totalCs = Math.max(0, Math.round((Number(seconds) || 0) * 100));
  const cs = totalCs % 100;
  const totalSecs = Math.floor(totalCs / 100);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const hrs = Math.floor(totalMins / 60);
  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Converts a #RRGGBB hex color into ASS Style color (&HAABBGGRR)
 */
function hexToAssStyleColor(hex, opacity = 1.0) {
  const clean = String(hex || '#FFFFFF').replace('#', '').trim();
  const num = parseInt(clean, 16);
  const r = isNaN(num) ? 255 : (num >> 16) & 255;
  const g = isNaN(num) ? 255 : (num >> 8) & 255;
  const b = isNaN(num) ? 255 : num & 255;
  const clampedOpacity = Math.min(1, Math.max(0, Number(opacity) ?? 1));
  const alphaByte = Math.round((1 - clampedOpacity) * 255);
  return `&H${alphaByte.toString(16).padStart(2, '0').toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`;
}

/**
 * Converts a #RRGGBB hex color into ASS inline override color (&HBBGGRR&)
 */
function hexToAssInlineColor(hex) {
  const clean = String(hex || '#FFFFFF').replace('#', '').trim();
  const num = parseInt(clean, 16);
  const r = isNaN(num) ? 255 : (num >> 16) & 255;
  const g = isNaN(num) ? 255 : (num >> 8) & 255;
  const b = isNaN(num) ? 255 : num & 255;
  return `&H${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}&`;
}

function escapeAssText(str) {
  return String(str || '')
    .replace(/\\/g, '/')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/\r?\n/g, ' ');
}

/**
 * Normalizes a subtitle's word-level timestamps so they always stay synchronized inside [sub.startTime, sub.endTime]
 */
function normalizeSubtitleWords(sub) {
  const subStart = Number(sub.startTime) || 0;
  const subEnd = Math.max(subStart + 0.25, Number(sub.endTime) || subStart + 1.5);
  const rawWords = String(sub.text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const existingWords = Array.isArray(sub.words) && sub.words.length > 0 ? sub.words : [];
  if (rawWords.length === 0 && existingWords.length === 0) return [];

  const targetCount = existingWords.length > 0 ? existingWords.length : rawWords.length;
  const firstWStart = Number(existingWords[0]?.start);
  const lastWEnd = Number(existingWords[existingWords.length - 1]?.end);

  const needsRetiming =
    existingWords.length === 0 ||
    isNaN(firstWStart) ||
    isNaN(lastWEnd) ||
    firstWStart < subStart - 0.2 ||
    lastWEnd > subEnd + 0.2 ||
    firstWStart >= subEnd ||
    lastWEnd <= subStart;

  if (!needsRetiming) {
    return existingWords;
  }

  const dur = Math.max(0.25, subEnd - subStart);
  const step = dur / Math.max(1, targetCount);
  const count = existingWords.length > 0 ? existingWords.length : rawWords.length;

  const normalized = [];
  for (let i = 0; i < count; i++) {
    const existing = existingWords[i] || {};
    const wordStr = existing.word || rawWords[i] || '';
    if (!wordStr) continue;
    normalized.push({
      word: wordStr,
      start: Math.round((subStart + i * step) * 100) / 100,
      end: Math.round((subStart + (i + 1) * step) * 100) / 100,
      highlight: Boolean(existing.highlight),
      color: existing.color || '#FACC15'
    });
  }
  return normalized;
}

/**
 * Builds a complete Advanced SubStation Alpha (.ass) script for burning:
 * - Dynamic Word-by-Word Karaoke Subtitles (with active word highlight, keyword highlight, custom position, font, outline, shadow, and background box)
 * - Fallback Hook Headline Banner (when no frontend PNG snapshot is passed)
 * - Optional Channel Watermark
 */
export function generateAssForClip(clip, outW = 1080, outH = 1920, options = {}) {
  const { includeHookInAss = true } = options;
  const clipStart = Math.max(0, Number(clip.startTime) || 0);
  const clipEnd = Math.max(clipStart + 1.0, Number(clip.endTime) || clipStart + 15);
  const clipDuration = clipEnd - clipStart;

  const style = clip.captionStyle || {};
  const fontFamily = (style.fontFamily || 'Montserrat').replace(/,/g, ' ');
  const rawFontSize = Math.min(110, Math.max(14, Number(style.fontSize) || 42));
  const baseFontSize = Math.round((rawFontSize / 540) * outW * 1.12);

  const primaryCol = hexToAssStyleColor(style.textColor || '#FFFFFF', 1.0);
  const highlightCol = hexToAssStyleColor(style.highlightColor || '#FACC15', 1.0);
  const strokeCol = hexToAssStyleColor(style.strokeColor || '#000000', 0.92);
  const bgBoxEnabled = Boolean(style.backgroundBox);
  const bgOpacity = Number(style.backgroundOpacity ?? 0.68);
  const backCol = bgBoxEnabled
    ? hexToAssStyleColor(style.backgroundColor || '#000000', bgOpacity)
    : hexToAssStyleColor('#000000', 0.42); // Subtle cinema drop shadow (~42% opacity)

  const rawStroke = Math.min(6, Math.max(0, Number(style.strokeWidth ?? 2)));
  const rawShadow = Math.min(8, Math.max(0, Number(style.shadowBlur ?? 3)));

  const borderStyle = bgBoxEnabled ? 3 : 1;
  const outlineWidth = bgBoxEnabled
    ? Math.round(baseFontSize * 0.2)
    : Math.max(0, Math.round(((rawStroke / 540) * outW * 0.5) * 10) / 10);
  const shadowDepth = bgBoxEnabled
    ? 0
    : rawShadow <= 0
    ? 0
    : Math.max(0.8, Math.min(2.5, Math.round(((rawShadow / 540) * outW * 0.18) * 10) / 10));

  // Hook style fallback config
  const hs = clip.hookStyle || {};
  const hookFontFamily = (hs.fontFamily || 'Montserrat').replace(/,/g, ' ');
  const hookRawSize = Math.min(64, Math.max(14, Number(hs.fontSize) || 24));
  const hookFontSize = Math.round((hookRawSize / 540) * outW * 1.12);
  const hookTextCol = hexToAssStyleColor(hs.textColor || '#FFFFFF', 1.0);
  const hookBgCol = hexToAssStyleColor(hs.bgColor1 || '#0891B2', Number(hs.bgOpacity ?? 0.95));
  const hookBorderCol = hexToAssStyleColor(hs.borderColor || '#38BDF8', 1.0);

  const waterFontSize = Math.max(20, Math.round(outW * 0.026));

  const assLines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${outW}`,
    `PlayResY: ${outH}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: SubStyle,${fontFamily},${baseFontSize},${primaryCol},${highlightCol},${ bgBoxEnabled ? backCol : strokeCol },${backCol},-1,0,0,0,100,100,0,0,${borderStyle},${outlineWidth},${shadowDepth},5,36,36,36,1`,
    `Style: HookStyle,${hookFontFamily},${hookFontSize},${hookTextCol},${hookTextCol},${hookBgCol},${hookBorderCol},-1,0,0,0,100,100,0,0,3,${Math.round(hookFontSize * 0.38)},4,5,40,40,40,1`,
    `Style: WaterStyle,Inter,${waterFontSize},&H55FFFFFF,&H55FFFFFF,&H88000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,2,3,28,28,32,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];

  // 1. Optional Watermark
  if (clip.avTreatment?.watermarkText && String(clip.avTreatment.watermarkText).trim()) {
    const wmText = escapeAssText(clip.avTreatment.watermarkText.trim());
    assLines.push(
      `Dialogue: 1,${formatAssTime(0)},${formatAssTime(clipDuration)},WaterStyle,,0,0,0,,{\\pos(${outW - 28},${outH - 36})\\an3}${wmText}`
    );
  }

  // 2. Fallback Hook Headline in ASS (when frontend PNG snapshot is not used)
  if (includeHookInAss && clip.showHookBanner !== false && clip.hookBannerText && String(clip.hookBannerText).trim()) {
    const rawHook = hs.uppercase !== false
      ? String(clip.hookBannerText).toUpperCase()
      : String(clip.hookBannerText);
    const hookDurConfig = Number(hs.durationSec ?? 4);
    const hookEndSec = hookDurConfig > 0 ? Math.min(clipDuration, hookDurConfig) : clipDuration;
    const hookX = Math.round((outW * Number(hs.positionX ?? 50)) / 100);
    const hookY = Math.round((outH * Number(hs.positionY ?? 8)) / 100);
    const maxWPct = Number(hs.maxWidthPct ?? 88);
    const maxCharsPerLine = Math.max(12, Math.floor(((outW * (maxWPct / 100)) / Math.max(16, hookFontSize * 0.58))));

    const hookWords = escapeAssText(rawHook).split(/\s+/).filter(Boolean);
    const hookWrappedLines = [];
    let curHLine = '';
    hookWords.forEach((hw) => {
      const candidate = curHLine ? `${curHLine} ${hw}` : hw;
      if (candidate.length > maxCharsPerLine && curHLine) {
        hookWrappedLines.push(curHLine);
        curHLine = hw;
      } else {
        curHLine = candidate;
      }
    });
    if (curHLine) hookWrappedLines.push(curHLine);

    const fadeTag = hookDurConfig > 0 ? '\\fad(0,350)' : '';
    assLines.push(
      `Dialogue: 3,${formatAssTime(0)},${formatAssTime(hookEndSec)},HookStyle,,0,0,0,,{\\pos(${hookX},${hookY})\\an5${fadeTag}}${hookWrappedLines.join('\\N')}`
    );
  }

  // 3. Synchronized Word-by-Word Karaoke Subtitles
  const posXPercent = Number(style.positionX ?? 50);
  const posYPercent = Number(style.positionY ?? 74);
  const posX = Math.round((outW * posXPercent) / 100);
  const posY = Math.round((outH * posYPercent) / 100);
  const boxWPct = Math.min(96, Math.max(35, Number(style.boxWidthPct ?? 86)));
  const maxBlockWidth = outW * (boxWPct / 100) - 28;
  const wordsPerLine = Math.max(1, Number(style.wordsPerLine) || 3);
  const isUppercase = style.uppercase !== false;
  const autoFitMargin = style.autoFitMargin !== false;
  const animation = style.animation || 'hormozi_karaoke';

  const inlineDefaultCol = hexToAssInlineColor(style.textColor || '#FFFFFF');
  const inlineActiveCol = hexToAssInlineColor(style.highlightColor || '#FACC15');

  const subs = Array.isArray(clip.subtitles) ? clip.subtitles : [];
  subs.forEach((sub) => {
    const subStartAbs = Number(sub.startTime) || 0;
    const subEndAbs = Math.max(subStartAbs + 0.2, Number(sub.endTime) || subStartAbs + 1.5);
    if (subEndAbs <= clipStart || subStartAbs >= clipEnd) return;

    const words = normalizeSubtitleWords(sub);
    if (words.length === 0) return;

    const pageChunkSize = Math.max(2, wordsPerLine * 2);
    const pages = [];
    for (let i = 0; i < words.length; i += pageChunkSize) {
      pages.push(words.slice(i, i + pageChunkSize));
    }

    pages.forEach((page, pageIdx) => {
      if (page.length === 0) return;

      // Group page words into visual lines (matching drawDynamicSubtitlesInBlock in VideoCanvasPlayer.jsx)
      const avgCharW = baseFontSize * 0.56;
      const lines = [];
      let currentLine = [];
      let currentLineEstW = 0;

      page.forEach((wObj, idxInPage) => {
        const displayWord = isUppercase ? String(wObj.word || '').toUpperCase() : String(wObj.word || '');
        const wordEstW = displayWord.length * avgCharW;
        const projectedW = currentLine.length === 0 ? wordEstW : currentLineEstW + avgCharW + wordEstW;

        if (
          currentLine.length > 0 &&
          (currentLine.length >= wordsPerLine || projectedW > maxBlockWidth * 0.96)
        ) {
          lines.push(currentLine);
          currentLine = [{ wObj, displayWord, idxInPage }];
          currentLineEstW = wordEstW;
        } else {
          currentLine.push({ wObj, displayWord, idxInPage });
          currentLineEstW = projectedW;
        }
      });
      if (currentLine.length > 0) lines.push(currentLine);

      const widestEstLine = Math.max(
        ...lines.map((ln) => ln.map((item) => item.displayWord).join(' ').length * avgCharW * 1.12),
        100
      );
      const baseScalePct =
        autoFitMargin && widestEstLine > maxBlockWidth
          ? Math.max(55, Math.min(100, Math.round((maxBlockWidth / widestEstLine) * 100)))
          : 100;
      const activeScalePct =
        animation === 'hormozi_karaoke' || animation === 'bounce_word'
          ? Math.round(baseScalePct * 1.12)
          : baseScalePct;

      // Emit a contiguous Dialogue event for each active word in the page
      for (let activeIdx = 0; activeIdx < page.length; activeIdx++) {
        const rawStartAbs =
          activeIdx === 0 && pageIdx === 0
            ? Math.min(subStartAbs, Number(page[0].start) || subStartAbs)
            : Number(page[activeIdx].start) || subStartAbs;
        const rawEndAbs =
          activeIdx === page.length - 1
            ? pageIdx === pages.length - 1
              ? Math.max(subEndAbs, Number(page[activeIdx].end) || subEndAbs)
              : Number(pages[pageIdx + 1]?.[0]?.start) || Number(page[activeIdx].end) || subEndAbs
            : Number(page[activeIdx + 1]?.start) || Number(page[activeIdx].end) || subEndAbs;

        const relStart = Math.max(0, rawStartAbs - clipStart);
        const relEnd = Math.min(clipDuration, Math.max(relStart + 0.05, rawEndAbs - clipStart));
        if (relEnd <= relStart || relStart >= clipDuration) continue;

        const formattedLines = lines
          .map((lineItems) =>
            lineItems
              .map(({ wObj, displayWord, idxInPage }) => {
                const safeWord = escapeAssText(displayWord);
                const isSpokenNow = idxInPage === activeIdx;
                const isKeyword = Boolean(wObj.highlight);

                if (isSpokenNow) {
                  return `{\\1c${inlineActiveCol}\\fscx${activeScalePct}\\fscy${activeScalePct}}${safeWord}{\\fscx${baseScalePct}\\fscy${baseScalePct}\\1c${inlineDefaultCol}}`;
                }
                if (isKeyword) {
                  const kwCol = hexToAssInlineColor(wObj.color || style.secondaryColor || '#22C55E');
                  return `{\\1c${kwCol}\\fscx${baseScalePct}\\fscy${baseScalePct}}${safeWord}{\\1c${inlineDefaultCol}}`;
                }
                return `{\\1c${inlineDefaultCol}\\fscx${baseScalePct}\\fscy${baseScalePct}}${safeWord}`;
              })
              .join(' ')
          )
          .join('\\N');

        assLines.push(
          `Dialogue: 2,${formatAssTime(relStart)},${formatAssTime(relEnd)},SubStyle,,0,0,0,,{\\pos(${posX},${posY})\\an5\\blur0.4}${formattedLines}`
        );
      }
    });
  });

  return assLines.join('\n');
}

/**
 * Renders a final edited MP4 clip using FFmpeg according to Section 5 specifications:
 * Supports manual reframing regions (cam1Region for Webcam, cam2Region for Gameplay/Guest),
 * Gameplay Split Screen, Dual Speaker Split Screen, Cinema Blur, Picture-in-Picture (PiP), Manual Pan/Zoom,
 * AND burns in the Hook Headline + Synchronized Subtitles directly into the final MP4 video!
 */
export async function renderClipWithFFmpeg(project, clip, exportOptions = {}) {
  const sourceFileName = project.videoFileName || 'demo_podcast.mp4';
  let sourceVideoPath = path.join(VIDEOS_DIR, sourceFileName);
  if (!fs.existsSync(sourceVideoPath)) {
    sourceVideoPath = await ensureDemoVideo();
  }

  const ratio = exportOptions.aspectRatio || clip.layout?.aspectRatio || '9:16';
  const fps = Number(exportOptions.fps) || 30;
  const layoutMode = clip.layout?.mode || 'auto_speaker';

  let outW = 1080;
  let outH = 1920;
  if (ratio === '1:1') {
    outW = 1080;
    outH = 1080;
  } else if (ratio === '16:9') {
    outW = 1920;
    outH = 1080;
  } else if (ratio === '4:5') {
    outW = 1080;
    outH = 1350;
  }

  if (exportOptions.resolution === '720p') {
    outW = Math.round((outW * 2) / 3 / 2) * 2;
    outH = Math.round((outH * 2) / 3 / 2) * 2;
  }

  const startTime = Math.max(0, Number(clip.startTime) || 0);
  const duration = Math.max(1.5, (Number(clip.endTime) || startTime + 15) - startTime);

  const exportId = `clip_${clip.id}_${Date.now()}`;
  const outputMp4Path = path.join(EXPORTS_DIR, `${exportId}.mp4`);
  const outputSrtPath = path.join(EXPORTS_DIR, `${exportId}.srt`);
  const tempAssFileName = `${exportId}.ass`;
  const tempAssPath = path.join(EXPORTS_DIR, tempAssFileName);
  let tempHookPngPath = null;

  // Save companion SRT file
  const srtContent = generateSrtForClip(clip);
  fs.writeFileSync(outputSrtPath, srtContent, 'utf-8');

  // Decode optional frontend Hook Headline PNG snapshot (preserves exact gradient, rounded border, font & emojis)
  const hasHookBanner = clip.showHookBanner !== false && Boolean(clip.hookBannerText && String(clip.hookBannerText).trim());
  if (hasHookBanner && typeof exportOptions.hookOverlayPng === 'string' && exportOptions.hookOverlayPng.startsWith('data:image/png;base64,')) {
    try {
      const base64Data = exportOptions.hookOverlayPng.replace(/^data:image\/png;base64,/, '');
      tempHookPngPath = path.join(EXPORTS_DIR, `${exportId}_hook.png`);
      fs.writeFileSync(tempHookPngPath, Buffer.from(base64Data, 'base64'));
    } catch (err) {
      console.warn('[Hook PNG Snapshot decode warning]:', err.message);
      tempHookPngPath = null;
    }
  }

  // Generate ASS file for burned-in Subtitles (+ fallback Hook Headline if no PNG snapshot)
  const assContent = generateAssForClip(clip, outW, outH, {
    includeHookInAss: !tempHookPngPath
  });
  fs.writeFileSync(tempAssPath, assContent, 'utf-8');

  // Visual color grading filter
  const brightness = ((Number(clip.avTreatment?.brightness) || 1.0) - 1.0).toFixed(2);
  const contrast = (Number(clip.avTreatment?.contrast) || 1.08).toFixed(2);
  const saturation = (Number(clip.avTreatment?.saturation) || 1.12).toFixed(2);
  const colorFilter = `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`;

  const splitRatioPct = Math.min(80, Math.max(20, Number(clip.layout?.splitRatio) || 38));
  const invertSplit = Boolean(clip.layout?.invertSplit);
  const boxFitMode = clip.layout?.boxFitMode || 'cover';
  const cam1 = clip.layout?.cam1Region || { x: 2, y: 6, w: 28, h: 38 };
  const cam2 = clip.layout?.cam2Region || { x: 18, y: 0, w: 68, h: 100 };

  let vfStages = [];
  if (layoutMode === 'gameplay_split' || layoutMode === 'split_vertical') {
    const firstH = Math.floor(((outH * (splitRatioPct / 100)) / 2)) * 2;
    const secondH = outH - firstH;
    const topH = invertSplit ? secondH : firstH;
    const botH = invertSplit ? firstH : secondH;

    const topReg = invertSplit ? cam2 : cam1;
    const botReg = invertSplit ? cam1 : cam2;

    const tW = Math.max(0.05, Math.min(1, (Number(topReg.w) || 30) / 100)).toFixed(3);
    const tH = Math.max(0.05, Math.min(1, (Number(topReg.h) || 40) / 100)).toFixed(3);
    const tX = Math.max(0, Math.min(1 - Number(tW), (Number(topReg.x) || 0) / 100)).toFixed(3);
    const tY = Math.max(0, Math.min(1 - Number(tH), (Number(topReg.y) || 0) / 100)).toFixed(3);

    const bW = Math.max(0.05, Math.min(1, (Number(botReg.w) || 60) / 100)).toFixed(3);
    const bH = Math.max(0.05, Math.min(1, (Number(botReg.h) || 90) / 100)).toFixed(3);
    const bX = Math.max(0, Math.min(1 - Number(bW), (Number(botReg.x) || 15) / 100)).toFixed(3);
    const bY = Math.max(0, Math.min(1 - Number(bH), (Number(botReg.y) || 0) / 100)).toFixed(3);

    const topFitFilter =
      boxFitMode === 'contain'
        ? `scale=${outW}:${topH}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${outW}:${topH}:(ow-iw)/2:(oh-ih)/2:color=0x090b12`
        : `scale=${outW}:${topH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${outW}:${topH}`;

    const botFitFilter =
      boxFitMode === 'contain'
        ? `scale=${outW}:${botH}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${outW}:${botH}:(ow-iw)/2:(oh-ih)/2:color=0x090b12`
        : `scale=${outW}:${botH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${outW}:${botH}`;

    vfStages.push(
      `[0:v]split=2[v1][v2]`,
      `[v1]crop=in_w*${tW}:in_h*${tH}:in_w*${tX}:in_h*${tY},${topFitFilter}[top]`,
      `[v2]crop=in_w*${bW}:in_h*${bH}:in_w*${bX}:in_h*${bY},${botFitFilter}[bottom]`,
      `[top][bottom]vstack=inputs=2,${colorFilter}[vlayout]`
    );
  } else if (layoutMode === 'pip') {
    const bW = Math.max(0.05, Math.min(1, (Number(cam2.w) || 68) / 100)).toFixed(3);
    const bH = Math.max(0.05, Math.min(1, (Number(cam2.h) || 100) / 100)).toFixed(3);
    const bX = Math.max(0, Math.min(1 - Number(bW), (Number(cam2.x) || 18) / 100)).toFixed(3);
    const bY = Math.max(0, Math.min(1 - Number(bH), (Number(cam2.y) || 0) / 100)).toFixed(3);

    const tW = Math.max(0.05, Math.min(1, (Number(cam1.w) || 28) / 100)).toFixed(3);
    const tH = Math.max(0.05, Math.min(1, (Number(cam1.h) || 38) / 100)).toFixed(3);
    const tX = Math.max(0, Math.min(1 - Number(tW), (Number(cam1.x) || 2) / 100)).toFixed(3);
    const tY = Math.max(0, Math.min(1 - Number(tH), (Number(cam1.y) || 6) / 100)).toFixed(3);

    const pip = clip.layout?.pipDest || { x: 60, y: 12, w: 34, h: 28 };
    const pipW = Math.max(64, Math.floor(((outW * (Number(pip.w) || 34)) / 100) / 2) * 2);
    const pipH = Math.max(64, Math.floor(((outH * (Number(pip.h) || 28)) / 100) / 2) * 2);
    const pipX = Math.round((outW * (Number(pip.x) || 60)) / 100);
    const pipY = Math.round((outH * (Number(pip.y) || 12)) / 100);

    const bgFitFilter =
      boxFitMode === 'contain'
        ? `scale=${outW}:${outH}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=0x090b12`
        : `scale=${outW}:${outH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${outW}:${outH}`;

    vfStages.push(
      `[0:v]split=2[vbg][vpip]`,
      `[vbg]crop=in_w*${bW}:in_h*${bH}:in_w*${bX}:in_h*${bY},${bgFitFilter}[bg]`,
      `[vpip]crop=in_w*${tW}:in_h*${tH}:in_w*${tX}:in_h*${tY},scale=${pipW}:${pipH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${pipW}:${pipH}[pipbox]`,
      `[bg][pipbox]overlay=${pipX}:${pipY},${colorFilter}[vlayout]`
    );
  } else if (layoutMode === 'cinema_blur') {
    vfStages.push(
      `[0:v]split=2[bg][fg]`,
      `[bg]scale=${outW}:${outH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${outW}:${outH},boxblur=16:2[bgblur]`,
      `[fg]scale=${outW}:-2:flags=lanczos[fgscaled]`,
      `[bgblur][fgscaled]overlay=(W-w)/2:(H-h)/2,${colorFilter}[vlayout]`
    );
  } else {
    const focus = clip.layout?.activeSpeakerFocus || 'auto';
    const panX = Number(clip.layout?.manualPanX ?? 50) / 100;
    let cropRatio = panX;
    if (layoutMode === 'auto_speaker') {
      if (focus === 'spk-1') cropRatio = 0.22;
      else if (focus === 'spk-2') cropRatio = 0.78;
      else cropRatio = panX;
    }
    const cropXExpr = `(in_w-out_w)*${Math.max(0, Math.min(1, cropRatio)).toFixed(2)}`;
    vfStages.push(
      `[0:v]scale=${outW}:${outH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${outW}:${outH}:${cropXExpr}:0,${colorFilter}[vlayout]`
    );
  }

  let currentVideoStream = '[vlayout]';

  // Overlay Hook Headline PNG (if provided) with configured duration and smooth fade-out
  if (tempHookPngPath && fs.existsSync(tempHookPngPath)) {
    const hookDurConfig = Number(clip.hookStyle?.durationSec ?? 4);
    if (hookDurConfig > 0 && hookDurConfig < duration) {
      const fadeStart = Math.max(0, hookDurConfig - 0.35).toFixed(2);
      const hookEnd = hookDurConfig.toFixed(2);
      vfStages.push(
        `[1:v]scale=${outW}:${outH},format=rgba,fade=t=out:st=${fadeStart}:d=0.35:alpha=1[hook]`,
        `${currentVideoStream}[hook]overlay=0:0:enable='between(t,0,${hookEnd})'[vhook]`
      );
    } else {
      vfStages.push(
        `[1:v]scale=${outW}:${outH},format=rgba[hook]`,
        `${currentVideoStream}[hook]overlay=0:0[vhook]`
      );
    }
    currentVideoStream = '[vhook]';
  }

  // Burn in ASS Subtitles (and fallback Hook Headline + Watermark)
  vfStages.push(
    `${currentVideoStream}ass=${tempAssFileName}:fontsdir=../uploads/fonts,format=yuv420p[vout]`
  );

  const vfChain = vfStages.join(';');

  // Audio treatment & user volume regulation
  const userVolPct = clip.avTreatment?.volumePct !== undefined ? Number(clip.avTreatment.volumePct) : 100;
  const userGain = Math.max(0, Math.min(2.5, userVolPct / 100));
  const baseGain = clip.avTreatment?.noiseReduction ? 1.25 : 1.15;
  const finalVolume = (userGain * baseGain).toFixed(2);

  const afChain = clip.avTreatment?.noiseReduction
    ? `highpass=f=80,lowpass=f=12000,volume=${finalVolume}`
    : `volume=${finalVolume}`;

  const args = [
    '-y',
    '-ss', String(startTime),
    '-t', String(duration),
    '-i', sourceVideoPath,
    ...(tempHookPngPath && fs.existsSync(tempHookPngPath)
      ? ['-loop', '1', '-t', String(duration), '-i', tempHookPngPath]
      : []),
    '-filter_complex', vfChain,
    '-map', '[vout]',
    '-map', '0:a?',
    '-af', afChain,
    '-r', String(fps),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-c:a', 'aac',
    '-ar', '48000',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outputMp4Path
  ];

  try {
    await runProcess(ffmpegPath, args, 600000, EXPORTS_DIR);
  } finally {
    if (fs.existsSync(tempAssPath)) {
      try { fs.unlinkSync(tempAssPath); } catch {}
    }
    if (tempHookPngPath && fs.existsSync(tempHookPngPath)) {
      try { fs.unlinkSync(tempHookPngPath); } catch {}
    }
  }

  const validation = await probeVideo(outputMp4Path);

  return {
    exportId,
    mp4Url: `/exports/${exportId}.mp4`,
    srtUrl: `/exports/${exportId}.srt`,
    fileName: `${exportId}.mp4`,
    validation,
    renderedAt: new Date().toISOString()
  };
}

/**
 * Physically cuts a sub-segment [trimStartSec, trimEndSec] from a larger source video file
 * into a standalone MP4 file inside VIDEOS_DIR so it can be edited as a clean single clip (0s -> cutDuration).
 */
export async function trimVideoSegmentWithFFmpeg(sourceVideoPath, trimStartSec = 0, trimEndSec = 30, basePrefix = 'recorte') {
  const safeStart = Math.max(0, Math.round((Number(trimStartSec) || 0) * 100) / 100);
  const safeEnd = Math.max(safeStart + 1.0, Math.round((Number(trimEndSec) || safeStart + 15) * 100) / 100);
  const duration = Math.max(1.0, Math.round((safeEnd - safeStart) * 100) / 100);

  const safePrefix = String(basePrefix || 'recorte')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 32);
  const trimmedFileName = `${safePrefix}_cut_${Date.now()}.mp4`;
  const trimmedFilePath = path.join(VIDEOS_DIR, trimmedFileName);

  const args = [
    '-y',
    '-ss', String(safeStart),
    '-t', String(duration),
    '-i', sourceVideoPath,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-ar', '48000',
    '-b:a', '192k',
    '-movflags', '+faststart',
    trimmedFilePath
  ];

  await runProcess(ffmpegPath, args, 300000);
  const probeInfo = await probeVideo(trimmedFilePath);

  return {
    trimmedFileName,
    trimmedFilePath,
    trimmedUrl: `/uploads/videos/${trimmedFileName}`,
    trimStart: safeStart,
    trimEnd: safeEnd,
    duration: probeInfo.duration || duration,
    probeInfo
  };
}
