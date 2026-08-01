FROM node:22.16.0-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat && corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @edu/api... --no-frozen-lockfile
COPY apps/api apps/api
RUN pnpm --filter @edu/api prisma:generate && pnpm --filter @edu/api build

FROM node:22.16.0-alpine
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat && corepack enable
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @edu/api... --prod --no-frozen-lockfile
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
