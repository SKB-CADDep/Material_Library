FROM python:3.13-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home --shell /bin/bash app
COPY --chown=app:app backend ./backend
COPY --chown=app:app src ./src
COPY --chown=app:app config ./config
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
USER app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
