"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/validations/auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, LogIn, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError(null);
    const result = await signIn("credentials", { email: data.email, password: data.password, redirect: false });
    setIsLoading(false);
    if (result?.error) { setError("Invalid email or password"); return; }
    router.push("/employee/my-skills");
    router.refresh();
  }

  function fillDemo(email: string, pw: string) {
    setValue("email", email);
    setValue("password", pw);
  }

  return (
    <div className="w-full max-w-[420px] animate-scale-in">
      {/* Mobile logo */}
      <div className="flex items-center gap-3 mb-8 lg:hidden">
        <div className="gradient-brand p-2 rounded-xl">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gradient">Skill Matrix</span>
      </div>

      <Card className="border-0 shadow-2xl rounded-md shadow-indigo-500/5 bg-white/90 backdrop-blur-sm">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-2xl font-extrabold tracking-tight text-gray-900">
            Welcome back
          </CardTitle>
          <CardDescription className="text-[15px] text-gray-500 mt-1">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3.5 text-sm text-red-600 text-center font-medium animate-scale-in">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-800 font-bold">Email address</Label>
              <Input
                id="email" type="email" placeholder="you@company.com"
                className="h-11 rounded-sm border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-800 font-bold">Password</Label>
              <div className="relative">
                <Input
                  id="password" type={showPw ? "text" : "password"} placeholder="Enter your password"
                  className="h-11 rounded-sm border-gray-200 bg-gray-50/50 focus:bg-white transition-colors pr-10"
                  {...register("password")}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={isLoading}
              className="w-full h-12 rounded-md bg-primary hover:bg-secondary cursor-pointer transition-all text-[15px] font-semibold shadow-glow-sm">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2"><LogIn className="h-4 w-4" /> Sign in</span>
              )}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400 font-medium">Quick access</span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { role: "Admin", email: "admin@skillmatrix.com", pw: "admin123456", color: "bg-red-50 text-red-600 border-red-100" },
                { role: "Manager", email: "manager.fullstack@skillmatrix.com", pw: "manager123", color: "bg-blue-50 text-blue-600 border-blue-100" },
                { role: "Employee", email: "alice.fullstack@skillmatrix.com", pw: "employee123", color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
              ].map((demo) => (
                <button key={demo.role} type="button" onClick={() => fillDemo(demo.email, demo.pw)}
                  className="flex items-center w-full rounded-xl border border-gray-100 px-4 py-3 text-left hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${demo.color}`}>
                    {demo.role}
                  </span>
                  <span className="ml-3 text-sm text-gray-600 truncate flex-1 font-mono text-xs">{demo.email}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
