/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true, // Crucial for static routing inside Android WebViews
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
