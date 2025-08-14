export default async function sitemap() {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    // можно подтянуть бизнесы и построить их URL
    return [
        { url: `${base}/`, changefreq: 'daily', priority: 0.8 },
        { url: `${base}/b/kezek`, changefreq: 'daily', priority: 0.7 }
    ];
}