import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "./bottom-nav";
import SignOutButton from "./sign-out-button";

export default async function ProtectedLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
        <div className="w-16" />
        <h1 className="text-lg font-semibold text-white">Acupuncture App</h1>
        <div className="w-16 flex justify-end">
          <SignOutButton />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
}
