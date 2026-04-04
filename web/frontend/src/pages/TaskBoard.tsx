import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { employeeAPI, taskAPI } from "@/services/api";
import { Employee, ProjectTask, TaskStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  CalendarClock,
  CircleDashed,
  Loader2,
  MessageSquareText,
  Sparkles,
  UserCircle2,
} from "lucide-react";

const statusColumns: Array<{
  key: TaskStatus;
  label: string;
  accent: string;
  badgeClass: string;
}> = [
  {
    key: "todo",
    label: "To Do",
    accent: "border-sky-400/30 bg-sky-400/10 text-sky-100",
    badgeClass: "bg-sky-400/20 text-sky-200",
  },
  {
    key: "in_progress",
    label: "In Progress",
    accent: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    badgeClass: "bg-amber-400/20 text-amber-200",
  },
  {
    key: "review",
    label: "Review",
    accent: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100",
    badgeClass: "bg-fuchsia-400/20 text-fuchsia-200",
  },
  {
    key: "done",
    label: "Done",
    accent: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
    badgeClass: "bg-emerald-400/20 text-emerald-200",
  },
];

const TaskBoard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHr = user?.role === "hr";

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [isTaskLoading, setIsTaskLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    difficulty: "Medium",
    field: "",
    due_date: "",
    assignee_emp_id: "unassigned",
  });

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Please try again.";

  const loadBoard = useCallback(async () => {
    try {
      setIsLoading(true);
      const [taskResponse, employeeResponse] = await Promise.all([
        taskAPI.getTasks(),
        isHr ? employeeAPI.getAllEmployees() : Promise.resolve({ employees: [] }),
      ]);
      setTasks(taskResponse.tasks);
      setEmployees(employeeResponse.employees || []);
    } catch (error: unknown) {
      toast({
        title: "Could not load task board",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isHr, toast]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const openTask = async (taskId: string) => {
    try {
      setSelectedTaskId(taskId);
      setIsTaskLoading(true);
      const response = await taskAPI.getTaskById(taskId);
      const task = response.task;
      setSelectedTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || "",
        status: task.status,
        difficulty: task.difficulty,
        field: task.field,
        due_date: task.due_date || "",
        assignee_emp_id: task.assignee_emp_id || "unassigned",
      });
    } catch (error: unknown) {
      toast({
        title: "Could not load ticket",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      setSelectedTaskId(null);
      setSelectedTask(null);
    } finally {
      setIsTaskLoading(false);
    }
  };

  const closeTask = () => {
    setSelectedTaskId(null);
    setSelectedTask(null);
    setComment("");
  };

  const groupedTasks = useMemo(
    () =>
      statusColumns.map((column) => ({
        ...column,
        items: tasks.filter((task) => task.status === column.key),
      })),
    [tasks],
  );

  const refreshTask = async () => {
    if (!selectedTaskId) return;
    const response = await taskAPI.getTaskById(selectedTaskId);
    setSelectedTask(response.task);
  };

  const handleSave = async () => {
    if (!selectedTaskId) return;

    try {
      setIsSaving(true);
      const payload = isHr
        ? {
            title: taskForm.title,
            description: taskForm.description,
            status: taskForm.status,
            difficulty: taskForm.difficulty,
            field: taskForm.field,
            due_date: taskForm.due_date || null,
            assignee_emp_id:
              taskForm.assignee_emp_id === "unassigned"
                ? ""
                : taskForm.assignee_emp_id,
          }
        : {
            status: taskForm.status,
          };

      await taskAPI.updateTask(selectedTaskId, payload as Partial<ProjectTask>);
      await Promise.all([loadBoard(), refreshTask()]);
      toast({
        title: "Ticket updated",
        description: "The task board has been refreshed with your latest changes.",
      });
    } catch (error: unknown) {
      toast({
        title: "Update failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleComment = async () => {
    if (!selectedTaskId || !comment.trim()) return;

    try {
      setIsSaving(true);
      await taskAPI.addComment(selectedTaskId, comment);
      setComment("");
      await refreshTask();
      toast({
        title: "Comment added",
        description: "Activity has been updated on this ticket.",
      });
    } catch (error: unknown) {
      toast({
        title: "Comment failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalTasks = tasks.length;
  const autoAssignedCount = tasks.filter((task) => task.assignment_mode === "auto").length;
  const reviewCount = tasks.filter((task) => task.human_intervention).length;

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="overflow-hidden rounded-[2rem] border border-[#2d3037] bg-[#17181c] text-white shadow-2xl">
        <div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden px-8 py-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(248,124,59,0.22),transparent_42%),linear-gradient(160deg,#1c1d22,#121317)]" />
            <div className="relative space-y-5">
              <Badge className="w-fit rounded-full border border-white/10 bg-white/10 px-4 py-1 text-white hover:bg-white/10">
                Delivery Board
              </Badge>
              <h1 className="max-w-3xl text-4xl font-bold leading-tight">
                {isHr
                  ? "Run the intake pipeline like a Jira board: review tickets, assign people, and move delivery forward."
                  : "Track your assigned delivery tickets, update status, and keep the HR team aligned."}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/70">
                The board below is fed by client uploads and chatbot-generated ticket output.
                High-confidence tasks can land with assignees automatically, while low-confidence work
                stays visible for HR review and manual routing.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#111216] px-8 py-9 xl:border-l xl:border-t-0">
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">Total tickets</p>
                <p className="mt-3 text-3xl font-bold">{totalTasks}</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">Auto assigned</p>
                <p className="mt-3 text-3xl font-bold">{autoAssignedCount}</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">Needs review</p>
                <p className="mt-3 text-3xl font-bold">{reviewCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading task board...
        </div>
      ) : totalTasks === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border bg-muted/20 p-12 text-center">
          <CircleDashed className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-lg font-semibold">No tickets yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Once a client uploads a PDF and the chatbot returns structured task JSON, tickets will appear here.
          </p>
        </div>
      ) : (
        <section className="overflow-x-auto rounded-[2rem] border border-[#2d3037] bg-[#121318] p-4 shadow-2xl">
          <div className="grid min-w-[1100px] gap-4 xl:grid-cols-4">
            {groupedTasks.map((column) => (
              <div
                key={column.key}
                className="rounded-[1.5rem] border border-white/10 bg-[#1b1d23] p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                      {column.label}
                    </h2>
                    <Badge className={`rounded-full border-0 px-2.5 py-1 ${column.badgeClass}`}>
                      {column.items.length}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  {column.items.map((task) => (
                    <button
                      key={task.task_id}
                      type="button"
                      onClick={() => openTask(task.task_id)}
                      className={`w-full rounded-[1.4rem] border p-4 text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#262932] ${column.accent}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">{task.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/50">
                            {task.task_key}
                          </p>
                        </div>
                        <Badge className="border-0 bg-white/10 text-white/80">
                          {task.priority}
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-white/70">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span className="truncate">
                            {task.client_company_name || task.client_name || "Client"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          <span>{task.field}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCircle2 className="h-4 w-4" />
                          <span>{task.assignee_name || "Unassigned"}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && closeTask()}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-[#2d3037] bg-[#1d1f25] px-0 text-white sm:max-w-[840px]"
        >
          {isTaskLoading || !selectedTask ? (
            <div className="flex h-full items-center justify-center gap-2 text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading ticket details...
            </div>
          ) : (
            <div className="space-y-8 p-6">
              <SheetHeader className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="border-0 bg-white/10 text-white">
                    {selectedTask.task_key}
                  </Badge>
                  <Badge className="border-0 bg-white/10 text-white/80 capitalize">
                    {selectedTask.status.replaceAll("_", " ")}
                  </Badge>
                  <Badge className="border-0 bg-white/10 text-white/80">
                    {selectedTask.assignment_mode}
                  </Badge>
                </div>
                <SheetTitle className="text-3xl leading-tight text-white">
                  {selectedTask.title}
                </SheetTitle>
                <SheetDescription className="text-white/60">
                  {selectedTask.client_name} • {selectedTask.client_company_name}
                </SheetDescription>
              </SheetHeader>

              <div className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
                <div className="space-y-6">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <div className="space-y-2">
                      <Label className="text-white/70">Title</Label>
                      {isHr ? (
                        <Input
                          value={taskForm.title}
                          onChange={(e) =>
                            setTaskForm((prev) => ({ ...prev, title: e.target.value }))
                          }
                          className="border-white/10 bg-[#262932] text-white"
                        />
                      ) : (
                        <p className="text-sm leading-7 text-white/80">{selectedTask.title}</p>
                      )}
                    </div>
                    <div className="mt-5 space-y-2">
                      <Label className="text-white/70">Description</Label>
                      {isHr ? (
                        <Textarea
                          rows={8}
                          value={taskForm.description}
                          onChange={(e) =>
                            setTaskForm((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          className="border-white/10 bg-[#262932] text-white"
                        />
                      ) : (
                        <p className="text-sm leading-7 text-white/80">
                          {selectedTask.description || "No description added yet."}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                      <MessageSquareText className="h-4 w-4" />
                      Activity
                    </div>
                    <div className="mt-4 space-y-3">
                      <Textarea
                        rows={4}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Add an update for this ticket..."
                        className="border-white/10 bg-[#262932] text-white placeholder:text-white/35"
                      />
                      <Button
                        onClick={handleComment}
                        disabled={isSaving || !comment.trim()}
                        className="rounded-xl"
                      >
                        {isSaving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <MessageSquareText className="mr-2 h-4 w-4" />
                        )}
                        Add Comment
                      </Button>
                    </div>

                    <div className="mt-5 space-y-3">
                      {(selectedTask.comments || []).length === 0 ? (
                        <div className="rounded-[1.2rem] border border-dashed border-white/10 p-4 text-sm text-white/50">
                          No comments yet.
                        </div>
                      ) : (
                        selectedTask.comments?.map((item) => (
                          <div
                            key={item.comment_id}
                            className="rounded-[1.2rem] border border-white/10 bg-[#262932] p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-white">
                                {item.author_name}
                              </p>
                              <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                                {format(new Date(item.created_at), "dd MMM yyyy")}
                              </p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/70">
                              {item.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-medium text-white/80">Details</p>
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white/70">Status</Label>
                        <Select
                          value={taskForm.status}
                          onValueChange={(value: TaskStatus) =>
                            setTaskForm((prev) => ({ ...prev, status: value }))
                          }
                        >
                          <SelectTrigger className="border-white/10 bg-[#262932] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusColumns.map((column) => (
                              <SelectItem key={column.key} value={column.key}>
                                {column.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {isHr && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-white/70">Assignee</Label>
                            <Select
                              value={taskForm.assignee_emp_id}
                              onValueChange={(value) =>
                                setTaskForm((prev) => ({
                                  ...prev,
                                  assignee_emp_id: value,
                                }))
                              }
                            >
                              <SelectTrigger className="border-white/10 bg-[#262932] text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {employees.map((employee) => (
                                  <SelectItem
                                    key={employee.emp_id}
                                    value={employee.emp_id || ""}
                                  >
                                    {employee.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white/70">Difficulty</Label>
                            <Select
                              value={taskForm.difficulty}
                              onValueChange={(value) =>
                                setTaskForm((prev) => ({ ...prev, difficulty: value }))
                              }
                            >
                              <SelectTrigger className="border-white/10 bg-[#262932] text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Easy">Easy</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white/70">Field</Label>
                            <Input
                              value={taskForm.field}
                              onChange={(e) =>
                                setTaskForm((prev) => ({ ...prev, field: e.target.value }))
                              }
                              className="border-white/10 bg-[#262932] text-white"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white/70">Due date</Label>
                            <Input
                              type="date"
                              value={taskForm.due_date}
                              onChange={(e) =>
                                setTaskForm((prev) => ({
                                  ...prev,
                                  due_date: e.target.value,
                                }))
                              }
                              className="border-white/10 bg-[#262932] text-white"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-medium text-white/80">Context</p>
                    <div className="mt-4 space-y-3 text-sm text-white/70">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{selectedTask.client_company_name || "Client company"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span>
                          Confidence {selectedTask.confidence_flag}
                          {selectedTask.human_intervention ? " • Needs review" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        <span>
                          {selectedTask.due_date
                            ? `Due ${format(new Date(selectedTask.due_date), "dd MMM yyyy")}`
                            : "No due date"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCircle2 className="h-4 w-4" />
                        <span>{selectedTask.assignee_name || "Unassigned"}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full rounded-xl"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TaskBoard;
