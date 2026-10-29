import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  Download,
  FileUp,
  FileText,
  FolderOpen,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { companyFileAPI, jiraAPI } from "@/services/api";
import { ClientProjectUpload, HrCompanyFile } from "@/types";

const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1").replace(
  "/api/v1",
  "",
);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const formatFileSize = (value: number | string) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const HrFiles = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<ClientProjectUpload[]>([]);
  const [companyFiles, setCompanyFiles] = useState<HrCompanyFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const [projectResponse, companyResponse] = await Promise.all([
        jiraAPI.getUploads(),
        companyFileAPI.list(),
      ]);
      setFiles(projectResponse.uploads);
      setCompanyFiles(companyResponse.files);
    } catch (error: unknown) {
      toast({
        title: "Could not load available files",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const uploadFiles = async () => {
    if (!selectedFiles.length) return;
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("company_files", file));

    try {
      setIsUploading(true);
      const response = await companyFileAPI.upload(formData);
      setCompanyFiles((current) => [...response.files, ...current]);
      setSelectedFiles([]);
      setUploadDialogOpen(false);
      toast({
        title: response.files.length === 1 ? "File uploaded" : "Files uploaded",
        description: "These documents are stored privately under your HR account.",
      });
    } catch (error: unknown) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const clients = useMemo(() => {
    const uniqueClients = new Map<string, string>();
    files.forEach((file) => {
      if (file.client_id) {
        uniqueClients.set(
          file.client_id,
          file.client_company_name || file.client_name || "Client company",
        );
      }
    });
    return [...uniqueClients.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [files]);

  const visibleFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return files.filter((file) => {
      const matchesClient = clientFilter === "all" || file.client_id === clientFilter;
      const matchesSearch = !query || [
        file.project_name,
        file.original_name,
        file.client_name,
        file.client_company_name,
      ].some((value) => value?.toLowerCase().includes(query));
      return matchesClient && matchesSearch;
    });
  }, [clientFilter, files, search]);

  if (user?.role !== "hr") return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800">
            <span className="h-px w-7 bg-emerald-700" />
            Company file register
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Available files
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Keep private company documents together with project PDFs shared by your connected clients.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setUploadDialogOpen(true)} className="rounded-xl">
            <Upload className="mr-2 h-4 w-4" />
            Upload files
          </Button>
          <Button
            variant="outline"
            onClick={loadFiles}
            disabled={isLoading}
            className="rounded-xl border-slate-300 bg-white/80"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[1.6rem] border border-border/60 bg-gradient-to-br from-primary/10 via-accent/40 to-background px-6 py-7 text-foreground shadow-lg sm:px-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-primary/10" />
        <div className="pointer-events-none absolute -right-1 -top-14 h-48 w-48 rounded-full border border-primary/10" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1.5 text-xs text-primary">
              <ShieldCheck className="h-4 w-4" />
              Access follows your active client connections
            </div>
            <h2 className="text-xl font-medium tracking-tight sm:text-2xl">Shared project documents</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Each file opens through a protected link. Only files assigned to your HR account are listed here.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="min-w-28 rounded-2xl border border-border/70 bg-card/75 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total files</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{files.length + companyFiles.length}</p>
            </div>
            <div className="min-w-28 rounded-2xl border border-border/70 bg-card/75 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Clients</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{clients.length}</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden rounded-[1.4rem] border-border/60 bg-card/95 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col justify-between gap-4 border-b border-border/60 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">Company confidential files</h2>
                  <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                    HR only
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Private to this HR account and available to your assistant. Client-shared project files stay separate.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setUploadDialogOpen(true)} className="shrink-0 rounded-xl">
              <FileUp className="mr-2 h-4 w-4" />
              Add company files
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/60" />)}
            </div>
          ) : companyFiles.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/70" />
              <p className="mt-3 font-semibold">No company files uploaded</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add policies, internal references, or other files for your HR account.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {companyFiles.map((file) => (
                <div key={file.file_id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-accent/20 sm:flex-row sm:items-center sm:px-6">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{file.original_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatFileSize(file.file_size)} <span className="mx-1.5">·</span> Added {formatDate(file.created_at)}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0 self-start rounded-lg sm:self-auto">
                    <a
                      href={`${API_ROOT}/api/v1/company-files/${file.file_id}/download`}
                      aria-label={`Download ${file.original_name}`}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-[1.4rem] border-slate-200/80 bg-white/90 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search files, projects, clients"
                className="h-10 rounded-xl border-slate-200 pl-9"
                aria-label="Search available files"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-medium text-slate-500 sm:inline">Client</span>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 sm:w-56" aria-label="Filter by client">
                  <SelectValue placeholder="All connected clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All connected clients</SelectItem>
                  {clients.map(([clientId, name]) => (
                    <SelectItem key={clientId} value={clientId}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-500">
            <span>{isLoading ? "Checking access…" : `${visibleFiles.length} of ${files.length} files`}</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              Protected downloads
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 pb-5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-[4.5rem] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : visibleFiles.length === 0 ? (
            <div className="mx-5 mb-5 rounded-2xl border border-dashed border-slate-300 bg-[#fafaf7] px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-900/5 text-emerald-900">
                {files.length ? <Search className="h-5 w-5" /> : <FolderOpen className="h-5 w-5" />}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {files.length ? "No files match those filters" : "No shared files yet"}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                {files.length
                  ? "Try a different search or select another connected client."
                  : "When a connected client uploads a project PDF for your HR account, it will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto px-3 pb-3 sm:px-5">
              <table className="w-full min-w-[660px] border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <th className="px-3 pb-1">Document</th>
                    <th className="px-3 pb-1">Client</th>
                    <th className="px-3 pb-1">Added</th>
                    <th className="px-3 pb-1">Type</th>
                    <th className="px-3 pb-1 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFiles.map((file) => (
                    <tr key={file.upload_id} className="group bg-[#fafaf8] text-sm transition-colors hover:bg-emerald-50/70">
                      <td className="rounded-l-xl px-3 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-900/10 bg-white text-emerald-900 shadow-sm">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{file.project_name || file.original_name}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{file.original_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-2 text-slate-700">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          {file.client_company_name || file.client_name || "Connected client"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-slate-600">{formatDate(file.created_at)}</td>
                      <td className="px-3 py-3.5">
                        <Badge variant="outline" className="rounded-lg border-rose-200 bg-rose-50 text-[10px] font-semibold uppercase tracking-wider text-rose-800">PDF</Badge>
                      </td>
                      <td className="rounded-r-xl px-3 py-3.5 text-right">
                        <Button asChild size="sm" variant="outline" className="rounded-lg border-slate-200 bg-white group-hover:border-emerald-900/20">
                          <a
                            href={`${API_ROOT}/api/v1/project-files/${file.upload_id}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${file.original_name}`}
                          >
                            Open <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 px-1 text-xs leading-5 text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
        <p>Access is checked again when a file is opened. Files from disconnected clients are removed from this list.</p>
      </div>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload company files</DialogTitle>
            <DialogDescription>
              These files stay private to your HR login. Your assistant can use them to answer questions in your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="company-files">Choose files</Label>
            <Input
              id="company-files"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.png,.jpg,.jpeg,.webp"
              onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
              disabled={isUploading}
              className="h-auto min-h-11 rounded-xl py-2.5"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              PDF, Office, text, CSV, and image files. Up to 10 files per upload, 25 MB each.
            </p>
            {selectedFiles.length > 0 && (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3">
                {selectedFiles.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground">{formatFileSize(file.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={uploadFiles} disabled={!selectedFiles.length || isUploading}>
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? "Uploading…" : `Upload ${selectedFiles.length || "files"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HrFiles;
