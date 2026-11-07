FROM nginx:stable-alpine
RUN apk add --no-cache openssl
COPY default.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 entrypoint.sh /usr/local/bin/gateway-entrypoint.sh
EXPOSE 443 9443
ENTRYPOINT ["/usr/local/bin/gateway-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
