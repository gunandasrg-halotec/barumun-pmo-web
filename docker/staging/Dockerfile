# --- Stage 1: Build Stage ---
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build the application
COPY . .
RUN npm run build

COPY docker/staging/.env.example /app/.env

# --- Stage 2: Serve Stage ---
FROM nginx:1.27-alpine
# Copy built assets from builder stage to nginx server directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY docker/staging/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
