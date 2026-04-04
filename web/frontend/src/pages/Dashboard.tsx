import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import {
  MessageSquare,
  LayoutList,
  ArrowRight,
  Bot,
  Zap,
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const isHr = user?.role === 'hr';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Two-column layout for future features */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[580px]">
        {/* Left Side — Future AI Chatbot */}
        <div className="lg:col-span-3">
          <Card className="h-full border-dashed border-2 border-border/60">
            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center min-h-[580px]">
              <div className="p-5 rounded-full bg-primary/5 mb-6 relative">
                <Bot className="w-12 h-12 text-primary/40" />
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400/50 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-foreground/80 mb-2">
                AI Assistant
              </h3>
              <p className="text-muted-foreground max-w-xs mb-6 px-4">
                {isHr
                  ? 'Upload client PDFs, chat with AI to extract tasks, and auto-generate Jira tickets for your team.'
                  : 'Chat with the AI assistant to get help with tasks, ask questions, and boost your productivity.'
                }
              </p>

              {/* Fake chat preview */}
              <div className="w-full max-w-xs space-y-3 px-4">
                <div className="flex gap-2 items-start">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary/50" />
                  </div>
                  <div className="bg-muted/60 rounded-xl rounded-tl-none px-3 py-2 text-xs text-muted-foreground text-left">
                    Hi! I'm your AI assistant. I'll help you manage tasks efficiently.
                  </div>
                </div>
                <div className="flex gap-2 items-start justify-end">
                  <div className="bg-primary/10 rounded-xl rounded-tr-none px-3 py-2 text-xs text-muted-foreground text-left">
                    {isHr ? 'Extract tasks from the uploaded PDF...' : 'Show me my pending tasks...'}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-primary/50" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-primary/60 mt-6">
                <Zap className="w-4 h-4" />
                <span>Coming Soon</span>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Right Side — Future Jira Tickets / Tasks */}
        <div className="lg:col-span-2">
          <Card className="h-full border-dashed border-2 border-border/60">
            <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center min-h-[480px]">
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
