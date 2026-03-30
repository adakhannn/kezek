import { logWarn } from '@/lib/log';

export type WebVitalsMetric = {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
};

export type PageLoadMetric = {
  page: string;
  loadTime: number;
  domInteractive: number;
  domComplete: number;
  firstPaint: number | null;
  firstContentfulPaint: number | null;
  timeToFirstByte: number | null;
  timestamp: number;
};

export type RenderMetric = {
  page: string;
  renderTime: number;
  componentCount: number;
  timestamp: number;
};

export type FrontendMetric = WebVitalsMetric | PageLoadMetric | RenderMetric;

export type FrontendMetricsAdminLike = {
  rpc: (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
};

export type FrontendMetricsUserClientLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
    }>;
  };
};

export function getFrontendMetricType(
  metric: FrontendMetric,
): 'web-vitals' | 'page-load' | 'render' {
  if ('name' in metric && 'rating' in metric) {
    return 'web-vitals';
  }
  if ('loadTime' in metric) {
    return 'page-load';
  }
  return 'render';
}

export async function saveFrontendMetric(
  metric: FrontendMetric,
  context: {
    req: Request;
    admin: FrontendMetricsAdminLike;
    userClient: FrontendMetricsUserClientLike;
    ipAddress: string | null;
  },
): Promise<void> {
  const metricType = getFrontendMetricType(metric);

  try {
    const {
      data: { user },
    } = await context.userClient.auth.getUser();

    const userAgent = context.req.headers.get('user-agent') || null;
    const page = 'page' in metric ? metric.page : metric.url;

    const { error } = await context.admin.rpc('log_frontend_metric', {
      p_metric_type: metricType,
      p_metric_data: metric,
      p_timestamp: new Date(metric.timestamp).toISOString(),
      p_user_id: user?.id || null,
      p_page: page,
      p_user_agent: userAgent,
      p_ip_address: context.ipAddress,
    });

    if (error) {
      logWarn('FrontendMetrics', 'RPC function log_frontend_metric not found', {
        error: error.message,
      });
    }
  } catch (error) {
    logWarn('FrontendMetrics', 'Failed to save metric', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
