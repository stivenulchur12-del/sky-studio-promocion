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
    const {token} = await req.json();
    const parts = String(token||"").split(".");
    if (parts.length !== 2) throw new Error("bad token");
    const payload = atob(parts[0]);
    const expected = await sign(Deno.env.get("QR_SIGNING_SECRET")!, payload);
    if (expected !== parts[1]) throw new Error("bad signature");
    const [number,uuid,timestamp] = payload.split(".");
    if (!/^\d+$/.test(number) || !uuid || Date.now()-Number(timestamp)>31536000000 || Number(timestamp)>Date.now()+60000) throw new Error("expired");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hash = await crypto.subtle.digest("SHA-256", enc.encode(token));
    const tokenHash = Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("");
    const {data:issued,error:issueError} = await admin.from("ticket_qr_issuance").select("ticket_number,token_hash").eq("ticket_number",Number(number)).single();
    if (issueError || issued.token_hash !== tokenHash) throw new Error("revoked");
    const {data:ticket,error} = await admin.from("tickets").select("number,status").eq("number",Number(number)).single();
    if (error || ticket.status !== "assigned") throw new Error("inactive");
    return new Response(JSON.stringify({valid:true,number:ticket.number,message:"Boleta auténtica. Participante confirmado."}),{headers:{...cors,"Content-Type":"application/json"}});
  } catch {
    return new Response(JSON.stringify({valid:false,message:"QR inválido, reemplazado o no vigente."}),{status:200,headers:{...cors,"Content-Type":"application/json"}});
  }
});