import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scissors,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Film,
  Clock,
  Sparkles
} from 'lucide-react';

function formatTimeMMSS(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe - Math.floor(safe)) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export default function SourceVideoTrimmer({
  projects = [],
  activeProject,
  isCutting,
  onCutAndLoadSingleClip
}) {
  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isExpanded, setIsExpanded] = useState(true);
  const [localFile, setLocalFile] = useState(null);
  const [localObjectUrl, setLocalObjectUrl] = useState('');
  const [selectedExistingSource, setSelectedExistingSource] = useState('');
  const [cutTitle, setCutTitle] = useState('');

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopPreviewOnly, setLoopPreviewOnly] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);

  // Dragging state on the Online-Video-Cutter style timeline: 'start' | 'end' | 'playhead' | null
  const [dragHandle, setDragHandle] = useState(null);
  const [thumbnails, setThumbnails] = useState([]);

  // Build list of available server source videos from existing projects
  const availableServerSources = React.useMemo(() => {
    const seen = new Set();
    const list = [];
    (projects || []).forEach((p) => {
      const fName = p.originalSourceFileName || p.videoFileName;
      if (fName && !seen.has(fName)) {
        seen.add(fName);
        list.push({
          fileName: fName,
          url: `/uploads/videos/${fName}`,
          label: `${p.title} (${fName})`
        });
      }
    });
    return list;
  }, [projects]);

  // Initialize with activeProject's source video if no local file is selected
  useEffect(() => {
    if (!localFile && !selectedExistingSource && availableServerSources.length > 0) {
      const defaultSrc =
        (activeProject && (activeProject.originalSourceFileName || activeProject.videoFileName)) ||
        availableServerSources[0].fileName;
      setSelectedExistingSource(defaultSrc);
    }
  }, [localFile, selectedExistingSource, availableServerSources, activeProject]);

  // Clean up object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (localObjectUrl) {
        URL.revokeObjectURL(localObjectUrl);
      }
    };
  }, [localObjectUrl]);

  const activeVideoSrc = localFile
    ? localObjectUrl
    : selectedExistingSource
    ? `/uploads/videos/${selectedExistingSource}`
    : '/uploads/videos/demo_podcast.mp4';

  const handleSelectLocalFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localObjectUrl) {
      URL.revokeObjectURL(localObjectUrl);
    }
    const objUrl = URL.createObjectURL(file);
    setLocalFile(file);
    setLocalObjectUrl(objUrl);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setCutTitle(cleanName);
    setIsExpanded(true);
  };

  const handleSelectServerSource = (fileName) => {
    if (localObjectUrl) {
      URL.revokeObjectURL(localObjectUrl);
    }
    setLocalFile(null);
    setLocalObjectUrl('');
    setSelectedExistingSource(fileName);
    const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/_[0-9]+$/, '');
    setCutTitle(cleanName);
  };

  // Generate visual filmstrip thumbnails across the timeline when video loads
  const generateTimelineThumbnails = useCallback(async (srcUrl, totalDur) => {
    if (!srcUrl || !totalDur || totalDur <= 0) return;
    try {
      const tempVideo = document.createElement('video');
      tempVideo.src = srcUrl;
      tempVideo.crossOrigin = 'anonymous';
      tempVideo.muted = true;
      tempVideo.preload = 'auto';

      await new Promise((resolve, reject) => {
        tempVideo.onloadeddata = resolve;
        tempVideo.onerror = reject;
        setTimeout(reject, 4000);
      });

      const count = 8;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      const frames = [];

      for (let i = 0; i < count; i++) {
        const sampleTime = Math.min(totalDur - 0.1, Math.max(0.1, ((i + 0.5) / count) * totalDur));
        tempVideo.currentTime = sampleTime;
        await new Promise((res) => {
          const onSeek = () => {
            tempVideo.removeEventListener('seeked', onSeek);
            res();
          };
          tempVideo.addEventListener('seeked', onSeek);
          setTimeout(res, 350);
        });
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.65));
      }
      setThumbnails(frames);
    } catch {
      setThumbnails([]);
    }
  }, []);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const dur = Math.max(1, Math.round((Number(v.duration) || 60) * 10) / 10);
    setDuration(dur);
    setTrimStart(0);
    setTrimEnd(Math.min(dur, Math.max(5, Math.min(60, dur))));
    setCurrentTime(0);
    setIsPlaying(false);
    generateTimelineThumbnails(activeVideoSrc, dur);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const now = v.currentTime;
    setCurrentTime(now);
    if (loopPreviewOnly && now >= trimEnd) {
      v.currentTime = trimStart;
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = isMuted ? 0 : Math.min(1, Math.max(0, volume / 100));
    v.muted = isMuted || volume === 0;
  }, [volume, isMuted]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) {
        v.currentTime = trimStart;
      }
      v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const playSelectedCutFromStart = () => {
    const v = videoRef.current;
    if (!v) return;
    setLoopPreviewOnly(true);
    v.currentTime = trimStart;
    setCurrentTime(trimStart);
    v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const seekTo = (timeSec) => {
    const clamped = Math.max(0, Math.min(duration || 60, Number(timeSec) || 0));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const updateTrimStartSafe = (val) => {
    const maxAllowed = Math.max(0, trimEnd - 1.0);
    const nextStart = Math.round(Math.max(0, Math.min(maxAllowed, Number(val) || 0)) * 10) / 10;
    setTrimStart(nextStart);
    seekTo(nextStart);
  };

  const updateTrimEndSafe = (val) => {
    const minAllowed = Math.min(duration || 60, trimStart + 1.0);
    const nextEnd = Math.round(Math.min(duration || 60, Math.max(minAllowed, Number(val) || 0)) * 10) / 10;
    setTrimEnd(nextEnd);
    seekTo(nextEnd);
  };

  // Global mouse move/up listeners for smooth Online-Video-Cutter timeline handle dragging
  useEffect(() => {
    if (!dragHandle) return;

    const handleWindowMouseMove = (e) => {
      if (!timelineRef.current || !duration) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetSec = Math.round(ratio * duration * 10) / 10;

      if (dragHandle === 'start') {
        const nextStart = Math.min(trimEnd - 1.0, Math.max(0, targetSec));
        setTrimStart(Math.round(nextStart * 10) / 10);
        if (videoRef.current) videoRef.current.currentTime = nextStart;
        setCurrentTime(nextStart);
      } else if (dragHandle === 'end') {
        const nextEnd = Math.max(trimStart + 1.0, Math.min(duration, targetSec));
        setTrimEnd(Math.round(nextEnd * 10) / 10);
        if (videoRef.current) videoRef.current.currentTime = nextEnd;
        setCurrentTime(nextEnd);
      } else if (dragHandle === 'playhead') {
        if (videoRef.current) videoRef.current.currentTime = targetSec;
        setCurrentTime(targetSec);
      }
    };

    const handleWindowMouseUp = () => {
      setDragHandle(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragHandle, duration, trimStart, trimEnd]);

  const handleTimelineMouseDown = (e) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickSec = Math.round(ratio * duration * 10) / 10;
    seekTo(clickSec);
    setDragHandle('playhead');
  };

  const handleExecuteCut = async () => {
    if (isCutting || !onCutAndLoadSingleClip) return;
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    await onCutAndLoadSingleClip({
      localFile,
      sourceFileName: localFile ? null : selectedExistingSource || 'demo_podcast.mp4',
      trimStart,
      trimEnd,
      title: cutTitle.trim() || (localFile ? localFile.name.replace(/\.[^/.]+$/, '') : 'Novo Corte')
    });
  };

  const startPct = duration > 0 ? Math.min(100, Math.max(0, (trimStart / duration) * 100)) : 0;
  const endPct = duration > 0 ? Math.min(100, Math.max(startPct + 1, (trimEnd / duration) * 100)) : 100;
  const playheadPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const cutDuration = Math.max(1, Math.round((trimEnd - trimStart) * 10) / 10);

  return (
    <div className="bg-studio-900 border border-cyan-500/40 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Header Bar */}
      <div className="bg-studio-950/90 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white">
                1. Recortador de Vídeo Fonte (Criar Novo Corte a partir de um Vídeo Maior)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                ESTILO ONLINE VIDEO CUTTER
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Abra um vídeo maior, arraste as barras de início e fim na linha do tempo para recortar o trecho desejado e envie direto para o Editor de Clipe Único abaixo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleSelectLocalFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition"
          >
            <Upload className="w-4 h-4" />
            Abrir Vídeo Maior do Computador
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 border border-slate-700"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" /> Recolher
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" /> Expandir Recortador
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Source Switcher & Clip Title Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-studio-950 p-3 rounded-xl border border-slate-800">
            <div className="md:col-span-5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Vídeo Fonte Carregado no Recortador
              </label>
              {localFile ? (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 font-bold">
                  <span className="truncate">📂 {localFile.name}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    className="text-[11px] underline text-cyan-300 shrink-0"
                  >
                    Trocar Arquivo
                  </button>
                </div>
              ) : (
                <select
                  value={selectedExistingSource}
                  onChange={(e) => handleSelectServerSource(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-studio-900 border border-slate-700 text-xs font-bold text-white"
                >
                  {availableServerSources.map((src) => (
                    <option key={src.fileName} value={src.fileName}>
                      🎬 {src.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="md:col-span-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nome / Título do Novo Corte
              </label>
              <input
                type="text"
                placeholder="Ex: Melhor Momento da Live #1"
                value={cutTitle}
                onChange={(e) => setCutTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-studio-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="md:col-span-3 flex flex-col justify-end">
              <div className="px-3 py-1.5 rounded-lg bg-studio-900 border border-cyan-500/30 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Duração do Corte:</span>
                <span className="font-mono font-black text-cyan-300 text-sm">
                  {cutDuration.toFixed(1)}s ({formatTimeMMSS(cutDuration)})
                </span>
              </div>
            </div>
          </div>

          {/* Video Preview Viewport */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 flex flex-col items-center bg-[#05060a] border border-slate-800 rounded-xl p-2.5 relative">
              <video
                ref={videoRef}
                src={activeVideoSrc}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
                playsInline
                className="w-full max-h-[290px] object-contain rounded-lg cursor-pointer bg-black"
              />

              <div className="w-full flex flex-wrap items-center justify-between gap-2 mt-2 px-1 text-[11px] font-mono">
                <span className="text-slate-300">
                  Tempo Atual: <strong className="text-violet-300">{formatTimeMMSS(currentTime)}</strong> ({currentTime.toFixed(1)}s / {duration.toFixed(1)}s)
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                  Trecho Selecionado: {formatTimeMMSS(trimStart)} → {formatTimeMMSS(trimEnd)}
                </span>
              </div>
            </div>

            {/* Right Quick Controls & Nudge Panel */}
            <div className="lg:col-span-5 bg-studio-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Ajuste Preciso de Início e Fim do Recorte
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTrimStart(0);
                    setTrimEnd(duration || 60);
                  }}
                  className="text-[11px] font-bold text-slate-400 hover:text-white underline"
                >
                  Selecionar Vídeo Todo
                </button>
              </div>

              {/* Start Time Row */}
              <div className="p-2.5 rounded-lg bg-studio-900 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300">
                    [ Início do Corte: {formatTimeMMSS(trimStart)}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateTrimStartSafe(currentTime)}
                    className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 text-[10px] font-bold"
                  >
                    [ Marcar no Tempo Atual
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateTrimStartSafe(trimStart - 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTrimStartSafe(trimStart - 0.1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200"
                  >
                    -0.1s
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={Math.max(0, trimEnd - 1)}
                    value={trimStart}
                    onChange={(e) => updateTrimStartSafe(e.target.value)}
                    className="flex-1 px-2 py-1 rounded bg-studio-950 border border-slate-700 text-center font-mono text-xs font-bold text-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateTrimStartSafe(trimStart + 0.1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200"
                  >
                    +0.1s
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTrimStartSafe(trimStart + 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200"
                  >
                    +1s
                  </button>
                </div>
              </div>

              {/* End Time Row */}
              <div className="p-2.5 rounded-lg bg-studio-900 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-300">
                    Fim do Corte ]: {formatTimeMMSS(trimEnd)}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateTrimEndSafe(currentTime)}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-[10px] font-bold"
                  >
                    Marcar no Tempo Atual ]
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateTrimEndSafe(trimEnd - 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTrimEndSafe(trimEnd - 0.1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200"
                  >
                    -0.1s
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min={trimStart + 1}
                    max={duration || 60}
                    value={trimEnd}
                    onChange={(e) => updateTrimEndSafe(e.target.value)}
                    className="flex-1 px-2 py-1 rounded bg-studio-950 border border-slate-700 text-center font-mono text-xs font-bold text-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateTrimEndSafe(trimEnd + 0.1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200"
                  >
                    +0.1s
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTrimEndSafe(trimEnd + 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200"
                  >
                    +1s
                  </button>
                </div>
              </div>

              {/* Quick Cut Length Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400 font-semibold mr-1">Duração Rápida:</span>
                {[15, 30, 45, 60, 90].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => updateTrimEndSafe(Math.min(duration || 60, trimStart + sec))}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 border border-slate-700"
                  >
                    +{sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ONLINE-VIDEO-CUTTER VISUAL TIMELINE BAR WITH FILMSTRIP & DRAGGABLE TRIM HANDLES */}
          <div className="bg-studio-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
              <span>00:00.0</span>
              <span>{formatTimeMMSS(duration * 0.25)}</span>
              <span className="text-cyan-300 font-sans font-bold">
                ⟷ Arraste as alças laterais Azuis/Verdes para recortar o vídeo
              </span>
              <span>{formatTimeMMSS(duration * 0.75)}</span>
              <span>{formatTimeMMSS(duration)}</span>
            </div>

            <div
              ref={timelineRef}
              onMouseDown={handleTimelineMouseDown}
              className="relative w-full h-16 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden select-none cursor-pointer"
            >
              {/* Filmstrip Frame Thumbnails */}
              <div className="absolute inset-0 flex">
                {thumbnails.length > 0 ? (
                  thumbnails.map((thumb, idx) => (
                    <img
                      key={idx}
                      src={thumb}
                      alt=""
                      draggable={false}
                      className="flex-1 h-full object-cover opacity-80 pointer-events-none border-r border-slate-800/40"
                    />
                  ))
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 flex items-center justify-center text-[11px] text-slate-500 font-mono">
                    Linha do Tempo Visual do Vídeo Fonte ({duration.toFixed(1)}s)
                  </div>
                )}
              </div>

              {/* Left Cut-Out Dimmed Mask */}
              <div
                style={{ width: `${startPct}%` }}
                className="absolute inset-y-0 left-0 bg-black/75 pointer-events-none"
              />

              {/* Right Cut-Out Dimmed Mask */}
              <div
                style={{ left: `${endPct}%`, width: `${Math.max(0, 100 - endPct)}%` }}
                className="absolute inset-y-0 right-0 bg-black/75 pointer-events-none"
              />

              {/* Active Selected Cut Window Frame */}
              <div
                style={{ left: `${startPct}%`, width: `${Math.max(0.5, endPct - startPct)}%` }}
                className="absolute inset-y-0 border-y-4 border-cyan-400 bg-cyan-400/10 pointer-events-none"
              />

              {/* Draggable LEFT Handle (Trim Start) */}
              <div
                style={{ left: `calc(${startPct}% - 10px)` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragHandle('start');
                }}
                title={`Arrastar Início do Corte (${formatTimeMMSS(trimStart)})`}
                className="absolute inset-y-0 w-5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 flex flex-col items-center justify-center cursor-ew-resize z-20 rounded-l-md shadow-lg"
              >
                <div className="w-1 h-6 bg-slate-950 rounded-full" />
              </div>

              {/* Draggable RIGHT Handle (Trim End) */}
              <div
                style={{ left: `calc(${endPct}% - 10px)` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragHandle('end');
                }}
                title={`Arrastar Fim do Corte (${formatTimeMMSS(trimEnd)})`}
                className="absolute inset-y-0 w-5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 flex flex-col items-center justify-center cursor-ew-resize z-20 rounded-r-md shadow-lg"
              >
                <div className="w-1 h-6 bg-slate-950 rounded-full" />
              </div>

              {/* Playhead Cursor Line */}
              <div
                style={{ left: `${playheadPct}%` }}
                className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_#fff] z-30 pointer-events-none"
              >
                <div className="w-3 h-3 -ml-[5px] bg-white rounded-full shadow" />
              </div>
            </div>

            {/* Bottom Action Bar: Transport, Volume & "Recortar Vídeo e Incluir no Editor" */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  {isPlaying ? 'Pausar' : 'Reproduzir'}
                </button>

                <button
                  type="button"
                  onClick={playSelectedCutFromStart}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Testar Recorte ({cutDuration.toFixed(1)}s)
                </button>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-studio-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-slate-300 hover:text-white"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(Number(e.target.value));
                      if (Number(e.target.value) > 0) setIsMuted(false);
                    }}
                    className="w-20 accent-emerald-400 cursor-pointer h-1.5"
                  />
                  <span className="text-[10px] font-mono text-slate-300 w-8">
                    {isMuted ? '0%' : `${volume}%`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isCutting}
                onClick={handleExecuteCut}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg transition"
              >
                {isCutting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recortando Vídeo & Transcrevendo Legendas...
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" />
                    Recortar Vídeo ({formatTimeMMSS(trimStart)} → {formatTimeMMSS(trimEnd)}) & Abrir no Editor Abaixo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
