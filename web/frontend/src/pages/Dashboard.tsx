import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import AssistantWorkspace from '@/components/assistant/AssistantWorkspace';
import {
  LayoutList,
  Sparkles,
  Zap,
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const isHr = user?.role === 'hr';

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)] min-h-[760px]">
        <AssistantWorkspace />

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/90 backdrop-blur-md shadow-card overflow-hidden">
            <CardContent className="p-0">
              <div className="border-b border-border/70 bg-muted/30 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">AI Workflow</h3>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm font-semibold">Connected pipeline</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The assistant is wired for a Pathway RAG backend and will answer from the indexed client document set.
                  </p>
                </div>
                <div className="grid gap-3">
                  {[
                    "Document-grounded answers",
                    "Task extraction and summaries",
                    "Conversation history in browser storage",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Zap className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed border-2 border-border/60 bg-card/70 backdrop-blur-sm shadow-card">
            <CardContent className="flex min-h-[250px] flex-col items-center justify-center text-center">
              <div className="p-5 rounded-full bg-primary/5 mb-6">
                <LayoutList className="w-12 h-12 text-primary/40" />
              </div>
              <h3 className="text-xl font-semibold text-foreground/80 mb-2">
                {isHr ? 'Project Task Board' : 'My Tasks'}
              </h3>
              <p className="text-muted-foreground max-w-sm mb-6 px-4">
                {isHr
                  ? 'Jira-integrated task board coming soon. Manage client PDFs, extract tasks, and assign to employees — all from here.'
                  : 'Your assigned Jira tickets and task progress will appear here. Stay tuned for the integrated task management experience.'
                }
              </p>
              <div className="flex items-center gap-2 text-sm text-primary/60">
                <Zap className="w-4 h-4" />
                <span>Coming Soon</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
