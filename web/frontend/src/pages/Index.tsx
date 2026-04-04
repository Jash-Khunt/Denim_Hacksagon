import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Users,
  Calendar,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Employee Management",
    description:
      "Comprehensive profiles, documents, and team organization in one place.",
  },
  {
    icon: Clock,
    title: "Attendance Tracking",
    description:
      "Real-time check-in/out with daily and weekly attendance views.",
  },
  {
    icon: Calendar,
    title: "Leave Management",
    description: "Streamlined leave requests with instant approval workflows.",
  },
  {
    icon: TrendingUp,
    title: "Payroll Insights",
    description: "Clear salary structures and payment history at a glance.",
  },
];

const benefits = [
  "Role-based access for admins and employees",
  "Real-time attendance tracking",
  "Automated leave approval workflows",
  "Comprehensive payroll visibility",
  "Document management",
  "Analytics and reporting",
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/auth" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl accent-gradient flex items-center justify-center">
              <span className="text-xl font-bold text-primary">D</span>
            </div>
            <span className="text-xl font-bold">Dayflow</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent mb-6">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Modern HR Management</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Every workday,
              <br />
              <span className="text-accent">perfectly aligned.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Streamline your HR operations with our comprehensive management
              system. From attendance to payroll, employee onboarding to leave
              management.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="text-lg px-8">
                <Link to="/auth">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="text-lg px-8"
              >
                <Link to="/auth">View Demo</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Try with: admin@dayflow.com / password123
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { value: "500+", label: "Companies" },
              { value: "50k+", label: "Employees Managed" },
              { value: "99.9%", label: "Uptime" },
              { value: "4.9/5", label: "User Rating" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center p-6 rounded-2xl bg-card border border-border"
              >
                <p className="text-3xl font-bold text-accent">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to manage your team
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to simplify HR operations and empower
              your workforce.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-8 rounded-2xl bg-card border border-border hover:shadow-lg transition-all group"
                >
                  <div className="p-4 rounded-xl bg-accent/10 w-fit mb-6 group-hover:bg-accent/20 transition-colors">
                    <Icon className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Built for modern HR teams
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Dayflow brings together everything you need to manage your
                workforce efficiently, with tools designed for both HR
                administrators and employees.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="mt-8" asChild>
                <Link to="/auth">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl hero-gradient p-8 flex items-center justify-center">
                <div className="w-full max-w-sm space-y-4">
                  {[
                    {
                      label: "Present Today",
                      value: "142",
                      color: "bg-success",
                    },
                    { label: "On Leave", value: "8", color: "bg-warning" },
                    {
                      label: "Pending Requests",
                      value: "12",
                      color: "bg-info",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-4 rounded-xl bg-primary-foreground/10 backdrop-blur"
                    >
                      <span className="text-primary-foreground/80">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-xl font-bold text-primary-foreground">
                          {item.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="hero-gradient rounded-3xl p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Ready to streamline your HR?
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Join hundreds of companies using Dayflow to manage their workforce
              more efficiently.
            </p>
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="text-lg px-8"
            >
              <Link to="/auth">
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center">
                <span className="text-sm font-bold text-primary">D</span>
              </div>
              <span className="font-semibold">Dayflow HRMS</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Dayflow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
