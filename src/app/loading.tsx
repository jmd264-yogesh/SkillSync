"use client";

import { LayoutDashboard } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-xs flex flex-col items-center justify-center z-50 animate-fade-in">
      <div className="flex flex-col items-center space-y-4">
        {/* Animated App Logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
          <div className="relative bg-primary p-4 rounded-2xl shadow-lg shadow-primary/20 animate-bounce">
            <LayoutDashboard className="h-9 w-9 text-white" />
          </div>
        </div>
        
        {/* App Title */}
        <div className="text-center">
          <h2 className="text-lg font-black tracking-tight text-primary">SkillSphere</h2>
          <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5 animate-pulse">L&D Platform</p>
        </div>

        {/* Premium Progress Loader */}
        <div className="w-24 h-1 bg-slate-200/60 rounded-full overflow-hidden mt-1">
          <div 
            className="h-full bg-primary rounded-full" 
            style={{
              animation: "loading 1.2s infinite ease-in-out",
              transformOrigin: "left"
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: scaleX(0.1) translateX(-100%); }
          50% { transform: scaleX(0.6) translateX(50%); }
          100% { transform: scaleX(0.1) translateX(400%); }
        }
      `}</style>
    </div>
  );
}
