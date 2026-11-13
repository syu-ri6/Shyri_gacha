"use client";
import Link from "next/link";
import {House,Dices,Library,ShoppingBag,UserRound,Bell} from "lucide-react";
import {usePathname,useSearchParams} from "next/navigation";
const links=[["home","/","ホーム",House],["gacha","/?view=gacha","ガチャ",Dices],["collection","/?view=collection","図鑑",Library],["shop","/?view=shop","SP",ShoppingBag],["profile","/?view=profile","マイページ",UserRound]] as const;
export default function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const params=useSearchParams();
  const view=params.get("view")||"home";
  return <div className="app"><header className="top"><Link href="/" className="brand">🐰 SHURI <span>GACHA</span></Link><Bell size={21}/></header>{children}<nav className="nav" aria-label="メインメニュー">{links.map(([key,href,label,Icon])=><Link href={href} key={key} className={path==="/"&&view===key?"active":""}><Icon size={20}/>{label}</Link>)}</nav></div>
}
