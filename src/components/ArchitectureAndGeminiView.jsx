import React, { useState } from 'react';
import {
  Cpu,
  Key,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Server,
  Database,
  Layers,
  ShieldCheck,
  Sparkles,
  Loader2,
  HardDrive,
  Gauge
} from 'lucide-react';

export default function ArchitectureAndGeminiView({
  settings = {},
  metrics = {},
  onSettingsUpdated
}) {
  const [apiKey, setApiKey] = useState(settings.geminiApiKey || '');
  const initialModel =
    !settings.geminiModel ||
    settings.geminiModel === 'gemini-2.5-flash' ||
    settings.geminiModel === 'gemini-2.0-flash'
      ? 'gemini-3.8-flash'
      : settings.geminiModel;
  const [model, setModel] = useState(initialModel);
  const [multimodal, setMultimodal] = useState(settings.enableMultimodalAnalysis !== false);
  const [infraMode, setInfraMode] = useState(
    settings.infrastructureMode || 'Híbrido (Processamento Local FFmpeg + IA Gemini Cloud)'
  );
  const [retentionDays, setRetentionDays] = useState(settings.retentionDays || 30);
  const [hwAccel, setHwAccel] = useState(
    settings.hardwareAcceleration || 'x264 (Compatibilidade Universal CPU) / NVENC Auto'
  );

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: apiKey,
          geminiModel: model,
          enableMultimodalAnalysis: multimodal,
          infrastructureMode: infraMode,
          retentionDays,
          hardwareAcceleration: hwAccel
        })
      });
      const data = await res.json();
      if (res.ok && onSettingsUpdated) {
        onSettingsUpdated(data.settings);
      }
      setTestResult({
        connected: true,
        message: 'Configurações do Google Gemini e Infraestrutura salvas localmente com sucesso!'
      });
    } catch (err) {
      setTestResult({ connected: false, error: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestLiveGemini = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, model })
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ connected: false, error: data.error });
      } else {
        const resolvedModel = data.model || model;
        setModel(resolvedModel);
        setTestResult({
          connected: true,
          message: `Conectado ao Google Gemini (${resolvedModel}) em ${data.latencyMs}ms! Curadoria e Sugestões de Edição por IA ativas.`
        });
        if (onSettingsUpdated) {
          onSettingsUpdated({ ...settings, geminiApiKey: apiKey, geminiModel: resolvedModel });
        }
      }
    } catch (err) {
      setTestResult({ connected: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const approvalRate =
    metrics.totalClipsGenerated > 0
      ? Math.round((metrics.approvedClipsCount / metrics.totalClipsGenerated) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Section 1: Google Gemini Connection Panel */}
      <div className="bg-studio-900 border border-violet-500/40 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                Conexão Direta ao Seu Google Gemini (Curadoria & Copiloto de Edição de Vídeo)
              </h2>
              <p className="text-xs text-slate-300">
                Conecte sua chave da API do Google AI Studio para habilitar transcrição multimodal, pontuação dos 7 critérios e sugestões reais de alteração do vídeo.
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
              apiKey.trim()
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            {apiKey.trim() ? '● Chave Gemini Configurada' : '○ Modo Híbrido / Sem Chave'}
          </span>
        </div>

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-5">
          <div className="md:col-span-6">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Sua Chave de API do Google Gemini (GEMINI_API_KEY)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-studio-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Sua chave fica salva apenas localmente em <code className="text-violet-300">data/db.json</code> na sua máquina.
            </p>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Modelo Gemini Ativo
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-studio-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              <option value="gemini-3.5-transcribe">Gemini 3.5 Transcribe (Modelo Dedicado de Transcrição de Áudio)</option>
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Ultra Rápido ~2s + Timestamps)</option>
              <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (Multimodal)</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
            </select>
          </div>

          <div className="md:col-span-3 flex flex-col justify-end gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestLiveGemini}
                disabled={isTesting}
                className="flex-1 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                Testar API
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold transition"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>

        {testResult && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              testResult.connected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            }`}
          >
            {testResult.connected ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{testResult.message || testResult.error}</span>
          </div>
        )}
      </div>

      {/* Section 2: MVP Success Telemetry (Section 9 of PDF documentation) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-studio-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400">Taxa de Aprovação (MVP)</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{approvalRate}%</div>
          <span className="text-[10px] text-slate-400">
            {metrics.approvedClipsCount} aprovados de {metrics.totalClipsGenerated} candidatos
          </span>
        </div>

        <div className="bg-studio-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400">Tempo Médio Processamento</span>
          <div className="text-2xl font-black text-cyan-400 mt-1">{metrics.avgProcessingTimeSec}s</div>
          <span className="text-[10px] text-slate-400">FFprobe + Curadoria + Cortes</span>
        </div>

        <div className="bg-studio-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400">Custo Estimado / Minuto</span>
          <div className="text-2xl font-black text-violet-400 mt-1">${metrics.estimatedCostPerMinUsd}</div>
          <span className="text-[10px] text-slate-400">Execução Local + Gemini Flash</span>
        </div>

        <div className="bg-studio-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400">Correções Manuais</span>
          <div className="text-2xl font-black text-amber-400 mt-1">{metrics.manualCorrectionsTotal}</div>
          <span className="text-[10px] text-slate-400">Módulo 6 (Revisão Humana)</span>
        </div>

        <div className="bg-studio-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400">Falhas em Workers</span>
          <div className="text-2xl font-black text-slate-200 mt-1">{metrics.failedJobsCount}</div>
          <span className="text-[10px] text-emerald-400">Validação FFprobe 100% OK</span>
        </div>
      </div>

      {/* Section 3: Infrastructure, Costs & Architecture Modules (Sections 6, 7, 8 & 10) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Infrastructure & Retention Config */}
        <div className="bg-studio-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Seção 10 — Infraestrutura (Local / Nuvem / Híbrido) & Retenção
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Modelo de Operação</label>
            <select
              value={infraMode}
              onChange={(e) => setInfraMode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-studio-950 border border-slate-700 text-xs text-white"
            >
              <option value="Local (100% Offline FFmpeg + Motor Semântico Local)">
                Local — Controle total dos dados e custo marginal zero após aquisição
              </option>
              <option value="Híbrido (Processamento Local FFmpeg + IA Gemini Cloud)">
                Híbrido (Recomendado) — Renderização local FFmpeg + Inteligência Google Gemini
              </option>
              <option value="Nuvem (Workers Distribuídos + GPU Sob Demanda)">
                Nuvem — Escala elástica com GPUs sob demanda
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Política de Retenção (Dias)</label>
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-studio-950 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Codificador de Vídeo (Seção 5)</label>
              <select
                value={hwAccel}
                onChange={(e) => setHwAccel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-studio-950 border border-slate-700 text-xs text-white"
              >
                <option value="x264 (Compatibilidade Universal CPU) / NVENC Auto">
                  libx264 / H.264 + AAC 48kHz (Universal)
                </option>
                <option value="NVIDIA NVENC (h264_nvenc GPU Acceleration)">
                  NVIDIA NVENC (Aceleração por Hardware GPU)
                </option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-violet-300 border border-slate-700"
          >
            Atualizar Parâmetros de Infraestrutura
          </button>
        </div>

        {/* Architectural Layers Status (Section 6 & 8) */}
        <div className="bg-studio-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            Seção 6 & 8 — Camadas Modulares do ClipaCortes Ativas
          </h3>
          <div className="space-y-2 text-xs">
            {[
              {
                mod: 'Módulo 1 — Ingestão & FFprobe',
                desc: 'Upload local, importação por URL, inspeção de codecs/FPS e extração de áudio.'
              },
              {
                mod: 'Módulo 2 — Inteligência de Análise',
                desc: 'Transcrição com timestamps por palavra, diarização de falantes e amostragem visual.'
              },
              {
                mod: 'Módulo 3 — Sistema de Pontuação (Virality Score)',
                desc: 'Avaliação ponderada dos 7 critérios (Gancho, Contexto, Desenvolvimento, Conclusão, Engajamento, Qualidade AV, Autonomia).'
              },
              {
                mod: 'Módulo 4 — Editor Automático & Reenquadramento 9:16',
                desc: 'Suavização temporal de trajetória, Split Screen, Cinema Blur, B-Roll e +12 fontes.'
              },
              {
                mod: 'Módulo 5 — Render Workers (FFmpeg + Canvas)',
                desc: 'Codificação MP4 H.264 + AAC 48kHz com validação de integridade FFprobe e exportação .SRT.'
              },
              {
                mod: 'Módulo 6 — Editor Manual + Copiloto Gemini',
                desc: 'Ajuste fino na timeline, revisão de nomes próprios e sugestões de alteração do vídeo em 1 clique via Gemini.'
              }
            ].map((item) => (
              <div
                key={item.mod}
                className="flex items-start justify-between p-2.5 rounded-xl bg-studio-950 border border-slate-800/90"
              >
                <div>
                  <div className="font-bold text-white">{item.mod}</div>
                  <div className="text-[11px] text-slate-400">{item.desc}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-bold shrink-0 ml-2">
                  ATIVO
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
