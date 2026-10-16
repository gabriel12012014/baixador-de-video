// Application State
let currentVideoData = null;
let ytPlayer = null;
let currentJobId = null;
let eventSource = null;
let selectedQuality = 'best';

// DOM Elements
const urlInput = document.getElementById('url-input');
const clearUrlBtn = document.getElementById('clear-url-btn');
const pasteBtn = document.getElementById('paste-btn');
const loadVideoBtn = document.getElementById('load-video-btn');
const loadBtnText = document.getElementById('load-btn-text');
const loadSpinner = document.getElementById('load-spinner');
const sampleUrlBtn = document.getElementById('sample-url-btn');

const studioSection = document.getElementById('studio-section');
const videoTitle = document.getElementById('video-title');
const videoChannel = document.getElementById('video-channel');
const videoDuration = document.getElementById('video-duration');

const timelineHighlight = document.getElementById('timeline-highlight');
const timelineStartLabel = document.getElementById('timeline-start-label');
const timelineEndLabel = document.getElementById('timeline-end-label');
const clipDurationTag = document.getElementById('clip-duration-tag');

const startTimeInput = document.getElementById('start-time-input');
const endTimeInput = document.getElementById('end-time-input');
const grabStartBtn = document.getElementById('grab-start-btn');
const grabEndBtn = document.getElementById('grab-end-btn');

const qualitySelector = document.getElementById('quality-selector');
const startDownloadBtn = document.getElementById('start-download-btn');
const dlBtnIcon = document.getElementById('dl-btn-icon');
const dlBtnText = document.getElementById('dl-btn-text');

const progressCard = document.getElementById('progress-card');
const progressStatusTitle = document.getElementById('progress-status-title');
const progressPercent = document.getElementById('progress-percent');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressStageText = document.getElementById('progress-stage-text');
const progressSpeed = document.getElementById('progress-speed');
const progressEta = document.getElementById('progress-eta');
const activeSpinner = document.getElementById('active-spinner');

const successBox = document.getElementById('success-box');
const previewVideoPlayer = document.getElementById('preview-video-player');
const downloadFileBtn = document.getElementById('download-file-btn');
const downloadFilesize = document.getElementById('download-filesize');
const cutAnotherBtn = document.getElementById('cut-another-btn');

const historyGrid = document.getElementById('history-grid');
const noHistoryMsg = document.getElementById('no-history-msg');
const toastContainer = document.getElementById('toast-container');

// Sample video URL (Big Buck Bunny 4K Blender)
const SAMPLE_URL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

// Init
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadHistory();
});

function setupEventListeners() {
  // Input changes
  urlInput.addEventListener('input', () => {
    clearUrlBtn.style.display = urlInput.value ? 'block' : 'none';
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadVideoInfo();
    }
  });

  clearUrlBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearUrlBtn.style.display = 'none';
    urlInput.focus();
  });

  // Paste button
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        clearUrlBtn.style.display = 'block';
        loadVideoInfo();
      }
    } catch (err) {
      showToast('Permissão de colar negada ou indisponível. Cole manualmente.', 'error');
    }
  });

  // Sample URL button
  sampleUrlBtn.addEventListener('click', () => {
    urlInput.value = SAMPLE_URL;
    clearUrlBtn.style.display = 'block';
    loadVideoInfo();
  });

  // Load video button
  loadVideoBtn.addEventListener('click', loadVideoInfo);

  // Time Inputs events
  startTimeInput.addEventListener('input', () => {
    sanitizeTimeInput(startTimeInput);
    updateTimeline();
  });

  endTimeInput.addEventListener('input', () => {
    sanitizeTimeInput(endTimeInput);
    updateTimeline();
  });

  // Grab player time buttons
  grabStartBtn.addEventListener('click', () => {
    if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      const curTime = ytPlayer.getCurrentTime();
      startTimeInput.value = formatSeconds(curTime);
      updateTimeline();
      showToast(`Início marcado em: ${startTimeInput.value}`);
    } else {
      showToast('O player ainda não foi carregado.', 'error');
    }
  });

  grabEndBtn.addEventListener('click', () => {
    if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      const curTime = ytPlayer.getCurrentTime();
      endTimeInput.value = formatSeconds(curTime);
      updateTimeline();
      showToast(`Fim marcado em: ${endTimeInput.value}`);
    } else {
      showToast('O player ainda não foi carregado.', 'error');
    }
  });

  // Quality selector pills
  qualitySelector.addEventListener('click', (e) => {
    const pill = e.target.closest('.quality-pill');
    if (!pill) return;
    document.querySelectorAll('.quality-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    selectedQuality = pill.getAttribute('data-quality');
  });

  // Start download button
  startDownloadBtn.addEventListener('click', startDownload);

  // Cut another button
  cutAnotherBtn.addEventListener('click', () => {
    progressCard.style.display = 'none';
    successBox.style.display = 'none';
    window.scrollTo({ top: studioSection.offsetTop - 20, behavior: 'smooth' });
  });
}

