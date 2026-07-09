import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, clearAuth, getStoredUser, getToken } from "@/lib/admin-api";
import { LogOut, Users, ImageIcon, Tag, Layers, Pencil, Trash2, Plus, X, Shield, Upload, Loader2, Sparkles, MapPin, Cpu, Search, Check } from "lucide-react";

type Tab = "users" | "orders" | "tariffs" | "styles" | "services" | "locations" | "ai";

interface UserRow {
  id: string; email: string; name: string; role: string; isBlocked: boolean;
  balance: number; totalSpent: number; createdAt: string; lastLogin: string | null;
}
interface OrderRow {
  id: string; userId: string | null; userEmail: string | null;
  styleId: string | null; styleTitle: string | null;
  serviceKey: string | null; serviceTitle: string | null; locationName: string | null;
  status: string; amount: number; createdAt: string; completedAt: string | null;
}
interface ServiceRow {
  key: string; title: string; shortDescription: string; fullDescription: string;
  prompt: string; previewImageUrl: string; price: number;
  photosMin: number; photosMax: number; generationTime: number;
  isActive: boolean; accentFrom: string; accentTo: string; badge: string;
}
interface LocationRow {
  id: string; serviceKey: string; name: string; previewImageUrl: string;
  promptFragment: string; prompts: string[]; sortOrder: number; isActive: boolean;
}
interface TariffRow {
  id: string; name: string; description: string; price: number;
  generationsIncluded: number; isActive: boolean; sortOrder: number;
}
interface StyleRow {
  id: string; title: string; shortDescription: string; fullDescription: string;
  prompt: string;
  category: string; price: number; previewImageUrl: string; referencePhotoUrl: string; exampleImages: string[];
  generationTime: number; rating: number; isActive: boolean; sortOrder: number; ordersCount: number;
  photosRequired: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("users");
  const user = getStoredUser();

  useEffect(() => {
    if (!getToken() || user?.role !== "admin") {
      setLocation("/admin/login");
    }
  }, [setLocation, user]);

  function logout() {
    clearAuth();
    setLocation("/admin/login");
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
    { id: "users", label: "Пользователи", icon: Users },
    { id: "orders", label: "Генерации", icon: ImageIcon },
    { id: "tariffs", label: "Тарифы", icon: Tag },
    { id: "styles", label: "Стили", icon: Layers },
    { id: "services", label: "Услуги", icon: Sparkles },
    { id: "locations", label: "Локации", icon: MapPin },
    { id: "ai", label: "ИИ-модели", icon: Cpu },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white">Админ</div>
              <div className="text-xs text-muted-foreground">PhotoGen AI</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-gradient-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border space-y-2">
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          <Button variant="ghost" onClick={logout} className="w-full justify-start text-muted-foreground hover:text-white">
            <LogOut size={16} className="mr-2" /> Выйти
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {tab === "users" && <UsersTab />}
          {tab === "orders" && <OrdersTab />}
          {tab === "tariffs" && <TariffsTab />}
          {tab === "styles" && <StylesTab />}
          {tab === "services" && <ServicesTab />}
          {tab === "locations" && <LocationsTab />}
          {tab === "ai" && <AiModelsTab />}
        </div>
      </main>
    </div>
  );
}

