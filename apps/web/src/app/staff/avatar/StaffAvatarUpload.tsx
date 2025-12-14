'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabaseClient';

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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        // Проверяем размер (макс 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Размер файла не должен превышать 5MB');
            return;
        }

        // Создаем preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Генерируем уникальное имя файла
            const fileExt = file.name.split('.').pop();
            const fileName = `${staffId}-${Date.now()}.${fileExt}`;
            const filePath = `staff-avatars/${fileName}`;

            // Удаляем старую аватарку, если есть
            if (currentAvatarUrl) {
                try {
                    const oldPath = currentAvatarUrl.split('/').slice(-2).join('/'); // staff-avatars/filename.ext
                    await supabase.storage.from('avatars').remove([oldPath]);
                } catch (error) {
                    console.warn('Failed to delete old avatar:', error);
                }
            }

            // Загружаем новый файл
            // Используем upsert: true для перезаписи существующих файлов
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true, // Разрешаем перезапись
                    contentType: file.type, // Явно указываем тип контента
                });

            if (uploadError) {
                console.error('Upload error details:', uploadError);
                console.error('File path:', filePath);
                console.error('File name:', fileName);
                console.error('File size:', file.size);
                console.error('File type:', file.type);
                
                // Проверяем, существует ли bucket
                if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
                    throw new Error('Bucket "avatars" не найден. Пожалуйста, создайте bucket в Supabase Storage.');
                }
                // Проверяем права доступа
                if (uploadError.message?.includes('new row violates row-level security') || 
                    uploadError.message?.includes('permission denied') ||
                    uploadError.message?.includes('row-level security') ||
                    String(uploadError).includes('403')) {
                    throw new Error(`Нет прав на загрузку файлов. Ошибка: ${uploadError.message}. Проверьте настройки RLS политик для bucket "avatars".`);
                }
                throw uploadError;
            }

            // Получаем публичный URL
            const {
                data: { publicUrl },
            } = supabase.storage.from('avatars').getPublicUrl(filePath);

            // Обновляем запись в БД
            const { error: updateError } = await supabase
                .from('staff')
                .update({ avatar_url: publicUrl })
                .eq('id', staffId);

            if (updateError) throw updateError;

            setPreview(publicUrl);
            onUploaded?.(publicUrl);
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
            // Удаляем файл из storage
            const oldPath = currentAvatarUrl.split('/').slice(-2).join('/');
            await supabase.storage.from('avatars').remove([oldPath]);

            // Обновляем запись в БД
            const { error: updateError } = await supabase
                .from('staff')
                .update({ avatar_url: null })
                .eq('id', staffId);

            if (updateError) throw updateError;

            setPreview(null);
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
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600">
                    {preview ? (
                        <Image
                            src={preview}
                            alt="Аватар"
                            fill
                            className="object-cover"
                            sizes="96px"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                disabled={uploading}
                                isLoading={uploading}
                            >
                                Сохранить
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setPreview(currentAvatarUrl);
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
                Рекомендуемый размер: 200x200px. Максимальный размер файла: 5MB
            </p>
        </div>
    );
}

