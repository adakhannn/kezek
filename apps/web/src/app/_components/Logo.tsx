import Image from 'next/image';
import Link from 'next/link';

/**
 * Компонент логотипа Kezek
 * Поддерживает как изображение, так и текстовый вариант
 */
export function Logo() {
    return (
        <Link href="/" className="flex items-center gap-3 group">
            {/* Пытаемся загрузить изображение логотипа */}
            <div className="relative h-10 w-auto">
                <Image
                    src="/logo.png"
                    alt="КЕЗЕК CRM СИСТЕМА"
                    width={120}
                    height={40}
                    className="h-10 w-auto object-contain"
                    priority
                    onError={(e) => {
                        // Если изображение не найдено, скрываем его и показываем текстовый вариант
                        const target = e.target as HTMLImageElement;
                        if (target.parentElement) {
                            target.parentElement.style.display = 'none';
                        }
                    }}
                />
            </div>
            {/* Текстовый вариант (показывается если изображение не загрузилось) */}
            <div className="relative flex items-center gap-2">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative text-2xl font-bold gradient-text">Kezek</span>
            </div>
        </Link>
    );
}

