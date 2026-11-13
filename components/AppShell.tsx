"use client";
import Link from 'next/link';import {House, Dices, Library, ShoppingBag,UserRound, Bell} from 'lucide-react';import {usePathname} from 'next/navigation';
const links=[['/','ホーム',House],['/?view=gacha','ガチャ',Dices],['/?view=collection','図鑑',Library],['/?view=shop','SP',ShoppingBag],['/?view=profile','マイページ',UserRound]] as const;
export default function AppShell({children}:{children:React.ReactNode}){const path=usePathname();return <div className="app"><header className="top"><Link href="/" className="brand">🐰 SHURI <span>GACHA</span></Link><Bell size={21}/></header>{children}<nav className="nav" aria-label="メインメニュー">{links.map(([href,label,Icon],i)=><Link href={href} key={label} className={i===0&&path==='/'?'active':''}><Icon size={20}/>{label}</Link>)}</nav></div>}
