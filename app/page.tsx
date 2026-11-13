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
  verification_code:string|null;
  verification_code_expires_at:string|null;
  reality_verified_at:string|null;
};

function Main(){
  const supabase=getSupabase();
  const params=useSearchParams();
  const view=params.get("view")||"home";
  const [user,setUser]=useState<User|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [name,setName]=useState("");
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function refreshProfile(){
    if(!supabase)return;
    const {data,error:e}=await supabase.rpc("shuri_get_my_profile");
    if(e){setError(e.message);return;}
    const p=(data?.[0]??null) as Profile|null;
    setProfile(p);
    setName(p?.reality_name??"");
  }

  useEffect(()=>{
    if(!supabase){setReady(true);return;}
    supabase.auth.getUser().then(async({data,error})=>{
      if(error)setError(error.message);
      setUser(data.user);
      if(data.user)await refreshProfile();
      setReady(true);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setUser(session?.user??null);
      if(session?.user)setTimeout(()=>refreshProfile(),0);
      else {setProfile(null);setName("");}
    });
    return ()=>subscription.unsubscribe();
  },[supabase]);

  async function signIn(){
    if(!supabase)return;
    setError("");
    const {error:e}=await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:window.location.origin}
    });
    if(e)setError(e.message);
  }

  async function saveName(){
    if(!supabase||!name.trim())return;
    setBusy(true);setError("");
    const {error:e}=await supabase.rpc("shuri_save_reality_name",{new_name:name.trim()});
    if(e)setError(e.message);
    else await refreshProfile();
    setBusy(false);
  }

  async function requestVerification(){
    if(!supabase)return;
    setBusy(true);setError("");
    const {error:e}=await supabase.rpc("shuri_request_reality_verification");
    if(e)setError(e.message);
    else await refreshProfile();
    setBusy(false);
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
      <div className="hero">
        <div className="eyebrow">WELCOME TO THE WORLD OF</div>
        <h1>SHURI<br/>GACHA 🎰</h1>
        <p>しゅりなーだけの、わくわくコレクション。</p>
        <span className="tag">💪🏻🐰 Papparapappappa</span>
      </div>
      <div className="card stack">
        <h2>まずはログイン！</h2>
        <p className="muted">Googleでログイン後、REALITY名を登録して本人確認へ進もう。</p>
        <button className="btn block" onClick={signIn} disabled={!supabase}>Googleでログイン</button>
      </div>
    </>:<>
      {view==="home"?<>
        <div className="eyebrow">WELCOME BACK</div>
        <h2>{profile?.reality_name||"しゅりなー"} さん 🐰</h2>
        <div className="card stack">
          <strong>✅ Googleログイン済み</strong>
          <p className="muted">本人確認：{statusLabel}</p>
          <Link className="btn" href="/?view=profile">REALITY名・本人確認へ</Link>
        </div>
        <div className="hero">
          <div className="eyebrow">NEXT EVENT</div>
          <h1>COMING<br/>SOON!</h1>
          <p>プロフィール確認後、ガチャ機能を順番に開放していきます。</p>
        </div>
      </>:<>
        <h2>MY PROFILE 🐰</h2>
        <div className="card stack">
          <label htmlFor="reality">REALITY表示名</label>
          <input id="reality" className="field" value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="REALITYでの名前"/>
          <button className="btn" disabled={busy||!name.trim()} onClick={saveName}>表示名を保存</button>
        </div>
        <div className="card stack">
          <h3>REALITY本人確認</h3>
          <p className="muted">状態：{statusLabel}</p>
          {profile?.verification_status!=="verified"?<>
            <p className="small">「本人確認を申請」を押したら、しゅりのREALITY配信で「申請したよ」と教えてください。REALITY名を見て、しゅりが管理画面から承認します。</p>
            <button className="btn secondary" disabled={busy||!profile?.reality_name||profile?.verification_status==="pending"} onClick={requestVerification}>{profile?.verification_status==="pending"?"申請済み":"本人確認を申請"}</button>
          </>:<p className="success">本人確認が完了しています！</p>}
        </div>
        <button className="btn secondary" onClick={signOut}>ログアウト</button>
        <p className="muted">Googleメールアドレスは他のユーザーには公開されません。</p>
        <Link href="/" className="muted">← ホームへ戻る</Link>
      </>}
    </>}
  </AppShell>;
}

export default function Page(){
  return <Suspense fallback={<div className="app">読み込み中...</div>}><Main/></Suspense>;
}
