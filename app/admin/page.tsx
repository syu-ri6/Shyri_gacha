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

export default function Admin(){
  const supabase=getSupabase();
  const [rows,setRows]=useState<RequestRow[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);

  async function load(){
    if(!supabase){setError("Supabase is not configured");setLoading(false);return;}
    setError("");
    const {data,error:e}=await supabase.rpc("shuri_admin_list_pending");
    if(e)setError(e.message);
    else setRows((data??[]) as RequestRow[]);
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

  return <AppShell>
    <div className="row"><h2>🔐 本人確認</h2><Link href="/" className="muted">ホームへ</Link></div>
    <p className="muted">配信で「申請したよ」と言われたら、REALITY名が一致していることを目視確認して承認します。</p>
    {error?<p className="notice danger">{error}</p>:null}
    {loading?<p>読み込み中...</p>:rows.length===0?<div className="card"><p className="muted">申請はまだありません。</p></div>:rows.map(r=><div className="card stack" key={r.user_id}>
      <strong>{r.reality_name||"名前未登録"}</strong>
      <span className="muted">状態：{r.verification_status==="pending"?"⏳ 承認待ち":r.verification_status==="verified"?"✅ 確認済み":"❌ 却下"}</span>
      {r.verification_status==="pending"?<div className="row">
        <button className="btn" disabled={busy===r.user_id} onClick={()=>setStatus(r.user_id,"verified")}>承認</button>
        <button className="btn secondary" disabled={busy===r.user_id} onClick={()=>setStatus(r.user_id,"rejected")}>却下</button>
      </div>:null}
    </div>)}
  </AppShell>;
}
