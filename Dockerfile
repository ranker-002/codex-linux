# Multi-stage build for Codex Linux

# Stage 1: Build
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/cli/package*.json ./packages/cli/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S codex && \
    adduser -S codex -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/assets ./assets

# Create necessary directories
RUN mkdir -p /home/codex/.config/codex && \
    chown -R codex:codex /home/codex && \
    chown -R codex:codex /app

# Switch to non-root user
USER codex

# Expose ports
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start application
CMD ["node", "dist/main/main.js"]