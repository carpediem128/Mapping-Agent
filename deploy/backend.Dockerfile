FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONUTF8=1 PORT=4173
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY agent ./agent
COPY server ./server
COPY scripts ./scripts
COPY web ./web
COPY config/default_config.json ./config/default_config.json
COPY deploy ./deploy
COPY web_server_v1.py ./
RUN mkdir -p /app/runs /app/web/data /app/web/artifacts
EXPOSE 4173
CMD ["python", "-m", "deploy.production_server"]
