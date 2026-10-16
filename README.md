# 🎬 ClipTube Studio

Sistema web completo para colar um link de qualquer vídeo do YouTube, selecionar o minuto inicial e final (com preview interativo), e baixar exclusivamente o trecho cortado em **alta qualidade MP4**.

---

## ✨ Principais Recursos

- ⚡ **Download Inteligente por Faixa de Tempo**: O sistema baixa **apenas** o trecho especificado (usando requisições de faixa HTTP e FFmpeg), sem gastar banda ou tempo baixando o vídeo inteiro de 1h ou 2h.
- 🎯 **Corte Preciso em Keyframes**: Usa `force_keyframes_at_cuts` no FFmpeg para garantir que o corte comece e termine exatamente no segundo indicado, sem travar o vídeo ou criar telas pretas.
- 🎥 **Player Interativo do YouTube**: Assista ao vídeo diretamente no estúdio, pause onde quiser e use os botões **"⏱️ Tempo Atual"** para marcar o minuto inicial e final com um clique.
- 📊 **Linha do Tempo Visual**: Visualize graficamente o trecho cortado e a duração total do clipe em tempo real.
- 💎 **Qualidade Máxima**: Suporte a 4K, 1080p Full HD, 720p HD e opção de extrair somente o áudio em MP3.
- 🔄 **Acompanhamento em Tempo Real**: Barra de progresso com porcentagem (%), velocidade de download (MB/s) e etapas de renderização via *Server-Sent Events (SSE)*.
- 🎬 **Player de Pré-visualização**: Assista ao clipe gerado no próprio navegador antes ou depois de baixar.
- 📁 **Histórico de Sessão**: Lista os clipes gerados durante a sessão para download rápido.

---

## 🚀 Como Iniciar

### 1. Iniciar com um comando:
Abra o terminal na pasta do projeto e execute:
```bash
./start.sh
```
Ou se preferir:
```bash
source .venv/bin/activate
python3 run.py
```

O sistema abrirá automaticamente o seu navegador padrão no endereço:
👉 **`http://localhost:8000`**

---

## 🛠️ Tecnologias Utilizadas

- **Backend**: Python 3, FastAPI, Uvicorn, yt-dlp
- **Processamento de Mídia**: FFmpeg
- **Frontend**: HTML5 Semântico, CSS3 Moderno (Glassmorphism, Dark Mode, Micro-animações), JavaScript Nativo, YouTube IFrame API.
