import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonEditor } from "@/components/family/PersonEditor";
import { ChildOrderEditor } from "@/components/family/ChildOrderEditor";
import { SpouseManager } from "@/components/family/SpouseManager";
import {
  addPerson,
  addRelationship,
  deletePerson,
  fetchFamily,
  makeId,
} from "@/lib/family-api";
import { useAuth } from "@/hooks/use-auth";
import { usePresence } from "@/hooks/use-presence";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin dashboard" }] }),
  component: AdminPage,
});

interface JoinRequest {
  id: string;
  user_id: string;
  parent_person_id: string;
  relation: string;
  proposed_name: string;
  proposed_gender: string;
  proposed_birth_date: string | null;
  proposed_photo_url: string | null;
  proposed_biography: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  email: string | null;
  person_id: string | null;
  created_at: string;
}
interface RoleRow { user_id: string; role: "admin" | "member" | "visitor" }
interface SuggestionRow {
  id: string;
  person_id: string;
  message: string;
  submitter_name: string | null;
  submitter_email: string | null;
  status: string;
  created_at: string;
}

function AdminPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [spouseHusbandId, setSpouseHusbandId] = useState<string>("");
  const spouseSectionRef = useRef<HTMLDivElement | null>(null);

  function manageSpousesFor(id: string) {
    setSpouseHusbandId(id);
    setTimeout(() => {
      spouseSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }
  const online = usePresence({
    userId: user?.id ?? null,
    displayName: profile?.display_name ?? user?.email ?? "Admin",
    role: "admin",
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const family = useQuery({ queryKey: ["family"], queryFn: fetchFamily });
  const reqs = useQuery({
    queryKey: ["join_requests"],
    queryFn: async (): Promise<JoinRequest[]> => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as JoinRequest[];
    },
    enabled: isAdmin,
  });

  const profilesQ = useQuery({
    queryKey: ["all_profiles"],
    enabled: isAdmin,
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, person_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
  const rolesQ = useQuery({
    queryKey: ["all_roles"],
    enabled: isAdmin,
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });
  const suggestionsQ = useQuery({
    queryKey: ["suggestions"],
    enabled: isAdmin,
    queryFn: async (): Promise<SuggestionRow[]> => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SuggestionRow[];
    },
  });

  if (loading) return null;
  if (!user) return null;
  if (!isAdmin)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">You don't have admin access.</p>
          <Link to="/"><Button variant="outline" size="sm" className="mt-3">Back to tree</Button></Link>
        </div>
      </div>
    );

  const persons = family.data?.persons ?? [];
  const pending = (reqs.data ?? []).filter((r) => r.status === "pending");
  const decided = (reqs.data ?? []).filter((r) => r.status !== "pending");
  const profiles = profilesQ.data ?? [];
  const allRoles = rolesQ.data ?? [];
  const roleByUser = new Map<string, "admin" | "member" | "visitor">();
  allRoles.forEach((r) => {
    const prev = roleByUser.get(r.user_id);
    // admin > member > visitor precedence
    const rank = { admin: 3, member: 2, visitor: 1 } as const;
    if (!prev || rank[r.role] > rank[prev]) roleByUser.set(r.user_id, r.role);
  });
  const suggestions = suggestionsQ.data ?? [];

  async function changeRole(userId: string, newRole: "admin" | "member" | "visitor") {
    const { error: dErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (dErr) { toast.error(dErr.message); return; }
    const { error: iErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (iErr) { toast.error(iErr.message); return; }
    toast.success("Role updated");
    rolesQ.refetch();
  }

  async function updateSuggestion(id: string, status: string) {
    const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); suggestionsQ.refetch(); }
  }

  async function approve(r: JoinRequest) {
    try {
      const parent = persons.find((p) => p.id === r.parent_person_id);
      const newPerson = await addPerson({
        name: r.proposed_name,
        gender: r.proposed_gender as "male" | "female" | "other",
        birthDate: r.proposed_birth_date ?? undefined,
        photoUrl: r.proposed_photo_url ?? undefined,
        biography: r.proposed_biography ?? undefined,
        familyGroup: parent?.familyGroup ?? "hawthorne",
      });

      if (r.relation === "wife") {
        await addRelationship({
          person1Id: r.parent_person_id,
          person2Id: newPerson.id,
          type: "spouse",
        });
      } else {
        const isParentRole = r.relation === "father" ? false : true;
        await addRelationship({
          person1Id: isParentRole ? r.parent_person_id : newPerson.id,
          person2Id: isParentRole ? newPerson.id : r.parent_person_id,
          type: "parent",
        });
      }
      // Link the requesting user's profile to this new node
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ person_id: newPerson.id })
        .eq("id", r.user_id);
      if (pErr) throw pErr;
      const { error: rErr } = await supabase
        .from("join_requests")
        .update({ status: "approved", decided_at: new Date().toISOString() })
        .eq("id", r.id);
      if (rErr) throw rErr;
      toast.success("Approved — node added to the tree");
      reqs.refetch();
      family.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    }
  }

  async function reject(r: JoinRequest) {
    const note = prompt("Optional note for rejection?") ?? null;
    const { error } = await supabase
      .from("join_requests")
      .update({ status: "rejected", admin_note: note, decided_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Request rejected");
      reqs.refetch();
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex flex-col gap-3 border-b bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-xl font-semibold">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {persons.length} people · {pending.length} pending request{pending.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/"><Button variant="outline" size="sm" className="w-full sm:w-auto">View tree</Button></Link>
          <Button size="sm" onClick={() => setAddOpen(true)} className="w-full sm:w-auto">Add person</Button>
          <Button size="sm" variant="ghost" onClick={() => { signOut(); navigate({ to: "/" }); }} className="w-full sm:w-auto">
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Online now <span className="text-sm font-normal text-muted-foreground">({Object.keys(online).length})</span>
          </h2>
          {Object.keys(online).length === 0 ? (
            <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">No one online.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {Object.values(online).map((p) => (
                <li key={p.user_id} className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span>{p.display_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{p.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Users <span className="text-sm font-normal text-muted-foreground">({profiles.length})</span>
          </h2>
          <div className="overflow-hidden rounded-md border bg-card">
            <div className="hidden text-sm sm:block">
              <table className="w-full">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Online</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => {
                    const r = roleByUser.get(p.id) ?? "visitor";
                    const isFam = !!p.person_id;
                    const status = r === "admin" ? "Admin" : isFam ? "Family member" : r === "member" ? "New member" : "Visitor";
                    const isOnline = !!online[p.id];
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">{p.display_name ?? "(no name)"}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </td>
                        <td className="px-3 py-2"><Badge variant="outline">{status}</Badge></td>
                        <td className="px-3 py-2">
                          <select
                            className="rounded border bg-background px-2 py-1 text-xs"
                            value={r}
                            disabled={p.id === user?.id}
                            onChange={(e) => changeRole(p.id, e.target.value as "admin" | "member" | "visitor")}
                          >
                            <option value="visitor">visitor</option>
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700">
                              <span className="h-2 w-2 rounded-full bg-green-500" /> online
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 sm:hidden">
              {profiles.map((p) => {
                const r = roleByUser.get(p.id) ?? "visitor";
                const isFam = !!p.person_id;
                const status = r === "admin" ? "Admin" : isFam ? "Family member" : r === "member" ? "New member" : "Visitor";
                const isOnline = !!online[p.id];
                return (
                  <div key={p.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{p.display_name ?? "(no name)"}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </div>
                      <Badge variant="outline">{status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <label className="text-xs text-muted-foreground">Role</label>
                      <select
                        className="rounded border bg-background px-2 py-2 text-sm"
                        value={r}
                        disabled={p.id === user?.id}
                        onChange={(e) => changeRole(p.id, e.target.value as "admin" | "member" | "visitor")}
                      >
                        <option value="visitor">visitor</option>
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                      <div className="text-sm">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <span className="h-2 w-2 rounded-full bg-green-500" /> online
                          </span>
                        ) : (
                          <span className="text-muted-foreground">offline</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Suggestions <span className="text-sm font-normal text-muted-foreground">({suggestions.filter(s => s.status === "pending").length} pending)</span>
          </h2>
          {suggestions.length === 0 ? (
            <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">No suggestions yet.</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((s) => {
                const person = persons.find((p) => p.id === s.person_id);
                return (
                  <li key={s.id} className="rounded-md border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{person?.name ?? "(unknown)"}</span>
                      <Badge variant={s.status === "pending" ? "default" : "secondary"}>{s.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()} · {s.submitter_name ?? "Anonymous"}
                        {s.submitter_email ? ` · ${s.submitter_email}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{s.message}</p>
                    {s.status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => updateSuggestion(s.id, "reviewed")}>Mark reviewed</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateSuggestion(s.id, "dismissed")}>Dismiss</Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Pending join requests</h2>
          {pending.length === 0 ? (
            <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
              No pending requests.
            </p>
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => {
                const parent = persons.find((p) => p.id === r.parent_person_id);
                return (
                  <li key={r.id} className="rounded-md border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                      {r.proposed_photo_url ? (
                        <img src={r.proposed_photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                          {r.proposed_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{r.proposed_name}</span>
                          <Badge>{r.relation} of {parent?.name ?? "(unknown)"}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.proposed_gender}
                          {r.proposed_birth_date ? ` · born ${r.proposed_birth_date}` : ""}
                        </p>
                        {r.proposed_biography && (
                          <p className="mt-2 text-sm">{r.proposed_biography}</p>
                        )}
                        {r.message && (
                          <p className="mt-2 rounded bg-muted/50 p-2 text-sm italic">
                            "{r.message}"
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 sm:min-w-36">
                        <Button size="sm" onClick={() => approve(r)} className="w-full sm:w-auto">Approve & add</Button>
                        <Button size="sm" variant="ghost" onClick={() => reject(r)} className="w-full sm:w-auto">Reject</Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {decided.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Recently decided</h2>
            <ul className="space-y-1 text-sm">
              {decided.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded border bg-card px-3 py-2">
                  <span>{r.proposed_name}</span>
                  <Badge variant={r.status === "approved" ? "default" : "secondary"}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section ref={spouseSectionRef}>
          <h2 className="mb-3 text-lg font-semibold">Manage spouses</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Pick a husband, then add wives or drag to reorder. Wife #1 is placed left
            of the husband; wives #2+ are placed to the right in order.
          </p>
          <SpouseManager
            persons={persons}
            relationships={family.data?.relationships ?? []}
            initialHusbandId={spouseHusbandId}
            onSaved={() => family.refetch()}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Reorder children</h2>
          <p className="mb-2 text-xs text-muted-foreground">Pick a parent, then drag children to change their order in the tree.</p>
          <ChildOrderEditor
            persons={persons}
            relationships={family.data?.relationships ?? []}
            onSaved={() => family.refetch()}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">People in the tree</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {persons.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-md border bg-card p-3">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.birthDate?.slice(0, 4) || "?"} – {p.deathDate?.slice(0, 4) || ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  {p.gender === "male" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => manageSpousesFor(p.id)}
                    >
                      Wives
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm(`Delete ${p.name}?`)) return;
                      try {
                        await deletePerson(p.id);
                        toast.success("Deleted");
                        family.refetch();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>


      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
          </DialogHeader>
          <PersonEditor
            onCancel={() => setAddOpen(false)}
            onSubmit={async (data) => {
              try {
                await addPerson(data);
                toast.success("Person added");
                family.refetch();
                setAddOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// silence unused
void makeId;
