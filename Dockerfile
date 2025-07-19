# syntax=docker/dockerfile:experimental

##### 第一阶段：按当前平台构建 Web 静态资源 #####
FROM --platform=$BUILDPLATFORM oven/bun:latest AS web-builder

# bun 镜像是 Debian 系，所以用 apt
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git openssh-client ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && ssh-keyscan github.com >> /etc/ssh/ssh_known_hosts

WORKDIR /build

COPY web/package.json web/package-lock.json* ./
RUN bun install

COPY web/ ./
COPY VERSION ./
RUN DISABLE_ESLINT_PLUGIN='true' \
    VITE_REACT_APP_VERSION="$(cat VERSION)" \
    bun run build


##### 第二阶段：多平台 Go 二进制编译 #####
FROM --platform=$BUILDPLATFORM golang:alpine AS builder2

ARG TARGETOS
ARG TARGETARCH

ENV GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=${TARGETOS} \
    GOARCH=${TARGETARCH}

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

# 把后端源码和前端产物都拷进来
COPY . .
COPY --from=web-builder /build/dist ./web/dist

RUN go build \
    -ldflags "-s -w -X 'one-api/common.Version=$(cat VERSION)'" \
    -o one-api


##### 第三阶段：瘦身运行时镜像 #####
FROM alpine:3.18

# 更新索引并安装运行时依赖
RUN apk update && apk upgrade && \
    apk add --no-cache \
      ca-certificates \
      tzdata \
      ffmpeg \
 && update-ca-certificates

COPY --from=builder2 /build/one-api /one-api

EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/one-api"]