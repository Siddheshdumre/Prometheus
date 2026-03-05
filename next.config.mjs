/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['ts-morph', 'typescript', 'source-map-support'],
    },
};

export default nextConfig;
