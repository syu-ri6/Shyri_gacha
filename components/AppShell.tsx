"use client";
import Link from "next/link";
import {House,Dices,Library,ShoppingBag,UserRound,Bell} from "lucide-react";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";

const links=[["home","/","ホーム",House],["gacha","/?view=gacha","ガチャ",Dices],["collection","/?view=collection","図鑑",Library],["shop","/?view=shop","SP",ShoppingBag],["profile","/?view=profile","マイページ",UserRound]] as const;

export default function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const [view,setView]=useState("home");

  useEffect(()=>{
    const sync=()=>setView(new URLSearchParams(window.location.search).get("view")||"home");
    sync();
    window.addEventListener("popstate",sync);
    return ()=>window.removeEventListener("popstate",sync);
  },[path]);

  return <div className="app">
    <header className="top"><Link href="/" className="brand">🐰 SHURI <span>GACHA</span></Link><Bell size={21}/></header>
    {children}
    <nav className="nav" aria-label="メインメニュー">
      {links.map(([key,href,label,Icon])=><Link href={href} key={key} onClick={()=>setView(key)} className={path==="/"&&view===key?"active":""}><Icon size={20}/>{label}</Link>)}
    </nav>
  </div>
}
