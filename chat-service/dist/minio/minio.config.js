function required(config, key) {
    return config.getOrThrow(key);
}
function port(config, key) {
    const value = Number(required(config, key));
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new Error(`${key} must be a valid TCP port`);
    }
    return value;
}
function useSsl(config, key) {
    const value = required(config, key).toLowerCase();
    if (value !== 'true' && value !== 'false') {
        throw new Error(`${key} must be true or false`);
    }
    return value === 'true';
}
function clientOptions(config, endpointKey, portKey, sslKey) {
    return {
        endPoint: required(config, endpointKey),
        port: port(config, portKey),
        useSSL: useSsl(config, sslKey),
        region: config.get('MINIO_REGION') ?? 'us-east-1',
        accessKey: required(config, 'MINIO_ACCESS_KEY'),
        secretKey: required(config, 'MINIO_SECRET_KEY'),
    };
}
export function minioClientOptions(config) {
    return clientOptions(config, 'MINIO_ENDPOINT', 'MINIO_PORT', 'MINIO_USE_SSL');
}
export function minioPresignClientOptions(config) {
    return clientOptions(config, 'MINIO_PUBLIC_ENDPOINT', 'MINIO_PUBLIC_PORT', 'MINIO_PUBLIC_USE_SSL');
}
export function minioBucket(config) {
    return required(config, 'MINIO_BUCKET');
}
//# sourceMappingURL=minio.config.js.map