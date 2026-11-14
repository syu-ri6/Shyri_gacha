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
  rarity:string;is_secret:boolean;is_duplicate:boolean;sp_awarded:number;
  remaining_balance:number;remaining_sp:number;
};
type CollectionItem={
  event_id:string;event_title:string;prize_id:string;prize_title:string;
  rarity:string;is_secret:boolean;obtained_count:number;first_obtained_at:string;
  card_image_url:string|null;download_url:string|null;download_kind:"audio"|"image"|"video"|"file"|null;
};

function Main(){
  const supabase=getSupabase();
  const params=useSearchParams();
  const view=params.get("view")||"home";
  const [user,setUser]=useState<User|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [name,setName]=useState("");
  const [ticketBalance,setTicketBalance]=useState(0);
  const [spBalance,setSpBalance]=useState(0);
  const [collection,setCollection]=useState<CollectionItem[]>([]);
  const [selectedCollection,setSelectedCollection]=useState<CollectionItem|null>(null);
  const [event,setEvent]=useState<GachaEvent|null>(null);
  const [prizes,setPrizes]=useState<GachaPrize[]>([]);
  const [results,setResults]=useState<DrawResult[]>([]);
  const [pendingResults,setPendingResults]=useState<DrawResult[]>([]);
  const [animating,setAnimating]=useState(false);
  const [gachaStage,setGachaStage]=useState<"idle"|"tap"|"charging"|"reveal"|"summary">("idle");
  const [animationRarity,setAnimationRarity]=useState("N");
  const [revealIndex,setRevealIndex]=useState(0);
  const [skipTen,setSkipTen]=useState(false);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function refreshCore(){
    if(!supabase)return;
    const [pr,tickets,sp]=await Promise.all([
      supabase.rpc("shuri_get_my_profile"),
      supabase.rpc("shuri_get_ticket_balance"),
      supabase.rpc("shuri_get_active_sp_balance")
    ]);
    if(pr.error){setError(pr.error.message);return;}
    if(tickets.error){setError(tickets.error.message);return;}
    if(sp.error){setError(sp.error.message);return;}
    const p=(pr.data?.[0]??null) as Profile|null;
    setProfile(p);
    setName(p?.reality_name??"");
    setTicketBalance(Number(tickets.data??0));
    setSpBalance(Number(sp.data??0));
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
    if(user&&view==="collection"&&supabase){
      supabase.rpc("shuri_get_collection_v2").then(({data,error})=>{
        if(error)setError(error.message);
        else setCollection((data??[]) as CollectionItem[]);
      });
    }
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
    setBusy(true);setError("");setResults([]);setPendingResults([]);setRevealIndex(0);setSkipTen(false);
    const key=crypto.randomUUID();
    const {data,error:e}=await supabase.rpc("shuri_draw_gacha",{pull_count:count,request_key:key});
    if(e){
      setError(e.message);
      setBusy(false);
      return;
    }

    const rows=(data??[]) as DrawResult[];
    if(rows.length){
      setAnimationRarity(rows[0].rarity);
      setPendingResults(rows);
      setAnimating(true);
      setGachaStage("tap");
      setRevealIndex(0);
      setSkipTen(false);
      setTicketBalance(Number(rows[0].remaining_balance));
    }else{
      setBusy(false);
    }
  }

  function chargeMs(rarity:string){
    return rarity==="UR"?2600:rarity==="SSR"?1900:rarity==="SR"?1300:rarity==="R"?800:400;
  }

  function beginChargeFor(card:DrawResult){
    setAnimationRarity(card.rarity);
    setGachaStage("charging");
    window.setTimeout(()=>setGachaStage("reveal"),chargeMs(card.rarity));
  }

  function handleGachaTap(){
    if(gachaStage!=="tap")return;
    const first=pendingResults[0];
    if(first)beginChargeFor(first);
  }

  async function signOut(){
    if(!supabase)return;
    const {error:e}=await supabase.auth.signOut();
    if(e)setError(e.message);
  }

  async function downloadOwned(url:string|null,filename:string){
    if(!url)return;
    try{
      const res=await fetch(url);
      if(!res.ok)throw new Error("download failed");
      const blob=await res.blob();
      const objectUrl=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=objectUrl;
      a.download=filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    }catch{
      window.open(url,"_blank","noopener,noreferrer");
    }
  }

  function shareResultsToX(){
    if(results.length===0)return;
    const rank:Record<string,number>={N:1,R:2,SR:3,SSR:4,UR:5};
    const best=results.reduce((a,b)=>(rank[b.rarity]||0)>(rank[a.rarity]||0)?b:a,results[0]);
    const text=results.length===10
      ? "SHURI GACHA 10連結果🎰\n最高レア："+best.rarity+" "+best.prize_title+"\n#SHURIGACHA"
      : "SHURI GACHAで "+best.rarity+"「"+best.prize_title+"」をGET🎴\n#SHURIGACHA";
    const url=window.location.origin+"/?view=gacha";
    window.open("https://x.com/intent/tweet?text="+encodeURIComponent(text)+"&url="+encodeURIComponent(url),"_blank","noopener,noreferrer");
  }

  const statusLabel=profile?.verification_status==="verified"?"✅ 確認済み":profile?.verification_status==="pending"?"⏳ 承認待ち":profile?.verification_status==="rejected"?"❌ 再確認が必要":"未確認";
  const rarityRank:Record<string,number>={N:1,R:2,SR:3,SSR:4,UR:5};
  const bestRevealCard=pendingResults.length?pendingResults.reduce((a,b)=>(rarityRank[b.rarity]||0)>(rarityRank[a.rarity]||0)?b:a,pendingResults[0]):null;
  const revealCard=pendingResults.length===10&&!skipTen?(pendingResults[revealIndex]??pendingResults[0]):bestRevealCard;

  function closeReveal(){
    if(pendingResults.length===1)setResults(pendingResults);
    setAnimating(false);
    setPendingResults([]);
    setGachaStage("idle");
    setBusy(false);
    setRevealIndex(0);
    setSkipTen(false);
  }

  function showTenSummary(){
    setResults(pendingResults);
    setGachaStage("summary");
  }

  function advanceReveal(e:React.MouseEvent){
    e.stopPropagation();
    if(pendingResults.length!==10){closeReveal();return;}
    if(skipTen){showTenSummary();return;}
    if(revealIndex<9){
      const nextIndex=revealIndex+1;
      setRevealIndex(nextIndex);
      beginChargeFor(pendingResults[nextIndex]);
      return;
    }
    showTenSummary();
  }

  function skipTenReveal(e:React.MouseEvent){
    e.stopPropagation();
    if(pendingResults.length!==10)return;
    const best=pendingResults.reduce((a,b)=>(rarityRank[b.rarity]||0)>(rarityRank[a.rarity]||0)?b:a,pendingResults[0]);
    setSkipTen(true);
    setAnimationRarity(best.rarity);
    setGachaStage("reveal");
  }

  function closeTenSummary(e:React.MouseEvent){
    e.stopPropagation();
    setAnimating(false);
    setPendingResults([]);
    setGachaStage("idle");
    setBusy(false);
    setRevealIndex(0);
    setSkipTen(false);
  }

  return <AppShell>
    {!supabase?<div className="notice">🔧 Supabase接続設定が未完了です。</div>:null}
    {error?<p className="notice danger" role="alert">{error}</p>:null}
    {!ready?<p className="spinner">読み込み中...</p>:!user?<>
      <div className="hero"><div className="eyebrow">WELCOME TO THE WORLD OF</div><h1>SHURI<br/>GACHA 🎰</h1><p>しゅりなーだけの、わくわくコレクション。</p><span className="tag">💪🏻🐰 Papparapappappa</span></div>
      <div className="card stack"><h2>まずはログイン！</h2><p className="muted">Googleでログイン後、REALITY名を登録して本人確認へ進もう。</p><button className="btn block" onClick={signIn} disabled={!supabase}>Googleでログイン</button></div>
    </>:<>
      {view==="home"?<>
        <div className="eyebrow">WELCOME BACK</div><h2>{profile?.reality_name||"しゅりなー"} さん 🐰</h2>
        <div className="grid"><div className="stat"><div className="muted">🎟 SHURI TICKET</div><strong>{ticketBalance}</strong><span className="small"> 枚</span></div><div className="stat"><div className="muted">✨ SHURI POINT</div><strong>{spBalance}</strong><span className="small"> SP</span></div></div>
        <div className="card stack"><strong>✅ Googleログイン済み</strong><p className="muted">本人確認：{statusLabel}</p><Link className="btn" href="/?view=profile">REALITY名・本人確認へ</Link></div>
        <div className="hero"><div className="eyebrow">SHURI GACHA</div><h1>LET'S<br/>DRAW!</h1><p>開催中のイベントはガチャページから。</p><Link className="btn secondary" href="/?view=gacha">ガチャへ →</Link></div>
      </>:view==="profile"?<>
        <h2>MY PROFILE 🐰</h2>
        <div className="card stack"><label htmlFor="reality">REALITY表示名</label><input id="reality" className="field" value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="REALITYでの名前"/><button className="btn" disabled={busy||!name.trim()} onClick={saveName}>表示名を保存</button></div>
        <div className="card stack"><h3>REALITY本人確認</h3><p className="muted">状態：{statusLabel}</p>{profile?.verification_status!=="verified"?<><p className="small">「本人確認を申請」を押したら、配信で「申請したよ」と教えてください。</p><button className="btn secondary" disabled={busy||!profile?.reality_name||profile?.verification_status==="pending"} onClick={requestVerification}>{profile?.verification_status==="pending"?"申請済み":"本人確認を申請"}</button></>:<p className="success">本人確認が完了しています！</p>}</div>
        <button className="btn secondary" onClick={signOut}>ログアウト</button><p className="muted">Googleメールアドレスは他のユーザーには公開されません。</p><Link href="/" className="muted">← ホームへ戻る</Link>
      </>:view==="gacha"?<>
        <div className="gacha-header">
          <h2>GACHA 🎰</h2>
          <div className="gacha-balances">
            <span>🎟 {ticketBalance}</span>
            <span>✨ {spBalance} SP</span>
          </div>
        </div>
        {profile?.verification_status!=="verified"?<div className="card stack"><h3>本人確認が必要です</h3><p className="muted">ガチャを引く前にREALITY本人確認を完了してね。</p><Link className="btn" href="/?view=profile">本人確認へ</Link></div>:!event?<div className="card stack"><h3>現在開催中のガチャはありません</h3><p className="muted">次のイベントをお楽しみに！</p></div>:<>
          <div className="gacha-event-card">
            <div>
              <div className="eyebrow">NOW OPEN</div>
              <h1>{event.title}</h1>
            </div>
            <span className="tag">1回 = 1枚</span>
          </div>

          <div className="card gacha-draw-card">
            <div className="gacha-draw-head">
              <div>
                <strong>ガチャを引く</strong>
                <div className="muted">結果は演出のあとに表示されます</div>
              </div>
            </div>
            <div className="gacha-actions">
              <button className="btn" disabled={busy||ticketBalance<1} onClick={()=>draw(1)}>
                <span className="draw-count">1回</span>
                <span className="draw-cost">🎟 1枚</span>
              </button>
              <button className="btn secondary" disabled={busy||ticketBalance<10} onClick={()=>draw(10)}>
                <span className="draw-count">10回</span>
                <span className="draw-cost">🎟 10枚</span>
              </button>
            </div>
          </div>
          {animating?<div className={"gacha-overlay stage-"+gachaStage+((gachaStage==="reveal"||gachaStage==="summary")?" rarity-"+animationRarity.toLowerCase():"")} onClick={handleGachaTap}>
            <div className="gacha-backdrop"/>
            <div className="gacha-rays"/>
            <div className="gacha-stage">
              {(gachaStage==="tap"||gachaStage==="charging")?<>
                <img className="gacha-machine-art" src="/assets/shuri-gacha-machine.svg?v=2" alt="SHURI GACHA machine"/>
                <img className="gacha-capsule-art" src="/assets/shuri-capsule.svg?v=3" alt="gacha capsule"/>
                {gachaStage==="tap"?<div className="gacha-copy">
                  <div className="gacha-message">TAP!</div>
                  <div className="gacha-tap">画面をタップ</div>
                </div>:<div className="gacha-copy gacha-copy-empty" aria-hidden="true"/>}
                {pendingResults.length===10?<button className="gacha-skip-btn" onClick={skipTenReveal}>SKIP</button>:null}
              </>:gachaStage==="summary"?<div className="ten-result-sheet ten-strip-sheet" onClick={closeTenSummary}>
                <div className="ten-result-head">
                  <div>
                    <div className="eyebrow">10 PULL RESULT</div>
                    <h3>10連結果 🎴</h3>
                    <div className="ten-result-stats">
                      <span>NEW {pendingResults.filter(r=>!r.is_duplicate).length}</span>
                      <span>SR以上 {pendingResults.filter(r=>(rarityRank[r.rarity]||0)>=3).length}</span>
                    </div>
                  </div>
                  <span className="gacha-close-hint">タップで閉じる</span>
                </div>
                <div className="ten-card-grid ten-strip-grid">
                  {pendingResults.map((r,i)=><div className={"ten-result-card ten-strip-card rarity-"+r.rarity.toLowerCase()} key={r.result_position}>
                    {!r.is_duplicate?<span className="ten-new-label">NEW</span>:null}
                    <span className="ten-card-number">{i+1}</span>
                    <div className="ten-card-art ten-strip-art">🐰</div>
                    <div className="ten-strip-gradient"/>
                    <div className="ten-strip-info">
                      <strong>{r.prize_title}</strong>
                      <div className="ten-strip-bottom">
                        <span className="ten-card-rarity">{r.rarity}</span>
                        {r.is_duplicate?<span className="ten-sp-small">+{r.sp_awarded}SP</span>:null}
                      </div>
                    </div>
                  </div>)}
                </div>
                <button className="btn block ten-share-btn" onClick={(e)=>{e.stopPropagation();shareResultsToX();}}>𝕏 10連結果をシェア</button>
              </div>:revealCard?<div className="gacha-reveal-wrap" onClick={advanceReveal}>
                <div className="gacha-burst">✦ ✧ ✦</div>
                <div className={"gacha-prize-card rarity-"+revealCard.rarity.toLowerCase()}>
                  <div className="gacha-card-shine"/>
                  <div className="gacha-card-rarity">{revealCard.rarity}</div>
                  <div className="gacha-card-art">🐰</div>
                  <div className="gacha-card-title">{revealCard.prize_title}</div>
                  <div className={revealCard.is_duplicate?"dupe-badge":"new-badge"}>
                    {revealCard.is_duplicate?"重複 +"+revealCard.sp_awarded+" SP":"NEW!"}
                  </div>
                </div>
                <div className="gacha-reveal-caption">{pendingResults.length===10&&!skipTen?((revealIndex+1)+" / 10"):pendingResults.length>1?"BEST CARD":"GET!"}</div>
                {pendingResults.length===10&&!skipTen?<button className="gacha-skip-btn" onClick={skipTenReveal}>SKIP</button>:null}
                <div className="gacha-close-hint">{pendingResults.length===10?(!skipTen?(revealIndex<9?"タップで次のガチャ":"タップで10枚結果へ"):"タップで10枚結果へ"):"タップで閉じる"}</div>
              </div>:null}
            </div>
          </div>:null}
          {results.length>0?<div className={"card stack result-panel rarity-"+animationRarity.toLowerCase()}><div className="row"><h3>✨ RESULT</h3><button className="btn secondary share-x-btn" onClick={shareResultsToX}>𝕏 結果をシェア</button></div><div className="result-grid">{results.map((r,i)=><div className={"result-card reveal rarity-"+r.rarity.toLowerCase()} style={{animationDelay:(i*90)+"ms"}} key={r.result_position}><span className="rarity">{r.rarity}</span><strong>{r.prize_title}</strong><span className={r.is_duplicate?"dupe-badge":"new-badge"}>{r.is_duplicate?"重複 +"+r.sp_awarded+" SP":"NEW!"}</span></div>)}</div><p className="muted">残り 🎟 {ticketBalance}枚</p></div>:null}
          <details className="card odds-card">
            <summary>提供割合を見る</summary>
            <div className="odds-list">
              {prizes.map(p=><div className="prob-row" key={p.id}><span><b>{p.rarity}</b> {p.display_title}</span><span>{Number(p.probability).toFixed(2)}%</span></div>)}
            </div>
          </details>
        </>}
      </>:view==="collection"?<>
        <div className="row"><h2>COLLECTION 🎧</h2><strong>✨ {spBalance} SP</strong></div>
        {collection.length===0?<div className="card"><p className="muted">まだ景品を獲得していません。ガチャを引くとここに集まるよ。</p></div>:<>
          {[...new Set(collection.map(x=>x.event_title))].map(title=><div key={title}>
            <h3 className="section-title">{title}</h3>
            {["N","R","SR","SSR","UR"].map(rarityName=>{
              const items=collection.filter(x=>x.event_title===title&&x.rarity===rarityName);
              if(items.length===0)return null;
              return <div className="collection-rarity-section" key={rarityName}>
                <div className="collection-rarity-head">
                  <span className={"rarity-pill rarity-"+rarityName.toLowerCase()}>{rarityName}</span>
                  <span className="muted">{items.length}種</span>
                </div>
                <div className="collection-grid">
                  {items.map(x=><button type="button" className={"collection-card collection-thumb rarity-"+x.rarity.toLowerCase()} key={x.prize_id} onClick={()=>setSelectedCollection(x)}>
                    <span className="rarity">{x.rarity}</span>
                    <div className="collection-card-art">{x.card_image_url?<img src={x.card_image_url} alt={x.prize_title}/>:<span>🐰</span>}</div>
                    <strong>{x.prize_title}</strong>
                    <span className="muted">獲得 {x.obtained_count}回</span>
                  </button>)}
                </div>
              </div>
            })}
          </div>)}
        </>}
        {collection.some(x=>x.download_url)?<div className="collection-downloads">
          <div className="row"><h3>DOWNLOADS 🎧</h3><span className="muted">獲得済み</span></div>
          <div className="collection-download-list">
            {collection.filter(x=>x.download_url).map(x=><div className="collection-download-row" key={x.prize_id}>
              <div><strong>{x.prize_title}</strong><div className="muted">{x.download_kind==="audio"?"音源 / ボイス":x.download_kind==="image"?"画像":x.download_kind==="video"?"動画":"ファイル"}</div></div>
              <button className="btn secondary" onClick={()=>downloadOwned(x.download_url,x.prize_title)}>保存</button>
            </div>)}
          </div>
        </div>:null}
        {selectedCollection?<div className="collection-modal" onClick={()=>setSelectedCollection(null)}>
          <div className="collection-modal-backdrop"/>
          <div className="collection-modal-card" onClick={e=>e.stopPropagation()}>
            <button type="button" className="collection-modal-close" onClick={()=>setSelectedCollection(null)}>×</button>
            <div className={"collection-large-card rarity-"+selectedCollection.rarity.toLowerCase()}>
              <div className="collection-large-art">{selectedCollection.card_image_url?<img src={selectedCollection.card_image_url} alt={selectedCollection.prize_title}/>:<span>🐰</span>}</div>
              <div className="collection-large-info">
                <span className={"rarity-pill rarity-"+selectedCollection.rarity.toLowerCase()}>{selectedCollection.rarity}</span>
                <h3>{selectedCollection.prize_title}</h3>
                <span className="muted">獲得 {selectedCollection.obtained_count}回</span>
              </div>
            </div>
            <div className="collection-modal-actions">
              <button className="btn" disabled={!selectedCollection.card_image_url} onClick={()=>downloadOwned(selectedCollection.card_image_url,selectedCollection.prize_title+".png")}>🖼 カードを保存</button>
              {selectedCollection.download_url?<button className="btn secondary" onClick={()=>downloadOwned(selectedCollection.download_url,selectedCollection.prize_title)}>⬇ 素材を保存</button>:null}
            </div>
            <div className="gacha-close-hint">外側をタップして閉じる</div>
          </div>
        </div>:null}
      </>:<div className="card stack"><h2>SP SHOP 🛍️</h2><p className="muted">SP交換所は次のステップでつなぎます。</p><Link href="/" className="btn secondary">ホームへ</Link></div>}
    </>}
  </AppShell>;
}
export default function Page(){return <Suspense fallback={<div className="app">読み込み中...</div>}><Main/></Suspense>}
