import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Atlas" }] }),
});

function SettingsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="text-sm text-muted-foreground">Signed in as</div>
        <div className="mt-1 text-base font-medium">{email}</div>
        <Button onClick={signOut} variant="outline" className="mt-4">
          Sign out
        </Button>
      </div>
    </div>
  );
}