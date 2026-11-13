"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import {getSupabase} from '@/lib/supabase';
type P={id:string;reality_name:string|null;verification_status:string;verification_code:string|null};
export default function Admin(){
 const [profiles,setProfiles]=useState<P[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [count,setCount]=useState<Record<string,string>>({});
 async function call(action:string,extra:Record<string,unknown>={}){
  const supabase=getSupabase();if(!supabase)throw Error('Supabase is not configured');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw Error('ログインが必要です');
  const res=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...extra})});
  const data=await res.json();if(!res.ok)throw Error(data.error||'操作に失敗しました');return data;
 }
 async function load(){setError('');try{const d=await call('list');setProfiles(d.profiles)}catch(e){setError(e instanceof Error?e.message:'Error')}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 async function action(a:string,extra:Record<string,unknown>){try{await call(a,extra);await load()}catch(e){setError(e instanceof Error?e.message:'Error')}}
 return <AppShell><div className="row"><h2>🔐 管理者画面</h2><Link href="/" className="muted">ホームへ</Link></div><p className="muted">本人確認コードをREALITY配信コメントと照合してから承認してください。</p>{error?<p className="notice danger">{error}</p>:null}{loading?<p>読み込み中...</p>:profiles.map(p=><div className="card stack" key={p.id}><strong>{p.reality_name||'名前未登録'}</strong><span className="muted">{p.verification_status}</span>{p.verification_code?<div className="code">{p.verification_code}</div>:null}{p.verification_status==='pending'?<div className="row"><button className="btn" onClick={()=>action('approve',{userId:p.id,status:'verified'})}>確認して承認</button><button className="btn secondary" onClick={()=>action('approve',{userId:p.id,status:'rejected'})}>却下</button></div>:null}{p.verification_status==='verified'?<div className="row"><input className="field" style={{maxWidth:110}} type="number" min="1" max="1000" value={count[p.id]||'1'} onChange={e=>setCount({...count,[p.id]:e.target.value})}/><button className="btn" onClick={()=>action('grant',{userId:p.id,count:Number(count[p.id]||1)})}>チケット配布</button></div>:null}</div>)}<p className="muted">この画面は管理者のGoogleメールアドレスでのみデータ取得・操作ができます。</p></AppShell>;
}