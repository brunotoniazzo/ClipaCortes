import React, { useState, useEffect, useCallback } from 'react';
import {
  Scissors,
  Sparkles,
  Upload,
  Link2,
  Type,
  Sliders,
  Share2,
  Plus,
  Film,
  Download,
  Wand2,
  MessageSquare,
  Layout,
  Palette,
  Trash2,
  FileVideo,
  Award,
  Loader2,
  Search,
  Gamepad2,
  Move,
  Maximize2,
  BookmarkCheck,
  Save
} from 'lucide-react';
import VideoCanvasPlayer, { renderHookBannerToDataUrl } from './components/VideoCanvasPlayer.jsx';
import SourceVideoTrimmer from './components/SourceVideoTrimmer.jsx';
import FontManagerModal, { registerFontsInBrowser } from './components/FontManagerModal.jsx';
import ScoringCalibrationModal from './components/ScoringCalibrationModal.jsx';
import SocialHubView from './components/SocialHubView.jsx';
import ArchitectureAndGeminiView from './components/ArchitectureAndGeminiView.jsx';

export const SOFTWARE_THEMES = [
  { id: 'cyber_cyan', name: 'Ciano & Esmeralda (Cyber)', primary: '#06b6d4', accent: '#10b981' },
  { id: 'crimson_orange', name: 'Rubi & Laranja (Creator)', primary: '#e11d48', accent: '#f97316' },
  { id: 'royal_blue', name: 'Azul Royal & Sky (Studio)', primary: '#2563eb', accent: '#38bdf8' },
  { id: 'matrix_emerald', name: 'Verde Matrix & Lima (Gaming)', primary: '#16a34a', accent: '#a3e635' },
  { id: 'gold_graphite', name: 'Dourado & Grafite (Cinema)', primary: '#d97706', accent: '#38bdf8' },
  { id: 'opus_purple', name: 'Roxo & Amarelo (Clássico)', primary: '#7c3aed', accent: '#facc15' }
];

