FROM node:20-alpine
RUN apk add --no-cache openssl

# Install pnpm globally
RUN npm install -g pnpm

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and pnpm lockfile
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./

# Install dependencies using pnpm
RUN pnpm install --prod --frozen-lockfile

# Copy the rest of the application files
COPY . .

# Run build
RUN pnpm run build

# Start the app
CMD ["pnpm", "run", "docker-start"]
