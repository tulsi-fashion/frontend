"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function getDate() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr]   = useState("");
  const [year, setYear]         = useState<number | null>(null);

  useEffect(() => {
    setGreeting(getGreeting());
    setDateStr(getDate());
    setYear(new Date().getFullYear());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setError(data?.error?.message || "Email or password is incorrect. Please try again.");
        return;
      }
      const token = data?.success?.data?.token || data?.success?.data?.accessToken;
      const refreshToken = data?.success?.data?.refresh_token;
      if (token) {
        localStorage.setItem("tf_token", token);
        if (refreshToken) localStorage.setItem("tf_refresh_token", refreshToken);
        window.location.href = "/dashboard";
      } else {
        setError("Login failed. Please try again.");
      }
    } catch {
      setError("Unable to connect. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col justify-between"
           style={{ background: "linear-gradient(160deg, #1a5c42 0%, #237a59 55%, #2d9e72 100%)" }}>

        {/* Decorative fabric-like circles */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full border border-white/10" />
          <div className="absolute -top-10 -left-10 w-60 h-60 rounded-full border border-white/10" />
          <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full border border-white/[0.07]" />
          <div className="absolute top-1/3 -right-16 w-52 h-52 rounded-full border border-white/[0.07]" />
          <div className="absolute -bottom-20 left-1/3 w-80 h-80 rounded-full border border-white/[0.07]" />
          {/* Dot pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]">
            <defs>
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Top — brand */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <span className="text-white font-black text-base tracking-tight">TF</span>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none tracking-tight">Tulshi Fashion</p>
              <p className="text-white/50 text-[10px] tracking-[2px] uppercase mt-0.5">Billing & Inventory</p>
            </div>
          </div>
        </div>

        {/* Middle — main message */}
        <div className="relative z-10 px-10 pb-4">
          <p className="text-white/60 text-sm font-medium mb-3">{dateStr}</p>
          <h1 className="text-white text-5xl font-black leading-none tracking-tight mb-6">
            Tulshi<br />Fashion
          </h1>
          <p className="text-white/70 text-base leading-relaxed max-w-65">
            Your complete shop management system — bills, stock, customers, and daily reports.
          </p>

          {/* Divider line */}
          <div className="mt-10 flex items-center gap-4">
            <div className="h-px bg-white/20 w-12" />
            <span className="text-white/40 text-xs tracking-wider uppercase">Est. 2024</span>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 p-10 pt-0">
          <p className="text-white/30 text-xs">© {year ?? ''} Tulshi Fashion</p>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-[#f7f8fb] px-6 py-12">
        <div className="w-full max-w-100">

          {/* Mobile brand */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-[#237a59] flex items-center justify-center">
              <span className="text-white font-black text-sm">TF</span>
            </div>
            <div>
              <p className="text-[#20283b] font-bold text-base leading-none">Tulshi Fashion</p>
              <p className="text-[#798397] text-[10px] tracking-widest uppercase mt-0.5">Billing & Inventory</p>
            </div>
          </div>

          {/* Greeting */}
          <div className="mb-8">
            <p className="text-[#237a59] text-sm font-semibold mb-1">{greeting} 👋</p>
            <h2 className="text-[#20283b] text-2xl font-bold tracking-tight">Sign in to your account</h2>
            <p className="text-[#798397] text-sm mt-1">Enter your details below to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-[#20283b] text-sm font-medium mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-white text-[#20283b] text-sm placeholder:text-[#c2cad6] focus:outline-none focus:border-[#237a59] focus:ring-4 focus:ring-[#237a59]/10 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[#20283b] text-sm font-medium mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[#e2e8f0] bg-white text-[#20283b] text-sm placeholder:text-[#c2cad6] focus:outline-none focus:border-[#237a59] focus:ring-4 focus:ring-[#237a59]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b0bac9] hover:text-[#20283b] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-[#237a59] hover:bg-[#1d6649] active:scale-[0.99] text-white font-semibold rounded-xl text-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#237a59]/25"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : "Sign In"}
            </button>

          </form>

          {/* Footer */}
          <p className="text-center text-xs text-[#c2cad6] mt-8">
            Tulshi Fashion · Billing & Inventory System
          </p>

        </div>
      </div>

    </div>
  );
}
