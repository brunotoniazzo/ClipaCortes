import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume1,
  Volume2,
  VolumeX,
  Eye,
  Download,
  Film,
  Move,
  Crosshair,
  Loader2,
  Maximize2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

/**
 * Renders the clip's Hook Headline banner onto an offscreen transparent PNG DataURL
 * (with showHandle = false so no editing borders appear) for exact FFmpeg video overlay.
 */
export function renderHookBannerToDataUrl(clip, customAspectRatio) {
  if (!clip || clip.showHookBanner === false || !clip.hookBannerText || !String(clip.hookBannerText).trim()) {
    return null;
  }
  try {
    const ratio = customAspectRatio || clip.layout?.aspectRatio || '9:16';
    let cw = 1080;
    let ch = 1920;
    if (ratio === '1:1') {
      cw = 1080;
      ch = 1080;
    } else if (ratio === '16:9') {
      cw = 1920;
      ch = 1080;
    } else if (ratio === '4:5') {
      cw = 1080;
      ch = 1350;
    }
    const offCanvas = document.createElement('canvas');
    offCanvas.width = cw;
    offCanvas.height = ch;
    const ctx = offCanvas.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);
    drawCustomHookBanner(ctx, cw, ch, clip.hookBannerText, clip.hookStyle, false, 1.0);
    return offCanvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Hook banner offscreen render failed:', err);
    return null;
  }
}

