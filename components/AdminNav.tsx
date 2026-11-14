"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

const items=[
  ["/admin","🏠","概要"],
  ["/admin/events","🎰","イベント"],
  ["/admin/verification","👤","本人確認"],
  ["/admin/tickets","🎟","チケット"],
  ["/admin/history","🧾","履歴"],
] as const;

export default function AdminNav(){
  const path=usePathname();
  return <nav className="admin-page-nav" aria-label="管理メニュー">
    {items.map(([href,icon,label])=><Link key={href} href={href} className={path===href?"active":""}><span>{icon}</span><small>{label}</small></Link>)}
  </nav>;
}
