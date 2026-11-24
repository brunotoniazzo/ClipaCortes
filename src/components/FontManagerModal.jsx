import React, { useState, useEffect } from 'react';
import {
  Type,
  Upload,
  Plus,
  Check,
  Trash2,
  Globe,
  FileText,
  X,
  Sparkles
} from 'lucide-react';

const QUICK_GOOGLE_FONTS = [
  { family: 'Righteous', category: 'Display / Moderno' },
  { family: 'Russo One', category: 'Impacto / Gaming' },
  { family: 'Orbitron', category: 'Sci-Fi / IA' },
  { family: 'Teko', category: 'Condensado / Esportes' },
  { family: 'Chakra Petch', category: 'Cyberpunk / Tech' },
  { family: 'Cinzel', category: 'Cinema / Épico' },
  { family: 'Exo 2', category: 'Futurista / Podcast' },
  { family: 'Fredoka', category: 'Rounded / Criativo' }
];

/**
 * Registers custom fonts in the browser DOM (Google Fonts stylesheet or FontFace API for uploaded .ttf/.otf/.woff2)
 */
export function registerFontsInBrowser(fonts = []) {
  fonts.forEach((font) => {
    if (font.source === 'google' && font.cssUrl) {
      const linkId = `gfont-${font.id}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = font.cssUrl;
        document.head.appendChild(link);
      }
    } else if (font.source === 'file' && font.fileUrl && window.FontFace) {
      const loaded = Array.from(document.fonts || []).some((f) => f.family === font.family);
      if (!loaded) {
        const ff = new FontFace(font.family, `url(${font.fileUrl})`);
        ff.load()
          .then((loadedFace) => {
            document.fonts.add(loadedFace);
          })
          .catch((err) => console.warn('Custom FontFace load error:', err));
      }
    }
  });
}

export default function FontManagerModal({
  isOpen,
  onClose,
  fonts = [],
  activeFontId,
  onSelectFont,
  onFontsUpdated
}) {
  const [googleFamily, setGoogleFamily] = useState('');
  const [googleCategory, setGoogleCategory] = useState('Google Font Adicionada');
  const [customFileName, setCustomFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    registerFontsInBrowser(fonts);
  }, [fonts]);

  if (!isOpen) return null;

  const handleAddGoogleFont = async (familyToAdd = googleFamily, catToAdd = googleCategory) => {
    if (!familyToAdd || !familyToAdd.trim()) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/fonts/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family: familyToAdd.trim(),
          category: catToAdd
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao adicionar fonte');
      registerFontsInBrowser(data.fonts);
      onFontsUpdated(data.fonts);
      if (data.font && onSelectFont) {
        onSelectFont(data.font);
      }
      setGoogleFamily('');
      setFeedback({ type: 'success', text: `Fonte "${data.font.family}" adicionada e aplicada com sucesso!` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadFontFile = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('fontFile', selectedFile);
      formData.append('name', customFileName || selectedFile.name.replace(/\.[^/.]+$/, ''));
      formData.append('category', 'Fonte Local (.TTF/.OTF)');

      const res = await fetch('/api/fonts/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no upload da fonte');
      registerFontsInBrowser(data.fonts);
      onFontsUpdated(data.fonts);
      if (data.font && onSelectFont) {
        onSelectFont(data.font);
      }
      setSelectedFile(null);
      setCustomFileName('');
      setFeedback({ type: 'success', text: `Arquivo de fonte "${data.font.family}" instalado e ativado!` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFont = async (fontId) => {
    try {
      const res = await fetch(`/api/fonts/${fontId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.fonts) {
        onFontsUpdated(data.fonts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const primaryCount = fonts.filter((f) => f.isPrimary).length;
  const customCount = fonts.filter((f) => !f.isPrimary).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-studio-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-studio-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Catálogo Tipográfico & Gerenciador de Fontes ({fonts.length} Fontes Ativas)
              </h2>
              <p className="text-xs text-slate-400">
                {primaryCount} Fontes Primárias de Alta Retenção + {customCount} Fontes Adicionadas (Suporte a .TTF, .OTF, .WOFF2 e Google Fonts)
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold border ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Add New Font Panel (Local Upload + Google Font) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Upload Local Font File */}
            <form
              onSubmit={handleUploadFontFile}
              className="bg-studio-950 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-violet-300">
                <Upload className="w-4 h-4" />
                1. Instalar Arquivo de Fonte Local (.TTF, .OTF, .WOFF2)
              </div>
              <p className="text-xs text-slate-400">
                Envie qualquer fonte do seu computador para usar nas legendas dinâmicas e banners.
              </p>
              <input
                type="text"
                placeholder="Nome da Fonte (ex: MinhaFonte Bold)"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-studio-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-violet-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="flex-1 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-violet-300 hover:file:bg-slate-700"
                />
                <button
                  type="submit"
                  disabled={!selectedFile || isSubmitting}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold transition"
                >
                  Instalar
                </button>
              </div>
            </form>

            {/* Option 2: Add from Google Fonts */}
            <div className="bg-studio-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                <Globe className="w-4 h-4" />
                2. Adicionar Fonte via Google Fonts
              </div>
              <p className="text-xs text-slate-400">
                Digite o nome exato de qualquer família do Google Fonts ou adicione sugestões em 1 clique:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Righteous, Russo One, Orbitron, Cinzel..."
                  value={googleFamily}
                  onChange={(e) => setGoogleFamily(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-studio-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddGoogleFont()}
                  disabled={!googleFamily.trim() || isSubmitting}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </div>

              {/* Quick 1-click font chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_GOOGLE_FONTS.map((qf) => {
                  const alreadyAdded = fonts.some(
                    (f) => f.family.toLowerCase() === qf.family.toLowerCase()
                  );
                  return (
                    <button
                      key={qf.family}
                      type="button"
                      disabled={alreadyAdded || isSubmitting}
                      onClick={() => handleAddGoogleFont(qf.family, qf.category)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium border transition ${
                        alreadyAdded
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default'
                          : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                    >
                      {alreadyAdded ? `✓ ${qf.family}` : `+ ${qf.family}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Font Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Selecione a Fonte Ativa para as Legendas e Banners ({fonts.length} Disponíveis)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fonts.map((font) => {
                const isSelected = font.id === activeFontId;
                return (
                  <div
                    key={font.id}
                    onClick={() => onSelectFont && onSelectFont(font)}
                    className={`group relative rounded-xl p-3.5 border cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-violet-600/20 border-violet-500 shadow-lg shadow-violet-950/40'
                        : 'bg-studio-950/90 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300">
                        {font.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            font.isPrimary
                              ? 'bg-violet-500/20 text-violet-300'
                              : 'bg-cyan-500/20 text-cyan-300'
                          }`}
                        >
                          {font.isPrimary ? 'Primária' : 'Custom'}
                        </span>
                        {!font.isPrimary && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFont(font.id);
                            }}
                            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                            title="Remover fonte adicionada"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Visual Font Sample */}
                    <div
                      className="py-2 text-xl tracking-wide text-white truncate"
                      style={{
                        fontFamily: `"${font.family}", sans-serif`,
                        fontWeight: font.weight || '800',
                        textShadow: '0 2px 6px rgba(0,0,0,0.8)'
                      }}
                    >
                      {font.previewText || 'CORTES VIRAIS 9:16'}
                    </div>

                    <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <span>{font.category}</span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <Check className="w-3.5 h-3.5" /> Ativa
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
