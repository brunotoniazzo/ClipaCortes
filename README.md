# ClipaCortes Studio AI 🎬⚡

Plataforma completa e executável localmente de **Análise Audiovisual, Curadoria com Inteligência Artificial (Google Gemini), Reenquadramento 9:16 com Suavização Temporal, Legendas Dinâmicas e Renderização FFmpeg**, desenvolvida seguindo rigorosamente todas as especificações funcionais e técnicas da documentação de arquitetura baseada no **Opus Clip**.

---

## 🚀 Como Executar Localmente

1. **Pelo Terminal:**
   ```bash
   npm run dev
   ```
   Ou dê dois cliques em **`Iniciar_ClipaCortes.bat`** no Windows.
2. Acesse a interface em: **`http://localhost:5173`** (o servidor Backend + FFmpeg roda automaticamente na porta `3001`).

---

## 🧩 Módulos e Especificações Implementadas

### 1. Análise Técnica de Áudio e Vídeo (Seção 2 & Módulo 1 e 2)
- **Inspeção Real via FFprobe (`server/mediaEngine.js`)**: Extrai duração, resolução, taxa de quadros (FPS), codecs de vídeo/áudio, bitrate e sample rate.
- **Extração de Trilha de Áudio & Transcrição STT**: Converte e extrai o áudio para análise multimodal com timestamps por palavra, alinhamento temporal (*forced alignment*) e diarização de turnos de fala (*Host* vs *Convidado*).
- **Análise Visual & HUD de Visão Computacional**: Detecção facial, estimativa de falante ativo e janela de rastreamento com suavização temporal inspecionável ao vivo pelo botão **"HUD Visão IA"** no player.

### 2. Seleção dos Melhores Momentos e Virality Score (Seção 3 & Módulo 3)
- Avaliação ponderada nos **7 Critérios Oficiais da Documentação**:
  1. **Gancho (Hook)** — *O início desperta curiosidade ou apresenta uma ideia forte?*
  2. **Contexto** — *O espectador entende o assunto sem assistir ao vídeo inteiro?*
  3. **Desenvolvimento** — *Existe uma explicação, história ou argumento coerente?*
  4. **Conclusão** — *O trecho entrega resposta, surpresa ou conclusão?*
  5. **Engajamento Potencial** — *Há elementos que incentivam retenção, comentários ou compartilhamentos?*
  6. **Qualidade Audiovisual** — *A fala é inteligível e a imagem é adequada?*
  7. **Autonomia** — *O trecho funciona como conteúdo independente?*
- **Calibrador de Pesos Interativo**: Permite ajustar os pesos de cada critério e recalcular o ranking de todos os candidatos em tempo real.

### 3. Conexão Direta ao Google Gemini & Copiloto de Sugestões de Alteração do Vídeo
- Na aba **"Gemini & Arquitetura"**, conecte sua `GEMINI_API_KEY` e escolha o modelo (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`).
- Na aba **"Gemini IA"** dentro do Editor de Cortes, peça alterações em linguagem natural ou em 1 clique e receba **Sugestões Acionáveis de Alteração do Vídeo** (mudança de layout 9:16, corte de gancho, troca de fonte/animação, destaque de palavras-chave nas legendas e tratamento de cor/áudio).
- Cada sugestão pode ser **editada/personalizada** antes de ser aplicada ou aplicada com 1 clique diretamente ao vídeo.

### 4. Catálogo Tipográfico com 12 Fontes Primárias + Adição Livre
- **12 Fontes Primárias Pré-Carregadas**: *Montserrat Black*, *Anton Impact*, *Bebas Neue Bold*, *Poppins ExtraBold*, *Oswald Heavy*, *Rubik Black*, *Inter Black*, *Permanent Marker*, *Bangers Comic*, *Playfair Display Black*, *Space Grotesk Bold* e *Archivo Black*.
- **Adição de Novas Fontes**:
  - Upload direto de arquivos locais **`.TTF`**, **`.OTF`**, **`.WOFF`** e **`.WOFF2`** (carregados instantaneamente via `FontFace` API e persistidos no servidor).
  - Adição instantânea de qualquer família do **Google Fonts**.

### 5. Reenquadramento Automático, Layouts e Legendas Dinâmicas (Seção 4 & Módulos 4 e 6)
- **Proporções**: `9:16` (Vertical), `1:1` (Quadrado), `4:5` (Retrato), `16:9` (Horizontal).
- **5 Modos de Layout**:
  1. *Rastreamento Facial Suavizado (Auto Speaker Track)*
  2. *Split Screen 2 Participantes (Topo/Base)*
  3. *Cinema Blur 16:9 Centralizado + Fundo Desfocado*
  4. *Falante + B-Roll Dinâmico*
  5. *Picture-in-Picture (PiP)*
- **Editor Completo de Legendas**: Edição de texto, busca e substituição de nomes próprios, atribuição de falante, ajuste de timestamps, destaque cromático palavra por palavra e exportação `.SRT`.

### 6. Renderização FFmpeg & Central de Redes Sociais (Seção 5 & Módulo 5)
- Renderização real em segundo plano com **`ffmpeg-static`** (`MP4`, `H.264 / libx264`, `AAC 48 kHz`, `30/60 FPS`) e validação automática de integridade via **`ffprobe`**, além de captura direta do Canvas 60FPS com todas as animações Karaoke.
- **Hub de Redes Sociais**: Conexão e configuração de contas (TikTok, Instagram Reels, YouTube Shorts, Kwai, LinkedIn, X/Twitter) com suporte a OAuth Token, Webhooks de publicação e fila de agendamento.
