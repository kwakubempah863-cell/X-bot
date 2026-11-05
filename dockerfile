# Use a Node.js image that includes common tools
FROM node:20-slim

# Install Python (required for yt-dlp), ffmpeg, and yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your bot's code
COPY . .

# Build the dashboard (if needed for your Fastify SPA serving)
RUN npm run build

# Expose the port Render expects
EXPOSE 10000

# Start the bot
CMD ["npm", "start"]