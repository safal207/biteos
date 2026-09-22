FROM node:24-alpine AS web
WORKDIR /src
RUN npm install -g pnpm@11.19.0
COPY apps/kiosk/package.json apps/kiosk/pnpm-lock.yaml apps/kiosk/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/kiosk/ ./
RUN pnpm build

FROM golang:1.26-alpine AS api
WORKDIR /src
COPY services/api/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /biteos-api .

FROM alpine:3.23
RUN addgroup -S biteos && adduser -S biteos -G biteos && mkdir /data && chown biteos:biteos /data
WORKDIR /app
COPY --from=api /biteos-api /app/biteos-api
COPY --from=web /src/dist /app/web
USER biteos
ENV ADDR=0.0.0.0:8090 WEB_DIR=/app/web ORDER_STORE=/data/orders.json ENGINE_URL=http://recommender:8091
EXPOSE 8090
CMD ["/app/biteos-api"]
