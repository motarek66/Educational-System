# Railway service root directory: apps/api
FROM node:22.16.0-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@9.15.4 --activate
COPY package.json ./
RUN pnpm install --no-frozen-lockfile
COPY prisma prisma
COPY src src
COPY tsconfig.railway.json ./
RUN pnpm exec prisma generate && pnpm exec tsc -p tsconfig.railway.json

FROM node:22.16.0-alpine
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@9.15.4 --activate
ENV NODE_ENV=production
COPY package.json ./
RUN pnpm install --prod --no-frozen-lockfile
COPY prisma prisma
RUN pnpm exec prisma generate
COPY --from=build /app/dist dist
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec prisma db seed && exec node dist/main.js"]
