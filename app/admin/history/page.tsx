"use client";
import {useEffect,useMemo,useState} from "react";
import AppShell from "@/components/AppShell";
import AdminNav from "@/components/AdminNav";
import {getSupabase} from "@/lib/supabase";

type Row={created_at:string;user_id:string;reality_name:string|null;ticket_count:number};

export default function AdminHistory(){
 const supabase=getSupabase();
 const [rows,setRows]=useState<Row[]>([]);
 const [q,setQ]=useState("");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{if(!supabase)return;const r=await supabase.rpc("shuri_admin_ticket_history");if(r.error)setError(r.error.message);else setRows((r.data??[]) as Row[]);setLoading(false)})()},[supabase]);
 const filtered=useMemo(()=>rows.filter(r=>(r.reality_name||"").toLowerCase().includes(q.toLowerCase())),[rows,q]);

 return <AppShell><div className="admin-page">
   <div className="admin-hero"><div><div className="eyebrow">TICKET HISTORY</div><h2>🧾 配布履歴</h2><p className="muted">いつ・誰に・何枚配ったかを確認。</p></div></div>
   <AdminNav/>
   {error?<p className="notice danger">{error}</p>:null}
   <div className="admin-panel admin-search-panel"><input className="field" value={q} onChange={e=>setQ(e.target.value)} placeholder="REALITY名で検索"/></div>
   {loading?<p>読み込み中...</p>:<div className="admin-panel admin-history-panel">{filtered.length===0?<p className="muted">履歴はありません。</p>:filtered.map((h,i)=><div className="admin-history-row" key={h.created_at+"-"+i}><div><strong>{h.reality_name||"名前未登録"}</strong><div className="muted">{new Date(h.created_at).toLocaleString("ja-JP")}</div></div><strong className="ticket-plus">+{h.ticket_count}</strong></div>)}</div>}
 </div></AppShell>
}