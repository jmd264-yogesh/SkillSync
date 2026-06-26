export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary relative overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-20 -left-20 h-72 w-72 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 h-48 w-48 rounded-full bg-white/5 blur-xl" />
          <div className="absolute bottom-40 left-20 h-24 w-24 rounded-2xl rotate-45 bg-white/5" />
          <div className="absolute top-40 right-20 h-16 w-16 rounded-xl rotate-12 bg-white/10" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-2xl font-bold tracking-tight">Skill Matrix</span>
            </div>
            {/* <p className="text-white/60 text-sm">Management Platform</p> */}
          </div>

          <div className="space-y-8">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
              Unlock your team&apos;s 
              <span className="text-white/90 ml-2">full potential.</span>
            </h1>

            <div className="space-y-5">
              {[
                { title: "Skill Tracking", desc: "Standardized inventory across your entire organization" },
                { title: "Gap Analysis", desc: "Identify and close competency gaps with precision" },
                { title: "Career Growth", desc: "Personalized transition paths and learning journeys" },
                { title: "Talent Discovery", desc: "Find the right people for the right roles instantly" },
              ].map((f, i) => (
                <div key={f.title} className="flex items-start gap-4 animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="mt-0.5 h-8 w-8 rounded-sm bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 text-sm font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{f.title}</p>
                    <p className="text-white/50 text-sm">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/30 text-xs">&copy; 2026 Skill Matrix. Enterprise Edition.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50 gradient-mesh">
        {children}
      </div>
    </div>
  );
}
