import os
import json
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.downloader import (
    extract_video_info,
    start_clip_download,
    get_job,
    get_recent_jobs,
    DOWNLOADS_DIR,
)

app = FastAPI(
    title="YouTube Video Cutter & Downloader",
    description="Baixe cortes específicos de vídeos do YouTube em alta qualidade MP4",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoInfoRequest(BaseModel):
    url: str = Field(..., description="URL do vídeo do YouTube")

class DownloadClipRequest(BaseModel):
    url: str = Field(..., description="URL do vídeo do YouTube")
    start_time: str = Field("00:00", description="Minuto inicial (ex: 01:30 ou 90)")
    end_time: str = Field("01:00", description="Minuto final (ex: 02:45 ou 165)")
    quality: str = Field("best", description="Qualidade (best, 1080p, 720p, 480p)")
    format_type: str = Field("mp4", description="Formato (mp4 ou audio)")

@app.post("/api/info")
async def get_info(req: VideoInfoRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL inválida ou vazia.")
    try:
        # Run in threadpool so it doesn't block the async event loop
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, extract_video_info, url)
        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao obter informações do vídeo: {str(e)}")

@app.post("/api/download")
async def download_clip(req: DownloadClipRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL inválida ou vazia.")
    try:
        job_id = start_clip_download(
            url=url,
            start_time=req.start_time,
            end_time=req.end_time,
            quality=req.quality,
            format_type=req.format_type
        )
        return {"job_id": job_id, "status": "queued"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Não foi possível iniciar o download: {str(e)}")

@app.get("/api/progress/{job_id}")
async def stream_progress(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabalho não encontrado.")

    async def event_generator():
        last_progress = -1
        last_stage = ""
        while True:
            cur_job = get_job(job_id)
            if not cur_job:
                break
                
            payload = {
                "id": cur_job["id"],
                "status": cur_job["status"],
                "progress": cur_job.get("progress", 0),
                "speed_str": cur_job.get("speed_str", ""),
                "eta_str": cur_job.get("eta_str", ""),
                "stage": cur_job.get("stage", ""),
                "filename": cur_job.get("filename"),
                "file_size_str": cur_job.get("file_size_str", ""),
                "error": cur_job.get("error"),
            }
            
            # Send SSE event
            yield f"data: {json.dumps(payload)}\n\n"
            
            if cur_job["status"] in ("completed", "error"):
                break
                
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/api/file/{job_id}")
async def download_file(job_id: str):
    job = get_job(job_id)
    if not job or job.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Arquivo não encontrado ou processamento incompleto.")
        
    file_path = job.get("output_file")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo não existe no servidor.")
        
    filename = job.get("filename") or os.path.basename(file_path)
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="video/mp4" if filename.endswith(".mp4") else "audio/mpeg",
        content_disposition_type="attachment"
    )

@app.get("/api/preview-video/{job_id}")
async def preview_video(job_id: str):
    job = get_job(job_id)
    if not job or job.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    file_path = job.get("output_file")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo não existe.")
    return FileResponse(path=file_path, media_type="video/mp4")

@app.get("/api/history")
async def get_history():
    return {"history": get_recent_jobs()}

# Static files setup
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

@app.get("/")
async def root():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Servidor do Downloader ativo."}

app.mount("/static", StaticFiles(directory=static_dir), name="static")
