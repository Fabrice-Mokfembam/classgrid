import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function createClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key||url.includes("YOUR_PROJECT")) return null;
 const store=await cookies();
 return createServerClient(url,key,{cookies:{getAll:()=>store.getAll(),setAll:(items:{name:string;value:string;options:any}[])=>{try{items.forEach(({name,value,options})=>store.set(name,value,options));}catch{}}}});
}
