import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Билд должен падать при ошибках типов
    typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
