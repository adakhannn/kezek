import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentationFiles, repoRoot } from './docs-lib.mjs';

export function generateDocsCatalog() {
    const records = documentationFiles();
    const sections = [
        ['current', 'Руководства и справочники'],
        ['design', 'Архитектурные решения и сценарии'],
        ['history', 'Исторические планы и отчёты'],
        ['evidence', 'Учёт проверок и передача кампаний'],
        ['instructions', 'Инструкции работы с репозиторием'],
    ];
    const result = ['# Каталог документов', '',
        'Статус: автоматически построенная навигация. Начать работу помогает [основной индекс](README.md); этот каталог позволяет найти остальные материалы.', '',
        'Категория определяется путём и явным статусом документа, а не оценкой достоверности содержания. Метод и дату наблюдения читать в самом документе; отсутствие даты не означает свежую проверку. Каталоги первичных evidence и визуальных baseline не обходятся: читать их через handoff по выбранному вопросу.', '',
        'Генератор: `node scripts/generate-docs-catalog.mjs --write`; проверка: `node scripts/generate-docs-catalog.mjs --check`. Новые Markdown-файлы в корне, docs, apps, packages и supabase обнаруживаются автоматически; зависимости, build output и локальная .expo исключены.', ''];
    for (const [kind, title] of sections) {
        const group = records.filter(record => record.kind === kind);
        result.push(`## ${title}`, '', `Документов: ${group.length}.`, '', '| Документ | Путь |', '| --- | --- |');
        for (const record of group) {
            const target = path.posix.relative('docs', record.file);
            result.push(`| [${record.title.replace(/\|/g, '\\|').replace(/[\[\]]/g, '')}](${target}) | \`${record.file}\` |`);
        }
        result.push('');
    }
    return result.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const file = path.join(repoRoot, 'docs/DOCUMENTATION_MAP.md');
    if (process.argv.includes('--write')) {
        if (!fs.existsSync(file)) fs.writeFileSync(file, '# Каталог документов\n');
        fs.writeFileSync(file, generateDocsCatalog());
        console.log('Updated docs/DOCUMENTATION_MAP.md.');
    } else if (process.argv.includes('--check')) {
        if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== generateDocsCatalog()) { console.error('Documentation catalog is stale; run node scripts/generate-docs-catalog.mjs --write'); process.exitCode = 1; }
        else console.log('Documentation catalog matches discovered Markdown files.');
    } else { console.error('Use --check or --write.'); process.exitCode = 1; }
}
