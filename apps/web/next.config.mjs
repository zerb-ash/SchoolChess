import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      '@schoolchess/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@schoolchess/chess-core': path.resolve(__dirname, '../../packages/chess-core/src/index.ts'),
      '@schoolchess/tab-sync': path.resolve(__dirname, '../../packages/tab-sync/src/index.ts'),
    };
    return config;
  },
};

export default nextConfig;
