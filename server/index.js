import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  loadDb,
  saveDb,
  UPLOADS_DIR,
  VIDEOS_DIR,
  FONTS_DIR,
  EXPORTS_DIR,
  DEFAULT_HOOK_STYLE,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_AV_TREATMENT,
  DEFAULT_CLIP_PRESET
} from './db.js';
import {
  ensureDemoVideo,
  probeVideo,
  extractAudioForSTT,
  detectSpeechIntervals,
  renderClipWithFFmpeg,
  generateSrtForClip,
  trimVideoSegmentWithFFmpeg
} from './mediaEngine.js';
import {
  testGeminiConnection,
  suggestVideoAlterationsWithGemini,
  analyzeVideoAndGenerateClips,
  transcribeSingleClipSubtitlesWithAI,
  computeWeightedViralityScore,
  buildWordsWithTimestamps
} from './geminiService.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/exports', express.static(EXPORTS_DIR));

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const safeName = file.originalname
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${safeName}_${Date.now()}${ext}`);
  }
});
const uploadVideo = multer({ storage: videoStorage });

const fontStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FONTS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.ttf';
    const safeName = file.originalname
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${safeName}_${Date.now()}${ext}`);
  }
});
const uploadFont = multer({ storage: fontStorage });

ensureDemoVideo().catch((err) => console.error('Demo video init error:', err));

// Automatically upgrade any previously uploaded project that had old placeholder subtitles
(async function autoTranscribeLegacyPlaceholderProjects() {
  try {
    const db = loadDb();
    let changed = false;
    for (const proj of db.projects || []) {
      if (proj.id === 'proj-demo-001') continue;
      const vPath = path.join(VIDEOS_DIR, proj.videoFileName || '');
      for (const clip of proj.clips || []) {
        const hasPlaceholder = (clip.subtitles || []).some(
          (s) =>
            (s.text || '').includes('Segmento de fala #') ||
            (s.text || '').includes('Fala detectada no áudio') ||
            (s.text || '').includes('Início do trecho (')
        );
        if (hasPlaceholder && fs.existsSync(vPath)) {
          console.log(`[Auto-Upgrade STT] Transcrevendo áudio real para o projeto "${proj.title}"...`);
          const stt = await transcribeSingleClipSubtitlesWithAI({
            clipTitle: clip.title,
            videoFilePath: vPath,
            startTime: clip.startTime,
            endTime: clip.endTime,
            apiKey: db.settings?.geminiApiKey,
            model: db.settings?.geminiModel
          });
          clip.subtitles = stt.subtitles;
          clip.captionStyle = { ...clip.captionStyle, showSpeakerBadge: false };
          changed = true;
        }
      }
    }
    if (changed) saveDb(db);
  } catch (err) {
    console.warn('[Auto-Upgrade STT Warning]:', err.message);
  }
})();

app.get('/api/state', (_req, res) => {
  const db = loadDb();
  res.json(db);
});

/**
 * POST /api/presets/default
 * Saves the current manual configuration (layout, camera boxes, subtitle block, fonts, hook style, AV)
 * as the global Default Clip Preset for all future cuts, and optionally adds it to savedPresets.
 */
app.post('/api/presets/default', (req, res) => {
  const db = loadDb();
  const { name, showHookBanner, hookStyle, layout, captionStyle, avTreatment, saveToLibrary = true } = req.body;

  const newPreset = {
    id: `preset-${Date.now()}`,
    name: (name || 'Minha Configuração Padrão').trim(),
    showHookBanner: showHookBanner !== false,
    hookStyle: { ...DEFAULT_HOOK_STYLE, ...(hookStyle || {}) },
    layout: {
      ...DEFAULT_LAYOUT_CONFIG,
      ...(layout || {}),
      cam1Region: { ...DEFAULT_LAYOUT_CONFIG.cam1Region, ...(layout?.cam1Region || {}) },
      cam2Region: { ...DEFAULT_LAYOUT_CONFIG.cam2Region, ...(layout?.cam2Region || {}) },
      pipDest: { ...DEFAULT_LAYOUT_CONFIG.pipDest, ...(layout?.pipDest || {}) }
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      ...(captionStyle || {}),
      showSpeakerBadge: Boolean(captionStyle?.showSpeakerBadge)
    },
    avTreatment: { ...DEFAULT_AV_TREATMENT, ...(avTreatment || {}) },
    updatedAt: new Date().toISOString()
  };

  db.defaultClipPreset = newPreset;

  if (saveToLibrary) {
    const existingIdx = (db.savedPresets || []).findIndex(
      (p) => p.name.toLowerCase() === newPreset.name.toLowerCase()
    );
    if (existingIdx >= 0) {
      db.savedPresets[existingIdx] = newPreset;
    } else {
      db.savedPresets = [newPreset, ...(db.savedPresets || [])];
    }
  }

  saveDb(db);
  res.json({
    success: true,
    defaultClipPreset: db.defaultClipPreset,
    savedPresets: db.savedPresets
  });
});

/**
 * POST /api/presets/apply
 * Applies the Default Clip Preset (or a specific presetId) to a single clip or all clips in a project
 */
