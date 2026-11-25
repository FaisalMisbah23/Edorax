"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { organizationErrorText, organizationHref } from "@/lib/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrganizationDetail } from "@/shared/api/organizations";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the organisation a name.");
    setBusy(true);
    try {
      const created = await apiFetch<OrganizationDetail>("/api/v1/organizations", { method: "POST", json: { name: name.trim() } });
      router.push(organizationHref(created.id));
    } catch (e) {
      setError(organizationErrorText(e));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Create an organisation</h2>
        <p className="mt-1 text-sm text-muted-foreground">Run classes with your own teachers. You can invite teachers and see every class in one place.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="organization-name">Organisation name</Label>
        <Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="For example, Northside Coding Academy" />
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" loading={busy} disabled={busy}>
        Create organisation
      </Button>
    </form>
  );
}
