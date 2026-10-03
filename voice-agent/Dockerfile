# REI live voice agent, for LiveKit Cloud (`lk agent create` / `lk agent deploy`) or any Docker host.
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agent.py .
# Bake the VAD and turn-detector model weights into the image so calls don't wait on downloads.
RUN python agent.py download-files
CMD ["python", "agent.py", "start"]
