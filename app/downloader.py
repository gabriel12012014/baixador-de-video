import os
import re
import shutil
import uuid
import time
import threading
from typing import Dict, Any, Optional, Tuple
import yt_dlp

DOWNLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "downloads"))
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# In-memory storage for jobs
jobs: Dict[str, Dict[str, Any]] = {}

def parse_time_str(val: str) -> float:
    """
    Parses strings like '01:30', '1:30', '00:01:30', '90', '1.5' into seconds.
    """
    if val is None:
        return 0.0
    val = str(val).strip()
    if not val:
        return 0.0
    
    parts = val.split(":")
    try:
        if len(parts) == 1:
            return float(parts[0])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) >= 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    except ValueError:
        return 0.0
    return 0.0

def format_seconds(seconds: float) -> str:
    """Converts seconds into HH:MM:SS or MM:SS string."""
    seconds = max(0, int(seconds))
    hrs = seconds // 3600
    mins = (seconds % 3600) // 60
    secs = seconds % 60
    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"

def sanitize_filename(name: str) -> str:
    """Sanitizes title to make it safe for filesystems."""
    # Remove characters illegal in filenames
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = clean.replace(" ", "_")
    # Condense multiple underscores
    clean = re.sub(r'_+', '_', clean).strip(" ._")
    return clean[:60] if clean else "video"

def get_base_ydl_opts() -> Dict[str, Any]:
    """Base yt-dlp options with JS runtime and ffmpeg config."""
    opts: Dict[str, Any] = {
        'quiet': True,
        'no_warnings': True,
    }
    node_path = shutil.which('node')
    if node_path:
        opts['js_runtimes'] = {'node': {'path': node_path}}
    
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        opts['ffmpeg_location'] = ffmpeg_path
        
    return opts

def extract_video_info(url: str) -> Dict[str, Any]:
    """Extracts video metadata without downloading."""
    opts = get_base_ydl_opts()
    opts.update({
        'extract_flat': False,
        'skip_download': True,
    })
    
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        
    # Gather available resolutions
    formats = info.get('formats', [])
    available_heights = set()
    for f in formats:
        h = f.get('height')
        if h and f.get('vcodec') != 'none':
            available_heights.add(h)
            
    sorted_heights = sorted(list(available_heights), reverse=True)
    
    return {
        'id': info.get('id'),
        'title': info.get('title', 'Vídeo do YouTube'),
        'thumbnail': info.get('thumbnail'),
        'duration': info.get('duration', 0),
        'duration_str': format_seconds(info.get('duration', 0)),
        'channel': info.get('uploader') or info.get('channel', 'Canal do YouTube'),
        'resolutions': sorted_heights,
        'webpage_url': info.get('webpage_url', url),
    }

def start_clip_download(
    url: str,
    start_time: str,
    end_time: str,
    quality: str = "best",
    format_type: str = "mp4"
) -> str:
    """
    Starts download job in a background thread and returns job_id.
    """
    job_id = str(uuid.uuid4())
    start_sec = parse_time_str(start_time)
    end_sec = parse_time_str(end_time)
    
    jobs[job_id] = {
        'id': job_id,
        'status': 'queued',
        'progress': 0,
        'speed_str': '',
        'eta_str': '',
        'stage': 'Iniciando processamento...',
        'title': '',
        'thumbnail': '',
        'start_sec': start_sec,
        'end_sec': end_sec,
        'start_str': format_seconds(start_sec),
        'end_str': format_seconds(end_sec),
        'quality': quality,
        'format_type': format_type,
        'output_file': None,
        'filename': None,
        'file_size': 0,
        'error': None,
        'created_at': time.time(),
    }
    
    thread = threading.Thread(
        target=_run_download_job,
        args=(job_id, url, start_sec, end_sec, quality, format_type),
        daemon=True
    )
    thread.start()
    return job_id

