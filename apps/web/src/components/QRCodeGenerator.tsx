'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';

type QRCodeGeneratorProps = {
    url: string;
    branchName: string;
    onClose?: () => void;
};

export default function QRCodeGenerator({ url, branchName, onClose }: QRCodeGeneratorProps) {
    const qrRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (!qrRef.current) return;

        setDownloading(true);
        try {
            // Получаем SVG элемент
            const svgElement = qrRef.current.querySelector('svg');
            if (!svgElement) return;

            // Клонируем SVG, чтобы не изменять оригинал
            const clonedSvg = svgElement.cloneNode(true) as SVGElement;
            
            // Устанавливаем размеры для canvas
            const size = 512; // Увеличиваем размер для лучшего качества
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Создаем data URL из SVG
            const svgData = new XMLSerializer().serializeToString(clonedSvg);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    // Очищаем canvas и рисуем изображение
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, size, size);

                    // Конвертируем в PNG и скачиваем
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            setDownloading(false);
                            return;
                        }
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `qr-code-${branchName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        URL.revokeObjectURL(svgUrl);
                        setDownloading(false);
                    }, 'image/png');
                } catch (error) {
                    console.error('Error processing image:', error);
                    setDownloading(false);
                }
            };

            img.onerror = () => {
                console.error('Error loading SVG image');
                URL.revokeObjectURL(svgUrl);
                setDownloading(false);
            };

            img.src = svgUrl;
        } catch (error) {
            console.error('Error downloading QR code:', error);
            setDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        QR код для филиала
                    </h2>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <strong className="text-gray-900 dark:text-gray-100">{branchName}</strong>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 break-all">
                        {url}
                    </p>
                </div>

                <div className="flex justify-center mb-6 p-4 bg-white rounded-lg border-2 border-gray-200 dark:border-gray-700">
                    <div ref={qrRef}>
                        <QRCodeSVG
                            value={url}
                            size={256}
                            level="H"
                            includeMargin={true}
                            fgColor="#000000"
                            bgColor="#ffffff"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="primary"
                        onClick={handleDownload}
                        disabled={downloading}
                        isLoading={downloading}
                        className="flex-1"
                    >
                        {downloading ? 'Скачивание...' : 'Скачать QR код'}
                    </Button>
                    {onClose && (
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Закрыть
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

