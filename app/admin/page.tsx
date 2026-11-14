"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import AdminNav from "@/components/AdminNav";
import {getSupabase} from "@/lib/supabase";

type RequestRow={verification_status:string};
type EventRow={id:string;title:string;status:string};
type HistoryRow={ticket_count:number};

export default function Admin(){
  const supabase=getSupabase();
  const [pending,setPending]=useState(0);
  const [verified,setVerified]=useState(0);
  const [activeTitle,setActiveTitle]=useState("");
  const [recentGranted,setRecentGranted]=useState(0);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{(async()=>{
    if(!supabase){setError("Supabase is not configured");setLoading(false);return;}
    const [requests,events,history]=await Promise.all([
      supabase.rpc("shuri_admin_list_pending"),
      supabase.rpc("shuri_admin_list_events"),
      supabase.rpc("shuri_admin_ticket_history")
    ]);
    if(requests.error)setError(requests.error.message);
    else{
      const rows=(requests.data??[]) as RequestRow[];
      setPending(rows.filter(r=>r.verification_status==="pending").length);
      setVerified(rows.filter(r=>r.verification_status==="verified").length);
    }
    if(events.error)setError(events.error.message);
    else{
      const active=((events.data??[]) as EventRow[]).find(e=>e.status==="active");
      setActiveTitle(active?.title??"");
    }
    if(history.error)setError(history.error.message);
    else setRecentGranted(((history.data??[]) as HistoryRow[]).slice(0,20).reduce((s,h)=>s+Number(h.ticket_count||0),0));
    setLoading(false);
  })()},[supabase]);

  return <AppShell>
    <div className="admin-page">
      <div className="admin-hero"><div><div className="eyebrow">SHURI GACHA CONTROL</div><h2>🔐 管理者画面</h2><p className="muted">やりたい作業を選んで管理。</p></div><Link href="/" className="admin-home-link">ホームへ</Link></div>
      <AdminNav/>
      {error?<p className="notice danger">{error}</p>:null}
      {loading?<p>読み込み中...</p>:<>
        <div className="admin-summary-grid">
          <div className="admin-summary-card"><span>開催中</span><strong>{activeTitle?"1":"0"}</strong><small>{activeTitle||"イベントなし"}</small></div>
          <div className="admin-summary-card"><span>承認待ち</span><strong>{pending}</strong><small>本人確認</small></div>
          <div className="admin-summary-card"><span>確認済み</span><strong>{verified}</strong><small>ユーザー</small></div>
          <div className="admin-summary-card"><span>直近配布</span><strong>{recentGranted}</strong><small>チケット</small></div>
        </div>
        <div className="admin-menu-grid">
          <Link href="/admin/events" className="admin-menu-card"><span>🎰</span><strong>イベント管理</strong><small>景品・確率・SP・公開設定</small></Link>
          <Link href="/admin/verification" className="admin-menu-card"><span>👤</span><strong>本人確認</strong><small>承認待ちをまとめて確認</small></Link>
          <Link href="/admin/tickets" className="admin-menu-card"><span>🎟</span><strong>チケット配布</strong><small>ユーザーにすぐ配布</small></Link>
          <Link href="/admin/history" className="admin-menu-card"><span>🧾</span><strong>配布履歴</strong><small>いつ・誰に・何枚</small></Link>
        </div>
      </>}
    </div>
  </AppShell>;
}
