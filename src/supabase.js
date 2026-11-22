
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan las claves de conexión de Supabase en .env.local");
}

export const supabase = createClient(
  supabaseUrl.replace(/\/+$/, ""),
  supabaseKey
);
