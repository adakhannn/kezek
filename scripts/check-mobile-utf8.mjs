import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MOBILE_SRC_DIR = path.join(ROOT, 'apps', 'mobile', 'src');
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md']);
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile() && ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const files = await walk(MOBILE_SRC_DIR);
  const issues = [];

  for (const filePath of files) {
    const bytes = await fs.readFile(filePath);

    try {
      const text = utf8Decoder.decode(bytes);

      if (text.includes('\uFFFD')) {
        issues.push({
          file: filePath,
          reason: 'Contains replacement character U+FFFD (�).',
        });
      }
    } catch {
      issues.push({
        file: filePath,
        reason: 'Invalid UTF-8 byte sequence.',
      });
    }
  }

  if (issues.length > 0) {
    console.error('[check-mobile-utf8] Failed: encoding issues detected.');
    for (const issue of issues) {
      console.error(`- ${path.relative(ROOT, issue.file)}: ${issue.reason}`);
    }
    process.exit(1);
  }

  console.log(
    `[check-mobile-utf8] OK: checked ${files.length} files in apps/mobile/src.`,
  );
}

main().catch((error) => {
  console.error('[check-mobile-utf8] Unexpected error:', error);
  process.exit(1);
});

