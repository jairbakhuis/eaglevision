import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Coins, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — EagleVision" }] }),
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
      <h1 className="text-2xl font-semibold tracking-tight">More</h1>
      <div className="mt-6 grid gap-3">
        <Button asChild variant="outline" className="h-12 justify-start gap-3">
          <Link to="/documents">
            <FileText className="h-5 w-5" /> Documents
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12 justify-start gap-3">
          <Link to="/credits">
            <Coins className="h-5 w-5" /> Credits
          </Link>
        </Button>
      </div>
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