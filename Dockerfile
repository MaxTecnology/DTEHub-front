# ─── Stage 1: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências primeiro (aproveita cache do Docker)
COPY package*.json ./
RUN npm ci --prefer-offline

# Copia o restante do código
COPY . .

# Variáveis de ambiente injetadas em build time pelo Dokploy / CI
# Vite embute os valores VITE_* diretamente no bundle estático
ARG VITE_API_BASE_URL
ARG VITE_APP_NAME
ARG VITE_APP_LOGO_LIGHT
ARG VITE_APP_LOGO_DARK

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_LOGO_LIGHT=$VITE_APP_LOGO_LIGHT
ENV VITE_APP_LOGO_DARK=$VITE_APP_LOGO_DARK

RUN npm run build

# ─── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:stable-alpine AS runner

# Remove config padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia config customizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia o build gerado pelo Vite
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
