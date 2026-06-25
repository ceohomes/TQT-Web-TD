import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Helper to look up environment variables in a case-insensitive, space-flexible way
function findEnvValue(possibleKeys: string[]): string {
  for (const key of possibleKeys) {
    if (process.env[key] !== undefined) {
      return process.env[key] as string;
    }
  }
  // Also try partial matches on keys (case-insensitive)
  for (const envKey of Object.keys(process.env)) {
    const lowerEnvKey = envKey.toLowerCase();
    for (const key of possibleKeys) {
      const lowerKey = key.toLowerCase();
      if (lowerEnvKey.includes(lowerKey)) {
        return process.env[envKey] as string;
      }
    }
  }
  return '';
}

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GITHUB_TOKEN': JSON.stringify(
      findEnvValue(['GitHub Personal Access Token', 'GITHUB_TOKEN', 'VITE_GITHUB_TOKEN', 'Personal Access Token', 'Personal Access']) || ''
    ),
    'import.meta.env.VITE_GITHUB_OWNER': JSON.stringify(
      findEnvValue(['GitHub Tài khoản', 'GitHub Tai khoan', 'GITHUB_OWNER', 'GITHUB_USER', 'CEOHomes']) || ''
    ),
    'import.meta.env.VITE_GITHUB_REPO_NAME': JSON.stringify(
      findEnvValue(['Tên repository (Tên kho)', 'Ten repository', 'Tên repository', 'GITHUB_REPO', 'CV-TQT']) || ''
    ),
  },
  server: {
    // Cho phép SPA routing trong dev
    historyApiFallback: true,
  },
})
