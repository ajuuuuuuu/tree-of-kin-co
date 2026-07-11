import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FamilyTree } from "@/components/family/FamilyTree";
import { PersonDetail } from "@/components/family/PersonDetail";
import { JoinRequestDialog } from "@/components/family/JoinRequestDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MAIN_FAMILY } from "@/lib/family-data";
import { fetchFamily } from "@/lib/family-api";
import { useAuth } from "@/hooks/use-auth";
import { usePresence } from "@/hooks/use-presence";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Family Tree" },
      { name: "description", content: "Explore the interactive family tree." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, role, isFamilyMember, signOut, refreshProfile } = useAuth();
  // Broadcast presence so admins can see who's online
  usePresence({
    userId: user?.id ?? null,
    displayName: profile?.display_name ?? user?.email ?? "Guest",
    role: isAdmin ? "admin" : isFamilyMember ? "family_member" : role === "visitor" ? "visitor" : "new_member",
  });
  const { data, refetch } = useQuery({
    queryKey: ["family"],
    queryFn: fetchFamily,
  });
  const persons = data?.persons ?? [];
  const relationships = data?.relationships ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [branchPersonId, setBranchPersonId] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Auto-highlight the user's own node when they're linked to one
  useEffect(() => {
    if (profile?.person_id) setHighlightId(profile.person_id);
  }, [profile?.person_id]);

  // Log a page visit once per browser session so admins can chart traffic
  useEffect(() => {
    if (typeof window === "undefined") return;
    const KEY = "tw_visit_logged";
    if (sessionStorage.getItem(KEY)) return;
    let visitorId = localStorage.getItem("tw_visitor_id");
    if (!visitorId) {
      visitorId =
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem("tw_visitor_id", visitorId);
    }
    sessionStorage.setItem(KEY, "1");
    supabase.from("page_visits").insert({ visitor_id: visitorId, path: "/" }).then(() => {});
  }, []);

  // Check whether user already has a pending request
  useEffect(() => {
    if (!user) {
      setPendingRequest(false);
      return;
    }
    supabase
      .from("join_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => setPendingRequest(Boolean(data)));
  }, [user]);

  // Immediate relatives (parents, spouses, children) of the highlighted node
  const relatedIds = useMemo(() => {
    if (!highlightId) return new Set<string>();
    const ids = new Set<string>();
    relationships.forEach((r) => {
      if (r.type === "parent") {
        if (r.person2Id === highlightId) ids.add(r.person1Id); // parent
        if (r.person1Id === highlightId) ids.add(r.person2Id); // child
      } else if (r.type === "spouse") {
        if (r.person1Id === highlightId) ids.add(r.person2Id);
        if (r.person2Id === highlightId) ids.add(r.person1Id);
      }
    });
    return ids;
  }, [relationships, highlightId]);

  const mainPersonIds = useMemo(() => {
    const ids = new Set(
      persons.filter((p) => (p.familyGroup ?? MAIN_FAMILY) === MAIN_FAMILY).map((p) => p.id),
    );
    relationships.forEach((r) => {
      if (r.type !== "spouse") return;
      if (ids.has(r.person1Id)) ids.add(r.person2Id);
      if (ids.has(r.person2Id)) ids.add(r.person1Id);
    });
    return ids;
  }, [persons, relationships]);

  const mainPersons = useMemo(
    () => persons.filter((p) => mainPersonIds.has(p.id)),
    [persons, mainPersonIds],
  );
  const mainRelationships = useMemo(
    () =>
      relationships.filter(
        (r) => mainPersonIds.has(r.person1Id) && mainPersonIds.has(r.person2Id),
      ),
    [relationships, mainPersonIds],
  );

  const branchPerson = branchPersonId
    ? persons.find((p) => p.id === branchPersonId) ?? null
    : null;
  const branchGroup = branchPerson?.familyGroup;
  const branchPersons = useMemo(
    () => (branchGroup ? persons.filter((p) => p.familyGroup === branchGroup) : []),
    [persons, branchGroup],
  );
  const branchIds = useMemo(() => new Set(branchPersons.map((p) => p.id)), [branchPersons]);
  const branchRelationships = useMemo(
    () =>
      relationships.filter(
        (r) => branchIds.has(r.person1Id) && branchIds.has(r.person2Id),
      ),
    [relationships, branchIds],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return persons.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [persons, query]);

  const myNode = profile?.person_id
    ? persons.find((p) => p.id === profile.person_id)
    : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="royal-navbar grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-3 sm:flex sm:flex-wrap sm:justify-between sm:gap-6 sm:px-6 sm:py-4 overflow-visible relative">
        {/* Left: Logo and Title */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4 sm:flex-shrink-0">
          {!logoError ? (
            <img
              src="/logo.png"
              alt="Family logo"
              width={96}
              height={96}
              decoding="async"
              fetchPriority="high"
              className="h-12 w-12 shrink-0 rounded-full border-2 border-yellow-600 object-cover sm:h-20 sm:w-20 md:h-24 md:w-24"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-yellow-600 bg-yellow-900/30 text-lg font-semibold text-yellow-500 sm:h-20 sm:w-20 sm:text-2xl md:h-24 md:w-24">
              त
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-yellow-400 pointer-events-none select-none sm:text-xl">तड़ियाल वंश</h1>
            <p className="truncate text-[10px] text-yellow-300/80 flex items-center gap-1 pointer-events-none select-none sm:text-xs">
              {user ? (
                <>
                  <span className="text-yellow-600">🛡️</span>
                  <span>{isAdmin ? "Admin" : isFamilyMember ? "Family member" : role === "visitor" ? "Visitor" : "New member"} • Admin</span>
                </>
              ) : (
                "Guest"
              )}
            </p>
          </div>
        </div>

        {/* Center: Amazon-style search */}
        <div className="relative order-3 col-span-2 w-full sm:order-none sm:flex-1 sm:max-w-md">
          <div className="flex h-11 w-full items-stretch overflow-hidden rounded-md border-2 border-yellow-600 bg-white shadow-md focus-within:border-yellow-400 focus-within:shadow-[0_0_0_3px_rgba(201,169,97,0.35)]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search family members..."
              aria-label="Search family members"
              className="h-full flex-1 rounded-none border-0 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              type="button"
              aria-label="Search"
              className="flex h-full w-12 items-center justify-center bg-gradient-to-b from-yellow-400 to-yellow-500 text-slate-900 transition-colors hover:from-yellow-300 hover:to-yellow-400 active:from-yellow-500 active:to-yellow-600"
            >
              <Search className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
          {matches.length > 0 && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-yellow-600/30 bg-slate-900 shadow-lg">
              {matches.map((p) => (
                <button
                  key={p.id}
                  className="block w-full px-4 py-2 text-left text-sm text-yellow-100 hover:bg-yellow-600/20"
                  onClick={() => {
                    setSelectedId(p.id);
                    setHighlightId(p.id);
                    setQuery("");
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 sm:flex-shrink-0">
          {user && !myNode && (
            <Button
              size="sm"
              disabled={pendingRequest}
              onClick={() => setJoinOpen(true)}
              className="royal-button-outlined select-none"
            >
              {pendingRequest ? "Request pending" : "Add me to the tree"}
            </Button>
          )}
          {myNode && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedId(myNode.id);
                setHighlightId(myNode.id);
              }}
              className="royal-button-outlined select-none"
            >
              My node
            </Button>
          )}
          {isAdmin && (
            <Link to="/admin">
              <Button size="sm" className="royal-button-outlined select-none">
                Admin
              </Button>
            </Link>
          )}
          {user ? (
            <Button size="sm" onClick={signOut} className="royal-button-outlined select-none">
              Sign out
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/auth" })} className="royal-button-outlined select-none">
              Sign in
            </Button>
          )}
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">
        <FamilyTree
          persons={mainPersons}
          relationships={mainRelationships}
          onSelect={(id) => setHighlightId(id)}
          onOpen={(id) => {
            setHighlightId(id);
            setSelectedId(id);
          }}
          highlightId={highlightId}
          relatedIds={relatedIds}
        />
      </main>

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          {selectedId && (
            <PersonDetail
              personId={selectedId}
              persons={persons}
              relationships={relationships}
              isAdmin={isAdmin}
              currentUserPersonId={profile?.person_id ?? null}
              canViewBirthFamily={isAdmin || isFamilyMember || role === "member"}
              currentUserId={user?.id ?? null}
              currentUserName={profile?.display_name ?? ""}
              currentUserEmail={user?.email ?? ""}
              onClose={() => setSelectedId(null)}
              onViewBirthFamily={(id) => {
                setBranchPersonId(id);
                setSelectedId(null);
              }}
              onChanged={() => refetch()}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!branchPerson} onOpenChange={(o) => !o && setBranchPersonId(null)}>
        <DialogContent className="flex h-[80vh] max-w-5xl flex-col p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>
              {branchPerson?.name}'s birth family
              {branchGroup ? ` — the ${capitalize(branchGroup)}s` : ""}
            </DialogTitle>
            <DialogDescription>
              Highlighted within their ancestral family tree.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 w-full">
            {branchPerson && (
              <FamilyTree
                persons={branchPersons}
                relationships={branchRelationships}
                onSelect={() => {}}
                highlightId={branchPerson.id}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {user && (
        <JoinRequestDialog
          open={joinOpen}
          onOpenChange={setJoinOpen}
          persons={persons}
          userId={user.id}
          defaultName={profile?.display_name ?? ""}
          onSubmitted={() => {
            setPendingRequest(true);
            refreshProfile();
          }}
        />
      )}
      {/* Footer */}
      <footer className="royal-footer shrink-0">
        <div className="royal-footer-medallion" aria-hidden="true">
          <div className="royal-footer-shield">🛡️</div>
        </div>
        <div className="royal-footer-inner">
          <span className="royal-footer-flourish left" aria-hidden="true">❦</span>
          <div className="royal-footer-text">Our Roots Make Us Stronger</div>
          <span className="royal-footer-flourish right" aria-hidden="true">❦</span>
        </div>
      </footer>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
