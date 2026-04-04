import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HeroDitheringBackground } from "@/components/ui/hero-dithering-card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, Upload, Eye, EyeOff, Sparkles } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { login, signup, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupData, setSignupData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    company_name: "",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const success = await login(loginEmail, loginPassword);

    if (success) {
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      navigate("/dashboard");
    } else {
      toast({
        title: "Login failed",
        description:
          "Invalid email or password. Try admin@dayflow.com / password123",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (signupData.password.length < 8) {
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    if (!logo) {
      toast({
        title: "Company Logo Required",
        description: "Please upload a company logo.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const success = await signup({
      name: signupData.name,
      phone: signupData.phone,
      email: signupData.email,
      password: signupData.password,
      company_name: signupData.company_name,
      logo: logo,
      profile_picture: profilePicture,
    });

    if (success) {
      toast({
        title: "Account created!",
        description: "Welcome to Emplor.",
      });
      navigate("/dashboard");
    } else {
      toast({
        title: "Signup failed",
        description: "Could not create account. Please try again.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen flex overflow-hidden">
      {/* Left Panel - Branding */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 p-12 bg-black [mask-image:linear-gradient(to_right,black_0%,black_86%,transparent_100%)]">
        <HeroDitheringBackground className="absolute inset-0" colorFront="#ff7a2f" />
        <div className="absolute inset-0 bg-black/20" />

        <div className="relative z-10 flex w-full flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <img
                className="h-[72px] w-[72px] shrink-0 object-contain"
                src="logo1Invert.png"
                alt="Clautzel logo"
              />
              <div>
                <h1 className="text-6xl font-bold text-primary-foreground">
                  Clautzel
                </h1>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-4xl font-bold text-primary-foreground leading-tight">
              Every workday,
              <br />
              <span className="text -orange-100">perfectly aligned.</span>
            </h2>
            <p className="max-w-md font-medium text-lg text-orange-50/80">
              Streamline your HR operations with our comprehensive management
              system. From attendance to payroll, all automated.
            </p>
          </div>

          <p className="text-sm text-white font-medium">
            © 2026 Emplor. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8 bg-background overflow-y-auto scrollbar-hide">
        <div className="w-full max-w-md my-4">
          <div className="lg:hidden mb-6 md:mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Emplor</h1>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 md:mb-8">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-0 shadow-lg flex flex-col">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl">Welcome back</CardTitle>
                  <CardDescription>
                    Enter your credentials to access your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex items-center">
                  <form onSubmit={handleLogin} className="space-y-4 w-full">
                    <div className="space-y-2">
                      <Label htmlFor="email">Login id / Email</Label>
                      <Input
                        id="email"
                        type="text"
                        placeholder="EMP001 / admin@dayflow.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="password123"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowLoginPassword(!showLoginPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showLoginPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Sign In
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card className="border-0 shadow-lg h-[345px] flex flex-col">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl">Create account</CardTitle>
                  <CardDescription>
                    Enter your details to get started
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto scrollbar-hide">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="flex gap-3 items-end">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="company_name">Company Name</Label>
                        <Input
                          id="company_name"
                          placeholder="Acme Inc."
                          value={signupData.company_name}
                          onChange={(e) =>
                            setSignupData({
                              ...signupData,
                              company_name: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="logo"
                          className="text-center block text-sm font-medium"
                        >
                          Logo
                        </Label>
                        <label
                          htmlFor="logo"
                          className="flex items-center justify-center w-10 h-10 border-2 border-dashed border-input rounded-lg cursor-pointer hover:border-primary transition-colors"
                        >
                          {logo ? (
                            <img
                              src={URL.createObjectURL(logo)}
                              alt="Logo preview"
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          )}
                        </label>
                        <Input
                          id="logo"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setLogo(e.target.files?.[0] || null)}
                          required
                          className="hidden"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={signupData.name}
                        onChange={(e) =>
                          setSignupData({ ...signupData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1234567890"
                        value={signupData.phone}
                        onChange={(e) =>
                          setSignupData({
                            ...signupData,
                            phone: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signupEmail">Email</Label>
                      <Input
                        id="signupEmail"
                        type="email"
                        placeholder="john@company.com"
                        value={signupData.email}
                        onChange={(e) =>
                          setSignupData({
                            ...signupData,
                            email: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile_picture">
                        Profile Picture (Optional)
                      </Label>
                      <Input
                        id="profile_picture"
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setProfilePicture(e.target.files?.[0] || null)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signupPassword">Password</Label>
                      <div className="relative">
                        <Input
                          id="signupPassword"
                          type={showSignupPassword ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          value={signupData.password}
                          onChange={(e) =>
                            setSignupData({
                              ...signupData,
                              password: e.target.value,
                            })
                          }
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowSignupPassword(!showSignupPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showSignupPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm password"
                          value={signupData.confirmPassword}
                          onChange={(e) =>
                            setSignupData({
                              ...signupData,
                              confirmPassword: e.target.value,
                            })
                          }
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Create Account
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 hidden w-40 -translate-x-1/2 lg:block">
        <div className="h-full w-full bg-gradient-to-r from-black/55 via-black/16 to-transparent blur-2xl" />
      </div>

    </div>
  );
};

export default Auth;
