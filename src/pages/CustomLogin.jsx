import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Eye, EyeOff } from 'lucide-react';


export default function CustomLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkUserAuth, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ employee_id: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const next = searchParams.get('next') || '/';

  useEffect(() => {
    if (isAuthenticated) navigate(next, { replace: true });
  }, [isAuthenticated, navigate, next]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient.auth.login(form.employee_id, form.password);
      await checkUserAuth();
      navigate(next, { replace: true });
    } catch (err) {
      setError(
        err?.data?.detail ||
        err?.message ||
        'Invalid credentials. Please check your Employee ID and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(150deg, #0b3d5e 0%, #0a4a3a 55%, #0d3d5a 100%)" }}
    >
      {/* Decorative radial glows */}
      <div
        className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 65%)" }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 65%)" }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Card */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.35)" }}>

          {/* Branded header */}
          <div
            className="px-8 pt-8 pb-7 text-center"
            style={{ background: "linear-gradient(150deg, #0b3d5e 0%, #0a4a3a 100%)" }}
          >
            {/* Compact emblem: circular crop of the logo icon mark */}
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 shadow-lg ring-2 ring-white/20"
              style={{
                background: "url('/logo.png') center 0% / 200% auto no-repeat white",
              }}
              aria-hidden="true"
            />
            <h1 className="text-[17px] font-bold tracking-tight" style={{ color: "#ffffff" }}>
              LifeCare
            </h1>
            <p className="text-[12px] mt-1 font-medium tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
              Staff Portal
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Employee ID */}
              <div>
                <label
                  htmlFor="employee_id"
                  className="block text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-2"
                >
                  Employee ID
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-[15px] h-[15px] text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </span>
                  <input
                    id="employee_id"
                    type="text"
                    required
                    autoComplete="username"
                    value={form.employee_id}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400
                               focus:outline-none focus:bg-white transition-all"
                    style={{ outline: "none" }}
                    onFocus={e => { e.target.style.borderColor = '#0b3d5e'; e.target.style.boxShadow = '0 0 0 3px rgba(11,61,94,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
                    placeholder="DR001"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-[15px] h-[15px] text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-11 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900
                               focus:outline-none focus:bg-white transition-all"
                    style={{ outline: "none" }}
                    onFocus={e => { e.target.style.borderColor = '#0b3d5e'; e.target.style.boxShadow = '0 0 0 3px rgba(11,61,94,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
                  </svg>
                  <p className="text-sm text-red-700 leading-snug">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-[13.5px] font-semibold text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(150deg, #0b3d5e 0%, #0a4a3a 100%)" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    Sign in
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-5">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            LifeCare Clinical Information System · Secured
          </p>
        </div>
      </div>
    </div>
  );
}
