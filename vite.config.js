import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "redirect-readme-to-game",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/README.md" || req.url === "/README") {
            res.statusCode = 302;
            res.setHeader("Location", "/");
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  build: {
    assetsDir: "assets",
  },
});
