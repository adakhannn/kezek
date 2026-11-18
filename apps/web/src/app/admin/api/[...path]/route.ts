import { unknownApiRoute } from '@/lib/unknownApiRoute';

export const dynamic = 'force-dynamic';

// Unknown paths under this API prefix answer a JSON 404 for every method (API-12).
export const GET = unknownApiRoute;
export const POST = unknownApiRoute;
export const PUT = unknownApiRoute;
export const PATCH = unknownApiRoute;
export const DELETE = unknownApiRoute;
