# Stage 1: Build client and server with native compilation support
FROM node:20 AS builder
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install all dependencies with script lockdown, then rebuild native modules explicitly
RUN npm ci --ignore-scripts && npm cache clean --force
RUN npm rebuild --build-from-source

# Copy project files
COPY . .

# Run production build for client and server
RUN npm run build

# Prune devDependencies to leave only production packages in node_modules
RUN npm prune --omit=dev && npm cache clean --force

# Stage 2: Production environment
FROM node:20-slim
WORKDIR /app

# Create group and user first, so they are available for COPY --chown instructions
RUN groupadd -r ecotrack && useradd -r -g ecotrack ecotrack

# Set node env to production
ENV NODE_ENV=production

# Copy pruned dependencies from builder stage with correct ownership
COPY --from=builder --chown=ecotrack:ecotrack /app/node_modules ./node_modules

# Copy compiled assets from builder stage
COPY --from=builder --chown=ecotrack:ecotrack /app/dist ./dist

# Copy the persistence schema to match the expected directory path in the built server code
COPY --from=builder --chown=ecotrack:ecotrack /app/src/infrastructure/persistence/schema.sql ./dist/infrastructure/persistence/schema.sql

# Ensure ecotrack has permissions to create/write SQLite file in /app
RUN chown -R ecotrack:ecotrack /app

# Switch to the non-root user
USER ecotrack

# Expose port 8080 (Cloud Run default)
EXPOSE 8080
ENV PORT=8080

# Health check to verify the server is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').request({ hostname: 'localhost', port: 8080, path: '/api/auth/me', method: 'GET' }, (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1)).end()"

# Start the application server
CMD ["node", "dist/presentation/api/server.js"]
