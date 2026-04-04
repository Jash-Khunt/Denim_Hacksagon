import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import AssistantWorkspace from "@/components/assistant/AssistantWorkspace";
import { CircularProgressCard } from "@/components/ui/circular-progress-card";
import { taskAPI } from "@/services/api";
import { ProjectTask } from "@/types";
import { Upload, Handshake, FileText, KanbanSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();
  const isHr = user?.role === "hr";
  const isClient = user?.role === "client";

  const [tasks, setTasks] = useState<ProjectTask[]>([]);

  useEffect(() => {
    taskAPI
      .getTasks()
      .then((res) => setTasks(res.tasks || []))
      .catch(console.error);
  }, []);

  const completedTasksCount = tasks.filter((t) => t.status === "done").length;
  const goalValue = tasks.length > 0 ? tasks.length : 1;
  const tasksCompletedToday = tasks.filter(
    (t) =>
      t.status === "done" &&
      new Date(t.updated_at).toDateString() === new Date().toDateString(),
  ).length;

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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)] min-h-[760px]">
        <AssistantWorkspace />

        <div className="space-y-6">
          <CircularProgressCard
            className="w-full max-w-none border-dashed border-2 border-border/60 bg-card/70 backdrop-blur-sm shadow-card"
            title="Ticket Progress"
            description="Overall completed vs. total tasks"
            currentValue={completedTasksCount}
            goalValue={goalValue}
            progressColor="hsl(var(--primary))"
            currency=""
          />

          {isHr ? (
            <Card className="border-dashed border-2 border-border/60 bg-card/70 backdrop-blur-sm shadow-card">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center py-8">
                <h3 className="text-4xl font-bold text-primary">
                  {tasksCompletedToday}
                </h3>
                <p className="text-sm font-medium text-muted-foreground mt-2 uppercase tracking-[0.15em]">
                  Tasks Completed Today
                </p>
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
