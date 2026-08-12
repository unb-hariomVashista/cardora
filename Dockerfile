# --- Build Stage ---
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
RUN npm install -g pnpm
WORKDIR /app

# Install all dependencies (including devDependencies) to run the build
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# --- Production Runner Stage ---
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
RUN npm install -g pnpm
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

# Copy Prisma schema and migrations (needed for migrations on startup)
COPY --from=builder /app/prisma ./prisma
RUN pnpm prisma generate

# Copy built assets
COPY --from=builder /app/build ./build

EXPOSE 3000

# Start application using docker-start script (runs migration & boots server)
CMD ["pnpm", "run", "docker-start"]
