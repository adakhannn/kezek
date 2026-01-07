'use client';

import React, {useEffect, useRef, useState} from 'react';

import {Button} from '@/components/ui/Button';

async function createImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });
}

async function getCenteredSquareBlob(file: File): Promise<{blob: Blob; dataUrl: string}> {
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });

    const image = await createImage(dataUrl);
    const size = Math.min(image.width, image.height);
    const offsetX = (image.width - size) / 2;
    const offsetY = (image.height - size) / 2;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas not supported');
    }
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(image, offsetX, offsetY, size, size, 0, 0, size, size);

    const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
            (b) => {
                if (b) resolve(b);
                else reject(new Error('Failed to create cropped image'));
            },
            'image/jpeg',
            0.9
        );
    });

    const croppedDataUrl: string = await new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.readAsDataURL(blob);
    });

    return {blob, dataUrl: croppedDataUrl};
}

export default function StaffAvatarUpload({
    staffId,
    currentAvatarUrl,
    onUploaded,
}: {
    staffId: string;
    currentAvatarUrl: string | null;
    onUploaded?: (url: string) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [croppedFile, setCroppedFile] = useState<File | null>(null);

    // Обновляем preview при изменении currentAvatarUrl
    useEffect(() => {
        setPreview(currentAvatarUrl);
    }, [currentAvatarUrl]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Размер файла не должен превышать 5MB');
            return;
        }

        getCenteredSquareBlob(file)
            .then(({blob, dataUrl}) => {
                const cropped = new File([blob], `avatar-${staffId}.jpg`, {type: 'image/jpeg'});
                setCroppedFile(cropped);
                setPreview(dataUrl);
            })
            .catch((error) => {
                console.error('Crop error:', error);
                alert('Не удалось обработать изображение. Попробуйте другое фото.');
            });
    };

    const handleUpload = async () => {
        const file = croppedFile;
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/staff/avatar/upload', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!result.ok) {
                throw new Error(result.error || 'Ошибка при загрузке');
            }

            setPreview(result.url);
            setCroppedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            onUploaded?.(result.url);
        } catch (error) {
            console.error('Error uploading avatar:', error);
            const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
            alert(`Ошибка при загрузке аватарки: ${errorMessage}`);
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async () => {
        if (!currentAvatarUrl) return;

        setUploading(true);
        try {
            const response = await fetch('/api/staff/avatar/remove', {
                method: 'POST',
            });

            const result = await response.json();

            if (!result.ok) {
                throw new Error(result.error || 'Ошибка при удалении');
            }

            setPreview(null);
            setCroppedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            onUploaded?.('');
        } catch (error) {
            console.error('Error removing avatar:', error);
            alert('Ошибка при удалении аватарки. Попробуйте еще раз.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700">
                    {preview ? (
                        <img
                            src={preview}
                            alt="Аватар"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                console.error('Error loading avatar image:', preview);
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-400 dark:text-gray-500">
                            <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                    )}
                </div>
                <div className="flex-1 space-y-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="avatar-upload"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {preview && preview !== currentAvatarUrl ? 'Изменить фото' : 'Загрузить фото'}
                    </Button>
                    {preview && preview !== currentAvatarUrl && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleUpload}
                                disabled={uploading || !croppedFile}
                                isLoading={uploading}
                            >
                                Сохранить
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setPreview(currentAvatarUrl);
                                    setCroppedFile(null);
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                    }
                                }}
                                disabled={uploading}
                            >
                                Отмена
                            </Button>
                        </div>
                    )}
                    {currentAvatarUrl && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRemove}
                            disabled={uploading}
                            isLoading={uploading}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                            Удалить фото
                        </Button>
                    )}
                </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Рекомендуемый размер: квадратное изображение (например, 200x200px). Максимальный размер файла: 5MB
            </p>
        </div>
    );
}