// Extract Video ID from various YouTube URL formats
function extractVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  // Check for shorts
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) {
    return shortsMatch[1];
  }
  return null;
}

// Fetch Video Information
async function loadVideoInfo() {
  const url = urlInput.value.trim();
  if (!url) {
    showToast('Por favor, cole um link válido do YouTube.', 'error');
    urlInput.focus();
    return;
  }

  // Visual loading state
  loadVideoBtn.disabled = true;
  loadBtnText.textContent = 'Carregando...';
  loadSpinner.style.display = 'inline-block';

  try {
    const res = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Não foi possível carregar as informações do vídeo.');
    }

    currentVideoData = data;
    displayVideoStudio(data);
    showToast('Vídeo carregado com sucesso!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    loadVideoBtn.disabled = false;
    loadBtnText.textContent = 'Carregar Vídeo';
    loadSpinner.style.display = 'none';
  }
}

// Display Studio with YouTube Player & Timeline
function displayVideoStudio(data) {
  studioSection.style.display = 'grid';
  videoTitle.textContent = data.title;
  videoChannel.textContent = data.channel;
  videoDuration.textContent = `Duração total: ${data.duration_str}`;

  // Default times: start at 00:00, end at min(30s, duration) or 01:00
  startTimeInput.value = '00:00';
  const defaultEndSec = Math.min(60, data.duration || 60);
  endTimeInput.value = formatSeconds(defaultEndSec);

  // Initialize or update YouTube Player
  const videoId = data.id || extractVideoId(data.webpage_url);
  initYouTubePlayer(videoId);

  updateTimeline();

  // Scroll smoothly to the studio section
  studioSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Initialize YouTube IFrame
function initYouTubePlayer(videoId) {
  if (!videoId) return;

  if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
    ytPlayer.loadVideoById(videoId);
  } else {
    // If YouTube API is ready
    if (window.YT && window.YT.Player) {
      ytPlayer = new YT.Player('yt-player', {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0
        }
      });
    } else {
      // Fallback: Embed iframe directly
      const container = document.getElementById('player-container');
      container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
    }
  }
}

// Parse formatted time string (MM:SS, HH:MM:SS, or seconds) into seconds
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.toString().trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length >= 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

// Format seconds into MM:SS or HH:MM:SS
function formatSeconds(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Sanitize user time input as they type
function sanitizeTimeInput(input) {
  let val = input.value.replace(/[^0-9:]/g, '');
  input.value = val;
}

// Update Timeline Visual Bar & Duration Tag
function updateTimeline() {
  const startSec = parseTimeToSeconds(startTimeInput.value);
  const endSec = parseTimeToSeconds(endTimeInput.value);
  const totalDuration = currentVideoData ? currentVideoData.duration : Math.max(endSec, 100);

  const durationDiff = Math.max(0, endSec - startSec);
  clipDurationTag.textContent = `Duração do corte: ${formatSeconds(durationDiff)}`;

  timelineStartLabel.textContent = `Início: ${formatSeconds(startSec)}`;
  timelineEndLabel.textContent = `Fim: ${formatSeconds(endSec)}`;

  if (totalDuration > 0) {
    const leftPct = Math.min(100, Math.max(0, (startSec / totalDuration) * 100));
    const widthPct = Math.min(100 - leftPct, Math.max(0.5, ((endSec - startSec) / totalDuration) * 100));
    timelineHighlight.style.left = `${leftPct}%`;
    timelineHighlight.style.width = `${widthPct}%`;
  }
}

// Start Download
async function startDownload() {
  if (!currentVideoData) {
    showToast('Carregue um vídeo primeiro.', 'error');
    return;
  }

  const startSec = parseTimeToSeconds(startTimeInput.value);
  const endSec = parseTimeToSeconds(endTimeInput.value);

  if (startSec >= endSec) {
    showToast('O minuto inicial deve ser menor que o minuto final!', 'error');
    startTimeInput.focus();
    return;
  }

  const formatType = selectedQuality === 'audio' ? 'audio' : 'mp4';

  // Disable button and show spinner
  startDownloadBtn.disabled = true;
  dlBtnIcon.textContent = '⏳';
  dlBtnText.textContent = 'Iniciando...';

  // Prepare Progress UI
  progressCard.style.display = 'block';
  successBox.style.display = 'none';
  activeSpinner.style.display = 'inline-block';
  progressStatusTitle.textContent = 'Iniciando download do trecho...';
  progressPercent.textContent = '0%';
  progressBarFill.style.width = '0%';
  progressStageText.textContent = 'Conectando ao YouTube...';
  progressSpeed.textContent = '';
  progressEta.textContent = '';

  progressCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: currentVideoData.webpage_url,
        start_time: startTimeInput.value,
        end_time: endTimeInput.value,
        quality: selectedQuality,
        format_type: formatType
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Erro ao iniciar o download.');
    }

    currentJobId = data.job_id;
    listenToProgress(currentJobId);
  } catch (err) {
    showToast(err.message, 'error');
    progressCard.style.display = 'none';
    startDownloadBtn.disabled = false;
    dlBtnIcon.textContent = '✂️';
    dlBtnText.textContent = 'Cortar e Baixar em MP4';
  }
}

