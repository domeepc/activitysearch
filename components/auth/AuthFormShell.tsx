"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface AuthFormShellProps {
  children: React.ReactNode;
  cardClassName?: string;
  containerClassName?: string;
}

export function AuthFormShell({
  children,
  cardClassName,
  containerClassName,
}: AuthFormShellProps) {
  return (
    <div className="min-h-screen flex">
      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-center items-center bg-[#0D0F16] text-white relative overflow-hidden p-10 xl:p-14">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-3xl" style={{ backgroundColor: "rgba(85,131,243,0.09)" }} />
          <div className="absolute bottom-0 -left-24 w-[380px] h-[380px] rounded-full blur-2xl" style={{ backgroundColor: "rgba(85,131,243,0.06)" }} />
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.04 }}>
            <defs>
              <pattern id="auth-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#auth-grid)" />
          </svg>
          <svg className="absolute top-0 right-0" width="460" height="460" viewBox="0 0 460 460" fill="none" style={{ opacity: 0.05 }}>
            <circle cx="460" cy="0" r="300" stroke="white" strokeWidth="0.7" />
            <circle cx="460" cy="0" r="210" stroke="white" strokeWidth="0.7" />
            <circle cx="460" cy="0" r="120" stroke="white" strokeWidth="0.7" />
            <circle cx="460" cy="0" r="50" stroke="white" strokeWidth="0.7" />
          </svg>
        </div>

        {/* Headline block */}
        <div className="relative z-10 space-y-7 max-w-[300px]">
          <div className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#5583F3" }}>
              Your adventure awaits
            </p>
            <h2
              className="text-[50px] xl:text-[58px] font-light leading-[1.05] text-white"
              style={{ fontFamily: "var(--font-display, Georgia, serif)", letterSpacing: "-0.025em" }}
            >
              Find your<br />
              next great<br />
              <span style={{ color: "#5583F3", fontStyle: "italic" }}>adventure.</span>
            </h2>
          </div>
          <p className="text-[14px] leading-[1.7] max-w-[280px]" style={{ color: "rgba(255,255,255,0.42)" }}>
            Thousands of activities. Trusted organisers. One platform to discover, book, and experience more.
          </p>
          <div className="space-y-3 pt-1 flex flex-col">
            {[
              "Browse curated local activities",
              "Secure booking & instant confirmation",
              "Connect with expert organisers",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#5583F3" }} />
                <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.52)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom mark */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>ActivitySearch © 2025</p>
        </div>
      </div>

      {/* Form panel */}
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center min-h-screen bg-background overflow-y-auto",
          "px-5 py-10 sm:px-8",
          containerClassName
        )}
      >
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2.5 w-full max-w-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mobile-logo.svg" alt="" className="w-7 h-7 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mobile-logo-dark.svg" alt="" className="hidden w-7 h-7 dark:block" />
          <span className="font-semibold text-[15px] tracking-tight">
            Activity<span style={{ color: "#5583F3" }}>Search</span>
          </span>
        </div>

        <div className={cn("w-full max-w-[360px]", cardClassName)}>
          <Card className="border-0 shadow-none bg-transparent p-0 gap-5">
            {children}
          </Card>
        </div>
      </div>
    </div>
  );
}

export const authFormStyles = {
  header: "space-y-1 px-0",
  title: "text-[22px] font-bold tracking-tight",
  description: "text-sm text-muted-foreground mt-0.5",
  content: "space-y-4 px-0",
  footer: "flex flex-col space-y-2.5 px-0 items-start",
  sectionTitle: "text-xs uppercase tracking-widest text-muted-foreground",
  error: "rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive",
};
