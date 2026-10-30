/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { HomeHeader, HomeHero } from '@/app/_components/HomeClientComponents';
import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

const dictionaries = { ru, en, ky };

describe('Home counters use the actual count and locale', () => {
    it.each([
        ['ru', 0, 'вариантов', 'мест'],
        ['ru', 1, 'вариант', 'место'],
        ['ru', 2, 'варианта', 'места'],
        ['ru', 5, 'вариантов', 'мест'],
        ['ru', 11, 'вариантов', 'мест'],
        ['ru', 21, 'вариант', 'место'],
        ['en', 0, 'options', 'places'],
        ['en', 1, 'option', 'place'],
        ['en', 2, 'options', 'places'],
        ['en', 5, 'options', 'places'],
        ['en', 11, 'options', 'places'],
        ['en', 21, 'options', 'places'],
        ['ky', 0, 'вариант', 'жай'],
        ['ky', 1, 'вариант', 'жай'],
        ['ky', 2, 'вариант', 'жай'],
        ['ky', 5, 'вариант', 'жай'],
        ['ky', 11, 'вариант', 'жай'],
        ['ky', 21, 'вариант', 'жай'],
    ] as const)('%s/%i labels options and places', (locale, count, options, places) => {
        const dictionary = dictionaries[locale];
        (useLanguage as jest.Mock).mockReturnValue({
            locale,
            t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key,
        });
        render(
            <HomeHero totalBusinesses={count}>
                <HomeHeader q="" cat="" categories={[]} totalResults={count} />
            </HomeHero>,
        );
        expect(screen.getByText(`${count} ${options}`, { exact: true })).toBeTruthy();
        expect(screen.getByText(`${count} ${places}`, { exact: true })).toBeTruthy();
    });
});
