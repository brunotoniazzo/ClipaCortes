import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
export const FONTS_DIR = path.join(UPLOADS_DIR, 'fonts');
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
export const DB_FILE = path.join(DATA_DIR, 'db.json');

[DATA_DIR, UPLOADS_DIR, VIDEOS_DIR, FONTS_DIR, EXPORTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export const PRIMARY_FONTS = [
  {
    id: 'font-montserrat',
    name: 'Montserrat Black',
    family: 'Montserrat',
    weight: '900',
    category: 'Viral / Hormozi',
    isPrimary: true,
    source: 'google',
    previewText: 'IMPACTO MÁXIMO',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,700;0,800;0,900;1,900&display=swap'
  },
  {
    id: 'font-anton',
    name: 'Anton Impact',
    family: 'Anton',
    weight: '400',
    category: 'Manchete / Shorts',
    isPrimary: true,
    source: 'google',
    previewText: 'GANCHO FORTE',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Anton&display=swap'
  },
  {
    id: 'font-bebas',
    name: 'Bebas Neue Bold',
    family: 'Bebas Neue',
    weight: '400',
    category: 'Cinema / Reels',
    isPrimary: true,
    source: 'google',
    previewText: 'ALTA RETENÇÃO',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap'
  },
  {
    id: 'font-poppins',
    name: 'Poppins ExtraBold',
    family: 'Poppins',
    weight: '800',
    category: 'Moderno / Podcast',
    isPrimary: true,
    source: 'google',
    previewText: 'CLAREZA TOTAL',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,700;0,800;0,900;1,800&display=swap'
  },
  {
    id: 'font-oswald',
    name: 'Oswald Heavy',
    family: 'Oswald',
    weight: '700',
    category: 'Editorial / Dinâmico',
    isPrimary: true,
    source: 'google',
    previewText: 'CORTES DINÂMICOS',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&display=swap'
  },
  {
    id: 'font-rubik',
    name: 'Rubik Black',
    family: 'Rubik',
    weight: '900',
    category: 'Arredondado / Creator',
    isPrimary: true,
    source: 'google',
    previewText: 'ESTILO CREATOR',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,700;0,800;0,900;1,800&display=swap'
  },
  {
    id: 'font-inter',
    name: 'Inter Black',
    family: 'Inter',
    weight: '900',
    category: 'Clean / Tech',
    isPrimary: true,
    source: 'google',
    previewText: 'PRECISÃO VISUAL',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&display=swap'
  },
  {
    id: 'font-permanent-marker',
    name: 'Permanent Marker',
    family: 'Permanent Marker',
    weight: '400',
    category: 'Manuscrito / Vlog',
    isPrimary: true,
    source: 'google',
    previewText: 'AUTÊNTICO & REAL',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap'
  },
  {
    id: 'font-bangers',
    name: 'Bangers Comic',
    family: 'Bangers',
    weight: '400',
    category: 'Gaming / Energia',
    isPrimary: true,
    source: 'google',
    previewText: 'EXPLOSÃO VIRAL!',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Bangers&display=swap'
  },
  {
    id: 'font-playfair',
    name: 'Playfair Display Black',
    family: 'Playfair Display',
    weight: '900',
    category: 'Storytelling / Luxo',
    isPrimary: true,
    source: 'google',
    previewText: 'Narrativa Premium',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap'
  },
  {
    id: 'font-space-grotesk',
    name: 'Space Grotesk Bold',
    family: 'Space Grotesk',
    weight: '700',
    category: 'Futurista / IA',
    isPrimary: true,
    source: 'google',
    previewText: 'INTELIGÊNCIA IA',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&display=swap'
  },
  {
    id: 'font-archivo-black',
    name: 'Archivo Black',
    family: 'Archivo Black',
    weight: '400',
    category: 'Headline / TikTok',
    isPrimary: true,
    source: 'google',
    previewText: 'DESTAQUE ABSOLUTO',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap'
  }
];

export const DEFAULT_SCORING_WEIGHTS = {
  hook: 20,
  context: 15,
  development: 15,
  conclusion: 15,
  engagement: 15,
  avQuality: 10,
  autonomy: 10
};

export const DEFAULT_HOOK_STYLE = {
  fontId: 'font-montserrat',
  fontFamily: 'Montserrat',
  fontSize: 24,
  textColor: '#FFFFFF',
  bgColor1: '#0891B2',
  bgColor2: '#1D4ED8',
  bgOpacity: 0.95,
  borderColor: '#38BDF8',
  borderWidth: 2,
  borderRadius: 14,
  positionX: 50,
  positionY: 8,
  maxWidthPct: 88,
  uppercase: true,
  durationSec: 4 // 0 = Vídeo Inteiro (Fixo); > 0 = Desaparece após X segundos do início do corte
};

export const DEFAULT_LAYOUT_CONFIG = {
  aspectRatio: '9:16',
  mode: 'gameplay_split', // gameplay_split | manual_crop | auto_speaker | split_vertical | cinema_blur | gameplay_broll | pip
  activeSpeakerFocus: 'auto',
  smoothingFactor: 0.85,
  zoomLevel: 1.0,
  manualPanX: 50,
  manualPanY: 50,
  splitRatio: 38,
  invertSplit: false,
  boxFitMode: 'cover', // 'cover' (Preencher HD sem distorcer) | 'contain' (Mostrar caixa inteira sem cortar)
  cam1Region: { x: 2, y: 6, w: 28, h: 38 }, // Webcam region in 16:9 source (%)
  cam2Region: { x: 18, y: 0, w: 68, h: 100 }, // Gameplay / Content region in 16:9 source (%)
  pipDest: { x: 60, y: 12, w: 34, h: 28 },
  safeZoneAvoidFace: true,
  brollPreset: 'tech_matrix'
};

export const DEFAULT_CAPTION_STYLE = {
  fontId: 'font-montserrat',
  fontFamily: 'Montserrat',
  fontSize: 42,
  animation: 'hormozi_karaoke',
  textColor: '#FFFFFF',
  highlightColor: '#FACC15',
  secondaryColor: '#22C55E',
  strokeColor: '#000000',
  strokeWidth: 2,
  shadowBlur: 3,
  backgroundBox: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0.65,
  positionX: 50,
  positionY: 74,
  boxWidthPct: 86,
  boxHeightPct: 18,
  autoFitMargin: true,
  wordsPerLine: 3,
  uppercase: true,
  showSpeakerBadge: false, // Disabled by default so "Participante 1" is never added unless requested
  autoEmojis: false
};

export const DEFAULT_AV_TREATMENT = {
  brightness: 1.02,
  contrast: 1.08,
  saturation: 1.10,
  filterPreset: 'viral_punch',
  noiseReduction: true,
  volumePct: 100,
  volumeNormalizationLufs: -14,
  voiceBoost: true,
  showProgressBar: true,
  progressBarColor: '#06B6D4',
  watermarkText: '@ClipaCortesAI'
};

export const DEFAULT_CLIP_PRESET = {
  id: 'preset-default-gameplay',
  name: 'Padrão Gameplay Split 9:16 (Webcam Topo + Jogo Base)',
  showHookBanner: true,
  hookStyle: { ...DEFAULT_HOOK_STYLE },
  layout: { ...DEFAULT_LAYOUT_CONFIG },
  captionStyle: { ...DEFAULT_CAPTION_STYLE },
  avTreatment: { ...DEFAULT_AV_TREATMENT }
};

export const INITIAL_SAVED_PRESETS = [
  DEFAULT_CLIP_PRESET,
  {
    id: 'preset-podcast-split',
    name: 'Podcast Entrevista Split 50/50 (2 Câmeras)',
    showHookBanner: true,
    hookStyle: { ...DEFAULT_HOOK_STYLE, bgColor1: '#DC2626', bgColor2: '#7C3AED', borderColor: '#FACC15' },
    layout: {
      ...DEFAULT_LAYOUT_CONFIG,
      mode: 'split_vertical',
      splitRatio: 50,
      cam1Region: { x: 4, y: 8, w: 42, h: 84 },
      cam2Region: { x: 54, y: 8, w: 42, h: 84 }
    },
    captionStyle: { ...DEFAULT_CAPTION_STYLE, positionY: 50, backgroundBox: true },
    avTreatment: { ...DEFAULT_AV_TREATMENT }
  },
  {
    id: 'preset-vertical-full',
    name: 'Vertical Fullscreen 9:16 (Enquadramento Central)',
    showHookBanner: true,
    hookStyle: { ...DEFAULT_HOOK_STYLE },
    layout: {
      ...DEFAULT_LAYOUT_CONFIG,
      mode: 'manual_crop',
      manualPanX: 50,
      manualPanY: 50,
      zoomLevel: 1.0
    },
    captionStyle: { ...DEFAULT_CAPTION_STYLE, positionY: 76 },
    avTreatment: { ...DEFAULT_AV_TREATMENT }
  },
  {
    id: 'preset-cinema-blur',
    name: 'Cinema Blur 16:9 Centralizado',
    showHookBanner: true,
    hookStyle: { ...DEFAULT_HOOK_STYLE },
    layout: {
      ...DEFAULT_LAYOUT_CONFIG,
      mode: 'cinema_blur',
      zoomLevel: 1.0
    },
    captionStyle: { ...DEFAULT_CAPTION_STYLE, positionY: 78 },
    avTreatment: { ...DEFAULT_AV_TREATMENT }
  }
];

export const DEFAULT_SOCIAL_ACCOUNTS = [
  {
    id: 'social-tiktok',
    platform: 'TikTok',
    icon: 'tiktok',
    handle: '@clipacortes.oficial',
    connected: true,
    status: 'Ativo (OAuth 2.0 / Content Posting API)',
    autoPublish: false,
    defaultHashtags: ['#cortes', '#podcast', '#tiktokbrasil', '#viral', '#fyp'],
    maxDurationSec: 180,
    recommendedRatio: '9:16',
    webhookUrl: '',
    accessTokenMasked: 'act.tk_live_98a7bc...f412',
    lastSync: new Date().toISOString()
  },
  {
    id: 'social-reels',
    platform: 'Instagram Reels',
    icon: 'instagram',
    handle: '@clipacortes.studio',
    connected: true,
    status: 'Ativo (Meta Graph API v20.0)',
    autoPublish: false,
    defaultHashtags: ['#reelsbrasil', '#cortesdepodcast', '#empreendedorismo', '#ia'],
    maxDurationSec: 90,
    recommendedRatio: '9:16',
    webhookUrl: '',
    accessTokenMasked: 'EAAGm0PX4ZCps...921x',
    lastSync: new Date().toISOString()
  },
  {
    id: 'social-shorts',
    platform: 'YouTube Shorts',
    icon: 'youtube',
    handle: 'youtube.com/@ClipaCortesTV',
    connected: true,
    status: 'Ativo (YouTube Data API v3)',
    autoPublish: false,
    defaultHashtags: ['#Shorts', '#Cortes', '#PodcastBrasil', '#Tecnologia'],
    maxDurationSec: 60,
    recommendedRatio: '9:16',
    webhookUrl: '',
    accessTokenMasked: 'ya29.a0AXooCgv...881z',
    lastSync: new Date().toISOString()
  },
  {
    id: 'social-kwai',
    platform: 'Kwai',
    icon: 'video',
    handle: '@clipacortes_kwai',
    connected: false,
    status: 'Desconectado',
    autoPublish: false,
    defaultHashtags: ['#kwai', '#cortes', '#noticias'],
    maxDurationSec: 180,
    recommendedRatio: '9:16',
    webhookUrl: '',
    accessTokenMasked: '',
    lastSync: null
  },
  {
    id: 'social-linkedin',
    platform: 'LinkedIn Video',
    icon: 'linkedin',
    handle: 'in/clipacortes-ai',
    connected: false,
    status: 'Desconectado',
    autoPublish: false,
    defaultHashtags: ['#Inovacao', '#InteligenciaArtificial', '#Lideranca', '#Produtividade'],
    maxDurationSec: 300,
    recommendedRatio: '4:5',
    webhookUrl: '',
    accessTokenMasked: '',
    lastSync: null
  },
  {
    id: 'social-x',
    platform: 'X (Twitter)',
    icon: 'twitter',
    handle: '@clipacortes_x',
    connected: false,
    status: 'Desconectado',
    autoPublish: false,
    defaultHashtags: ['#Tech', '#AI', '#Cortes'],
    maxDurationSec: 140,
    recommendedRatio: '16:9',
    webhookUrl: '',
    accessTokenMasked: '',
    lastSync: null
  }
];

function createSeedProject() {
  return {
    id: 'proj-demo-001',
    title: 'Podcast Tech & Criadores #42 — O Segredo da Retenção em Vídeos Curtos com IA',
    sourceType: 'local_demo',
    isSingleClipMode: false,
    sourceUrl: '/uploads/videos/demo_podcast.mp4',
    videoFileName: 'demo_podcast.mp4',
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    status: 'completed',
    pipelineStage: 'Pronto para Edição e Exportação',
    pipelineProgress: 100,
    metadata: {
      duration: 60,
      width: 1280,
      height: 720,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      sampleRate: 48000,
      bitrateKbps: 2450,
      aspectRatio: '16:9',
      detectedSpeakers: []
    },
    clips: [
      {
        id: 'clip-001',
        projectId: 'proj-demo-001',
        rank: 1,
        title: 'Por que 90% dos criadores erram nos primeiros 3 segundos do corte',
        hookBannerText: 'O SEGREDO DOS 3 PRIMEIROS SEGUNDOS 🔥',
        showHookBanner: true,
        hookStyle: { ...DEFAULT_HOOK_STYLE },
        startTime: 0,
        endTime: 20,
        duration: 20,
        approved: true,
        manualEditsCount: 2,
        viralityScore: 94,
        criteriaScores: {
          hook: 9.6,
          context: 9.2,
          development: 9.4,
          conclusion: 9.1,
          engagement: 9.7,
          avQuality: 9.5,
          autonomy: 9.3
        },
        justification: 'Gancho imediato com pergunta provocativa seguida de um dado estatístico forte.',
        semanticCategory: 'Pergunta & Revelação de Impacto',
        layout: {
          ...DEFAULT_LAYOUT_CONFIG,
          mode: 'gameplay_split'
        },
        captionStyle: {
          ...DEFAULT_CAPTION_STYLE,
          fontSize: 42,
          showSpeakerBadge: false
        },
        avTreatment: { ...DEFAULT_AV_TREATMENT },
        socialSuggestion: {
          title: 'O erro invisível que derruba 90% dos seus vídeos curtos nos primeiros 3 segundos! 🚀',
          caption: 'A maioria tenta cortar vídeos pelo tempo, mas a verdadeira curadoria analisa GANCHO, CONTEXTO e AUTONOMIA.',
          hashtags: ['#cortesdepodcast', '#gameplay', '#inteligenciaartificial', '#reelsviral', '#shorts'],
          bestPlatform: 'TikTok & Instagram Reels'
        },
        subtitles: [
          {
            id: 'sub-101',
            speakerId: 'spk-1',
            speakerName: '',
            startTime: 0.2,
            endTime: 4.4,
            text: 'Qual é o maior erro de quem cria cortes hoje?',
            emoji: '',
            words: [
              { word: 'Qual', start: 0.2, end: 0.6, highlight: false },
              { word: 'é', start: 0.6, end: 0.9, highlight: false },
              { word: 'o', start: 0.9, end: 1.1, highlight: false },
              { word: 'MAIOR', start: 1.1, end: 1.7, highlight: true, color: '#FACC15' },
              { word: 'ERRO', start: 1.7, end: 2.3, highlight: true, color: '#EF4444' },
              { word: 'de', start: 2.3, end: 2.6, highlight: false },
              { word: 'quem', start: 2.6, end: 3.0, highlight: false },
              { word: 'cria', start: 3.0, end: 3.4, highlight: false },
              { word: 'CORTES', start: 3.4, end: 3.9, highlight: true, color: '#22C55E' },
              { word: 'hoje?', start: 3.9, end: 4.4, highlight: false }
            ]
          },
          {
            id: 'sub-102',
            speakerId: 'spk-1',
            speakerName: '',
            startTime: 4.5,
            endTime: 9.8,
            text: 'Noventa por cento perdem a retenção nos primeiros três segundos!',
            emoji: '',
            words: [
              { word: 'NOVENTA', start: 4.5, end: 5.2, highlight: true, color: '#FACC15' },
              { word: 'por', start: 5.2, end: 5.5, highlight: false },
              { word: 'cento', start: 5.5, end: 6.0, highlight: false },
              { word: 'perdem', start: 6.0, end: 6.6, highlight: false },
              { word: 'a', start: 6.6, end: 6.8, highlight: false },
              { word: 'RETENÇÃO', start: 6.8, end: 7.6, highlight: true, color: '#22C55E' },
              { word: 'nos', start: 7.6, end: 8.0, highlight: false },
              { word: 'primeiros', start: 8.0, end: 8.7, highlight: false },
              { word: 'TRÊS', start: 8.7, end: 9.2, highlight: true, color: '#FACC15' },
              { word: 'SEGUNDOS!', start: 9.2, end: 9.8, highlight: true, color: '#EF4444' }
            ]
          },
          {
            id: 'sub-103',
            speakerId: 'spk-1',
            speakerName: '',
            startTime: 10.0,
            endTime: 15.0,
            text: 'Não basta dividir o vídeo: você precisa de gancho e contexto claro.',
            emoji: '',
            words: [
              { word: 'Não', start: 10.0, end: 10.4, highlight: false },
              { word: 'basta', start: 10.4, end: 10.9, highlight: false },
              { word: 'dividir', start: 10.9, end: 11.4, highlight: false },
              { word: 'o', start: 11.4, end: 11.6, highlight: false },
              { word: 'vídeo:', start: 11.6, end: 12.1, highlight: false },
              { word: 'você', start: 12.1, end: 12.5, highlight: false },
              { word: 'precisa', start: 12.5, end: 13.0, highlight: false },
              { word: 'de', start: 13.0, end: 13.2, highlight: false },
              { word: 'GANCHO', start: 13.2, end: 13.8, highlight: true, color: '#FACC15' },
              { word: 'e', start: 13.8, end: 14.0, highlight: false },
              { word: 'CONTEXTO', start: 14.0, end: 14.6, highlight: true, color: '#22C55E' },
              { word: 'claro.', start: 14.6, end: 15.0, highlight: false }
            ]
          },
          {
            id: 'sub-104',
            speakerId: 'spk-1',
            speakerName: '',
            startTime: 15.2,
            endTime: 19.8,
            text: 'Quando a legenda e o enquadramento acompanham a voz, o vídeo explode!',
            emoji: '',
            words: [
              { word: 'Quando', start: 15.2, end: 15.6, highlight: false },
              { word: 'a', start: 15.6, end: 15.8, highlight: false },
              { word: 'LEGENDA', start: 15.8, end: 16.4, highlight: true, color: '#FACC15' },
              { word: 'e', start: 16.4, end: 16.6, highlight: false },
              { word: 'o', start: 16.6, end: 16.8, highlight: false },
              { word: 'ENQUADRAMENTO', start: 16.8, end: 17.7, highlight: true, color: '#38BDF8' },
              { word: 'acompanham', start: 17.7, end: 18.4, highlight: false },
              { word: 'a', start: 18.4, end: 18.6, highlight: false },
              { word: 'voz,', start: 18.6, end: 19.0, highlight: false },
              { word: 'o', start: 19.0, end: 19.1, highlight: false },
              { word: 'vídeo', start: 19.1, end: 19.4, highlight: false },
              { word: 'EXPLODE!', start: 19.4, end: 19.8, highlight: true, color: '#22C55E' }
            ]
          }
        ],
        geminiSuggestions: []
      }
    ]
  };
}

const DEFAULT_DB = {
  settings: {
    uiTheme: 'cyber_cyan',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: 'gemini-3.8-flash',
    enableMultimodalAnalysis: true,
    infrastructureMode: 'Híbrido (Processamento Local Whisper/FFmpeg + IA Gemini Cloud)',
    retentionDays: 30,
    autoDeleteIntermediates: true,
    hardwareAcceleration: 'x264 (Compatibilidade Universal CPU) / NVENC Auto',
    defaultExportProfile: {
      aspectRatio: '9:16',
      resolution: '1080x1920',
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      fps: 30,
      audioSampleRate: 48000,
      audioBitrate: '192k'
    }
  },
  defaultClipPreset: DEFAULT_CLIP_PRESET,
  savedPresets: INITIAL_SAVED_PRESETS,
  scoringWeights: DEFAULT_SCORING_WEIGHTS,
  fonts: PRIMARY_FONTS,
  socialAccounts: DEFAULT_SOCIAL_ACCOUNTS,
  scheduledPosts: [],
  exports: [],
  metrics: {
    totalVideosProcessed: 1,
    totalClipsGenerated: 1,
    approvedClipsCount: 1,
    avgProcessingTimeSec: 12.4,
    estimatedCostPerMinUsd: 0.0,
    manualCorrectionsTotal: 1,
    failedJobsCount: 0
  },
  projects: [createSeedProject()]
};

export function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return JSON.parse(JSON.stringify(DEFAULT_DB));
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.fonts || parsed.fonts.length < 10) {
      parsed.fonts = PRIMARY_FONTS;
    }
    if (!parsed.scoringWeights) {
      parsed.scoringWeights = DEFAULT_SCORING_WEIGHTS;
    }
    if (!parsed.socialAccounts) {
      parsed.socialAccounts = DEFAULT_SOCIAL_ACCOUNTS;
    }
    if (!parsed.settings.uiTheme) {
      parsed.settings.uiTheme = 'cyber_cyan';
    }
    if (!parsed.settings.geminiModel || parsed.settings.geminiModel === 'gemini-2.5-flash' || parsed.settings.geminiModel === 'gemini-2.0-flash') {
      parsed.settings.geminiModel = 'gemini-3.8-flash';
    }
    if (!parsed.defaultClipPreset) {
      parsed.defaultClipPreset = JSON.parse(JSON.stringify(DEFAULT_CLIP_PRESET));
    }
    if (!Array.isArray(parsed.savedPresets) || parsed.savedPresets.length === 0) {
      parsed.savedPresets = JSON.parse(JSON.stringify(INITIAL_SAVED_PRESETS));
    }

    let migratedCinemaSubtitles = false;
    const normalizeCinemaCaptionStyle = (cs = {}) => {
      const next = {
        ...DEFAULT_CAPTION_STYLE,
        ...cs,
        showSpeakerBadge: false
      };
      if (Number(next.strokeWidth) >= 6) {
        next.strokeWidth = 2;
        migratedCinemaSubtitles = true;
      }
      if (Number(next.shadowBlur) >= 9) {
        next.shadowBlur = 3;
        migratedCinemaSubtitles = true;
      }
      return next;
    };

    if (parsed.defaultClipPreset?.captionStyle) {
      parsed.defaultClipPreset.captionStyle = normalizeCinemaCaptionStyle(parsed.defaultClipPreset.captionStyle);
    }
    if (Array.isArray(parsed.savedPresets)) {
      parsed.savedPresets.forEach((pr) => {
        if (pr.captionStyle) {
          pr.captionStyle = normalizeCinemaCaptionStyle(pr.captionStyle);
        }
      });
    }

    // Backfill defaults and remove "Participante 1" badges unless user explicitly enabled them
    (parsed.projects || []).forEach((proj) => {
      (proj.clips || []).forEach((clip) => {
        clip.hookStyle = { ...DEFAULT_HOOK_STYLE, ...(clip.hookStyle || {}) };
        clip.layout = {
          ...DEFAULT_LAYOUT_CONFIG,
          ...(clip.layout || {}),
          cam1Region: { ...DEFAULT_LAYOUT_CONFIG.cam1Region, ...(clip.layout?.cam1Region || {}) },
          cam2Region: { ...DEFAULT_LAYOUT_CONFIG.cam2Region, ...(clip.layout?.cam2Region || {}) },
          pipDest: { ...DEFAULT_LAYOUT_CONFIG.pipDest, ...(clip.layout?.pipDest || {}) }
        };
        clip.captionStyle = normalizeCinemaCaptionStyle(clip.captionStyle);
      });
    });

    if (migratedCinemaSubtitles) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
      } catch {}
    }
    return parsed;
  } catch (err) {
    console.error('Error loading DB, resetting to default:', err);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

export function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}
