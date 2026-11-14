"use client";
import {useEffect,useMemo,useState} from "react";
import AppShell from "@/components/AppShell";
import AdminNav from "@/components/AdminNav";
import {getSupabase} from "@/lib/supabase";

type Row={user_id:string;reality_name:string;verification_status:string};

export default function AdminTickets(){
 const supabase=getSupabase();
 const [rows,setRows]=useState<Row[]>([]);
 const [counts,setCounts]=useState<Record<string,string>>({});
 const [q,setQ]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);

 async function load(){
   if(!supabase)return;
   const r=await supabase.rpc("shuri_admin_list_pending");
   if(r.error)setError(r.error.message);else setRows(((r.data??[]) as Row[]).filter(x=>x.verification_status==="verified"));
   setLoading(false);
 }
 useEffect(()=>{load()},[supabase]);

 async function grant(userId:string){
   if(!supabase)return;
   const count=Number(counts[userId]||1);
   if(!Number.isInteger(count)||count<1){setError("チケット枚数は1以上の整数にしてね");return;}
   setBusy(userId);setError("");
   const {error}=await supabase.rpc("shuri_admin_grant_tickets",{target_user:userId,ticket_count:count});
   if(error)setError(error.message);else setCounts(v=>({...v,[userId]:"1"}));
   setBusy(null);
 }

 const filtered=useMemo(()=>rows.filter(r=>(r.reality_name||"").toLowerCase().includes(q.toLowerCase())),[rows,q]);

 return <AppShell><div className="admin-page">
   <div className="admin-hero"><div><div className="eyebrow">TICKET DISTRIBUTION</div><h2>🎟 チケット配布</h2><p className="muted">確認済みユーザーへすぐ配布。</p></div></div>
   <AdminNav/>
   {error?<p className="notice danger">{error}</p>:null}
   <div className="admin-panel admin-search-panel"><input className="field" value={q} onChange={e=>setQ(e.target.value)} placeholder="REALITY名で検索"/></div>
   {loading?<p>読み込み中...</p>:filtered.length===0?<div className="admin-panel"><p className="muted">該当する確認済みユーザーはいません。</p></div>:<div className="admin-user-list">
     {filtered.map(r=><div className="admin-user-card" key={r.user_id}>
       <div className="admin-user-head"><div><strong>{r.reality_name||"名前未登録"}</strong><span className="admin-status status-verified">確認済み</span></div></div>
       <div className="admin-ticket-box">
         <div className="muted">配布枚数</div>
         <div className="ticket-presets">{[1,2,3,4,5,6,7,8,9].map(n=><button key={n} className={(counts[r.user_id]||"1")===String(n)?"btn preset-active":"btn secondary"} disabled={busy===r.user_id} onClick={()=>setCounts(v=>({...v,[r.user_id]:String(n)}))}>{n}</button>)}<button className={(counts[r.user_id]||"1")==="10"?"btn preset-active":"btn secondary"} disabled={busy===r.user_id} onClick={()=>setCounts(v=>({...v,[r.user_id]:"10"}))}>10</button></div>
         <div className="admin-ticket-send"><input className="field" type="number" min="1" step="1" value={counts[r.user_id]||"1"} onChange={e=>setCounts(v=>({...v,[r.user_id]:e.target.value}))}/><button className="btn" disabled={busy===r.user_id} onClick={()=>grant(r.user_id)}>🎟 配布</button></div>
       </div>
     </div>)}
   </div>}
 </div></AppShell>
}