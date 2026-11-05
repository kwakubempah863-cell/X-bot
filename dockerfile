FROM node:20-slim

# Install Python, ffmpeg, and yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    git \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && python3 -m pip install --break-system-packages --upgrade "yt-dlp>=2025.05.22" \
    && python3 -m pip install --break-system-packages --upgrade bgutil-ytdlp-pot-provider \
    && git clone --single-branch --branch 2.0.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/pot-provider \
    && cd /opt/pot-provider/server \
    && npm ci \
    && npx tsc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the React dashboard
RUN npm run build

# Render expects the app to listen on 10000
EXPOSE 10000

# Start the bot
CMD ["sh", "/app/docker-entrypoint.sh"]