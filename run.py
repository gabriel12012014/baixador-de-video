import uvicorn
import webbrowser
import threading
import time

def open_browser():
    time.sleep(1.2)
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    print("==================================================")
    print("🎬 Iniciando ClipTube Studio...")
    print("🚀 Abrindo no navegador: http://localhost:8000")
    print("==================================================")
    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
