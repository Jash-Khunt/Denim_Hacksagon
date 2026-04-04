import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { connectionAPI } from "@/services/api";
import { ClientConnection } from "@/types";
import { useToast } from "@/hooks/use-toast";
import {
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

  const pendingCount = connections.filter((item) => item.status === "pending").length;
  const connectedCount = connections.filter((item) => item.status === "connected").length;
  const totalUploads = connections.reduce((sum, item) => sum + (item.upload_count || 0), 0);

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[1.35rem] border border-[#fdba74]/45 bg-[#fff7ed] p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9a3412]">
            Pending
          </p>
          <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight text-[#7c2d12] tabular-nums">
            {pendingCount}
          </p>
        </div>
        <div className="rounded-[1.35rem] border border-[#fb923c]/45 bg-[#ffedd5] p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9a3412]">
            Connected
          </p>
          <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight text-[#7c2d12] tabular-nums">
            {connectedCount}
          </p>
        </div>
        <div className="rounded-[1.35rem] border border-[#f97316]/45 bg-[#fed7aa] p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9a3412]">
            Client uploads
          </p>
          <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight text-[#7c2d12] tabular-nums">
            {totalUploads}
          </p>
        </div>
      </div>

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
                <div className="grid gap-5 justify-items-start xl:grid-cols-2">
                  {items.map((connection) => (
                    <Card
                      key={connection.connection_id}
                      className="w-full max-w-[350px] border-border/60 bg-card/95"
                    >
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12 border border-border/60">
                            <AvatarImage src={getAvatarUrl(connection.profile_picture)} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(connection.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-base font-semibold">{connection.name}</p>
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {connection.company_name}
                            </p>
                          </div>
                        </div>

                        <div className="gap-2 text-sm m-1 text-muted-foreground">
                          <div className="m-1">
                            <div className="mr-1 inline-flex min-w-0 items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5">
                              <Mail className="h-4 w-4" />
                              <span className="truncate">{connection.email}</span>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5">
                              <Phone className="h-4 w-4" />
                              <span>{connection.phone || "Phone not added"}</span>
                            </div>
                          </div>
                          <div className="m-1">
                            <div className="mr-1 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5">
                              <FileText className="h-4 w-4" />
                              <span>
                                {connection.upload_count || 0} uploads
                              </span>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5">
                              <CheckCheck className="h-4 w-4" />
                              <span>
                                {connection.task_count || 0} tickets
                              </span>
                            </div>
                          </div>

                        </div>

                        {connection.address && (
                          <div className="rounded-[1rem] border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
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
                        ) : null}
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