// Listen to Real-Time Progress via Server-Sent Events (SSE)
function listenToProgress(jobId) {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`/api/progress/${jobId}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleProgressUpdate(data);
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  };

  eventSource.onerror = (err) => {
    console.warn('SSE connection error or closed:', err);
    eventSource.close();
  };
}

// Update UI with Progress Data
function handleProgressUpdate(job) {
  const percent = job.progress || 0;
  progressPercent.textContent = `${Math.round(percent)}%`;
  progressBarFill.style.width = `${percent}%`;

  if (job.stage) {
    progressStageText.textContent = job.stage;
  }
  if (job.speed_str) {
    progressSpeed.textContent = `Velocidade: ${job.speed_str}`;
  }
  if (job.eta_str) {
    progressEta.textContent = job.eta_str;
  }

  if (job.status === 'downloading') {
    progressStatusTitle.textContent = 'Baixando trecho selecionado...';
  } else if (job.status === 'finished' || percent >= 99) {
    progressStatusTitle.textContent = 'Cortando e renderizando com FFmpeg...';
  }

  // Handle Finished
  if (job.status === 'completed') {
    eventSource.close();
    activeSpinner.style.display = 'none';
    progressStatusTitle.textContent = 'Corte finalizado com sucesso!';
    progressPercent.textContent = '100%';
    progressBarFill.style.width = '100%';

    // Setup success download button
    downloadFileBtn.href = `/api/file/${job.id}`;
    downloadFilesize.textContent = job.file_size_str || 'Alta Qualidade';

    // Setup preview video
    previewVideoPlayer.src = `/api/preview-video/${job.id}`;
    previewVideoPlayer.load();

    successBox.style.display = 'block';

    // Re-enable download button
    startDownloadBtn.disabled = false;
    dlBtnIcon.textContent = '✂️';
    dlBtnText.textContent = 'Cortar e Baixar em MP4';

    showToast('Download do corte pronto!', 'success');

    // Auto-trigger browser download
    setTimeout(() => {
      downloadFileBtn.click();
    }, 400);

    loadHistory();
  } else if (job.status === 'error') {
    eventSource.close();
    activeSpinner.style.display = 'none';
    progressStatusTitle.textContent = 'Ocorreu um erro no download';
    progressStageText.textContent = job.error || 'Erro desconhecido.';
    progressBarFill.style.background = 'var(--danger)';

    startDownloadBtn.disabled = false;
    dlBtnIcon.textContent = '✂️';
    dlBtnText.textContent = 'Cortar e Baixar em MP4';

    showToast(`Erro: ${job.error || 'Falha no corte.'}`, 'error');
  }
}

// Load Session History
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    if (data.history && data.history.length > 0) {
      renderHistory(data.history);
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function renderHistory(items) {
  const completed = items.filter(item => item.status === 'completed');
  if (completed.length === 0) {
    noHistoryMsg.style.display = 'block';
    return;
  }

  noHistoryMsg.style.display = 'none';
  historyGrid.innerHTML = '';

  completed.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-item';
    card.innerHTML = `
      <img src="${item.thumbnail || ''}" class="history-thumb" alt="Thumbnail" onerror="this.style.display='none'">
      <div class="history-info">
        <div class="history-name" title="${item.title || item.filename}">${item.title || item.filename}</div>
        <div class="history-meta">
          Trecho: ${item.start_str} - ${item.end_str} • ${item.file_size_str || 'MP4'}
        </div>
      </div>
      <a href="/api/file/${item.id}" class="history-dl-btn" download>
        ⬇️ Baixar
      </a>
    `;
    historyGrid.appendChild(card);
  });
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
