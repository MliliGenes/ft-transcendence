# Community images are unavailable; build the archived upstream source.
FROM golang:1 AS build
WORKDIR /src
RUN git init && git fetch --depth 1 https://github.com/minio/minio.git 7aac2a2c5b7c882e68c1ce017d8256be2feea27f && git checkout FETCH_HEAD
RUN CGO_ENABLED=0 go build -trimpath -o /minio .

FROM alpine:3
RUN apk add --no-cache ca-certificates
COPY --from=build /minio /usr/local/bin/minio
ENTRYPOINT ["minio"]