def _run_download_job(
    job_id: str,
    url: str,
    start_sec: float,
    end_sec: float,
    quality: str,
    format_type: str
):
    job = jobs[job_id]
    try:
        job['status'] = 'fetching_info'
        job['stage'] = 'Obtendo informações do vídeo...'
        
        base_opts = get_base_ydl_opts()
        with yt_dlp.YoutubeDL(base_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
        video_title = info.get('title', 'video')
        video_duration = info.get('duration', 0)
        job['title'] = video_title
        job['thumbnail'] = info.get('thumbnail')
        
        # Adjust end_sec if not provided or greater than video duration
        if end_sec <= 0 or end_sec > video_duration:
            end_sec = float(video_duration)
            job['end_sec'] = end_sec
            job['end_str'] = format_seconds(end_sec)
            
        if start_sec >= end_sec:
            raise ValueError("O minuto inicial deve ser menor que o minuto final.")
            
        clean_title = sanitize_filename(video_title)
        time_tag = f"{format_seconds(start_sec).replace(':', '-')}_a_{format_seconds(end_sec).replace(':', '-')}"
        final_ext = "mp3" if format_type == "audio" else "mp4"
        final_name = f"{clean_title}_[{time_tag}].{final_ext}"
        output_template = os.path.join(DOWNLOADS_DIR, f"{job_id}_{clean_title}_[{time_tag}].%(ext)s")
        
        # Determine format string based on quality
        if format_type == "audio":
            format_selector = "bestaudio/best"
            merge_format = "mp3"
        elif quality == "best":
            format_selector = "bestvideo+bestaudio/best"
            merge_format = "mp4"
        else:
            # Quality is height like '1080p', '720p', '480p'
            height = quality.replace("p", "")
            format_selector = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]"
            merge_format = "mp4"
            
        def progress_hook(d):
            status = d.get('status')
            if status == 'downloading':
                job['status'] = 'downloading'
                downloaded = d.get('downloaded_bytes', 0)
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 1
                percent = min(99.0, max(1.0, (downloaded / total) * 100))
                job['progress'] = round(percent, 1)
                
                speed = d.get('speed')
                if speed:
                    if speed >= 1024 * 1024:
                        job['speed_str'] = f"{speed / (1024 * 1024):.1f} MB/s"
                    else:
                        job['speed_str'] = f"{speed / 1024:.0f} KB/s"
                        
                eta = d.get('eta')
                if eta is not None:
                    job['eta_str'] = f"{eta}s restantes"
                    
                job['stage'] = f"Baixando trecho ({job['start_str']} - {job['end_str']})..."
                
            elif status == 'finished':
                job['progress'] = 99.0
                job['stage'] = 'Processando e renderizando corte em alta definição com FFmpeg...'
                
        def postprocessor_hook(d):
            status = d.get('status')
            if status == 'started':
                job['stage'] = 'Mesclando áudio e vídeo em MP4...'
            elif status == 'finished':
                job['stage'] = 'Finalizando arquivo...'

        ydl_opts = {
            **base_opts,
            'format': format_selector,
            'download_ranges': yt_dlp.utils.download_range_func(None, [(start_sec, end_sec)]),
            'force_keyframes_at_cuts': True,
            'outtmpl': output_template,
            'merge_output_format': merge_format,
            'progress_hooks': [progress_hook],
            'postprocessor_hooks': [postprocessor_hook],
            'overwrites': True,
        }
        
        if format_type == "audio":
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]

        job['status'] = 'downloading'
        job['stage'] = f"Iniciando download do trecho ({job['start_str']} - {job['end_str']})..."
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        # Find the final generated file
        expected_prefix = os.path.join(DOWNLOADS_DIR, f"{job_id}_{clean_title}_[{time_tag}]")
        actual_file = None
        for file in os.listdir(DOWNLOADS_DIR):
            if file.startswith(f"{job_id}_"):
                actual_file = os.path.join(DOWNLOADS_DIR, file)
                break
                
        if not actual_file or not os.path.exists(actual_file):
            raise FileNotFoundError("O arquivo resultante não foi encontrado após o processamento.")
            
        file_size = os.path.getsize(actual_file)
        
        job['status'] = 'completed'
        job['progress'] = 100.0
        job['stage'] = 'Corte concluído com sucesso!'
        job['output_file'] = actual_file
        job['filename'] = final_name
        job['file_size'] = file_size
        job['file_size_str'] = format_file_size(file_size)
        
    except Exception as e:
        job['status'] = 'error'
        job['error'] = str(e)
        job['stage'] = f"Erro no processamento: {str(e)}"

def format_file_size(num_bytes: int) -> str:
    """Formats bytes to KB / MB."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    else:
        return f"{num_bytes / (1024 * 1024):.1f} MB"

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    return jobs.get(job_id)

def get_recent_jobs() -> list:
    """Returns completed or active jobs, newest first."""
    sorted_jobs = sorted(jobs.values(), key=lambda j: j.get('created_at', 0), reverse=True)
    return [
        {
            'id': j['id'],
            'title': j.get('title'),
            'thumbnail': j.get('thumbnail'),
            'start_str': j.get('start_str'),
            'end_str': j.get('end_str'),
            'filename': j.get('filename'),
            'file_size_str': j.get('file_size_str', ''),
            'status': j.get('status'),
            'progress': j.get('progress', 0),
            'stage': j.get('stage', ''),
        }
        for j in sorted_jobs[:10]
    ]
