import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Activity,
  Bot,
  Check,
  ChevronRight,
  Command,
  Crown,
  Database,
  FileImage,
  Gamepad2,
  ImagePlus,
  LayoutDashboard,
  Link2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Settings2,
  Trash2,
  Upload,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { TenantsPage } from "@/components/tenants-page";
import { TenantDetail } from "@/components/tenant-detail";
import { AccountPage } from "@/components/account-page";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Velvet Devil · BempsX" },
      { name: "description", content: "Live operator control centre for Velvet Devil." },
    ],
  }),
  component: ControlCenter,
});

const runtimeBase = import.meta.env.VITE_RUNTIME_API_URL || "";

type Role = "super_admin" | "tenant_owner";
type RuntimeCommand = {
  name: string;
  category?: string;
  description?: string;
};

type RuntimeGroup = {
  id: string;
  groupId: string;
  name: string | null;
  description: string | null;
  memberCount: number;
  adminsCount: number;
  profilePictureUrl: string | null;
  prefix: string;
  rules: string | null;
  theme: string;
  antiLink: boolean;
  antiSpam: boolean;
  welcomeEnabled: boolean;
  goodbyeEnabled: boolean;
  welcomeTemplate: string;
  goodbyeTemplate: string;
  connectionState: string;
};
type RuntimeStatus = {
  status: string;
  connectedJid?: string | null;
  qr?: { dataUrl?: string } | null;
  groupCount?: number;
  ownerConfigured?: boolean;
  lastError?: string | null;
};
type MenuAsset = {
  id: string;
  url: string;
  category: string;
  active: boolean | number;
  usage_count?: number;
  usageCount?: number;
};
type CommandAsset = {
  id: string;
  command_name: string;
  commandName?: string;
  url: string;
  type: string;
  active: boolean | number;
  created_at?: string;
  updated_at?: string;
};

async function apiFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${runtimeBase}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  if (response.status === 401) throw new Error("Authentication required");
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <RefreshCw className="size-6 animate-spin text-primary" />
    </div>
  );
}

