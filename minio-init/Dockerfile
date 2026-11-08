# One-shot MinIO provisioning. Community images are unavailable (see ../minio),
# so build the mc client from source at a pinned release.
FROM golang:1 AS build
RUN CGO_ENABLED=0 go install -trimpath github.com/minio/mc@RELEASE.2025-08-13T08-35-41Z

FROM alpine:3
RUN apk add --no-cache ca-certificates
COPY --from=build /go/bin/mc /usr/local/bin/mc
COPY init.sh /init.sh
ENTRYPOINT ["sh", "/init.sh"]
