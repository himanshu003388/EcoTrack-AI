# Stage 1: Build client and server
FROM node:20-slim AS builder
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy project files
COPY . .

# Run production build for client and server
RUN npm run build

# Stage 2: Production environment
FROM node:20-slim
WORKDIR /app

# Set node env to production
ENV NODE_ENV=production

# Copy dependency files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy the persistence schema to match the expected directory path in the built server code
COPY --from=builder /app/src/infrastructure/persistence/schema.sql ./dist/infrastructure/persistence/schema.sql

# Expose port 8080 (Cloud Run default)
EXPOSE 8080
ENV PORT=8080

# Start the application server
CMD ["node", "dist/presentation/api/server.js"]