function errText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed.";
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onLogin(username, password);
    } catch (err) {
      toast.error("Sign in failed", { description: errText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md border-primary/25">
        <CardHeader>
          <div className="mb-3 flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-primary/40 bg-black shadow-[0_0_22px_rgba(0,212,255,0.22)]">
            <img
              src="/x-icon.png"
              alt="X Bot"
              className="h-full w-full object-cover"
            />
          </div>
          <CardTitle className="font-serif text-3xl">Velvet Devil Control Centre</CardTitle>
          <p className="text-sm text-muted-foreground">
            Local access for the live X WhatsApp runtime.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
            />
            <Button
              className="w-full"
              disabled={busy || !username || !password}
            >
              {busy ? "Signing in…" : "Sign in"}
              <ChevronRight className="size-4" />
            </Button>
          </form>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Velvet Devil · Created by BempsX
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ControlCenter() {
  const [user, setUser] = useState<{
    username: string;
    role?: Role;
    tenantId?: string | null;
  } | null>(null);
  const [role, setRole] = useState<Role>("super_admin");
  const [userTenantId, setUserTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [commands, setCommands] = useState<RuntimeCommand[]>([]);
  const [commandsBusy, setCommandsBusy] = useState(false);
  const [images, setImages] = useState<MenuAsset[]>([]);
  const [cmdAssets, setCmdAssets] = useState<CommandAsset[]>([]);
  const [liveGroups, setLiveGroups] = useState<RuntimeGroup[]>([]);
  const [tab, setTab] = useState("overview");
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>({
    status: "offline",
  });
  const [pairingNumber, setPairingNumber] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [imageCategory, setImageCategory] = useState("X branding");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);

  const load = async () => {
    const [me, cmds, assets, cmdImgs, groups, status] = await Promise.all([
      apiFetch("/api/auth/me"),
      apiFetch("/api/commands", { cache: "no-store" }),
      apiFetch("/api/menu-assets"),
      apiFetch("/api/command-assets"),
      apiFetch("/api/groups"),
      apiFetch("/api/runtime/status"),
    ]);
    setUser(me.user);
    setRole(me.user?.role || "super_admin");
    setUserTenantId(me.user?.tenantId || null);
    setCommands(cmds);
    setImages(assets);
    setCmdAssets(cmdImgs);
    setLiveGroups(groups);
    setRuntimeStatus(status);
  };

  useEffect(() => {
    void load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      try {
        const [status, groups, assets, cmdImgs] = await Promise.all([
          apiFetch("/api/runtime/status"),
          apiFetch("/api/groups"),
          apiFetch("/api/menu-assets"),
          apiFetch("/api/command-assets"),
        ]);
        setRuntimeStatus(status);
        setLiveGroups(groups);
        setImages(assets);
        setCmdAssets(cmdImgs);
      } catch {}
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [user]);

  /*
   * Tenant owners must never land on an admin tab. Reset to
   * "overview" whenever their role/tenant changes and they're
   * somehow on a tab that doesn't exist in ownerNav.
   */
  useEffect(() => {
    if (!user) return;

    if (role === "tenant_owner") {
      const allowedTabs = ["overview", "groups", "account"];
      if (!allowedTabs.includes(tab)) {
        setTab("overview");
      }
    }
  }, [user, role, tab]);

  const activeImage = useMemo(
    () =>
      images.length
        ? images[Math.floor(Date.now() / 15000) % images.length]
        : null,
    [images],
  );

  const connectRuntime = async () => {
    setRuntimeBusy(true);
    try {
      const d = await apiFetch("/api/runtime/connect", { method: "POST" });
      setRuntimeStatus(d);
      toast.success("WhatsApp runtime started");
    } catch (e) {
      toast.error("Could not start runtime", { description: errText(e) });
    } finally {
      setRuntimeBusy(false);
    }
  };

  const reloadCommands = async () => {
    setCommandsBusy(true);
    try {
      const latest = await apiFetch("/api/commands", { cache: "no-store" });
      if (!Array.isArray(latest)) {
        throw new Error("The runtime returned an invalid command list");
      }
      setCommands(latest);
      toast.success(`Loaded ${latest.length} runtime commands`);
    } catch (e) {
      toast.error("Command reload failed", { description: errText(e) });
    } finally {
      setCommandsBusy(false);
    }
  };

  const requestPairing = async () => {
    if (!pairingNumber.trim()) return;
    try {
      const d = await apiFetch("/api/runtime/pairing", {
        method: "POST",
        body: JSON.stringify({ number: pairingNumber }),
      });
      setPairingCode(d.code || "");
      toast.success("Pairing code requested");
    } catch (e) {
      toast.error("Pairing failed", { description: errText(e) });
    }
  };

  const sync = async () => {
    try {
      const d = await apiFetch("/api/runtime/sync", { method: "POST" });
      const me = await apiFetch("/api/auth/me");
      setRole(me.user?.role || "super_admin");
      setUserTenantId(me.user?.tenantId || null);
      setLiveGroups(d.groups || []);
      toast.success(`Synchronized ${d.count || 0} groups`);
    } catch (e) {
      toast.error("Group sync failed", { description: errText(e) });
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);
    const max = 15 * 1024 * 1024;
    const valid = incoming.filter(
      (file) => allowed.has(file.type) && file.size <= max,
    );
    if (valid.length !== incoming.length)
      toast.error("Some files were skipped", {
        description: "Use JPG, PNG, WEBP or GIF images up to 15 MB each.",
      });
    setSelectedFiles(valid);
  };

  const uploadImages = async () => {
    if (!selectedFiles.length) return;
    setUploadBusy(true);
    try {
      const uploaded: MenuAsset[] = [];
      for (const file of selectedFiles) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () =>
            reject(new Error(`Could not read ${file.name}`));
          reader.readAsDataURL(file);
        });
        const d = await apiFetch("/api/menu-assets/upload", {
          method: "POST",
          body: JSON.stringify({ dataUrl, category: imageCategory }),
        });
        uploaded.push(d);
      }
      setImages((prev) => [...uploaded, ...prev]);
      setSelectedFiles([]);
      toast.success(
        `${uploaded.length} menu image${uploaded.length === 1 ? "" : "s"} uploaded`,
      );
    } catch (e) {
      toast.error("Menu image upload failed", { description: errText(e) });
    } finally {
      setUploadBusy(false);
    }
  };

  const login = async (username: string, password: string) => {
    await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const me = await apiFetch("/api/auth/me");
    setUser(me.user);
    setRole(me.user?.role || "super_admin");
    setUserTenantId(me.user?.tenantId || null);
    setTab("overview");
    toast.success("Signed in to Velvet Devil");
  };

  const logout = async () => {
    await fetch(`${runtimeBase}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setUser(null);
    setRole("super_admin");
    setUserTenantId(null);
    setTab("overview");
  };

  if (loading) return <Loading />;
  if (!user) return <LoginScreen onLogin={login} />;

  const isSuperAdmin = role === "super_admin";

  const adminNav = [
    ["overview", LayoutDashboard, "Overview"],
    ["groups", Users, "Groups"],
    ["commands", Command, "Commands"],
    ["games", Gamepad2, "Games"],
    ["ai", Sparkles, "AI"],
    ["menu", ImagePlus, "Menu images"],
    ["cmdimg", Bot, "Command images"],
    ["tenants", Bot, "Tenants"],
    ["account", UserRound, "Account"],
  ] as const;

  const ownerNav = [
    ["overview", Bot, "My Bot"],
    ["groups", Users, "Groups"],
    ["account", UserRound, "Account"],
  ] as const;

  const nav = isSuperAdmin ? adminNav : ownerNav;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/90 px-5 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-2xl border border-primary/40 bg-black shadow-[0_0_18px_rgba(0,212,255,0.2)]">
              <img
                src="/x-icon.png"
                alt="X Bot"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="font-serif text-xl leading-none">
                X{" "}
                <span className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  velvet devil control centre
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isSuperAdmin ? "Admin" : "Tenant"} ·{" "}
                <span className="font-mono text-primary">{user.username}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
              <span
                className={`size-2 rounded-full ${
                  runtimeStatus.status === "connected"
                    ? "bg-primary shadow-[0_0_12px_var(--primary)]"
                    : "bg-muted-foreground"
                }`}
              />
              {runtimeStatus.status}
            </div>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:grid-cols-[210px_1fr] md:px-8">
        <aside className="space-y-1">
          {nav.map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                tab === key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
          <div className="mt-5 rounded-2xl border border-border/70 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Live session</p>
            <p className="mt-1 break-all">
              {runtimeStatus.connectedJid || "Not connected"}
            </p>
            <p className="mt-2">
              {runtimeStatus.groupCount ?? liveGroups.length} synchronized
              groups
            </p>
          </div>
        </aside>

        <main className="min-w-0">
          {/* OVERVIEW — admin sees admin panel, tenant sees their bot detail */}
          {tab === "overview" && isSuperAdmin && (
            <Overview
              status={runtimeStatus}
              groups={liveGroups}
              commands={commands}
              images={images}
              activeImage={activeImage?.url || "/x-menu.png"}
              connect={connectRuntime}
              sync={sync}
              busy={runtimeBusy}
              pairingNumber={pairingNumber}
              setPairingNumber={setPairingNumber}
              pairingCode={pairingCode}
              requestPairing={requestPairing}
            />
          )}
          {tab === "overview" && !isSuperAdmin && userTenantId && (
            <TenantDetail tenantId={userTenantId} />
          )}

          {/* GROUPS — everyone */}
          {tab === "groups" && <Groups groups={liveGroups} />}

          {/* ADMIN-ONLY TABS */}
          {tab === "commands" && isSuperAdmin && (
            <Commands
              commands={commands}
              onReload={reloadCommands}
              reloading={commandsBusy}
            />
          )}
          {tab === "games" && isSuperAdmin && <Games groups={liveGroups} />}
          {tab === "ai" && isSuperAdmin && <AI groups={liveGroups} />}
          {tab === "tenants" && isSuperAdmin && <TenantsPage />}
          {tab === "menu" && isSuperAdmin && (
            <MenuImages
              images={images}
              files={selectedFiles}
              setFiles={setSelectedFiles}
              category={imageCategory}
              setCategory={setImageCategory}
              upload={uploadImages}
              busy={uploadBusy}
              pick={handleFiles}
              preview={activeImage?.url || "/x-menu.png"}
            />
          )}
          {tab === "cmdimg" && isSuperAdmin && (
            <CommandImages
              assets={cmdAssets}
              commands={commands}
              refresh={load}
            />
          )}

          {/* ACCOUNT — everyone */}
          {tab === "account" && <AccountPage onLogout={logout} />}
        </main>
      </div>
    </div>
  );
}

function Overview(p: {
  status: RuntimeStatus;
  groups: RuntimeGroup[];
  commands: RuntimeCommand[];
  images: MenuAsset[];
  activeImage: string;
  connect: () => void;
  sync: () => void;
  busy: boolean;
  pairingNumber: string;
  setPairingNumber: (v: string) => void;
  pairingCode: string;
  requestPairing: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-primary/25 bg-card p-7 md:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">
          production runtime
        </p>
        <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-tight md:text-6xl">
          Run X with live data.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          The dashboard now reads from the real WhatsApp runtime for connection
          state, synchronized groups, members, settings, games and isolated AI
          context.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Users}
          label="Synced groups"
          value={String(p.groups.length)}
          detail="Live WhatsApp groups"
        />
        <Stat
          icon={Command}
          label="Commands"
          value={String(p.commands.length)}
          detail="Runtime registry"
        />
        <Stat
          icon={ImagePlus}
          label="Menu assets"
          value={String(p.images.length)}
          detail="Runtime menu assets"
        />
        <Stat
          icon={ShieldCheck}
          label="Runtime"
          value={p.status.status}
          detail={p.status.connectedJid || "Waiting for WhatsApp"}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-4 text-primary" /> WhatsApp session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={p.connect} disabled={p.busy}>
                {p.busy ? "Starting…" : "Start / reconnect"}
              </Button>
              <Button variant="outline" onClick={p.sync}>
                Sync groups
              </Button>
            </div>
            {p.status.qr?.dataUrl && (
              <div className="rounded-2xl border p-3">
                <img
                  src={p.status.qr.dataUrl}
                  alt="WhatsApp QR"
                  className="mx-auto size-56"
                />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Scan with WhatsApp → Linked devices.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={p.pairingNumber}
                onChange={(e) => p.setPairingNumber(e.target.value)}
                placeholder="233XXXXXXXXX"
              />
              <Button variant="outline" onClick={p.requestPairing}>
                Pair
              </Button>
            </div>
            {p.pairingCode && (
              <p className="rounded-xl bg-muted/30 p-3 text-center font-mono text-lg tracking-[0.3em]">
                {p.pairingCode}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Runtime guarantees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              [
                "WhatsApp transport",
                p.status.status === "connected" ? "Connected" : p.status.status,
                Link2,
              ],
              [
                "Owner verification",
                p.status.ownerConfigured ? "Configured" : "Not configured",
                Crown,
              ],
              ["AI isolation", "Group scoped", Sparkles],
              ["Persistent state", "SQLite WAL", Database],
            ].map(([label, value, Icon]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between rounded-xl border border-border/70 p-3"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Icon className="size-4 text-muted-foreground" />
                  {label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {String(value)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <img
          src={p.activeImage}
          alt="X menu preview"
          className="h-56 w-full object-cover"
        />
        <CardContent className="flex items-center justify-between py-4">
          <p className="text-xs text-muted-foreground">
            The runtime can rotate active X menu assets.
          </p>
          <span className="font-mono text-xs text-primary">.menu</span>
        </CardContent>
      </Card>
    </section>
  );
}

function Groups({ groups }: { groups: RuntimeGroup[] }) {
  const [selected, setSelected] = useState<RuntimeGroup | null>(null);
  return selected ? (
    <GroupDetail group={selected} back={() => setSelected(null)} />
  ) : (
    <section className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          group intelligence
        </p>
        <h1 className="mt-2 font-serif text-4xl">Your groups, isolated.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every group has independent members, settings, economy, games and AI
          context.
        </p>
      </div>
      {groups.length === 0 ? (
        <Empty
          icon={Users}
          title="No synchronized groups"
          text="Connect X and synchronize WhatsApp groups."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <button
              key={g.groupId}
              onClick={() => setSelected(g)}
              className="text-left"
            >
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/40">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-serif text-xl">
                        {g.name || "Unnamed group"}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {g.groupId}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary">
                      {g.connectionState}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-muted/30 p-3">
                      <b className="font-mono text-lg">{g.memberCount}</b>
                      <p className="text-muted-foreground">members</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3">
                      <b className="font-mono text-lg">{g.adminsCount}</b>
                      <p className="text-muted-foreground">admins</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3">
                      <b className="font-mono text-lg">{g.prefix}</b>
                      <p className="text-muted-foreground">prefix</p>
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-2 text-xs text-muted-foreground">
                    {g.description || "No description synchronized."}
                  </p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function GroupDetail({
  group,
  back,
}: {
  group: RuntimeGroup;
  back: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState({
    welcomeEnabled: group.welcomeEnabled,
    goodbyeEnabled: group.goodbyeEnabled,
    welcomeTemplate: group.welcomeTemplate,
    goodbyeTemplate: group.goodbyeTemplate,
    rules: group.rules || "",
    theme: group.theme,
    antiLink: group.antiLink,
    antiSpam: group.antiSpam,
  });

  const load = async () => {
    const r = await fetch(
      `${runtimeBase}/api/groups/${encodeURIComponent(group.groupId)}/context`,
      { credentials: "include" },
    );
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    void load();
  }, [group.groupId]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch(
        `${runtimeBase}/api/groups/${encodeURIComponent(group.groupId)}/settings`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(settings),
        },
      );
      if (!r.ok) throw new Error("Could not save");
      toast.success("Group settings saved");
      await load();
    } catch (e) {
      toast.error("Save failed", { description: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const members = data?.members || [];
  const start = page * 15;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            isolated context
          </p>
          <h1 className="mt-2 font-serif text-4xl">{group.name || "Group"}</h1>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {group.groupId}
          </p>
        </div>
        <Button variant="outline" onClick={back}>
          Back
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          icon={Users}
          label="Members"
          value={String(data?.stats?.members ?? group.memberCount)}
          detail="WhatsApp synchronized"
        />
        <Stat
          icon={ShieldCheck}
          label="Admins"
          value={String(group.adminsCount)}
          detail="Current admins"
        />
        <Stat
          icon={Zap}
          label="XP"
          value={String(data?.stats?.xp ?? 0)}
          detail="Group only"
        />
        <Stat
          icon={Gamepad2}
          label="Active games"
          value={String(data?.games?.length ?? 0)}
          detail="Persistent sessions"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" />
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members.slice(start, start + 15).map((m: any) => (
                <div
                  key={m.jid}
                  className="flex items-center justify-between rounded-xl border border-border/70 p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {m.username || m.display_name || "New member"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-primary">{m.role}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Lv {m.level} · {m.xp} XP · {m.coins} KC
                    </p>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <Empty
                  icon={UserRound}
                  title="No member data"
                  text="Synchronize this group from WhatsApp."
                />
              )}
            </div>
            <div className="mt-4 flex justify-between">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((v) => v - 1)}
              >
                Previous
              </Button>
              <span className="self-center text-xs text-muted-foreground">
                Page {page + 1}
              </span>
              <Button
                variant="outline"
                disabled={start + 15 >= members.length}
                onClick={() => setPage((v) => v + 1)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <Settings2 className="mr-2 inline size-4 text-primary" />
              Group behavior
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle
              label="Welcome"
              value={settings.welcomeEnabled}
              onChange={(v) =>
                setSettings((s) => ({ ...s, welcomeEnabled: v }))
              }
            />
            <Toggle
              label="Goodbye"
              value={settings.goodbyeEnabled}
              onChange={(v) =>
                setSettings((s) => ({ ...s, goodbyeEnabled: v }))
              }
            />
            <Toggle
              label="Anti-link"
              value={settings.antiLink}
              onChange={(v) => setSettings((s) => ({ ...s, antiLink: v }))}
            />
            <Toggle
              label="Anti-spam"
              value={settings.antiSpam}
              onChange={(v) => setSettings((s) => ({ ...s, antiSpam: v }))}
            />
            <Input
              value={settings.welcomeTemplate}
              onChange={(e) =>
                setSettings((s) => ({ ...s, welcomeTemplate: e.target.value }))
              }
              placeholder="Welcome to the velvet room, {user}. 🥀 Leave your ego at the door, or I'll tear it apart."
            />
            <Input
              value={settings.goodbyeTemplate}
              onChange={(e) =>
                setSettings((s) => ({ ...s, goodbyeTemplate: e.target.value }))
              }
              placeholder="Goodbye {user}."
            />
            <Input
              value={settings.rules}
              onChange={(e) =>
                setSettings((s) => ({ ...s, rules: e.target.value }))
              }
              placeholder="Group rules"
            />
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save settings"}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Templates: {"{group}"} {"{count}"} {"{username}"} {"{name}"}{" "}
              {"{user}"}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border/70 p-3 text-sm">
      {label}
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Commands({
  commands,
  onReload,
  reloading,
}: {
  commands: RuntimeCommand[];
  onReload: () => Promise<void>;
  reloading: boolean;
}) {
  const groupedCommands = useMemo(() => {
    const groups = new Map<string, RuntimeCommand[]>();
    for (const command of commands) {
      const category = String(command.category || "other")
        .trim()
        .toLowerCase();
      const entries = groups.get(category);
      if (entries) {
        entries.push(command);
      } else {
        groups.set(category, [command]);
      }
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, entries]) => [
        category,
        entries.sort((a, b) => a.name.localeCompare(b.name)),
      ] as const);
  }, [commands]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            live registry
          </p>
          <h1 className="mt-2 font-serif text-4xl">Commands with guardrails.</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => void onReload()}
          disabled={reloading}
        >
          <RefreshCw className={reloading ? "size-4 animate-spin" : "size-4"} />
          {reloading ? "Reloading..." : "Reload Commands"}
        </Button>
      </div>
      {groupedCommands.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {groupedCommands.map(([category, entries]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="capitalize">
                  {category.replace(/[_-]+/g, " ")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {entries.map((command) => (
                  <div
                    key={command.name}
                    className="rounded-xl border border-border/70 p-3"
                  >
                    <p className="font-mono text-sm text-primary">
                      .{command.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {command.description || "No description provided."}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            No commands are currently registered in the runtime.
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function Games({ groups }: { groups: RuntimeGroup[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.groupId || "");
  const [type, setType] = useState("coinflip");
  const [choice, setChoice] = useState("heads");
  const [result, setResult] = useState("");

  const play = async () => {
    if (!groupId) return;
    const r = await fetch(
      `${runtimeBase}/api/groups/${encodeURIComponent(groupId)}/games/${type}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playerJid: "control-center", choice }),
      },
    );
    const d = await r.json();
    setResult(d.error || JSON.stringify(d, null, 2));
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          group-isolated games
        </p>
        <h1 className="mt-2 font-serif text-4xl">Test dynamic game state.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Game sessions are keyed by group ID, so state never crosses groups.
        </p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-5 md:grid-cols-3">
          <select
            className="rounded-xl border border-border bg-background px-3"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.name || g.groupId}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-border bg-background px-3"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {[
              "coinflip",
              "dice",
              "rps",
              "tictactoe",
              "quiz",
              "wordle",
              "hangman",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <Input
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            placeholder="choice / move"
          />
          <Button onClick={play}>Run game</Button>
        </CardContent>
      </Card>
      {result && (
        <pre className="overflow-auto rounded-2xl border border-border bg-muted/20 p-5 text-xs">
          {result}
        </pre>
      )}
    </section>
  );
}