// ===== Users Tab =====
function UsersTab() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await apiFetch<UserRow[]>("/admin/users")); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onDelete(id: string) {
    if (!confirm("Удалить пользователя?")) return;
    await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white">Пользователи</h2>
        <div className="text-sm text-muted-foreground">Всего: {rows?.length ?? "..."}</div>
      </div>
      {error && <div className="text-red-400 mb-4">{error}</div>}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Имя</th>
              <th className="px-4 py-3 text-left">Роль</th>
              <th className="px-4 py-3 text-right">Баланс</th>
              <th className="px-4 py-3 text-right">Потрачено</th>
              <th className="px-4 py-3 text-left">Регистрация</th>
              <th className="px-4 py-3 text-left">Последний вход</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-white/5">
                <td className="px-4 py-3 text-white">{u.email}</td>
                <td className="px-4 py-3">{u.name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${u.role === "admin" ? "bg-[#7C3AED]/20 text-[#7C3AED]" : "bg-secondary"}`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-right text-white">{u.balance.toFixed(2)} ₽</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{u.totalSpent.toFixed(2)} ₽</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(u.lastLogin)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(u)} className="text-muted-foreground hover:text-white p-1" title="Редактировать"><Pencil size={16} /></button>
                  <button onClick={() => onDelete(u.id)} className="text-muted-foreground hover:text-red-400 p-1 ml-1" title="Удалить"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Нет пользователей</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && <UserEditModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function UserEditModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user.role);
  const [balance, setBalance] = useState(String(user.balance));
  const [totalSpent, setTotalSpent] = useState(String(user.totalSpent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const body: Record<string, unknown> = { email, name, role, balance: Number(balance), totalSpent: Number(totalSpent) };
      if (password) body.password = password;
      await apiFetch(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return <Modal title="Редактировать пользователя" onClose={onClose}>
    <div className="space-y-4">
      <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary border-border text-white" /></Field>
      <Field label="Имя"><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border text-white" /></Field>
      <Field label="Новый пароль (оставь пустым чтобы не менять)"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary border-border text-white" /></Field>
      <Field label="Роль">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-white">
          <option value="user">user</option><option value="admin">admin</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Баланс, ₽"><Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className="bg-secondary border-border text-white" /></Field>
        <Field label="Потрачено, ₽"><Input type="number" step="0.01" value={totalSpent} onChange={(e) => setTotalSpent(e.target.value)} className="bg-secondary border-border text-white" /></Field>
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-white border-0">{saving ? "Сохранение..." : "Сохранить"}</Button>
      </div>
    </div>
  </Modal>;
}

// ===== Orders Tab =====
function OrdersTab() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  useEffect(() => { apiFetch<OrderRow[]>("/admin/orders").then(setRows).catch(() => setRows([])); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white">Генерации пользователей</h2>
        <div className="text-sm text-muted-foreground">Всего: {rows?.length ?? "..."}</div>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Пользователь</th>
              <th className="px-4 py-3 text-left">Стиль / Услуга</th>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3 text-left">Создано</th>
              <th className="px-4 py-3 text-left">Завершено</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((o) => (
              <tr key={o.id} className="border-t border-border hover:bg-white/5">
                <td className="px-4 py-3 text-white">{o.userEmail ?? "—"}</td>
                <td className="px-4 py-3">
                  {o.serviceTitle ? (
                    <span>
                      <span className="text-[#EC4899]">⚡</span> {o.serviceTitle}
                      {o.locationName && <span className="text-muted-foreground"> · {o.locationName}</span>}
                    </span>
                  ) : (o.styleTitle ?? "—")}
                </td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-secondary">{o.status}</span></td>
                <td className="px-4 py-3 text-right">{o.amount.toFixed(2)} ₽</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(o.completedAt)}</td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Пока нет генераций</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Tariffs Tab =====
function TariffsTab() {
  const [rows, setRows] = useState<TariffRow[] | null>(null);
  const [editing, setEditing] = useState<Partial<TariffRow> | null>(null);

  const load = useCallback(async () => {
    setRows(await apiFetch<TariffRow[]>("/admin/tariffs"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onDelete(id: string) {
    if (!confirm("Удалить тариф?")) return;
    await apiFetch(`/admin/tariffs/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white">Тарифы</h2>
        <Button onClick={() => setEditing({ name: "", description: "", price: 0, generationsIncluded: 1, isActive: true, sortOrder: (rows?.length ?? 0) + 1 })} className="bg-gradient-primary text-white border-0"><Plus size={16} className="mr-2" /> Добавить тариф</Button>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Название</th>
              <th className="px-4 py-3 text-left">Описание</th>
              <th className="px-4 py-3 text-right">Цена</th>
              <th className="px-4 py-3 text-right">Генераций</th>
              <th className="px-4 py-3 text-center">Активен</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-white/5">
                <td className="px-4 py-3 text-white font-medium">{t.name}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-md truncate">{t.description}</td>
                <td className="px-4 py-3 text-right text-white">{t.price.toFixed(2)} ₽</td>
                <td className="px-4 py-3 text-right">{t.generationsIncluded}</td>
                <td className="px-4 py-3 text-center">{t.isActive ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(t)} className="text-muted-foreground hover:text-white p-1"><Pencil size={16} /></button>
                  <button onClick={() => onDelete(t.id)} className="text-muted-foreground hover:text-red-400 p-1 ml-1"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Пока нет тарифов — нажми "Добавить тариф"</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && <TariffEditModal tariff={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function TariffEditModal({ tariff, onClose, onSaved }: { tariff: Partial<TariffRow>; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tariff.name ?? "");
  const [description, setDescription] = useState(tariff.description ?? "");
  const [price, setPrice] = useState(String(tariff.price ?? 0));
  const [gens, setGens] = useState(String(tariff.generationsIncluded ?? 1));
  const [isActive, setIsActive] = useState(tariff.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(tariff.sortOrder ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const body = { name, description, price: Number(price), generationsIncluded: Number(gens), isActive, sortOrder: Number(sortOrder) };
      if (tariff.id) await apiFetch(`/admin/tariffs/${tariff.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await apiFetch("/admin/tariffs", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return <Modal title={tariff.id ? "Редактировать тариф" : "Новый тариф"} onClose={onClose}>
    <div className="space-y-4">
      <Field label="Название"><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border text-white" /></Field>
      <Field label="Описание"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-secondary border-border text-white" rows={3} /></Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Цена, ₽"><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-secondary border-border text-white" /></Field>
        <Field label="Генераций"><Input type="number" value={gens} onChange={(e) => setGens(e.target.value)} className="bg-secondary border-border text-white" /></Field>
        <Field label="Порядок"><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="bg-secondary border-border text-white" /></Field>
      </div>
      <label className="flex items-center gap-2 text-white">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Активен
      </label>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-white border-0">{saving ? "Сохранение..." : "Сохранить"}</Button>
      </div>
    </div>
  </Modal>;
}

// ===== Styles Tab =====
function StylesTab() {
  const [rows, setRows] = useState<StyleRow[] | null>(null);
  const [editing, setEditing] = useState<Partial<StyleRow> | null>(null);

  const load = useCallback(async () => {
    setRows(await apiFetch<StyleRow[]>("/admin/styles"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onDelete(id: string) {
    if (!confirm("Удалить стиль?")) return;
    await apiFetch(`/admin/styles/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white">Стили генерации</h2>
          <p className="text-sm text-muted-foreground mt-1">Стили показываются в каталоге в порядке поля «Порядок»</p>
        </div>
        <Button onClick={() => setEditing({ title: "", shortDescription: "", fullDescription: "", prompt: "", category: "Портрет", price: 0, previewImageUrl: "", exampleImages: [], generationTime: 60, rating: 4.9, isActive: true, ordersCount: 0, photosRequired: 1 })} className="bg-gradient-primary text-white border-0"><Plus size={16} className="mr-2" /> Добавить стиль</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {rows?.map((s) => (
          <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="aspect-[4/3] bg-secondary relative">
              {s.previewImageUrl && <img src={s.previewImageUrl} alt={s.title} className="w-full h-full object-cover" />}
              <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-xs text-white">#{s.sortOrder}</div>
              {!s.isActive && <div className="absolute top-2 right-2 bg-red-500/80 px-2 py-0.5 rounded text-xs text-white">Скрыт</div>}
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-bold text-white">{s.title}</h3>
                  <div className="text-xs text-muted-foreground">{s.category}</div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">{s.price.toFixed(2)} ₽</div>
                  <div className="text-xs text-muted-foreground">⭐ {s.rating.toFixed(1)}</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{s.shortDescription}</p>
              <div className="mt-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(s)} className="flex-1 border-border"><Pencil size={14} className="mr-1" /> Изменить</Button>
                <Button variant="outline" size="sm" onClick={() => onDelete(s.id)} className="border-border text-red-400 hover:text-red-300"><Trash2 size={14} /></Button>
              </div>
            </div>
          </div>
        ))}
        {rows && rows.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Пока нет стилей</div>}
      </div>
      {editing && <StyleEditModal style={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function StyleEditModal({ style, onClose, onSaved }: { style: Partial<StyleRow>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: style.title ?? "",
    shortDescription: style.shortDescription ?? "",
    fullDescription: style.fullDescription ?? "",
    prompt: style.prompt ?? "",
    category: style.category ?? "Портрет",
    price: String(style.price ?? 0),
    previewImageUrl: style.previewImageUrl ?? "",
    referencePhotoUrl: style.referencePhotoUrl ?? "",
    exampleImages: (style.exampleImages ?? []).join("\n"),
    generationTime: String(style.generationTime ?? 60),
    rating: String(style.rating ?? 4.9),
    isActive: style.isActive ?? true,
    sortOrder: String(style.sortOrder ?? 0),
    ordersCount: String(style.ordersCount ?? 0),
    photosRequired: (style.photosRequired ?? 1) as 1 | 2 | 3,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [idea, setIdea] = useState("");
  const [assisting, setAssisting] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "generating" | "done" | "failed">("idle");

  function upd<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function pollPreview(taskId: string): Promise<void> {
    setPreviewStatus("generating");
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const r = await apiFetch<{ status: string; previewImageUrl?: string; error?: string }>(
          `/admin/styles/assist/image/${taskId}`,
        );
        if (r.status === "success" && r.previewImageUrl) {
          upd("previewImageUrl", r.previewImageUrl);
          setPreviewStatus("done");
          return;
        }
        if (r.status === "failed") {
          setPreviewStatus("failed");
          return;
        }
      } catch {
        /* keep polling */
      }
    }
    setPreviewStatus("failed");
  }

  async function runAssist() {
    if (idea.trim().length < 3) {
      setAssistError("Опишите идею стиля");
      return;
    }
    setAssisting(true);
    setAssistError(null);
    setPreviewStatus("idle");
    try {
      const r = await apiFetch<{
        title: string;
        shortDescription: string;
        fullDescription: string;
        category: string;
        prompt: string;
        price: number;
        imageTaskId: string | null;
      }>("/admin/styles/assist", { method: "POST", body: JSON.stringify({ idea, referencePhotoUrl: form.referencePhotoUrl || undefined }) });
      setForm((f) => ({
        ...f,
        title: r.title,
        shortDescription: r.shortDescription,
        fullDescription: r.fullDescription,
        category: r.category,
        prompt: r.prompt,
        price: String(r.price),
      }));
      if (r.imageTaskId) {
        void pollPreview(r.imageTaskId);
      } else {
        setPreviewStatus("failed");
      }
    } catch (e) {
      setAssistError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssisting(false);
    }
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        shortDescription: form.shortDescription,
        fullDescription: form.fullDescription,
        prompt: form.prompt,
        category: form.category,
        price: Number(form.price),
        previewImageUrl: form.previewImageUrl,
        referencePhotoUrl: form.referencePhotoUrl,
        exampleImages: form.exampleImages.split("\n").map((s) => s.trim()).filter(Boolean),
        generationTime: Number(form.generationTime),
        rating: Number(form.rating),
        isActive: form.isActive,
        ordersCount: Number(form.ordersCount),
        photosRequired: Number(form.photosRequired),
      };
      if (style.id) {
        body.sortOrder = Number(form.sortOrder);
        await apiFetch(`/admin/styles/${style.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        if (form.sortOrder && Number(form.sortOrder) > 0) body.sortOrder = Number(form.sortOrder);
        await apiFetch("/admin/styles", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return <Modal title={style.id ? "Редактировать стиль" : "Новый стиль"} onClose={onClose} wide>
    <div className="space-y-4">
      <div className="rounded-xl border border-[#7C3AED]/40 bg-[#7C3AED]/10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[#A78BFA]" />
          <span className="font-semibold text-white">AI-помощник</span>
          <span className="text-xs text-muted-foreground">опишите идею — заполнит карточку и создаст превью</span>
        </div>
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={3}
          placeholder="Например: деловой портрет в современном офисе, мягкий свет, строгий костюм, уверенный образ для LinkedIn"
          className="bg-secondary border-border text-white"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            type="button"
            onClick={runAssist}
            disabled={assisting}
            className="bg-gradient-primary text-white border-0"
          >
            {assisting ? "Генерация..." : "Сгенерировать с ИИ"}
          </Button>
          {previewStatus === "generating" && (
            <span className="text-sm text-[#A78BFA] flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" /> Создаю превью-фото...
            </span>
          )}
          {previewStatus === "done" && <span className="text-sm text-emerald-400">Превью готово ✓</span>}
          {previewStatus === "failed" && (
            <span className="text-sm text-amber-400">Превью не удалось — загрузите фото вручную ниже</span>
          )}
        </div>
        {assistError && <div className="text-sm text-red-400">{assistError}</div>}
        <div className="pt-2 border-t border-[#7C3AED]/20">
          <div className="text-sm font-medium text-white mb-1">Фото-референс (по желанию)</div>
          <div className="text-xs text-muted-foreground mb-2">
            Если загрузить фото, превью будет сгенерировано на его основе. Фото сохраняется и используется постоянно — удаляется только кнопкой «Удалить».
          </div>
          <PreviewUploader value={form.referencePhotoUrl} onChange={(url) => upd("referencePhotoUrl", url)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Название"><Input value={form.title} onChange={(e) => upd("title", e.target.value)} className="bg-secondary border-border text-white" /></Field>
        <Field label="Категория (тег)"><Input value={form.category} onChange={(e) => upd("category", e.target.value)} placeholder="Портрет / Арт / Бизнес / ..." className="bg-secondary border-border text-white" /></Field>
      </div>
      <Field label="Краткое описание"><Input value={form.shortDescription} onChange={(e) => upd("shortDescription", e.target.value)} className="bg-secondary border-border text-white" /></Field>
      <Field label="Полное описание"><Textarea value={form.fullDescription} onChange={(e) => upd("fullDescription", e.target.value)} rows={4} className="bg-secondary border-border text-white" /></Field>
      <Field label="Промпт для генерации (используется нейросетью)">
        <Textarea value={form.prompt} onChange={(e) => upd("prompt", e.target.value)} rows={4} placeholder="A professional studio portrait, soft lighting, sharp focus, 8k..." className="bg-secondary border-border text-white font-mono text-xs" />
      </Field>
      <Field label="Сколько фотографий загружает пользователь">
        <div className="flex gap-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => upd("photosRequired", n as 1 | 2 | 3)}
              className={`flex-1 h-12 rounded-lg border font-semibold transition-all ${
                form.photosRequired === n
                  ? "bg-gradient-primary text-white border-transparent shadow-[0_0_15px_rgba(124,58,237,0.4)]"
                  : "bg-secondary border-border text-muted-foreground hover:text-white hover:border-[#7C3AED]/50"
              }`}
            >
              {n} {n === 1 ? "фото" : "фото"}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Превью-фотография">
        <PreviewUploader value={form.previewImageUrl} onChange={(url) => upd("previewImageUrl", url)} />
      </Field>
      <Field label="Дополнительные фото (примеры результата)">
        <MultiImageUploader
          value={form.exampleImages.split("\n").map((s) => s.trim()).filter(Boolean)}
          onChange={(arr) => upd("exampleImages", arr.join("\n"))}
        />
      </Field>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Стоимость, ₽"><Input type="number" step="0.01" value={form.price} onChange={(e) => upd("price", e.target.value)} className="bg-secondary border-border text-white" /></Field>
        <Field label="Время, сек"><Input type="number" value={form.generationTime} onChange={(e) => upd("generationTime", e.target.value)} className="bg-secondary border-border text-white" /></Field>
        <Field label="Рейтинг"><Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => upd("rating", e.target.value)} className="bg-secondary border-border text-white" /></Field>
        <Field label="Порядок"><Input type="number" value={form.sortOrder} onChange={(e) => upd("sortOrder", e.target.value)} className="bg-secondary border-border text-white" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Кол-во заказов (отображается)"><Input type="number" value={form.ordersCount} onChange={(e) => upd("ordersCount", e.target.value)} className="bg-secondary border-border text-white" /></Field>
        <label className="flex items-end gap-2 text-white pb-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => upd("isActive", e.target.checked)} /> Показывать в каталоге
        </label>
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-white border-0">{saving ? "Сохранение..." : "Сохранить"}</Button>
      </div>
    </div>
  </Modal>;
}

// ===== Shared UI =====
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-card border border-border rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-auto`}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-border bg-card">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-white text-sm mb-1.5 block">{label}</Label>{children}</div>;
}

async function uploadFiles(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const token = getToken();
  const res = await fetch("/api/admin/uploads", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const b = await res.json(); if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const data = (await res.json()) as { urls: string[] };
  return data.urls;
}

function PreviewUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(f: File | null) {
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      const [url] = await uploadFiles([f]);
      if (url) onChange(url);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex items-start gap-4">
      <div className="w-32 h-32 rounded-xl border border-border bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={32} className="text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <label className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-secondary border border-border text-white text-sm font-medium cursor-pointer hover:border-[#7C3AED]/50 transition-colors">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {busy ? "Загрузка..." : value ? "Заменить фото" : "Загрузить фото"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; void pick(f); }}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400"
          >
            <Trash2 size={12} /> Удалить
          </button>
        )}
        {err && <div className="text-xs text-red-400">{err}</div>}
        <div className="text-xs text-muted-foreground">JPG / PNG / WebP / GIF, до 10 МБ</div>
      </div>
    </div>
  );
}

function MultiImageUploader({ value, onChange }: { value: string[]; onChange: (arr: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true); setErr(null);
    try {
      const urls = await uploadFiles(Array.from(files));
      onChange([...value, ...urls]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  function removeAt(i: number) {
    const next = value.slice(); next.splice(i, 1); onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {value.map((url, i) => (
          <div key={`${url}-${i}`} className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-secondary">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
              aria-label="Удалить"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <label className="aspect-square rounded-xl border-2 border-dashed border-border bg-secondary/30 hover:border-[#7C3AED]/50 hover:bg-secondary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-white cursor-pointer transition-all">
          {busy ? <Loader2 size={24} className="animate-spin text-[#7C3AED]" /> : <Plus size={24} />}
          <span className="text-xs font-medium">{busy ? "Загрузка..." : "Добавить"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => { const fs = e.target.files; e.target.value = ""; void pick(fs); }}
          />
        </label>
      </div>
      {err && <div className="text-xs text-red-400">{err}</div>}
      <div className="text-xs text-muted-foreground">Можно выбрать несколько файлов сразу</div>
    </div>
  );
}

// ===== Services tab =====
function ServicesTab() {
  const [rows, setRows] = useState<ServiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await apiFetch<ServiceRow[]>("/admin/services")); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <div className="text-red-400">{error}</div>;
  if (!rows) return <div className="text-muted-foreground">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Услуги</h1>
        <p className="text-sm text-muted-foreground">Две предзаполненные услуги — редактируйте параметры и превью.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {rows.map((s) => <ServiceCard key={s.key} initial={s} onSaved={load} />)}
      </div>
    </div>
  );
}

function ServiceCard({ initial, onSaved }: { initial: ServiceRow; onSaved: () => void }) {
  const [form, setForm] = useState<ServiceRow>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  useEffect(() => { setForm(initial); }, [initial]);

  function upd<K extends keyof ServiceRow>(k: K, v: ServiceRow[K]) { setForm((p) => ({ ...p, [k]: v })); }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      await apiFetch(`/admin/services/${form.key}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          shortDescription: form.shortDescription,
          fullDescription: form.fullDescription,
          prompt: form.prompt,
          previewImageUrl: form.previewImageUrl,
          price: Number(form.price),
          photosMin: Number(form.photosMin),
          photosMax: Number(form.photosMax),
          generationTime: Number(form.generationTime),
          isActive: form.isActive,
          accentFrom: form.accentFrom,
          accentTo: form.accentTo,
          badge: form.badge,
        }),
      });
      setMsg({ kind: "ok", text: "Сохранено" });
      onSaved();
    } catch (e) { setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) }); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{form.key}</div>
          <h3 className="text-xl font-bold text-white">{form.title}</h3>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={form.isActive} onChange={(e) => upd("isActive", e.target.checked)} /> Активна
        </label>
      </div>

      <PreviewUploader value={form.previewImageUrl} onChange={(url) => upd("previewImageUrl", url)} />

      <div>
        <Label className="text-white text-sm">Название</Label>
        <Input value={form.title} onChange={(e) => upd("title", e.target.value)} className="mt-1 bg-secondary border-border text-white" />
      </div>
      <div>
        <Label className="text-white text-sm">Короткое описание</Label>
        <Input value={form.shortDescription} onChange={(e) => upd("shortDescription", e.target.value)} className="mt-1 bg-secondary border-border text-white" />
      </div>
      <div>
        <Label className="text-white text-sm">Полное описание</Label>
        <Textarea value={form.fullDescription} onChange={(e) => upd("fullDescription", e.target.value)} className="mt-1 bg-secondary border-border text-white" rows={3} />
      </div>
      <div>
        <Label className="text-white text-sm">Промпт (на английском, для kie)</Label>
        <Textarea value={form.prompt} onChange={(e) => upd("prompt", e.target.value)} className="mt-1 bg-secondary border-border text-white font-mono text-xs" rows={4} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-white text-sm">Цена, ₽</Label>
          <Input type="number" min={0} value={form.price} onChange={(e) => upd("price", Number(e.target.value))} className="mt-1 bg-secondary border-border text-white" />
        </div>
        <div>
          <Label className="text-white text-sm">Время, сек</Label>
          <Input type="number" min={1} value={form.generationTime} onChange={(e) => upd("generationTime", Number(e.target.value))} className="mt-1 bg-secondary border-border text-white" />
        </div>
        <div>
          <Label className="text-white text-sm">Фото мин.</Label>
          <Input type="number" min={1} max={10} value={form.photosMin} onChange={(e) => upd("photosMin", Number(e.target.value))} className="mt-1 bg-secondary border-border text-white" />
        </div>
        <div>
          <Label className="text-white text-sm">Фото макс.</Label>
          <Input type="number" min={1} max={10} value={form.photosMax} onChange={(e) => upd("photosMax", Number(e.target.value))} className="mt-1 bg-secondary border-border text-white" />
        </div>
        <div>
          <Label className="text-white text-sm">Акцент от</Label>
          <Input value={form.accentFrom} onChange={(e) => upd("accentFrom", e.target.value)} className="mt-1 bg-secondary border-border text-white font-mono" />
        </div>
        <div>
          <Label className="text-white text-sm">Акцент до</Label>
          <Input value={form.accentTo} onChange={(e) => upd("accentTo", e.target.value)} className="mt-1 bg-secondary border-border text-white font-mono" />
        </div>
        <div className="col-span-2">
          <Label className="text-white text-sm">Бейдж</Label>
          <Input value={form.badge} onChange={(e) => upd("badge", e.target.value)} className="mt-1 bg-secondary border-border text-white" />
        </div>
      </div>

      {msg && (
        <div className={`text-sm rounded-lg p-3 border ${msg.kind === "ok" ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-red-400 bg-red-500/10 border-red-500/30"}`}>{msg.text}</div>
      )}
      <Button onClick={save} disabled={saving} className="bg-gradient-primary text-white border-0">
        {saving ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
}

// ===== Locations tab =====
function LocationsTab() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [activeService, setActiveService] = useState<string>("review");
  const [rows, setRows] = useState<LocationRow[] | null>(null);
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await apiFetch<ServiceRow[]>("/admin/services");
      setServices(all);
      const data = await apiFetch<LocationRow[]>(`/admin/locations?serviceKey=${encodeURIComponent(activeService)}`);
      setRows(data);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [activeService]);
  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Удалить локацию?")) return;
    try { await apiFetch(`/admin/locations/${id}`, { method: "DELETE" }); void load(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }

  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Локации</h1>
          <p className="text-sm text-muted-foreground">Локации для услуги «Фото для отзывов» и других услуг.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={activeService}
            onChange={(e) => { setActiveService(e.target.value); setRows(null); }}
            className="h-10 bg-secondary border border-border rounded-lg px-3 text-white text-sm"
          >
            {services.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
          <Button
            onClick={() => setEditing({ id: "", serviceKey: activeService, name: "", previewImageUrl: "", promptFragment: "", prompts: [""], sortOrder: (rows?.length ?? 0) + 1, isActive: true })}
            className="bg-gradient-primary text-white border-0"
          >
            <Plus size={16} className="mr-2" /> Добавить
          </Button>
        </div>
      </div>

      {!rows ? <div className="text-muted-foreground">Загрузка...</div> : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-6">Локаций пока нет.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((l) => (
            <div key={l.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-square bg-secondary relative">
                {l.previewImageUrl ? <img src={l.previewImageUrl} alt={l.name} className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><MapPin /></div>
                )}
                {!l.isActive && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/70 text-muted-foreground border border-border">Скрыта</span>}
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="font-semibold text-white truncate">{l.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 flex-1">
                  {(l.prompts?.filter((p) => p.trim()).length ?? 0) > 0
                    ? `Промптов: ${l.prompts.filter((p) => p.trim()).length}`
                    : (l.promptFragment || "Промпты не заданы")}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(l)} className="flex-1 border-border text-white">
                    <Pencil size={14} className="mr-1" /> Изм.
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void remove(l.id)} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <LocationEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function LocationEditor({ initial, onClose, onSaved }: { initial: LocationRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<LocationRow>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isNew = !form.id;

  function upd<K extends keyof LocationRow>(k: K, v: LocationRow[K]) { setForm((p) => ({ ...p, [k]: v })); }

  const prompts = form.prompts ?? [];
  function setPrompt(i: number, v: string) {
    setForm((p) => ({ ...p, prompts: (p.prompts ?? []).map((x, idx) => (idx === i ? v : x)) }));
  }
  function addPrompt() { setForm((p) => ({ ...p, prompts: [...(p.prompts ?? []), ""] })); }
  function removePrompt(i: number) {
    setForm((p) => ({ ...p, prompts: (p.prompts ?? []).filter((_, idx) => idx !== i) }));
  }

  async function save() {
    setSaving(true); setErr(null);
    const cleanPrompts = (form.prompts ?? []).map((p) => p.trim()).filter(Boolean);
    if (cleanPrompts.length === 0) {
      setErr("Добавьте хотя бы один промпт");
      setSaving(false);
      return;
    }
    try {
      if (isNew) {
        await apiFetch("/admin/locations", {
          method: "POST",
          body: JSON.stringify({
            serviceKey: form.serviceKey,
            name: form.name,
            previewImageUrl: form.previewImageUrl,
            promptFragment: form.promptFragment,
            prompts: cleanPrompts,
            sortOrder: Number(form.sortOrder),
            isActive: form.isActive,
          }),
        });
      } else {
        await apiFetch(`/admin/locations/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            previewImageUrl: form.previewImageUrl,
            promptFragment: form.promptFragment,
            prompts: cleanPrompts,
            sortOrder: Number(form.sortOrder),
            isActive: form.isActive,
          }),
        });
      }
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card">
          <h3 className="text-lg font-bold text-white">{isNew ? "Новая локация" : "Редактировать локацию"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <PreviewUploader value={form.previewImageUrl} onChange={(url) => upd("previewImageUrl", url)} />
          <div>
            <Label className="text-white text-sm">Название</Label>
            <Input value={form.name} onChange={(e) => upd("name", e.target.value)} className="mt-1 bg-secondary border-border text-white" placeholder="Например: Уютное кафе" />
          </div>
          <div>
            <Label className="text-white text-sm">Промпты для генерации (англ.)</Label>
            <div className="text-xs text-muted-foreground mt-1 mb-2">
              Можно добавить несколько промптов — для каждого фото случайно выбирается один. Используйте {"{item}"} и {"{age}"} — подставятся название одежды и возраст (если не указать, добавятся в конец автоматически).
            </div>
            <div className="space-y-2">
              {prompts.map((p, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Textarea
                    value={p}
                    onChange={(e) => setPrompt(i, e.target.value)}
                    rows={3}
                    className="flex-1 bg-secondary border-border text-white font-mono text-xs"
                    placeholder="woman taking a mirror selfie in a modern apartment wearing {item}, casual amateur smartphone photo..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removePrompt(i)}
                    disabled={prompts.length <= 1}
                    className="border-border text-red-400 shrink-0"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addPrompt} className="mt-2 border-border text-white">
              <Plus size={14} className="mr-1" /> Добавить промпт
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white text-sm">Сортировка</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => upd("sortOrder", Number(e.target.value))} className="mt-1 bg-secondary border-border text-white" />
            </div>
            <label className="flex items-end gap-2 text-sm text-white pb-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => upd("isActive", e.target.checked)} /> Активна
            </label>
          </div>
          {err && <div className="text-sm rounded-lg p-3 border text-red-400 bg-red-500/10 border-red-500/30">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose} className="border-border text-white">Отмена</Button>
          <Button onClick={save} disabled={saving || !form.name} className="bg-gradient-primary text-white border-0">
            {saving ? "..." : "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== AI Models Tab =====
type GenProvider = "kie" | "openrouter";
type AiModelCategory = "styles" | "photoshoot" | "review";
interface ModelOption { id: string; name: string; provider: GenProvider; }
interface AiSettings { styles: string; photoshoot: string; review: string; styleAssistProvider: GenProvider; styleAssistModel: string; }
interface AiKeyDiagnostic {
  provider: "openrouter";
  source: string;
  fingerprint: string;
  ok: boolean;
  status?: number;
  message: string;
}

const AI_CATEGORIES: Array<{ key: AiModelCategory; label: string; desc: string }> = [
  { key: "styles", label: "Стили", desc: "Модель для генерации стилей" },
  { key: "photoshoot", label: "Фотосессия", desc: "Модель для услуги фотосессии (WB)" },
  { key: "review", label: "Фото для отзывов", desc: "Модель для генерации фото-отзывов" },
];

const PROVIDERS: Array<{ key: GenProvider; label: string; desc: string }> = [
  { key: "kie", label: "kie.ai", desc: "Стабильный сервис (Nano Banana Pro)" },
  { key: "openrouter", label: "OpenRouter", desc: "Сотни моделей разных провайдеров" },
];

function providerOf(modelId: string): GenProvider {
  return modelId.startsWith("kie:") ? "kie" : "openrouter";
}

function AiModelsTab() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [textModels, setTextModels] = useState<ModelOption[]>([]);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(false);
  const [keyDiagnostics, setKeyDiagnostics] = useState<AiKeyDiagnostic[]>([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [providerByCat, setProviderByCat] = useState<Record<AiModelCategory, GenProvider>>({
    styles: "kie",
    photoshoot: "kie",
    review: "kie",
  });

  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([
          apiFetch<ModelOption[]>("/admin/ai/models"),
          apiFetch<AiSettings>("/admin/ai/settings"),
        ]);
        const tm = await apiFetch<ModelOption[]>("/admin/ai/text-models");
        setModels(m);
        setTextModels(tm);
        setSettings({
          ...s,
          styleAssistProvider: s.styleAssistProvider ?? providerOf(s.styleAssistModel ?? "openai/gpt-4o-mini"),
          styleAssistModel: s.styleAssistModel ?? "openai/gpt-4o-mini",
        });
        setProviderByCat({
          styles: providerOf(s.styles),
          photoshoot: providerOf(s.photoshoot),
          review: providerOf(s.review),
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setErr("");
    setOk(false);
    try {
      const updated = await apiFetch<AiSettings>("/admin/ai/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function checkKeys() {
    setCheckingKeys(true);
    setErr("");
    try {
      setKeyDiagnostics(await apiFetch<AiKeyDiagnostic[]>("/admin/ai/key-diagnostics"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось проверить ключи");
    } finally {
      setCheckingKeys(false);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={18} /> Загрузка моделей…</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white">ИИ-модели</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Для каждой категории сначала выберите сервис генерации (kie.ai или OpenRouter), затем конкретную модель. Список моделей OpenRouter подгружается в реальном времени.
        </p>
      </div>

      {err && <div className="text-sm rounded-lg p-3 border text-red-400 bg-red-500/10 border-red-500/30 mb-4">{err}</div>}

      <div className="space-y-5 max-w-2xl">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <div className="font-semibold text-white">Проверка API-ключей</div>
            <div className="text-xs text-muted-foreground">
              Сервер проверит OPENROUTER_API_KEY и OPENAI_API_KEY без показа полного секрета.
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button type="button" variant="outline" onClick={checkKeys} disabled={checkingKeys}>
              {checkingKeys ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Shield size={16} className="mr-2" />}
              Проверить ключи
            </Button>
            {keyDiagnostics.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Проверено источников: {keyDiagnostics.length}
              </span>
            )}
          </div>
          {keyDiagnostics.length > 0 && (
            <div className="mt-3 space-y-2">
              {keyDiagnostics.map((item, index) => (
                <div
                  key={`${item.source}-${index}`}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    item.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{item.provider} · {item.source}</span>
                    <span>{item.status ? `HTTP ${item.status}` : "без ответа"}</span>
                  </div>
                  <div className="mt-1 break-words">
                    {item.fingerprint && <span className="font-mono">{item.fingerprint}</span>}
                    {item.fingerprint && " · "}
                    {item.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <div className="font-semibold text-white">Тексты AI-помощника стилей</div>
            <div className="text-xs text-muted-foreground">
              Эта модель заполняет название, описания, категорию и prompt в окне создания нового стиля.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PROVIDERS.map((p) => {
              const active = (settings?.styleAssistProvider ?? "openrouter") === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    const first = textModels.find((m) => m.provider === p.key);
                    setSettings((s) => s ? {
                      ...s,
                      styleAssistProvider: p.key,
                      styleAssistModel: first?.id ?? (p.key === "kie" ? "kie:gpt-5-2" : "openai/gpt-4o-mini"),
                    } : s);
                  }}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-white"
                      : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{p.label}</span>
                    {active && <Check size={15} className="text-primary shrink-0" />}
                  </div>
                  <div className="text-[11px] leading-tight mt-0.5">{p.desc}</div>
                </button>
              );
            })}
          </div>
          <ModelSelect
            models={textModels.filter((m) => m.provider === (settings?.styleAssistProvider ?? "openrouter"))}
            value={settings?.styleAssistModel ?? ((settings?.styleAssistProvider ?? "openrouter") === "kie" ? "kie:gpt-5-2" : "openai/gpt-4o-mini")}
            onChange={(v) => setSettings((s) => (s ? { ...s, styleAssistModel: v } : s))}
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Превью-картинка стиля создаётся через KIE / Nano Banana Pro.
          </div>
        </div>

        {AI_CATEGORIES.map((cat) => {
          const value = settings?.[cat.key] ?? "";
          const provider = providerByCat[cat.key];
          const providerModels = models.filter((m) => m.provider === provider);

          const setProvider = (p: GenProvider) => {
            if (p === provider) return;
            setProviderByCat((m) => ({ ...m, [cat.key]: p }));
            const first = models.find((mm) => mm.provider === p);
            if (first) setSettings((s) => (s ? { ...s, [cat.key]: first.id } : s));
          };

          return (
            <div key={cat.key} className="bg-card border border-border rounded-xl p-5">
              <div className="mb-3">
                <div className="font-semibold text-white">{cat.label}</div>
                <div className="text-xs text-muted-foreground">{cat.desc}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {PROVIDERS.map((p) => {
                  const active = provider === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setProvider(p.key)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-white"
                          : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{p.label}</span>
                        {active && <Check size={15} className="text-primary shrink-0" />}
                      </div>
                      <div className="text-[11px] leading-tight mt-0.5">{p.desc}</div>
                    </button>
                  );
                })}
              </div>

              {providerModels.length > 0 ? (
                <ModelSelect
                  models={providerModels}
                  value={value}
                  onChange={(v) => setSettings((s) => (s ? { ...s, [cat.key]: v } : s))}
                />
              ) : (
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  Нет доступных моделей OpenRouter. Проверьте, что задан ключ OpenRouter.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3 max-w-2xl">
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-white border-0">
          {saving ? "..." : "Сохранить"}
        </Button>
        {ok && <span className="text-sm text-green-400 flex items-center gap-1"><Check size={16} /> Сохранено</span>}
        <span className="text-xs text-muted-foreground ml-auto">Доступно моделей: {models.length}</span>
      </div>
    </div>
  );
}

function ModelSelect({ models, value, onChange }: { models: ModelOption[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = models.find((m) => m.id === value);
  const filtered = query.trim()
    ? models.filter((m) => `${m.name} ${m.id}`.toLowerCase().includes(query.trim().toLowerCase()))
    : models;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-secondary border border-border rounded-lg px-3 py-2.5 text-left text-sm text-white hover:border-primary/50 transition-colors"
      >
        <span className="truncate">
          {selected ? selected.name : value || "Выберите модель"}
          {selected && <span className="text-xs text-muted-foreground ml-2">{selected.id}</span>}
        </span>
        <Cpu size={16} className="text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Search size={15} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск модели…"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-72 overflow-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground">Ничего не найдено</div>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 ${
                  m.id === value ? "text-white bg-white/5" : "text-muted-foreground"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-white">{m.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.id}</span>
                </span>
                {m.id === value && <Check size={15} className="text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
