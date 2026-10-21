import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-sample-faces',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const urlPath = req.url ? req.url.split('?')[0] : '';
          if (urlPath.startsWith('/sample_faces/') || urlPath.startsWith('/faces/')) {
            const fileName = path.basename(urlPath);
            const localPath = path.resolve(import.meta.dirname, '../backend/data/sample_faces', fileName);
            if (fs.existsSync(localPath)) {
              res.setHeader('Content-Type', 'image/jpeg');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
              fs.createReadStream(localPath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
  ],
});
