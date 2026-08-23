/* RANEEV Clinical Wayfinding — reusable command-spine primitives: semantic state, broad touch controls, clear operational hierarchy. */
import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity, AlertTriangle, ArrowLeft, Bell, Check, ChevronRight, CircleDot, Clock3, Command, FileWarning,
  HeartPulse, History, Home, Info, LayoutDashboard, LoaderCircle, MapPin, Menu, Navigation, Radio,
  Search, ShieldCheck, Signal, Users, UserRound, WifiOff, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { assets, navByRole, type EmergencyTone } from "@/lib/mockData";

const toneMap: Record<EmergencyTone, { label: string; cls: string; dot: string }> = {
  critical: { label: "Active emergency", cls: "border-[#edc6c1] bg-[#f9e7e5] text-[#a52828]", dot: "bg-[#d83232]" },
  warning: { label: "Attention needed", cls: "border-[#f1d6a4] bg-[#fff1d7] text-[#8f5408]", dot: "bg-[#b86d0a]" },
  safe: { label: "Safe / available", cls: "border-[#bfe0ce] bg-[#e2f1e9] text-[#176143]", dot: "bg-[#247352]" },
  info: { label: "Information", cls: "border-[#bed6e5] bg-[#e2eff6] text-[#0e4e78]", dot: "bg-[#0e4e78]" },
  neutral: { label: "Normal", cls: "border-[#d7dddc] bg-[#f4f6f5] text-[#4f606a]", dot: "bg-[#60707c]" },
};

