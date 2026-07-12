import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";
    const connectSources = [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      ...(isDevelopment
        ? [
            "http://127.0.0.1:*",
            "ws://127.0.0.1:*",
            "http://localhost:*",
            "ws://localhost:*",
          ]
        : []),
    ];
    const contentSecurityPolicy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self' data:",
      `connect-src ${connectSources.join(" ")}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
    ].join("; ");

    return [
      {
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(), microphone=()",
          },
          ...(!isDevelopment
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
        source: "/(.*)",
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
