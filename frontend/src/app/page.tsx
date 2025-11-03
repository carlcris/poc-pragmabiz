export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between text-center">
        <h1 className="text-4xl font-bold mb-4">
          ERP System - Sales & Inventory Management
        </h1>
        <p className="text-lg text-muted-foreground">
          Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui
        </p>
        <div className="mt-8 text-sm text-muted-foreground">
          <p>Project initialized successfully! ✅</p>
          <p className="mt-2">Ready to start building Phase 1...</p>
        </div>
      </div>
    </main>
  );
}
