import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeMojibake } from './check-encoding.mjs';

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
