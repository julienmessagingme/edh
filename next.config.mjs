/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["recharts", "date-fns", "lucide-react", "@supabase/supabase-js"],
  },
};

export default nextConfig;
