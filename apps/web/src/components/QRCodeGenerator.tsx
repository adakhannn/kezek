'use client';

import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { useRef, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import {logError} from '@/lib/log';

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
    onClose 
}: QRCodeGeneratorProps) {
    const { t } = useLanguage();
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

                const img = new window.Image();
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
                        logError('QRCodeGenerator', 'Error processing image', error);
                        setDownloading(false);
                    }
                };

                img.onerror = () => {
                    logError('QRCodeGenerator', 'Error loading SVG image');
                    URL.revokeObjectURL(svgUrl);
                    setDownloading(false);
                };

                img.src = svgUrl;
            }
        } catch (error) {
            logError('QRCodeGenerator', 'Error downloading QR code', error);
            setDownloading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-generator-title"
        >
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-2xl w-full my-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 id="qr-generator-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {t('qr.title', 'QR код для филиала')}
                    </h2>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            type="button"
                            aria-label={t('qr.closeDialog', 'Закрыть диалог с QR‑кодом')}
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
                        {t('qr.brandedTitle', '📄 Брендированный QR код для печати и наклейки')}
                    </h3>
                    <div className="flex justify-center">
                        <div 
                            ref={brandedRef}
                            className="relative overflow-hidden rounded-3xl shadow-2xl"
                            style={{ 
                                width: '400px', 
                                height: '600px',
                                maxWidth: '100%',
                                printColorAdjust: 'exact',
                                WebkitPrintColorAdjust: 'exact',
                            }}
                        >
                            {/* Фоновое изображение шаблона */}
                            <div className="absolute inset-0">
                                <Image
                                    src="/qr-template.png"
                                    alt=""
                                    fill
                                    className="object-cover"
                                    priority
                                    unoptimized
                                    sizes="400px"
                                />
                            </div>

                            {/* Контент поверх изображения */}
                            <div className="relative z-10 h-full flex flex-col items-center justify-center p-8">
                                {/* QR код в белом квадрате - позиционируем в нужном месте */}
                                <div 
                                    className="relative"
                                    style={{
                                        marginTop: 'auto',
                                        marginBottom: '120px', // Позиционируем QR код в нужном месте
                                    }}
                                >
                                    <div className="bg-white p-3 rounded-2xl shadow-xl">
                                        <QRCodeSVG
                                            value={url}
                                            size={180}
                                            level="H"
                                            includeMargin={true}
                                            fgColor="#000000"
                                            bgColor="#ffffff"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Простой QR код (скрыт, но нужен для скачивания) */}
                <div className="hidden">
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

                <div className="flex flex-col gap-3">
                    <Button
                        variant="primary"
                        onClick={() => handleDownload(true)}
                        disabled={downloading}
                        isLoading={downloading}
                        className="w-full"
                    >
                        {downloading
                            ? t('qr.downloading', 'Скачивание...')
                            : t('qr.downloadBranded', '📄 Скачать брендированный QR код для печати')}
                    </Button>
                    {onClose && (
                        <Button variant="outline" onClick={onClose} className="w-full">
                            {t('qr.close', 'Закрыть')}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

