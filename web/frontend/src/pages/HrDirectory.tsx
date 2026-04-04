import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { clientAPI } from "@/services/api";
import { HrDirectoryItem } from "@/types";
import {
  ArrowUpRight,
  Building2,
  Handshake,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Users,
  Video,
} from "lucide-react";

const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1").replace(
  "/api/v1",
  ""
);

const HrDirectory = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [hrs, setHrs] = useState<HrDirectoryItem[]>([]);
  const [selectedHr, setSelectedHr] = useState<HrDirectoryItem | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingMode, setIsSubmittingMode] = useState<string | null>(null);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Please try again.";

  const loadHrDirectory = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await clientAPI.getHrDirectory();
      setHrs(response.hrs);
    } catch (error: unknown) {
      toast({
        title: "Could not load HR directory",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadHrDirectory();
  }, [loadHrDirectory]);

  const filteredHrs = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return hrs;

    return hrs.filter((hr) =>
      [hr.name, hr.company_name, hr.email, hr.department, hr.location]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [hrs, search]);

  const getAvatarUrl = (path?: string | null) => {
    if (!path) return undefined;
    if (path.startsWith("http")) return path;
    return `${API_ROOT}/${path}`;
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const handleConnect = async (
    hrId: string,
    mode: "connect" | "chat" | "meeting"
  ) => {
    try {
      setIsSubmittingMode(mode);
      await clientAPI.connectToHr(hrId, { mode });
      await loadHrDirectory();
      toast({
        title: "Request saved",
        description: `Your ${mode} request has been sent to the HR contact.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Request failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingMode(null);
    }
  };

  const renderPrimaryAction = (hr: HrDirectoryItem) => {
    if (hr.connection_status === "connected") {
      return (
        <Button
          onClick={() => {
            setSelectedHr(null);
            navigate("/client/projects");
          }}
        >
          <ArrowUpRight className="mr-2 h-4 w-4" />
          Open Upload Workspace
        </Button>
      );
    }

    if (hr.connection_status === "pending") {
      return (
        <Button disabled>
          <Loader2 className="mr-2 h-4 w-4" />
          Awaiting HR Approval
        </Button>
      );
    }

    return (
      <Button
        onClick={() => handleConnect(hr.hr_id, "connect")}
        disabled={!!isSubmittingMode}
      >
        {isSubmittingMode === "connect" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Handshake className="mr-2 h-4 w-4" />
        )}
        Send Connection Request
      </Button>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-lg">
        <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="relative overflow-hidden px-8 py-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_left_top,rgba(255,175,112,0.28),transparent_44%),linear-gradient(145deg,rgba(255,255,255,0.58),rgba(255,246,241,0.9))]" />
            <div className="relative space-y-5">
              <Badge className="rounded-full bg-primary/15 px-4 py-1 text-primary hover:bg-primary/15">
                HR Matchmaking
              </Badge>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight">
                Review HR partners in the Clautzel network and choose how you want to start the relationship.
              </h1>
              <p className="max-w-xl text-muted-foreground">
                Browse each HR’s team, company, and profile summary, then open a
                connection request, chat flow, or meeting request from the same place.
              </p>
            </div>
          </div>

          <div className="border-t border-border/60 bg-gradient-to-br from-accent/70 via-background to-background px-8 py-9 xl:border-l xl:border-t-0">
            <div className="rounded-[1.6rem] border border-border/70 bg-background/85 p-4 backdrop-blur-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search HR, company, department..."
                  className="h-12 rounded-2xl border-0 bg-muted/55 pl-11 pr-4 shadow-none focus-visible:ring-1"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {hrs.length} HR profiles
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {filteredHrs.length} visible
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading HR directory...
        </div>
      ) : filteredHrs.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border bg-muted/20 p-12 text-center">
          <p className="text-lg font-semibold">No HR matches found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredHrs.map((hr) => (
            <Card
              key={hr.hr_id}
              className="cursor-pointer border-border/60 bg-card/95 transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              onClick={() => setSelectedHr(hr)}
            >
              <CardContent className="space-y-5 p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16 border border-border/60">
                    <AvatarImage src={getAvatarUrl(hr.profile_picture)} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(hr.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{hr.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {hr.company_name}
                    </p>
                    {hr.connection_status && (
                      <Badge variant="secondary" className="mt-2 capitalize">
                        {hr.connection_status}
                      </Badge>
                    )}
                  </div>
                  <div className="rounded-full bg-muted p-2 text-muted-foreground">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{hr.department || "HR Operations"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{hr.location || "Location not added"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{hr.employee_count || 0} employees in team</span>
                  </div>
                </div>

                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {hr.summary || "No profile summary added yet."}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedHr} onOpenChange={(open) => !open && setSelectedHr(null)}>
        <DialogContent className="max-w-3xl">
          {selectedHr && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedHr.name}</DialogTitle>
                <DialogDescription>
                  {selectedHr.company_name} • {selectedHr.department || "HR"}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
                <div className="rounded-[1.5rem] border border-border/60 bg-muted/20 p-5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border border-border/60">
                      <AvatarImage src={getAvatarUrl(selectedHr.profile_picture)} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(selectedHr.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xl font-semibold">{selectedHr.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedHr.company_name}
                      </p>
                      {selectedHr.connection_status && (
                        <Badge variant="secondary" className="mt-2 capitalize">
                          {selectedHr.connection_status}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{selectedHr.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{selectedHr.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{selectedHr.location || "Location not added"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{selectedHr.employee_count || 0} active employees</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[1.5rem] border border-border/60 bg-background p-5">
                    <p className="text-sm font-medium text-foreground">About this HR</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {selectedHr.summary || "This HR profile has not added a detailed summary yet."}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-border/60 bg-background p-5">
                    <p className="text-sm font-medium text-foreground">Skills and focus</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(selectedHr.skills || "Hiring, Team Planning, Resource Coordination")
                        .split(",")
                        .map((skill) => skill.trim())
                        .filter(Boolean)
                        .map((skill) => (
                          <Badge key={skill} variant="outline">
                            {skill}
                          </Badge>
                        ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {renderPrimaryAction(selectedHr)}
                    <Button
                      variant="outline"
                      onClick={() => handleConnect(selectedHr.hr_id, "chat")}
                      disabled={!!isSubmittingMode || selectedHr.connection_status === "pending"}
                    >
                      {isSubmittingMode === "chat" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="mr-2 h-4 w-4" />
                      )}
                      Chat
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleConnect(selectedHr.hr_id, "meeting")}
                      disabled={!!isSubmittingMode || selectedHr.connection_status === "pending"}
                    >
                      {isSubmittingMode === "meeting" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Video className="mr-2 h-4 w-4" />
                      )}
                      Meeting
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HrDirectory;
