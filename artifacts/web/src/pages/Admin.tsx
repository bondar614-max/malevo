import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, clearAuth, getStoredUser, getToken } from "@/lib/admin-api";
import { LogOut, Users, ImageIcon, Tag, Layers, Pencil, Trash2, Plus, X, Shield, Upload, Loader2 } from "lucide-react";

type Tab = "users" | "orders" | "tariffs" | "styles";

interface UserRow {
  id: string; email: string; name: string; role: string; isBlocked: boolean;
  balance: number; totalSpent: number; createdAt: string; lastLogin: string | null;
}
interface OrderRow {
  id: string; userId: string | null; userEmail: string | null;
  styleId: string | null; styleTitle: string | null;
  status: string; amount: number; createdAt: string; completedAt: string | null;
}
interface TariffRow {
  id: string; name: string; description: string; price: number;
  generationsIncluded: number; isActive: boolean; sortOrder: number;
}
interface StyleRow {
  id: string; title: string; shortDescription: string; fullDescription: string;
  prompt: string;
  category: string; price: number; previewImageUrl: string; exampleImages: string[];
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
              <th className="px-4 py-3 text-left">Стиль</th>
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
                <td className="px-4 py-3">{o.styleTitle ?? "—"}</td>
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

  function upd<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }));
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
