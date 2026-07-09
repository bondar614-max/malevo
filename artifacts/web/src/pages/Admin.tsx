import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, clearAuth, getStoredUser, getToken } from "@/lib/admin-api";
import { LogOut, Users, ImageIcon, Tag, Layers, Pencil, Trash2, Plus, X, Shield, Upload, Loader2, Sparkles, MapPin, Cpu, Search, Check, LifeBuoy, Reply, BarChart3, CreditCard, Megaphone, LayoutDashboard, TrendingUp, Wallet, Clock } from "lucide-react";

type Tab = "dashboard" | "users" | "orders" | "support" | "payments" | "tariffs" | "styles" | "services" | "locations" | "landing" | "promo" | "analytics" | "ai";

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
interface PaymentRow {
  id: string; userId: string; userEmail: string | null; yookassaPaymentId: string | null;
  status: string; amount: number; currency: string; confirmationUrl: string | null;
  createdAt: string; creditedAt: string | null;
}
interface SupportMessage {
  role: "user" | "assistant" | "admin";
  content: string;
  createdAt: string;
}
interface SupportTicketRow {
  id: string; userId: string; userEmail: string | null; userName: string | null;
  status: string; topic: string; summary: string; messages: SupportMessage[];
  isUnread: boolean; createdAt: string; updatedAt: string;
}
interface ServiceRow {
  key: string; title: string; shortDescription: string; fullDescription: string;
  prompt: string; previewImageUrl: string; price: number;
  photosMin: number; photosMax: number; generationTime: number;
  isActive: boolean; accentFrom: string; accentTo: string; badge: string;
}
interface PhotoExampleItem {
  src: string;
  title: string;
  text: string;
  className?: string;
}
interface PhotoExamplesSettings {
  heroVariant: "variant1" | "variant2" | "variant3" | "variant4";
  photoshoot: PhotoExampleItem[];
  reviewBefore: PhotoExampleItem;
  reviewAfter: PhotoExampleItem[];
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

function formatMoney(value: number): string {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("dashboard");
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
    { id: "dashboard", label: "Дашборд", icon: LayoutDashboard },
    { id: "users", label: "Пользователи", icon: Users },
    { id: "orders", label: "Генерации", icon: ImageIcon },
    { id: "support", label: "Поддержка", icon: LifeBuoy },
    { id: "payments", label: "Платежи", icon: CreditCard },
    { id: "tariffs", label: "Тарифы", icon: Tag },
    { id: "styles", label: "Стили", icon: Layers },
    { id: "services", label: "Услуги", icon: Sparkles },
    { id: "locations", label: "Локации", icon: MapPin },
    { id: "landing", label: "Лендинг", icon: ImageIcon },
    { id: "promo", label: "Промо", icon: Megaphone },
    { id: "analytics", label: "Метрики", icon: BarChart3 },
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
              <div className="text-xs text-muted-foreground">MALEVO</div>
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
          {tab === "dashboard" && <DashboardTab />}
          {tab === "users" && <UsersTab />}
          {tab === "orders" && <OrdersTab />}
          {tab === "support" && <SupportTab />}
          {tab === "payments" && <PaymentsTab />}
          {tab === "tariffs" && <TariffsTab />}
          {tab === "styles" && <StylesTab />}
          {tab === "services" && <ServicesTab />}
          {tab === "locations" && <LocationsTab />}
          {tab === "landing" && <LandingTab />}
          {tab === "promo" && <PromoTab />}
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "ai" && <AiModelsTab />}
        </div>
      </main>
    </div>
  );
}

// ===== Dashboard Tab =====
type DashboardPeriod = "7d" | "30d" | "90d" | "year" | "all" | "custom";
interface DashboardData {
  period: { key: DashboardPeriod; from: string | null; to: string | null };
  summary: {
    usersTotal: number;
    usersNew: number;
    usersBalance: number;
    usersTotalSpent: number;
    ordersTotal: number;
    ordersSuccess: number;
    ordersFailed: number;
    ordersProcessing: number;
    ordersAwaitingApproval: number;
    grossOrders: number;
    averageOrder: number;
    paymentsCount: number;
    paymentsRevenue: number;
    averagePayment: number;
  };
  statuses: Array<{ status: string; count: number }>;
  topItems: Array<{ key: string; label: string; count: number; revenue: number; success: number }>;
  daily: Array<{ day: string; orders: number; success: number; grossOrders: number; paymentsRevenue: number }>;
  recentOrders: Array<{ id: string; userEmail: string; label: string; status: string; amount: number; createdAt: string }>;
}

const PERIODS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "year", label: "Год" },
  { value: "all", label: "Все время" },
  { value: "custom", label: "Период" },
];

function isoInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function DashboardTab() {
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const [from, setFrom] = useState(() => isoInputDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => isoInputDate(new Date()));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", from);
      params.set("to", to);
    }
    try {
      setData(await apiFetch<DashboardData>(`/admin/dashboard?${params.toString()}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [from, period, to]);

  useEffect(() => { void load(); }, [load]);

  const summary = data?.summary;
  const maxRevenue = Math.max(1, ...(data?.daily.map((d) => d.paymentsRevenue) ?? [1]));
  const maxOrders = Math.max(1, ...(data?.daily.map((d) => d.orders) ?? [1]));

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white">Дашборд</h2>
          <p className="text-sm text-muted-foreground mt-1">Сводка по пользователям, платежам, заказам и популярным услугам.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
            className="h-10 bg-secondary border border-border rounded-lg px-3 text-white text-sm"
          >
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {period === "custom" && (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-36 bg-secondary border-border text-white" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-36 bg-secondary border-border text-white" />
            </>
          )}
        </div>
      </div>

      {err && <div className="text-sm rounded-lg p-3 border text-red-400 bg-red-500/10 border-red-500/30 mb-4">{err}</div>}
      {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={18} /> Загрузка данных…</div>}

      {!loading && summary && data && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard icon={Wallet} label="Пополнения" value={formatMoney(summary.paymentsRevenue)} hint={`${summary.paymentsCount} платежей, средний ${formatMoney(summary.averagePayment)}`} />
            <MetricCard icon={ImageIcon} label="Генерации" value={summary.ordersTotal.toLocaleString("ru-RU")} hint={`${summary.ordersSuccess} успешно, ${summary.ordersFailed} ошибок`} />
            <MetricCard icon={Users} label="Пользователи" value={summary.usersTotal.toLocaleString("ru-RU")} hint={`+${summary.usersNew} за период`} />
            <MetricCard icon={TrendingUp} label="Средний заказ" value={formatMoney(summary.averageOrder)} hint={`Сумма заказов ${formatMoney(summary.grossOrders)}`} />
          </div>

          <div className="grid xl:grid-cols-[1.4fr_0.8fr] gap-5">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-white">Динамика по дням</div>
                  <div className="text-xs text-muted-foreground">Фиолетовый — пополнения, серый — заказы</div>
                </div>
                <div className="text-xs text-muted-foreground">{data.daily.length} точек</div>
              </div>
              <div className="h-56 flex items-end gap-1 border-b border-border pb-2 overflow-hidden">
                {data.daily.map((d) => (
                  <div key={d.day} className="flex-1 min-w-2 h-full flex items-end gap-0.5" title={`${d.day}: ${formatMoney(d.paymentsRevenue)}, заказов ${d.orders}`}>
                    <div className="w-1/2 rounded-t bg-gradient-primary" style={{ height: `${Math.max(3, (d.paymentsRevenue / maxRevenue) * 100)}%` }} />
                    <div className="w-1/2 rounded-t bg-white/20" style={{ height: `${Math.max(3, (d.orders / maxOrders) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="font-semibold text-white mb-4">Статусы заказов</div>
              <div className="space-y-3">
                {data.statuses.length === 0 && <div className="text-sm text-muted-foreground">Нет заказов за период</div>}
                {data.statuses.map((s) => (
                  <div key={s.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{statusLabel(s.status)}</span>
                      <span className="text-white">{s.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${summary.ordersTotal ? (s.count / summary.ordersTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="font-semibold text-white mb-4">Популярные услуги и стили</div>
              <div className="space-y-3">
                {data.topItems.length === 0 && <div className="text-sm text-muted-foreground">Нет данных за период</div>}
                {data.topItems.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4 border-b border-border last:border-0 pb-3 last:pb-0">
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.count} заказов, {item.success} успешно</div>
                    </div>
                    <div className="text-right text-white font-semibold">{formatMoney(item.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="font-semibold text-white mb-4">Последние заказы</div>
              <div className="space-y-3">
                {data.recentOrders.length === 0 && <div className="text-sm text-muted-foreground">Нет заказов за период</div>}
                {data.recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-4 border-b border-border last:border-0 pb-3 last:pb-0">
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{o.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{o.userEmail || "Гость"} · {formatDate(o.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">{formatMoney(o.amount)}</div>
                      <div className="text-xs text-muted-foreground">{statusLabel(o.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <MetricCard icon={Clock} label="В работе" value={String(summary.ordersProcessing)} hint={`На проверке: ${summary.ordersAwaitingApproval}`} />
            <MetricCard icon={CreditCard} label="Баланс пользователей" value={formatMoney(summary.usersBalance)} hint="Текущий суммарный баланс" />
            <MetricCard icon={Wallet} label="Всего потрачено" value={formatMoney(summary.usersTotalSpent)} hint="За все время по пользователям" />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-bold text-white">{value}</div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-[#7C3AED]/15 text-[#C4B5FD] flex items-center justify-center">
          <Icon size={22} />
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    success: "Успешно",
    failed: "Ошибка",
    processing: "В работе",
    awaiting_approval: "Ожидает проверки",
    pending: "Ожидает",
  };
  return map[status] ?? status;
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

// ===== Payments Tab =====
interface YooKassaAdminSettings {
  enabled: boolean;
  shopId: string;
  secretConfigured: boolean;
  returnUrl: string;
  webhookToken: string;
}

function PaymentsTab() {
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [settings, setSettings] = useState<YooKassaAdminSettings | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const [paymentRows, paymentSettings] = await Promise.all([
        apiFetch<PaymentRow[]>("/admin/payments"),
        apiFetch<YooKassaAdminSettings>("/admin/payments/yookassa"),
      ]);
      setRows(paymentRows);
      setSettings(paymentSettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const updated = await apiFetch<YooKassaAdminSettings>("/admin/payments/yookassa", {
        method: "PATCH",
        body: JSON.stringify({
          enabled: settings.enabled,
          shopId: settings.shopId,
          secretKey,
          returnUrl: settings.returnUrl,
          webhookToken: settings.webhookToken,
        }),
      });
      setSettings(updated);
      setSecretKey("");
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white">Платежи</h2>
          <p className="text-sm text-muted-foreground mt-1">Настройки ЮKassa и история пополнений баланса</p>
        </div>
        <div className="text-sm text-muted-foreground">Всего: {rows?.length ?? "..."}</div>
      </div>

      {error && <div className="text-sm rounded-lg p-3 border text-red-400 bg-red-500/10 border-red-500/30 mb-4">{error}</div>}

      {settings && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 max-w-3xl">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings((s) => s ? { ...s, enabled: e.target.checked } : s)}
              className="mt-1"
            />
            <div>
              <div className="font-semibold text-white">Включить пополнение через ЮKassa</div>
              <div className="text-xs text-muted-foreground">
                Webhook URL: <span className="font-mono">/api/payments/yookassa/webhook?token={settings.webhookToken || "TOKEN"}</span>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Shop ID">
              <Input
                value={settings.shopId}
                onChange={(e) => setSettings((s) => s ? { ...s, shopId: e.target.value } : s)}
                className="bg-secondary border-border text-white"
              />
            </Field>
            <Field label="Secret key">
              <Input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={settings.secretConfigured ? "Ключ уже задан" : "Введите ключ"}
                className="bg-secondary border-border text-white"
                autoComplete="off"
              />
              <div className={`mt-1 text-xs ${settings.secretConfigured ? "text-green-400" : "text-amber-400"}`}>
                {settings.secretConfigured ? "Ключ сохранён" : "Ключ не задан"}
              </div>
            </Field>
            <Field label="Return URL">
              <Input
                value={settings.returnUrl}
                onChange={(e) => setSettings((s) => s ? { ...s, returnUrl: e.target.value } : s)}
                placeholder="https://site.ru/account"
                className="bg-secondary border-border text-white"
              />
            </Field>
            <Field label="Webhook token">
              <Input
                value={settings.webhookToken}
                onChange={(e) => setSettings((s) => s ? { ...s, webhookToken: e.target.value } : s)}
                className="bg-secondary border-border text-white"
              />
            </Field>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={saveSettings} disabled={saving} className="bg-gradient-primary text-white border-0">
              {saving ? "..." : "Сохранить"}
            </Button>
            {ok && <span className="text-sm text-green-400 flex items-center gap-1"><Check size={16} /> Сохранено</span>}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Дата</th>
              <th className="px-4 py-3 text-left">Пользователь</th>
              <th className="px-4 py-3 text-left">ЮKassa ID</th>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3 text-left">Зачислено</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-white/5">
                <td className="px-4 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3 text-white">{p.userEmail ?? p.userId}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.yookassaPaymentId ?? "—"}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-secondary">{p.status}</span></td>
                <td className="px-4 py-3 text-right text-white">{p.amount.toFixed(2)} ₽</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(p.creditedAt)}</td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Пока нет платежей</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Support Tab =====
function SupportTab() {
  const [rows, setRows] = useState<SupportTicketRow[] | null>(null);
  const [selected, setSelected] = useState<SupportTicketRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await apiFetch<SupportTicketRow[]>("/admin/support"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function markClosed(id: string) {
    await apiFetch(`/admin/support/${id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) });
    await load();
  }

  const unread = rows?.filter((r) => r.isUnread).length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white">Поддержка</h2>
          <p className="text-sm text-muted-foreground mt-1">Обращения, собранные ИИ-ассистентом у пользователей</p>
        </div>
        <div className={`rounded-full px-4 py-2 text-sm font-bold ${unread > 0 ? "bg-[#F43F5E]/20 text-[#FDA4AF] border border-[#F43F5E]/40 animate-pulse" : "bg-secondary text-muted-foreground border border-border"}`}>
          Непрочитано: {unread}
        </div>
      </div>
      {error && <div className="text-red-400 mb-4">{error}</div>}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3 text-left">Пользователь</th>
              <th className="px-4 py-3 text-left">Тема</th>
              <th className="px-4 py-3 text-left">Дата обращения</th>
              <th className="px-4 py-3 text-left">Обновлено</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((ticket) => (
              <tr key={ticket.id} className={`border-t border-border hover:bg-white/5 ${ticket.isUnread ? "bg-[#F43F5E]/5" : ""}`}>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ticket.isUnread ? "bg-[#F43F5E]/20 text-[#FDA4AF]" : "bg-secondary text-muted-foreground"}`}>
                    {ticket.status === "open" ? "Новое" : ticket.status === "answered" ? "Отвечено" : "Закрыто"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{ticket.userName || "Без имени"}</div>
                  <div className="text-xs text-muted-foreground">{ticket.userEmail ?? "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-md truncate text-white">{ticket.topic}</div>
                  <div className="max-w-md truncate text-xs text-muted-foreground">{ticket.summary || "—"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(ticket.createdAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(ticket.updatedAt)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(ticket)} className="text-white">
                    <Reply size={15} className="mr-2" /> Открыть
                  </Button>
                  {ticket.status !== "closed" && (
                    <button onClick={() => markClosed(ticket.id)} className="ml-2 text-muted-foreground hover:text-red-400" title="Закрыть">
                      <X size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Пока нет обращений</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && <SupportTicketModal ticket={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}
    </div>
  );
}

function SupportTicketModal({ ticket, onClose, onSaved }: { ticket: SupportTicketRow; onClose: () => void; onSaved: () => void }) {
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = reply.trim() ? { adminReply: reply.trim() } : { markRead: true };
      await apiFetch(`/admin/support/${ticket.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Обращение: ${ticket.topic}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-secondary border border-border p-3">
            <div className="text-xs text-muted-foreground">Пользователь</div>
            <div className="text-white font-medium truncate">{ticket.userName || "Без имени"}</div>
            <div className="text-xs text-muted-foreground truncate">{ticket.userEmail ?? "—"}</div>
          </div>
          <div className="rounded-xl bg-secondary border border-border p-3">
            <div className="text-xs text-muted-foreground">Дата обращения</div>
            <div className="text-white font-medium">{formatDate(ticket.createdAt)}</div>
          </div>
          <div className="rounded-xl bg-secondary border border-border p-3">
            <div className="text-xs text-muted-foreground">Статус</div>
            <div className="text-white font-medium">{ticket.status}</div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-white">Переписка</div>
          <div className="max-h-80 space-y-3 overflow-auto rounded-xl border border-border bg-background/40 p-4">
            {ticket.messages.map((m, i) => (
              <div key={`${m.createdAt}-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#7C3AED] text-white"
                    : m.role === "admin"
                      ? "bg-[#16A34A]/20 text-green-100 border border-[#22C55E]/30"
                      : "bg-secondary text-white border border-border"
                }`}>
                  <div className="mb-1 text-[10px] uppercase tracking-wide opacity-60">
                    {m.role === "user" ? "Пользователь" : m.role === "admin" ? "Администратор" : "ИИ"}
                  </div>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Field label="Ответ администратора">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} className="bg-secondary border-border text-white" placeholder="Напишите ответ пользователю..." />
        </Field>
        {error && <div className="text-sm text-red-400">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Закрыть</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary text-white border-0">
            {saving ? "Сохранение..." : reply.trim() ? "Ответить" : "Отметить прочитанным"}
          </Button>
        </div>
      </div>
    </Modal>
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

// ===== Landing tab =====
const HERO_VARIANTS: Array<{ value: PhotoExamplesSettings["heroVariant"]; label: string; desc: string }> = [
  { value: "variant1", label: "Вариант 1", desc: "Премиальная витрина: чистый оффер и крупная фотосерия справа." },
  { value: "variant2", label: "Вариант 2", desc: "Боль продавца: карточка теряет продажи без сильных фото." },
  { value: "variant3", label: "Вариант 3", desc: "До/после и самый сильный первый крючок." },
  { value: "variant4", label: "Вариант 4", desc: "Продуктовый сценарий: загрузил товар и получил карточку." },
];

function LandingTab() {
  const [settings, setSettings] = useState<PhotoExamplesSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      setSettings(await apiFetch<PhotoExamplesSettings>("/admin/photo-examples"));
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function updatePhotoshoot(index: number, next: PhotoExampleItem) {
    setSettings((prev) => {
      if (!prev) return prev;
      const photoshoot = prev.photoshoot.slice();
      photoshoot[index] = { ...photoshoot[index], ...next };
      return { ...prev, photoshoot };
    });
  }

  function updateReviewAfter(index: number, next: PhotoExampleItem) {
    setSettings((prev) => {
      if (!prev) return prev;
      const reviewAfter = prev.reviewAfter.slice();
      reviewAfter[index] = { ...reviewAfter[index], ...next };
      return { ...prev, reviewAfter };
    });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    try {
      const updated = await apiFetch<PhotoExamplesSettings>("/admin/photo-examples", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      setMsg({ kind: "ok", text: "Сохранено" });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground">Загрузка...</div>;
  if (!settings) {
    return (
      <div className="space-y-4">
        {msg && <div className="text-sm rounded-lg p-3 border text-red-400 bg-red-500/10 border-red-500/30">{msg.text}</div>}
        <Button onClick={() => void load()} variant="outline" className="border-border text-white">Повторить</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Лендинг /photo</h1>
          <p className="text-sm text-muted-foreground">Заменяйте изображения и подписи в блоках примеров WB-фотосессии и фотоотзывов.</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-white border-0">
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>

      {msg && (
        <div className={`text-sm rounded-lg p-3 border ${msg.kind === "ok" ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-red-400 bg-red-500/10 border-red-500/30"}`}>
          {msg.text}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Главный экран</h2>
          <p className="text-sm text-muted-foreground">Выберите, какой из собранных hero-вариантов показывать первым на странице /photo.</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-3">
          {HERO_VARIANTS.map((variant) => {
            const active = settings.heroVariant === variant.value;
            return (
              <button
                key={variant.value}
                type="button"
                onClick={() => setSettings((prev) => (prev ? { ...prev, heroVariant: variant.value } : prev))}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-white"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{variant.label}</span>
                  {active && <Check size={16} className="text-primary shrink-0" />}
                </div>
                <div className="text-xs leading-relaxed mt-2">{variant.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Пример WB-фотосессии</h2>
          <p className="text-sm text-muted-foreground">Эти 4 изображения показываются в новом блоке с примером фотосессии.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {settings.photoshoot.map((item, index) => (
            <ExampleEditor
              key={`photoshoot-${index}`}
              label={`Кадр ${index + 1}`}
              item={item}
              onChange={(next) => updatePhotoshoot(index, next)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Пример фотоотзывов</h2>
          <p className="text-sm text-muted-foreground">Исходное фото и 3 результата “После” в блоке фотоотзывов.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <ExampleEditor
            label="Фото До"
            item={settings.reviewBefore}
            onChange={(next) => setSettings((prev) => (prev ? { ...prev, reviewBefore: { ...prev.reviewBefore, ...next } } : prev))}
          />
          {settings.reviewAfter.map((item, index) => (
            <ExampleEditor
              key={`review-after-${index}`}
              label={`Фото После ${index + 1}`}
              item={item}
              onChange={(next) => updateReviewAfter(index, next)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ExampleEditor({ label, item, onChange }: { label: string; item: PhotoExampleItem; onChange: (next: PhotoExampleItem) => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-white">{label}</h3>
        {item.className && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">крупный кадр</span>}
      </div>
      <PreviewUploader value={item.src} onChange={(src) => onChange({ ...item, src })} />
      <Field label="Заголовок">
        <Input
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          className="bg-secondary border-border text-white"
        />
      </Field>
      <Field label="Подпись">
        <Textarea
          value={item.text}
          onChange={(e) => onChange({ ...item, text: e.target.value })}
          rows={3}
          className="bg-secondary border-border text-white"
        />
      </Field>
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

// ===== Promo Tab =====
interface ExitPromoSettings {
  enabled: boolean;
  title: string;
  body: string;
  offer: string;
  couponCode: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl: string;
}

const DEFAULT_EXIT_PROMO_SETTINGS: ExitPromoSettings = {
  enabled: false,
  title: "Не уходите без подарка",
  body: "Попробуйте фотоотзывы бесплатно и посмотрите, как товар выглядит в реальной пользовательской сцене.",
  offer: "Купон на бесплатные генерации фотоотзывов",
  couponCode: "REVIEWFREE",
  buttonText: "Забрать купон",
  buttonUrl: "/photo",
  imageUrl: "",
};

function PromoTab() {
  const [settings, setSettings] = useState<ExitPromoSettings>(DEFAULT_EXIT_PROMO_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      setSettings(await apiFetch<ExitPromoSettings>("/admin/promo/exit-intent"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function upd<K extends keyof ExitPromoSettings>(key: K, value: ExitPromoSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setErr("");
    setOk(false);
    try {
      const updated = await apiFetch<ExitPromoSettings>("/admin/promo/exit-intent", {
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

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={18} /> Загрузка промо…</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white">Промо</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Всплывающее предложение показывается один раз за сессию, когда посетитель уводит курсор к закрытию вкладки.
        </p>
      </div>

      {err && <div className="text-sm rounded-lg p-3 border text-red-400 bg-red-500/10 border-red-500/30 mb-4">{err}</div>}

      <div className="grid xl:grid-cols-[1fr_420px] gap-5">
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => upd("enabled", e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-semibold text-white">Показывать exit popup</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Если выключено, публичный сайт не загружает и не показывает рекламное окно.
                </span>
              </span>
            </label>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <Field label="Заголовок">
              <Input value={settings.title} onChange={(e) => upd("title", e.target.value)} className="bg-secondary border-border text-white" />
            </Field>
            <Field label="Описание">
              <Textarea value={settings.body} onChange={(e) => upd("body", e.target.value)} rows={4} className="bg-secondary border-border text-white" />
            </Field>
            <Field label="Предложение">
              <Input value={settings.offer} onChange={(e) => upd("offer", e.target.value)} className="bg-secondary border-border text-white" />
            </Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Купон">
                <Input value={settings.couponCode} onChange={(e) => upd("couponCode", e.target.value)} className="bg-secondary border-border text-white font-mono" />
              </Field>
              <Field label="Текст кнопки">
                <Input value={settings.buttonText} onChange={(e) => upd("buttonText", e.target.value)} className="bg-secondary border-border text-white" />
              </Field>
            </div>
            <Field label="Ссылка кнопки">
              <Input value={settings.buttonUrl} onChange={(e) => upd("buttonUrl", e.target.value)} placeholder="/photo" className="bg-secondary border-border text-white" />
            </Field>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <Field label="Фото в попапе">
              <PreviewUploader value={settings.imageUrl} onChange={(url) => upd("imageUrl", url)} />
            </Field>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 h-fit">
          <div className="text-sm font-semibold text-white mb-3">Превью</div>
          <div className="overflow-hidden rounded-xl border border-border bg-[#141416]">
            <div className="h-44 bg-secondary">
              {settings.imageUrl ? (
                <img src={settings.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-primary flex items-center justify-center">
                  <Megaphone size={54} className="text-white" />
                </div>
              )}
            </div>
            <div className="p-5">
              {settings.offer && <div className="mb-3 text-xs font-semibold text-[#C4B5FD]">{settings.offer}</div>}
              <div className="text-2xl font-bold text-white leading-tight">{settings.title}</div>
              <div className="mt-3 text-sm text-muted-foreground leading-6">{settings.body}</div>
              {settings.couponCode && <div className="mt-4 font-mono text-white">{settings.couponCode}</div>}
              <div className="mt-4 inline-flex h-10 items-center rounded-lg bg-gradient-primary px-4 text-sm font-bold text-white">
                {settings.buttonText}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-white border-0">
          {saving ? "..." : "Сохранить"}
        </Button>
        {ok && <span className="text-sm text-green-400 flex items-center gap-1"><Check size={16} /> Сохранено</span>}
      </div>
    </div>
  );
}

// ===== Analytics Tab =====
interface TrackingSettings {
  enabled: boolean;
  yandexMetrikaId: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  headCode: string;
  bodyCode: string;
}

const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
  enabled: false,
  yandexMetrikaId: "",
  googleAnalyticsId: "",
  googleTagManagerId: "",
  headCode: "",
  bodyCode: "",
};

function AnalyticsTab() {
  const [settings, setSettings] = useState<TrackingSettings>(DEFAULT_TRACKING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      setSettings(await apiFetch<TrackingSettings>("/admin/analytics/settings"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function upd<K extends keyof TrackingSettings>(key: K, value: TrackingSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setErr("");
    setOk(false);
    try {
      const updated = await apiFetch<TrackingSettings>("/admin/analytics/settings", {
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

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={18} /> Загрузка метрик…</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white">Метрики</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Подключите счетчики посещаемости для публичных страниц сайта. В админке коды не запускаются.
        </p>
      </div>

      {err && <div className="text-sm rounded-lg p-3 border text-red-400 bg-red-500/10 border-red-500/30 mb-4">{err}</div>}

      <div className="space-y-5 max-w-3xl">
        <div className="bg-card border border-border rounded-xl p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => upd("enabled", e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-white">Включить коды отслеживания</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Если выключено, сайт вернет пустые настройки и не вставит ни один счетчик.
              </span>
            </span>
          </label>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <div className="font-semibold text-white">Быстрое подключение</div>
            <div className="text-xs text-muted-foreground">Укажите ID счетчика, а сайт сам сформирует стандартный код.</div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Яндекс.Метрика ID">
              <Input
                value={settings.yandexMetrikaId}
                onChange={(e) => upd("yandexMetrikaId", e.target.value)}
                placeholder="12345678"
                className="bg-secondary border-border text-white"
              />
              <div className="mt-1 text-xs text-muted-foreground">Только цифры из номера счетчика.</div>
            </Field>
            <Field label="Google Analytics ID">
              <Input
                value={settings.googleAnalyticsId}
                onChange={(e) => upd("googleAnalyticsId", e.target.value)}
                placeholder="G-XXXXXXXXXX"
                className="bg-secondary border-border text-white"
              />
              <div className="mt-1 text-xs text-muted-foreground">GA4 Measurement ID или старый UA-ID.</div>
            </Field>
            <Field label="Google Tag Manager ID">
              <Input
                value={settings.googleTagManagerId}
                onChange={(e) => upd("googleTagManagerId", e.target.value)}
                placeholder="GTM-XXXXXXX"
                className="bg-secondary border-border text-white"
              />
              <div className="mt-1 text-xs text-muted-foreground">Контейнер GTM, если используете теги через него.</div>
            </Field>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <div className="font-semibold text-white">Дополнительные коды</div>
            <div className="text-xs text-muted-foreground">
              Сюда можно вставить готовые snippets других систем аналитики, пиксели рекламы или верификационные теги.
            </div>
          </div>
          <div className="space-y-4">
            <Field label="Код в head">
              <Textarea
                value={settings.headCode}
                onChange={(e) => upd("headCode", e.target.value)}
                rows={8}
                placeholder="<script>...</script>"
                className="bg-secondary border-border text-white font-mono text-xs"
              />
            </Field>
            <Field label="Код перед закрывающим body">
              <Textarea
                value={settings.bodyCode}
                onChange={(e) => upd("bodyCode", e.target.value)}
                rows={8}
                placeholder="<noscript>...</noscript>"
                className="bg-secondary border-border text-white font-mono text-xs"
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 max-w-3xl">
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-white border-0">
          {saving ? "..." : "Сохранить"}
        </Button>
        {ok && <span className="text-sm text-green-400 flex items-center gap-1"><Check size={16} /> Сохранено</span>}
        <span className="text-xs text-muted-foreground ml-auto">Коды применяются на публичном сайте после сохранения.</span>
      </div>
    </div>
  );
}

// ===== AI Models Tab =====
type GenProvider = "kie" | "openrouter";
type AiModelCategory = "styles" | "photoshoot" | "review";
interface ModelOption { id: string; name: string; provider: GenProvider; }
interface AiSettings {
  styles: string;
  photoshoot: string;
  review: string;
  styleAssistProvider: GenProvider;
  styleAssistModel: string;
  supportModel: string;
  supportInstructions: string;
  supportInstructionFileName: string;
  photoshootApprovalMode: "manual" | "automatic";
  photoshootVisionModel: string;
}
interface AiKeyStatus {
  openrouter: { configured: boolean; source: "database" | "env" | "none" };
  kie: { configured: boolean; source: "database" | "env" | "none" };
}
interface AiKeyDiagnostic {
  provider: "openrouter" | "kie";
  source: string;
  fingerprint: string;
  ok: boolean | null;
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
  const [keyStatus, setKeyStatus] = useState<AiKeyStatus | null>(null);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [kieKey, setKieKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingInstruction, setUploadingInstruction] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(false);
  const [keyDiagnostics, setKeyDiagnostics] = useState<AiKeyDiagnostic[]>([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [providerByCat, setProviderByCat] = useState<Record<AiModelCategory, GenProvider>>({
    styles: "kie",
    photoshoot: "kie",
    review: "kie",
  });

  const loadAiConfig = useCallback(async () => {
      try {
        const [imageModels, supportTextModels, settingsData, keyData] = await Promise.all([
          apiFetch<ModelOption[]>("/admin/ai/models"),
          apiFetch<ModelOption[]>("/admin/ai/text-models"),
          apiFetch<AiSettings>("/admin/ai/settings"),
          apiFetch<AiKeyStatus>("/admin/ai/keys"),
        ]);
        setModels(imageModels);
        setTextModels(supportTextModels);
        setSettings({
          ...settingsData,
          styleAssistProvider: settingsData.styleAssistProvider ?? providerOf(settingsData.styleAssistModel ?? "openai/gpt-4o-mini"),
          styleAssistModel: settingsData.styleAssistModel ?? "openai/gpt-4o-mini",
          supportModel: settingsData.supportModel ?? "openai/gpt-4o-mini",
          supportInstructions: settingsData.supportInstructions ?? "",
          supportInstructionFileName: settingsData.supportInstructionFileName ?? "",
          photoshootApprovalMode: settingsData.photoshootApprovalMode ?? "manual",
          photoshootVisionModel: settingsData.photoshootVisionModel ?? "openai/gpt-4o-mini",
        });
        setKeyStatus(keyData);
        setProviderByCat({
          styles: providerOf(settingsData.styles),
          photoshoot: providerOf(settingsData.photoshoot),
          review: providerOf(settingsData.review),
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    void loadAiConfig();
  }, [loadAiConfig]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setErr("");
    setOk(false);
    try {
      const keyUpdates: Partial<Record<"openrouter" | "kie", string>> = {};
      if (openrouterKey.trim()) keyUpdates.openrouter = openrouterKey.trim();
      if (kieKey.trim()) keyUpdates.kie = kieKey.trim();
      if (Object.keys(keyUpdates).length > 0) {
        await apiFetch<AiKeyStatus>("/admin/ai/keys", {
          method: "PATCH",
          body: JSON.stringify(keyUpdates),
        });
      }
      const updated = await apiFetch<AiSettings>("/admin/ai/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      setOpenrouterKey("");
      setKieKey("");
      await loadAiConfig();
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

  async function uploadInstruction(file: File | null) {
    if (!file) return;
    setUploadingInstruction(true);
    setErr("");
    setOk(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getToken();
      const res = await fetch("/api/admin/ai/support-instructions-file", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const data = (await res.json()) as Pick<AiSettings, "supportInstructions" | "supportInstructionFileName">;
      setSettings((s) => (s ? { ...s, ...data } : s));
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось загрузить файл");
    } finally {
      setUploadingInstruction(false);
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
          Добавьте API-ключи, затем для каждой категории выберите сервис генерации и конкретную модель. Список моделей OpenRouter подгружается в реальном времени.
        </p>
      </div>

      {err && <div className="text-sm rounded-lg p-3 border text-red-400 bg-red-500/10 border-red-500/30 mb-4">{err}</div>}

      <div className="space-y-5 max-w-2xl">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <div className="font-semibold text-white">API-ключи</div>
            <div className="text-xs text-muted-foreground">Ключи сохраняются в настройках проекта и используются сервером сразу после сохранения.</div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="OpenRouter API key">
              <Input
                type="password"
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder={keyStatus?.openrouter.configured ? "Ключ уже задан" : "sk-or-..."}
                className="bg-secondary border-border text-white"
                autoComplete="off"
              />
              <KeyStatus status={keyStatus?.openrouter} />
            </Field>
            <Field label="KIE / kie.ai API key">
              <Input
                type="password"
                value={kieKey}
                onChange={(e) => setKieKey(e.target.value)}
                placeholder={keyStatus?.kie.configured ? "Ключ уже задан" : "KIE API key"}
                className="bg-secondary border-border text-white"
                autoComplete="off"
              />
              <KeyStatus status={keyStatus?.kie} />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
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
                  key={`${item.provider}-${item.source}-${index}`}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    item.ok === true
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : item.ok === false
                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                        : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{item.provider} · {item.source}</span>
                    <span>{item.status ? `HTTP ${item.status}` : item.ok === null ? "найден" : "без ответа"}</span>
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
          <Field label="Модель для текстов">
            <ModelSelect
              models={textModels.filter((m) => m.provider === (settings?.styleAssistProvider ?? "openrouter"))}
              value={settings?.styleAssistModel ?? ((settings?.styleAssistProvider ?? "openrouter") === "kie" ? "kie:gpt-5-2" : "openai/gpt-4o-mini")}
              onChange={(v) => setSettings((s) => (s ? { ...s, styleAssistModel: v } : s))}
            />
          </Field>
          <div className="mt-2 text-xs text-muted-foreground">
            Превью-картинка стиля по-прежнему создаётся через KIE / Nano Banana Pro.
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <div className="font-semibold text-white">Проверка опорного кадра фотосессии</div>
            <div className="text-xs text-muted-foreground">
              Определяет, кто подтверждает первый кадр перед генерацией серии из 12 фотографий.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "manual" as const, label: "Пользователь", desc: "Показывать кадр и принимать комментарий с правками" },
              { value: "automatic" as const, label: "Нейросеть", desc: "Проверять сходство модели и точность товара автоматически" },
            ].map((option) => {
              const active = settings?.photoshootApprovalMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSettings((s) => s ? { ...s, photoshootApprovalMode: option.value } : s)}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-white"
                      : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{option.label}</span>
                    {active && <Check size={15} className="text-primary shrink-0" />}
                  </div>
                  <div className="text-[11px] leading-tight mt-1">{option.desc}</div>
                </button>
              );
            })}
          </div>
          {settings?.photoshootApprovalMode === "automatic" && (
            <div className="mt-4">
              <Field label="Vision-модель для проверки">
                <ModelSelect
                  models={textModels.filter((m) => m.provider === "openrouter")}
                  value={settings.photoshootVisionModel}
                  onChange={(v) => setSettings((s) => s ? { ...s, photoshootVisionModel: v } : s)}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <div className="font-semibold text-white">ИИ поддержки</div>
            <div className="text-xs text-muted-foreground">
              Выберите OpenRouter-модель, затем загрузите файл или вставьте инструкцию вручную. Помощник будет отвечать и задавать уточняющие вопросы с учетом этой базы.
            </div>
          </div>
          <div className="space-y-4">
            <Field label="Модель OpenRouter для поддержки">
              <ModelSelect
                models={textModels.filter((m) => m.provider === "openrouter")}
                value={settings?.supportModel ?? "openai/gpt-4o-mini"}
                onChange={(v) => setSettings((s) => (s ? { ...s, supportModel: v } : s))}
              />
            </Field>
            <Field label="Файл с инструкциями">
              <div className="rounded-xl border border-dashed border-border bg-secondary p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">
                      {settings?.supportInstructionFileName || "Файл не загружен"}
                    </div>
                    <div className="text-xs text-muted-foreground">TXT, MD, JSON, CSV, HTML, PDF или DOCX до 10 МБ</div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-white">
                    {uploadingInstruction ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Загрузить
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.md,.markdown,.json,.csv,.xml,.html,.htm,.pdf,.docx,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void uploadInstruction(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </Field>
          </div>
          <div className="mt-4">
          <Field label="Инструкция / документ для ассистента">
            <Textarea
              value={settings?.supportInstructions ?? ""}
              onChange={(e) => setSettings((s) => (s ? { ...s, supportInstructions: e.target.value } : s))}
              rows={8}
              placeholder={"Например:\n- говори вежливо и коротко;\n- всегда уточняй email и проблему;\n- если проблема с оплатой, спроси дату платежа и сумму;\n- если генерация не пришла, спроси номер заказа."}
              className="bg-secondary border-border text-white"
            />
          </Field>
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

function KeyStatus({ status }: { status?: AiKeyStatus["openrouter"] }) {
  if (!status) return null;
  if (!status.configured) {
    return <div className="mt-1 text-xs text-amber-400">Ключ не задан</div>;
  }
  return (
    <div className="mt-1 text-xs text-green-400">
      Ключ задан{status.source === "env" ? " через env" : ""}
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
