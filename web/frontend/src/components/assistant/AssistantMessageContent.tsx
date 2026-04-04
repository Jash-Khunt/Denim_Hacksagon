import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  LiHTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const GRAPH_CONFIG_PATTERN = /\[GRAPH_CONFIG\]\s*([\s\S]*?)(?:\[\/GRAPH_CONFIG\]|$)/i;
const TICKET_CONFIG_GLOBAL_PATTERN = /\[TICKET_CONFIG\]\s*([\s\S]*?)(?:\[\/TICKET_CONFIG\]|(?=\[TICKET_CONFIG\])|$)/gi;
const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(12 78% 60%)",
  "hsl(40 88% 58%)",
  "hsl(190 72% 42%)",
  "hsl(330 62% 58%)",
  "hsl(260 48% 58%)",
  "hsl(150 42% 42%)",
];

type GraphDatum = {
  label: string;
  value: number;
};

type GraphConfigPayload = {
  chartType: "bar" | "line" | "pie";
  title: string;
  data: GraphDatum[];
};

type ParsedAssistantContent = {
  markdown: string;
  graph: GraphConfigPayload | null;
  tickets: TicketPayload[];
};

type TicketPayload = {
  task: string;
  difficulty: string;
  field: string;
  flag: string;
  humanIntervention: boolean;
  extractedDate?: string | null;
  isoTimestamp?: string | null;
  category?: string | null;
  urgencyLevel?: string | null;
  description?: string | null;
};

const removeGraphConfig = (content: string) =>
  content.replace(GRAPH_CONFIG_PATTERN, "").trim();

const removeTicketConfig = (content: string) =>
  content.replace(TICKET_CONFIG_GLOBAL_PATTERN, "").trim();

const stripTaggedContent = (content: string) => removeTicketConfig(removeGraphConfig(content));

const stripCodeFence = (value: string) =>
  value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

const compactWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizePreview = (content: string) =>
  compactWhitespace(
    stripTaggedContent(content)
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_~`>]+/g, " ")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1"),
  );

const normalizeTicket = (value: unknown): TicketPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const task =
    typeof record.task === "string" && record.task.trim()
      ? record.task.trim()
      : typeof record.title === "string" && record.title.trim()
        ? record.title.trim()
        : "";

  if (!task) {
    return null;
  }

  const difficulty =
    typeof record.difficulty === "string" && record.difficulty.trim()
      ? record.difficulty.trim()
      : typeof record.Difficulty === "string" && record.Difficulty.trim()
        ? record.Difficulty.trim()
        : "Medium";
  const field =
    typeof record.field === "string" && record.field.trim()
      ? record.field.trim()
      : typeof record.domain === "string" && record.domain.trim()
        ? record.domain.trim()
        : "Full-stack";
  const flag =
    typeof record.flag === "string" && record.flag.trim()
      ? record.flag.trim()
      : typeof record.confidence_flag === "string" && record.confidence_flag.trim()
        ? record.confidence_flag.trim()
        : "Low";
  const humanIntervention =
    typeof record.human_intervention === "boolean"
      ? record.human_intervention
      : typeof record.human_intervention === "string"
        ? record.human_intervention.toLowerCase() === "true"
        : flag.toLowerCase() === "low";

  return {
    task,
    difficulty,
    field,
    flag,
    humanIntervention,
    extractedDate:
      typeof record.extracted_date === "string" ? record.extracted_date : null,
    isoTimestamp:
      typeof record.iso_timestamp === "string"
        ? record.iso_timestamp
        : typeof record.due_date === "string"
          ? record.due_date
          : null,
    category: typeof record.category === "string" ? record.category : null,
    urgencyLevel:
      typeof record.urgency_level === "string"
        ? record.urgency_level
        : typeof record.priority === "string"
          ? record.priority
          : null,
    description:
      typeof record.description === "string" ? record.description : null,
  };
};

const parseTicketConfig = (content: string): TicketPayload[] => {
  const taggedTickets = [...content.matchAll(TICKET_CONFIG_GLOBAL_PATTERN)]
    .map((match) => {
      try {
        return JSON.parse(stripCodeFence(match[1])) as unknown;
      } catch {
        return null;
      }
    })
    .flatMap((parsed) => {
      if (Array.isArray(parsed)) return parsed;
      return parsed ? [parsed] : [];
    })
    .map(normalizeTicket)
    .filter((ticket): ticket is TicketPayload => Boolean(ticket));

  if (taggedTickets.length > 0) {
    return taggedTickets;
  }

  const cleaned = stripCodeFence(stripTaggedContent(content));
  if (!/^\s*[[{]/.test(cleaned)) {
    return [];
  }

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const records = Array.isArray(parsed) ? parsed : [parsed];
    return records
      .map(normalizeTicket)
      .filter((ticket): ticket is TicketPayload => Boolean(ticket));
  } catch {
    return [];
  }
};

const parseGraphConfig = (content: string): ParsedAssistantContent => {
  const match = content.match(GRAPH_CONFIG_PATTERN);
  const markdown = stripTaggedContent(content);
  const tickets = parseTicketConfig(content);

  if (!match) {
    return {
      markdown,
      graph: null,
      tickets,
    };
  }

  try {
    const parsed = JSON.parse(
      stripCodeFence(match[1]),
    ) as Record<string, unknown>;

    const chartType =
      typeof parsed.chartType === "string"
        ? parsed.chartType.toLowerCase()
        : "";
    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : "Visual Summary";
    const data = Array.isArray(parsed.data)
      ? parsed.data
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;

            const record = entry as Record<string, unknown>;
            const label =
              typeof record.label === "string" ? record.label.trim() : "";
            const value =
              typeof record.value === "number"
                ? record.value
                : typeof record.value === "string"
                  ? Number(record.value)
                  : Number.NaN;

            if (!label || Number.isNaN(value) || !Number.isFinite(value)) {
              return null;
            }

            return {
              label,
              value,
            };
          })
          .filter((entry): entry is GraphDatum => Boolean(entry))
          .slice(0, 10)
      : [];

    if (!["bar", "line", "pie"].includes(chartType) || data.length === 0) {
      return {
        markdown,
        graph: null,
        tickets,
      };
    }

    return {
      markdown,
      graph: {
        chartType: chartType as GraphConfigPayload["chartType"],
        title,
        data,
      },
      tickets,
    };
  } catch {
    return {
      markdown,
      graph: null,
      tickets,
    };
  }
};

const formatCompactValue = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const formatFullValue = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);

const TicketBadge = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <Badge variant="secondary" className={cn("rounded-full px-3 py-1 text-[11px]", className)}>
    {children}
  </Badge>
);

const AssistantTickets = ({ tickets }: { tickets: TicketPayload[] }) => {
  const reviewCount = tickets.filter((ticket) => ticket.humanIntervention).length;

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
      <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_46%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)/0.92))] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Ticket Breakdown
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
            {tickets.length} items
          </Badge>
          {reviewCount > 0 ? (
            <Badge variant="outline" className="rounded-full border-warning/30 bg-warning/10 px-3 py-1 text-[11px] text-warning">
              {reviewCount} need review
            </Badge>
          ) : null}
        </div>
        <h4 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          Assistant-generated tickets
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured work items extracted from the assistant response.
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:p-5">
        {tickets.map((ticket, index) => (
          <div
            key={`${ticket.task}-${index}`}
            className="rounded-[1.4rem] border border-border/70 bg-background/85 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Ticket {index + 1}
                  </Badge>
                  <TicketBadge
                    className={
                      ticket.difficulty.toLowerCase() === "hard"
                        ? "bg-destructive/10 text-destructive"
                        : ticket.difficulty.toLowerCase() === "easy"
                          ? "bg-success/10 text-success"
                          : "bg-info/10 text-info"
                    }
                  >
                    {ticket.difficulty}
                  </TicketBadge>
                  <TicketBadge className="bg-muted text-muted-foreground">
                    {ticket.field}
                  </TicketBadge>
                </div>
                <h5 className="text-base font-semibold leading-6 text-foreground">
                  {ticket.task}
                </h5>
                {ticket.description ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {ticket.description}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <TicketBadge
                  className={
                    ticket.flag.toLowerCase() === "high"
                      ? "bg-success/10 text-success"
                      : "bg-warning/12 text-warning"
                  }
                >
                  Confidence {ticket.flag}
                </TicketBadge>
                {ticket.humanIntervention ? (
                  <TicketBadge className="bg-warning/12 text-warning">
                    Needs review
                  </TicketBadge>
                ) : (
                  <TicketBadge className="bg-primary/10 text-primary">
                    Ready for automation
                  </TicketBadge>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {ticket.isoTimestamp ? (
                <div className="rounded-2xl bg-muted/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Due Date
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {ticket.isoTimestamp}
                  </p>
                </div>
              ) : null}
              {ticket.extractedDate ? (
                <div className="rounded-2xl bg-muted/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Extracted Phrase
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {ticket.extractedDate}
                  </p>
                </div>
              ) : null}
              {ticket.category ? (
                <div className="rounded-2xl bg-muted/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Category
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {ticket.category}
                  </p>
                </div>
              ) : null}
              {ticket.urgencyLevel ? (
                <div className="rounded-2xl bg-muted/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Priority
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {ticket.urgencyLevel}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AssistantGraph = ({ graph }: { graph: GraphConfigPayload }) => {
  const chartData = graph.data.map((item, index) => ({
    ...item,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const topDatum = [...chartData].sort((left, right) => right.value - left.value)[0];
  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

  const seriesChartConfig: ChartConfig = {
    value: {
      label: "Value",
      color: CHART_COLORS[0],
    },
  };

  const pieChartConfig = chartData.reduce<ChartConfig>((config, item) => {
    config[item.label] = {
      label: item.label,
      color: item.fill,
    };
    return config;
  }, {});

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-border/70 bg-gradient-to-br from-background via-background to-accent/20 shadow-sm">
      <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_46%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)/0.92))] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Visual Summary
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
            {graph.chartType} chart
          </Badge>
        </div>
        <h4 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          {graph.title}
        </h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {topDatum ? (
            <Badge variant="secondary" className="rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary">
              Peak: {topDatum.label} ({formatFullValue(topDatum.value)})
            </Badge>
          ) : null}
          <Badge variant="secondary" className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
            Total: {formatFullValue(totalValue)}
          </Badge>
          <Badge variant="secondary" className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
            {chartData.length} data points
          </Badge>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <ChartContainer
          config={graph.chartType === "pie" ? pieChartConfig : seriesChartConfig}
          className="h-[290px] w-full"
        >
          {graph.chartType === "line" ? (
            <LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={20}
                tickMargin={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value) => formatCompactValue(Number(value))}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" labelKey="label" />}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={3}
                dot={{ r: 4, fill: CHART_COLORS[0], strokeWidth: 0 }}
                activeDot={{ r: 6, fill: CHART_COLORS[0] }}
              />
            </LineChart>
          ) : graph.chartType === "pie" ? (
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel nameKey="label" />}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="label"
                innerRadius={58}
                outerRadius={96}
                paddingAngle={3}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="label" className="flex-wrap gap-3 pt-4" />}
              />
            </PieChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={20}
                tickMargin={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value) => formatCompactValue(Number(value))}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideIndicator labelKey="label" />}
              />
              <Bar dataKey="value" radius={[10, 10, 4, 4]}>
                {chartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ChartContainer>
      </div>
    </div>
  );
};

const markdownComponents = {
  h1: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className={cn("mt-1 text-2xl font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn("mt-6 text-xl font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className={cn("mt-5 text-base font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className={cn("my-3 text-[15px] leading-7 text-foreground/90", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => (
    <ul
      className={cn("my-4 ml-5 list-disc space-y-2 marker:text-primary", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
    <ol
      className={cn("my-4 ml-5 list-decimal space-y-2 marker:font-semibold marker:text-primary", className)}
      {...props}
    />
  ),
  li: ({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) => (
    <li className={cn("pl-1 text-[15px] leading-7 text-foreground/90", className)} {...props} />
  ),
  blockquote: ({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className={cn(
        "my-5 rounded-r-2xl border-l-4 border-primary/35 bg-primary/5 px-4 py-3 text-[15px] italic leading-7 text-foreground/80",
        className,
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className={cn(
        "font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary",
        className,
      )}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  strong: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  hr: ({ className, ...props }: HTMLAttributes<HTMLHRElement>) => (
    <hr className={cn("my-6 border-border/70", className)} {...props} />
  ),
  table: ({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) => (
    <div className="my-5 overflow-x-auto rounded-2xl border border-border/70">
      <table className={cn("min-w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className={cn("bg-muted/60", className)} {...props} />
  ),
  tbody: ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody className={cn("divide-y divide-border/60", className)} {...props} />
  ),
  tr: ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => (
    <tr className={cn("transition-colors hover:bg-muted/20", className)} {...props} />
  ),
  th: ({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className={cn(
        "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className={cn("px-4 py-3 text-[14px] leading-6 text-foreground/90", className)} {...props} />
  ),
  pre: ({ className, ...props }: HTMLAttributes<HTMLPreElement>) => (
    <pre
      className={cn(
        "my-5 overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950 px-4 py-4 text-[13px] leading-6 text-slate-100 shadow-inner",
        className,
      )}
      {...props}
    />
  ),
  code: ({
    className,
    children,
    ...props
  }: HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
    const isBlock = Boolean(className);

    if (isBlock) {
      return (
        <code className={cn("font-mono text-[13px]", className)} {...props}>
          {children}
        </code>
      );
    }

    return (
      <code
        className={cn(
          "rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5 font-mono text-[13px] text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
};

type AssistantMessageContentProps = {
  content: string;
};

const AssistantMessageContent = ({ content }: AssistantMessageContentProps) => {
  const { markdown, graph, tickets } = parseGraphConfig(content);

  return (
    <div className="space-y-4">
      {markdown ? (
        <div className="space-y-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {markdown}
          </ReactMarkdown>
        </div>
      ) : null}

      {tickets.length > 0 ? <AssistantTickets tickets={tickets} /> : null}
      {graph ? <AssistantGraph graph={graph} /> : null}
    </div>
  );
};

export { normalizePreview };
export default AssistantMessageContent;
