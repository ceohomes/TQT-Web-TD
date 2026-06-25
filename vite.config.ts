import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Helper to strip diacritics, spaces, and non-alphanumeric characters for robust comparison
function removeDiacriticsAndSpaces(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, '') // remove spaces
    .replace(/[^a-z0-9]/g, ''); // remove non-alphanumeric characters
}

// Helper to look up environment variables in a case-insensitive, space-flexible, and diacritics-insensitive way
function findEnvValue(possibleKeys: string[]): string {
  // 1. Try exact keys first
  for (const key of possibleKeys) {
    if (process.env[key] !== undefined) {
      return process.env[key] as string;
    }
  }

  const envKeys = Object.keys(process.env);

  // 2. Try case-insensitive exact match
  for (const key of possibleKeys) {
    const lowerKey = key.toLowerCase();
    for (const envKey of envKeys) {
      if (envKey.toLowerCase() === lowerKey) {
        return process.env[envKey] as string;
      }
    }
  }

  // 3. Try normalized (accentless, spaceless) matching
  const normalizedPossibles = possibleKeys.map(removeDiacriticsAndSpaces).filter(Boolean);
  for (const envKey of envKeys) {
    const normalizedEnvKey = removeDiacriticsAndSpaces(envKey);
    if (!normalizedEnvKey) continue;

    for (const normPossible of normalizedPossibles) {
      // Must match exactly after normalization to avoid false positives (e.g. USER matching GITHUB_USER)
      if (normalizedEnvKey === normPossible) {
        return process.env[envKey] as string;
      }
    }
  }

  return '';
}

const token = findEnvValue(['GitHub Personal Access Token', 'GITHUB_TOKEN', 'VITE_GITHUB_TOKEN', 'Personal Access Token', 'Personal Access']) || '';
const owner = findEnvValue(['GitHub Tài khoản', 'GitHub Tai khoan', 'GITHUB_OWNER', 'GITHUB_USER', 'CEOHomes']) || '';
const repoName = findEnvValue(['Tên repository (Tên kho)', 'Ten repository', 'Tên repository', 'GITHUB_REPO_NAME', 'GITHUB_REPO', 'CV-TQT']) || '';
const combinedRepo = findEnvValue(['GITHUB_REPO', 'GitHub repository']) || (owner && repoName ? `${owner}/${repoName}` : '');

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GITHUB_TOKEN': JSON.stringify(token),
    'import.meta.env.VITE_GITHUB_OWNER': JSON.stringify(owner),
    'import.meta.env.VITE_GITHUB_REPO_NAME': JSON.stringify(repoName),
    'import.meta.env.VITE_GITHUB_REPO': JSON.stringify(combinedRepo),
  },
  server: {
    // Cho phép SPA routing trong dev
    historyApiFallback: true,
  },
})
