import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { formatRatingDisplayValue } from '@shared-client/rating';

import RatingBadge from '../../components/ui/RatingBadge';

// The badge is hidden from screen readers; the text is still drawn.
const hidden = { includeHiddenElements: true };

describe('RatingBadge (B2)', () => {
    test.each([
        [50, '2.5'],
        [100, '5.0'],
        [88, '4.4'],
        [4.5, '4.5'],
        [5, '5.0'],
        [0, '0.0'],
        [150, '5.0'],
    ])('a score of %p is shown as %p stars, like the web', (score, expected) => {
        expect(formatRatingDisplayValue(score)).toBe(expected);
        render(<RatingBadge rating={score} />);
        expect(screen.getByText(expected, hidden)).toBeTruthy();
    });

    test('the raw 0-100 score is never shown', () => {
        render(<RatingBadge rating={50} />);
        expect(screen.queryByText('50.0', hidden)).toBeNull();
    });

    test('no rating yet says so, as the web', () => {
        render(<RatingBadge rating={null} />);
        expect(screen.getByText('Недостаточно данных для рейтинга', hidden)).toBeTruthy();
        expect(screen.queryByText('-', hidden)).toBeNull();
    });
});
