"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Lock, Loader2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import Image from "next/image";

export default function TabletLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuthStore();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login({ email, password });

      // Redirect to tablet dashboard
      router.push("/tablet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 animate-gradient-shift bg-gradient-to-br from-[#667eea] via-[#764ba2] via-[#f093fb] via-[#4facfe] to-[#00f2fe] bg-[length:400%_400%]" />

      {/* Floating Background Shapes */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[10%] h-[250px] w-[250px] animate-float-slow rounded-full bg-white/10" />
        <div className="absolute bottom-[15%] right-[15%] h-[180px] w-[180px] animate-float-medium rounded-full bg-white/10" />
        <div className="absolute left-[5%] top-[60%] h-[130px] w-[130px] animate-float-fast rounded-full bg-white/10" />
      </div>

      <div className="relative z-10 w-full max-w-[380px]">
        {/* Login Card */}
        <div className="animate-slide-in rounded-[28px] bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="mb-1 text-xl font-bold text-black">Sign in with email</h1>
            <p className="text-xs text-gray-500">Sign in to access warehouse operations</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border-none bg-gray-100 pl-11 pr-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus-visible:ring-0"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border-none bg-gray-100 pl-11 pr-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus-visible:ring-0"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-black focus:ring-2 focus:ring-black focus:ring-offset-0"
                />
                <span className="text-xs font-medium text-gray-900">Remember me</span>
              </label>
              <button
                type="button"
                className="text-xs font-medium text-gray-900 transition-colors hover:text-gray-600"
                onClick={() => alert('Contact your administrator for password reset')}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-10 h-12 w-full rounded-xl bg-black text-sm font-semibold text-white transition-all hover:bg-gray-800"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Get Started"
              )}
            </Button>
          </form>

          {/* Powered by */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <span className="text-sm font-semibold uppercase tracking-wider text-gray-600">Powered by</span>
            <div className="flex items-center justify-center">
              <Image
                src="/pragmatica.jpeg"
                alt="Pragmatica"
                width={280}
                height={84}
                className="h-20 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Custom Animations Styles */}
      <style jsx>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-25px) rotate(4deg); }
          66% { transform: translateY(25px) rotate(-4deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-18px) rotate(2.5deg); }
          66% { transform: translateY(18px) rotate(-2.5deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-12px) rotate(1.5deg); }
          66% { transform: translateY(12px) rotate(-1.5deg); }
        }
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-gradient-shift {
          animation: gradient-shift 15s ease infinite;
        }
        .animate-float-slow {
          animation: float-slow 20s infinite ease-in-out;
        }
        .animate-float-medium {
          animation: float-medium 20s infinite ease-in-out 5s;
        }
        .animate-float-fast {
          animation: float-fast 20s infinite ease-in-out 10s;
        }
        .animate-slide-in {
          animation: slide-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
