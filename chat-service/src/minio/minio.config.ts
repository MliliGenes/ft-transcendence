import type { ConfigService } from '@nestjs/config';
import type { ClientOptions } from 'minio';

function required(config: ConfigService, key: string): string {
  return config.getOrThrow<string>(key);
}

function port(config: ConfigService, key: string): number {
  const value = Number(required(config, key));
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${key} must be a valid TCP port`);
  }
  return value;
}

function useSsl(config: ConfigService, key: string): boolean {
  const value = required(config, key).toLowerCase();
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${key} must be true or false`);
  }
  return value === 'true';
}

function clientOptions(
  config: ConfigService,
  endpointKey: string,
  portKey: string,
  sslKey: string,
): ClientOptions {
  return {
    endPoint: required(config, endpointKey),
    port: port(config, portKey),
    useSSL: useSsl(config, sslKey),
    accessKey: required(config, 'MINIO_ACCESS_KEY'),
    secretKey: required(config, 'MINIO_SECRET_KEY'),
  };
}

export function minioClientOptions(config: ConfigService): ClientOptions {
  return clientOptions(
    config,
    'MINIO_ENDPOINT',
    'MINIO_PORT',
    'MINIO_USE_SSL',
  );
}

export function minioPresignClientOptions(config: ConfigService): ClientOptions {
  return clientOptions(
    config,
    'MINIO_PUBLIC_ENDPOINT',
    'MINIO_PUBLIC_PORT',
    'MINIO_PUBLIC_USE_SSL',
  );
}

export function minioBucket(config: ConfigService): string {
  return required(config, 'MINIO_BUCKET');
}
