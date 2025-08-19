# Dockerfile for Challenge 1C: FastAPI backend + React frontend static files
# Build stage for frontend

# --- Frontend build stage with dynamic Adobe API key ---
FROM node:20 AS frontend-build
WORKDIR /app/frontend

# Accept build argument for Adobe API key
ARG REACT_APP_ADOBE_EMBED_API_KEY

COPY ../frontend/package.json ../frontend/package-lock.json ./
RUN npm install
COPY ../frontend ./

# Inject .env file with dynamic Adobe API key
RUN echo "REACT_APP_ADOBE_EMBED_API_KEY=$REACT_APP_ADOBE_EMBED_API_KEY" > .env

RUN npm run build

# Backend stage
FROM python:3.11-slim AS backend
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy backend code
COPY ./backend ./backend

# Copy frontend build output to backend/dist
COPY --from=frontend-build /app/frontend/build ./backend/dist

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r ./backend/requirements.txt

# Expose port
EXPOSE 8080

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Start FastAPI app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]