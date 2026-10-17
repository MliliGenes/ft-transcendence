export function getPort(value: string | undefined): number {
  if (value === undefined) {
    return 3001;
  }

  const port = Number(value);

  if (!/^[0-9]+$/.test(value) || port < 1 || port > 65535) {
    throw new Error('PORT must be a whole number from 1 to 65535.');
  }

  return port;
}
