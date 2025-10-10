# ---- Stage 1: download the PocketBase binary ---------------------------------
FROM alpine:3 AS downloader

ARG TARGETOS
ARG TARGETARCH
ARG TARGETVARIANT
ARG VERSION

# Buildx exposes TARGETARCH/TARGETOS/TARGETVARIANT, build a composite for the asset name
ENV BUILDX_ARCH="${TARGETOS:-linux}_${TARGETARCH:-amd64}${TARGETVARIANT}"

# download specified version of pocketbase for the target architecture
RUN wget "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_${BUILDX_ARCH}.zip" \
    && unzip pocketbase_${VERSION}_${BUILDX_ARCH}.zip \
    && chmod +x /pocketbase

# ---- Stage 2: final runtime image -------------------------------------------
FROM alpine:3

# install certs & timezone data for SSL + correct time handling
RUN apk update && apk add --no-cache ca-certificates tzdata && rm -rf /var/cache/apk/*

# copy pocketbase binary from downloader stage
COPY --from=downloader /pocketbase /app/pocketbase

# copy public assets and migrations (if any) into image
COPY pb_public /app/pb_public
COPY pb_migrations /app/pb_migrations

# expose default port (can be mapped externally)
EXPOSE 8090

# run pocketbase serving HTTP on 0.0.0.0:8090
ENTRYPOINT ["/app/pocketbase", "serve", "--http=0.0.0.0:8090"]
