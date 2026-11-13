"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {getSupabase} from "@/lib/supabase";

type RequestRow={
  user_id:string;
  reality_name:string;
  verification_status:string;
  verification_requested_at:string|null;
};

type HistoryRow={
  created_at:string;
  user_id:string;
  reality_name:string|null;
  ticket_count:number;
};

export default function Admin(){
  const supabase=getSupabase();
  const [rows,setRows]=useState<RequestRow[]>([]);
  const [history,setHistory]=useState<HistoryRow[]>([]);
  const [counts,setCounts]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);

  async function load(){
    if(!supabase){setError("Supabase is not configured");setLoading(false);return;}
    setError("");
    const [requests,tickets]=await Promise.all([
      supabase.rpc("shuri_admin_list_pending"),
      supabase.rpc("shuri_admin_ticket_history")
    ]);
    if(requests.error)setError(requests.error.message);
    else setRows((requests.data??[]) as RequestRow[]);
    if(tickets.error)setError(tickets.error.message);
    else setHistory((tickets.data??[]) as HistoryRow[]);
    setLoading(false);
  }

  useEffect(()=>{load()},[supabase]);

  async function setStatus(userId:string,status:"verified"|"rejected"){
    if(!supabase)return;
    setBusy(userId);setError("");
    const {error:e}=await supabase.rpc("shuri_admin_set_verification",{target_user:userId,new_status:status});
    if(e)setError(e.message);
    else await load();
    setBusy(null);
  }

  async function grant(userId:string){
    if(!supabase)return;
    const count=Number(counts[userId]||1);
    if(!Number.isInteger(count)||count<1)return setError("チケット枚数は1以上の整数にしてね");
    setBusy(userId);setError("");
    const {error:e}=await supabase.rpc("shuri_admin_grant_tickets",{target_user:userId,ticket_count:count});
    if(e)setError(e.message);
    else {
      setCounts(v=>({...v,[userId]:"1"}));
      await load();
    }
    setBusy(null);
  }

  return <AppShell>
    <div className="row"><h2>🔐 管理者画面</h2><Link href="/" className="muted">ホームへ</Link></div>
    <p className="muted">本人確認とSHURI TICKET配布をここで管理します。</p>
    {error?<p className="notice danger">{error}</p>:null}
    {loading?<p>読み込み中...</p>:<>
      <h3 className="section-title">本人確認・チケット配布</h3>
      {rows.length===0?<div className="card"><p className="muted">ユーザーはまだいません。</p></div>:rows.map(r=><div className="card stack" key={r.user_id}>
        <strong>{r.reality_name||"名前未登録"}</strong>
        <span className="muted">状態：{r.verification_status==="pending"?"⏳ 承認待ち":r.verification_status==="verified"?"✅ 確認済み":"❌ 却下"}</span>
        {r.verification_status==="pending"?<div className="row">
          <button className="btn" disabled={busy===r.user_id} onClick={()=>setStatus(r.user_id,"verified")}>承認</button>
          <button className="btn secondary" disabled={busy===r.user_id} onClick={()=>setStatus(r.user_id,"rejected")}>却下</button>
        </div>:null}
        {r.verification_status==="verified"?<div className="stack">
          <div className="ticket-presets">
            {[1,2,3,4,5,6,7,8,9].map(n=><button key={n} className="btn secondary" disabled={busy===r.user_id} onClick={()=>setCounts(v=>({...v,[r.user_id]:String(n)}))}>{n}枚</button>)}
            <button className="btn secondary" disabled={busy===r.user_id} onClick={()=>setCounts(v=>({...v,[r.user_id]:"10"}))}>10枚セット</button>
          </div>
          <input className="field" type="number" min="1" step="1" value={counts[r.user_id]||"1"} onChange={e=>setCounts(v=>({...v,[r.user_id]:e.target.value}))}/>
          <button className="btn" disabled={busy===r.user_id} onClick={()=>grant(r.user_id)}>🎟 チケットを配布</button>
        </div>:null}
      </div>)}

      <h3 className="section-title">配布履歴</h3>
      {history.length===0?<div className="card"><p className="muted">まだ配布履歴はありません。</p></div>:history.map((h,i)=><div className="card row" key={h.created_at+"-"+i}>
        <div>
          <strong>{h.reality_name||"名前未登録"}</strong>
          <div className="muted">{new Date(h.created_at).toLocaleString("ja-JP")}</div>
        </div>
        <strong>+{h.ticket_count}枚</strong>
      </div>)}
    </>}
  </AppShell>;
}
