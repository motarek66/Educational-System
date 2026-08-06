import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const required = [
  'apps/web/src/app/App.tsx',
  'apps/web/src/styles/tokens.css',
  'apps/api/src/app.module.ts',
  'apps/api/prisma/schema.prisma',
  'apps/api/prisma/migrations/202607270001_init/migration.sql',
  'docs/student_management_system_full_spec.md',
  'docker-compose.yml',
];

const errors = [];
for (const file of required) {
  try {
    const info = await stat(join(root, file));
    if (!info.isFile() || info.size === 0) errors.push(`${file}: missing or empty`);
  } catch {
    errors.push(`${file}: missing`);
  }
}

async function walk(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(absolute)));
    else output.push(absolute);
  }
  return output;
}

const files = await walk(root);
for (const file of files) {
  const rel = relative(root, file);
  if (rel.endsWith('.json')) {
    try {
      JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      errors.push(`${rel}: invalid JSON (${error.message})`);
    }
  }
}


for (const file of files.filter((item) => /\.(ts|tsx|js|mjs)$/.test(item))) {
  const source = await readFile(file, 'utf8');
  const imports = [...source.matchAll(/(?:from\s+|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g)];
  for (const match of imports) {
    const specifier = match[2];
    const base = join(file, '..', specifier);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, 'index.ts'), join(base, 'index.tsx'), join(base, 'index.js')];
    let resolved = false;
    for (const candidate of candidates) {
      try {
        if ((await stat(candidate)).isFile()) { resolved = true; break; }
      } catch {}
    }
    if (!resolved) errors.push(`${relative(root, file)}: unresolved relative import ${specifier}`);
  }
}

const tokenCss = await readFile(join(root, 'apps/web/src/styles/tokens.css'), 'utf8');
for (const token of ['--color-primary-500', '--color-gray-50', '--color-gray-900', '--font-family-base']) {
  if (!tokenCss.includes(token)) errors.push(`tokens.css: missing ${token}`);
}
if (!tokenCss.includes('#f5f7fa') || !tokenCss.includes('#0e121b')) {
  errors.push('tokens.css: required gray endpoints are missing');
}

const prisma = await readFile(join(root, 'apps/api/prisma/schema.prisma'), 'utf8');
for (const model of ['Student', 'Guardian', 'Enrollment', 'Lesson', 'AttendanceRecord', 'Exam', 'Grade', 'AuditLog']) {
  if (!new RegExp(`model\\s+${model}\\s+\\{`).test(prisma)) errors.push(`schema.prisma: missing model ${model}`);
}
if (!prisma.includes('@@unique([lessonId, enrollmentId])')) {
  errors.push('schema.prisma: duplicate attendance constraint is missing');
}

if (errors.length) {
  console.error('Source checks failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Source checks passed (${files.length} files inspected).`);
