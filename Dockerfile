# Multi-stage build for optimized production image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY relay-server/package*.json ./relay-server/

# Install dependencies
RUN npm ci --only=production && \
    cd relay-server && npm ci --only=production

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 copilot

# Create necessary directories
RUN mkdir -p agent-data screenshots logs && \
    chown -R copilot:nodejs agent-data screenshots logs

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/relay-server/node_modules ./relay-server/node_modules

# Copy application code
COPY --chown=copilot:nodejs relay-server ./relay-server
COPY --chown=copilot:nodejs .env.example .env

# Switch to non-root user
USER copilot

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Environment
ENV NODE_ENV=production
ENV PORT=8080

# Start the relay server
CMD ["node", "relay-server/index.js"]
