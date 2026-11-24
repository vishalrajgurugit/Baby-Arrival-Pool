import type { NextConfig } from 'next';
const config: NextConfig = {
  async headers() {
    return [{source: '/:path*', headers: [
      {key:'Referrer-Policy', value:'no-referrer'},
      {key:'X-Robots-Tag', value:'noindex, nofollow'},
      {key:'X-Frame-Options', value:'DENY'},
      {key:'X-Content-Type-Options', value:'nosniff'},
    ]}];
  },
};
export default config;
