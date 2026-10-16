# Imagem base oficial do Python
FROM python:3.11-slim

# Evita que o Python gere arquivos .pyc e ativa buffer de saída imediato
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Instala FFmpeg e Node.js (necessário para o yt-dlp decifrar algoritmos do YouTube)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências do Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia os arquivos do projeto
COPY . .

# Cria pasta de downloads
RUN mkdir -p downloads

# Expõe a porta padrão
EXPOSE 8000

# Inicia o servidor Uvicorn (usando a variável PORT se definida pelo provedor, ou 8000)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
