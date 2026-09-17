import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="h-screen overflow-hidden flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="w-32 h-32 mx-auto mb-3">
            <img src="/logo.png" alt="LifeCare" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-bold text-foreground tracking-tight">LifeCare</span>
            <span className="text-[11px] text-muted-foreground tracking-widest uppercase">Health Management Information System</span>
          </div>
          <div className="mt-5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          </div>
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-4">{footer}</p>
        )}
      </div>
    </div>
  );
}
