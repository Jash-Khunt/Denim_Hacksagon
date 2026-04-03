import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning';
}

const variantStyles = {
  default: 'bg-card',
  primary: 'bg-primary text-primary-foreground',
  accent: 'accent-gradient text-accent-foreground',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
};

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-foreground/20 text-primary-foreground',
  accent: 'bg-accent-foreground/20 text-accent-foreground',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
};

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
}: StatCardProps) => {
  return (
    <div className={cn('stat-card', variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn(
            'text-sm font-medium mb-1',
            variant === 'default' ? 'text-muted-foreground' : 'opacity-80'
          )}>
            {title}
          </p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && (
            <p className={cn(
              'text-sm mt-1',
              variant === 'default' ? 'text-muted-foreground' : 'opacity-70'
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={cn(
              'text-sm mt-2 font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', iconVariantStyles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
