FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY web/package*.json ./web/
RUN npm ci --prefix web
COPY web ./web
COPY topics ./topics
RUN npm run build --prefix web

FROM python:3.13-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 ROUNDTABLE_MODE=panel
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agents ./agents
COPY gateway ./gateway
COPY topics ./topics
COPY --from=frontend /app/web/dist ./web/dist
RUN mkdir -p logs/traces
EXPOSE 8000
CMD ["sh", "-c", "exec python -m uvicorn gateway.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
