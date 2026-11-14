"use client";
import {useEffect,useState} from "react";
import AppShell from "@/components/AppShell";
import AdminNav from "@/components/AdminNav";
import {getSupabase} from "@/lib/supabase";

type Row={user_id:string;reality_name:string;verification_status:string;verification_requested_at:string|null};

export default function AdminVerification(){
 const supabase=getSupabase();
 const [rows,setRows]=useState<Row[]>([]);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);

 async function load(){
   if(!supabase)return;
   const r=await supabase.rpc("shuri_admin_list_pending");
   if(r.error)setError(r.error.message);else setRows((r.data??[]) as Row[]);
   setLoading(false);
 }
 useEffect(()=>{load()},[supabase]);

 async function setStatus(userId:string,status:"verified"|"rejected"){
   if(!supabase)return;setBusy(userId);
   const {error}=await supabase.rpc("shuri_admin_set_verification",{target_user:userId,new_status:status});
   if(error)setError(error.message);else await load();
   setBusy(null);
 }

 const pending=rows.filter(r=>r.verification_status==="pending");

 return <AppShell><div className="admin-page">
   <div className="admin-hero"><div><div className="eyebrow">IDENTITY CHECK</div><h2>👤 本人確認</h2><p className="muted">承認待ちだけをまとめて確認。</p></div></div>
   <AdminNav/>
   {error?<p className="notice danger">{error}</p>:null}
   {loading?<p>読み込み中...</p>:pending.length===0?<div className="admin-panel"><p className="muted">承認待ちはありません。</p></div>:<div className="admin-user-list">
     {pending.map(r=><div className="admin-user-card" key={r.user_id}>
       <div className="admin-user-head"><div><strong>{r.reality_name||"名前未登録"}</strong><span className="admin-status status-pending">承認待ち</span></div></div>
       {r.verification_requested_at?<div className="muted">申請：{new Date(r.verification_requested_at).toLocaleString("ja-JP")}</div>:null}
       <div className="admin-two-actions"><button className="btn" disabled={busy===r.user_id} onClick={()=>setStatus(r.user_id,"verified")}>承認</button><button className="btn secondary" disabled={busy===r.user_id} onClick={()=>setStatus(r.user_id,"rejected")}>却下</button></div>
     </div>)}
   </div>}
 </div></AppShell>
}