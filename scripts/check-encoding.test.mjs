import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    decodeMojibake,
    decodeMojibakeDeep,
    decodePunctuationMojibake,
    findEncodingProblems,
    looksGarbled,
} from './check-encoding.mjs';

// What a UTF-8 string looks like after being read as Windows-1251 once.
const garble = (text) => new TextDecoder('windows-1251').decode(new TextEncoder().encode(text));

test('decodes Windows-1251-garbled UTF-8 Cyrillic', () => {
    assert.equal(decodeMojibake('РќРµ СѓРґР°Р»РѕСЃСЊ'), 'Не удалось');
    assert.equal(decodeMojibake('РўРµСЃС‚'), 'Тест');
    assert.equal(decodeMojibake('Р’СЃ'), 'Вс');
});

test('leaves real Russian text alone', () => {
    for (const text of ['Не удалось', 'Сб', 'Ср', 'Рёбра', 'Сообщение', 'Расписание', 'Сотрудник']) {
        assert.equal(decodeMojibake(text), null, text);
    }
});

test('ignores characters outside Windows-1251', () => {
    assert.equal(decodeMojibake('Р🙂С'), null);
});

test('decodes text garbled more than once', () => {
    assert.equal(decodeMojibakeDeep(garble(garble('Предстоящие записи'))), 'Предстоящие записи');
    assert.equal(decodeMojibakeDeep(garble(garble(garble('Нет записей')))), 'Нет записей');
    assert.equal(decodeMojibakeDeep('Расписание'), null);
});

test('decodes garbled typographic punctuation', () => {
    assert.equal(decodePunctuationMojibake('вЂ”'), '—');
    assert.equal(decodePunctuationMojibake('вЂ“'), '–');
    assert.equal(decodePunctuationMojibake('вЂ¦'), '…');
    assert.equal(decodePunctuationMojibake('В«'), '«');
    assert.equal(decodePunctuationMojibake('В»'), '»');
    assert.equal(decodePunctuationMojibake('В·'), '·');
    assert.equal(decodePunctuationMojibake('в„–'), '№');
    for (const text of ['вет', 'взя', 'Ва', 'Вы', 'вёл']) assert.equal(decodePunctuationMojibake(text), null, text);
});

test('flags text garbled at mixed levels and nothing in real text', () => {
    // A November 2026 fallback in the client cabinet: levels differ letter by letter.
    assert.equal(looksGarbled('РџСЂРВµРТ‘СЃС‚РѕСЏСвЂ°РёРВµ'), true);
    for (const text of ['Предстоящие записи', 'Сотрудник «Рёбра»', 'Кызматкердин жазылуулары', 'Тапшыруулардын тарыхы']) {
        assert.equal(looksGarbled(text), false, text);
    }
});

test('reports each kind with its line and leaves correct text alone', () => {
    const source = [
        "label: 'Мои записи',",
        "label: 'РќРµ СѓРґР°Р»РѕСЃСЊ',",
        "time: `${start}вЂ“${end}`,",
        "label: 'РџСЂРВµРТ‘СЃС‚РѕСЏСвЂ°РёРВµ',",
        "label: 'Раздел «Пакеты визитов» — пусто…',",
    ].join('\n');
    const problems = findEncodingProblems(source);
    assert.ok(problems.some((p) => p.startsWith('2: Windows-1251 mojibake') && p.includes('Не удалось')), problems.join('\n'));
    assert.ok(problems.some((p) => p.startsWith('3: Windows-1251 mojibake "вЂ“"')), problems.join('\n'));
    assert.ok(problems.some((p) => p.startsWith('4: garbled text')), problems.join('\n'));
    assert.ok(!problems.some((p) => p.startsWith('1:') || p.startsWith('5:')), problems.join('\n'));
});