app.post('/api/presets/apply', (req, res) => {
  const db = loadDb();
  const { projectId, clipId, presetId, applyToAllProjectClips = false } = req.body;

  const project = db.projects.find((p) => p.id === projectId) || db.projects[0];
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

  const preset =
    (presetId && (db.savedPresets || []).find((p) => p.id === presetId)) ||
    db.defaultClipPreset ||
    DEFAULT_CLIP_PRESET;

  if (presetId) {
    // Also set this chosen preset as the active defaultClipPreset
    db.defaultClipPreset = JSON.parse(JSON.stringify(preset));
  }

  project.clips = (project.clips || []).map((c) => {
    if (!applyToAllProjectClips && c.id !== clipId) return c;
    return {
      ...c,
      showHookBanner: preset.showHookBanner !== false,
      hookStyle: JSON.parse(JSON.stringify(preset.hookStyle || DEFAULT_HOOK_STYLE)),
      layout: JSON.parse(JSON.stringify(preset.layout || DEFAULT_LAYOUT_CONFIG)),
      captionStyle: JSON.parse(JSON.stringify(preset.captionStyle || DEFAULT_CAPTION_STYLE)),
      avTreatment: JSON.parse(JSON.stringify(preset.avTreatment || DEFAULT_AV_TREATMENT))
    };
  });

  saveDb(db);
  res.json({
    success: true,
    project,
    defaultClipPreset: db.defaultClipPreset
  });
});

/**
 * DELETE /api/presets/:presetId
 */
app.delete('/api/presets/:presetId', (req, res) => {
  const db = loadDb();
  db.savedPresets = (db.savedPresets || []).filter((p) => p.id !== req.params.presetId);
  saveDb(db);
  res.json({ success: true, savedPresets: db.savedPresets });
});

app.post('/api/settings/gemini', (req, res) => {
  const db = loadDb();
  const {
    uiTheme,
    geminiApiKey,
    geminiModel,
    geminiTranscriptionModel,
    enableMultimodalAnalysis,
    infrastructureMode,
    retentionDays,
    autoDeleteIntermediates,
    hardwareAcceleration
  } = req.body;

  if (uiTheme) db.settings.uiTheme = uiTheme;
  if (typeof geminiApiKey === 'string') {
    db.settings.geminiApiKey = geminiApiKey.trim();
  }
  if (geminiModel) db.settings.geminiModel = geminiModel;
  if (geminiTranscriptionModel) db.settings.geminiTranscriptionModel = geminiTranscriptionModel;
  if (typeof enableMultimodalAnalysis === 'boolean') {
    db.settings.enableMultimodalAnalysis = enableMultimodalAnalysis;
  }
  if (infrastructureMode) db.settings.infrastructureMode = infrastructureMode;
  if (retentionDays !== undefined) db.settings.retentionDays = Number(retentionDays) || 30;
  if (typeof autoDeleteIntermediates === 'boolean') {
    db.settings.autoDeleteIntermediates = autoDeleteIntermediates;
  }
  if (hardwareAcceleration) db.settings.hardwareAcceleration = hardwareAcceleration;

  saveDb(db);
  res.json({ success: true, settings: db.settings });
});

app.post('/api/gemini/test', async (req, res) => {
  const db = loadDb();
  const apiKey = (req.body.apiKey ?? db.settings.geminiApiKey ?? '').trim();
  let model = req.body.model || db.settings.geminiModel || 'gemini-3.8-flash';
  if (model === 'gemini-2.5-flash' || model === 'gemini-2.0-flash') {
    model = 'gemini-3.8-flash';
  }

  if (!apiKey) {
    return res.status(400).json({
      connected: false,
      error: 'Informe sua chave da API do Google Gemini (AI Studio) para testar a conexão.'
    });
  }

  try {
    const result = await testGeminiConnection(apiKey, model);
    db.settings.geminiApiKey = apiKey;
    db.settings.geminiModel = result.model || model;
    saveDb(db);
    res.json(result);
  } catch (err) {
    res.status(400).json({
      connected: false,
      error: err.message
    });
  }
});

