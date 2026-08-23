import { useMemo } from "react";
import { Bell, CheckCheck, LoaderCircle, Settings2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type WorkspaceRole = "citizen" | "volunteer" | "coordinator" | "admin";

const priorityClass = { critical: "border-[#edc6c1] bg-[#fdf3f1] text-[#a52828]", high: "border-[#f1d6a4] bg-[#fffaf0] text-[#8f5408]", normal: "border-[#bed6e5] bg-[#f4f9fc] text-[#0e4e78]", low: "border-[#d7dddc] bg-[#f4f6f5] text-[#52626c]" } as const;

function notificationDestination(role: WorkspaceRole, publicId: string | null) {
  if (!publicId) return role === "coordinator" ? "/coordinator" : role === "volunteer" ? "/volunteer" : role === "admin" ? "/admin" : "/citizen";
  if (role === "citizen") return `/citizen/live/${publicId}`;
  if (role === "volunteer") return "/volunteer/active";
  if (role === "coordinator") return `/coordinator/ghr/${publicId}`;
  return "/admin";
}

export function NotificationInbox({ role }: { role: WorkspaceRole }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const inbox = trpc.notifications.inbox.useQuery(undefined, { refetchInterval: 5_000 });
  const preferences = trpc.notifications.preferences.useQuery(undefined, { staleTime: 20_000 });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => void utils.notifications.inbox.invalidate() });
  const updatePreferences = trpc.notifications.updatePreferences.useMutation({ onSuccess: () => void utils.notifications.preferences.invalidate() });
  const items = inbox.data?.items ?? [];
  const unread = inbox.data?.unreadCount ?? 0;
  const preferenceState = preferences.data;
  const title = useMemo(() => unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "Notifications", [unread]);

  return <Dialog>
    <DialogTrigger asChild>
      <button aria-label={title} className="rn-focus relative flex h-10 w-10 items-center justify-center rounded-md border border-[#cbd5d6] bg-white text-[#43535e]">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#f6f4ef] bg-[#d83232] px-1 text-[0.58rem] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
    </DialogTrigger>
    <DialogContent style={{ backgroundColor: "#f6f4ef", opacity: 1 }} className="max-h-[85vh] max-w-lg overflow-y-auto !bg-[#f6f4ef] !opacity-100 p-0 text-[#17212b] shadow-[var(--rn-shadow-lg)] sm:rounded-xl">
      <DialogHeader className="border-b border-[#d7dddc] px-5 py-4 text-left"><DialogTitle className="flex items-center gap-2 text-[#17212b]"><Bell className="h-4 w-4 text-[#0e4e78]" />{title}</DialogTitle><DialogDescription>Protected in-app delivery refreshes while this workspace is open. Critical alerts remain visible here.</DialogDescription></DialogHeader>
      <div className="space-y-2 px-4 py-4">
        {inbox.isLoading && <div className="flex min-h-24 items-center justify-center gap-2 text-xs font-bold text-[#60707c]"><LoaderCircle className="h-4 w-4 animate-spin" />Loading protected notifications…</div>}
        {inbox.isError && <p className="rounded-lg border border-[#edc6c1] bg-[#fdf3f1] p-3 text-xs font-semibold text-[#a52828]">Notifications could not refresh. Your existing incident workspace remains unchanged.</p>}
        {!inbox.isLoading && !inbox.isError && items.length === 0 && <div className="rounded-lg border border-dashed border-[#cbd5d6] p-5 text-center"><CheckCheck className="mx-auto h-5 w-5 text-[#247352]" /><p className="mt-2 text-sm font-extrabold text-[#17212b]">No notifications yet</p><p className="mt-1 text-xs font-medium text-[#60707c]">Emergency coordination updates will appear here when authorized.</p></div>}
        {items.map(({ notification, publicId }) => <button key={notification.id} onClick={async () => { if (!notification.readAt) await markRead.mutateAsync({ notificationId: notification.id }); setLocation(notificationDestination(role, publicId)); }} className={`rn-focus w-full rounded-lg border p-3 text-left transition-colors hover:bg-white ${notification.readAt ? "border-[#d7dddc] bg-[#fbfcfb]" : priorityClass[notification.priority]}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-[#17212b]">{notification.title}</p><p className="mt-1 text-xs font-medium leading-5 text-[#52626c]">{notification.message}</p></div>{!notification.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#d83232]" />}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-[#60707c]"><span>{notification.priority}</span><span>{notification.provider === "demo" ? "Demo in-app" : notification.channel}</span><span>{new Date(notification.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{publicId && <span>{publicId}</span>}</div>
        </button>)}
      </div>
      <div className="border-t border-[#d7dddc] bg-[#f7faf9] px-5 py-4"><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-[#0e4e78]" /><p className="text-xs font-extrabold text-[#17212b]">Notification preferences</p></div><p className="mt-1 text-[0.7rem] leading-4 text-[#60707c]">Critical in-app alerts are always retained. SMS requires an enabled server-side provider and a verified phone number.</p><div className="mt-3 flex flex-wrap gap-3"><label className="flex min-h-9 items-center gap-2 text-xs font-bold text-[#43535e]"><input type="checkbox" checked={preferenceState?.inAppEnabled ?? true} onChange={event => updatePreferences.mutate({ inAppEnabled: event.target.checked, smsEnabled: preferenceState?.smsEnabled ?? false })} />Normal in-app updates</label><label className="flex min-h-9 items-center gap-2 text-xs font-bold text-[#43535e]"><input type="checkbox" checked={preferenceState?.smsEnabled ?? false} onChange={event => updatePreferences.mutate({ inAppEnabled: preferenceState?.inAppEnabled ?? true, smsEnabled: event.target.checked })} />SMS when configured</label></div></div>
    </DialogContent>
  </Dialog>;
}
