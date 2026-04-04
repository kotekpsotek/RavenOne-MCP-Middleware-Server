FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY types ./types
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=8000
ENV ConfigFilePath=/app/config/mcpConfig.json
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001 -G nodejs
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY config/mcpConfig.example.json ./config/mcpConfig.example.json
RUN mkdir -p /app/config && chown -R appuser:nodejs /app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '8000') + '/ping').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"
USER appuser
CMD ["node", "dist/index.js"]