export default function App() {
  const [dbState, setDbState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('studio');
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeClipId, setActiveClipId] = useState(null);
  const [editorTab, setEditorTab] = useState('layout');
  const [playheadTime, setPlayheadTime] = useState(0);

  const [uiTheme, setUiTheme] = useState('cyber_cyan');

  // Modals
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);
  const [isScoringModalOpen, setIsScoringModalOpen] = useState(false);

  // Default Preset Manager States
  const [presetNameInput, setPresetNameInput] = useState('');
  const [presetFeedback, setPresetFeedback] = useState(null);
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  // Gemini Copilot States
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [isAskingGemini, setIsAskingGemini] = useState(false);
  const [geminiAnalysisText, setGeminiAnalysisText] = useState('');

  // Single-Clip & AI Subtitle Transcription States
  const [singleClipFile, setSingleClipFile] = useState(null);
  const [singleClipTitle, setSingleClipTitle] = useState('');
  const [singleClipTranscript, setSingleClipTranscript] = useState('');
  const [transcriptionModel, setTranscriptionModel] = useState('gemini-3.5-transcribe-dual');
  const [transcriptionLang, setTranscriptionLang] = useState('pt-BR');
  const [maxWordsPerSegment, setMaxWordsPerSegment] = useState(6);
  const [isGeneratingSingleSubs, setIsGeneratingSingleSubs] = useState(false);
  const [singleSubStatus, setSingleSubStatus] = useState(null);

  // Subtitle Search & Replace
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');

  // FFmpeg Rendering State
  const [isRenderingFFmpeg, setIsRenderingFFmpeg] = useState(false);
  const [latestExport, setLatestExport] = useState(null);
  const [renderError, setRenderError] = useState(null);

  // Ingestion States
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadTranscript, setUploadTranscript] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importTranscript, setImportTranscript] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setDbState(data);
      if (data.settings?.uiTheme) {
        setUiTheme(data.settings.uiTheme);
      }
      registerFontsInBrowser(data.fonts || []);
      if (data.projects && data.projects.length > 0) {
        const firstProj = data.projects[0];
        setActiveProjectId((prev) => prev || firstProj.id);
        if (firstProj.clips && firstProj.clips.length > 0) {
          setActiveClipId((prev) => prev || firstProj.clips[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme);
  }, [uiTheme]);

  const handleThemeChange = async (newThemeId) => {
    setUiTheme(newThemeId);
    try {
      await fetch('/api/settings/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uiTheme: newThemeId })
      });
    } catch {}
  };

  const activeProject =
    dbState?.projects?.find((p) => p.id === activeProjectId) ||
    dbState?.projects?.[0] ||
    null;

  const activeClip =
    activeProject?.clips?.find((c) => c.id === activeClipId) ||
    activeProject?.clips?.[0] ||
    null;

  const selectProjectCleanly = (project) => {
    if (!project) return;
    setActiveProjectId(project.id);
    const firstClip = project.clips?.[0] || null;
    setActiveClipId(firstClip ? firstClip.id : null);
    setPlayheadTime(firstClip ? Number(firstClip.startTime) || 0 : 0);
    setLatestExport(null);
    setGeminiAnalysisText('');
    setSingleSubStatus(null);
  };

  const updateActiveClip = async (updates) => {
    if (!activeProject || !activeClip) return;

    setDbState((prev) => {
      if (!prev) return prev;
      const nextProjects = prev.projects.map((p) => {
        if (p.id !== activeProject.id) return p;
        return {
          ...p,
          clips: p.clips.map((c) => {
            if (c.id !== activeClip.id) return c;
            const mergedLayout = updates.layout
              ? {
                  ...c.layout,
                  ...updates.layout,
                  cam1Region: updates.layout.cam1Region
                    ? { ...(c.layout?.cam1Region || {}), ...updates.layout.cam1Region }
                    : c.layout?.cam1Region,
                  cam2Region: updates.layout.cam2Region
                    ? { ...(c.layout?.cam2Region || {}), ...updates.layout.cam2Region }
                    : c.layout?.cam2Region,
                  pipDest: updates.layout.pipDest
                    ? { ...(c.layout?.pipDest || {}), ...updates.layout.pipDest }
                    : c.layout?.pipDest
                }
              : c.layout;

            const merged = {
              ...c,
              ...updates,
              hookStyle: updates.hookStyle ? { ...(c.hookStyle || {}), ...updates.hookStyle } : c.hookStyle,
              layout: mergedLayout,
              captionStyle: updates.captionStyle
                ? { ...c.captionStyle, ...updates.captionStyle }
                : c.captionStyle,
              avTreatment: updates.avTreatment
                ? { ...c.avTreatment, ...updates.avTreatment }
                : c.avTreatment,
              socialSuggestion: updates.socialSuggestion
                ? { ...c.socialSuggestion, ...updates.socialSuggestion }
                : c.socialSuggestion,
              criteriaScores: updates.criteriaScores
                ? { ...c.criteriaScores, ...updates.criteriaScores }
                : c.criteriaScores
            };
            merged.duration = Math.max(
              1,
              Math.round(((Number(merged.endTime) || 20) - (Number(merged.startTime) || 0)) * 10) / 10
            );
            return merged;
          })
        };
      });
      return { ...prev, projects: nextProjects };
    });

    try {
      const res = await fetch(`/api/projects/${activeProject.id}/clips/${activeClip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (res.ok && data.clip) {
        setDbState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            metrics: data.metrics || prev.metrics,
            projects: prev.projects.map((p) =>
              p.id === activeProject.id
                ? {
                    ...p,
                    clips: p.clips.map((c) => (c.id === activeClip.id ? data.clip : c))
                  }
                : p
            )
          };
        });
      }
    } catch (err) {
      console.error('Error updating clip:', err);
    }
  };

  // ============================================================================
  // DEFAULT PRESET CREATION & APPLICATION HANDLERS
  // ============================================================================
  const handleSaveCurrentAsDefaultPreset = async () => {
    if (!activeClip || isSavingPreset) return;
    setIsSavingPreset(true);
    setPresetFeedback(null);
    try {
      const customName =
        presetNameInput.trim() ||
        `Meu Padrão (${activeClip.layout?.mode || 'gameplay_split'} • ${activeClip.layout?.aspectRatio || '9:16'})`;

      const res = await fetch('/api/presets/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName,
          showHookBanner: activeClip.showHookBanner,
          hookStyle: activeClip.hookStyle,
          layout: activeClip.layout,
          captionStyle: activeClip.captionStyle,
          avTreatment: activeClip.avTreatment,
          saveToLibrary: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDbState((prev) => ({
          ...prev,
          defaultClipPreset: data.defaultClipPreset,
          savedPresets: data.savedPresets
        }));
        setPresetNameInput('');
        setPresetFeedback(`✓ Salvo como Configuração Padrão ("${data.defaultClipPreset.name}") para todos os próximos cortes!`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleApplyPreset = async (presetId, applyToAll = false) => {
    if (!activeProject || !activeClip) return;
    try {
      const res = await fetch('/api/presets/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          clipId: activeClip.id,
          presetId,
          applyToAllProjectClips: applyToAll
        })
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setDbState((prev) => ({
          ...prev,
          defaultClipPreset: data.defaultClipPreset || prev.defaultClipPreset,
          projects: prev.projects.map((p) => (p.id === data.project.id ? data.project : p))
        }));
        setPresetFeedback(
          applyToAll
            ? `✓ Configuração Padrão aplicada a todos os cortes do projeto!`
            : `✓ Configuração Padrão aplicada a este corte!`
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Single-Clip Upload Handler (Automatically transcribes spoken audio into subtitles & applies Default Preset!)
  const handleUploadSingleClip = async (e) => {
    e.preventDefault();
    if (!singleClipFile || isIngesting) return;
    setIsIngesting(true);
    setSingleSubStatus({
      type: 'info',
      text: 'Transcrevendo áudio do vídeo (Whisper Local STT / Gemini STT), sincronizando tempos e aplicando sua Configuração Padrão...'
    });

    try {
      const formData = new FormData();
      formData.append('video', singleClipFile);
      formData.append('title', singleClipTitle || singleClipFile.name.replace(/\.[^/.]+$/, ''));
      formData.append('transcript', singleClipTranscript);
      formData.append('transcriptionModel', transcriptionModel);

      const res = await fetch('/api/projects/upload-single-clip', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setDbState((prev) => ({
          ...prev,
          projects: [data.project, ...(prev.projects || [])]
        }));
        selectProjectCleanly(data.project);
        setSingleClipFile(null);
        setSingleClipTitle('');
        setSingleClipTranscript('');
        setSingleSubStatus({
          type: 'success',
          text: `✓ Áudio transcrito automaticamente (${data.engine}: ${data.clip?.subtitles?.length || 0} legendas sincronizadas) e Configuração Padrão aplicada!`
        });
      }
    } catch (err) {
      setSingleSubStatus({ type: 'error', text: err.message });
    } finally {
      setIsIngesting(false);
    }
  };

  // Cut a segment [trimStart, trimEnd] from a larger source video and load it directly into the Single-Clip Editor
  const handleCutAndLoadSingleClip = async ({ localFile, sourceFileName, trimStart, trimEnd, title }) => {
    if (isIngesting) return;
    setIsIngesting(true);
    setSingleSubStatus({
      type: 'info',
      text: `Recortando vídeo fonte (${Number(trimStart).toFixed(1)}s → ${Number(trimEnd).toFixed(1)}s), transcrevendo áudio do novo corte e aplicando Configuração Padrão...`
    });

    try {
      let res;
      if (localFile) {
        const formData = new FormData();
        formData.append('video', localFile);
        formData.append('title', title || localFile.name.replace(/\.[^/.]+$/, ''));
        formData.append('trimStart', String(trimStart));
        formData.append('trimEnd', String(trimEnd));
        formData.append('transcriptionModel', transcriptionModel);
        res = await fetch('/api/projects/upload-single-clip', {
          method: 'POST',
          body: formData
        });
      } else {
        res = await fetch('/api/projects/cut-from-source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceFileName,
            trimStart,
            trimEnd,
            title,
            transcriptionModel
          })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao recortar o vídeo fonte.');
      }

      if (data.project) {
        setDbState((prev) => ({
          ...prev,
          projects: [data.project, ...(prev.projects || [])]
        }));
        selectProjectCleanly(data.project);
        setSingleSubStatus({
          type: 'success',
          text: `✓ Novo corte criado (${Number(trimStart).toFixed(1)}s → ${Number(trimEnd).toFixed(1)}s • ${data.clip?.duration}s), transcrito (${data.engine}: ${data.clip?.subtitles?.length || 0} legendas) e incluído no Editor de Clipe Único abaixo!`
        });
      }
    } catch (err) {
      setSingleSubStatus({ type: 'error', text: err.message });
    } finally {
      setIsIngesting(false);
    }
  };

  // Re-generate / Synchronize Subtitles with Real Audio STT for the active clip
  const handleGenerateSubtitlesWithAI = async () => {
    if (!activeProject || !activeClip || isGeneratingSingleSubs) return;
    setIsGeneratingSingleSubs(true);
    setSingleSubStatus({
      type: 'info',
      text: `Extraindo áudio e transcrevendo falas em alta qualidade via API Gemini (${transcriptionModel})...`
    });
    try {
      const res = await fetch('/api/clips/generate-subtitles-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          clipId: activeClip.id,
          transcriptText: singleClipTranscript,
          transcriptionModel,
          language: transcriptionLang,
          maxWordsPerSegment
        })
      });
      const data = await res.json();
      if (res.ok && data.clip) {
        setDbState((prev) => ({
          ...prev,
          projects: prev.projects.map((p) =>
            p.id === activeProject.id
              ? {
                  ...p,
                  clips: p.clips.map((c) => (c.id === activeClip.id ? data.clip : c))
                }
              : p
          )
        }));
        setSingleSubStatus({
          type: 'success',
          text: `✓ Transcrição de alta precisão concluída (${data.subtitles?.length || 0} legendas sincronizadas via ${data.engine})!`
        });
      }
    } catch (err) {
      setSingleSubStatus({ type: 'error', text: err.message });
    } finally {
      setIsGeneratingSingleSubs(false);
    }
  };

  const handleAskGeminiForAlterations = async (customPromptText) => {
    if (!activeProject || !activeClip || isAskingGemini) return;
    setIsAskingGemini(true);
    try {
      const promptToUse = customPromptText !== undefined ? customPromptText : geminiPrompt;
      const res = await fetch('/api/gemini/suggest-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          clipId: activeClip.id,
          userPrompt: promptToUse
        })
      });
      const data = await res.json();
      if (res.ok && data.clip) {
        setGeminiAnalysisText(data.assistantAnalysis || '');
        setDbState((prev) => ({
          ...prev,
          projects: prev.projects.map((p) =>
            p.id === activeProject.id
              ? {
                  ...p,
                  clips: p.clips.map((c) => (c.id === activeClip.id ? data.clip : c))
                }
              : p
          )
        }));
      }
    } catch (err) {
      console.error('Gemini suggest error:', err);
    } finally {
      setIsAskingGemini(false);
    }
  };

  const handleApplyGeminiSuggestion = async (suggestion) => {
    if (!activeClip || !suggestion?.changes) return;
    const updatedSuggestions = (activeClip.geminiSuggestions || []).map((s) =>
      s.id === suggestion.id ? { ...s, applied: true } : s
    );

    await updateActiveClip({
      ...suggestion.changes,
      geminiSuggestions: updatedSuggestions
    });
  };

  const handleTriggerFFmpegRender = async (customOptions = {}) => {
    if (!activeProject || !activeClip || isRenderingFFmpeg) return;
    setIsRenderingFFmpeg(true);
    setLatestExport(null);
    setRenderError(null);
    try {
      const targetAspectRatio = customOptions.aspectRatio || activeClip.layout?.aspectRatio || '9:16';
      const hookOverlayPng = renderHookBannerToDataUrl(activeClip, targetAspectRatio);

      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          clipId: activeClip.id,
          exportOptions: {
            aspectRatio: targetAspectRatio,
            fps: 30,
            ...(hookOverlayPng ? { hookOverlayPng } : {}),
            ...customOptions
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao renderizar o vídeo com FFmpeg.');
      }
      if (data.exportRecord) {
        setLatestExport(data.exportRecord);
        setDbState((prev) => ({
          ...prev,
          exports: [data.exportRecord, ...(prev.exports || [])]
        }));
        // Automatically download the rendered MP4 file for immediate user feedback
        try {
          const a = document.createElement('a');
          a.href = data.exportRecord.mp4Url;
          a.download = data.exportRecord.fileName || `${data.exportRecord.id}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch {}
      }
    } catch (err) {
      console.error('Render error:', err);
      setRenderError(err.message || 'Erro ao renderizar o vídeo.');
    } finally {
      setIsRenderingFFmpeg(false);
    }
  };

  const handleCreateManualClip = async () => {
    if (!activeProject) return;
    try {
      const res = await fetch(`/api/projects/${activeProject.id}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Corte #${activeProject.clips.length + 1}`,
          startTime: 0,
          endTime: Math.min(20, activeProject.metadata?.duration || 20)
        })
      });
      const data = await res.json();
      if (res.ok && data.clip) {
        await fetchState();
        setActiveClipId(data.clip.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSnapCutToSentenceBoundaries = () => {
    if (!activeClip || !Array.isArray(activeClip.subtitles) || activeClip.subtitles.length === 0) return;
    const firstSub = activeClip.subtitles[0];
    const lastSub = activeClip.subtitles[activeClip.subtitles.length - 1];
    const safeStart = Math.max(0, Math.round((firstSub.startTime - 0.2) * 10) / 10);
    const safeEnd = Math.min(
      activeProject?.metadata?.duration || 60,
      Math.round((lastSub.endTime + 0.2) * 10) / 10
    );
    updateActiveClip({ startTime: safeStart, endTime: safeEnd });
  };

  const handleReplaceProperNouns = () => {
    if (!findTerm.trim() || !activeClip) return;
    const regex = new RegExp(findTerm.trim(), 'gi');
    const updatedSubs = (activeClip.subtitles || []).map((sub) => {
      const newText = (sub.text || '').replace(regex, replaceTerm);
      const newWords = (sub.words || []).map((w) => ({
        ...w,
        word: (w.word || '').replace(regex, replaceTerm)
      }));
      return { ...sub, text: newText, words: newWords };
    });
    updateActiveClip({ subtitles: updatedSubs });
    setFindTerm('');
    setReplaceTerm('');
  };

  const handleUploadLocalVideo = async (e) => {
    e.preventDefault();
    if (!uploadFile || isIngesting) return;
    setIsIngesting(true);

    try {
      const formData = new FormData();
      formData.append('video', uploadFile);
      formData.append('title', uploadTitle || uploadFile.name.replace(/\.[^/.]+$/, ''));
      formData.append('transcript', uploadTranscript);

      const res = await fetch('/api/projects/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setDbState((prev) => ({
          ...prev,
          projects: [data.project, ...(prev.projects || [])]
        }));
        selectProjectCleanly(data.project);
        setUploadFile(null);
        setUploadTitle('');
        setUploadTranscript('');
        setActiveNav('studio');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleImportByUrl = async (e) => {
    e.preventDefault();
    if (isIngesting) return;
    setIsIngesting(true);

    try {
      const res = await fetch('/api/projects/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: importUrl,
          title: importTitle || (importUrl ? `Corte Social: ${importUrl.slice(0, 35)}` : 'Novo Podcast Estúdio IA'),
          transcript: importTranscript,
          duration: 60
        })
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setDbState((prev) => ({
          ...prev,
          projects: [data.project, ...(prev.projects || [])]
        }));
        selectProjectCleanly(data.project);
        setImportUrl('');
        setImportTitle('');
        setImportTranscript('');
        setActiveNav('studio');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsIngesting(false);
    }
  };

  if (loading || !dbState) {
    return (
      <div className="min-h-screen bg-[#07080c] flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
        <p className="text-sm font-bold text-slate-300">
          Inicializando ClipaCortes Studio AI (FFmpeg + Whisper Local STT + Google Gemini)...
        </p>
      </div>
    );
  }

  const cam1 = activeClip?.layout?.cam1Region || { x: 2, y: 6, w: 28, h: 38 };
  const cam2 = activeClip?.layout?.cam2Region || { x: 18, y: 0, w: 68, h: 100 };
  const hookStyle = activeClip?.hookStyle || {};
  const activeDefaultPreset = dbState.defaultClipPreset || {};
  const savedPresets = dbState.savedPresets || [];

  // Shared Right-Column Editor Panel (Used in both Multi-Clip Studio & Single-Clip Editor)
  const renderRightCustomizationPanel = () => (
    <div className="bg-studio-900 border border-slate-800 rounded-2xl flex flex-col max-h-[89vh] overflow-hidden">
      {/* DEFAULT PRESET BAR AT THE TOP OF THE EDITOR */}
      <div className="bg-studio-950 border-b border-slate-800 px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
            <BookmarkCheck className="w-4 h-4" />
            <span>Configuração Padrão p/ Criação dos Cortes:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={activeDefaultPreset.id || ''}
              onChange={(e) => handleApplyPreset(e.target.value, false)}
              className="px-2.5 py-1 rounded-lg bg-studio-900 border border-slate-700 text-[11px] font-bold text-white max-w-[210px]"
              title="Escolher e aplicar uma Configuração Padrão (Layout, Câmeras, Bloco de Legenda, Fonte e Hook)"
            >
              {savedPresets.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  ⭐ {pr.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleApplyPreset(activeDefaultPreset.id, true)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-cyan-300 border border-slate-700"
              title="Aplicar a Configuração Padrão selecionada em todos os cortes deste projeto"
            >
              Aplicar no Projeto
            </button>
          </div>
        </div>

        {/* Save Current Settings as Default Preset */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={presetNameInput}
            onChange={(e) => setPresetNameInput(e.target.value)}
            placeholder={`Nome do Padrão (atual: ${activeDefaultPreset.name || 'Padrão Gameplay'})...`}
            className="flex-1 px-2.5 py-1 rounded-lg bg-studio-900 border border-slate-700 text-[11px] text-white"
          />
          <button
            type="button"
            disabled={isSavingPreset}
            onClick={handleSaveCurrentAsDefaultPreset}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shadow shrink-0 transition"
            title="Salva o Layout, Posição das Câmeras (Webcam/Jogo), Bloco de Legenda, Fonte e Hook atuais como Configuração Padrão para todos os novos vídeos e cortes!"
          >
            <Save className="w-3.5 h-3.5" />
            Salvar Tudo Atual como Padrão
          </button>
        </div>

        {presetFeedback && (
          <div className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            {presetFeedback}
          </div>
        )}
      </div>

      {/* 6 Studio Customization Sub-Tabs */}
      <div className="grid grid-cols-6 border-b border-slate-800 bg-studio-950 p-1.5 gap-1">
        <button
          onClick={() => setEditorTab('layout')}
          className={`py-2 px-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition ${
            editorTab === 'layout'
              ? 'bg-violet-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layout className="w-4 h-4" />
          <span>Layouts/Cam</span>
        </button>

        <button
          onClick={() => setEditorTab('subtitles')}
          className={`py-2 px-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition ${
            editorTab === 'subtitles'
              ? 'bg-violet-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Legendas STT</span>
        </button>

        <button
          onClick={() => setEditorTab('fonts')}
          className={`py-2 px-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition ${
            editorTab === 'fonts'
              ? 'bg-violet-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>Fonte & Bloco</span>
        </button>

        <button
          onClick={() => setEditorTab('hook')}
          className={`py-2 px-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition ${
            editorTab === 'hook'
              ? 'bg-violet-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Maximize2 className="w-4 h-4" />
          <span>Hook Topo</span>
        </button>

        <button
          onClick={() => setEditorTab('av_export')}
          className={`py-2 px-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition ${
            editorTab === 'av_export'
              ? 'bg-violet-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Áudio/Vídeo</span>
        </button>

        <button
          onClick={() => setEditorTab('gemini')}
          className={`py-2 px-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition ${
            editorTab === 'gemini'
              ? 'bg-violet-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Copiloto IA</span>
        </button>
      </div>

      {/* Sub-Tab Content Area */}
      <div className="p-4 lg:p-5 overflow-y-auto flex-1 space-y-4">
        {/* TAB 1: LAYOUTS, GAMEPLAY SPLIT SCREEN & MANUAL REFRAMING CONTROLS */}
        {editorTab === 'layout' && (
          <div className="space-y-4">
            <div className="bg-studio-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <label className="block text-xs font-bold text-white">
                1. Proporção do Vídeo (Full HD)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { ratio: '9:16', desc: 'Vertical (1080×1920)' },
                  { ratio: '1:1', desc: 'Quadrado (1080×1080)' },
                  { ratio: '4:5', desc: 'Retrato (1080×1350)' },
                  { ratio: '16:9', desc: 'Horizontal (1920×1080)' }
                ].map((item) => (
                  <button
                    key={item.ratio}
                    type="button"
                    onClick={() =>
                      updateActiveClip({
                        layout: { ...activeClip.layout, aspectRatio: item.ratio }
                      })
                    }
                    className={`p-2 rounded-xl border text-left transition ${
                      (activeClip.layout?.aspectRatio || '9:16') === item.ratio
                        ? 'bg-violet-600/25 border-violet-500 text-white'
                        : 'bg-studio-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black">{item.ratio}</div>
                    <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-studio-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <label className="block text-xs font-bold text-white">
                2. Modo de Reenquadramento (Redimensionável Direto na Tela com o Mouse!)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: 'gameplay_split',
                    title: '🎮 Gameplay Split Screen (Webcam + Jogo)',
                    desc: 'Arraste e redimensione os cantos da Webcam e do Jogo direto no Mapa 16:9 ou na Tela!'
                  },
                  {
                    id: 'manual_crop',
                    title: '🎯 Enquadramento Manual Livre',
                    desc: 'Arraste o vídeo diretamente na tela e use a roda do mouse para dar zoom.'
                  },
                  {
                    id: 'auto_speaker',
                    title: '🤖 Rastreamento Facial Suavizado',
                    desc: 'Acompanha quem está falando com suavização temporal + ajuste fino.'
                  },
                  {
                    id: 'split_vertical',
                    title: '👥 Split Screen (2 Participantes)',
                    desc: 'Divide a tela mantendo Câmera 1 no topo e Câmera 2 na base.'
                  },
                  {
                    id: 'cinema_blur',
                    title: '🎬 Cinema Blur 16:9 Centralizado',
                    desc: 'Quadro 16:9 completo sobre fundo desfocado.'
                  },
                  {
                    id: 'pip',
                    title: '🖼️ Picture-in-Picture (Webcam Flutuante)',
                    desc: 'Arraste e redimensione a Webcam flutuante direto sobre o jogo na tela.'
                  }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      updateActiveClip({
                        layout: { ...activeClip.layout, mode: m.id }
                      })
                    }
                    className={`p-2.5 rounded-xl border text-left transition ${
                      activeClip.layout?.mode === m.id
                        ? 'bg-violet-600/25 border-violet-500 text-white shadow'
                        : 'bg-studio-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{m.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality & Region Controls */}
            <div className="bg-studio-950 border border-cyan-500/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-cyan-300">
                  3. Preservação de Qualidade Full HD & Divisão das Câmeras
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateActiveClip({
                      layout: {
                        ...activeClip.layout,
                        invertSplit: !activeClip.layout?.invertSplit
                      }
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-cyan-300 border border-slate-700"
                >
                  ⇅ Inverter Topo / Base
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateActiveClip({
                      layout: { ...activeClip.layout, boxFitMode: 'cover' }
                    })
                  }
                  className={`p-2 rounded-xl border text-left text-xs font-bold transition ${
                    (activeClip.layout?.boxFitMode || 'cover') === 'cover'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-studio-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>✓ Preencher HD Sem Distorcer (Cover)</div>
                  <div className="text-[10px] font-normal text-slate-400">
                    Mantém proporção 1:1 nativa dos pixels sem esticar a webcam ou o jogo.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateActiveClip({
                      layout: { ...activeClip.layout, boxFitMode: 'contain' }
                    })
                  }
                  className={`p-2 rounded-xl border text-left text-xs font-bold transition ${
                    activeClip.layout?.boxFitMode === 'contain'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-studio-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>Conter Caixa 100% Inteira (Contain)</div>
                  <div className="text-[10px] font-normal text-slate-400">
                    Exibe toda a área selecionada sem cortar nenhuma borda.
                  </div>
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-studio-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-cyan-300">
                  🖱️ Controle Direto na Tela Ativo:
                </div>
                <div>
                  • No <strong>Mapa 16:9</strong> (acima do player): arraste o centro das caixas <strong>1. WEBCAM</strong> e <strong>2. JOGO</strong> para mover, puxe os <strong>8 quadrados nos cantos/bordas (■)</strong> para redimensionar livremente ou gire a <strong>Roda do Mouse</strong>!
                </div>
                <div>
                  • No <strong>Vídeo Principal 9:16</strong>: arraste a barra <strong>⇅ DIVISÃO</strong> para subir/descer o corte, arraste dentro da Webcam/Jogo para ajustar o enquadramento ou puxe o botão <strong>⤡ ESCALA</strong>!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUBTITLES & REAL AUDIO SPEECH-TO-TEXT TRANSCRIPTION VIA GEMINI API */}
        {editorTab === 'subtitles' && (
          <div className="space-y-4">
            <div className="bg-studio-950 border border-violet-500/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    Transcrição de Áudio & Criação de Subtitles via API Gemini
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Utiliza os modelos dedicados de áudio do Google Gemini para transcrever falas reais, gírias e pontuação com máxima fidelidade.
                  </p>
                </div>
                <a
                  href={`/api/clips/${activeProject.id}/${activeClip.id}/srt`}
                  download={`${activeClip.id}.srt`}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 border border-slate-700"
                >
                  Baixar .SRT
                </a>
              </div>

              {/* Gemini Audio Transcription Model & Segmentation Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">
                    Modelo Gemini de Transcrição de Áudio
                  </label>
                  <select
                    value={transcriptionModel}
                    onChange={(e) => setTranscriptionModel(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-studio-900 border border-slate-700 text-xs font-bold text-white"
                  >
                    <option value="gemini-3.5-transcribe-dual">
                      🎙️ Gemini 3.5 Transcribe + Flash Sync (Recomendado: Modelo Dedicado de Áudio)
                    </option>
                    <option value="gemini-3.5-flash-lite">
                      ⚡ Gemini 3.5 Flash Lite Audio (Ultra Rápido ~2s + Timestamps)
                    </option>
                    <option value="gemini-3-flash-preview">
                      🚀 Gemini 3 Flash Preview Multimodal Audio
                    </option>
                    <option value="gemini-3.8-flash">
                      🧠 Gemini 3.8 Flash Audio
                    </option>
                    <option value="whisper-local">
                      💻 OpenAI Whisper Local (Modo Offline)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">
                    Ritmo / Palavras por Legenda
                  </label>
                  <select
                    value={maxWordsPerSegment}
                    onChange={(e) => setMaxWordsPerSegment(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-studio-900 border border-slate-700 text-xs font-bold text-white"
                  >
                    <option value={4}>4 palavras (Dinâmico TikTok)</option>
                    <option value={6}>6 palavras (Padrão Shorts/Reels)</option>
                    <option value={9}>9 palavras (Frases Completas)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                disabled={isGeneratingSingleSubs}
                onClick={handleGenerateSubtitlesWithAI}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg transition"
              >
                {isGeneratingSingleSubs ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transcrevendo Áudio com API Gemini ({transcriptionModel})...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Transcrever Áudio e Gerar Legendas com Gemini API Agora
                  </>
                )}
              </button>

              {singleSubStatus && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-semibold ${
                    singleSubStatus.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : singleSubStatus.type === 'info'
                      ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {singleSubStatus.text}
                </div>
              )}
            </div>

            {/* Proper Noun Search & Replace Bar */}
            <div className="bg-studio-950 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Localizar palavra..."
                value={findTerm}
                onChange={(e) => setFindTerm(e.target.value)}
                className="flex-1 min-w-[100px] px-2.5 py-1 rounded-lg bg-studio-900 border border-slate-700 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Substituir por..."
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                className="flex-1 min-w-[100px] px-2.5 py-1 rounded-lg bg-studio-900 border border-slate-700 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleReplaceProperNouns}
                className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold"
              >
                Substituir
              </button>
              <button
                type="button"
                onClick={() => updateActiveClip({ subtitles: [] })}
                className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold"
              >
                Limpar Tudo
              </button>
            </div>

            {/* Pure Transcribed Subtitle Segments List (No "Participante 1" label!) */}
            <div className="space-y-2.5">
              {(activeClip.subtitles || []).length === 0 ? (
                <div className="p-6 rounded-xl bg-studio-950 border border-slate-800 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-300">
                    Nenhuma fala audível encontrada ou lista limpa.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Clique em "Re-Transcrever Áudio do Vídeo" acima para transcrever com Whisper Local / Gemini ou adicione linhas abaixo.
                  </p>
                </div>
              ) : (
                (activeClip.subtitles || []).map((sub, subIdx) => {
                  const isCurrent =
                    playheadTime >= Number(sub.startTime) && playheadTime <= Number(sub.endTime);

                  return (
                    <div
                      key={sub.id}
                      className={`rounded-xl p-3 border transition space-y-2 ${
                        isCurrent
                          ? 'bg-violet-950/30 border-violet-500'
                          : 'bg-studio-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-400">
                          Legenda #{subIdx + 1}
                        </span>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                          <input
                            type="number"
                            step="0.1"
                            value={sub.startTime}
                            onChange={(e) => {
                              const nextStart = Number(e.target.value);
                              const nextSubs = activeClip.subtitles.map((s, i) => {
                                if (i !== subIdx) return s;
                                const endVal = Math.max(nextStart + 0.3, Number(s.endTime) || nextStart + 1.5);
                                const rawWords = (s.text || '').trim().split(/\s+/).filter(Boolean);
                                const dur = Math.max(0.25, endVal - nextStart);
                                const step = dur / Math.max(1, (s.words?.length || rawWords.length || 1));
                                const updatedWords = (s.words || []).map((w, wIdx) => ({
                                  ...w,
                                  start: Math.round((nextStart + wIdx * step) * 100) / 100,
                                  end: Math.round((nextStart + (wIdx + 1) * step) * 100) / 100
                                }));
                                return { ...s, startTime: nextStart, endTime: endVal, words: updatedWords };
                              });
                              updateActiveClip({ subtitles: nextSubs });
                            }}
                            className="w-16 px-1.5 py-0.5 rounded bg-studio-900 border border-slate-700 text-white"
                          />
                          <span>s →</span>
                          <input
                            type="number"
                            step="0.1"
                            value={sub.endTime}
                            onChange={(e) => {
                              const nextEnd = Number(e.target.value);
                              const nextSubs = activeClip.subtitles.map((s, i) => {
                                if (i !== subIdx) return s;
                                const startVal = Number(s.startTime) || 0;
                                const safeEnd = Math.max(startVal + 0.25, nextEnd);
                                const rawWords = (s.text || '').trim().split(/\s+/).filter(Boolean);
                                const dur = Math.max(0.25, safeEnd - startVal);
                                const step = dur / Math.max(1, (s.words?.length || rawWords.length || 1));
                                const updatedWords = (s.words || []).map((w, wIdx) => ({
                                  ...w,
                                  start: Math.round((startVal + wIdx * step) * 100) / 100,
                                  end: Math.round((startVal + (wIdx + 1) * step) * 100) / 100
                                }));
                                return { ...s, endTime: safeEnd, words: updatedWords };
                              });
                              updateActiveClip({ subtitles: nextSubs });
                            }}
                            className="w-16 px-1.5 py-0.5 rounded bg-studio-900 border border-slate-700 text-white"
                          />
                          <span>s</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextSubs = activeClip.subtitles.filter((_, i) => i !== subIdx);
                              updateActiveClip({ subtitles: nextSubs });
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={sub.text}
                        onChange={(e) => {
                          const newText = e.target.value;
                          const rawWords = newText.trim().split(/\s+/).filter(Boolean);
                          const dur = Math.max(0.4, sub.endTime - sub.startTime);
                          const step = dur / Math.max(1, rawWords.length);
                          const newWords = rawWords.map((w, wIdx) => {
                            const existingW = sub.words?.[wIdx];
                            return {
                              word: w,
                              start: Math.round((sub.startTime + wIdx * step) * 100) / 100,
                              end: Math.round((sub.startTime + (wIdx + 1) * step) * 100) / 100,
                              highlight: existingW ? existingW.highlight : false,
                              color: existingW?.color || '#FACC15'
                            };
                          });
                          const nextSubs = activeClip.subtitles.map((s, i) =>
                            i === subIdx ? { ...s, text: newText, words: newWords } : s
                          );
                          updateActiveClip({ subtitles: nextSubs });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-studio-900 border border-slate-700 text-xs text-white"
                      />

                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {(sub.words || []).map((wObj, wIdx) => (
                          <button
                            key={`${sub.id}-w-${wIdx}`}
                            type="button"
                            onClick={() => {
                              const nextWords = sub.words.map((w, k) =>
                                k === wIdx
                                  ? {
                                      ...w,
                                      highlight: !w.highlight,
                                      color: !w.highlight ? '#FACC15' : '#FFFFFF'
                                    }
                                  : w
                              );
                              const nextSubs = activeClip.subtitles.map((s, i) =>
                                i === subIdx ? { ...s, words: nextWords } : s
                              );
                              updateActiveClip({ subtitles: nextSubs });
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                              wObj.highlight
                                ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                                : 'bg-studio-900 border-slate-800 text-slate-300'
                            }`}
                          >
                            {wObj.word}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const lastSub = activeClip.subtitles?.[activeClip.subtitles.length - 1];
                const start = lastSub ? Number(lastSub.endTime) + 0.1 : Number(activeClip.startTime);
                const end = Math.min(Number(activeClip.endTime), start + 3.0);
                const newSub = {
                  id: `sub-custom-${Date.now()}`,
                  speakerId: 'spk-1',
                  speakerName: '',
                  startTime: Math.round(start * 10) / 10,
                  endTime: Math.round(end * 10) / 10,
                  text: 'Digite o texto da legenda...',
                  emoji: '',
                  words: [
                    { word: 'Digite', start, end: start + 1.0, highlight: false },
                    { word: 'o', start: start + 1.0, end: start + 1.5, highlight: false },
                    { word: 'TEXTO...', start: start + 1.5, end, highlight: true, color: '#FACC15' }
                  ]
                };
                updateActiveClip({ subtitles: [...(activeClip.subtitles || []), newSub] });
              }}
              className="w-full py-2.5 rounded-xl bg-studio-950 hover:bg-slate-800 border border-dashed border-slate-700 text-xs font-bold text-violet-300 flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> Adicionar Linha de Legenda Manualmente
            </button>
          </div>
        )}

        {/* TAB 3: FONTS, EXPANDED FONT SIZE & SUBTITLE LOCATION BLOCK ON SCREEN */}
        {editorTab === 'fonts' && (
          <div className="space-y-4">
            <div className="bg-studio-950 border border-amber-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <Move className="w-4 h-4" />
                    Bloco de Localização da Legenda na Tela (Arrastável e Redimensionável)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Você pode mover o bloco e puxar o canto inferior direito (⤡) direto na tela do vídeo!
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '⬇ Base Segura 9:16 (74%)', x: 50, y: 74, w: 86 },
                  { label: '⏺ Centro / Divisão Split (50%)', x: 50, y: 50, w: 88 },
                  { label: '⏺ Acima do Jogo (38%)', x: 50, y: 38, w: 86 },
                  { label: '⬆ Topo Abaixo do Hook (22%)', x: 50, y: 22, w: 86 }
                ].map((pos) => (
                  <button
                    key={pos.label}
                    type="button"
                    onClick={() =>
                      updateActiveClip({
                        captionStyle: {
                          ...activeClip.captionStyle,
                          positionX: pos.x,
                          positionY: pos.y,
                          boxWidthPct: pos.w
                        }
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-studio-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-200"
                  >
                    {pos.label}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-emerald-300 font-semibold pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeClip.captionStyle?.autoFitMargin !== false}
                  onChange={(e) =>
                    updateActiveClip({
                      captionStyle: {
                        ...activeClip.captionStyle,
                        autoFitMargin: e.target.checked
                      }
                    })
                  }
                  className="accent-emerald-400"
                />
                <span>✓ Auto-Fit Inteligente na Margem (Garante que a legenda nunca ultrapasse o bloco 9:16)</span>
              </label>
            </div>

            <div className="bg-studio-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Fonte da Legenda ({dbState.fonts.length} Disponíveis) & Tamanho (14px a 110px)
                </span>
                <button
                  type="button"
                  onClick={() => setIsFontModalOpen(true)}
                  className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> + Fontes (.TTF / Google)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-studio-900 p-3 rounded-xl border border-slate-800">
                <div>
                  <div className="flex justify-between text-xs font-bold text-white mb-1">
                    <span>Tamanho da Fonte (px):</span>
                    <input
                      type="number"
                      min={14}
                      max={110}
                      value={activeClip.captionStyle?.fontSize || 42}
                      onChange={(e) =>
                        updateActiveClip({
                          captionStyle: {
                            ...activeClip.captionStyle,
                            fontSize: Number(e.target.value)
                          }
                        })
                      }
                      className="w-16 px-2 py-0.5 rounded bg-studio-950 border border-slate-700 text-center font-mono text-xs text-violet-300"
                    />
                  </div>
                  <input
                    type="range"
                    min={14}
                    max={110}
                    value={activeClip.captionStyle?.fontSize || 42}
                    onChange={(e) =>
                      updateActiveClip({
                        captionStyle: {
                          ...activeClip.captionStyle,
                          fontSize: Number(e.target.value)
                        }
                      })
                    }
                    className="w-full accent-violet-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-white mb-1">
                    <span>Máx. Palavras por Linha:</span>
                    <span className="font-mono text-violet-300">{activeClip.captionStyle?.wordsPerLine || 3} palavras</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={activeClip.captionStyle?.wordsPerLine || 3}
                    onChange={(e) =>
                      updateActiveClip({
                        captionStyle: {
                          ...activeClip.captionStyle,
                          wordsPerLine: Number(e.target.value)
                        }
                      })
                    }
                    className="w-full accent-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[175px] overflow-y-auto pr-1">
                {dbState.fonts.map((font) => {
                  const selected =
                    activeClip.captionStyle?.fontId === font.id ||
                    activeClip.captionStyle?.fontFamily === font.family;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() =>
                        updateActiveClip({
                          captionStyle: {
                            ...activeClip.captionStyle,
                            fontId: font.id,
                            fontFamily: font.family
                          }
                        })
                      }
                      className={`p-2 rounded-xl border text-left transition ${
                        selected
                          ? 'bg-violet-600/25 border-violet-500 text-white'
                          : 'bg-studio-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 truncate">{font.name}</div>
                      <div
                        className="text-sm text-white truncate"
                        style={{ fontFamily: `"${font.family}", sans-serif`, fontWeight: font.weight || 800 }}
                      >
                        {font.family}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Texto</label>
                  <input
                    type="color"
                    value={activeClip.captionStyle?.textColor || '#FFFFFF'}
                    onChange={(e) =>
                      updateActiveClip({
                        captionStyle: { ...activeClip.captionStyle, textColor: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded cursor-pointer bg-studio-900 border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Palavra Ativa</label>
                  <input
                    type="color"
                    value={activeClip.captionStyle?.highlightColor || '#FACC15'}
                    onChange={(e) =>
                      updateActiveClip({
                        captionStyle: { ...activeClip.captionStyle, highlightColor: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded cursor-pointer bg-studio-900 border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Destaque 2</label>
                  <input
                    type="color"
                    value={activeClip.captionStyle?.secondaryColor || '#22C55E'}
                    onChange={(e) =>
                      updateActiveClip({
                        captionStyle: { ...activeClip.captionStyle, secondaryColor: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded cursor-pointer bg-studio-900 border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Contorno</label>
                  <input
                    type="color"
                    value={activeClip.captionStyle?.strokeColor || '#000000'}
                    onChange={(e) =>
                      updateActiveClip({
                        captionStyle: { ...activeClip.captionStyle, strokeColor: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded cursor-pointer bg-studio-900 border border-slate-700"
                  />
                </div>
              </div>

              {/* Cinema-Standard Outline & Shadow Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-studio-900 p-3 rounded-xl border border-slate-800 mt-2">
                <div>
                  <div className="flex justify-between text-xs font-bold text-white mb-1">
                    <span>Contorno / Outline (Padrão Cinema):</span>
                    <span className="font-mono text-cyan-300">{activeClip.captionStyle?.strokeWidth ?? 2}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.5}
                    value={activeClip.captionStyle?.strokeWidth ?? 2}
                    onChange={(e) =>
                      updateActiveClip({
                        captionStyle: {
                          ...activeClip.captionStyle,
                          strokeWidth: Number(e.target.value)
                        }
                      })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-white mb-1">
                    <span>Sombra Suave / Drop Shadow:</span>
                    <span className="font-mono text-cyan-300">{activeClip.captionStyle?.shadowBlur ?? 3}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={0.5}
                    value={activeClip.captionStyle?.shadowBlur ?? 3}
                    onChange={(e) =>
                      updateActiveClip({
                        captionStyle: {
                          ...activeClip.captionStyle,
                          shadowBlur: Number(e.target.value)
                        }
                      })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: HOOK HEADLINE FULL CUSTOMIZATION */}
        {editorTab === 'hook' && (
          <div className="space-y-4">
            <div className="bg-studio-950 border border-slate-800 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-white">
                    Customização Completa do Hook Headline (Arrastável na Tela)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Personalize texto, fonte exclusiva, cores do gradiente, borda e tamanho.
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-violet-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeClip.showHookBanner !== false}
                    onChange={(e) => updateActiveClip({ showHookBanner: e.target.checked })}
                    className="accent-violet-500"
                  />
                  <span>Exibir Hook</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Texto do Hook Headline
                </label>
                <input
                  type="text"
                  value={activeClip.hookBannerText || ''}
                  onChange={(e) => updateActiveClip({ hookBannerText: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-studio-900 border border-slate-700 text-xs text-white"
                />
              </div>

              {/* Tempo para Desaparecer o Hook Headline Durante o Vídeo */}
              <div className="p-3 rounded-xl bg-studio-900 border border-cyan-500/30 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-cyan-300 block">
                      ⏱️ Tempo para Desaparecer o Hook Headline no Vídeo
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {Number(hookStyle.durationSec ?? 4) > 0
                        ? `Exibe nos primeiros ${Number(hookStyle.durationSec ?? 4)}s do corte e desaparece com fade suave.`
                        : 'Fixo durante o vídeo inteiro (0s = não desaparece).'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={0.5}
                      value={hookStyle.durationSec ?? 4}
                      onChange={(e) =>
                        updateActiveClip({
                          hookStyle: { ...hookStyle, durationSec: Math.max(0, Number(e.target.value)) }
                        })
                      }
                      className="w-16 px-2 py-1 rounded-lg bg-studio-950 border border-slate-700 text-center font-mono text-xs font-bold text-cyan-300"
                    />
                    <span className="text-[11px] text-slate-400 font-mono">seg</span>
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={30}
                  step={0.5}
                  value={Math.min(30, Number(hookStyle.durationSec ?? 4))}
                  onChange={(e) =>
                    updateActiveClip({
                      hookStyle: { ...hookStyle, durationSec: Number(e.target.value) }
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '2.5s (Flash)', sec: 2.5 },
                    { label: '3s (Gancho Rápido)', sec: 3 },
                    { label: '4s (Padrão Viral)', sec: 4 },
                    { label: '5s (Leitura Completa)', sec: 5 },
                    { label: '8s (Intro Longa)', sec: 8 },
                    { label: '12s', sec: 12 },
                    { label: '∞ Vídeo Inteiro (Fixo)', sec: 0 }
                  ].map((opt) => {
                    const isSelected = Number(hookStyle.durationSec ?? 4) === opt.sec;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() =>
                          updateActiveClip({
                            hookStyle: { ...hookStyle, durationSec: opt.sec }
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow'
                            : 'bg-studio-950 hover:bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Fonte do Hook Headline
                  </label>
                  <select
                    value={hookStyle.fontFamily || 'Montserrat'}
                    onChange={(e) =>
                      updateActiveClip({
                        hookStyle: { ...hookStyle, fontFamily: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-studio-900 border border-slate-700 text-xs text-white"
                  >
                    {dbState.fonts.map((f) => (
                      <option key={f.id} value={f.family}>
                        {f.name} ({f.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Tamanho da Fonte do Hook: {hookStyle.fontSize || 24}px
                  </label>
                  <input
                    type="range"
                    min={14}
                    max={54}
                    value={hookStyle.fontSize || 24}
                    onChange={(e) =>
                      updateActiveClip({
                        hookStyle: { ...hookStyle, fontSize: Number(e.target.value) }
                      })
                    }
                    className="w-full accent-violet-500 mt-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Cor do Texto</label>
                  <input
                    type="color"
                    value={hookStyle.textColor || '#FFFFFF'}
                    onChange={(e) =>
                      updateActiveClip({
                        hookStyle: { ...hookStyle, textColor: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded cursor-pointer bg-studio-900 border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Fundo Cor 1</label>
                  <input
                    type="color"
                    value={hookStyle.bgColor1 || '#0891B2'}
                    onChange={(e) =>
                      updateActiveClip({
                        hookStyle: { ...hookStyle, bgColor1: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded cursor-pointer bg-studio-900 border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Fundo Cor 2</label>
                  <input
                    type="color"
                    value={hookStyle.bgColor2 || '#1D4ED8'}
                    onChange={(e) =>
                      updateActiveClip({
                        hookStyle: { ...hookStyle, bgColor2: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded cursor-pointer bg-studio-900 border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Cor da Borda</label>
                  <input
                    type="color"
                    value={hookStyle.borderColor || '#38BDF8'}
                    onChange={(e) =>
                      updateActiveClip({
                        hookStyle: { ...hookStyle, borderColor: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded cursor-pointer bg-studio-900 border border-slate-700"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: '⚡ Ciano Cyber', c1: '#0891B2', c2: '#1E3A8A', txt: '#FFFFFF', brd: '#38BDF8' },
                  { label: '🔥 Vermelho Viral', c1: '#DC2626', c2: '#7C3AED', txt: '#FFFFFF', brd: '#FACC15' },
                  { label: '💛 Amarelo Hormozi', c1: '#FACC15', c2: '#EAB308', txt: '#000000', brd: '#000000' },
                  { label: '🟢 Matrix Neon', c1: '#064E3B', c2: '#14532D', txt: '#A3E635', brd: '#22C55E' },
                  { label: '⚫ Minimal Black', c1: '#090D16', c2: '#1E293B', txt: '#FFFFFF', brd: '#94A3B8' }
                ].map((pr) => (
                  <button
                    key={pr.label}
                    type="button"
                    onClick={() =>
                      updateActiveClip({
                        hookStyle: {
                          ...hookStyle,
                          bgColor1: pr.c1,
                          bgColor2: pr.c2,
                          textColor: pr.txt,
                          borderColor: pr.brd
                        }
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-studio-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200"
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIO & IMAGE TREATMENT + FFMPEG EXPORT */}
        {editorTab === 'av_export' && (
          <div className="space-y-4">
            <div className="bg-studio-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <label className="block text-xs font-bold text-white">
                Tratamento de Imagem & Color Grading
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'viral_punch', label: 'Viral Punch' },
                  { id: 'podcast_warm', label: 'Podcast Warm' },
                  { id: 'cinema_teal', label: 'Cinema Teal' },
                  { id: 'bw_dramatic', label: 'B&W Dramático' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      updateActiveClip({
                        avTreatment: { ...activeClip.avTreatment, filterPreset: p.id }
                      })
                    }
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition ${
                      activeClip.avTreatment?.filterPreset === p.id
                        ? 'bg-violet-600 text-white border-violet-400'
                        : 'bg-studio-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-studio-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-white">
                  Regulagem de Volume do Áudio (Edição & Exportação)
                </label>
                <span className="text-xs font-mono font-bold text-emerald-300">
                  {activeClip.avTreatment?.volumePct ?? 100}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={activeClip.avTreatment?.volumePct ?? 100}
                onChange={(e) =>
                  updateActiveClip({
                    avTreatment: {
                      ...activeClip.avTreatment,
                      volumePct: Number(e.target.value)
                    }
                  })
                }
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            <div className="bg-studio-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-bold text-white">
                Marca d'Água / Identidade do Canal
              </label>
              <input
                type="text"
                value={activeClip.avTreatment?.watermarkText || ''}
                onChange={(e) =>
                  updateActiveClip({
                    avTreatment: { ...activeClip.avTreatment, watermarkText: e.target.value }
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-studio-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="bg-studio-950 border border-violet-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">
                  Exportação Final MP4 Full HD c/ Hook Headline & Subtitles (H.264 CRF 18)
                </span>
                <span className="text-[10px] font-mono text-emerald-300">
                  {activeClip.layout?.aspectRatio || '9:16'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isRenderingFFmpeg}
                  onClick={() => handleTriggerFFmpegRender({ fps: 30 })}
                  className="py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                >
                  {isRenderingFFmpeg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                  {isRenderingFFmpeg ? 'Renderizando...' : 'Renderizar 1080p 30 FPS'}
                </button>
                <button
                  type="button"
                  disabled={isRenderingFFmpeg}
                  onClick={() => handleTriggerFFmpegRender({ fps: 60 })}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {isRenderingFFmpeg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                  {isRenderingFFmpeg ? 'Renderizando...' : 'Renderizar 1080p 60 FPS'}
                </button>
              </div>

              {renderError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs font-bold text-rose-300">
                  Erro na renderização: {renderError}
                </div>
              )}

              {latestExport && latestExport.clipId === activeClip.id && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <div className="font-bold text-emerald-300">
                      ✓ MP4 Full HD Renderizado (com Hook & Legendas)!
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono">
                      {latestExport.validation?.width}×{latestExport.validation?.height} • {latestExport.validation?.duration}s
                    </div>
                  </div>
                  <a
                    href={latestExport.mp4Url}
                    download={latestExport.fileName || `${latestExport.id}.mp4`}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar MP4
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: GEMINI COPILOT */}
        {editorTab === 'gemini' && (
          <div className="space-y-4">
            <div className="bg-studio-950 border border-violet-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-black text-white">
                    Copiloto Gemini — Sugestões de Alteração do Vídeo
                  </h3>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Configurar para Gameplay Split Screen HD, ajustar fonte na margem..."
                  value={geminiPrompt}
                  onChange={(e) => setGeminiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAskGeminiForAlterations();
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-studio-900 border border-slate-700 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => handleAskGeminiForAlterations()}
                  disabled={isAskingGemini}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  {isAskingGemini ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Sugerir
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {(activeClip.geminiSuggestions || []).map((sug) => (
                <div
                  key={sug.id}
                  className={`rounded-xl p-3.5 border transition space-y-2 ${
                    sug.applied
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-studio-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-300 uppercase">
                        {sug.type}
                      </span>
                      <h4 className="text-xs font-bold text-white mt-1">{sug.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyGeminiSuggestion(sug)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        sug.applied
                          ? 'bg-emerald-600/30 text-emerald-200'
                          : 'bg-violet-600 hover:bg-violet-500 text-white'
                      }`}
                    >
                      {sug.applied ? '✓ Aplicada' : 'Aplicar'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">{sug.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col text-slate-100">
      {/* Top Studio Navbar */}
      <header className="sticky top-0 z-40 bg-studio-950/95 backdrop-blur-md border-b border-slate-800/90 px-4 lg:px-6 py-2.5">
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">
                  Clipa<span className="text-violet-400">Cortes</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  FULL HD + WHISPER STT
                </span>
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-studio-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveNav('studio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeNav === 'studio'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Estúdio Multi-Cortes
            </button>

            <button
              onClick={() => setActiveNav('single_clip')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeNav === 'single_clip'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              Editor de Clipe Único
            </button>

            <button
              onClick={() => setActiveNav('ingest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeNav === 'ingest'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Importar Vídeo
            </button>

            <button
              onClick={() => setActiveNav('social')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeNav === 'social'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              Redes Sociais
            </button>

            <button
              onClick={() => setActiveNav('exports')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeNav === 'exports'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Exportações ({dbState.exports?.length || 0})
            </button>

            <button
              onClick={() => setActiveNav('gemini_arch')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeNav === 'gemini_arch'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Gemini & Config
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-studio-900 px-2.5 py-1 rounded-xl border border-slate-700">
              <Palette className="w-3.5 h-3.5 text-violet-400" />
              <select
                value={uiTheme}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
              >
                {SOFTWARE_THEMES.map((th) => (
                  <option key={th.id} value={th.id} className="bg-slate-900 text-white">
                    🎨 {th.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsFontModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-studio-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 transition"
            >
              <Type className="w-3.5 h-3.5 text-violet-400" />
              <span>Fontes ({dbState.fonts?.length || 12})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 lg:p-5">
        {/* VIEW 1: ESTÚDIO MULTI-CORTES */}
        {activeNav === 'studio' && activeProject && activeClip && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-3 bg-studio-900 border border-slate-800 rounded-2xl p-4 flex flex-col max-h-[89vh]">
              <div className="pb-3 mb-3 border-b border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Projeto Ativo ({dbState.projects.length})
                  </span>
                  <button
                    onClick={() => setActiveNav('ingest')}
                    className="text-xs font-bold text-violet-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Novo Vídeo
                  </button>
                </div>
                <select
                  value={activeProject.id}
                  onChange={(e) => {
                    const proj = dbState.projects.find((p) => p.id === e.target.value);
                    selectProjectCleanly(proj);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-studio-950 border border-slate-700 text-xs font-bold text-white"
                >
                  {dbState.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.clips?.length || 0} cortes)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  Cortes ({activeProject.clips?.length || 0})
                </h2>
                <button
                  onClick={handleCreateManualClip}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-violet-300 border border-slate-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Novo Corte
                </button>
              </div>

              <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                {(activeProject.clips || []).map((clip) => {
                  const isSelected = clip.id === activeClip.id;
                  return (
                    <div
                      key={clip.id}
                      onClick={() => {
                        setActiveClipId(clip.id);
                        setPlayheadTime(Number(clip.startTime) || 0);
                      }}
                      className={`rounded-xl p-3 border cursor-pointer transition space-y-2 ${
                        isSelected
                          ? 'bg-violet-950/35 border-violet-500 shadow-lg'
                          : 'bg-studio-950/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-xs">
                          #{clip.rank} • ⚡ {clip.viralityScore}/100
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {Number(clip.startTime).toFixed(1)}s → {Number(clip.endTime).toFixed(1)}s
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-white leading-snug">{clip.title}</h3>
                      <div className="text-[10px] text-cyan-300">
                        {clip.subtitles?.length || 0} legendas transcritas
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col items-center space-y-4">
              <div className="w-full bg-studio-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
                <VideoCanvasPlayer
                  project={activeProject}
                  clip={activeClip}
                  onTimeUpdate={(t) => setPlayheadTime(t)}
                  onUpdateClip={updateActiveClip}
                  onTriggerFFmpegRender={() => handleTriggerFFmpegRender()}
                  isRenderingFFmpeg={isRenderingFFmpeg}
                />

                {renderError && (
                  <div className="w-full mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs font-bold text-rose-300">
                    Erro na renderização: {renderError}
                  </div>
                )}

                {latestExport && latestExport.clipId === activeClip.id && (
                  <div className="w-full mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-bold text-emerald-300">✓ MP4 Full HD Renderizado (com Hook & Legendas)!</div>
                      <div className="text-[11px] text-slate-300 font-mono">
                        {latestExport.validation?.width}×{latestExport.validation?.height} • {latestExport.validation?.duration}s
                      </div>
                    </div>
                    <a
                      href={latestExport.mp4Url}
                      download={latestExport.fileName || `${latestExport.id}.mp4`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar MP4
                    </a>
                  </div>
                )}
              </div>

              <div className="w-full bg-studio-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Início e Fim do Corte (s)</span>
                  <button
                    type="button"
                    onClick={handleSnapCutToSentenceBoundaries}
                    className="px-2.5 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-[11px] font-bold text-violet-300"
                  >
                    ⚡ Ajustar às Frases
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400">Início (s)</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={activeClip.startTime}
                      onChange={(e) => updateActiveClip({ startTime: Math.max(0, Number(e.target.value)) })}
                      className="w-full px-2.5 py-1 rounded bg-studio-950 border border-slate-700 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Fim (s)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={activeClip.endTime}
                      onChange={(e) =>
                        updateActiveClip({
                          endTime: Math.max(Number(activeClip.startTime) + 1, Number(e.target.value))
                        })
                      }
                      className="w-full px-2.5 py-1 rounded bg-studio-950 border border-slate-700 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">{renderRightCustomizationPanel()}</div>
          </div>
        )}

        {/* VIEW 2: EDITOR DE CLIPE ÚNICO (Recortador de Vídeo Fonte + Transcrição Automática + Configuração Padrão) */}
        {activeNav === 'single_clip' && activeProject && activeClip && (
          <div className="space-y-4">
            {/* Step 1: Online-Video-Cutter Style Source Video Trimmer */}
            <SourceVideoTrimmer
              projects={dbState.projects}
              activeProject={activeProject}
              isCutting={isIngesting}
              onCutAndLoadSingleClip={handleCutAndLoadSingleClip}
            />

            {/* Optional Direct Already-Cut Clip Loader */}
            <form
              onSubmit={handleUploadSingleClip}
              className="bg-studio-900 border border-violet-500/30 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-black text-white">
                    Ou Carregar Clipe Já Cortado Direto no Editor (Sem Recorte Prévio)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Se o arquivo já estiver cortado no tamanho final, envie diretamente aqui para transcrever e editar.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setSingleClipFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-violet-600 file:text-white cursor-pointer"
                />
                <button
                  type="submit"
                  disabled={!singleClipFile || isIngesting}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  {isIngesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Carregar Clipe Direto
                    </>
                  )}
                </button>
              </div>
            </form>

            {singleSubStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-bold border ${
                  singleSubStatus.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : singleSubStatus.type === 'info'
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}
              >
                {singleSubStatus.text}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5 flex flex-col items-center space-y-3">
                <div className="w-full bg-studio-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
                  <VideoCanvasPlayer
                    project={activeProject}
                    clip={activeClip}
                    onTimeUpdate={(t) => setPlayheadTime(t)}
                    onUpdateClip={updateActiveClip}
                    onTriggerFFmpegRender={() => handleTriggerFFmpegRender()}
                    isRenderingFFmpeg={isRenderingFFmpeg}
                  />

                  {renderError && (
                    <div className="w-full mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs font-bold text-rose-300">
                      Erro na renderização: {renderError}
                    </div>
                  )}

                  {latestExport && latestExport.clipId === activeClip.id && (
                    <div className="w-full mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between gap-2">
                      <div className="text-xs">
                        <div className="font-bold text-emerald-300">✓ MP4 Full HD Renderizado (com Hook & Legendas)!</div>
                        <div className="text-[11px] text-slate-300 font-mono">
                          {latestExport.validation?.width}×{latestExport.validation?.height} • {latestExport.validation?.duration}s
                        </div>
                      </div>
                      <a
                        href={latestExport.mp4Url}
                        download={latestExport.fileName || `${latestExport.id}.mp4`}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar MP4
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7">{renderRightCustomizationPanel()}</div>
            </div>
          </div>
        )}

        {/* VIEW 3: IMPORTAR VÍDEO */}
        {activeNav === 'ingest' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-studio-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-black text-white mb-1">
                Importar Vídeo — Transcrição Automática do Áudio (Whisper Local STT / Gemini) & Configuração Padrão
              </h2>
              <p className="text-xs text-slate-400">
                Ao adicionar um vídeo novo, o áudio é transcrito automaticamente em legendas sincronizadas e sua Configuração Padrão (`{activeDefaultPreset.name}`) é aplicada a todos os cortes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <form
                  onSubmit={handleUploadLocalVideo}
                  className="bg-studio-950 border border-slate-800 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center gap-2.5 text-violet-400 font-bold text-sm">
                    <FileVideo className="w-5 h-5" />
                    Upload de Vídeo Local (.MP4, .MOV, .WEBM, .MKV)
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Título do Vídeo</label>
                    <input
                      type="text"
                      placeholder="Ex: Gameplay / Podcast Episódio Novo"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-studio-900 border border-slate-700 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Arquivo de Vídeo</label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-violet-600 file:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!uploadFile || isIngesting}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg flex items-center justify-center gap-2 transition"
                  >
                    {isIngesting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Transcrevendo Áudio do Vídeo...
                      </>
                    ) : (
                      'Carregar Vídeo & Transcrever Áudio Automaticamente'
                    )}
                  </button>
                </form>

                <form
                  onSubmit={handleImportByUrl}
                  className="bg-studio-950 border border-slate-800 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-sm">
                    <Link2 className="w-5 h-5" />
                    Importar por URL Social (YouTube, TikTok, Twitch, Reels)
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">URL do Vídeo</label>
                    <input
                      type="text"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-studio-900 border border-slate-700 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Título do Conteúdo</label>
                    <input
                      type="text"
                      placeholder="Ex: Live Gameplay Highlights"
                      value={importTitle}
                      onChange={(e) => setImportTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-studio-900 border border-slate-700 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isIngesting}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg transition"
                  >
                    Importar URL com Configuração Padrão
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: REDES SOCIAIS */}
        {activeNav === 'social' && (
          <SocialHubView
            socialAccounts={dbState.socialAccounts}
            scheduledPosts={dbState.scheduledPosts}
            activeProject={activeProject}
            activeClip={activeClip}
            onSocialUpdated={(accounts) =>
              setDbState((prev) => ({ ...prev, socialAccounts: accounts }))
            }
            onPostsUpdated={(posts) =>
              setDbState((prev) => ({ ...prev, scheduledPosts: posts }))
            }
          />
        )}

        {/* VIEW 5: EXPORTAÇÕES FFMPEG */}
        {activeNav === 'exports' && (
          <div className="space-y-5">
            <div className="bg-studio-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">
                  Central de Renderizações & Exportações Full HD (Lanczos + H.264 CRF 18)
                </h2>
                <p className="text-xs text-slate-400">
                  Arquivos MP4 codificados mantendo 100% da qualidade e proporção das caixas de Webcam e Gameplay.
                </p>
              </div>
              <button
                onClick={() => handleTriggerFFmpegRender()}
                disabled={isRenderingFFmpeg}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"
              >
                {isRenderingFFmpeg ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Renderizando Corte Ativo...
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4" /> Renderizar Corte Ativo
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(dbState.exports || []).map((exp) => (
                <div
                  key={exp.id}
                  className="bg-studio-900 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      ✓ VALIDADO FFPROBE
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {exp.aspectRatio} • {exp.layoutMode}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white">{exp.clipTitle}</h3>
                  <div className="flex gap-2">
                    <a
                      href={exp.mp4Url}
                      download={`${exp.id}.mp4`}
                      className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar MP4
                    </a>
                    <a
                      href={exp.srtUrl}
                      download={`${exp.id}.srt`}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                    >
                      .SRT
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 6: GEMINI & CONFIG */}
        {activeNav === 'gemini_arch' && (
          <ArchitectureAndGeminiView
            settings={dbState.settings}
            metrics={dbState.metrics}
            onSettingsUpdated={(newSettings) =>
              setDbState((prev) => ({ ...prev, settings: newSettings }))
            }
          />
        )}
      </main>

      <FontManagerModal
        isOpen={isFontModalOpen}
        onClose={() => setIsFontModalOpen(false)}
        fonts={dbState.fonts}
        activeFontId={activeClip?.captionStyle?.fontId}
        onSelectFont={(font) => {
          if (activeClip) {
            updateActiveClip({
              captionStyle: {
                ...activeClip.captionStyle,
                fontId: font.id,
                fontFamily: font.family
              }
            });
          }
        }}
        onFontsUpdated={(newFonts) =>
          setDbState((prev) => ({ ...prev, fonts: newFonts }))
        }
      />

      <ScoringCalibrationModal
        isOpen={isScoringModalOpen}
        onClose={() => setIsScoringModalOpen(false)}
        scoringWeights={dbState.scoringWeights}
        onSaveWeights={(newWeights, updatedProjects) =>
          setDbState((prev) => ({
            ...prev,
            scoringWeights: newWeights,
            projects: updatedProjects || prev.projects
          }))
        }
      />
    </div>
  );
}
