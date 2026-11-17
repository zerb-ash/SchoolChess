/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@schoolchess/chess-core',
    '@schoolchess/shared-types',
    '@schoolchess/tab-sync',
  ],
};

export default nextConfig;

