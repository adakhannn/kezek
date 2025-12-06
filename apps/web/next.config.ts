import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // eslint проверки включены по умолчанию в Next.js 16
    typescript: { ignoreBuildErrors: false },  // билд падает при ошибках типов
};

export default nextConfig;
