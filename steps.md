# Backend

## Setup uv 

```bash 
cd backend
uv python install 3.12
uv venv --python 3.12 .venv
source .venv/bin/activate
cp .env.example .env
uv lock
uv sync

# works from project root
uv run uvicorn parsearena.main:app --reload
```


# Frontend

## Setup

```bash 

cd frontend

npm install

npm run dev
http://localhost:3000

```

# Env dependcy 
```bash 
- add Unstructured
- new env for minueru
```


```bash 
Tier 1:
Marker
Docling
Unstructured
LlamaParse

Baseline:
PyMuPDF
```