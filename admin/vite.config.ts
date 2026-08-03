import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let gitHash = 'unknown';
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {}

function readVersion(path: string): string {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

process.env.VITE_GIT_HASH = gitHash;
process.env.VITE_ADMIN_VERSION = readVersion(resolve(__dirname, 'package.json'));
process.env.VITE_FRONTEND_VERSION = readVersion(resolve(__dirname, '../frontend/package.json'));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
});
