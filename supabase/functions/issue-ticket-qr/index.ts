import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const enc = new TextEncoder();
async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {global:{headers:{Authorization:auth}}});
    const {data:{user},error:userError} = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({error:"No autorizado"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
    const {number} = await req.json();
    if (!Number.isInteger(number) || number < 0 || number > 99) return new Response(JSON.stringify({error:"Número inválido"}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
    const {data:ticket,error} = await supabase.from("tickets").select("number,status").eq("number",number).single();
    if (error || ticket.status !== "assigned") return new Response(JSON.stringify({error:"El número debe tener un participante confirmado"}),{status:409,headers:{...cors,"Content-Type":"application/json"}});
    const payload = `${number}.${crypto.randomUUID()}.${Date.now()}`;
    const signature = await sign(Deno.env.get("QR_SIGNING_SECRET")!, payload);
    const token = `${btoa(payload)}.${signature}`;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hash = await crypto.subtle.digest("SHA-256", enc.encode(token));
    const tokenHash = Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("");
    const {error:saveError} = await admin.from("ticket_qr_issuance").upsert({ticket_number:number,token_hash:tokenHash,issued_at:new Date().toISOString()});
    if (saveError) throw saveError;
    const origin = req.headers.get("origin") || "";
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || origin;
    return new Response(JSON.stringify({url:`${siteUrl}/?verify=${encodeURIComponent(token)}`}),{headers:{...cors,"Content-Type":"application/json"}});
  } catch (e) {
    return new Response(JSON.stringify({error:"No se pudo emitir el QR"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
  }
});