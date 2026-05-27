import { useState } from "react";
import { useNavigate } from "react-router";
import { Lock, User, ArrowRight, Shield, UserCircle, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export function Login() {
  const [role, setRole] = useState<"user" | "admin">("user");
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register({ username, email, password, full_name: fullName });
        navigate("/dashboard");
      } else {
        await login(username, password);
        // Read is_admin from stored user after login
        const stored = localStorage.getItem("user");
        const user = stored ? JSON.parse(stored) : null;
        const isAdmin = user?.is_admin ?? false;
        navigate(isAdmin ? "/admin" : "/dashboard");
      }
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-[#0b1120] border border-[#1e2d45] text-slate-100 placeholder-slate-600 px-4 py-3 pl-11 text-sm focus:outline-none focus:border-amber-500 transition-colors";

  return (
    <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#dde3ee 1px, transparent 1px), linear-gradient(90deg, #dde3ee 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 bg-amber-500 flex items-center justify-center">
              <span className="text-[11px] font-bold text-slate-900 font-mono">SP</span>
            </div>
            <span className="text-slate-300 font-semibold tracking-wider text-sm uppercase">SmartPark</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 leading-tight">
            {isRegister ? "Create account" : "Sign in"}
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-mono">
            {role === "admin" ? "ADMIN ACCESS" : "PARKING MANAGEMENT SYSTEM"}
          </p>
        </div>

        {/* Role toggle — only affects UI hint; actual role comes from backend */}
        <div className="flex border border-[#1e2d45] mb-6">
          <button
            type="button"
            onClick={() => { setRole("user"); setIsRegister(false); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors ${
              role === "user" ? "bg-amber-500 text-slate-900" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <UserCircle className="w-3.5 h-3.5" />User
          </button>
          <button
            type="button"
            onClick={() => { setRole("admin"); setIsRegister(false); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors ${
              role === "admin" ? "bg-amber-500 text-slate-900" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />Admin
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-2.5 mb-4">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span className="text-xs font-mono text-red-400">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input type="text" placeholder="Full name" value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls} />
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input type="email" placeholder="Email address" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls} required />
              </div>
            </>
          )}

          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
              required
              autoComplete="username"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-900 font-semibold py-3 flex items-center justify-center gap-2 transition-colors group text-sm mt-2"
          >
            <span>{loading ? "Signing in…" : isRegister ? "Create Account" : "Sign In"}</span>
            {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
          </button>
        </form>

        {role === "user" && (
          <p className="mt-5 text-center text-xs text-slate-600">
            {isRegister ? "Already have an account? " : "No account? "}
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-amber-500 hover:text-amber-400 transition-colors"
            >
              {isRegister ? "Sign in" : "Register"}
            </button>
          </p>
        )}

        {role === "admin" && (
          <div className="mt-5 border border-[#1e2d45] bg-[#0b1120] px-4 py-3">
            <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
              Sign in with an existing admin account. Admin access is verified by the backend after login.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
