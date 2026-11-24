import React, { useState } from 'react';
import {
  Share2,
  CheckCircle2,
  Link2,
  Send,
  Calendar,
  Hash,
  Sparkles,
  Settings,
  ExternalLink,
  AlertCircle,
  Clock
} from 'lucide-react';

export default function SocialHubView({
  socialAccounts = [],
  scheduledPosts = [],
  activeProject,
  activeClip,
  onSocialUpdated,
  onPostsUpdated
}) {
  const [selectedClipId, setSelectedClipId] = useState(activeClip?.id || activeProject?.clips?.[0]?.id || '');
  const currentClip =
    activeProject?.clips?.find((c) => c.id === selectedClipId) ||
    activeClip ||
    activeProject?.clips?.[0];

  const [selectedPlatforms, setSelectedPlatforms] = useState(['TikTok', 'Instagram Reels', 'YouTube Shorts']);
  const [postCaption, setPostCaption] = useState(
    currentClip?.socialSuggestion?.caption ||
      'Confira esse corte extraído e editado automaticamente no ClipaCortes Studio AI! 🚀'
  );
  const [postHashtags, setPostHashtags] = useState(
    (currentClip?.socialSuggestion?.hashtags || ['#cortes', '#podcast', '#ia', '#viral']).join(' ')
  );
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({
    handle: '',
    accessToken: '',
    webhookUrl: '',
    defaultHashtags: ''
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState(null);

  const handleTogglePlatformSelection = (platformName) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformName)
        ? prev.filter((p) => p !== platformName)
        : [...prev, platformName]
    );
  };

  const handleToggleConnect = async (account) => {
    try {
      const res = await fetch(`/api/social/accounts/${account.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connected: !account.connected })
      });
      const data = await res.json();
      if (res.ok && onSocialUpdated) {
        onSocialUpdated(data.socialAccounts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditAccount = (acc) => {
    setEditingAccount(acc);
    setAccountForm({
      handle: acc.handle || '',
      accessToken: '',
      webhookUrl: acc.webhookUrl || '',
      defaultHashtags: (acc.defaultHashtags || []).join(' ')
    });
  };

  const handleSaveAccountConfig = async (e) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      const res = await fetch(`/api/social/accounts/${editingAccount.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connected: true,
          handle: accountForm.handle,
          accessToken: accountForm.accessToken || undefined,
          webhookUrl: accountForm.webhookUrl,
          defaultHashtags: accountForm.defaultHashtags
            .split(/\s+/)
            .filter(Boolean)
            .map((h) => (h.startsWith('#') ? h : `#${h}`))
        })
      });
      const data = await res.json();
      if (res.ok && onSocialUpdated) {
        onSocialUpdated(data.socialAccounts);
      }
      setEditingAccount(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublish = async (publishNow = true) => {
    if (selectedPlatforms.length === 0) return;
    setIsPublishing(true);
    setPublishFeedback(null);
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: currentClip?.id || 'clip-001',
          clipTitle: currentClip?.title || 'Corte ClipaCortes',
          platforms: selectedPlatforms,
          caption: postCaption,
          hashtags: postHashtags.split(/\s+/).filter(Boolean),
          publishNow
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao publicar');
      if (onPostsUpdated) onPostsUpdated(data.scheduledPosts);
      setPublishFeedback({
        type: 'success',
        text: publishNow
          ? `Corte enviado com sucesso para ${selectedPlatforms.join(', ')}!`
          : `Publicação agendada na fila para ${selectedPlatforms.join(', ')}!`
      });
    } catch (err) {
      setPublishFeedback({ type: 'error', text: err.message });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-violet-950/60 via-studio-900 to-indigo-950/60 border border-violet-500/30 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Share2 className="w-4 h-4" />
            Hub de Conexão Social & Distribuição Multi-Plataforma
          </div>
          <h2 className="text-xl font-black text-white">
            Conecte suas Redes Sociais, Configure OAuth/Webhooks e Publique Cortes
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Validação automática de proporção (9:16, 4:5, 16:9), duração máxima por rede, geração de copy viral com Gemini e disparo direto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            {socialAccounts.filter((a) => a.connected).length} de {socialAccounts.length} Redes Conectadas
          </span>
        </div>
      </div>

      {/* Connected Social Networks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {socialAccounts.map((acc) => (
          <div
            key={acc.id}
            className={`rounded-2xl p-4 border transition flex flex-col justify-between ${
              acc.connected
                ? 'bg-studio-900 border-violet-500/40 shadow-lg shadow-violet-950/20'
                : 'bg-studio-900/60 border-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                      acc.connected
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {acc.platform.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{acc.platform}</h3>
                    <p className="text-xs text-violet-300 font-mono">{acc.handle}</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    acc.connected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {acc.connected ? 'CONECTADO' : 'OFFLINE'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1 mt-3 bg-studio-950/80 p-2.5 rounded-xl border border-slate-800/80">
                <div className="flex justify-between">
                  <span>Status API:</span>
                  <span className="text-slate-200 font-medium">{acc.status}</span>
                </div>
                <div className="flex justify-between">
                  <span>Formato Ideal / Limite:</span>
                  <span className="text-cyan-300 font-mono">
                    {acc.recommendedRatio} • máx {acc.maxDurationSec}s
                  </span>
                </div>
                {acc.accessTokenMasked && (
                  <div className="flex justify-between">
                    <span>Token OAuth:</span>
                    <span className="text-emerald-400 font-mono">{acc.accessTokenMasked}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mt-2.5">
                {(acc.defaultHashtags || []).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded bg-slate-800/90 text-[10px] text-slate-300 font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleToggleConnect(acc)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                  acc.connected
                    ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {acc.connected ? 'Desconectar' : 'Conectar Conta'}
              </button>
              <button
                type="button"
                onClick={() => openEditAccount(acc)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Configurar Token OAuth, Handle e Webhook"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Editing Social Account OAuth / Webhook */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleSaveAccountConfig}
            className="bg-studio-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white">
              Configurar Integração: {editingAccount.platform}
            </h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Identificador / @Handle da Conta</label>
              <input
                type="text"
                value={accountForm.handle}
                onChange={(e) => setAccountForm({ ...accountForm, handle: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-studio-950 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                OAuth 2.0 Access Token / Chave de API (Opcional)
              </label>
              <input
                type="password"
                placeholder="Cole seu token OAuth da plataforma..."
                value={accountForm.accessToken}
                onChange={(e) => setAccountForm({ ...accountForm, accessToken: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-studio-950 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Webhook de Automação (n8n / Make / Zapier / API Própria)
              </label>
              <input
                type="text"
                placeholder="https://seu-webhook.com/api/publish"
                value={accountForm.webhookUrl}
                onChange={(e) => setAccountForm({ ...accountForm, webhookUrl: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-studio-950 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Hashtags Padrão</label>
              <input
                type="text"
                value={accountForm.defaultHashtags}
                onChange={(e) => setAccountForm({ ...accountForm, defaultHashtags: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-studio-950 border border-slate-700 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white"
              >
                Salvar Conexão
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Composer & Publisher Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-studio-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-violet-400" />
            Publicar ou Agendar Corte nas Redes Conectadas
          </h3>

          {publishFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold border ${
                publishFeedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}
            >
              {publishFeedback.text}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              1. Escolha o Corte Aprovado do Projeto Atual
            </label>
            <select
              value={currentClip?.id || ''}
              onChange={(e) => {
                const c = activeProject?.clips?.find((cl) => cl.id === e.target.value);
                setSelectedClipId(e.target.value);
                if (c?.socialSuggestion) {
                  setPostCaption(c.socialSuggestion.caption || '');
                  setPostHashtags((c.socialSuggestion.hashtags || []).join(' '));
                }
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-studio-950 border border-slate-700 text-xs text-white"
            >
              {(activeProject?.clips || []).map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.rank} [{c.viralityScore} pts] {c.title} ({c.duration}s • {c.layout?.aspectRatio || '9:16'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              2. Selecione os Destinos de Publicação
            </label>
            <div className="flex flex-wrap gap-2">
              {socialAccounts.map((acc) => {
                const isChecked = selectedPlatforms.includes(acc.platform);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleTogglePlatformSelection(acc.platform)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                      isChecked
                        ? 'bg-violet-600/25 border-violet-500 text-white'
                        : 'bg-studio-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {acc.platform}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              3. Legenda Social / Copy Sugerida pelo Gemini (Editável)
            </label>
            <textarea
              rows={3}
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-studio-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              4. Hashtags Virais
            </label>
            <input
              type="text"
              value={postHashtags}
              onChange={(e) => setPostHashtags(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-studio-950 border border-slate-700 text-xs font-mono text-cyan-300 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isPublishing || selectedPlatforms.length === 0}
              onClick={() => handlePublish(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-violet-950/50 transition"
            >
              <Send className="w-4 h-4" />
              Publicar Agora ({selectedPlatforms.length} Redes)
            </button>

            <button
              type="button"
              disabled={isPublishing || selectedPlatforms.length === 0}
              onClick={() => handlePublish(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition"
            >
              <Calendar className="w-4 h-4 text-cyan-400" />
              Agendar na Fila
            </button>
          </div>
        </div>

        {/* Publication History & Queue */}
        <div className="lg:col-span-5 bg-studio-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-cyan-400" />
            Fila & Histórico de Publicações ({scheduledPosts.length})
          </h3>
          <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
            {scheduledPosts.map((post) => (
              <div
                key={post.id}
                className="bg-studio-950 border border-slate-800 rounded-xl p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[11px] font-bold">
                    {post.platform} • {post.handle}
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    {post.status}
                  </span>
                </div>
                <p className="text-xs font-bold text-white truncate">{post.clipTitle}</p>
                <p className="text-[11px] text-slate-400 line-clamp-2">{post.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
