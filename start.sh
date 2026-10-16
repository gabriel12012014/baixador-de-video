#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Check if .venv exists, otherwise create it
if [ ! -d ".venv" ]; then
    echo "📦 Criando ambiente virtual Python..."
    python3 -m venv .venv
    source .venv/bin/activate
    echo "⬇️ Instalando dependências..."
    pip install -r requirements.txt
else
    source .venv/bin/activate
fi

# Run python server and open browser
python3 run.py
