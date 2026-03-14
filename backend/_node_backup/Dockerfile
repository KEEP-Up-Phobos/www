FROM node:20-alpine

WORKDIR /app

# Install runtime utilities needed by healthchecks and Python for AI scripts
RUN apk update && \
    apk add --no-cache curl python3 py3-pip || \
    (sleep 5 && apk update && apk add --no-cache curl python3 py3-pip) || \
    wget --version > /dev/null 2>&1 || apk add --no-cache wget

# Install Python dependencies for auto-populate and AI scripts
RUN python3 -m pip install --break-system-packages --no-cache-dir \
    aiohttp asyncpg python-dotenv beautifulsoup4 2>/dev/null || \
    pip3 install --break-system-packages --no-cache-dir \
    aiohttp asyncpg python-dotenv beautifulsoup4 2>/dev/null || true

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --production --silent

# Copy application source
COPY . ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "main_server.js"]
