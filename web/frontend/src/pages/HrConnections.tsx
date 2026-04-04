import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { connectionAPI } from "@/services/api";
import { ClientConnection } from "@/types";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  CheckCheck,
  FileText,
  Loader2,
  Mail,
  Phone,
  UserRoundPlus,
  X,
} from "lucide-react";

const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1").replace(
  "/api/v1",
  "",
);

const statusOrder = ["pending", "connected", "declined"] as const;

const HrConnections = () => {
  const { toast } = useToast();
  const [connections, setConnections] = useState<ClientConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Please try again.";

  const loadConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await connectionAPI.getHrConnections();
      setConnections(response.connections);
    } catch (error: unknown) {
      toast({
        title: "Could not load client requests",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const groupedConnections = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        items: connections.filter((item) => item.status === status),
      })),
    [connections],
  );

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

  const updateConnection = async (
    connectionId: string,
    status: "connected" | "declined",
  ) => {
    try {
      setActiveConnectionId(connectionId);
      await connectionAPI.respondToConnection(connectionId, status);
      await loadConnections();
      toast({
        title: status === "connected" ? "Client approved" : "Request declined",
        description:
          status === "connected"
            ? "The client can now upload PDFs into your delivery board."
            : "The request has been removed from the pending intake queue.",
      });
    } catch (error: unknown) {
      toast({
        title: "Update failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setActiveConnectionId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-lg">
        <div className="grid gap-0 xl:grid-cols-[1.06fr_0.94fr]">
          <div className="relative overflow-hidden px-8 py-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,130,77,0.22),transparent_42%),linear-gradient(140deg,rgba(255,255,255,0.58),rgba(255,247,242,0.92))]" />
            <div className="relative space-y-5">
              <Badge className="rounded-full bg-primary/15 px-4 py-1 text-primary hover:bg-primary/15">
                HR Intake Approval
              </Badge>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight">
                Review incoming client connection requests, approve the right partnerships, and unlock project intake.
              </h1>
              <p className="max-w-xl text-muted-foreground">
                Once you approve a client, their PDF uploads route into your task
                board and the extracted chatbot tickets stay connected to that
                client account.
              </p>
            </div>
          </div>

          <div className="border-t border-border/60 bg-gradient-to-br from-accent/70 via-background to-background px-8 py-9 xl:border-l xl:border-t-0">
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[1.5rem] border border-border/60 bg-background/80 p-5">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="mt-2 text-3xl font-bold">
                  {connections.filter((item) => item.status === "pending").length}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/60 bg-background/80 p-5">
                <p className="text-sm text-muted-foreground">Connected</p>
                <p className="mt-2 text-3xl font-bold">
                  {connections.filter((item) => item.status === "connected").length}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/60 bg-background/80 p-5">
                <p className="text-sm text-muted-foreground">Client uploads</p>
                <p className="mt-2 text-3xl font-bold">
                  {connections.reduce((sum, item) => sum + (item.upload_count || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading client requests...
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border bg-muted/20 p-12 text-center">
          <UserRoundPlus className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-lg font-semibold">No client requests yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            When a client sends a connection request, it will appear here for approval.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedConnections.map(({ status, items }) => (
            <section key={status} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold capitalize text-foreground">{status}</h2>
                  <p className="text-sm text-muted-foreground">
                    {status === "pending"
                      ? "Approve these clients before they can upload project briefs."
                      : status === "connected"
                        ? "These clients already flow into your delivery workspace."
                        : "Previously declined requests remain here for reference."}
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {items.length}
                </Badge>
              </div>

              {items.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-8 text-sm text-muted-foreground">
                  No {status} requests.
                </div>
              ) : (
                <div className="grid gap-5 xl:grid-cols-2">
                  {items.map((connection) => (
                    <Card key={connection.connection_id} className="border-border/60 bg-card/95">
                      <CardContent className="space-y-5 p-6">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-16 w-16 border border-border/60">
                            <AvatarImage src={getAvatarUrl(connection.profile_picture)} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(connection.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-lg font-semibold">{connection.name}</p>
                              <Badge
                                className="capitalize"
                                variant={
                                  connection.status === "connected"
                                    ? "default"
                                    : connection.status === "declined"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {connection.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {connection.company_name}
                            </p>
                            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              Requested {connection.last_requested_mode}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span className="truncate">{connection.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{connection.phone || "Phone not added"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span>{connection.company_name || "Company not added"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>
                              {connection.upload_count || 0} uploads, {connection.task_count || 0} tickets
                            </span>
                          </div>
                        </div>

                        {connection.address && (
                          <div className="rounded-[1.25rem] border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                            {connection.address}
                          </div>
                        )}

                        {status === "pending" ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Button
                              className="rounded-xl"
                              disabled={activeConnectionId === connection.connection_id}
                              onClick={() =>
                                updateConnection(connection.connection_id, "connected")
                              }
                            >
                              {activeConnectionId === connection.connection_id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCheck className="mr-2 h-4 w-4" />
                              )}
                              Approve Connection
                            </Button>
                            <Button
                              variant="outline"
                              className="rounded-xl"
                              disabled={activeConnectionId === connection.connection_id}
                              onClick={() =>
                                updateConnection(connection.connection_id, "declined")
                              }
                            >
                              <X className="mr-2 h-4 w-4" />
                              Decline
                            </Button>
                          </div>
                        ) : status === "connected" ? (
                          <div className="rounded-[1.25rem] border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                            This client is approved and can upload PDFs directly into your workspace.
                          </div>
                        ) : (
                          <div className="rounded-[1.25rem] border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            This request was declined. The client must send a fresh request to restart the process.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default HrConnections;
