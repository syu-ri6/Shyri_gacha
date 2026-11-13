"use client";
import {Suspense,useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {getSupabase} from "@/lib/supabase";
import type {User} from "@supabase/supabase-js";

type Profile={
  user_id:string;
  reality_name:string;
  verification_status:"unverified"|"pending"|"verified"|"rejected";
  reality_verified_at:string|null;
};
type GachaEvent={id:string;title:string;status:string;prize_count:number;total_weight:number};
type GachaPrize={id:string;display_title:string;rarity:string;probability:number;is_secret:boolean};
type DrawResult={
  draw_id:string;result_position:number;prize_id:string;prize_title:string;
  rarity:string;is_secret:boolean;remaining_balance:number;
};

function Main(){
  const supabase=getSupabase();
  const params=useSearchParams();
  const view=params.get("view")||"home";
  const [user,setUser]=useState<User|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [name,setName]=useState("");
  const [ticketBalance,setTicketBalance]=useState(0);
  const [event,setEvent]=useState<GachaEvent|null>(null);
  const [prizes,setPrizes]=useState<GachaPrize[]>([]);
  const [results,setResults]=useState<DrawResult[]>([]);
  const [pendingResults,setPendingResults]=useState<DrawResult[]>([]);
  const [animating,setAnimating]=useState(false);
  const [animationRarity,setAnimationRarity]=useState("N");
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function refreshCore(){
    if(!supabase)return;
    const [pr,tickets]=await Promise.all([
      supabase.rpc("shuri_get_my_profile"),
      supabase.rpc("shuri_get_ticket_balance")
    ]);
    if(pr.error){setError(pr.error.message);return;}
    if(tickets.error){setError(tickets.error.message);return;}
    const p=(pr.data?.[0]??null) as Profile|null;
    setProfile(p);
    setName(p?.reality_name??"");
    setTicketBalance(Number(tickets.data??0));
  }

  async function refreshGacha(){
    if(!supabase)return;
    const [ev,ps]=await Promise.all([
      supabase.rpc("shuri_get_active_event"),
      supabase.rpc("shuri_get_active_prizes")
    ]);
    if(ev.error){setError(ev.error.message);return;}
    if(ps.error){setError(ps.error.message);return;}
    setEvent((ev.data?.[0]??null) as GachaEvent|null);
    setPrizes((ps.data??[]) as GachaPrize[]);
  }

  useEffect(()=>{
    if(!supabase){setReady(true);return;}
    supabase.auth.getUser().then(async({data,error})=>{
      if(error)setError(error.message);
      setUser(data.user);
      if(data.user)await refreshCore();
      setReady(true);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setUser(session?.user??null);
      if(session?.user)setTimeout(()=>refreshCore(),0);
      else {setProfile(null);setName("");setTicketBalance(0);}
    });
    return ()=>subscription.unsubscribe();
  },[supabase]);

  useEffect(()=>{
    if(user&&view==="gacha")refreshGacha();
  },[user,view]);

  async function signIn(){
    if(!supabase)return;
    setError("");
    const {error:e}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});
    if(e)setError(e.message);
  }

  async function saveName(){
    if(!supabase||!name.trim())return;
    setBusy(true);setError("");
    const {error:e}=await supabase.rpc("shuri_save_reality_name",{new_name:name.trim()});
    if(e)setError(e.message); else await refreshCore();
    setBusy(false);
  }

  async function requestVerification(){
    if(!supabase)return;
    setBusy(true);setError("");
    const {error:e}=await supabase.rpc("shuri_request_reality_verification");
    if(e)setError(e.message); else await refreshCore();
    setBusy(false);
  }

  async function draw(count:1|10){
    if(!supabase)return;
    setBusy(true);setError("");setResults([]);setPendingResults([]);
    const key=crypto.randomUUID();
    const {data,error:e}=await supabase.rpc("shuri_draw_gacha",{pull_count:count,request_key:key});
    if(e){
      setError(e.message);
      setBusy(false);
      return;
    }

    const rows=(data??[]) as DrawResult[];
    if(rows.length){
      const rank:Record<string,number>={N:1,R:2,SR:3,SSR:4,UR:5};
      const best=rows.reduce((a,b)=>(rank[b.rarity]||0)>(rank[a.rarity]||0)?b:a,rows[0]);
      setAnimationRarity(best.rarity);
      setPendingResults(rows);
      setAnimating(true);
      setTicketBalance(Number(rows[0].remaining_balance));
      window.setTimeout(()=>{
        setResults(rows);
        setAnimating(false);
        setPendingResults([]);
        setBusy(false);
      }, best.rarity==="UR"?3000:best.rarity==="SSR"?2500:best.rarity==="SR"?2200:1800);
    }else{
      setBusy(false);
    }
  }

  async function signOut(){
    if(!supabase)return;
    const {error:e}=await supabase.auth.signOut();
    if(e)setError(e.message);
  }

  const statusLabel=profile?.verification_status==="verified"?"✅ 確認済み":profile?.verification_status==="pending"?"⏳ 承認待ち":profile?.verification_status==="rejected"?"❌ 再確認が必要":"未確認";

  return <AppShell>
    {!supabase?<div className="notice">🔧 Supabase接続設定が未完了です。</div>:null}
    {error?<p className="notice danger" role="alert">{error}</p>:null}
    {!ready?<p className="spinner">読み込み中...</p>:!user?<>
      <div className="hero"><div className="eyebrow">WELCOME TO THE WORLD OF</div><h1>SHURI<br/>GACHA 🎰</h1><p>しゅりなーだけの、わくわくコレクション。</p><span className="tag">💪🏻🐰 Papparapappappa</span></div>
      <div className="card stack"><h2>まずはログイン！</h2><p className="muted">Googleでログイン後、REALITY名を登録して本人確認へ進もう。</p><button className="btn block" onClick={signIn} disabled={!supabase}>Googleでログイン</button></div>
    </>:<>
      {view==="home"?<>
        <div className="eyebrow">WELCOME BACK</div><h2>{profile?.reality_name||"しゅりなー"} さん 🐰</h2>
        <div className="grid"><div className="stat"><div className="muted">🎟 SHURI TICKET</div><strong>{ticketBalance}</strong><span className="small"> 枚</span></div><div className="stat"><div className="muted">✨ SHURI POINT</div><strong>0</strong><span className="small"> SP</span></div></div>
        <div className="card stack"><strong>✅ Googleログイン済み</strong><p className="muted">本人確認：{statusLabel}</p><Link className="btn" href="/?view=profile">REALITY名・本人確認へ</Link></div>
        <div className="hero"><div className="eyebrow">SHURI GACHA</div><h1>LET'S<br/>DRAW!</h1><p>開催中のイベントはガチャページから。</p><Link className="btn secondary" href="/?view=gacha">ガチャへ →</Link></div>
      </>:view==="profile"?<>
        <h2>MY PROFILE 🐰</h2>
        <div className="card stack"><label htmlFor="reality">REALITY表示名</label><input id="reality" className="field" value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="REALITYでの名前"/><button className="btn" disabled={busy||!name.trim()} onClick={saveName}>表示名を保存</button></div>
        <div className="card stack"><h3>REALITY本人確認</h3><p className="muted">状態：{statusLabel}</p>{profile?.verification_status!=="verified"?<><p className="small">「本人確認を申請」を押したら、配信で「申請したよ」と教えてください。</p><button className="btn secondary" disabled={busy||!profile?.reality_name||profile?.verification_status==="pending"} onClick={requestVerification}>{profile?.verification_status==="pending"?"申請済み":"本人確認を申請"}</button></>:<p className="success">本人確認が完了しています！</p>}</div>
        <button className="btn secondary" onClick={signOut}>ログアウト</button><p className="muted">Googleメールアドレスは他のユーザーには公開されません。</p><Link href="/" className="muted">← ホームへ戻る</Link>
      </>:view==="gacha"?<>
        <div className="row"><h2>GACHA 🎰</h2><strong>🎟 {ticketBalance}枚</strong></div>
        {profile?.verification_status!=="verified"?<div className="card stack"><h3>本人確認が必要です</h3><p className="muted">ガチャを引く前にREALITY本人確認を完了してね。</p><Link className="btn" href="/?view=profile">本人確認へ</Link></div>:!event?<div className="card stack"><h3>現在開催中のガチャはありません</h3><p className="muted">次のイベントをお楽しみに！</p></div>:<>
          <div className="hero"><div className="eyebrow">NOW OPEN</div><h1>{event.title}</h1><p>1回＝1チケット。10回＝10チケット。</p></div>
          <div className="gacha-actions"><button className="btn" disabled={busy||ticketBalance<1} onClick={()=>draw(1)}>🎟 1回引く</button><button className="btn" disabled={busy||ticketBalance<10} onClick={()=>draw(10)}>🎟 10回引く</button></div>
          {animating?<div className={"gacha-overlay rarity-"+animationRarity.toLowerCase()}>
            <div className="gacha-backdrop"/>
            <div className="gacha-rays"/>
            <div className="gacha-stage">
              <div className="gacha-machine">
                <div className="gacha-window">🐰</div>
                <div className="gacha-handle"/>
              </div>
              <div className="gacha-capsule"><span>✦</span></div>
              <div className="gacha-burst">✦ ✧ ✦</div>
              <div className="gacha-message">
                {animationRarity==="UR"?"ULTRA RARE!!":animationRarity==="SSR"?"SSR CHANCE!!":animationRarity==="SR"?"SR CHANCE!":"PAPPARAPAPPAPPA!"}
              </div>
              <div className="gacha-tap">抽選中...</div>
            </div>
          </div>:null}
          {results.length>0?<div className={"card stack result-panel rarity-"+animationRarity.toLowerCase()}><h3>✨ RESULT</h3><div className="result-grid">{results.map((r,i)=><div className={"result-card reveal rarity-"+r.rarity.toLowerCase()} style={{animationDelay:(i*90)+"ms"}} key={r.result_position}><span className="rarity">{r.rarity}</span><strong>{r.prize_title}</strong></div>)}</div><p className="muted">残り 🎟 {ticketBalance}枚</p></div>:null}
          <div className="card stack"><h3>提供割合</h3>{prizes.map(p=><div className="prob-row" key={p.id}><span><b>{p.rarity}</b> {p.display_title}</span><span>{Number(p.probability).toFixed(2)}%</span></div>)}</div>
        </>}
      </>:<div className="card stack"><h2>{view==="shop"?"SP SHOP 🛍️":"COLLECTION 🎧"}</h2><p className="muted">この機能は次の開発ステップでつなぎます。</p><Link href="/" className="btn secondary">ホームへ</Link></div>}
    </>}
  </AppShell>;
}
export default function Page(){return <Suspense fallback={<div className="app">読み込み中...</div>}><Main/></Suspense>}
