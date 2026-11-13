"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {getSupabase} from "@/lib/supabase";

type RequestRow={user_id:string;reality_name:string;verification_status:string;verification_requested_at:string|null};
type HistoryRow={created_at:string;user_id:string;reality_name:string|null;ticket_count:number};
type EventRow={id:string;title:string;status:string;prize_count:number;total_weight:number;created_at:string;published_at:string|null};
type PrizeRow={id:string;title:string;rarity:string;weight:number;is_secret:boolean};
type SpRate={rarity:string;sp_amount:number};

export default function Admin(){
  const supabase=getSupabase();
  const [rows,setRows]=useState<RequestRow[]>([]);
  const [history,setHistory]=useState<HistoryRow[]>([]);
  const [events,setEvents]=useState<EventRow[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [prizes,setPrizes]=useState<PrizeRow[]>([]);
  const [counts,setCounts]=useState<Record<string,string>>({});
  const [eventTitle,setEventTitle]=useState("");
  const [prizeTitle,setPrizeTitle]=useState("");
  const [rarity,setRarity]=useState("N");
  const [weight,setWeight]=useState("1");
  const [secret,setSecret]=useState(false);
  const [spRates,setSpRates]=useState<SpRate[]>([]);
  const [spDraft,setSpDraft]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);

  async function load(){
    if(!supabase){setError("Supabase is not configured");setLoading(false);return;}
    setError("");
    const [requests,tickets,eventList]=await Promise.all([
      supabase.rpc("shuri_admin_list_pending"),
      supabase.rpc("shuri_admin_ticket_history"),
      supabase.rpc("shuri_admin_list_events")
    ]);
    if(requests.error)setError(requests.error.message); else setRows((requests.data??[]) as RequestRow[]);
    if(tickets.error)setError(tickets.error.message); else setHistory((tickets.data??[]) as HistoryRow[]);
    if(eventList.error)setError(eventList.error.message); else {
      const list=(eventList.data??[]) as EventRow[];
      setEvents(list);
      if(!selected&&list.length)setSelected(list[0].id);
    }
    setLoading(false);
  }

  async function loadPrizes(eventId:string|null){
    if(!supabase||!eventId){setPrizes([]);setSpRates([]);return;}
    const [pr,sp]=await Promise.all([
      supabase.rpc("shuri_admin_get_prizes",{target_event:eventId}),
      supabase.rpc("shuri_admin_get_sp_rates",{target_event:eventId})
    ]);
    if(pr.error)setError(pr.error.message); else setPrizes((pr.data??[]) as PrizeRow[]);
    if(sp.error)setError(sp.error.message); else {
      const rates=(sp.data??[]) as SpRate[];
      setSpRates(rates);
      setSpDraft(Object.fromEntries(rates.map(r=>[r.rarity,String(r.sp_amount)])));
    }
  }

  useEffect(()=>{load()},[supabase]);
  useEffect(()=>{loadPrizes(selected)},[selected]);

  async function setStatus(userId:string,status:"verified"|"rejected"){
    if(!supabase)return;
    setBusy(userId);setError("");
    const {error:e}=await supabase.rpc("shuri_admin_set_verification",{target_user:userId,new_status:status});
    if(e)setError(e.message); else await load();
    setBusy(null);
  }

  async function grant(userId:string){
    if(!supabase)return;
    const count=Number(counts[userId]||1);
    if(!Number.isInteger(count)||count<1)return setError("チケット枚数は1以上の整数にしてね");
    setBusy(userId);setError("");
    const {error:e}=await supabase.rpc("shuri_admin_grant_tickets",{target_user:userId,ticket_count:count});
    if(e)setError(e.message); else {setCounts(v=>({...v,[userId]:"1"}));await load();}
    setBusy(null);
  }

  async function createEvent(){
    if(!supabase||!eventTitle.trim())return;
    setBusy("event-new");setError("");
    const {data,error:e}=await supabase.rpc("shuri_admin_create_event",{event_title:eventTitle.trim()});
    if(e)setError(e.message); else {setEventTitle("");setSelected(data as string);await load();}
    setBusy(null);
  }

  async function addPrize(){
    if(!supabase||!selected||!prizeTitle.trim())return;
    const w=Number(weight);
    if(!Number.isFinite(w)||w<=0)return setError("確率は0より大きい数字にしてね");
    setBusy("prize-new");setError("");
    const {error:e}=await supabase.rpc("shuri_admin_add_prize",{target_event:selected,prize_title:prizeTitle.trim(),prize_rarity:rarity,prize_weight:w,secret_prize:secret});
    if(e)setError(e.message); else {setPrizeTitle("");setWeight("1");setSecret(false);await Promise.all([load(),loadPrizes(selected)]);}
    setBusy(null);
  }

  async function deletePrize(id:string){
    if(!supabase||!selected)return;
    setBusy(id);setError("");
    const {error:e}=await supabase.rpc("shuri_admin_delete_prize",{target_prize:id});
    if(e)setError(e.message); else await Promise.all([load(),loadPrizes(selected)]);
    setBusy(null);
  }

  async function saveSpRate(rarity:string){
    if(!supabase||!selected)return;
    const amount=Number(spDraft[rarity]??0);
    if(!Number.isInteger(amount)||amount<0)return setError("SPは0以上の整数にしてね");
    setBusy("sp-"+rarity);setError("");
    const {error:e}=await supabase.rpc("shuri_admin_set_sp_rate",{target_event:selected,target_rarity:rarity,new_amount:amount});
    if(e)setError(e.message); else await loadPrizes(selected);
    setBusy(null);
  }

  async function setEventStatus(id:string,status:"active"|"paused"|"ended"){
    if(!supabase)return;
    setBusy("event-"+id);setError("");
    const {error:e}=await supabase.rpc("shuri_admin_set_event_status",{target_event:id,new_status:status});
    if(e)setError(e.message); else await load();
    setBusy(null);
  }

  const current=events.find(e=>e.id===selected)||null;
  const total=prizes.reduce((a,p)=>a+Number(p.weight),0);

  return <AppShell>
    <div className="row"><h2>🔐 管理者画面</h2><Link href="/" className="muted">ホームへ</Link></div>
    {error?<p className="notice danger">{error}</p>:null}
    {loading?<p>読み込み中...</p>:<>
      <h3 className="section-title">🎰 ガチャイベント</h3>
      <div className="card stack">
        <label>新しいイベント名</label>
        <input className="field" value={eventTitle} maxLength={120} onChange={e=>setEventTitle(e.target.value)} placeholder="例：バースデーガチャ"/>
        <button className="btn" disabled={busy==="event-new"||!eventTitle.trim()} onClick={createEvent}>イベントを作成</button>
      </div>

      {events.length>0?<div className="event-tabs">{events.map(e=><button key={e.id} className={selected===e.id?"event-tab active":"event-tab"} onClick={()=>setSelected(e.id)}>{e.title}<small>{e.status}</small></button>)}</div>:null}

      {current?<div className="card stack">
        <div className="row"><div><h3 style={{margin:0}}>{current.title}</h3><span className="muted">状態：{current.status} / 景品 {current.prize_count}個</span></div><span className="tag">確率合計 {Number(current.total_weight)}%</span></div>
        {current.status==="draft"?<>
          <div className="divider"/>
          <h3>景品を追加</h3>
          <input className="field" value={prizeTitle} maxLength={120} onChange={e=>setPrizeTitle(e.target.value)} placeholder="景品名"/>
          <div className="grid">
            <select className="field" value={rarity} onChange={e=>setRarity(e.target.value)}>{["N","R","SR","SSR","UR"].map(r=><option key={r}>{r}</option>)}</select>
            <input className="field" type="number" min="0.0001" step="0.1" max="100" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="確率（%）"/>
          </div>
          <label className="check-row"><input type="checkbox" checked={secret} onChange={e=>setSecret(e.target.checked)}/> シークレット景品（未獲得時は？？？表示）</label>
          <button className="btn" disabled={busy==="prize-new"||!prizeTitle.trim()} onClick={addPrize}>＋ 景品を追加</button>
        </>:<p className="notice">公開後は景品構成を変更できません。</p>}

        <div className={Math.abs(total-100)<0.0001?"notice success":"notice"}>確率合計：{total.toFixed(2)}% {Math.abs(total-100)<0.0001?"✓":"（100%にすると公開できます）"}</div>
        <div className="stack">
          {prizes.map(p=><div className="prize-admin" key={p.id}>
            <div><b>{p.rarity}</b> {p.is_secret?"🔒 ":""}{p.title}<div className="muted">確率 {Number(p.weight)}%</div></div>
            {current.status==="draft"?<button className="mini-danger" disabled={busy===p.id} onClick={()=>deletePrize(p.id)}>削除</button>:null}
          </div>)}
        </div>

        <div className="divider"/>
        <h3>重複時のSHURI POINT</h3>
        <p className="muted">同じ景品が2回目以降に出たとき、レア度ごとにこのSPへ変換されます。</p>
        <div className="sp-rate-grid">
          {spRates.map(r=><div className="sp-rate-row" key={r.rarity}>
            <strong>{r.rarity}</strong>
            <input className="field" type="number" min="0" step="1" value={spDraft[r.rarity]??String(r.sp_amount)} onChange={e=>setSpDraft(v=>({...v,[r.rarity]:e.target.value}))}/>
            <button className="btn secondary" disabled={busy==="sp-"+r.rarity} onClick={()=>saveSpRate(r.rarity)}>保存</button>
          </div>)}
        </div>

        <div className="row">
          {current.status==="draft"?<button className="btn" disabled={busy==="event-"+current.id||prizes.length===0||Math.abs(total-100)>0.0001} onClick={()=>setEventStatus(current.id,"active")}>🚀 公開して開始</button>:null}
          {current.status==="active"?<><button className="btn secondary" disabled={busy==="event-"+current.id} onClick={()=>setEventStatus(current.id,"paused")}>⏸ 一時停止</button><button className="btn secondary" disabled={busy==="event-"+current.id} onClick={()=>setEventStatus(current.id,"ended")}>終了</button></>:null}
          {current.status==="paused"?<><button className="btn" disabled={busy==="event-"+current.id} onClick={()=>setEventStatus(current.id,"active")}>▶ 再開</button><button className="btn secondary" disabled={busy==="event-"+current.id} onClick={()=>setEventStatus(current.id,"ended")}>終了</button></>:null}
        </div>
      </div>:null}

      <h3 className="section-title">👤 本人確認・チケット配布</h3>
      {rows.length===0?<div className="card"><p className="muted">ユーザーはまだいません。</p></div>:rows.map(r=><div className="card stack" key={r.user_id}>
        <strong>{r.reality_name||"名前未登録"}</strong>
        <span className="muted">状態：{r.verification_status==="pending"?"⏳ 承認待ち":r.verification_status==="verified"?"✅ 確認済み":"❌ 却下"}</span>
        {r.verification_status==="pending"?<div className="row"><button className="btn" disabled={busy===r.user_id} onClick={()=>setStatus(r.user_id,"verified")}>承認</button><button className="btn secondary" disabled={busy===r.user_id} onClick={()=>setStatus(r.user_id,"rejected")}>却下</button></div>:null}
        {r.verification_status==="verified"?<div className="stack">
          <div className="ticket-presets">{[1,2,3,4,5,6,7,8,9].map(n=><button key={n} className="btn secondary" disabled={busy===r.user_id} onClick={()=>setCounts(v=>({...v,[r.user_id]:String(n)}))}>{n}枚</button>)}<button className="btn secondary" disabled={busy===r.user_id} onClick={()=>setCounts(v=>({...v,[r.user_id]:"10"}))}>10枚セット</button></div>
          <input className="field" type="number" min="1" step="1" value={counts[r.user_id]||"1"} onChange={e=>setCounts(v=>({...v,[r.user_id]:e.target.value}))}/>
          <button className="btn" disabled={busy===r.user_id} onClick={()=>grant(r.user_id)}>🎟 チケットを配布</button>
        </div>:null}
      </div>)}

      <h3 className="section-title">配布履歴</h3>
      {history.length===0?<div className="card"><p className="muted">まだ配布履歴はありません。</p></div>:history.map((h,i)=><div className="card row" key={h.created_at+"-"+i}><div><strong>{h.reality_name||"名前未登録"}</strong><div className="muted">{new Date(h.created_at).toLocaleString("ja-JP")}</div></div><strong>+{h.ticket_count}枚</strong></div>)}
    </>}
  </AppShell>;
}
