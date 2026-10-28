import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, LogOut, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { communicationAPI, MeetingJoinToken } from "@/services/api";

interface JitsiMeetApi {
  addListener: (event: string, listener: (data?: { message?: string; name?: string; isFatal?: boolean }) => void) => void;
  executeCommand: (command: string) => void;
  dispose: () => void;
}
interface JitsiMeetOptions {
  roomName: string;
  parentNode: HTMLElement;
  jwt: string;
  userInfo: { displayName: string };
  configOverwrite: Record<string, unknown>;
  interfaceConfigOverwrite: Record<string, unknown>;
}
declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: JitsiMeetOptions) => JitsiMeetApi;
  }
}

const loadJitsi = (appId: string) => new Promise<void>((resolve, reject) => {
  if (window.JitsiMeetExternalAPI) { resolve(); return; }
  const src = `https://8x8.vc/${encodeURIComponent(appId)}/external_api.js`;
  let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (!script) {
    script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  }
  script.addEventListener("load", () => window.JitsiMeetExternalAPI ? resolve() : reject(new Error("The video service did not initialize.")), { once: true });
  script.addEventListener("error", () => reject(new Error("Could not load the video meeting service.")), { once: true });
});

const MeetingRoom = () => {
  const { meetingId = "" } = useParams();
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiMeetApi | null>(null);
  const [joinData, setJoinData] = useState<MeetingJoinToken | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [callError, setCallError] = useState("");

  useEffect(() => () => { apiRef.current?.dispose(); apiRef.current = null; }, []);

  const join = async () => {
    setJoining(true); setError(""); setCallError("");
    try {
      const result = await communicationAPI.getMeetingJoinToken(meetingId);
      setJoinData(result);
      await loadJitsi(result.app_id);
      if (!mountRef.current || !window.JitsiMeetExternalAPI) throw new Error("The video meeting service did not initialize.");
      apiRef.current?.dispose();
      const api = new window.JitsiMeetExternalAPI("8x8.vc", {
        roomName: result.room_name,
        parentNode: mountRef.current,
        jwt: result.token,
        userInfo: { displayName: result.participant_name },
        configOverwrite: { prejoinConfig: { enabled: true }, startWithAudioMuted: false, startWithVideoMuted: false },
        interfaceConfigOverwrite: { MOBILE_APP_PROMO: false },
      });
      apiRef.current = api;
      api.addListener("videoConferenceJoined", () => { setJoined(true); setJoining(false); });
      api.addListener("videoConferenceLeft", () => { setJoined(false); setJoining(false); api.dispose(); apiRef.current = null; });
      api.addListener("cameraError", (event) => setCallError(event?.message || "Camera access failed. Check browser permissions and try again."));
      api.addListener("micError", (event) => setCallError(event?.message || "Microphone access failed. Check browser permissions and try again."));
      api.addListener("errorOccurred", (event) => { if (event?.isFatal) { setCallError(event.message || "The meeting connection failed."); setJoining(false); } });
      api.addListener("peerConnectionFailure", () => { setCallError("The audio or video connection was interrupted. Check your network and reconnect."); });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the meeting.");
      setJoining(false);
    }
  };
  const leave = () => apiRef.current?.executeCommand("hangup");

  return <main className="mx-auto max-w-7xl p-4 sm:p-6">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Clautzel • Video meeting</p><h1 className="mt-1 text-2xl font-semibold">{joinData?.title || "Meeting room"}</h1>{joinData && <p className="mt-1 text-sm text-muted-foreground">{new Date(joinData.starts_at).toLocaleString()}</p>}</div>
      <Button asChild variant="outline"><Link to="/meetings"><ArrowLeft className="mr-2 h-4 w-4" />Back to meetings</Link></Button>
    </header>
    {error && <div role="alert" className="mb-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    {callError && <div role="alert" className="mb-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{callError}</div>}
    {!joined && <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5">
      <div><p className="font-semibold">Join this scheduled call</p><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Your browser will ask for camera and microphone access. Jitsi provides the live call controls, participant list, and screen sharing.</p></div>
      <Button onClick={join} disabled={joining}>{joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}{joining ? "Connecting…" : "Join meeting"}</Button>
    </section>}
    <section className="relative h-[min(72vh,760px)] min-h-[420px] overflow-hidden rounded-2xl border bg-slate-950">
      {!joinData && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-slate-300"><Video className="h-10 w-10 opacity-70" /><p>The live meeting will appear here after you join.</p></div>}
      <div ref={mountRef} className="h-full w-full" />
      {joined && <Button className="absolute bottom-4 right-4 z-10" variant="destructive" onClick={leave}><LogOut className="mr-2 h-4 w-4" />Leave meeting</Button>}
    </section>
  </main>;
};
export default MeetingRoom;
