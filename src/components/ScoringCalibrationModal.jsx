import React, { useState, useEffect } from 'react';
import { Sliders, X, RotateCcw, CheckCircle2, Sparkles } from 'lucide-react';

export const CRITERIA_SPEC = [
  {
    key: 'hook',
    label: 'Gancho (Hook)',
    question: 'O início desperta curiosidade ou apresenta uma ideia forte?',
    color: 'bg-amber-500'
  },
  {
    key: 'context',
    label: 'Contexto',
    question: 'O espectador entende o assunto sem assistir ao vídeo inteiro?',
    color: 'bg-cyan-500'
  },
  {
    key: 'development',
    label: 'Desenvolvimento',
    question: 'Existe uma explicação, história ou argumento coerente?',
    color: 'bg-violet-500'
  },
  {
    key: 'conclusion',
    label: 'Conclusão',
    question: 'O trecho entrega resposta, surpresa ou conclusão?',
    color: 'bg-emerald-500'
  },
  {
    key: 'engagement',
    label: 'Engajamento Potencial',
    question: 'Há elementos que podem incentivar retenção, comentários ou compartilhamentos?',
    color: 'bg-rose-500'
  },
  {
    key: 'avQuality',
    label: 'Qualidade Audiovisual',
    question: 'A fala é inteligível e a imagem é adequada?',
    color: 'bg-blue-500'
  },
  {
    key: 'autonomy',
    label: 'Autonomia',
    question: 'O trecho funciona como conteúdo independente?',
    color: 'bg-fuchsia-500'
  }
];

export default function ScoringCalibrationModal({
  isOpen,
  onClose,
  scoringWeights,
  onSaveWeights
}) {
  const [weights, setWeights] = useState(
    scoringWeights || {
      hook: 20,
      context: 15,
      development: 15,
      conclusion: 15,
      engagement: 15,
      avQuality: 10,
      autonomy: 10
    }
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (scoringWeights) setWeights(scoringWeights);
  }, [scoringWeights]);

  if (!isOpen) return null;

  const totalWeight = Object.values(weights).reduce((acc, v) => acc + Number(v || 0), 0);

  const applyPreset = (preset) => {
    if (preset === 'tiktok_viral') {
      setWeights({ hook: 30, context: 10, development: 10, conclusion: 15, engagement: 20, avQuality: 5, autonomy: 10 });
    } else if (preset === 'podcast_story') {
      setWeights({ hook: 15, context: 15, development: 25, conclusion: 20, engagement: 10, avQuality: 5, autonomy: 10 });
    } else if (preset === 'educational') {
      setWeights({ hook: 15, context: 20, development: 20, conclusion: 15, engagement: 5, avQuality: 10, autonomy: 15 });
    } else {
      setWeights({ hook: 20, context: 15, development: 15, conclusion: 15, engagement: 15, avQuality: 10, autonomy: 10 });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/scoring-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weights)
      });
      const data = await res.json();
      if (res.ok && onSaveWeights) {
        onSaveWeights(data.scoringWeights, data.projects);
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-studio-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-studio-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Módulo 3 — Calibração do Virality Score (7 Critérios de Curadoria)
              </h2>
              <p className="text-xs text-slate-400">
                Ajuste os pesos ponderados de cada critério da documentação para reordenar os candidatos a corte.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1">Perfis de Calibração:</span>
            <button
              type="button"
              onClick={() => applyPreset('default')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
            >
              Equilibrado (Padrão Opus)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('tiktok_viral')}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-xs font-semibold text-amber-300 border border-amber-500/30"
            >
              TikTok / Reels (Foco Gancho 30%)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('podcast_story')}
              className="px-3 py-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-xs font-semibold text-violet-300 border border-violet-500/30"
            >
              Storytelling & Podcast
            </button>
            <button
              type="button"
              onClick={() => applyPreset('educational')}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-xs font-semibold text-cyan-300 border border-cyan-500/30"
            >
              Aula / Tutorial (Contexto + Autonomia)
            </button>
          </div>

          {/* 7 Criteria Sliders */}
          <div className="space-y-3">
            {CRITERIA_SPEC.map((crit) => {
              const val = Number(weights[crit.key]) || 10;
              const pct = totalWeight > 0 ? Math.round((val / totalWeight) * 100) : 0;
              return (
                <div
                  key={crit.key}
                  className="bg-studio-950 border border-slate-800/90 rounded-xl p-3.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-bold text-white">{crit.label}</span>
                      <p className="text-xs text-slate-400">{crit.question}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-md bg-slate-800 text-xs font-mono font-bold text-violet-300">
                        Peso: {val} ({pct}%)
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={5}
                    value={val}
                    onChange={(e) =>
                      setWeights({ ...weights, [crit.key]: Number(e.target.value) })
                    }
                    className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg mt-2"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-studio-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Soma de Pesos: <strong className="text-white">{totalWeight} pts</strong> (Normalizado automaticamente para escala 0–100)
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-violet-950/50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSaving ? 'Recalculando Scores...' : 'Salvar e Recalibrar Cortes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
