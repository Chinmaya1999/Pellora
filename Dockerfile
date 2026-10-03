FROM python:3.12-slim
WORKDIR /srv
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# the 56 MB landmark model is not kept in git; fetch it at build time
RUN [ -f models/lbfmodel.yaml ] || ./download_models.sh
ENV PORT=8000 WORKERS=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fs http://localhost:${PORT}/health || exit 1
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WORKERS}
