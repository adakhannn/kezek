import {createClient} from "@supabase/supabase-js";

export function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ВАЖНО: не утекать в клиент
    return createClient(url, key, {auth: {persistSession: false}});
}