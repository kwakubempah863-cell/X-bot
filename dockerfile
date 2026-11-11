FROM node:20-slim

# Install Python and ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    curl \
    wget

# Install Cloudflare WARP (wgcf + wireproxy)
# Download wgcf and wireproxy (adjust versions if needed)
RUN wget -q https://github.com/ViRb3/wgcf/releases/download/v2.2.22/wgcf_2.2.22_linux_amd64 -O /usr/local/bin/wgcf && chmod +x /usr/local/bin/wgcf
RUN wget -q https://github.com/pufferffish/wireproxy/releases/download/v1.0.9/wireproxy_linux_amd64.tar.gz -O /tmp/wireproxy.tar.gz && tar -xzf /tmp/wireproxy.tar.gz -C /usr/local/bin/ && chmod +x /usr/local/bin/wireproxy

RUN pip3 install --break-system-packages "yt-dlp[default]"

RUN yt-dlp --version \
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