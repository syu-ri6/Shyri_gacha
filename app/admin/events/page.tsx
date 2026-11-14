"use client";
import {useEffect,useState} from "react";
import AppShell from "@/components/AppShell";
import AdminNav from "@/components/AdminNav";
import {getSupabase} from "@/lib/supabase";

type EventRow={id:string;title:string;status:string;prize_count:number;total_weight:number;created_at:string;published_at:string|null};
type PrizeRow={id:string;title:string;rarity:string;weight:number;is_secret:boolean};
type SpRate={rarity:string;sp_amount:number};

export default function AdminEvents(){
  const supabase=getSupabase();
  const [events,setEvents]=useState<EventRow[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [prizes,setPrizes]=useState<PrizeRow[]>([]);
  const [spRates,setSpRates]=useState<SpRate[]>([]);
  const [spDraft,setSpDraft]=useState<Record<string,string>>({});
  const [eventTitle,setEventTitle]=useState("");
  const [prizeTitle,setPrizeTitle]=useState("");
  const [rarity,setRarity]=useState("N");
  const [weight,setWeight]=useState("1");
  const [secret,setSecret]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  async function load(){
    if(!supabase)return;
    const r=await supabase.rpc("shuri_admin_list_events");
    if(r.error)setError(r.error.message);else{
      const list=(r.data??[]) as EventRow[];
      setEvents(list);
      if(!selected&&list.length)setSelected(list[0].id);
    }
    setLoading(false);
  }
  async function loadPrizes(id:string|null){
    if(!supabase||!id){setPrizes([]);setSpRates([]);return;}
    const [p,s]=await Promise.all([
      supabase.rpc("shuri_admin_get_prizes",{target_event:id}),
      supabase.rpc("shuri_admin_get_sp_rates",{target_event:id})
    ]);
    if(p.error)setError(p.error.message);else setPrizes((p.data??[]) as PrizeRow[]);
    if(s.error)setError(s.error.message);else{
      const rates=(s.data??[]) as SpRate[];setSpRates(rates);setSpDraft(Object.fromEntries(rates.map(x=>[x.rarity,String(x.sp_amount)])));
    }
  }
  useEffect(()=>{load()},[supabase]);
  useEffect(()=>{loadPrizes(selected)},[selected]);

  async function createEvent(){if(!supabase||!eventTitle.trim())return;setBusy("new");const {data,error}=await supabase.rpc("shuri_admin_create_event",{event_title:eventTitle.trim()});if(error)setError(error.message);else{setEventTitle("");setSelected(data as string);await load();}setBusy(null)}
  async function addPrize(){if(!supabase||!selected||!prizeTitle.trim())return;const w=Number(weight);if(!Number.isFinite(w)||w<=0){setError("確率は0より大きい数字にしてね");return;}setBusy("prize");const {error}=await supabase.rpc("shuri_admin_add_prize",{target_event:selected,prize_title:prizeTitle.trim(),prize_rarity:rarity,prize_weight:w,secret_prize:secret});if(error)setError(error.message);else{setPrizeTitle("");setWeight("1");setSecret(false);await Promise.all([load(),loadPrizes(selected)])}setBusy(null)}
  async function deletePrize(id:string){if(!supabase||!selected)return;setBusy(id);const {error}=await supabase.rpc("shuri_admin_delete_prize",{target_prize:id});if(error)setError(error.message);else await Promise.all([load(),loadPrizes(selected)]);setBusy(null)}
  async function saveSpRate(r:string){if(!supabase||!selected)return;const amount=Number(spDraft[r]??0);if(!Number.isInteger(amount)||amount<0){setError("SPは0以上の整数にしてね");return;}setBusy("sp-"+r);const {error}=await supabase.rpc("shuri_admin_set_sp_rate",{target_event:selected,target_rarity:r,new_amount:amount});if(error)setError(error.message);else await loadPrizes(selected);setBusy(null)}
  async function setStatus(id:string,status:"active"|"paused"|"ended"){if(!supabase)return;setBusy("event-"+id);const {error}=await supabase.rpc("shuri_admin_set_event_status",{target_event:id,new_status:status});if(error)setError(error.message);else await load();setBusy(null)}

  const current=events.find(e=>e.id===selected)||null;
  const total=prizes.reduce((a,p)=>a+Number(p.weight),0);

  return <AppShell><div className="admin-page">
    <div className="admin-hero"><div><div className="eyebrow">EVENT MANAGEMENT</div><h2>🎰 イベント管理</h2></div></div>
    <AdminNav/>
    {error?<p className="notice danger">{error}</p>:null}
    {loading?<p>読み込み中...</p>:<>
      <div className="admin-panel">
        <div className="admin-panel-head"><strong>新しいイベント</strong><span className="muted">イベント名を作成</span></div>
        <div className="admin-inline-form"><input className="field" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} placeholder="例：バースデーガチャ"/><button className="btn" onClick={createEvent} disabled={busy==="new"||!eventTitle.trim()}>＋ 作成</button></div>
      </div>
      {events.length?<div className="event-tabs admin-event-tabs">{events.map(e=><button key={e.id} className={selected===e.id?"event-tab active":"event-tab"} onClick={()=>setSelected(e.id)}><span>{e.title}</span><small className={"status-"+e.status}>{e.status}</small></button>)}</div>:null}
      {current?<div className="admin-event-card">
        <div className="admin-event-top"><div><div className="eyebrow">SELECTED EVENT</div><h3>{current.title}</h3><div className="admin-meta-row"><span className={"admin-status status-"+current.status}>{current.status}</span><span>景品 {current.prize_count}個</span></div></div><div className={Math.abs(total-100)<.0001?"prob-total ok":"prob-total"}><small>確率合計</small><strong>{total.toFixed(2)}%</strong></div></div>
        {current.status==="draft"?<div className="admin-subpanel"><div className="admin-subpanel-title"><strong>景品を追加</strong><span className="muted">公開前のみ編集可</span></div><input className="field" value={prizeTitle} onChange={e=>setPrizeTitle(e.target.value)} placeholder="景品名"/><div className="admin-form-grid"><label><span>レア度</span><select className="field" value={rarity} onChange={e=>setRarity(e.target.value)}>{["N","R","SR","SSR","UR"].map(r=><option key={r}>{r}</option>)}</select></label><label><span>確率（%）</span><input className="field" type="number" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div><label className="check-row admin-check"><input type="checkbox" checked={secret} onChange={e=>setSecret(e.target.checked)}/>シークレット景品</label><button className="btn block" onClick={addPrize} disabled={busy==="prize"||!prizeTitle.trim()}>＋ 景品を追加</button></div>:<p className="notice">公開後は景品構成を変更できません。</p>}
        <div className="admin-prize-list"><div className="admin-subpanel-title"><strong>景品一覧</strong><span className="muted">{prizes.length}個</span></div>{prizes.map(p=><div className="prize-admin admin-prize-row" key={p.id}><div className="admin-prize-main"><span className={"rarity-pill rarity-"+p.rarity.toLowerCase()}>{p.rarity}</span><div><strong>{p.is_secret?"🔒 ":""}{p.title}</strong><div className="muted">確率 {Number(p.weight)}%</div></div></div>{current.status==="draft"?<button className="mini-danger" onClick={()=>deletePrize(p.id)} disabled={busy===p.id}>削除</button>:null}</div>)}</div>
        <div className="admin-subpanel"><div className="admin-subpanel-title"><strong>重複時SHURI POINT</strong><span className="muted">レア度ごとの変換量</span></div><div className="sp-rate-grid admin-sp-grid">{spRates.map(r=><div className="sp-rate-row" key={r.rarity}><strong className={"rarity-pill rarity-"+r.rarity.toLowerCase()}>{r.rarity}</strong><input className="field" type="number" value={spDraft[r.rarity]??String(r.sp_amount)} onChange={e=>setSpDraft(v=>({...v,[r.rarity]:e.target.value}))}/><button className="btn secondary" onClick={()=>saveSpRate(r.rarity)} disabled={busy==="sp-"+r.rarity}>保存</button></div>)}</div></div>
        <div className="admin-event-actions">{current.status==="draft"?<button className="btn" disabled={busy==="event-"+current.id||prizes.length===0||Math.abs(total-100)>.0001} onClick={()=>setStatus(current.id,"active")}>🚀 公開して開始</button>:null}{current.status==="active"?<><button className="btn secondary" onClick={()=>setStatus(current.id,"paused")}>⏸ 一時停止</button><button className="btn secondary" onClick={()=>setStatus(current.id,"ended")}>終了</button></>:null}{current.status==="paused"?<><button className="btn" onClick={()=>setStatus(current.id,"active")}>▶ 再開</button><button className="btn secondary" onClick={()=>setStatus(current.id,"ended")}>終了</button></>:null}</div>
      </div>:null}
    </>}
  </div></AppShell>
}