function AI({ groups }: { groups: RuntimeGroup[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.groupId || "");
  const [prompt, setPrompt] = useState("How many members are in this group?");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    try {
      const r = await fetch(
        `${runtimeBase}/api/groups/${encodeURIComponent(groupId)}/ai`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ prompt }),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "AI request failed");
      setAnswer(`${d.provider} · isolated=${d.isolated}\n\n${d.text}`);
    } catch (e) {
      setAnswer(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          isolated group intelligence
        </p>
        <h1 className="mt-2 font-serif text-4xl">
          Ask X without mixing groups.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The selected group's metadata, members, rules, settings, statistics
          and game state are the only context passed to the provider.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-3 p-5">
          <select
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.name || g.groupId}
              </option>
            ))}
          </select>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about this group…"
          />
          <Button onClick={ask} disabled={busy || !groupId}>
            {busy ? "Thinking…" : "Ask X"}
          </Button>
          {answer && (
            <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-muted/20 p-5 text-sm">
              {answer}
            </pre>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function MenuImages(p: {
  images: MenuAsset[];
  files: File[];
  setFiles: (v: File[]) => void;
  category: string;
  setCategory: (v: string) => void;
  upload: () => void;
  busy: boolean;
  pick: (files: FileList | null) => void;
  preview: string;
}) {
  return (
    <section className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          menu assets
        </p>
        <h1 className="mt-2 font-serif text-4xl">
          Give .menu a real asset pool.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Select wallpaper files directly from your computer. X stores them
          locally and the <span className="font-mono text-primary">.menu</span>{" "}
          command can rotate them automatically.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-5 p-5">
          <label className="group flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center transition hover:border-primary/60 hover:bg-primary/10">
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => {
                p.pick(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <div className="rounded-2xl border border-primary/30 bg-background p-4 shadow-[0_0_25px_rgba(0,212,255,0.12)]">
              <Upload className="size-7 text-primary" />
            </div>
            <p className="mt-3 font-medium">
              Choose wallpapers from your computer
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, WEBP or GIF · up to 15 MB each · multiple files
              supported
            </p>
          </label>
          {p.files.length > 0 && (
            <div className="space-y-2">
              {p.files.map((file) => (
                <div
                  key={`${file.name}-${file.lastModified}`}
                  className="flex items-center gap-3 rounded-xl border border-border/70 p-3"
                >
                  <FileImage className="size-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1048576).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    onClick={() =>
                      p.setFiles(p.files.filter((x) => x !== file))
                    }
                    aria-label={`Remove ${file.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              value={p.category}
              onChange={(e) => p.setCategory(e.target.value)}
              placeholder="Category (e.g. X branding, Anime, Cyberpunk)"
            />
            <Button onClick={p.upload} disabled={p.busy || !p.files.length}>
              {p.busy
                ? "Uploading…"
                : `Upload ${p.files.length || ""} to .menu`}
              <Check className="size-4" />
            </Button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <img
              src={p.preview}
              alt="X menu preview"
              className="h-52 w-full object-cover"
            />
            <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
              Live preview · the runtime will randomly rotate active assets when{" "}
              <span className="font-mono text-primary">.menu</span> is used.
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {p.images.length} menu image{p.images.length === 1 ? "" : "s"}
        </p>
        <Button
          type="button"
          variant="destructive"
          onClick={async () => {
            if (
              !window.confirm("Delete all menu images? This cannot be undone.")
            ) {
              return;
            }
            console.log("Deleting all menu images");
            try {
              const response = await fetch(`${runtimeBase}/api/menu-assets`, {
                method: "DELETE",
                credentials: "include",
              });
              if (response.ok) {
                window.location.reload();
              } else {
                console.error("Menu image deletion failed", response.status);
                window.alert("Failed to delete menu images.");
              }
            } catch (error) {
              console.error(error);
              window.alert("Failed to delete menu images.");
            }
          }}
          disabled={!p.images.length}
        >
          <Trash2 />
          Delete All
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {p.images.map((img) => (
          <Card key={img.id} className="overflow-hidden">
            <img
              src={img.url}
              alt={img.category}
              className="aspect-video w-full object-cover"
            />
            <CardContent className="p-4">
              <p className="font-medium">{img.category}</p>
              <p className="text-xs text-muted-foreground">
                Used {img.usageCount ?? img.usage_count ?? 0} times ·{" "}
                {img.active ? "Active" : "Off"}
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("Delete this image?")) return;
                    console.log("Deleting:", img.id);
                    try {
                      const response = await fetch(
                        `${runtimeBase}/api/menu-assets/${encodeURIComponent(img.id)}`,
                        {
                          method: "DELETE",
                          credentials: "include",
                        },
                      );
                      if (response.ok) {
                        window.location.reload();
                      } else {
                        console.error(
                          "Menu image deletion failed",
                          response.status,
                        );
                        window.alert("Failed to delete image.");
                      }
                    } catch (error) {
                      console.error(error);
                      window.alert("Failed to delete image.");
                    }
                  }}
                  className="rounded-lg p-1 text-xs text-red-500 hover:bg-red-100 hover:text-red-800"
                  aria-label={`Delete ${img.category} menu image`}
                  title="Delete menu image"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!p.images.length && (
          <Empty
            icon={ImagePlus}
            title="No menu assets"
            text="Upload your first wallpaper above to create the .menu rotation pool."
          />
        )}
      </div>
    </section>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Users;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <Icon className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

function CommandImages({
  assets,
  commands,
  refresh,
}: {
  assets: CommandAsset[];
  commands: RuntimeCommand[];
  refresh: () => Promise<void>;
}) {
  const [command, setCommand] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const commandNames = useMemo(() => {
    const names = commands.map((c) => c.name).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [commands]);

  const pick = (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);
    const max = 15 * 1024 * 1024;
    if (!allowed.has(f.type) || f.size > max) {
      toast.error("Invalid file", {
        description: "Use JPG, PNG, WEBP or GIF up to 15 MB.",
      });
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!command.trim() || !file) return;
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
        reader.readAsDataURL(file);
      });

      await apiFetch("/api/command-assets/upload", {
        method: "POST",
        body: JSON.stringify({ command: command.trim(), dataUrl }),
      });

      setFile(null);
      setCommand("");
      await refresh();
      toast.success(`Image set for .${command.trim()}`);
    } catch (e) {
      toast.error("Upload failed", { description: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (cmd: string) => {
    try {
      await apiFetch(`/api/command-assets/${encodeURIComponent(cmd)}`, {
        method: "DELETE",
      });
      await refresh();
      toast.success(`Removed image for .${cmd}`);
    } catch (e) {
      toast.error("Delete failed", { description: errText(e) });
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          command images
        </p>
        <h1 className="mt-2 font-serif text-4xl">A card for every command.</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every command outputs a dossier card by default. Override specific
          commands with your own image here — the runtime will use your custom
          image instead of the generated one.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value.replace(/^\./, ""))}
              placeholder="Command name (e.g. daily, hug, profile)"
            />
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-2 text-sm transition hover:border-primary/60 hover:bg-primary/10">
              <span className="flex items-center gap-2">
                <Upload className="size-4 text-primary" />
                {file ? file.name : "Choose image"}
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  pick(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          {commandNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {commandNames.slice(0, 40).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCommand(n)}
                  className={`rounded-lg border px-2 py-1 font-mono text-[10px] transition ${
                    command === n
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  .{n}
                </button>
              ))}
            </div>
          )}

          <Button onClick={upload} disabled={busy || !command.trim() || !file}>
            {busy ? "Uploading…" : `Set image for .${command.trim() || "…"}`}
            <Check className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((a) => {
          const cmd = a.commandName || a.command_name;
          return (
            <Card key={a.id} className="overflow-hidden">
              <img
                src={a.url}
                alt={cmd}
                className="aspect-video w-full object-cover"
              />
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-mono text-sm text-primary">.{cmd}</p>
                  <p className="text-[10px] text-muted-foreground">{a.type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(cmd)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  aria-label={`Remove ${cmd}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </CardContent>
            </Card>
          );
        })}
        {!assets.length && (
          <Empty
            icon={Bot}
            title="No custom command images"
            text="Every command already returns a generated dossier card. Upload an image above to override a specific command."
          />
        )}
      </div>
    </section>
  );
}