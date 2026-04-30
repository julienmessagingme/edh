/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // node-cron uses worker_threads + Node's stream API which webpack can't
  // bundle. Mark it as external so Node requires it natively at runtime.
  serverExternalPackages: ["node-cron"],
  experimental: {
    optimizePackageImports: ["recharts", "date-fns", "lucide-react", "@supabase/supabase-js"],
  },
};

export default nextConfig;
