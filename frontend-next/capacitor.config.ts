import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.moviesearch.app",
  appName: "MovieSearch Pro",
  webDir: "out",
  server: {
    url: "https://movie-search-omega-opal.vercel.app",
    cleartext: true,
  },
};

export default config;
