import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    eslint: { ignoreDuringBuilds: false },     // теперь пусть билд падает при ошибках линта
    typescript: { ignoreBuildErrors: false },  // и при ошибках типов
};

export default nextConfig;
