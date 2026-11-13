"use client";
import {Suspense,useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {getSupabase} from "@/lib/supabase";
import type {User} from "@supabase/supabase-js";

function Main(){
  const supabase=getSupabase();
  const params=useSearchParams();
  const view=params.get("view")||"home";
  const [user,setUser]=useState<User|null>(null);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!supabase){setReady(true);return;}
    supabase.auth.getUser().then(({data,error})=>{
      if(error)setError(error.message);
      setUser(data.user);
      setReady(true);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setUser(session?.user??null);
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

  async function signOut(){
    if(!supabase)return;
    const {error:e}=await supabase.auth.signOut();
    if(e)setError(e.message);
  }

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
        <p className="muted">Googleログインの接続テスト中です。ログイン後にREALITY名登録へ進みます。</p>
        <button className="btn block" onClick={signIn} disabled={!supabase}>Googleでログイン</button>
      </div>
    </>:<>
      {view==="home"?<>
        <div className="eyebrow">LOGIN SUCCESS</div>
        <h2>Googleログイン完了 🐰</h2>
        <div className="card stack">
          <strong>✅ Supabase Auth 接続成功</strong>
          <p className="muted">ログイン中：{user.email??"Googleアカウント"}</p>
          <p className="small">次はREALITY名登録と本人確認をSHURI GACHA専用DBへ接続します。</p>
        </div>
        <div className="hero">
          <div className="eyebrow">NEXT STEP</div>
          <h1>PROFILE<br/>SETUP</h1>
          <p>ログイン確認後、プロフィール機能を安全に接続します。</p>
        </div>
        <Link className="btn secondary" href="/?view=profile">ログイン情報を見る</Link>
      </>:<>
        <h2>MY PROFILE 🐰</h2>
        <div className="card stack">
          <strong>Google認証済み</strong>
          <p className="muted">{user.email??"メールアドレス取得なし"}</p>
          <p className="small">REALITY表示名の登録機能は次の接続ステップで有効化します。</p>
        </div>
        <button className="btn secondary" onClick={signOut}>ログアウト</button>
        <Link href="/" className="muted">← ホームへ戻る</Link>
      </>}
    </>}
  </AppShell>;
}

export default function Page(){
  return <Suspense fallback={<div className="app">読み込み中...</div>}><Main/></Suspense>;
}
