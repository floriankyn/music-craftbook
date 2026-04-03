FROM node:22-slim AS base

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install ffmpeg, ca-certificates, and python3 (needed by yt-dlp for comment extraction)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates python3 && \
    rm -rf /var/lib/apt/lists/*

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy yt-dlp binary
COPY --from=builder --chown=nextjs:nodejs /app/bin/yt-dlp_linux ./bin/yt-dlp_linux
RUN chmod +x ./bin/yt-dlp_linux

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
