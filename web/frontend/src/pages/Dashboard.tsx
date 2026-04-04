import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import AssistantWorkspace from "@/components/assistant/AssistantWorkspace";
import { CircularProgressCard } from "@/components/ui/circular-progress-card";
import { assistantAPI } from "@/services/assistantApi";
import { taskAPI } from "@/services/api";
import { ProjectTask } from "@/types";
import {
  Upload,
  Handshake,
  FileText,
  KanbanSquare,
  CheckCircle2,
  Clock3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const ASSISTANT_FULLSCREEN_EVENT = "assistant-fullscreen-change";

const Dashboard = () => {
  const { user } = useAuth();
  const isHr = user?.role === "hr";
  const isClient = user?.role === "client";

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [isAssistantFullscreen, setIsAssistantFullscreen] = useState(false);
  const [isTasksLoaded, setIsTasksLoaded] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState("");
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    taskAPI
      .getTasks()
      .then((res) => {
        if (ignore) return;
        setTasks(res.tasks || []);
        setIsTasksLoaded(true);
      })
      .catch((error) => {
        if (ignore) return;
        console.error(error);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    document.body.dataset.assistantFullscreen = isAssistantFullscreen
      ? "true"
      : "false";
    window.dispatchEvent(
      new CustomEvent(ASSISTANT_FULLSCREEN_EVENT, {
        detail: { isFullscreen: isAssistantFullscreen },
      }),
    );

    return () => {
      delete document.body.dataset.assistantFullscreen;
      window.dispatchEvent(
        new CustomEvent(ASSISTANT_FULLSCREEN_EVENT, {
          detail: { isFullscreen: false },
        }),
      );
    };
  }, [isAssistantFullscreen]);

  useEffect(() => {
    if (!isAssistantFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAssistantFullscreen]);

  const completedTasksCount = tasks.filter((t) => t.status === "done").length;
  const totalTasks = tasks.length;
  const goalValue = tasks.length > 0 ? tasks.length : 1;
  const remainingTasksCount = Math.max(totalTasks - completedTasksCount, 0);
  const progressPercentage =
    totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

  useEffect(() => {
    if (!isHr || !isTasksLoaded) {
      return;
    }

    let ignore = false;

    const loadDashboardSummary = async () => {
      try {
        setIsSummaryLoading(true);
        setSummaryError(null);
        const response = await assistantAPI.getDashboardSummary(tasks);
        if (ignore) return;

        setDashboardSummary(response.summary);
      } catch (error) {
        if (ignore) return;

        const message =
          error instanceof Error
            ? error.message
            : "Failed to generate dashboard summary";
        setSummaryError(message);
      } finally {
        if (!ignore) {
          setIsSummaryLoading(false);
        }
      }
    };

    void loadDashboardSummary();

    return () => {
      ignore = true;
    };
  }, [isHr, isTasksLoaded, tasks]);

  if (isClient) {
    return (
      <div className="space-y-8 animate-fade-in">
        <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-lg">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative overflow-hidden px-8 py-9">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,175,112,0.28),transparent_44%),linear-gradient(145deg,rgba(255,255,255,0.58),rgba(255,246,241,0.9))]" />
              <div className="relative space-y-5">
                <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
                  Client Workspace
                </p>
                <h1 className="max-w-2xl text-4xl font-bold leading-tight">
                  Upload a project brief, connect with HR, and prepare
                  chatbot-driven Jira work inside the Clautzel flow.
                </h1>
                <p className="max-w-xl text-muted-foreground">
                  This view keeps the same warm Clautzel language while opening
                  the client intake path you added in the other frontend.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button asChild className="rounded-2xl">
                    <Link to="/client/projects">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Project PDF
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-2xl">
                    <Link to="/client/hr-directory">
                      <Handshake className="mr-2 h-4 w-4" />
                      Browse HR Directory
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-border/60 bg-gradient-to-br from-primary/10 via-accent/40 to-background px-8 py-9 lg:border-l lg:border-t-0">
              <div className="space-y-4">
                {[
                  "Upload the project overview PDF",
                  "Let the chatbot extract tasks",
                  "Create Jira tickets from extracted work",
                  "Send high-confidence tasks forward and low-confidence tasks to HR review",
                ].map((step, index) => (
                  <div
                    key={step}
                    className="flex items-start gap-4 rounded-[1.4rem] border border-border/60 bg-background/80 px-4 py-4 backdrop-blur-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      {index + 1}
                    </div>
                    <p className="text-sm text-foreground/80">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <CircularProgressCard
            className="w-full max-w-none border-border/60 bg-card/95"
            title="Project Completion"
            description="Task delivery across all projects"
            currentValue={completedTasksCount}
            goalValue={goalValue}
            progressColor="hsl(var(--primary))"
          />

          <Card className="border-border/60 bg-card/95">
            <CardContent className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Project Intake</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Keep project overview PDFs in one place and attach them to the
                HR partner you want to work with.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/95">
            <CardContent className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Handshake className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">HR Matching</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Compare HR profiles, team details, and start the right next
                step: connect, chat, or meeting.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/95">
            <CardContent className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <KanbanSquare className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">HR-Owned Ticketing</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Clients upload PDFs here. HR reviews the brief, generates Jira
                tickets, and routes the work into the delivery board.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div
        className={cn(
          "grid min-h-[760px] grid-cols-1 gap-6 transition-[grid-template-columns] duration-500 ease-out",
          isAssistantFullscreen
            ? "xl:grid-cols-1"
            : "xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)]",
        )}
      >
        <AssistantWorkspace
          isFullscreen={isAssistantFullscreen}
          onFullscreenChange={setIsAssistantFullscreen}
        />

        <div
          aria-hidden={isAssistantFullscreen}
          className={cn(
            "overflow-hidden transition-[max-height,opacity,transform,filter] duration-500 ease-out",
            isAssistantFullscreen
              ? "pointer-events-none max-h-0 translate-y-6 opacity-0 blur-sm"
              : "max-h-[1200px] translate-y-0 opacity-100 blur-0",
            isHr
              ? "grid h-full min-h-[760px] grid-rows-[minmax(0,1fr)_minmax(0,3fr)] gap-6"
              : "flex h-full min-h-[760px] flex-col gap-6",
          )}
        >
          <CircularProgressCard
            className="h-full w-full max-w-none border-dashed border-2 border-border/60 bg-card/70 backdrop-blur-sm shadow-card"
            title="Ticket Progress"
            description="Overall completed vs. total tasks"
            currentValue={completedTasksCount}
            goalValue={goalValue}
            progressColor="hsl(var(--primary))"
            currency=""
            compact={isHr}
          />

          {isHr ? (
            <Card className="h-[75%] border-dashed border-2 border-border/60 bg-card/70 backdrop-blur-sm shadow-card">
              <CardContent className="flex h-full flex-col justify-between p-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold text-foreground">
                    Summary
                  </h3>
                  {isSummaryLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Generating summary with Pathway...
                    </div>
                  ) : summaryError ? (
                    <p className="max-w-md text-sm leading-6 text-destructive">
                      {summaryError}
                    </p>
                  ) : (
                    <p className="max-w-md text-sm leading-6 text-muted-foreground">
                      {dashboardSummary}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Generated by the Pathway dashboard summary flow.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!isHr ? (
            <Card className="border-dashed border-2 border-border/60 bg-card/70 backdrop-blur-sm shadow-card flex-1 min-h-[250px]">
              <CardContent className="flex min-h-[250px] flex-col items-center justify-center text-center">
                <div className="p-5 rounded-full bg-primary/5 mb-6">
                  <KanbanSquare className="w-12 h-12 text-primary/40" />
                </div>
                <h3 className="text-xl font-semibold text-foreground/80 mb-2">
                  My Tasks
                </h3>
                <p className="text-muted-foreground max-w-sm mb-6 px-4">
                  Open the live board to review your assigned tickets and push
                  status updates back to HR.
                </p>
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link to="/tickets">
                    <KanbanSquare className="mr-2 h-4 w-4" />
                    Open Task Board
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
