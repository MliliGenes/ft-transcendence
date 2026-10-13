FROM postgres:18-alpine

COPY --chmod=755 entrypoint.sh /usr/local/bin/test-db-entrypoint.sh

HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=12 \
  CMD pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"

ENTRYPOINT ["/usr/local/bin/test-db-entrypoint.sh"]
CMD ["postgres"]
