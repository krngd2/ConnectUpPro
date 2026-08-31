import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i9.ytimg.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Suppress production source maps only
  productionBrowserSourceMaps: false,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js built-in modules from client-side bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        http2: false,
        assert: false,
        os: false,
        path: false,
        worker_threads: false,
        child_process: false,
        cluster: false,
        dgram: false,
        dns: false,
        events: false,
        punycode: false,
        querystring: false,
        readline: false,
        repl: false,
        tty: false,
        util: false,
        v8: false,
        vm: false,
        _stream_duplex: false,
        _stream_passthrough: false,
        _stream_readable: false,
        _stream_transform: false,
        _stream_writable: false,
      };

      // Handle node: prefixed imports by mapping them to false
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:buffer': false,
        'node:fs': false,
        'node:https': false,
        'node:http': false,
        'node:net': false,
        'node:child_process': false,
        'node:worker_threads': false,
        'node:crypto': false,
        'node:stream': false,
        'node:url': false,
        'node:zlib': false,
        'node:http2': false,
        'node:assert': false,
        'node:os': false,
        'node:path': false,
        'node:util': false,
        'node:events': false,
        'node:querystring': false,
        'node:punycode': false,
      };

      // Additional fallbacks for problematic packages
      config.externals = config.externals || [];
      config.externals.push({
        'googleapis': 'commonjs googleapis',
        'google-auth-library': 'commonjs google-auth-library',
      });
    }
    return config;
  },
};

export default nextConfig;
