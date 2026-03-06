import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8080"
const defaultAllowedHosts = ["cd.mihouo.com"]

const resolveAllowedHosts = () => {
  const rawHosts = process.env.VITE_ALLOWED_HOSTS
  const hosts = rawHosts
    ? rawHosts.split(",").map((host) => host.trim()).filter(Boolean)
    : defaultAllowedHosts

  return Array.from(new Set(hosts))
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: resolveAllowedHosts(),
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/d": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
})
