'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';

type QRCodeGeneratorProps = {
    url: string;
    branchName: string;
    branchAddress?: string | null;
    businessName?: string | null;
    onClose?: () => void;
};

export default function QRCodeGenerator({ 
    url, 
    branchName, 
    branchAddress,
    businessName,
    onClose 
}: QRCodeGeneratorProps) {
    const qrRef = useRef<HTMLDivElement>(null);
    const brandedRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async (branded = false) => {
        const targetRef = branded ? brandedRef : qrRef;
        if (!targetRef.current) return;

        setDownloading(true);
        try {
            // Используем html2canvas для брендированного варианта или обычный способ для простого QR
            if (branded) {
                // Для брендированного используем html2canvas
                const html2canvas = (await import('html2canvas')).default;
                const canvas = await html2canvas(targetRef.current, {
                    backgroundColor: '#ffffff',
                    scale: 2, // Увеличиваем для лучшего качества
                    logging: false,
                });

                canvas.toBlob((blob) => {
                    if (!blob) {
                        setDownloading(false);
                        return;
                    }
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `qr-code-branded-${branchName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    setDownloading(false);
                }, 'image/png');
            } else {
                // Простой QR код
                const svgElement = targetRef.current.querySelector('svg');
                if (!svgElement) {
                    setDownloading(false);
                    return;
                }

                const clonedSvg = svgElement.cloneNode(true) as SVGElement;
                const size = 512;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    setDownloading(false);
                    return;
                }

                const svgData = new XMLSerializer().serializeToString(clonedSvg);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const svgUrl = URL.createObjectURL(svgBlob);

                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    try {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, size, size);

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
            }
        } catch (error) {
            console.error('Error downloading QR code:', error);
            setDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-2xl w-full my-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
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

                {/* Брендированный вариант для печати */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                        📄 Брендированный QR код для печати и наклейки
                    </h3>
                    <div className="flex justify-center">
                        <div 
                            ref={brandedRef}
                            className="bg-white p-10 rounded-2xl border-4 border-gray-300 shadow-2xl"
                            style={{ 
                                width: '500px', 
                                maxWidth: '100%',
                                printColorAdjust: 'exact',
                                WebkitPrintColorAdjust: 'exact',
                            }}
                        >
                            {/* Заголовок с названием бизнеса */}
                            {businessName && (
                                <div className="text-center mb-6">
                                    <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                                        {businessName}
                                    </h2>
                                    <div className="h-1.5 w-24 bg-gradient-to-r from-indigo-600 to-pink-600 mx-auto rounded-full shadow-md"></div>
                                </div>
                            )}

                            {/* Название филиала */}
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">
                                    {branchName}
                                </h3>
                                {branchAddress && (
                                    <p className="text-base text-gray-600 leading-relaxed">
                                        📍 {branchAddress}
                                    </p>
                                )}
                            </div>

                            {/* QR код */}
                            <div className="flex justify-center mb-6 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 shadow-inner">
                                <QRCodeSVG
                                    value={url}
                                    size={240}
                                    level="H"
                                    includeMargin={true}
                                    fgColor="#000000"
                                    bgColor="#ffffff"
                                />
                            </div>

                            {/* Инструкция */}
                            <div className="text-center space-y-1">
                                <p className="text-base font-bold text-gray-800 mb-1">
                                    📱 Отсканируйте для записи
                                </p>
                                <p className="text-sm text-gray-600 italic">
                                    Scan to book an appointment
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Простой QR код (для справки) */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Простой QR код
                    </h3>
                    <div className="flex justify-center p-4 bg-white rounded-lg border-2 border-gray-200 dark:border-gray-700">
                        <div ref={qrRef}>
                            <QRCodeSVG
                                value={url}
                                size={200}
                                level="H"
                                includeMargin={true}
                                fgColor="#000000"
                                bgColor="#ffffff"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <Button
                        variant="primary"
                        onClick={() => handleDownload(true)}
                        disabled={downloading}
                        isLoading={downloading}
                        className="w-full"
                    >
                        {downloading ? 'Скачивание...' : '📄 Скачать брендированный QR код для печати'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleDownload(false)}
                        disabled={downloading}
                        className="w-full"
                    >
                        Скачать простой QR код
                    </Button>
                    {onClose && (
                        <Button variant="outline" onClick={onClose} className="w-full">
                            Закрыть
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

