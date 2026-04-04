import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { clientAPI } from "@/services/api";
import { ClientConnection, ClientProjectUpload } from "@/types";
import {
  ArrowUpRight,
  Bot,
  Building2,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1").replace(
  "/api/v1",
  "",
);

const ClientProjects = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ClientProjectUpload[]>([]);
  const [connections, setConnections] = useState<ClientConnection[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    project_name: "",
    overview: "",
    hr_id: "",
    bot_response: "",
  });

  const connectedConnections = useMemo(
    () => connections.filter((connection) => connection.status === "connected"),
    [connections],
  );

  const pendingCount = useMemo(
    () => connections.filter((connection) => connection.status === "pending").length,
    [connections],
  );

  const hrOptions = useMemo(
    () =>
      connectedConnections.map((connection) => ({
        value: connection.hr_id || "",
        label: `${connection.name} • ${connection.company_name || "HR partner"}`,
      })),
    [connectedConnections],
  );

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Please try again.";

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [projectResponse, connectionResponse] = await Promise.all([
        clientAPI.getProjects(),
        clientAPI.getConnections(),
      ]);

      setProjects(projectResponse.uploads);
      setConnections(connectionResponse.connections);

      const connected = connectionResponse.connections.filter(
        (connection) => connection.status === "connected",
      );

      if (connected.length === 1) {
        setForm((prev) => ({ ...prev, hr_id: connected[0].hr_id || "" }));
      }

      if (connected.length === 0) {
        toast({
          title: "HR approval required",
          description:
            "Your project upload workspace unlocks after an HR partner approves your connection request.",
        });
        navigate("/client/hr-directory", { replace: true });
      }
    } catch (error: unknown) {
      toast({
        title: "Could not load project workspace",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast({
        title: "PDF required",
        description: "Choose a project overview PDF before uploading.",
        variant: "destructive",
      });
      return;
    }

    if (!form.hr_id) {
      toast({
        title: "HR partner required",
        description: "Choose one approved HR connection for this project upload.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("pdf", selectedFile);
    formData.append("project_name", form.project_name);
    formData.append("overview", form.overview);
    formData.append("hr_id", form.hr_id);
    if (form.bot_response.trim()) {
      formData.append("bot_response", form.bot_response);
    }

    try {
      setIsSubmitting(true);
      const response = await clientAPI.uploadProjectPdf(formData);
      setProjects((prev) => [response.upload, ...prev]);
      setSelectedFile(null);
      setForm({
        project_name: "",
        overview: "",
        hr_id: connectedConnections.length === 1 ? connectedConnections[0].hr_id || "" : "",
        bot_response: "",
      });

      toast({
        title: "Project intake saved",
        description: response.tasks?.length
          ? `${response.tasks.length} tickets were created from the chatbot output.`
          : "The PDF is connected to HR and ready for chatbot processing.",
      });
    } catch (error: unknown) {
      toast({
        title: "Upload failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading project workspace...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-lg">
        <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden px-8 py-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,180,118,0.28),transparent_45%),linear-gradient(140deg,rgba(255,255,255,0.5),rgba(255,246,240,0.9))]" />
            <div className="relative space-y-5">
              <Badge className="rounded-full bg-primary/15 px-4 py-1 text-primary hover:bg-primary/15">
                Approved Client Intake
              </Badge>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight">
                Your approved HR connection is live, so project briefs can now move into ticket creation.
              </h1>
              <p className="max-w-xl text-muted-foreground">
                Upload the PDF, choose the approved HR partner, and optionally
                paste the chatbot JSON output to create delivery tickets right away.
              </p>
            </div>
          </div>

          <div className="border-t border-border/60 bg-gradient-to-br from-primary/10 via-accent/40 to-background px-8 py-9 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              {[
                "Client connection approved by HR",
                "Project PDF linked to the right HR partner",
                "Chatbot output converted into internal tickets",
                "High confidence tasks auto-assign while low confidence waits for HR review",
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

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/60 bg-card/95">
          <CardHeader>
            <CardTitle>Upload Project Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                {connectedConnections.map((connection) => (
                  <div
                    key={connection.connection_id}
                    className="rounded-[1.4rem] border border-border/60 bg-muted/20 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{connection.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {connection.company_name}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="project_name">Project name</Label>
                <Input
                  id="project_name"
                  placeholder="AI onboarding workflow"
                  value={form.project_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, project_name: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Approved HR partner</Label>
                <Select
                  value={form.hr_id || undefined}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, hr_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select one approved HR connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {hrOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="overview">Short overview</Label>
                <Textarea
                  id="overview"
                  rows={4}
                  placeholder="Give the HR team a quick summary before the chatbot converts the brief into tasks."
                  value={form.overview}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, overview: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="pdf">Project overview PDF</Label>
                <label
                  htmlFor="pdf"
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-border bg-muted/30 px-6 py-10 text-center transition hover:border-primary/60 hover:bg-primary/5"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.3rem] bg-background shadow-sm transition group-hover:-translate-y-1">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <p className="mt-4 text-base font-semibold">
                    {selectedFile ? selectedFile.name : "Drop or choose a PDF"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Upload opens only after HR approval.
                  </p>
                </label>
                <Input
                  id="pdf"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bot_response">Chatbot ticket JSON</Label>
                <Textarea
                  id="bot_response"
                  rows={9}
                  placeholder='Paste the current chatbot response here if you want tickets created immediately. Example: [{"task":"Build login flow","Difficulty":"Medium","field":"Front-end","flag":"High","human_intervention":false}]'
                  value={form.bot_response}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, bot_response: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This bridges the current standalone chatbot into the web workflow until the bot moves into the dashboard.
                </p>
              </div>

              <Button type="submit" className="w-full rounded-2xl" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Upload and Create Intake
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/60 bg-card/95">
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.5rem] border border-border/60 bg-muted/20 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{connectedConnections.length} approved HR partner(s)</p>
                    <p className="text-sm text-muted-foreground">
                      {pendingCount} pending request(s) still awaiting approval.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-border/60 bg-muted/20 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Current chatbot bridge</p>
                    <p className="text-sm text-muted-foreground">
                      Paste the bot response above to seed internal tickets in the HR board immediately.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/95">
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-border bg-muted/20 p-10 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 font-medium">No PDFs uploaded yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your approved project briefs will appear here.
                  </p>
                </div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.upload_id}
                    className="rounded-[1.6rem] border border-border/60 bg-background/75 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">
                          {project.project_name || project.original_name}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Uploaded on{" "}
                          {new Date(project.created_at).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {project.processing_status.replaceAll("_", " ")}
                      </Badge>
                    </div>

                    {project.overview && (
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        {project.overview}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                        <FileText className="h-4 w-4" />
                        {project.original_name}
                      </div>
                      {project.hr_name && (
                        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                          <Building2 className="h-4 w-4" />
                          {project.hr_name} • {project.hr_company_name}
                        </div>
                      )}
                      <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                        <Bot className="h-4 w-4" />
                        {project.task_count || 0} tickets
                      </div>
                    </div>

                    <a
                      href={`${API_ROOT}/${project.file_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      Open uploaded PDF
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClientProjects;