export function BrandLockup({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return <div className="flex items-center gap-2.5">
    <img src={assets.logo} alt="RANEEV response compass" className="h-10 w-10 shrink-0 object-contain" />
    {!compact && <div className={`leading-none ${inverse ? "text-white" : "text-[#17212b]"}`}><div className="text-base font-extrabold tracking-[0.16em]">RANEEV</div><div className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.15em] opacity-70">Response network</div></div>}
  </div>;
}

export function StatusBadge({ tone = "neutral", label }: { tone?: EmergencyTone; label?: string }) {
  const item = toneMap[tone];
  return <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-[0.22rem] border px-2.5 text-[0.7rem] font-extrabold uppercase tracking-[0.08em] ${item.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />{label ?? item.label}</span>;
}

export function SurfaceCard({ children, className = "", tone }: { children: ReactNode; className?: string; tone?: EmergencyTone }) {
  const rail = tone === "critical" ? "bg-[#d83232]" : tone === "warning" ? "bg-[#b86d0a]" : tone === "safe" ? "bg-[#247352]" : tone === "info" ? "bg-[#0e4e78]" : "bg-[#cbd5d6]";
  return <section className={`rn-panel relative overflow-hidden ${className}`}><span className={`absolute inset-y-0 left-0 w-1 ${rail}`} />{children}</section>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="mb-6 flex flex-col gap-4 border-b border-[#cbd5d6] pb-5 md:flex-row md:items-end md:justify-between"><div><div className="rn-eyebrow"><CircleDot className="h-3.5 w-3.5" />{eyebrow}</div><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] text-[#17212b] sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#60707c]">{description}</p><div className="rn-context-band"><span className="rn-mono text-[#0e4e78]">RANEEV/OPS</span><span className="rn-route-line w-7" /><span>Verified-action interface</span></div></div>{action}</header>;
}

const uiStates = [
  { key: "success", label: "Success", icon: Check, tone: "safe" as EmergencyTone, text: "Saved locally in the UI shell. Backend confirmation will appear here." },
  { key: "loading", label: "Loading", icon: LoaderCircle, tone: "info" as EmergencyTone, text: "Retrieving the latest protected incident data…" },
  { key: "empty", label: "Empty", icon: Search, tone: "neutral" as EmergencyTone, text: "No matching records are available for this view." },
  { key: "error", label: "Error", icon: XCircle, tone: "critical" as EmergencyTone, text: "We could not complete this request. Your last verified state is unchanged." },
  { key: "offline", label: "Offline", icon: WifiOff, tone: "warning" as EmergencyTone, text: "Connection lost. Do not assume a request was sent until it is confirmed." },
];

export function StatePreview({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState("success");
  const item = uiStates.find((state) => state.key === active) ?? uiStates[0];
  const Icon = item.icon;
  return <details className={`border-t border-dashed border-[#c6d0d1] pt-3 ${compact ? "mt-1" : "mt-2"}`} aria-label="Resilient state treatment"><summary className="rn-focus flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-[0.64rem] font-extrabold uppercase tracking-[0.1em] text-[#52626c]"><span className="flex items-center gap-2"><Signal className="h-3.5 w-3.5 text-[#0e4e78]" />Resilient state treatment</span><span className="rn-mono text-[0.58rem] text-[#60707c]">loading · empty · error · offline</span></summary><div className="mt-3 border-l-2 border-[#0e4e78] bg-[#f7faf9] p-3"><div className="flex flex-wrap gap-1.5">{uiStates.map((state) => <button key={state.key} onClick={() => setActive(state.key)} className={`rn-focus min-h-7 border px-2 text-[0.62rem] font-extrabold uppercase tracking-[0.07em] ${active === state.key ? "border-[#17212b] bg-[#17212b] text-white" : "border-[#cbd5d6] bg-white text-[#60707c] hover:bg-[#edf0ee]"}`}>{state.label}</button>)}</div><div className="mt-3 flex items-start gap-2.5 border-t border-[#d7dddc] pt-3"><span className="mt-0.5"><Icon className={`h-4 w-4 ${item.key === "loading" ? "animate-spin text-[#0e4e78]" : "text-[#43535e]"}`} /></span><div><StatusBadge tone={item.tone} label={item.label} /><p className="mt-1.5 text-xs font-medium leading-5 text-[#60707c]">{item.text}</p></div></div></div></details>;
}

export function MapSurface({ label = "Live route preview", tall = false }: { label?: string; tall?: boolean }) {
  return <div className={`relative overflow-hidden rounded-xl border border-[#bfc9cb] bg-[#dfe7e5] ${tall ? "min-h-[27rem]" : "min-h-[18rem]"}`}>
    <img src={assets.mapHero} alt="Illustrated emergency coordination map" className="absolute inset-0 h-full w-full object-cover opacity-90" />
    <div className="absolute left-[29%] top-[45%] flex items-center gap-2"><span className="h-6 w-6 rounded-full border-4 border-white bg-[#d83232] shadow-[0_0_0_5px_rgba(216,50,50,0.18)]" /><span className="rounded bg-white px-2 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-[#a52828] shadow-[var(--rn-shadow-sm)]">Incident</span></div>
    <div className="absolute right-[23%] top-[28%] flex items-center gap-2"><span className="h-5 w-5 rounded-full border-4 border-white bg-[#0e4e78] shadow-[0_0_0_4px_rgba(14,78,120,0.16)]" /><span className="rounded bg-white px-2 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-[#0e4e78] shadow-[var(--rn-shadow-sm)]">Responder</span></div>
    <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-3"><span className="rounded-md bg-white px-2.5 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-[#43535e] shadow-[var(--rn-shadow-sm)]">{label}</span><span className="rn-mono rounded-md bg-[#17212b] px-2.5 py-1.5 text-[0.65rem] font-semibold text-white">13.1986° N · 77.7102° E</span></div>
    <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-[#bed6e5] bg-white px-3 py-2 shadow-[var(--rn-shadow-sm)]"><Navigation className="h-4 w-4 text-[#0e4e78]" /><div><p className="text-xs font-extrabold text-[#17212b]">2.4 km remaining</p><p className="text-[0.65rem] font-semibold text-[#60707c]">Last location update · 11:47</p></div></div>
  </div>;
}

export function Metric({ label, value, sub, tone = "info" }: { label: string; value: string; sub: string; tone?: EmergencyTone }) {
  const color = tone === "critical" ? "text-[#d83232]" : tone === "warning" ? "text-[#b86d0a]" : tone === "safe" ? "text-[#247352]" : "text-[#0e4e78]";
  return <div className="rn-panel p-4"><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-[#60707c]">{label}</p><p className={`mt-2 text-3xl font-extrabold tracking-[-0.05em] ${color}`}>{value}</p><p className="mt-1 text-xs font-semibold text-[#60707c]">{sub}</p></div>;
}

export function OperationalAlert({ tone = "info", title, children }: { tone?: EmergencyTone; title: string; children: ReactNode }) {
  const cls = tone === "critical" ? "border-[#edc6c1] bg-[#fdf3f1]" : tone === "warning" ? "border-[#f1d6a4] bg-[#fffaf0]" : tone === "safe" ? "border-[#bfe0ce] bg-[#f2faf5]" : "border-[#bed6e5] bg-[#f4f9fc]";
  const Icon = tone === "critical" ? AlertTriangle : tone === "warning" ? FileWarning : tone === "safe" ? ShieldCheck : Info;
  return <div className={`flex gap-3 rounded-xl border p-4 ${cls}`}><Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#43535e]" /><div><p className="text-sm font-extrabold text-[#17212b]">{title}</p><div className="mt-1 text-xs font-medium leading-5 text-[#52626c]">{children}</div></div></div>;
}

type Role = keyof typeof navByRole;
const navIcons = [Home, Activity, Radio, History, UserRound, LayoutDashboard, Signal, HeartPulse, Users, ShieldCheck, Search, Command];

export function ConsoleShell({ role, children }: { role: Role; children: ReactNode }) {
  const [location] = useLocation();
  const nav = navByRole[role];
  const title = role === "citizen" ? "Citizen" : role === "volunteer" ? "Volunteer" : role === "coordinator" ? "Coordinator" : "Administrator";
  return <div className="rn-app-bg min-h-screen"><div className="mx-auto flex min-h-screen max-w-[1600px]">
    <aside className="sticky top-0 hidden h-screen w-[17.25rem] shrink-0 border-r border-[#d7dddc] bg-[#17212b] px-4 py-6 text-white lg:flex lg:flex-col"><BrandLockup inverse /><div className="mt-8 border-y border-white/10 py-4"><p className="text-[0.62rem] font-extrabold uppercase tracking-[0.15em] text-white/55">{title} workspace</p><div className="mt-2 flex items-center gap-2 text-xs font-bold text-white/85"><span className="h-2 w-2 rounded-full bg-[#5cc58c]" />Operational access ready</div></div><nav className="mt-5 space-y-1">{nav.map(([label, href], index) => { const Icon = navIcons[index % navIcons.length]; const isActive = location === href; return <Link key={href} href={href} className={`rn-focus flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 text-sm font-bold transition-colors ${isActive ? "border-[#5cc58c] bg-white text-[#17212b]" : "border-transparent text-white/72 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</Link>; })}</nav><div className="mt-auto border-l-2 border-[#d83232] bg-white/5 p-3"><p className="text-xs font-extrabold">Immediate danger?</p><p className="mt-1 text-[0.7rem] leading-4 text-white/60">Contact local professional emergency services whenever possible.</p></div></aside>
    <main className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-[#cbd5d6] bg-[#f6f4ef]/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8"><div className="flex items-center gap-3 lg:hidden"><Drawer><DrawerTrigger asChild><button aria-label="Open navigation" className="rn-focus flex h-10 w-10 items-center justify-center rounded-md border border-[#cbd5d6] bg-white"><Menu className="h-5 w-5" /></button></DrawerTrigger><DrawerContent><DrawerHeader><DrawerTitle>RANEEV {title}</DrawerTitle><DrawerDescription>Choose the operational view you need.</DrawerDescription></DrawerHeader><div className="space-y-1 px-4 pb-6">{nav.map(([label, href]) => <Link key={href} href={href} className="flex min-h-11 items-center justify-between border-b border-[#edf0ee] py-2 text-sm font-bold text-[#17212b]">{label}<ChevronRight className="h-4 w-4 text-[#60707c]" /></Link>)}</div></DrawerContent></Drawer><BrandLockup compact /></div><div className="hidden lg:block"><div className="rn-eyebrow">Operations interface</div><p className="mt-1 text-sm font-extrabold text-[#17212b]">{title} workspace</p></div><div className="flex items-center gap-2"><span className="hidden border-l-2 border-[#247352] bg-[#eef3f3] px-2 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-[#43535e] sm:inline">Authorized view</span><button aria-label="Notifications" onClick={() => toast("Notifications will connect when the backend is implemented.")} className="rn-focus flex h-10 w-10 items-center justify-center rounded-md border border-[#cbd5d6] bg-white text-[#43535e]"><Bell className="h-4 w-4" /></button><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0e4e78] text-xs font-extrabold text-white">{role === "citizen" ? "SK" : role === "volunteer" ? "AR" : role === "coordinator" ? "CO" : "AD"}</div></div></header><div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div></main>
  </div></div>;
}

export function BackLink({ href, label = "Back" }: { href: string; label?: string }) { return <Link href={href} className="rn-focus mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-extrabold uppercase tracking-[0.1em] text-[#0e4e78] hover:bg-[#e2eff6]"><ArrowLeft className="h-4 w-4" />{label}</Link>; }

export function DemoAction({ children, emergency = false, className = "" }: { children: ReactNode; emergency?: boolean; className?: string }) { return <Button onClick={() => toast(emergency ? "No emergency request was sent. This is a frontend-only workflow preview." : "Interface action recorded for demonstration only — backend integration is next.")} className={`rn-focus rn-touch font-extrabold ${emergency ? "bg-[#d83232] text-white hover:bg-[#b82727]" : "bg-[#0e4e78] text-white hover:bg-[#0b3e61]"} ${className}`}>{children}</Button>; }

export function DetailDialog() { return <Dialog><DialogTrigger asChild><button className="rn-focus min-h-10 rounded-lg border border-[#cbd5d6] bg-white px-3 text-xs font-extrabold text-[#43535e] hover:bg-[#edf0ee]">Review safety protocol</button></DialogTrigger><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Emergency response protocol</DialogTitle><DialogDescription>This is a UI-only reference surface. The production workflow will use approved local operating procedures.</DialogDescription></DialogHeader><div className="space-y-3 text-sm font-medium leading-6 text-[#52626c]"><p>1. Confirm incident location and category before requesting help.</p><p>2. Communicate only verified, relevant details with an assigned responder.</p><p>3. Contact professional emergency services whenever available.</p></div></DialogContent></Dialog>; }
