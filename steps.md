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