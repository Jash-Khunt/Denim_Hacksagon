import { FormEvent, UIEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, CheckCheck, Copy, Loader2, MapPin, MessageCircle, Send, Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { communicationAPI, ChatMessage, CommunicationPartner, Meeting } from "@/services/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1").replace("/api/v1", "");
const toLocalDateTime = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const Communication = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const meetingsMode = location.pathname === "/meetings";
  const meId = user?.role === "hr" ? user.hr_id : user?.client_id;
  const storagePrefix = `clautzel:${user?.role || "unknown"}:${meId || "unknown"}`;
  const selectedStorageKey = `${storagePrefix}:${meetingsMode ? "meetings" : "chat"}:partner`;
  const draftsStorageKey = `${storagePrefix}:chat:drafts`;
  const searchParamsKey = params.toString();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const fromUrl = params.get("partner");
    if (fromUrl) return fromUrl;
    try { return sessionStorage.getItem(selectedStorageKey); } catch { return null; }
  });
  const [mobileChatOpen, setMobileChatOpen] = useState(() => {
    if (params.get("partner")) return true;
    try { return Boolean(sessionStorage.getItem(selectedStorageKey)); } catch { return false; }
  });
  const [partners, setPartners] = useState<CommunicationPartner[]>([]);
  const selected = partners.find((partner) => (user?.role === "hr" ? partner.client_id : partner.hr_id) === selectedId) || null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(draftsStorageKey) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
    } catch { return {}; }
  });
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [locationText, setLocationText] = useState("");
  const [editingMeeting, setEditingMeeting] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [copiedMeeting, setCopiedMeeting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const olderLoadingRef = useRef(false);
  const autoScrollRef = useRef(false);
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null);
  const skippedInitialUrlSync = useRef(false);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const searchParamsRef = useRef(searchParamsKey);
  searchParamsRef.current = searchParamsKey;
  const conversationKeyRef = useRef("");
  const clientId = user?.role === "client" ? user.client_id : selected?.client_id;
  const hrId = user?.role === "hr" ? user.hr_id : selected?.hr_id;
  conversationKeyRef.current = meetingsMode ? `${user?.role}:${meId}` : clientId && hrId ? `${clientId}:${hrId}` : "";
  const draft = selectedId ? drafts[selectedId] || "" : "";

  const loadPartners = useCallback(async () => {
    try {
      const result = await communicationAPI.getPartners();
      setPartners(result.partners);
      setError("");
      const validIds = new Set(result.partners.map((partner) => user?.role === "hr" ? partner.client_id : partner.hr_id).filter((id): id is string => Boolean(id)));
      setDrafts((previous) => {
        const entries = Object.entries(previous).filter(([id]) => validIds.has(id));
        return entries.length === Object.keys(previous).length ? previous : Object.fromEntries(entries);
      });
      const activeId = selectedIdRef.current;
      if (activeId && !result.partners.some((p) => (user?.role === "hr" ? p.client_id : p.hr_id) === activeId)) {
        setSelectedId(null);
        setMobileChatOpen(false);
        try { sessionStorage.removeItem(selectedStorageKey); } catch { /* storage may be disabled */ }
        if (new URLSearchParams(searchParamsRef.current).get("partner")) setParams({}, { replace: true });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load contacts"); }
    finally { setLoading(false); }
  }, [selectedStorageKey, setParams, user?.role]);
  useEffect(() => { void loadPartners(); }, [loadPartners]);

  useEffect(() => {
    if (!skippedInitialUrlSync.current) { skippedInitialUrlSync.current = true; return; }
    const urlId = new URLSearchParams(searchParamsKey).get("partner");
    setSelectedId(urlId);
    setMobileChatOpen(Boolean(urlId));
    if (urlId) { try { sessionStorage.setItem(selectedStorageKey, urlId); } catch { /* storage may be disabled */ } }
    else { try { sessionStorage.removeItem(selectedStorageKey); } catch { /* storage may be disabled */ } }
  }, [searchParamsKey, selectedStorageKey]);

  useEffect(() => {
    try { sessionStorage.setItem(draftsStorageKey, JSON.stringify(drafts)); } catch { /* drafts remain available in memory */ }
  }, [drafts, draftsStorageKey]);

  const loadConversation = useCallback(async (before?: ChatMessage) => {
    if (!meetingsMode && (!clientId || !hrId)) return;
    const requestKey = meetingsMode ? `${user?.role}:${meId}` : `${clientId}:${hrId}`;
    try {
      if (meetingsMode) {
        const result = await communicationAPI.getMyMeetings();
        if (conversationKeyRef.current !== requestKey) return;
        setMeetings(result.meetings);
      } else {
        const node = messageScrollRef.current;
        const nearBottom = !before && node && node.scrollHeight - node.clientHeight - node.scrollTop < 100;
        if (before) setLoadingOlder(true); else if (messagesRef.current.length === 0) setLoadingMessages(true);
        const result = await communicationAPI.getMessages(clientId, hrId, before);
        if (conversationKeyRef.current !== requestKey) return;
        setHasMoreMessages(result.has_more);
        if (before) {
          const current = messagesRef.current;
          const known = new Set(current.map((message) => message.message_id));
          const additions = result.messages.filter((message) => !known.has(message.message_id));
          if (node && additions.length) restoreScrollRef.current = { height: node.scrollHeight, top: node.scrollTop };
          setMessages([...additions, ...current]);
        } else {
          const current = messagesRef.current;
          const known = new Set(current.map((message) => message.message_id));
          const additions = result.messages.filter((message) => !known.has(message.message_id));
          const merged = new Map(current.map((message) => [message.message_id, message]));
          result.messages.forEach((message) => merged.set(message.message_id, message));
          const ordered = [...merged.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.message_id.localeCompare(b.message_id));
          if (current.length === 0 || (nearBottom && additions.length)) autoScrollRef.current = true;
          setMessages(ordered);
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load this conversation"); }
    finally { setLoadingMessages(false); setLoadingOlder(false); olderLoadingRef.current = false; }
  }, [clientId, hrId, meetingsMode, meId, user?.role]);
  useEffect(() => {
    setMessages([]); messagesRef.current = []; setMeetings([]); setHasMoreMessages(false);
    autoScrollRef.current = !meetingsMode;
    if (meetingsMode || (clientId && hrId)) void loadConversation();
    const timer = window.setInterval(() => { void loadConversation(); void loadPartners(); }, 4000);
    return () => window.clearInterval(timer);
  }, [clientId, hrId, meetingsMode, loadConversation, loadPartners]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useLayoutEffect(() => {
    const node = messageScrollRef.current;
    if (!node) return;
    if (restoreScrollRef.current) {
      const prior = restoreScrollRef.current;
      node.scrollTop = prior.top + (node.scrollHeight - prior.height);
      restoreScrollRef.current = null;
    } else if (autoScrollRef.current) {
      node.scrollTop = node.scrollHeight;
      autoScrollRef.current = false;
    }
  }, [messages]);

  const selectPartner = (partner: CommunicationPartner) => {
    const id = user?.role === "hr" ? partner.client_id : partner.hr_id;
    if (!id) return;
    setSelectedId(id);
    setMobileChatOpen(true);
    try { sessionStorage.setItem(selectedStorageKey, id); } catch { /* URL remains the state fallback */ }
    setParams({ partner: id });
  };
  const handleMessageScroll = (event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    if (node.scrollHeight - node.clientHeight - node.scrollTop < 100) return;
    if (node.scrollTop < 60 && hasMoreMessages && !olderLoadingRef.current) {
      const oldest = messagesRef.current[0];
      if (oldest) { olderLoadingRef.current = true; void loadConversation(oldest); }
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientId || !hrId || !selectedId || !draft.trim() || working) return;
    const targetDraftId = selectedId;
    const body = draft.trim();
    setWorking(true); setError("");
    try {
      await communicationAPI.sendMessage(clientId, hrId, body);
      setDrafts((previous) => ({ ...previous, [targetDraftId]: "" }));
      await loadConversation();
    }
    catch (e) { setError(e instanceof Error ? e.message : "Could not send message"); }
    finally { setWorking(false); }
  };
  const schedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientId || !hrId || working) return;
    setWorking(true); setError("");
    try {
      await communicationAPI.createMeeting(clientId, hrId, { title, starts_at: new Date(startsAt).toISOString(), location: locationText });
      setTitle(""); setStartsAt(""); setLocationText(""); await loadConversation();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not schedule meeting"); }
    finally { setWorking(false); }
  };
  const updateMeeting = async (meetingId: string, status: "cancelled" | "scheduled") => {
    setWorking(true); setError("");
    try { await communicationAPI.updateMeeting(meetingId, { status }); await loadConversation(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update meeting"); }
    finally { setWorking(false); }
  };
  const saveMeeting = async (event: FormEvent, meetingId: string) => {
    event.preventDefault();
    setWorking(true); setError("");
    try {
      await communicationAPI.updateMeeting(meetingId, { title: editTitle, starts_at: new Date(editStartsAt).toISOString(), location: editLocation });
      setEditingMeeting(null); await loadConversation();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update meeting"); }
    finally { setWorking(false); }
  };
  const copyMeetingLink = async (meetingId: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meetings/${meetingId}`);
      setCopiedMeeting(meetingId);
      window.setTimeout(() => setCopiedMeeting((current) => current === meetingId ? null : current), 1800);
    } catch { setError("Could not copy the meeting link. Copy it from the browser address bar after opening the room."); }
  };
  const currentPartner = selected;
  const initials = (name: string) => name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const partnerId = (p: CommunicationPartner) => user?.role === "hr" ? p.client_id : p.hr_id;
  const selectedNow = !!selected && mobileChatOpen;

  return <main className="mx-auto max-w-7xl p-3 sm:p-6">
    <div className="mb-4 flex items-center justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-primary">Clautzel • {meetingsMode ? "Meetings" : "Messages"}</p><h1 className="mt-1 text-2xl font-semibold">{meetingsMode ? "Your meetings" : "Conversations"}</h1></div>
      <Button asChild variant="outline" size="sm"><Link to={meetingsMode ? "/chat" : "/meetings"}>{meetingsMode ? <MessageCircle className="mr-2 h-4 w-4" /> : <Video className="mr-2 h-4 w-4" />}{meetingsMode ? "Chat" : "Meetings"}</Link></Button>
    </div>
    {error && <p role="alert" className="mb-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
    <section className="grid h-[min(76vh,780px)] min-h-[500px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:grid-cols-[300px_1fr]">
      <aside className={`${selectedNow ? "hidden md:block" : ""} min-h-0 overflow-y-auto overscroll-contain border-r border-border`}>
        <div className="border-b p-4"><p className="font-semibold">Approved connections</p><p className="mt-1 text-xs text-muted-foreground">HR and client conversations</p></div>
        {loading ? <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : partners.length ? partners.map((p) => <button key={partnerId(p)} onClick={() => selectPartner(p)} className={`flex w-full items-center gap-3 border-b border-border/70 p-4 text-left hover:bg-muted/50 ${selectedId === partnerId(p) ? "bg-muted" : ""}`}>
          <Avatar><AvatarImage src={p.profile_picture?.startsWith("http") ? p.profile_picture : p.profile_picture ? `${API_ROOT}/${p.profile_picture}` : undefined} /><AvatarFallback>{initials(p.name)}</AvatarFallback></Avatar>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.name}</span><span className="block truncate text-xs text-muted-foreground">{p.last_message || p.company_name || "Approved contact"}</span><span className="block text-[11px] text-muted-foreground">{p.last_message_at ? new Date(p.last_message_at).toLocaleString() : "No messages yet"}</span></span>
          {!!p.unread_count && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{p.unread_count}</span>}
        </button>) : <div className="p-6 text-sm text-muted-foreground">No approved connections yet. Approve a connection to get started.</div>}
      </aside>
      <div className={`${selectedNow ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col`}>
        {currentPartner ? <>
          <header className="shrink-0 flex items-center gap-3 border-b border-border p-3 sm:px-5"><Button className="md:hidden" variant="ghost" size="icon" onClick={() => setMobileChatOpen(false)} aria-label="Back to contacts"><ArrowLeft className="h-4 w-4" /></Button><Avatar className="h-9 w-9"><AvatarImage src={currentPartner.profile_picture?.startsWith("http") ? currentPartner.profile_picture : currentPartner.profile_picture ? `${API_ROOT}/${currentPartner.profile_picture}` : undefined} /><AvatarFallback>{initials(currentPartner.name)}</AvatarFallback></Avatar><div><p className="font-semibold">{currentPartner.name}</p><p className="text-xs text-muted-foreground">{currentPartner.company_name || (meetingsMode ? "Meeting partner" : "Connected")}</p></div></header>
          {meetingsMode ? <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <form onSubmit={schedule} className="mb-6 grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 sm:grid-cols-2"><div className="sm:col-span-2"><p className="font-semibold">Schedule a meeting</p><p className="text-xs text-muted-foreground">Both participants can see and update the details.</p></div>
              <Input required maxLength={255} placeholder="Title or purpose" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input required type="datetime-local" min={toLocalDateTime(new Date().toISOString())} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              <Input className="sm:col-span-2" placeholder="Additional location or link (optional)" value={locationText} onChange={(e) => setLocationText(e.target.value)} />
              <div><Button disabled={working || !startsAt}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}Schedule meeting</Button></div>
            </form>
            <h2 className="mb-3 font-semibold">Scheduled meetings</h2>
            {meetings.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No meetings yet.</p> : <div className="space-y-3">{meetings.map((m) => <article key={m.meeting_id} className={`rounded-xl border p-4 ${m.status === "cancelled" ? "opacity-60" : ""}`}>
              {editingMeeting === m.meeting_id ? <form onSubmit={(e) => saveMeeting(e, m.meeting_id)} className="grid gap-2 sm:grid-cols-2"><Input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" /><Input required type="datetime-local" min={toLocalDateTime(new Date().toISOString())} value={editStartsAt} onChange={(e) => setEditStartsAt(e.target.value)} /><Input className="sm:col-span-2" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Additional location or link" /><div className="flex gap-2"><Button size="sm" disabled={working}>Save changes</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditingMeeting(null)}>Discard</Button></div></form> : <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{m.title}</h3><p className="mt-1 text-sm text-muted-foreground">{new Date(m.starts_at).toLocaleString()}</p><p className="text-xs text-muted-foreground">{m.hr_name || "HR"} · {m.client_name || "Client"} · {m.status}</p>{m.location && <a className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline" href={/^https?:\/\//i.test(m.location) ? m.location : undefined} target="_blank" rel="noreferrer"><MapPin className="h-3.5 w-3.5" />{m.location}</a>}{m.status === "scheduled" && <div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm"><Link to={`/meetings/${m.meeting_id}`}><Video className="mr-2 h-4 w-4" />Join meeting</Link></Button><Button variant="outline" size="sm" onClick={() => copyMeetingLink(m.meeting_id)}><Copy className="mr-2 h-4 w-4" />{copiedMeeting === m.meeting_id ? "Copied" : "Copy private link"}</Button></div>}</div>{m.status === "scheduled" && <div className="flex gap-2"><Button variant="outline" size="sm" disabled={working} onClick={() => { setEditingMeeting(m.meeting_id); setEditTitle(m.title); setEditStartsAt(toLocalDateTime(m.starts_at)); setEditLocation(m.location || ""); }}>Edit</Button><Button variant="outline" size="sm" disabled={working} onClick={() => updateMeeting(m.meeting_id, "cancelled")}>Cancel</Button></div>}</div>}
            </article>)}</div>}
          </div> : <>
            <div ref={messageScrollRef} onScroll={handleMessageScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-muted/15 p-4 sm:p-6">
              {loadingOlder && <div className="flex justify-center py-2 text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading earlier messages</div>}
              {messages.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{loadingMessages ? <Loader2 className="h-5 w-5 animate-spin" /> : "No messages yet. Send a message to start the conversation."}</div> : messages.map((m) => { const mine = m.sender_role === user?.role; return <div key={m.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[72%] ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}><p className="whitespace-pre-wrap break-words text-sm">{m.body}</p><div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}><time>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{mine && (m.read_at ? <CheckCheck className="h-3 w-3" aria-label="Read" /> : <Check className="h-3 w-3" aria-label="Sent" />)}</div></div></div>; })}
            </div>
            <form onSubmit={send} className="shrink-0 flex items-end gap-2 border-t bg-card p-3 sm:p-4"><Textarea value={draft} onChange={(e) => selectedId && setDrafts((previous) => ({ ...previous, [selectedId]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} rows={1} maxLength={5000} placeholder="Write a message… (Enter to send)" className="max-h-32 min-h-11 resize-y" /><Button type="submit" size="icon" disabled={working || !draft.trim()} aria-label="Send message">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></form>
          </>}
        </> : meetingsMode ? <div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="mb-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Select an approved connection to schedule a meeting. Your scheduled meetings are listed here.</div><h2 className="mb-3 font-semibold">Scheduled meetings</h2>{meetings.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No meetings yet.</p> : <div className="space-y-3">{meetings.map((m) => <article key={m.meeting_id} className={`rounded-xl border p-4 ${m.status === "cancelled" ? "opacity-60" : ""}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{m.title}</h3><p className="mt-1 text-sm text-muted-foreground">{new Date(m.starts_at).toLocaleString()}</p><p className="text-xs text-muted-foreground">{m.hr_name || "HR"} · {m.client_name || "Client"} · {m.status}</p>{m.location && <a className="mt-1 inline-flex text-sm text-primary underline" href={/^https?:\/\//i.test(m.location) ? m.location : undefined} target="_blank" rel="noreferrer">{m.location}</a>}{m.status === "scheduled" && <Button asChild className="mt-3" size="sm"><Link to={`/meetings/${m.meeting_id}`}><Video className="mr-2 h-4 w-4" />Join meeting</Link></Button>}</div>{m.status === "scheduled" && <Button variant="outline" size="sm" disabled={working} onClick={() => updateMeeting(m.meeting_id, "cancelled")}>Cancel</Button>}</div></article>)}</div>}</div> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground"><div className="mb-4 rounded-full bg-primary/10 p-4 text-primary"><MessageCircle /></div><p className="font-medium text-foreground">Choose an approved connection</p><p className="mt-1 text-sm">Your conversation history will appear here.</p></div>}
      </div>
    </section>
  </main>;
};
export default Communication;
