'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Компонент логотипа Kezek
 * Поддерживает как изображение, так и текстовый вариант
 */
export function Logo() {
    const [imageError, setImageError] = useState(false);

    return (
        <Link href="/" className="flex items-center gap-3 group">
            {!imageError ? (
                // Пытаемся загрузить изображение логотипа (сначала PNG, потом SVG)
                <div className="relative h-12 sm:h-14 w-auto">
                    <Image
                        src="/logo.png"
                        alt="КЕЗЕК CRM СИСТЕМА"
                        width={200}
                        height={56}
                        className="h-12 sm:h-14 w-auto object-contain"
                        priority
                        onError={() => {
                            // Если PNG не загрузился, пробуем SVG
                            const img = document.querySelector('img[src="/logo.png"]') as HTMLImageElement;
                            if (img) {
                                img.src = '/logo.svg';
                                img.onerror = () => setImageError(true);
                            } else {
                                setImageError(true);
                            }
                        }}
                    />
                </div>
            ) : (
                // Текстовый вариант (показывается если изображение не загрузилось)
                <div className="relative flex items-center gap-2">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                    <span className="relative text-2xl font-bold gradient-text">Kezek</span>
                </div>
            )}
        </Link>
    );
}

