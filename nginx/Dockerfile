FROM nginx:stable-alpine
RUN apk add --no-cache openssl
COPY default.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /usr/local/bin/gateway-entrypoint.sh
RUN chmod 755 /usr/local/bin/gateway-entrypoint.sh
EXPOSE 443
ENTRYPOINT ["/usr/local/bin/gateway-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
