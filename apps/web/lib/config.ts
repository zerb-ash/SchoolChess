export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  // Strip trailing slashes and trailing /api to avoid double /api/api in request paths
  return raw.replace(/\/+$/, '').replace(/\/api$/, '');
}

export function getWsBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001/ws/game';
  return raw.replace(/\/+$/, '');
}