app.post('/api/gemini/suggest-edits', async (req, res) => {
  try {
    const db = loadDb();
    const { projectId, clipId, userPrompt } = req.body;
    const project = db.projects.find((p) => p.id === projectId) || db.projects[0];
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    const clip = project.clips.find((c) => c.id === clipId) || project.clips[0];
    if (!clip) return res.status(404).json({ error: 'Corte não encontrado' });

    const result = await suggestVideoAlterationsWithGemini({
      clip,
      userPrompt,
      availableFonts: db.fonts,
      apiKey: db.settings.geminiApiKey,
      model: db.settings.geminiModel
    });

    clip.geminiSuggestions = result.suggestions;
    saveDb(db);

    res.json({
      success: true,
      ...result,
      clip
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects/upload
 * Uploads a local video file, inspects metadata via FFprobe, transcribes the real spoken audio
 * (via Gemini Multimodal STT or Local OpenAI Whisper STT), and applies the user's Default Clip Preset!
 */
app.post('/api/projects/upload', uploadVideo.single('video'), async (req, res) => {
  try {
    const db = loadDb();
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo de vídeo enviado.' });
    }

    const startedAt = Date.now();
    const projectTitle = req.body.title || file.originalname.replace(/\.[^/.]+$/, '');
    const customTranscript = req.body.transcript || '';

    const probeInfo = await probeVideo(file.path);
    const detectedIntervals = await detectSpeechIntervals(file.path, probeInfo.duration);

    let audioPath = null;
    if (db.settings.geminiApiKey && db.settings.enableMultimodalAnalysis) {
      audioPath = await extractAudioForSTT(file.path, Math.min(240, probeInfo.duration));
    }

    const projectId = `proj-${Date.now()}`;

    const analysis = await analyzeVideoAndGenerateClips({
      projectId,
      projectTitle,
      videoFilePath: file.path,
      duration: probeInfo.duration,
      transcriptText: customTranscript,
      audioFilePath: audioPath,
      detectedIntervals,
      scoringWeights: db.scoringWeights,
      defaultPreset: db.defaultClipPreset || DEFAULT_CLIP_PRESET,
      apiKey: db.settings.geminiApiKey,
      model: db.settings.geminiModel,
      transcriptionModel: req.body.transcriptionModel || db.settings.geminiTranscriptionModel || 'gemini-3.8-flash'
    });

    if (audioPath && db.settings.autoDeleteIntermediates && fs.existsSync(audioPath)) {
      try { fs.unlinkSync(audioPath); } catch {}
    }

    const newProject = {
      id: projectId,
      title: projectTitle,
      sourceType: 'local_upload',
      isSingleClipMode: false,
      sourceUrl: `/uploads/videos/${file.filename}`,
      videoFileName: file.filename,
      createdAt: new Date().toISOString(),
      status: 'completed',
      pipelineStage: `Transcrição & Cortes Concluídos (${analysis.engine})`,
      pipelineProgress: 100,
      metadata: {
        ...probeInfo,
        detectedSpeakers: []
      },
      clips: analysis.clips
    };

    db.projects.unshift(newProject);
    db.metrics.totalVideosProcessed += 1;
    db.metrics.totalClipsGenerated += newProject.clips.length;
    db.metrics.approvedClipsCount += newProject.clips.filter((c) => c.approved).length;
    const elapsedSec = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10;
    db.metrics.avgProcessingTimeSec = Math.round(((db.metrics.avgProcessingTimeSec + elapsedSec) / 2) * 10) / 10;

    saveDb(db);
    res.json({ success: true, project: newProject });
  } catch (err) {
    console.error('[Upload Project Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Helper to create a Single-Clip Project from a video file (either full or trimmed from a larger source video)
 */
async function buildSingleClipProjectFromVideo({
  db,
  activeFilePath,
  activeFileName,
  originalSourceFileName,
  sourceTrimRange = null,
  clipTitle,
  customTranscript = '',
  initialLayoutMode,
  transcriptionModel
}) {
  const preset = db.defaultClipPreset || DEFAULT_CLIP_PRESET;
  const layoutModeToUse = initialLayoutMode || preset.layout?.mode || 'gameplay_split';

  const probeInfo = await probeVideo(activeFilePath);
  const detectedIntervals = await detectSpeechIntervals(activeFilePath, probeInfo.duration);

  let audioPath = null;
  if (db.settings.geminiApiKey) {
    audioPath = await extractAudioForSTT(activeFilePath, Math.min(180, probeInfo.duration));
  }

  const sttResult = await transcribeSingleClipSubtitlesWithAI({
    clipTitle,
    videoFilePath: activeFilePath,
    startTime: 0,
    endTime: probeInfo.duration,
    transcriptText: customTranscript,
    audioFilePath: audioPath,
    detectedIntervals,
    apiKey: db.settings.geminiApiKey,
    model: db.settings.geminiModel,
    transcriptionModel: transcriptionModel || db.settings.geminiTranscriptionModel || 'gemini-3.5-transcribe-dual'
  });

  if (audioPath && db.settings.autoDeleteIntermediates && fs.existsSync(audioPath)) {
    try { fs.unlinkSync(audioPath); } catch {}
  }

  const projectId = `proj-single-${Date.now()}`;
  const singleClipId = `clip-single-${Date.now()}`;

  const singleClip = {
    id: singleClipId,
    projectId,
    rank: 1,
    title: clipTitle,
    hookBannerText: `${clipTitle.slice(0, 26).toUpperCase()} 🔥`,
    showHookBanner: preset.showHookBanner !== false,
    hookStyle: JSON.parse(JSON.stringify(preset.hookStyle || DEFAULT_HOOK_STYLE)),
    startTime: 0,
    endTime: probeInfo.duration,
    duration: probeInfo.duration,
    approved: true,
    manualEditsCount: 1,
    viralityScore: 95,
    criteriaScores: {
      hook: 9.5,
      context: 9.5,
      development: 9.5,
      conclusion: 9.5,
      engagement: 9.5,
      avQuality: 9.5,
      autonomy: 9.5
    },
    justification: sourceTrimRange
      ? `Recorte extraído do vídeo fonte (${sourceTrimRange.start.toFixed(1)}s → ${sourceTrimRange.end.toFixed(1)}s) com transcrição automática (${sttResult.engine}: ${sttResult.subtitles.length} legendas) e Configuração Padrão aplicada.`
      : `Transcrição do áudio realizada automaticamente (${sttResult.engine}: ${sttResult.subtitles.length} legendas sincronizadas) com sua Configuração Padrão aplicada.`,
    semanticCategory: sttResult.engine,
    layout: {
      ...JSON.parse(JSON.stringify(preset.layout || DEFAULT_LAYOUT_CONFIG)),
      mode: layoutModeToUse
    },
    captionStyle: {
      ...JSON.parse(JSON.stringify(preset.captionStyle || DEFAULT_CAPTION_STYLE)),
      showSpeakerBadge: false
    },
    avTreatment: JSON.parse(JSON.stringify(preset.avTreatment || DEFAULT_AV_TREATMENT)),
    socialSuggestion: {
      title: clipTitle,
      caption: `${clipTitle} #cortes #gameplay #clips`,
      hashtags: ['#cortes', '#gameplay', '#clips', '#viral'],
      bestPlatform: 'TikTok, Reels & Shorts'
    },
    subtitles: sttResult.subtitles,
    geminiSuggestions: []
  };

  const newProject = {
    id: projectId,
    title: `[Clipe] ${clipTitle}`,
    sourceType: 'single_clip_manual',
    isSingleClipMode: true,
    sourceUrl: `/uploads/videos/${activeFileName}`,
    videoFileName: activeFileName,
    originalSourceFileName: originalSourceFileName || activeFileName,
    sourceTrimRange,
    createdAt: new Date().toISOString(),
    status: 'completed',
    pipelineStage: sourceTrimRange
      ? `Recorte (${sourceTrimRange.start.toFixed(1)}s-${sourceTrimRange.end.toFixed(1)}s) & Transcrição Concluídos (${sttResult.engine})`
      : `Transcrição Concluída (${sttResult.engine})`,
    pipelineProgress: 100,
    metadata: {
      ...probeInfo,
      detectedSpeakers: []
    },
    clips: [singleClip]
  };

  db.projects.unshift(newProject);
  db.metrics.totalVideosProcessed += 1;
  db.metrics.totalClipsGenerated += 1;
  db.metrics.approvedClipsCount += 1;
  saveDb(db);

  return { newProject, singleClip, engine: sttResult.engine };
}

/**
 * POST /api/projects/upload-single-clip
 * Dedicated endpoint for the Single-Clip Manual Editor Module:
 * Supports optional [trimStart, trimEnd] to physically cut a sub-clip from a larger source video first,
 * then automatically transcribes the spoken audio into synchronized subtitles and applies the Default Clip Preset!
 */
app.post('/api/projects/upload-single-clip', uploadVideo.single('video'), async (req, res) => {
  try {
    const db = loadDb();
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Selecione um arquivo de vídeo/clipe para editar.' });
    }

    const baseTitle = req.body.title || file.originalname.replace(/\.[^/.]+$/, '');
    const customTranscript = req.body.transcript || '';
    const hasTrimParams = req.body.trimStart !== undefined && req.body.trimEnd !== undefined;

    let activeFilePath = file.path;
    let activeFileName = file.filename;
    let sourceTrimRange = null;
    let clipTitle = baseTitle;

    const sourceProbe = await probeVideo(file.path);

    if (hasTrimParams) {
      const reqStart = Math.max(0, Number(req.body.trimStart) || 0);
      const reqEnd = Math.min(
        sourceProbe.duration || 36000,
        Math.max(reqStart + 1.0, Number(req.body.trimEnd) || sourceProbe.duration || reqStart + 30)
      );
      const isPartialCut = reqStart > 0.25 || (sourceProbe.duration && reqEnd < sourceProbe.duration - 0.35);

      if (isPartialCut) {
        const trimResult = await trimVideoSegmentWithFFmpeg(file.path, reqStart, reqEnd, baseTitle);
        activeFilePath = trimResult.trimmedFilePath;
        activeFileName = trimResult.trimmedFileName;
        sourceTrimRange = { start: trimResult.trimStart, end: trimResult.trimEnd, sourceDuration: sourceProbe.duration };
        if (!req.body.title) {
          clipTitle = `${baseTitle} (${reqStart.toFixed(1)}s-${reqEnd.toFixed(1)}s)`;
        }
      }
    }

    const { newProject, singleClip, engine } = await buildSingleClipProjectFromVideo({
      db,
      activeFilePath,
      activeFileName,
      originalSourceFileName: file.filename,
      sourceTrimRange,
      clipTitle,
      customTranscript,
      initialLayoutMode: req.body.layoutMode,
      transcriptionModel: req.body.transcriptionModel
    });

    res.json({
      success: true,
      project: newProject,
      clip: singleClip,
      engine,
      uploadedSourceFileName: file.filename,
      uploadedSourceUrl: `/uploads/videos/${file.filename}`,
      uploadedSourceDuration: sourceProbe.duration
    });
  } catch (err) {
    console.error('[Single Clip Upload Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects/cut-from-source
 * Cuts a new single clip [trimStart, trimEnd] from an already-uploaded source video file on the server
 * and loads it directly into the Single-Clip Editor with automatic audio transcription and Default Preset.
 */
app.post('/api/projects/cut-from-source', async (req, res) => {
  try {
    const db = loadDb();
    const {
      sourceFileName,
      trimStart = 0,
      trimEnd = 30,
      title = '',
      transcript = '',
      layoutMode,
      transcriptionModel
    } = req.body;

    if (!sourceFileName) {
      return res.status(400).json({ error: 'Arquivo de vídeo fonte não informado.' });
    }
    const sourceVideoPath = path.join(VIDEOS_DIR, path.basename(sourceFileName));
    if (!fs.existsSync(sourceVideoPath)) {
      return res.status(404).json({ error: 'Arquivo de vídeo fonte não encontrado no servidor.' });
    }

    const sourceProbe = await probeVideo(sourceVideoPath);
    const reqStart = Math.max(0, Number(trimStart) || 0);
    const reqEnd = Math.min(
      sourceProbe.duration || 36000,
      Math.max(reqStart + 1.0, Number(trimEnd) || reqStart + 30)
    );

    const baseTitle =
      (title || '').trim() ||
      path.basename(sourceFileName, path.extname(sourceFileName)).replace(/_[0-9]+$/, '');

    const trimResult = await trimVideoSegmentWithFFmpeg(sourceVideoPath, reqStart, reqEnd, baseTitle);
    const clipTitle = (title || '').trim() || `${baseTitle} (${reqStart.toFixed(1)}s-${reqEnd.toFixed(1)}s)`;

    const { newProject, singleClip, engine } = await buildSingleClipProjectFromVideo({
      db,
      activeFilePath: trimResult.trimmedFilePath,
      activeFileName: trimResult.trimmedFileName,
      originalSourceFileName: path.basename(sourceFileName),
      sourceTrimRange: { start: trimResult.trimStart, end: trimResult.trimEnd, sourceDuration: sourceProbe.duration },
      clipTitle,
      customTranscript: transcript,
      initialLayoutMode: layoutMode,
      transcriptionModel
    });

    res.json({
      success: true,
      project: newProject,
      clip: singleClip,
      engine,
      uploadedSourceFileName: path.basename(sourceFileName),
      uploadedSourceUrl: `/uploads/videos/${path.basename(sourceFileName)}`,
      uploadedSourceDuration: sourceProbe.duration
    });
  } catch (err) {
    console.error('[Cut From Source Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/clips/generate-subtitles-ai
 * Re-transcribes the real audio of the active clip using Gemini Audio Transcription Pipeline or Whisper Local STT
 */
app.post('/api/clips/generate-subtitles-ai', async (req, res) => {
  try {
    const db = loadDb();
    const {
      projectId,
      clipId,
      transcriptText = '',
      transcriptionModel = 'gemini-3.8-flash',
      language = 'pt-BR',
      maxWordsPerSegment = 6
    } = req.body;
    const project = db.projects.find((p) => p.id === projectId) || db.projects[0];
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    const clip = project.clips.find((c) => c.id === clipId) || project.clips[0];
    if (!clip) return res.status(404).json({ error: 'Clipe não encontrado' });

    const videoPath = path.join(VIDEOS_DIR, project.videoFileName || 'demo_podcast.mp4');
    const detectedIntervals = fs.existsSync(videoPath)
      ? await detectSpeechIntervals(videoPath, clip.endTime)
      : [];

    if (transcriptionModel) {
      db.settings.geminiTranscriptionModel = transcriptionModel;
    }

    const sttResult = await transcribeSingleClipSubtitlesWithAI({
      clipTitle: clip.title,
      videoFilePath: videoPath,
      startTime: clip.startTime,
      endTime: clip.endTime,
      transcriptText,
      audioFilePath: null,
      detectedIntervals: detectedIntervals.filter((iv) => iv.end > clip.startTime && iv.start < clip.endTime),
      apiKey: db.settings.geminiApiKey,
      model: db.settings.geminiModel,
      transcriptionModel,
      language,
      maxWordsPerSegment: Number(maxWordsPerSegment) || 6
    });

    clip.subtitles = sttResult.subtitles;
    clip.captionStyle = { ...clip.captionStyle, showSpeakerBadge: false };
    saveDb(db);
    res.json({ success: true, engine: sttResult.engine, subtitles: clip.subtitles, clip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/import-url', async (req, res) => {
  try {
    const db = loadDb();
    const { url, title, transcript, duration = 60 } = req.body;
    const startedAt = Date.now();

    const demoPath = await ensureDemoVideo();
    const probeInfo = demoPath
      ? await probeVideo(demoPath)
      : {
          duration: Number(duration) || 60,
          width: 1280,
          height: 720,
          fps: 30,
          videoCodec: 'h264',
          audioCodec: 'aac',
          sampleRate: 48000,
          bitrateKbps: 2450,
          aspectRatio: '16:9'
        };

    const projectId = `proj-${Date.now()}`;
    const projectTitle = title || (url ? `Importação Social: ${url}` : `Estúdio Podcast #${db.projects.length + 1}`);
    const detectedIntervals = demoPath ? await detectSpeechIntervals(demoPath, probeInfo.duration) : [];

    const analysis = await analyzeVideoAndGenerateClips({
      projectId,
      projectTitle,
      videoFilePath: demoPath,
      duration: probeInfo.duration,
      transcriptText: transcript || '',
      audioFilePath: null,
      detectedIntervals,
      scoringWeights: db.scoringWeights,
      defaultPreset: db.defaultClipPreset || DEFAULT_CLIP_PRESET,
      apiKey: db.settings.geminiApiKey,
      model: db.settings.geminiModel
    });

    const newProject = {
      id: projectId,
      title: projectTitle,
      sourceType: url ? 'social_url' : 'studio_generator',
      externalSourceUrl: url || '',
      sourceUrl: '/uploads/videos/demo_podcast.mp4',
      videoFileName: 'demo_podcast.mp4',
      createdAt: new Date().toISOString(),
      status: 'completed',
      pipelineStage: `Curadoria Concluída (${analysis.engine})`,
      pipelineProgress: 100,
      metadata: {
        ...probeInfo,
        detectedSpeakers: []
      },
      clips: analysis.clips
    };

    db.projects.unshift(newProject);
    db.metrics.totalVideosProcessed += 1;
    db.metrics.totalClipsGenerated += newProject.clips.length;
    db.metrics.approvedClipsCount += newProject.clips.filter((c) => c.approved).length;
    const elapsedSec = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10;
    db.metrics.avgProcessingTimeSec = Math.round(((db.metrics.avgProcessingTimeSec + elapsedSec) / 2) * 10) / 10;

    saveDb(db);
    res.json({ success: true, project: newProject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:projectId/clips/:clipId', (req, res) => {
  const db = loadDb();
  const { projectId, clipId } = req.params;
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

  const clipIndex = project.clips.findIndex((c) => c.id === clipId);
  if (clipIndex === -1) return res.status(404).json({ error: 'Corte não encontrado' });

  const existing = project.clips[clipIndex];
  const updates = req.body;
  const wasApproved = existing.approved;

  const updatedLayout = updates.layout
    ? {
        ...existing.layout,
        ...updates.layout,
        cam1Region: updates.layout.cam1Region
          ? { ...(existing.layout?.cam1Region || {}), ...updates.layout.cam1Region }
          : existing.layout?.cam1Region,
        cam2Region: updates.layout.cam2Region
          ? { ...(existing.layout?.cam2Region || {}), ...updates.layout.cam2Region }
          : existing.layout?.cam2Region,
        pipDest: updates.layout.pipDest
          ? { ...(existing.layout?.pipDest || {}), ...updates.layout.pipDest }
          : existing.layout?.pipDest
      }
    : existing.layout;

  const updatedClip = {
    ...existing,
    ...updates,
    hookStyle: updates.hookStyle ? { ...(existing.hookStyle || DEFAULT_HOOK_STYLE), ...updates.hookStyle } : (existing.hookStyle || DEFAULT_HOOK_STYLE),
    layout: updatedLayout,
    captionStyle: updates.captionStyle ? { ...existing.captionStyle, ...updates.captionStyle } : existing.captionStyle,
    avTreatment: updates.avTreatment ? { ...existing.avTreatment, ...updates.avTreatment } : existing.avTreatment,
    socialSuggestion: updates.socialSuggestion ? { ...existing.socialSuggestion, ...updates.socialSuggestion } : existing.socialSuggestion,
    criteriaScores: updates.criteriaScores ? { ...existing.criteriaScores, ...updates.criteriaScores } : existing.criteriaScores
  };

  updatedClip.duration = Math.max(1, Math.round(((Number(updatedClip.endTime) || 20) - (Number(updatedClip.startTime) || 0)) * 10) / 10);

  if (updates.criteriaScores) {
    updatedClip.viralityScore = computeWeightedViralityScore(updatedClip.criteriaScores, db.scoringWeights);
  }

  if (!updates._skipTelemetry) {
    updatedClip.manualEditsCount = (Number(existing.manualEditsCount) || 0) + 1;
    db.metrics.manualCorrectionsTotal = (Number(db.metrics.manualCorrectionsTotal) || 0) + 1;
  }

  if (typeof updates.approved === 'boolean' && updates.approved !== wasApproved) {
    db.metrics.approvedClipsCount = Math.max(
      0,
      (Number(db.metrics.approvedClipsCount) || 0) + (updates.approved ? 1 : -1)
    );
  }

  project.clips[clipIndex] = updatedClip;
  saveDb(db);
  res.json({ success: true, clip: updatedClip, metrics: db.metrics });
});

app.post('/api/projects/:projectId/clips', async (req, res) => {
  const db = loadDb();
  const { projectId } = req.params;
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

  const { title, startTime = 0, endTime = 15 } = req.body;
  const start = Math.max(0, Number(startTime) || 0);
  const end = Math.min(project.metadata?.duration || 60, Math.max(start + 2, Number(endTime) || start + 15));
  const preset = db.defaultClipPreset || DEFAULT_CLIP_PRESET;

  const videoPath = path.join(VIDEOS_DIR, project.videoFileName || 'demo_podcast.mp4');
  const sttResult = await transcribeSingleClipSubtitlesWithAI({
    clipTitle: title || 'Corte Manual',
    videoFilePath: fs.existsSync(videoPath) ? videoPath : null,
    startTime: start,
    endTime: end,
    apiKey: db.settings.geminiApiKey,
    model: db.settings.geminiModel
  });

  const criteriaScores = {
    hook: 8.8,
    context: 9.0,
    development: 8.7,
    conclusion: 8.8,
    engagement: 8.9,
    avQuality: 9.4,
    autonomy: 9.1
  };

  const newClip = {
    id: `clip-manual-${Date.now()}`,
    projectId,
    rank: project.clips.length + 1,
    title: title || `Corte #${project.clips.length + 1}`,
    hookBannerText: `${(title || 'DESTAQUE').slice(0, 26).toUpperCase()} ✨`,
    showHookBanner: preset.showHookBanner !== false,
    hookStyle: JSON.parse(JSON.stringify(preset.hookStyle || DEFAULT_HOOK_STYLE)),
    startTime: start,
    endTime: end,
    duration: Math.round((end - start) * 10) / 10,
    approved: true,
    manualEditsCount: 1,
    viralityScore: computeWeightedViralityScore(criteriaScores, db.scoringWeights),
    criteriaScores,
    justification: `Corte manual criado com sua Configuração Padrão e transcrição (${sttResult.engine}).`,
    semanticCategory: 'Corte Manual',
    layout: JSON.parse(JSON.stringify(preset.layout || DEFAULT_LAYOUT_CONFIG)),
    captionStyle: {
      ...JSON.parse(JSON.stringify(preset.captionStyle || DEFAULT_CAPTION_STYLE)),
      showSpeakerBadge: false
    },
    avTreatment: JSON.parse(JSON.stringify(preset.avTreatment || DEFAULT_AV_TREATMENT)),
    socialSuggestion: {
      title: title || 'Novo corte em destaque!',
      caption: title || '',
      hashtags: ['#cortes', '#gameplay', '#clips'],
      bestPlatform: 'TikTok, Reels & Shorts'
    },
    subtitles: sttResult.subtitles,
    geminiSuggestions: []
  };

  project.clips.push(newClip);
  db.metrics.totalClipsGenerated += 1;
  db.metrics.approvedClipsCount += 1;
  saveDb(db);

  res.json({ success: true, clip: newClip });
});

app.post('/api/scoring-weights', (req, res) => {
  const db = loadDb();
  db.scoringWeights = {
    ...db.scoringWeights,
    ...req.body
  };

  db.projects.forEach((proj) => {
    proj.clips.forEach((clip) => {
      if (clip.criteriaScores) {
        clip.viralityScore = computeWeightedViralityScore(clip.criteriaScores, db.scoringWeights);
      }
    });
    proj.clips.sort((a, b) => b.viralityScore - a.viralityScore);
    proj.clips.forEach((c, idx) => { c.rank = idx + 1; });
  });

  saveDb(db);
  res.json({ success: true, scoringWeights: db.scoringWeights, projects: db.projects });
});

app.post('/api/fonts/google', (req, res) => {
  const db = loadDb();
  const { family, category = 'Custom Google Font', weight = '700', cssUrl } = req.body;
  if (!family || !family.trim()) {
    return res.status(400).json({ error: 'Informe o nome da família da fonte.' });
  }

  const cleanFamily = family.trim();
  const formattedQuery = cleanFamily.replace(/\s+/g, '+');
  const finalCssUrl = cssUrl || `https://fonts.googleapis.com/css2?family=${formattedQuery}:wght@400;700;900&display=swap`;

  const newFont = {
    id: `font-custom-${Date.now()}`,
    name: `${cleanFamily} (${weight})`,
    family: cleanFamily,
    weight: String(weight),
    category,
    isPrimary: false,
    source: 'google',
    previewText: 'FONTE ADICIONADA',
    cssUrl: finalCssUrl
  };

  db.fonts.push(newFont);
  saveDb(db);
  res.json({ success: true, font: newFont, fonts: db.fonts });
});

app.post('/api/fonts/upload', uploadFont.single('fontFile'), (req, res) => {
  const db = loadDb();
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Nenhum arquivo de fonte enviado.' });
  }

  const rawName = (req.body.name || file.originalname.replace(/\.[^/.]+$/, '')).trim();
  const cleanFamily = rawName.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || `CustomFont${Date.now()}`;

  const newFont = {
    id: `font-local-${Date.now()}`,
    name: `${cleanFamily} (Local)`,
    family: cleanFamily,
    weight: '700',
    category: req.body.category || 'Fonte Local (.TTF/.OTF)',
    isPrimary: false,
    source: 'file',
    fileUrl: `/uploads/fonts/${file.filename}`,
    previewText: 'TIPOGRAFIA PRÓPRIA'
  };

  db.fonts.push(newFont);
  saveDb(db);
  res.json({ success: true, font: newFont, fonts: db.fonts });
});

app.delete('/api/fonts/:fontId', (req, res) => {
  const db = loadDb();
  const font = db.fonts.find((f) => f.id === req.params.fontId);
  if (!font) return res.status(404).json({ error: 'Fonte não encontrada.' });
  if (font.isPrimary) {
    return res.status(400).json({ error: 'As 12 fontes primárias do sistema não podem ser removidas.' });
  }

  db.fonts = db.fonts.filter((f) => f.id !== req.params.fontId);
  saveDb(db);
  res.json({ success: true, fonts: db.fonts });
});

app.post('/api/render', async (req, res) => {
  try {
    const db = loadDb();
    const { projectId, clipId, exportOptions = {} } = req.body;
    const project = db.projects.find((p) => p.id === projectId) || db.projects[0];
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    const clip = project.clips.find((c) => c.id === clipId) || project.clips[0];
    if (!clip) return res.status(404).json({ error: 'Corte não encontrado' });

    const renderResult = await renderClipWithFFmpeg(project, clip, exportOptions);

    const exportRecord = {
      id: renderResult.exportId,
      projectId: project.id,
      clipId: clip.id,
      clipTitle: clip.title,
      aspectRatio: exportOptions.aspectRatio || clip.layout?.aspectRatio || '9:16',
      layoutMode: clip.layout?.mode || 'auto_speaker',
      mp4Url: renderResult.mp4Url,
      srtUrl: renderResult.srtUrl,
      validation: renderResult.validation,
      createdAt: renderResult.renderedAt
    };

    db.exports.unshift(exportRecord);
    saveDb(db);

    res.json({
      success: true,
      exportRecord
    });
  } catch (err) {
    console.error('[Render Error]:', err);
    const db = loadDb();
    db.metrics.failedJobsCount = (Number(db.metrics.failedJobsCount) || 0) + 1;
    saveDb(db);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/clips/:projectId/:clipId/srt', (req, res) => {
  const db = loadDb();
  const project = db.projects.find((p) => p.id === req.params.projectId);
  const clip = project?.clips.find((c) => c.id === req.params.clipId);
  if (!clip) return res.status(404).send('Corte não encontrado');

  const srt = generateSrtForClip(clip);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${clip.id}.srt"`);
  res.send(srt);
});

app.post('/api/social/accounts/:accountId', (req, res) => {
  const db = loadDb();
  const acc = db.socialAccounts.find((a) => a.id === req.params.accountId);
  if (!acc) return res.status(404).json({ error: 'Rede social não encontrada' });

  const { connected, handle, defaultHashtags, webhookUrl, accessToken, autoPublish } = req.body;
  if (typeof connected === 'boolean') {
    acc.connected = connected;
    acc.status = connected ? 'Ativo (Conectado Local/API)' : 'Desconectado';
    acc.lastSync = connected ? new Date().toISOString() : null;
  }
  if (handle !== undefined) acc.handle = handle;
  if (Array.isArray(defaultHashtags)) acc.defaultHashtags = defaultHashtags;
  if (webhookUrl !== undefined) acc.webhookUrl = webhookUrl;
  if (typeof autoPublish === 'boolean') acc.autoPublish = autoPublish;
  if (accessToken) {
    acc.accessTokenMasked = `${accessToken.slice(0, 6)}...${accessToken.slice(-4)}`;
  }

  saveDb(db);
  res.json({ success: true, account: acc, socialAccounts: db.socialAccounts });
});

app.post('/api/social/publish', async (req, res) => {
  const db = loadDb();
  const { clipId, clipTitle, platforms = [], caption, hashtags = [], scheduledAt, publishNow = true } = req.body;

  if (!Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: 'Selecione ao menos uma rede social para publicação.' });
  }

  const createdPosts = [];
  for (const platformName of platforms) {
    const acc = db.socialAccounts.find((a) => a.platform === platformName) || { handle: '@clipacortes', webhookUrl: '' };
    let webhookStatus = null;

    if (acc.webhookUrl && acc.webhookUrl.startsWith('http')) {
      try {
        const whRes = await fetch(acc.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'ClipaCortes Studio',
            platform: platformName,
            handle: acc.handle,
            clipId,
            clipTitle,
            caption,
            hashtags,
            timestamp: new Date().toISOString()
          })
        });
        webhookStatus = `Webhook HTTP ${whRes.status}`;
      } catch (err) {
        webhookStatus = `Webhook erro: ${err.message}`;
      }
    }

    const post = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      clipId,
      clipTitle: clipTitle || 'Corte Viral ClipaCortes',
      platform: platformName,
      handle: acc.handle || '@clipacortes',
      scheduledAt: publishNow ? new Date().toISOString() : (scheduledAt || new Date().toISOString()),
      status: publishNow
        ? `Publicado via API${webhookStatus ? ` (${webhookStatus})` : ''}`
        : 'Agendado na Fila',
      caption: `${caption || ''} ${(hashtags || []).join(' ')}`.trim()
    };

    db.scheduledPosts.unshift(post);
    createdPosts.push(post);
  }

  saveDb(db);
  res.json({ success: true, createdPosts, scheduledPosts: db.scheduledPosts });
});

const DIST_DIR = path.resolve(UPLOADS_DIR, '..', '..', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/exports')) {
      return next();
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.redirect('http://localhost:5173');
  });
}

app.listen(PORT, () => {
  console.log(`\n==================================================================`);
  console.log(`🚀 ClipaCortes Backend Server rodando localmente em http://localhost:${PORT}`);
  console.log(`🎬 Motor FFmpeg Static + FFprobe + Whisper Local STT + Gemini ativos!`);
  console.log(`==================================================================\n`);
});
