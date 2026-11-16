-- Создание таблицы для хранения метрик производительности фронтенда
-- Core Web Vitals, время загрузки страниц, метрики рендеринга

CREATE TABLE IF NOT EXISTS frontend_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type TEXT NOT NULL CHECK (metric_type IN ('web-vitals', 'page-load', 'render')),
    metric_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    page TEXT,
    user_agent TEXT,
    ip_address INET
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_frontend_metrics_type ON frontend_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_frontend_metrics_created_at ON frontend_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frontend_metrics_page ON frontend_metrics(page);
CREATE INDEX IF NOT EXISTS idx_frontend_metrics_user_id ON frontend_metrics(user_id) WHERE user_id IS NOT NULL;

-- Индекс для поиска по метрикам Core Web Vitals
CREATE INDEX IF NOT EXISTS idx_frontend_metrics_web_vitals ON frontend_metrics((metric_data->>'name'))
    WHERE metric_type = 'web-vitals';

-- RLS политики
ALTER TABLE frontend_metrics ENABLE ROW LEVEL SECURITY;

-- Разрешаем всем читать метрики (для аналитики)
CREATE POLICY "Allow read access to frontend metrics"
    ON frontend_metrics
    FOR SELECT
    USING (true);

-- Разрешаем вставку метрик (через RPC функцию)
CREATE POLICY "Allow insert access to frontend metrics"
    ON frontend_metrics
    FOR INSERT
    WITH CHECK (true);

-- RPC функция для логирования метрик фронтенда
CREATE OR REPLACE FUNCTION log_frontend_metric(
    p_metric_type TEXT,
    p_metric_data JSONB,
    p_timestamp TIMESTAMPTZ DEFAULT NOW(),
    p_user_id UUID DEFAULT NULL,
    p_page TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_metric_id UUID;
    v_page TEXT;
BEGIN
    -- Извлекаем page из метрики, если не указан явно
    IF p_page IS NULL THEN
        v_page := p_metric_data->>'page';
        IF v_page IS NULL THEN
            v_page := p_metric_data->>'url';
        END IF;
    ELSE
        v_page := p_page;
    END IF;

    -- Вставляем метрику
    INSERT INTO frontend_metrics (
        metric_type,
        metric_data,
        created_at,
        user_id,
        page,
        user_agent,
        ip_address
    ) VALUES (
        p_metric_type,
        p_metric_data,
        p_timestamp,
        p_user_id,
        v_page,
        p_user_agent,
        p_ip_address
    )
    RETURNING id INTO v_metric_id;

    RETURN v_metric_id;
END;
$$;

-- Комментарии
COMMENT ON TABLE frontend_metrics IS 'Метрики производительности фронтенда: Core Web Vitals, время загрузки страниц, метрики рендеринга';
COMMENT ON COLUMN frontend_metrics.metric_type IS 'Тип метрики: web-vitals, page-load, render';
COMMENT ON COLUMN frontend_metrics.metric_data IS 'JSON данные метрики';
COMMENT ON FUNCTION log_frontend_metric IS 'Функция для логирования метрик производительности фронтенда';