export default function VideoCanvasPlayer({
  project,
  clip,
  onTimeUpdate,
  onUpdateClip,
  onTriggerFFmpegRender,
  isRenderingFFmpeg
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const sourceMapCanvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const smoothedCropXRef = useRef(0.5);
  const isRecordingRef = useRef(false);
  const recorderRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(() =>
    clip?.avTreatment?.volumePct !== undefined ? Number(clip.avTreatment.volumePct) : 100
  );
  const [currentTime, setCurrentTime] = useState(clip?.startTime || 0);
  const [showVisionHud, setShowVisionHud] = useState(false);
  const [editBlocksOnScreen, setEditBlocksOnScreen] = useState(true);
  const [showSourceRegionMap, setShowSourceRegionMap] = useState(true);
  const [activeSourceBox, setActiveSourceBox] = useState('cam1'); // 'cam1' | 'cam2'

  // Direct on-screen drag/resize states for the Main Output Canvas
  const [outputDragState, setOutputDragState] = useState(null);
  // Direct on-screen drag/resize states for the 16:9 Source Map Canvas
  const [sourceDragState, setSourceDragState] = useState(null);
  const [sourceCursor, setSourceCursor] = useState('crosshair');

  const [isRecordingCanvas, setIsRecordingCanvas] = useState(false);

  const startTime = Number(clip?.startTime) || 0;
  const endTime = Number(clip?.endTime) || 20;
  const clipDuration = Math.max(1, endTime - startTime);

  useEffect(() => {
    const start = Number(clip?.startTime) || 0;
    setCurrentTime(start);
    if (clip?.avTreatment?.volumePct !== undefined) {
      setVolume(Number(clip.avTreatment.volumePct));
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = start;
      setIsPlaying(false);
    }
  }, [clip?.id, clip?.startTime, project?.id, project?.sourceUrl]);

  // Synchronize HTML5 video volume & mute state in real time during editing
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const normalizedVol = isMuted ? 0 : Math.min(1, Math.max(0, Number(volume) / 100));
    v.volume = normalizedVol;
    v.muted = isMuted || normalizedVol === 0;
  }, [volume, isMuted, project?.sourceUrl]);

  const handleVolumeChange = (nextVolPct) => {
    const clamped = Math.round(Math.min(100, Math.max(0, Number(nextVolPct) || 0)));
    setVolume(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    if (videoRef.current) {
      videoRef.current.volume = clamped / 100;
      videoRef.current.muted = clamped === 0;
    }
    if (onUpdateClip && clip) {
      onUpdateClip({
        avTreatment: {
          ...(clip.avTreatment || {}),
          volumePct: clamped
        },
        _skipTelemetry: true
      });
    }
  };

  const adjustPanelScaleStep = (panelType, factor) => {
    if (!clip || !onUpdateClip) return;
    const invertSplit = Boolean(clip.layout?.invertSplit);
    const targetKey =
      panelType === 'top'
        ? invertSplit
          ? 'cam2Region'
          : 'cam1Region'
        : invertSplit
        ? 'cam1Region'
        : 'cam2Region';
    const cur =
      clip.layout?.[targetKey] ||
      (targetKey === 'cam1Region' ? { x: 2, y: 6, w: 28, h: 38 } : { x: 18, y: 0, w: 68, h: 100 });
    const cx = cur.x + cur.w / 2;
    const cy = cur.y + cur.h / 2;
    const nextW = Math.round(Math.min(100, Math.max(8, cur.w * factor)));
    const nextH = Math.round(Math.min(100, Math.max(8, cur.h * factor)));
    const nextX = Math.round(Math.min(100 - nextW, Math.max(0, cx - nextW / 2)));
    const nextY = Math.round(Math.min(100 - nextH, Math.max(0, cy - nextH / 2)));
    onUpdateClip({
      layout: {
        ...clip.layout,
        [targetKey]: { x: nextX, y: nextY, w: nextW, h: nextH }
      },
      _skipTelemetry: true
    });
  };

  // Full HD Internal Resolution so resized Webcam & Gameplay boxes keep 100% crystal-clear quality!
  const getCanvasDimensions = useCallback(() => {
    const ratio = clip?.layout?.aspectRatio || '9:16';
    if (ratio === '1:1') return { width: 1080, height: 1080, label: '1:1 Full HD (1080×1080)' };
    if (ratio === '16:9') return { width: 1920, height: 1080, label: '16:9 Full HD (1920×1080)' };
    if (ratio === '4:5') return { width: 1080, height: 1350, label: '4:5 Full HD (1080×1350)' };
    return { width: 1080, height: 1920, label: '9:16 Full HD (1080×1920)' };
  }, [clip?.layout?.aspectRatio]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < startTime || v.currentTime >= endTime) {
        v.currentTime = startTime;
      }
      v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const restartClip = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = startTime;
    setCurrentTime(startTime);
    if (onTimeUpdate) onTimeUpdate(startTime);
  };

  const handleSeek = (e) => {
    const nextTime = Number(e.target.value);
    setCurrentTime(nextTime);
    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
    }
    if (onTimeUpdate) onTimeUpdate(nextTime);
  };

  // ============================================================================
  // 1. DIRECT MOUSE INTERACTION ON THE MAIN OUTPUT VIDEO SCREEN (Move & Resize!)
  // ============================================================================
  const handleOutputMouseDown = (e) => {
    if (!editBlocksOnScreen || !canvasRef.current || !clip) {
      togglePlay();
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const layoutMode = clip.layout?.mode || 'gameplay_split';
    const splitRatio = Number(clip.layout?.splitRatio ?? 38);
    const invertSplit = Boolean(clip.layout?.invertSplit);

    // A. Check if grabbing the Subtitle Block or its Bottom-Right Resize Handle
    const capX = Number(clip.captionStyle?.positionX ?? 50);
    const capY = Number(clip.captionStyle?.positionY ?? 74);
    const capW = Number(clip.captionStyle?.boxWidthPct ?? 86);
    const capH = Number(clip.captionStyle?.boxHeightPct ?? 18);
    const capLeft = capX - capW / 2;
    const capRight = capX + capW / 2;
    const capTop = capY - capH / 2;
    const capBottom = capY + capH / 2;

    if (Math.abs(xPct - capRight) <= 6 && Math.abs(yPct - capBottom) <= 6) {
      setOutputDragState({
        type: 'caption_resize',
        startX: xPct,
        startY: yPct,
        initW: capW,
        initFontSize: Number(clip.captionStyle?.fontSize || 42)
      });
      return;
    }
    if (xPct >= capLeft && xPct <= capRight && yPct >= capTop && yPct <= capBottom) {
      setOutputDragState({
        type: 'caption_move',
        offsetX: xPct - capX,
        offsetY: yPct - capY
      });
      return;
    }

    // B. Check if grabbing the Hook Headline or its Right Resize Handle
    if (clip.showHookBanner) {
      const hookX = Number(clip.hookStyle?.positionX ?? 50);
      const hookY = Number(clip.hookStyle?.positionY ?? 8);
      const hookW = Number(clip.hookStyle?.maxWidthPct ?? 88);
      if (Math.abs(xPct - (hookX + hookW / 2)) <= 6 && Math.abs(yPct - hookY) <= 7) {
        setOutputDragState({
          type: 'hook_resize',
          startX: xPct,
          startY: yPct,
          initFontSize: Number(clip.hookStyle?.fontSize || 24),
          initW: hookW
        });
        return;
      }
      if (Math.abs(xPct - hookX) <= hookW / 2 && Math.abs(yPct - hookY) <= 7) {
        setOutputDragState({
          type: 'hook_move',
          offsetX: xPct - hookX,
          offsetY: yPct - hookY
        });
        return;
      }
    }

    // C. Check if grabbing the PiP Floating Webcam or its Resize Corner
    if (layoutMode === 'pip') {
      const pip = clip.layout?.pipDest || { x: 60, y: 12, w: 34, h: 28 };
      if (Math.abs(xPct - (pip.x + pip.w)) <= 6 && Math.abs(yPct - (pip.y + pip.h)) <= 6) {
        setOutputDragState({
          type: 'pip_resize',
          startX: xPct,
          startY: yPct,
          initPip: { ...pip }
        });
        return;
      }
      if (xPct >= pip.x && xPct <= pip.x + pip.w && yPct >= pip.y && yPct <= pip.y + pip.h) {
        setOutputDragState({
          type: 'pip_move',
          offsetX: xPct - pip.x,
          offsetY: yPct - pip.y,
          initPip: { ...pip }
        });
        return;
      }
    }

    // D. Check if grabbing the Horizontal Split Divider Line or Panel Scale Handles in gameplay_split / split_vertical
    if (layoutMode === 'gameplay_split' || layoutMode === 'split_vertical') {
      const effectiveSplitY = invertSplit ? 100 - splitRatio : splitRatio;
      if (Math.abs(yPct - effectiveSplitY) <= 4.5) {
        setOutputDragState({ type: 'split_divider', invertSplit });
        return;
      }

      // Check top panel scale handle (top-right corner of top panel)
      if (xPct >= 82 && yPct >= effectiveSplitY - 12 && yPct < effectiveSplitY - 4) {
        const targetKey = invertSplit ? 'cam2Region' : 'cam1Region';
        setOutputDragState({
          type: 'panel_scale',
          targetKey,
          startX: xPct,
          startY: yPct,
          initReg: { ...(clip.layout?.[targetKey] || { x: 2, y: 6, w: 28, h: 38 }) }
        });
        return;
      }

      // Check bottom panel scale handle (bottom-right corner of bottom panel)
      if (xPct >= 82 && yPct >= 86) {
        const targetKey = invertSplit ? 'cam1Region' : 'cam2Region';
        setOutputDragState({
          type: 'panel_scale',
          targetKey,
          startX: xPct,
          startY: yPct,
          initReg: { ...(clip.layout?.[targetKey] || { x: 18, y: 0, w: 68, h: 100 }) }
        });
        return;
      }

      // Dragging inside Top Panel pans the Top Camera crop directly!
      if (yPct < effectiveSplitY) {
        const targetKey = invertSplit ? 'cam2Region' : 'cam1Region';
        setOutputDragState({
          type: 'panel_pan',
          targetKey,
          startX: xPct,
          startY: yPct,
          initReg: { ...(clip.layout?.[targetKey] || { x: 2, y: 6, w: 28, h: 38 }) }
        });
        return;
      } else {
        // Dragging inside Bottom Panel pans the Bottom Camera crop directly!
        const targetKey = invertSplit ? 'cam1Region' : 'cam2Region';
        setOutputDragState({
          type: 'panel_pan',
          targetKey,
          startX: xPct,
          startY: yPct,
          initReg: { ...(clip.layout?.[targetKey] || { x: 18, y: 0, w: 68, h: 100 }) }
        });
        return;
      }
    }

    // E. In single-frame modes (manual_crop / auto_speaker / cinema_blur), dragging on screen pans manualPanX/Y
    setOutputDragState({
      type: 'main_pan',
      startX: xPct,
      startY: yPct,
      initPanX: Number(clip.layout?.manualPanX ?? 50),
      initPanY: Number(clip.layout?.manualPanY ?? 50)
    });
  };

  const handleOutputMouseMove = (e) => {
    if (!outputDragState || !canvasRef.current || !clip || !onUpdateClip) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    if (outputDragState.type === 'caption_move') {
      onUpdateClip({
        captionStyle: {
          ...clip.captionStyle,
          positionX: Math.round(Math.min(88, Math.max(12, xPct - outputDragState.offsetX))),
          positionY: Math.round(Math.min(92, Math.max(8, yPct - outputDragState.offsetY)))
        },
        _skipTelemetry: true
      });
    } else if (outputDragState.type === 'caption_resize') {
      const deltaX = xPct - outputDragState.startX;
      const deltaY = yPct - outputDragState.startY;
      const nextW = Math.round(Math.min(96, Math.max(40, outputDragState.initW + deltaX * 1.8)));
      const nextFont = Math.round(Math.min(110, Math.max(16, outputDragState.initFontSize + deltaY * 0.9)));
      onUpdateClip({
        captionStyle: {
          ...clip.captionStyle,
          boxWidthPct: nextW,
          fontSize: nextFont
        },
        _skipTelemetry: true
      });
    } else if (outputDragState.type === 'hook_move') {
      onUpdateClip({
        hookStyle: {
          ...(clip.hookStyle || {}),
          positionX: Math.round(Math.min(88, Math.max(12, xPct - outputDragState.offsetX))),
          positionY: Math.round(Math.min(88, Math.max(5, yPct - outputDragState.offsetY)))
        },
        _skipTelemetry: true
      });
    } else if (outputDragState.type === 'hook_resize') {
      const deltaX = xPct - outputDragState.startX;
      const deltaY = yPct - outputDragState.startY;
      const nextW = Math.round(Math.min(96, Math.max(40, outputDragState.initW + deltaX * 1.8)));
      const nextFont = Math.round(Math.min(54, Math.max(14, outputDragState.initFontSize + deltaY * 0.8)));
      onUpdateClip({
        hookStyle: {
          ...(clip.hookStyle || {}),
          maxWidthPct: nextW,
          fontSize: nextFont
        },
        _skipTelemetry: true
      });
    } else if (outputDragState.type === 'split_divider') {
      const rawSplit = Math.round(Math.min(80, Math.max(20, yPct)));
      const nextRatio = outputDragState.invertSplit ? 100 - rawSplit : rawSplit;
      onUpdateClip({
        layout: {
          ...clip.layout,
          splitRatio: nextRatio
        },
        _skipTelemetry: true
      });
    } else if (outputDragState.type === 'panel_pan') {
      const { targetKey, startX, startY, initReg } = outputDragState;
      const dx = (startX - xPct) * 0.45;
      const dy = (startY - yPct) * 0.45;
      const nextX = Math.round(Math.min(100 - initReg.w, Math.max(0, initReg.x + dx)));
      const nextY = Math.round(Math.min(100 - initReg.h, Math.max(0, initReg.y + dy)));
      onUpdateClip({
        layout: {
          ...clip.layout,
          [targetKey]: { ...initReg, x: nextX, y: nextY }
        },
        _skipTelemetry: true
      });
    } else if (outputDragState.type === 'panel_scale') {
      const { targetKey, startY, initReg } = outputDragState;
      const scaleFactor = Math.max(0.25, Math.min(2.5, 1 + (startY - yPct) * 0.02));
      const nextW = Math.round(Math.min(100, Math.max(10, initReg.w / scaleFactor)));
      const nextH = Math.round(Math.min(100, Math.max(10, initReg.h / scaleFactor)));
      const cx = initReg.x + initReg.w / 2;
      const cy = initReg.y + initReg.h / 2;
      const nextX = Math.round(Math.min(100 - nextW, Math.max(0, cx - nextW / 2)));
      const nextY = Math.round(Math.min(100 - nextH, Math.max(0, cy - nextH / 2)));
      onUpdateClip({
        layout: {
          ...clip.layout,
          [targetKey]: { x: nextX, y: nextY, w: nextW, h: nextH }
        },
        _skipTelemetry: true
      });
    } else if (outputDragState.type === 'pip_move') {
      const { initPip, offsetX, offsetY } = outputDragState;
      onUpdateClip({
        layout: {
          ...clip.layout,
          pipDest: {
            ...initPip,
            x: Math.round(Math.min(100 - initPip.w, Math.max(0, xPct - offsetX))),
            y: Math.round(Math.min(100 - initPip.h, Math.max(0, yPct - offsetY)))
          }
        },
        _skipTelemetry: true
      });
    } else if (outputDragState.type === 'pip_resize') {
      const { initPip, startX, startY } = outputDragState;
      const nextW = Math.round(Math.min(85, Math.max(15, initPip.w + (xPct - startX))));
      const nextH = Math.round(Math.min(85, Math.max(12, initPip.h + (yPct - startY))));
      onUpdateClip({
        layout: {
          ...clip.layout,
          pipDest: { ...initPip, w: nextW, h: nextH }
        },
        _skipTelemetry: true
      });
    } else if (outputDragState.type === 'main_pan') {
      const dx = (outputDragState.startX - xPct) * 0.7;
      const dy = (outputDragState.startY - yPct) * 0.7;
      onUpdateClip({
        layout: {
          ...clip.layout,
          activeSpeakerFocus: 'manual',
          manualPanX: Math.round(Math.min(100, Math.max(0, outputDragState.initPanX + dx))),
          manualPanY: Math.round(Math.min(100, Math.max(0, outputDragState.initPanY + dy)))
        },
        _skipTelemetry: true
      });
    }
  };

  const handleOutputMouseUp = () => {
    setOutputDragState(null);
  };

  // Direct Mouse Wheel on Output Canvas scales the hovered panel (Webcam or Gameplay or Overall Zoom)
  const handleOutputWheel = (e) => {
    if (!editBlocksOnScreen || !canvasRef.current || !clip || !onUpdateClip) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const layoutMode = clip.layout?.mode || 'gameplay_split';
    const splitRatio = Number(clip.layout?.splitRatio ?? 38);
    const invertSplit = Boolean(clip.layout?.invertSplit);
    const effectiveSplitY = invertSplit ? 100 - splitRatio : splitRatio;

    const delta = e.deltaY > 0 ? 1.07 : 0.93;

    if (layoutMode === 'gameplay_split' || layoutMode === 'split_vertical') {
      const targetKey =
        yPct < effectiveSplitY
          ? invertSplit
            ? 'cam2Region'
            : 'cam1Region'
          : invertSplit
          ? 'cam1Region'
          : 'cam2Region';
      const cur = clip.layout?.[targetKey] || { x: 2, y: 6, w: 28, h: 38 };
      const cx = cur.x + cur.w / 2;
      const cy = cur.y + cur.h / 2;
      const nextW = Math.round(Math.min(100, Math.max(10, cur.w * delta)));
      const nextH = Math.round(Math.min(100, Math.max(10, cur.h * delta)));
      const nextX = Math.round(Math.min(100 - nextW, Math.max(0, cx - nextW / 2)));
      const nextY = Math.round(Math.min(100 - nextH, Math.max(0, cy - nextH / 2)));
      onUpdateClip({
        layout: {
          ...clip.layout,
          [targetKey]: { x: nextX, y: nextY, w: nextW, h: nextH }
        },
        _skipTelemetry: true
      });
    } else {
      const curZoom = Number(clip.layout?.zoomLevel || 1.0);
      const nextZoom = Math.round(Math.min(2.8, Math.max(1.0, curZoom * (e.deltaY < 0 ? 1.06 : 0.94))) * 100) / 100;
      onUpdateClip({
        layout: { ...clip.layout, zoomLevel: nextZoom },
        _skipTelemetry: true
      });
    }
  };

  // ============================================================================
  // 2. DIRECT MOUSE INTERACTION ON THE 16:9 SOURCE MAP (Move & Resize 8 Handles!)
  // ============================================================================
  const detectSourceBoxHandle = (xPct, yPct, box) => {
    const tol = 3.8;
    const left = box.x;
    const right = box.x + box.w;
    const top = box.y;
    const bottom = box.y + box.h;

    if (Math.abs(xPct - left) <= tol && Math.abs(yPct - top) <= tol) return 'nw';
    if (Math.abs(xPct - right) <= tol && Math.abs(yPct - top) <= tol) return 'ne';
    if (Math.abs(xPct - left) <= tol && Math.abs(yPct - bottom) <= tol) return 'sw';
    if (Math.abs(xPct - right) <= tol && Math.abs(yPct - bottom) <= tol) return 'se';
    if (Math.abs(xPct - left) <= tol && yPct >= top && yPct <= bottom) return 'w';
    if (Math.abs(xPct - right) <= tol && yPct >= top && yPct <= bottom) return 'e';
    if (Math.abs(yPct - top) <= tol && xPct >= left && xPct <= right) return 'n';
    if (Math.abs(yPct - bottom) <= tol && xPct >= left && xPct <= right) return 's';
    if (xPct >= left && xPct <= right && yPct >= top && yPct <= bottom) return 'move';
    return null;
  };

  const handleSourceMapMouseDown = (e) => {
    if (!sourceMapCanvasRef.current || !clip || !onUpdateClip) return;
    const rect = sourceMapCanvasRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const cam1 = clip.layout?.cam1Region || { x: 2, y: 6, w: 28, h: 38 };
    const cam2 = clip.layout?.cam2Region || { x: 18, y: 0, w: 68, h: 100 };

    // Prioritize currently selected box first, then check the other box
    const firstKey = activeSourceBox === 'cam1' ? 'cam1Region' : 'cam2Region';
    const firstBox = activeSourceBox === 'cam1' ? cam1 : cam2;
    const secondKey = activeSourceBox === 'cam1' ? 'cam2Region' : 'cam1Region';
    const secondBox = activeSourceBox === 'cam1' ? cam2 : cam1;

    let hit = detectSourceBoxHandle(xPct, yPct, firstBox);
    let targetKey = firstKey;
    let initBox = { ...firstBox };

    if (!hit) {
      hit = detectSourceBoxHandle(xPct, yPct, secondBox);
      if (hit) {
        targetKey = secondKey;
        initBox = { ...secondBox };
        setActiveSourceBox(targetKey === 'cam1Region' ? 'cam1' : 'cam2');
      }
    }

    if (hit) {
      setSourceDragState({
        mode: hit,
        targetKey,
        startX: xPct,
        startY: yPct,
        initBox
      });
    } else {
      // Clicked empty space: recenter active box there
      const nextX = Math.round(Math.min(100 - firstBox.w, Math.max(0, xPct - firstBox.w / 2)));
      const nextY = Math.round(Math.min(100 - firstBox.h, Math.max(0, yPct - firstBox.h / 2)));
      onUpdateClip({
        layout: {
          ...clip.layout,
          [firstKey]: { ...firstBox, x: nextX, y: nextY }
        },
        _skipTelemetry: true
      });
      setSourceDragState({
        mode: 'move',
        targetKey: firstKey,
        startX: xPct,
        startY: yPct,
        initBox: { ...firstBox, x: nextX, y: nextY }
      });
    }
  };

  const handleSourceMapMouseMove = (e) => {
    if (!sourceMapCanvasRef.current || !clip) return;
    const rect = sourceMapCanvasRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    if (!sourceDragState) {
      const cam1 = clip.layout?.cam1Region || { x: 2, y: 6, w: 28, h: 38 };
      const cam2 = clip.layout?.cam2Region || { x: 18, y: 0, w: 68, h: 100 };
      const h =
        detectSourceBoxHandle(xPct, yPct, activeSourceBox === 'cam1' ? cam1 : cam2) ||
        detectSourceBoxHandle(xPct, yPct, activeSourceBox === 'cam1' ? cam2 : cam1);
      const cursorMap = {
        nw: 'nwse-resize',
        se: 'nwse-resize',
        ne: 'nesw-resize',
        sw: 'nesw-resize',
        n: 'ns-resize',
        s: 'ns-resize',
        e: 'ew-resize',
        w: 'ew-resize',
        move: 'move'
      };
      setSourceCursor(cursorMap[h] || 'crosshair');
      return;
    }

    if (!onUpdateClip) return;
    const { mode, targetKey, startX, startY, initBox } = sourceDragState;
    const dx = xPct - startX;
    const dy = yPct - startY;

    let { x, y, w, h } = initBox;

    if (mode === 'move') {
      x = Math.min(100 - w, Math.max(0, initBox.x + dx));
      y = Math.min(100 - h, Math.max(0, initBox.y + dy));
    } else {
      if (mode.includes('e')) {
        w = Math.min(100 - x, Math.max(8, initBox.w + dx));
      }
      if (mode.includes('s')) {
        h = Math.min(100 - y, Math.max(8, initBox.h + dy));
      }
      if (mode.includes('w')) {
        const maxLeftShift = initBox.w - 8;
        const shift = Math.min(maxLeftShift, Math.max(-initBox.x, dx));
        x = initBox.x + shift;
        w = initBox.w - shift;
      }
      if (mode.includes('n')) {
        const maxTopShift = initBox.h - 8;
        const shift = Math.min(maxTopShift, Math.max(-initBox.y, dy));
        y = initBox.y + shift;
        h = initBox.h - shift;
      }
    }

    onUpdateClip({
      layout: {
        ...clip.layout,
        [targetKey]: {
          x: Math.round(x),
          y: Math.round(y),
          w: Math.round(w),
          h: Math.round(h)
        }
      },
      _skipTelemetry: true
    });
  };

  const handleSourceMapMouseUp = () => {
    setSourceDragState(null);
  };

  // Mouse wheel on 16:9 Source Map scales the hovered/active box directly!
  const handleSourceMapWheel = (e) => {
    if (!sourceMapCanvasRef.current || !clip || !onUpdateClip) return;
    e.preventDefault();
    const targetKey = activeSourceBox === 'cam1' ? 'cam1Region' : 'cam2Region';
    const cur = clip.layout?.[targetKey] || { x: 2, y: 6, w: 28, h: 38 };
    const factor = e.deltaY > 0 ? 1.07 : 0.93;
    const cx = cur.x + cur.w / 2;
    const cy = cur.y + cur.h / 2;
    const nextW = Math.round(Math.min(100, Math.max(8, cur.w * factor)));
    const nextH = Math.round(Math.min(100, Math.max(8, cur.h * factor)));
    const nextX = Math.round(Math.min(100 - nextW, Math.max(0, cx - nextW / 2)));
    const nextY = Math.round(Math.min(100 - nextH, Math.max(0, cy - nextH / 2)));

    onUpdateClip({
      layout: {
        ...clip.layout,
        [targetKey]: { x: nextX, y: nextY, w: nextW, h: nextH }
      },
      _skipTelemetry: true
    });
  };

  // Record Full HD Canvas + Audio (clean final video without any editing handles/legends)
  const handleRecordCanvasPreview = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || isRecordingCanvas || isRecordingRef.current) return;

    try {
      isRecordingRef.current = true;
      setIsRecordingCanvas(true);
      video.pause();
      video.currentTime = startTime;
      setCurrentTime(startTime);

      // Wait briefly for video seek to settle before starting stream capture
      await new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            video.removeEventListener('seeked', finish);
            resolve();
          }
        };
        video.addEventListener('seeked', finish);
        setTimeout(finish, 300);
      });

      const canvasStream = canvas.captureStream(30);

      if (video.captureStream) {
        const vStream = video.captureStream();
        vStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
      }

      const chunks = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps Full HD High Quality
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = () => {
        isRecordingRef.current = false;
        recorderRef.current = null;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${clip.id}_fullhd.webm`;
          a.click();
        }
        setIsRecordingCanvas(false);
      };

      recorder.start(200);
      await video.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Canvas Recording error:', err);
      isRecordingRef.current = false;
      recorderRef.current = null;
      setIsRecordingCanvas(false);
    }
  };

  // Main 60FPS Full HD Studio Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clip) return;
    const ctx = canvas.getContext('2d');

    const renderFrame = () => {
      const video = videoRef.current;
      const nowTime = video && !video.paused ? video.currentTime : currentTime;

      if (video && !video.paused) {
        setCurrentTime(nowTime);
        if (onTimeUpdate) onTimeUpdate(nowTime);
        if (nowTime >= endTime) {
          if (isRecordingRef.current) {
            isRecordingRef.current = false;
            video.pause();
            setIsPlaying(false);
            if (recorderRef.current && recorderRef.current.state === 'recording') {
              recorderRef.current.stop();
            }
          } else {
            video.currentTime = startTime;
          }
        }
      }

      const showOnScreenGuides = editBlocksOnScreen && !isRecordingRef.current && !isRecordingCanvas;

      const { width: cw, height: ch } = getCanvasDimensions();
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      // Enable maximum Full HD bicubic interpolation quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.fillStyle = '#090b12';
      ctx.fillRect(0, 0, cw, ch);

      const activeSub = (clip.subtitles || []).find(
        (s) => nowTime >= Number(s.startTime) && nowTime <= Number(s.endTime)
      );
      const activeSpeakerId = activeSub?.speakerId || 'spk-1';

      const layoutMode = clip.layout?.mode || 'gameplay_split';
      const focusSetting = clip.layout?.activeSpeakerFocus || 'auto';
      const manualPanX = Number(clip.layout?.manualPanX ?? 50) / 100;
      const manualPanY = Number(clip.layout?.manualPanY ?? 50) / 100;
      const boxFitMode = clip.layout?.boxFitMode || 'cover';

      let targetCropCenter = manualPanX;
      if (layoutMode === 'auto_speaker') {
        if (focusSetting === 'spk-1') targetCropCenter = 0.27;
        else if (focusSetting === 'spk-2') targetCropCenter = 0.73;
        else if (focusSetting === 'manual') targetCropCenter = manualPanX;
        else targetCropCenter = activeSpeakerId === 'spk-2' ? 0.73 : 0.27;
      }

      const smoothing =
        layoutMode === 'manual_crop' || focusSetting === 'manual'
          ? 0.2
          : Math.min(0.98, Math.max(0.1, Number(clip.layout?.smoothingFactor) || 0.85));
      smoothedCropXRef.current =
        smoothedCropXRef.current * smoothing + targetCropCenter * (1 - smoothing);

      const br = Math.round((Number(clip.avTreatment?.brightness) || 1.0) * 100);
      const ct = Math.round((Number(clip.avTreatment?.contrast) || 1.08) * 100);
      const sat = Math.round((Number(clip.avTreatment?.saturation) || 1.12) * 100);
      const preset = clip.avTreatment?.filterPreset || 'viral_punch';
      let extraFilter = '';
      if (preset === 'bw_dramatic') extraFilter = ' grayscale(100%) contrast(120%)';
      if (preset === 'podcast_warm') extraFilter = ' sepia(14%) saturate(120%)';
      if (preset === 'cinema_teal') extraFilter = ' hue-rotate(-8deg) contrast(112%)';

      ctx.save();
      ctx.filter = `brightness(${br}%) contrast(${ct}%) saturate(${sat}%)${extraFilter}`;

      const hasVideoFrame = video && video.readyState >= 2 && video.videoWidth > 0;
      const vw = hasVideoFrame ? video.videoWidth : 1280;
      const vh = hasVideoFrame ? video.videoHeight : 720;
      const zoom = Math.max(1.0, Number(clip.layout?.zoomLevel) || 1.0);

      /**
       * High-Definition Aspect-Preserving Region Renderer:
       * Guarantees that resizing the Webcam box or Gameplay box NEVER stretches, squishes, or blurs the video!
       */
      const drawSourceRegionPreserveQuality = (sx, sy, sw, sh, dx, dy, dw, dh, fit = boxFitMode) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(dx, dy, dw, dh);
        ctx.clip();

        if (!hasVideoFrame) {
          const grad = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh);
          grad.addColorStop(0, '#0f172a');
          grad.addColorStop(1, '#1e1b4b');
          ctx.fillStyle = grad;
          ctx.fillRect(dx, dy, dw, dh);
          ctx.restore();
          return;
        }

        const safeSW = Math.max(16, Math.min(vw, sw));
        const safeSH = Math.max(16, Math.min(vh, sh));
        const centerX = Math.max(safeSW / 2, Math.min(vw - safeSW / 2, sx + safeSW / 2));
        const centerY = Math.max(safeSH / 2, Math.min(vh - safeSH / 2, sy + safeSH / 2));

        const destAspect = dw / Math.max(1, dh);
        const srcAspect = safeSW / Math.max(1, safeSH);

        if (fit === 'contain') {
          // Fits the exact selected box inside (dx, dy, dw, dh) with 1:1 native pixel aspect ratio
          ctx.fillStyle = '#06080e';
          ctx.fillRect(dx, dy, dw, dh);

          let drawW = dw;
          let drawH = dh;
          if (srcAspect > destAspect) {
            drawH = dw / srcAspect;
          } else {
            drawW = dh * srcAspect;
          }
          const offsetX = dx + (dw - drawW) / 2;
          const offsetY = dy + (dh - drawH) / 2;
          const finalSX = Math.max(0, Math.min(vw - safeSW, centerX - safeSW / 2));
          const finalSY = Math.max(0, Math.min(vh - safeSH, centerY - safeSH / 2));

          ctx.drawImage(video, finalSX, finalSY, safeSW, safeSH, offsetX, offsetY, drawW, drawH);
        } else {
          // 'cover' (Default HD): Matches the sampling window to destAspect around (centerX, centerY)
          // so the panel is 100% filled at native pixel aspect ratio without stretching a single pixel!
          let sampleW = safeSW;
          let sampleH = safeSH;
          if (srcAspect > destAspect) {
            sampleW = safeSH * destAspect;
          } else {
            sampleH = safeSW / destAspect;
          }
          sampleW = Math.min(vw, Math.max(16, sampleW));
          sampleH = Math.min(vh, Math.max(16, sampleH));

          const finalSX = Math.max(0, Math.min(vw - sampleW, centerX - sampleW / 2));
          const finalSY = Math.max(0, Math.min(vh - sampleH, centerY - sampleH / 2));

          ctx.drawImage(video, finalSX, finalSY, sampleW, sampleH, dx, dy, dw, dh);
        }

        ctx.restore();
      };

      const isDemoVideo = project?.videoFileName === 'demo_podcast.mp4';
      const cam1 = clip.layout?.cam1Region || { x: 2, y: 6, w: 28, h: 38 };
      const cam2 = clip.layout?.cam2Region || { x: 18, y: 0, w: 68, h: 100 };
      const splitRatio = Math.min(80, Math.max(20, Number(clip.layout?.splitRatio) || 38));
      const invertSplit = Boolean(clip.layout?.invertSplit);

      if (layoutMode === 'gameplay_split' || layoutMode === 'split_vertical') {
        const firstH = Math.round(ch * (splitRatio / 100));
        const secondH = ch - firstH;

        const topReg = invertSplit ? cam2 : cam1;
        const botReg = invertSplit ? cam1 : cam2;
        const topH = invertSplit ? secondH : firstH;
        const botH = invertSplit ? firstH : secondH;

        drawSourceRegionPreserveQuality(
          (topReg.x / 100) * vw,
          (topReg.y / 100) * vh,
          (topReg.w / 100) * vw,
          (topReg.h / 100) * vh,
          0,
          0,
          cw,
          topH
        );

        drawSourceRegionPreserveQuality(
          (botReg.x / 100) * vw,
          (botReg.y / 100) * vh,
          (botReg.w / 100) * vw,
          (botReg.h / 100) * vh,
          0,
          topH,
          cw,
          botH
        );

        if (isDemoVideo) {
          drawAvatarBadge(
            ctx,
            cw * 0.5,
            invertSplit ? topH + botH * 0.42 : topH * 0.45,
            'WEBCAM STREAMER',
            '#06b6d4',
            true,
            nowTime,
            1.4
          );
          drawGameplayOverlayDemo(
            ctx,
            0,
            invertSplit ? 0 : topH,
            cw,
            invertSplit ? topH : botH,
            nowTime
          );
        }

        // Interactive Split Line only when showOnScreenGuides is active (never on final video)
        // Note: "ESCALA TOPO" and "ESCALA BASE" text legends are never drawn on the video canvas
        if (showOnScreenGuides) {
          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(0, topH - 3, cw, 6);

          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.roundRect(cw / 2 - 70, topH - 16, 140, 32, 16);
          ctx.fill();
          ctx.fillStyle = '#020617';
          ctx.font = '900 18px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⇅ DIVISÃO', cw / 2, topH);
        }
      } else if (layoutMode === 'cinema_blur') {
        ctx.save();
        ctx.filter = `blur(24px) brightness(55%)`;
        drawSourceRegionPreserveQuality(0, 0, vw, vh, -20, -20, cw + 40, ch + 40, 'cover');
        ctx.restore();

        const fgH = Math.round((cw * (9 / 16)) * zoom);
        const fgW = Math.round(cw * zoom);
        const fgX = Math.round((cw - fgW) * manualPanX);
        const fgY = Math.round((ch - fgH) * manualPanY);
        drawSourceRegionPreserveQuality(0, 0, vw, vh, fgX, fgY, fgW, fgH, 'contain');
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.65)';
        ctx.lineWidth = 4;
        ctx.strokeRect(fgX, fgY, fgW, fgH);
      } else if (layoutMode === 'gameplay_broll') {
        const topH = Math.round(ch * (splitRatio / 100));
        const bottomH = ch - topH;
        const cropW = Math.min(vw, (vh * (cw / topH)) / zoom);
        const maxSX = Math.max(0, vw - cropW);
        const sx = Math.min(maxSX, Math.max(0, smoothedCropXRef.current * vw - cropW / 2));
        drawSourceRegionPreserveQuality(sx, 0, cropW, vh, 0, 0, cw, topH, 'cover');
        drawDynamicBRoll(ctx, 0, topH, cw, bottomH, clip.layout?.brollPreset || 'tech_matrix', nowTime);
      } else if (layoutMode === 'pip') {
        drawSourceRegionPreserveQuality(
          (cam2.x / 100) * vw,
          (cam2.y / 100) * vh,
          (cam2.w / 100) * vw,
          (cam2.h / 100) * vh,
          0,
          0,
          cw,
          ch,
          boxFitMode
        );

        const pip = clip.layout?.pipDest || { x: 60, y: 12, w: 34, h: 28 };
        const pipX = Math.round((pip.x / 100) * cw);
        const pipY = Math.round((pip.y / 100) * ch);
        const pipW = Math.round((pip.w / 100) * cw);
        const pipH = Math.round((pip.h / 100) * ch);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pipX, pipY, pipW, pipH, 28);
        ctx.clip();
        drawSourceRegionPreserveQuality(
          (cam1.x / 100) * vw,
          (cam1.y / 100) * vh,
          (cam1.w / 100) * vw,
          (cam1.h / 100) * vh,
          pipX,
          pipY,
          pipW,
          pipH,
          'cover'
        );
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.restore();

        if (showOnScreenGuides) {
          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(pipX + pipW - 24, pipY + pipH - 24, 24, 24);
        }
      } else {
        const targetAspect = cw / ch;
        const cropW = Math.min(vw, (vh * targetAspect) / zoom);
        const cropH = vh / zoom;
        const maxSX = Math.max(0, vw - cropW);
        const maxSY = Math.max(0, vh - cropH);
        const sx = Math.min(maxSX, Math.max(0, smoothedCropXRef.current * vw - cropW / 2));
        const sy = Math.min(maxSY, Math.max(0, manualPanY * maxSY));

        drawSourceRegionPreserveQuality(sx, sy, cropW, cropH, 0, 0, cw, ch, 'cover');
      }

      ctx.restore();

      const vig = ctx.createLinearGradient(0, 0, 0, ch);
      vig.addColorStop(0, 'rgba(0,0,0,0.45)');
      vig.addColorStop(0.22, 'rgba(0,0,0,0.0)');
      vig.addColorStop(0.65, 'rgba(0,0,0,0.05)');
      vig.addColorStop(1, 'rgba(0,0,0,0.72)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, cw, ch);

      if (showVisionHud && !isRecordingRef.current && !isRecordingCanvas) {
        drawComputerVisionHud(ctx, cw, ch, smoothedCropXRef.current, activeSpeakerId, smoothing);
      }

      if (clip.showHookBanner && clip.hookBannerText) {
        const elapsedInClip = Math.max(0, nowTime - startTime);
        const hookDuration = Number(clip.hookStyle?.durationSec ?? 0);
        const isWithinHookTime = hookDuration <= 0 || elapsedInClip <= hookDuration;
        if (isWithinHookTime) {
          let hookFadeAlpha = 1.0;
          if (hookDuration > 0 && elapsedInClip > hookDuration - 0.35) {
            hookFadeAlpha = Math.max(0, (hookDuration - elapsedInClip) / 0.35);
          }
          drawCustomHookBanner(
            ctx,
            cw,
            ch,
            clip.hookBannerText,
            clip.hookStyle,
            showOnScreenGuides,
            hookFadeAlpha
          );
        }
      }

      if (clip.avTreatment?.watermarkText) {
        ctx.save();
        ctx.font = `700 ${Math.round(cw * 0.025)}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.textAlign = 'right';
        ctx.fillText(clip.avTreatment.watermarkText, cw - 28, ch - 36);
        ctx.restore();
      }

      if (showOnScreenGuides) {
        drawSubtitleLocationBlockFrame(ctx, cw, ch, clip.captionStyle);
      }

      if (activeSub) {
        drawDynamicSubtitlesInBlock(ctx, cw, ch, activeSub, nowTime, clip.captionStyle);
      }

      if (clip.avTreatment?.showProgressBar !== false) {
        const progress = Math.min(1, Math.max(0, (nowTime - startTime) / clipDuration));
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(0, ch - 12, cw, 12);
        ctx.fillStyle = clip.avTreatment?.progressBarColor || '#06B6D4';
        ctx.fillRect(0, ch - 12, cw * progress, 12);
      }

      if (showSourceRegionMap && sourceMapCanvasRef.current) {
        renderSourceRegionMapCanvas(sourceMapCanvasRef.current, video, hasVideoFrame, cam1, cam2, activeSourceBox);
      }

      animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    clip,
    currentTime,
    startTime,
    endTime,
    clipDuration,
    showVisionHud,
    editBlocksOnScreen,
    isRecordingCanvas,
    showSourceRegionMap,
    activeSourceBox,
    getCanvasDimensions,
    onTimeUpdate,
    project?.videoFileName
  ]);

  const dims = getCanvasDimensions();
  const isSplitMode =
    (clip?.layout?.mode || 'gameplay_split') === 'gameplay_split' ||
    clip?.layout?.mode === 'split_vertical';

  return (
    <div className="flex flex-col items-center w-full">
      <video
        ref={videoRef}
        key={project?.sourceUrl}
        src={project?.sourceUrl || '/uploads/videos/demo_podcast.mp4'}
        className="hidden"
        muted={isMuted || volume === 0}
        playsInline
        crossOrigin="anonymous"
      />

      {/* Top Interactive Controls Bar above Canvas */}
      <div className="w-full flex flex-wrap items-center justify-between gap-1.5 mb-2.5 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
            {dims.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditBlocksOnScreen(!editBlocksOnScreen)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition border ${
              editBlocksOnScreen
                ? 'bg-amber-500/25 text-amber-200 border-amber-400 shadow'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            {editBlocksOnScreen ? 'Guias de Edição: ON' : 'Guias de Edição: OFF'}
          </button>

          <button
            type="button"
            onClick={() => setShowSourceRegionMap(!showSourceRegionMap)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition border ${
              showSourceRegionMap
                ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400 shadow'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            {showSourceRegionMap ? 'Mapa 16:9: ON' : 'Mapa 16:9'}
          </button>
        </div>
      </div>

      {/* External Topo & Base Scale Controls (HTML UI outside the video so no legend is ever drawn on the video) */}
      {isSplitMode && (
        <div className="w-full mb-2.5 px-2.5 py-1.5 rounded-xl bg-studio-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-cyan-300">Zoom Topo:</span>
            <button
              type="button"
              onClick={() => adjustPanelScaleStep('top', 0.92)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-slate-700 flex items-center gap-0.5 font-bold"
              title="Aproximar (Zoom In) câmera do topo"
            >
              <ZoomIn className="w-3 h-3" /> +
            </button>
            <button
              type="button"
              onClick={() => adjustPanelScaleStep('top', 1.08)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-slate-700 flex items-center gap-0.5 font-bold"
              title="Afastar (Zoom Out) câmera do topo"
            >
              <ZoomOut className="w-3 h-3" /> -
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-emerald-300">Zoom Base:</span>
            <button
              type="button"
              onClick={() => adjustPanelScaleStep('bottom', 0.92)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-200 border border-slate-700 flex items-center gap-0.5 font-bold"
              title="Aproximar (Zoom In) área da base"
            >
              <ZoomIn className="w-3 h-3" /> +
            </button>
            <button
              type="button"
              onClick={() => adjustPanelScaleStep('bottom', 1.08)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-200 border border-slate-700 flex items-center gap-0.5 font-bold"
              title="Afastar (Zoom Out) área da base"
            >
              <ZoomOut className="w-3 h-3" /> -
            </button>
          </div>
        </div>
      )}

      {/* Interactive 16:9 Source Region Picker with Direct Corner/Edge Resize Handles & Mouse Wheel Zoom */}
      {showSourceRegionMap && (
        <div className="w-full mb-3 p-3 rounded-xl bg-studio-950 border border-cyan-500/40 space-y-2 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-cyan-300">
              🎯 Arraste o centro para MOVER ou puxe os quadrados nos cantos (■) / Roda do Mouse para REDIMENSIONAR:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveSourceBox('cam1')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${
                  activeSourceBox === 'cam1'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                    : 'bg-slate-800 text-cyan-300 border-slate-700'
                }`}
              >
                1. Caixa Webcam (Ciano)
              </button>
              <button
                type="button"
                onClick={() => setActiveSourceBox('cam2')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${
                  activeSourceBox === 'cam2'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                    : 'bg-slate-800 text-emerald-300 border-slate-700'
                }`}
              >
                2. Caixa Jogo/Conteúdo (Verde)
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <canvas
              ref={sourceMapCanvasRef}
              width={960}
              height={540}
              style={{ cursor: sourceCursor }}
              onMouseDown={handleSourceMapMouseDown}
              onMouseMove={handleSourceMapMouseMove}
              onMouseUp={handleSourceMapMouseUp}
              onMouseLeave={handleSourceMapMouseUp}
              onWheel={handleSourceMapWheel}
              className="w-full max-w-[440px] h-auto rounded-lg border border-slate-700 shadow-lg select-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[10px]">
            <span className="text-slate-400 font-semibold">Qualidade do Redimensionamento:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateClip &&
                  onUpdateClip({
                    layout: { ...clip.layout, boxFitMode: 'cover' }
                  })
                }
                className={`px-2 py-0.5 rounded font-bold border ${
                  (clip?.layout?.boxFitMode || 'cover') === 'cover'
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                ✓ Preencher HD Sem Distorcer (1:1)
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateClip &&
                  onUpdateClip({
                    layout: { ...clip.layout, boxFitMode: 'contain' }
                  })
                }
                className={`px-2 py-0.5 rounded font-bold border ${
                  clip?.layout?.boxFitMode === 'contain'
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                Conter Caixa Inteira (Sem Cortar)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Responsive Full HD Output Canvas Viewport */}
      <div className="relative flex items-center justify-center bg-[#050609] rounded-2xl p-3 border border-slate-800/90 shadow-2xl w-full max-w-[440px]">
        <canvas
          ref={canvasRef}
          onMouseDown={handleOutputMouseDown}
          onMouseMove={handleOutputMouseMove}
          onMouseUp={handleOutputMouseUp}
          onMouseLeave={handleOutputMouseUp}
          onWheel={handleOutputWheel}
          className={`rounded-xl shadow-2xl max-h-[530px] w-auto h-auto object-contain border border-slate-800 select-none ${
            editBlocksOnScreen ? 'cursor-move ring-1 ring-amber-400/50' : 'cursor-pointer'
          }`}
        />

        {!isPlaying && !editBlocksOnScreen && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white flex items-center justify-center shadow-xl transition transform hover:scale-105"
            title="Reproduzir Corte"
          >
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </button>
        )}
      </div>

      {editBlocksOnScreen && (
        <div className="w-full mt-2 px-3 py-1.5 rounded-lg bg-studio-950 border border-slate-800 text-[10px] text-slate-300 text-center">
          💡 <strong>Dica:</strong> Arraste a <strong>Legenda</strong>, o <strong>Hook</strong>, a <strong>Linha de Divisão (⇅)</strong> ou use a <strong>Roda do Mouse</strong> direto no vídeo acima! (As guias não aparecem no vídeo final).
        </div>
      )}

      {/* Transport, Timeline Scrubber & Volume Regulation Controls */}
      <div className="w-full mt-2.5 bg-studio-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={togglePlay}
            className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition"
            title={isPlaying ? 'Pausar' : 'Reproduzir'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            type="button"
            onClick={restartClip}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title="Voltar ao início do corte"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="flex-1 flex flex-col">
            <input
              type="range"
              min={startTime}
              max={endTime}
              step={0.05}
              value={Math.min(endTime, Math.max(startTime, currentTime))}
              onChange={handleSeek}
              className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-1">
              <span>Início: {startTime.toFixed(1)}s</span>
              <span className="text-violet-300 font-bold">Atual: {currentTime.toFixed(1)}s</span>
              <span>Fim: {endTime.toFixed(1)}s ({clipDuration.toFixed(1)}s)</span>
            </div>
          </div>
        </div>

        {/* Dedicated Volume Regulation Bar during Editing */}
        <div className="flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg bg-studio-950 border border-slate-800">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition shrink-0"
            title={isMuted || volume === 0 ? 'Ativar som' : 'Silenciar áudio'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : volume < 50 ? (
              <Volume1 className="w-4 h-4 text-amber-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>Volume</span>
          </button>

          <button
            type="button"
            onClick={() => handleVolumeChange(Math.max(0, volume - 10))}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700"
            title="Diminuir volume (-10%)"
          >
            -
          </button>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="flex-1 accent-emerald-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            title="Regular volume do áudio durante a edição e exportação"
          />

          <button
            type="button"
            onClick={() => handleVolumeChange(Math.min(100, volume + 10))}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700"
            title="Aumentar volume (+10%)"
          >
            +
          </button>

          <span className="text-[11px] font-mono font-bold text-emerald-300 w-10 text-right shrink-0">
            {isMuted ? '0%' : `${volume}%`}
          </span>
        </div>

        {/* Direct Export Actions Bar */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => onTriggerFFmpegRender && onTriggerFFmpegRender()}
            disabled={isRenderingFFmpeg}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition"
          >
            {isRenderingFFmpeg ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Renderizando MP4 HD...
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                Renderizar MP4 (FFmpeg HD)
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRecordCanvasPreview}
            disabled={isRecordingCanvas}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-700 text-xs font-semibold transition"
          >
            {isRecordingCanvas ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                Gravando Full HD...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-emerald-400" />
                Capturar Vídeo c/ Legendas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the 960x540 HD 16:9 Source Map showing the full source video + 8 Resize Handles on both Webcam (cam1) and Gameplay (cam2) boxes!
 */
function renderSourceRegionMapCanvas(mapCanvas, video, hasVideoFrame, cam1, cam2, activeBox) {
  const ctx = mapCanvas.getContext('2d');
  const mw = mapCanvas.width;
  const mh = mapCanvas.height;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, mw, mh);

  if (hasVideoFrame) {
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, mw, mh);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fillRect(0, 0, mw, mh);

  const drawInteractiveBox = (box, color, fillRgba, title, isFocused) => {
    const bx = (box.x / 100) * mw;
    const by = (box.y / 100) * mh;
    const bw = (box.w / 100) * mw;
    const bh = (box.h / 100) * mh;

    ctx.fillStyle = fillRgba;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = color;
    ctx.lineWidth = isFocused ? 4 : 2.5;
    ctx.strokeRect(bx, by, bw, bh);

    // Label pill
    ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
    ctx.fillRect(bx + 6, Math.max(6, by + 6), Math.min(bw - 12, 270), 26);
    ctx.fillStyle = color;
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${title} (${box.w}%×${box.h}%)`, bx + 12, Math.max(19, by + 19));

    // 8 Resize Handles (Corners + Mid-Edges)
    const handlePts = [
      [bx, by],
      [bx + bw / 2, by],
      [bx + bw, by],
      [bx + bw, by + bh / 2],
      [bx + bw, by + bh],
      [bx + bw / 2, by + bh],
      [bx, by + bh],
      [bx, by + bh / 2]
    ];
    const hs = isFocused ? 14 : 10;
    handlePts.forEach(([hx, hy]) => {
      ctx.fillStyle = color;
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    });
  };

  drawInteractiveBox(
    cam2,
    '#10b981',
    'rgba(16, 185, 129, 0.16)',
    '2. JOGO / CONTEÚDO',
    activeBox === 'cam2'
  );
  drawInteractiveBox(
    cam1,
    '#06b6d4',
    'rgba(6, 182, 212, 0.22)',
    '1. WEBCAM',
    activeBox === 'cam1'
  );
}

function drawAvatarBadge(ctx, cx, cy, label, color, isSpeaking, time, scale = 1.0) {
  ctx.save();
  const r = 52 * scale;
  const pulse = isSpeaking ? 1 + 0.08 * Math.sin(time * 14) : 1;

  if (isSpeaking) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * pulse + 10, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy - 12 * scale, 24 * scale, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(cx - 42 * scale, cy + 16 * scale, 84 * scale, 40 * scale, 18 * scale);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = `800 ${Math.round(14 * scale)}px Inter, sans-serif`;
  const textW = ctx.measureText(label).width + 24;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(cx - textW / 2, cy + 62 * scale, textW, 26 * scale, 8);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 75 * scale);
  ctx.restore();
}

function drawGameplayOverlayDemo(ctx, x, y, w, h, time) {
  ctx.save();
  const cx = x + w / 2 + Math.sin(time * 1.8) * 60;
  const cy = y + h / 2 + Math.cos(time * 1.3) * 40;
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = '800 20px monospace';
  ctx.fillStyle = '#10b981';
  ctx.textAlign = 'left';
  ctx.fillText('🎮 ÁREA DE GAMEPLAY / TELA PRINCIPAL (FULL HD)', x + 28, y + 42);
  ctx.restore();
}

function drawDynamicBRoll(ctx, x, y, w, h, preset, time) {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#09192f');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const bars = 18;
  const barW = (w - 120) / bars;
  for (let i = 0; i < bars; i++) {
    const bh = 40 + Math.abs(Math.sin(time * 3.5 + i * 0.6)) * (h * 0.55);
    const bx = x + 60 + i * barW;
    const by = y + h - bh - 40;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.65)' : 'rgba(168, 85, 247, 0.65)';
    ctx.beginPath();
    ctx.roundRect(bx, by, barW - 10, bh, 6);
    ctx.fill();
  }
  ctx.restore();
}

function drawCustomHookBanner(ctx, cw, ch, rawText, hookStyle = {}, showHandle = false, fadeAlpha = 1.0) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, Number(fadeAlpha) ?? 1.0));
  const hs = {
    fontFamily: hookStyle?.fontFamily || 'Montserrat',
    fontSize: Number(hookStyle?.fontSize) || 24,
    textColor: hookStyle?.textColor || '#FFFFFF',
    bgColor1: hookStyle?.bgColor1 || '#0891B2',
    bgColor2: hookStyle?.bgColor2 || '#1D4ED8',
    bgOpacity: Number(hookStyle?.bgOpacity ?? 0.95),
    borderColor: hookStyle?.borderColor || '#38BDF8',
    borderWidth: Number(hookStyle?.borderWidth ?? 2),
    borderRadius: Number(hookStyle?.borderRadius ?? 14),
    positionX: Number(hookStyle?.positionX ?? 50),
    positionY: Number(hookStyle?.positionY ?? 8),
    maxWidthPct: Number(hookStyle?.maxWidthPct ?? 88),
    uppercase: hookStyle?.uppercase !== false
  };

  const text = hs.uppercase ? (rawText || '').toUpperCase() : (rawText || '');
  const scaledFontSize = Math.round((hs.fontSize / 540) * cw);
  ctx.font = `900 ${scaledFontSize}px "${hs.fontFamily}", Montserrat, sans-serif`;

  const maxW = cw * (hs.maxWidthPct / 100) - 48;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxW && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);

  const lineH = scaledFontSize * 1.25;
  const boxH = lines.length * lineH + 36;
  const widestLine = Math.max(...lines.map((l) => ctx.measureText(l).width), 140);
  const boxW = Math.min(cw * (hs.maxWidthPct / 100), widestLine + 56);

  const centerX = (cw * hs.positionX) / 100;
  const centerY = (ch * hs.positionY) / 100;
  const boxX = Math.max(12, Math.min(cw - boxW - 12, centerX - boxW / 2));
  const boxY = Math.max(12, Math.min(ch - boxH - 12, centerY - boxH / 2));

  if (hs.bgOpacity > 0.02) {
    const grad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
    grad.addColorStop(0, hexToRgba(hs.bgColor1, hs.bgOpacity));
    grad.addColorStop(1, hexToRgba(hs.bgColor2, hs.bgOpacity));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, hs.borderRadius * 1.8);
    ctx.fill();
  }

  if (hs.borderWidth > 0) {
    ctx.strokeStyle = hs.borderColor;
    ctx.lineWidth = hs.borderWidth * 1.8;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, hs.borderRadius * 1.8);
    ctx.stroke();
  }

  if (showHandle) {
    ctx.strokeStyle = '#facc15';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX - 6, boxY - 6, boxW + 12, boxH + 12);
    ctx.setLineDash([]);
    // Resize handle on right side of Hook
    ctx.fillStyle = '#facc15';
    ctx.fillRect(boxX + boxW - 10, boxY + boxH / 2 - 14, 28, 28);
  }

  ctx.fillStyle = hs.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 10;

  lines.forEach((line, idx) => {
    const ly = boxY + 20 + idx * lineH + lineH / 2 - 2;
    ctx.fillText(line, boxX + boxW / 2, ly, boxW - 28);
  });

  ctx.restore();
}

function drawSubtitleLocationBlockFrame(ctx, cw, ch, style = {}) {
  ctx.save();
  const posX = Number(style.positionX ?? 50);
  const posY = Number(style.positionY ?? 74);
  const boxWPct = Math.min(96, Math.max(35, Number(style.boxWidthPct ?? 86)));
  const boxHPct = Math.min(45, Math.max(10, Number(style.boxHeightPct ?? 18)));

  const boxW = cw * (boxWPct / 100);
  const boxH = ch * (boxHPct / 100);
  const centerX = cw * (posX / 100);
  const centerY = ch * (posY / 100);
  const boxX = Math.max(10, Math.min(cw - boxW - 10, centerX - boxW / 2));
  const boxY = Math.max(10, Math.min(ch - boxH - 10, centerY - boxH / 2));

  ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(boxX, boxY, boxW, boxH);
  ctx.setLineDash([]);

  // Bottom-Right interactive resize handle square
  ctx.fillStyle = '#facc15';
  ctx.fillRect(boxX + boxW - 18, boxY + boxH - 18, 36, 36);
  ctx.fillStyle = '#020617';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⤡', boxX + boxW, boxY + boxH);

  ctx.font = '700 18px monospace';
  ctx.fillStyle = '#facc15';
  ctx.textAlign = 'left';
  ctx.fillText(
    `BLOCO LEGENDA (${boxWPct}% LARG • ARRASTE P/ MOVER OU ⤡ P/ ESCALA)`,
    boxX + 10,
    Math.max(24, boxY - 12)
  );
  ctx.restore();
}

function drawDynamicSubtitlesInBlock(ctx, cw, ch, subtitle, nowTime, style = {}) {
  ctx.save();

  const fontFamily = style.fontFamily || 'Montserrat';
  const rawFontSize = Math.min(110, Math.max(14, Number(style.fontSize) || 42));
  const baseFontSize = Math.round((rawFontSize / 540) * cw);

  const posXPercent = Number(style.positionX ?? 50);
  const posYPercent = Number(style.positionY ?? 74);
  const boxWPct = Math.min(96, Math.max(35, Number(style.boxWidthPct ?? 86)));
  const maxBlockWidth = cw * (boxWPct / 100) - 28;

  const blockCenterX = Math.max(
    maxBlockWidth / 2 + 14,
    Math.min(cw - maxBlockWidth / 2 - 14, (cw * posXPercent) / 100)
  );
  const centerY = (ch * posYPercent) / 100;

  const wordsPerLine = Math.max(1, Number(style.wordsPerLine) || 3);
  const isUppercase = style.uppercase !== false;
  const animation = style.animation || 'hormozi_karaoke';
  const autoFitMargin = style.autoFitMargin !== false;

  const subStart = Number(subtitle.startTime) || 0;
  const subEnd = Math.max(subStart + 0.25, Number(subtitle.endTime) || subStart + 1.5);
  const rawWordsList = (subtitle.text || '').split(/\s+/).filter(Boolean);
  const existingWords = Array.isArray(subtitle.words) && subtitle.words.length > 0 ? subtitle.words : [];
  const firstWStart = Number(existingWords[0]?.start);
  const lastWEnd = Number(existingWords[existingWords.length - 1]?.end);
  const needsWordRetiming =
    existingWords.length === 0 ||
    isNaN(firstWStart) ||
    isNaN(lastWEnd) ||
    firstWStart < subStart - 0.2 ||
    lastWEnd > subEnd + 0.2 ||
    firstWStart >= subEnd ||
    lastWEnd <= subStart;

  const words = needsWordRetiming
    ? (existingWords.length > 0 ? existingWords : rawWordsList.map((w) => ({ word: w }))).map((item, idx, arr) => {
        const dur = Math.max(0.25, subEnd - subStart);
        const step = dur / Math.max(1, arr.length);
        return {
          word: item.word || rawWordsList[idx] || '',
          start: subStart + idx * step,
          end: subStart + (idx + 1) * step,
          highlight: Boolean(item.highlight),
          color: item.color
        };
      })
    : existingWords;

  const pageChunkSize = Math.max(2, wordsPerLine * 2);
  const pages = [];
  for (let i = 0; i < words.length; i += pageChunkSize) {
    pages.push(words.slice(i, i + pageChunkSize));
  }

  let activePage = pages[0] || [];
  for (const page of pages) {
    const pageStart = page[0]?.start ?? subtitle.startTime;
    const pageEnd = page[page.length - 1]?.end ?? subtitle.endTime;
    if (nowTime >= pageStart && nowTime <= pageEnd + 0.15) {
      activePage = page;
      break;
    }
  }

  ctx.font = `900 ${baseFontSize}px "${fontFamily}", Montserrat, sans-serif`;
  const spaceW = ctx.measureText(' ').width * 1.12;

  const lines = [];
  let currentLine = [];
  let currentLineWidth = 0;

  activePage.forEach((wObj) => {
    const displayWord = isUppercase ? (wObj.word || '').toUpperCase() : (wObj.word || '');
    const wordW = ctx.measureText(displayWord).width;
    const projectedW = currentLine.length === 0 ? wordW : currentLineWidth + spaceW + wordW;

    if (
      currentLine.length > 0 &&
      (currentLine.length >= wordsPerLine || projectedW > maxBlockWidth * 0.94)
    ) {
      lines.push(currentLine);
      currentLine = [wObj];
      currentLineWidth = wordW;
    } else {
      currentLine.push(wObj);
      currentLineWidth = projectedW;
    }
  });
  if (currentLine.length > 0) lines.push(currentLine);

  const lineH = baseFontSize * 1.24;

  // Only show speaker badge if user explicitly enabled showSpeakerBadge AND speakerName is non-empty
  if (style.showSpeakerBadge === true && subtitle.speakerName && subtitle.speakerName.trim()) {
    ctx.font = `700 ${Math.round(cw * 0.023)}px Inter, sans-serif`;
    const spkLabel = subtitle.speakerName.toUpperCase();
    const badgeW = Math.min(maxBlockWidth, ctx.measureText(spkLabel).width + 32);
    const badgeX = blockCenterX - badgeW / 2;
    const badgeY = centerY - (lines.length * lineH) / 2 - 48;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, 38, 18);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spkLabel, blockCenterX, badgeY + 19, badgeW - 14);
  }

  ctx.font = `900 ${baseFontSize}px "${fontFamily}", Montserrat, sans-serif`;
  ctx.textBaseline = 'middle';

  if (style.backgroundBox) {
    const rawMaxLineW = Math.max(
      ...lines.map((line) =>
        line.reduce(
          (acc, w) => acc + ctx.measureText((isUppercase ? w.word.toUpperCase() : w.word) + ' ').width,
          0
        )
      ),
      140
    );
    const boxW = Math.min(maxBlockWidth + 24, rawMaxLineW + 44);
    const boxH = lines.length * lineH + 32;
    ctx.fillStyle = hexToRgba(style.backgroundColor || '#000000', Number(style.backgroundOpacity) || 0.72);
    ctx.beginPath();
    ctx.roundRect(blockCenterX - boxW / 2, centerY - boxH / 2, boxW, boxH, 22);
    ctx.fill();
  }

  lines.forEach((lineWords, lineIdx) => {
    const yOffset = centerY + (lineIdx - (lines.length - 1) / 2) * lineH;

    const wordMetrics = lineWords.map((wObj) => {
      const displayWord = isUppercase ? (wObj.word || '').toUpperCase() : (wObj.word || '');
      const width = ctx.measureText(displayWord).width;
      return { wObj, displayWord, width };
    });

    const totalLineW =
      wordMetrics.reduce((acc, m) => acc + m.width, 0) +
      Math.max(0, wordMetrics.length - 1) * spaceW;

    const popHeadroom = 1.12;
    const fitScale =
      autoFitMargin && totalLineW * popHeadroom > maxBlockWidth
        ? maxBlockWidth / (totalLineW * popHeadroom)
        : 1.0;

    ctx.save();
    ctx.translate(blockCenterX, yOffset);
    ctx.scale(fitScale, fitScale);

    let cursorX = -totalLineW / 2;

    wordMetrics.forEach(({ wObj, displayWord, width }) => {
      const isSpokenNow = nowTime >= Number(wObj.start) && nowTime <= Number(wObj.end) + 0.08;
      const isHighlightedKeyword = Boolean(wObj.highlight);

      ctx.save();
      const wordCenterX = cursorX + width / 2;
      let wordCenterY = 0;

      if (isSpokenNow && animation === 'bounce_word') {
        wordCenterY -= 14;
      }

      ctx.translate(wordCenterX, wordCenterY);
      if (isSpokenNow && (animation === 'hormozi_karaoke' || animation === 'bounce_word')) {
        ctx.scale(1.12, 1.12);
      }

      if (isSpokenNow && animation === 'box_pop') {
        ctx.fillStyle = style.highlightColor || '#FACC15';
        ctx.beginPath();
        ctx.roundRect(-width / 2 - 14, -baseFontSize * 0.54, width + 28, baseFontSize * 1.08, 16);
        ctx.fill();
      }

      let fillColor = style.textColor || '#FFFFFF';
      if (isSpokenNow) {
        fillColor = animation === 'box_pop' ? '#000000' : (style.highlightColor || '#FACC15');
      } else if (isHighlightedKeyword) {
        fillColor = wObj.color || style.secondaryColor || '#22C55E';
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Cinema-standard subtitle outline & subtle drop shadow:
      // Crisp thin outline (~2px external border at 1080p) and soft drop shadow applied once (never doubled)
      const rawShadow = Math.min(8, Math.max(0, Number(style.shadowBlur ?? 3)));
      const rawStroke = Math.min(6, Math.max(0, Number(style.strokeWidth ?? 2)));
      const scaleRatio = cw / 540;
      const strokeW = rawStroke * scaleRatio * 0.9;

      if (animation === 'neon_glow' && (isSpokenNow || isHighlightedKeyword)) {
        ctx.shadowColor = fillColor;
        ctx.shadowBlur = 14 * scaleRatio;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else if (rawShadow > 0) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.52)';
        ctx.shadowBlur = rawShadow * scaleRatio * 0.55;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(1, Math.round(scaleRatio * 0.85));
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      if (strokeW > 0 && !(isSpokenNow && animation === 'box_pop')) {
        ctx.strokeStyle = style.strokeColor || '#000000';
        ctx.lineWidth = strokeW;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(displayWord, 0, 0);
        // Disable shadow before fillText so the shadow is not drawn a second time over the outline
        if (animation !== 'neon_glow') {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      }

      ctx.fillStyle = fillColor;
      ctx.fillText(displayWord, 0, 0);

      ctx.restore();
      cursorX += width + spaceW;
    });

    ctx.restore();
  });

  ctx.restore();
}

function drawComputerVisionHud(ctx, cw, ch, smoothedCropX, activeSpeakerId, smoothing) {
  ctx.save();
  const boxW = cw * 0.44;
  const boxH = ch * 0.28;
  const boxX = (cw - boxW) / 2;
  const boxY = ch * 0.22;

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(boxX, boxY, boxW, boxH);
  ctx.setLineDash([]);

  ctx.font = '700 20px monospace';
  ctx.fillStyle = '#22d3ee';
  ctx.textAlign = 'left';
  ctx.fillText(`CROP_X: ${(smoothedCropX * 100).toFixed(1)}% | SMOOTH: ${smoothing}`, 30, ch * 0.56);
  ctx.restore();
}

function hexToRgba(hex, alpha = 0.7) {
  const clean = (hex || '#000000').replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r || 0}, ${g || 0}, ${b || 0}, ${alpha})`;
}
