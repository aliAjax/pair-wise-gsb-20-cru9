import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./styles.css";
import {
  addDays,
  batchStatusMeta,
  formatSlot,
  isExpired,
  lotAlert,
  reservationStatusMeta,
  slideStatusMeta,
  slotOptions,
  todayStr,
  useLabStore,
} from "./store";
import type { Store } from "./store";
import type { Reservation, Slide, SlideStatus, StainBatch } from "./types";

const project = {
  id: "hxwl-06",
  port: 5106,
  title: "显微镜玻片观察",
  subtitle:
    "染色批次与观察预约闭环：批次绑定样本、染色方案、试剂批次与有效期；染色缸与显微镜时段互斥；取消批次级联作废与冻结；复看仅可新增带原因的修订，旧结论全程保留。",
  stack: "React + Vite + TypeScript + CSS",
};

type Msg = { ok: boolean; text: string } | null;

function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="badge" style={{ "--c": color } as CSSProperties}>
      {children}
    </span>
  );
}

function FormMsg({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p className={`form-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>;
}

function MetricCard({ label, value, index }: { label: string; value: number; index: number }) {
  const tones = ["status-ok", "status-watch", "status-danger", "status-ok"];
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={tones[index % tones.length]} />
    </article>
  );
}

// ---------- 染色批次面板 ----------
function BatchPanel({ store }: { store: Store }) {
  const { state } = store;
  const slots = slotOptions();
  const [sampleId, setSampleId] = useState(state.samples[0]?.id ?? "");
  const [protocolId, setProtocolId] = useState(state.protocols[0]?.id ?? "");
  const [tankId, setTankId] = useState(state.tanks[0]?.id ?? "");
  const [slot, setSlot] = useState(slots[0]?.value ?? "");
  const [slideCount, setSlideCount] = useState(4);
  const [lotIds, setLotIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<Msg>(null);

  const protocol = state.protocols.find((p) => p.id === protocolId);

  const submit = () => {
    const result = store.createBatch({ sampleId, protocolId, tankId, slot, lotIds, slideCount });
    if (result.ok) {
      setMsg({ ok: true, text: "批次已创建并占用染色缸时段，玻片进入制备中。" });
      setLotIds([]);
    } else {
      setMsg({ ok: false, text: result.error });
    }
  };

  const act = (result: { ok: true } | { ok: false; error: string }, okText: string) => {
    setMsg(result.ok ? { ok: true, text: okText } : { ok: false, text: result.error });
  };

  const sortedBatches = [...state.batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="workspace">
      <aside className="panel narrow">
        <h2>新建染色批次</h2>
        <div className="form-grid single">
          <label>
            <span>样本</span>
            <select value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
              {state.samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（{s.type}）
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>染色方案</span>
            <select
              value={protocolId}
              onChange={(e) => {
                setProtocolId(e.target.value);
                setLotIds([]);
              }}
            >
              {state.protocols.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（玻片有效 {p.slideValidityDays} 天）
                </option>
              ))}
            </select>
          </label>
          {protocol?.reagents.map((pr, i) => {
            const reagent = state.reagents.find((r) => r.id === pr.reagentId);
            const lots = state.lots.filter((l) => l.reagentId === pr.reagentId);
            return (
              <label key={pr.reagentId}>
                <span>
                  {reagent?.name} · 每批 {pr.amount}
                  {reagent?.unit}
                </span>
                <select
                  value={lotIds[i] ?? ""}
                  onChange={(e) =>
                    setLotIds((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                >
                  <option value="">选择试剂批次</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lotNo} · 余 {lot.quantity}
                      {reagent?.unit} · 效期 {lot.expiresAt}
                      {isExpired(lot.expiresAt) ? "（已过期）" : ""}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          <label>
            <span>染色缸</span>
            <select value={tankId} onChange={(e) => setTankId(e.target.value)}>
              {state.tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>染色时段</span>
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {slots.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>玻片数量</span>
            <input
              type="number"
              min={1}
              max={24}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
            />
          </label>
        </div>
        <button className="primary-action block" onClick={submit}>
          创建批次
        </button>
        <FormMsg msg={msg} />
        <p className="hint">规则：同一染色缸同一时段只能一批；开始染色时校验试剂效期与余量并扣减库存。</p>
      </aside>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>批次流水线</p>
            <h2>染色批次（{state.batches.length}）</h2>
          </div>
        </div>
        <div className="batch-list">
          {sortedBatches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} store={store} onAction={act} />
          ))}
        </div>
      </section>
    </section>
  );
}

function BatchCard({
  batch,
  store,
  onAction,
}: {
  batch: StainBatch;
  store: Store;
  onAction: (r: { ok: true } | { ok: false; error: string }, okText: string) => void;
}) {
  const { state } = store;
  const sample = state.samples.find((s) => s.id === batch.sampleId);
  const protocol = state.protocols.find((p) => p.id === batch.protocolId);
  const tank = state.tanks.find((t) => t.id === batch.tankId);
  const meta = batchStatusMeta[batch.status];
  const slides = state.slides.filter((s) => s.batchId === batch.id);
  const countOf = (st: SlideStatus) => slides.filter((s) => s.status === st).length;

  const cancel = () => {
    if (
      window.confirm(
        `确认取消批次 ${batch.code}？\n将释放染色缸时段，未观察玻片全部作废，已观察玻片冻结，关联的待观察预约一并取消。`,
      )
    ) {
      onAction(store.cancelBatch(batch.id), `批次 ${batch.code} 已取消：染色缸已释放，未观察玻片作废，已观察玻片冻结。`);
    }
  };

  return (
    <article className="batch-card">
      <header>
        <div>
          <strong>{batch.code}</strong>
          <span className="batch-sub">
            {sample?.name} · {protocol?.name}
          </span>
        </div>
        <Badge color={meta.color}>{meta.text}</Badge>
      </header>
      <ul className="batch-meta">
        <li>
          {tank?.name} · {formatSlot(batch.slot)} · 玻片 {batch.slideCount} 张
        </li>
        <li>
          试剂：
          {batch.reagentLots
            .map((br) => {
              const lot = state.lots.find((l) => l.id === br.lotId);
              const reagent = state.reagents.find((r) => r.id === lot?.reagentId);
              return lot ? `${reagent?.name} ${lot.lotNo} ×${br.amount}${reagent?.unit}` : "未知批次";
            })
            .join("；")}
        </li>
        <li>
          可约 {countOf("available")} · 已约 {countOf("reserved")} · 已观察 {countOf("observed") + countOf("frozen")} ·
          作废 {countOf("void")}
        </li>
        {batch.slideExpiresAt && (
          <li className={isExpired(batch.slideExpiresAt) ? "warn-text" : undefined}>
            玻片有效期至 {batch.slideExpiresAt}
            {isExpired(batch.slideExpiresAt) ? "（已过期）" : ""}
          </li>
        )}
      </ul>
      {batch.status !== "cancelled" && (
        <footer className="batch-actions">
          {batch.status === "scheduled" && (
            <button className="primary" onClick={() => onAction(store.startBatch(batch.id), `批次 ${batch.code} 已开始染色，试剂库存已扣减。`)}>
              开始染色
            </button>
          )}
          {batch.status === "staining" && (
            <button className="accent" onClick={() => onAction(store.completeBatch(batch.id), `批次 ${batch.code} 染色完成，玻片已可预约。`)}>
              完成染色
            </button>
          )}
          <button className="danger" onClick={cancel}>
            取消批次
          </button>
        </footer>
      )}
    </article>
  );
}

// ---------- 试剂库存面板 ----------
function InventoryPanel({ store }: { store: Store }) {
  const { state } = store;
  const alertText = { expired: "已过期", soon: "临期（7 天内）", low: "余量偏低" } as const;
  const alertColor = { expired: "#e11d48", soon: "#d97706", low: "#d97706" } as const;
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>库存与效期</p>
          <h2>试剂批次（{state.lots.length}）</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table className="lot-table">
          <thead>
            <tr>
              <th>试剂</th>
              <th>批号</th>
              <th>余量</th>
              <th>有效期至</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {state.lots.map((lot) => {
              const reagent = state.reagents.find((r) => r.id === lot.reagentId);
              const alert = lotAlert(lot);
              return (
                <tr key={lot.id}>
                  <td>{reagent?.name}</td>
                  <td>{lot.lotNo}</td>
                  <td>
                    {lot.quantity}
                    {reagent?.unit}
                  </td>
                  <td className={isExpired(lot.expiresAt) ? "warn-text" : undefined}>{lot.expiresAt}</td>
                  <td>{alert ? <Badge color={alertColor[alert]}>{alertText[alert]}</Badge> : <Badge color="#16a34a">正常</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">开始染色时逐批校验：试剂批次过期或余量不足均不能开始；校验通过后自动扣减库存。</p>
    </section>
  );
}

// ---------- 玻片看板 ----------
function SlideBoard({ store }: { store: Store }) {
  const { state } = store;
  const [filter, setFilter] = useState<SlideStatus | "all">("all");
  const filters: { key: SlideStatus | "all"; text: string }[] = [
    { key: "all", text: "全部" },
    { key: "preparing", text: "制备中" },
    { key: "available", text: "可预约" },
    { key: "reserved", text: "已预约" },
    { key: "observed", text: "已观察" },
    { key: "frozen", text: "已冻结" },
    { key: "void", text: "已作废" },
  ];
  const slides = state.slides.filter((s) => filter === "all" || s.status === filter);
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>玻片流转</p>
          <h2>玻片看板（{slides.length}）</h2>
        </div>
      </div>
      <div className="chips">
        {filters.map((f) => (
          <button key={f.key} className={filter === f.key ? "chip-active" : undefined} onClick={() => setFilter(f.key)}>
            {f.text}
          </button>
        ))}
      </div>
      <div className="slide-grid">
        {slides.map((slide) => {
          const batch = state.batches.find((b) => b.id === slide.batchId);
          const sample = state.samples.find((s) => s.id === batch?.sampleId);
          const meta = slideStatusMeta[slide.status];
          const activeObs = state.observations.find((o) => o.slideId === slide.id && o.status === "active");
          return (
            <article key={slide.id} className="slide-card">
              <header>
                <strong>{slide.label}</strong>
                <Badge color={meta.color}>{meta.text}</Badge>
              </header>
              <p>
                {sample?.name} · 批次 {batch?.code}
              </p>
              {batch?.slideExpiresAt && batch.status === "stained" && (
                <p className={isExpired(batch.slideExpiresAt) ? "warn-text" : undefined}>
                  有效期至 {batch.slideExpiresAt}
                  {isExpired(batch.slideExpiresAt) ? "（已过期）" : ""}
                </p>
              )}
              {activeObs && <p className="hint">当前结论 v{activeObs.version}：{activeObs.conclusion}</p>}
            </article>
          );
        })}
        {slides.length === 0 && <p className="empty">该状态下暂无玻片。</p>}
      </div>
    </section>
  );
}

// ---------- 观察预约面板 ----------
function ReservationPanel({ store }: { store: Store }) {
  const { state } = store;
  const slots = slotOptions();
  const [slideId, setSlideId] = useState("");
  const [microscopeId, setMicroscopeId] = useState(state.microscopes[0]?.id ?? "");
  const [slot, setSlot] = useState(slots[0]?.value ?? "");
  const [observer, setObserver] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const submit = () => {
    const result = store.createReservation({ slideId, microscopeId, slot, observer });
    if (result.ok) {
      setMsg({ ok: true, text: "预约成功，显微镜时段已锁定。" });
      setSlideId("");
      setObserver("");
    } else {
      setMsg({ ok: false, text: result.error });
    }
  };

  const slideLabel = (slide: Slide) => {
    const batch = state.batches.find((b) => b.id === slide.batchId);
    const sample = state.samples.find((s) => s.id === batch?.sampleId);
    const reView = slide.status === "observed" ? "（复看）" : "";
    return `${slide.label} · ${sample?.name ?? ""} · 批次 ${batch?.code ?? ""}${reView}`;
  };

  const sorted = [...state.reservations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="workspace">
      <aside className="panel narrow">
        <h2>新建观察预约</h2>
        <div className="form-grid single">
          <label>
            <span>玻片（仅已染色且未过期）</span>
            <select value={slideId} onChange={(e) => setSlideId(e.target.value)}>
              <option value="">选择玻片</option>
              {store.bookableSlides.map((s) => (
                <option key={s.id} value={s.id}>
                  {slideLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>显微镜</span>
            <select value={microscopeId} onChange={(e) => setMicroscopeId(e.target.value)}>
              {state.microscopes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>观察时段</span>
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {slots.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>观察人</span>
            <input value={observer} placeholder="填写观察人姓名" onChange={(e) => setObserver(e.target.value)} />
          </label>
        </div>
        <button className="primary-action block" onClick={submit}>
          创建预约
        </button>
        <FormMsg msg={msg} />
        <p className="hint">规则：同一显微镜同一时段不能重复占用；已观察玻片可再次预约复看，结论以修订形式追加。</p>
      </aside>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>预约调度</p>
            <h2>观察预约（{state.reservations.length}）</h2>
          </div>
        </div>
        <div className="batch-list">
          {sorted.map((res) => (
            <ReservationCard
              key={res.id}
              res={res}
              store={store}
              open={openId === res.id}
              onToggle={() => setOpenId(openId === res.id ? null : res.id)}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

function ReservationCard({
  res,
  store,
  open,
  onToggle,
}: {
  res: Reservation;
  store: Store;
  open: boolean;
  onToggle: () => void;
}) {
  const { state } = store;
  const slide = state.slides.find((s) => s.id === res.slideId);
  const batch = state.batches.find((b) => b.id === slide?.batchId);
  const sample = state.samples.find((s) => s.id === batch?.sampleId);
  const scope = state.microscopes.find((m) => m.id === res.microscopeId);
  const meta = reservationStatusMeta[res.status];
  const obs = state.observations.find((o) => o.reservationId === res.id);

  return (
    <article className="batch-card">
      <header>
        <div>
          <strong>
            {slide?.label} · {sample?.name}
          </strong>
          <span className="batch-sub">
            {scope?.name} · {formatSlot(res.slot)} · {res.observer}
          </span>
        </div>
        <Badge color={meta.color}>{meta.text}</Badge>
      </header>
      {obs && (
        <p className="hint">
          已提交结论 v{obs.version}：{obs.conclusion}
        </p>
      )}
      {res.status === "booked" && (
        <footer className="batch-actions">
          <button className="primary" onClick={onToggle}>
            {open ? "收起" : "完成观察"}
          </button>
          <button className="danger" onClick={() => store.cancelReservation(res.id)}>
            取消预约
          </button>
        </footer>
      )}
      {open && res.status === "booked" && <CompleteForm store={store} res={res} onDone={onToggle} />}
    </article>
  );
}

function CompleteForm({ store, res, onDone }: { store: Store; res: Reservation; onDone: () => void }) {
  const hasPrior = store.state.observations.some((o) => o.slideId === res.slideId && o.status === "active");
  const [magnification, setMagnification] = useState("400x");
  const [structure, setStructure] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  const submit = () => {
    const result = store.completeReservation(res.id, { magnification, structure, conclusion, reason });
    if (result.ok) {
      onDone();
    } else {
      setMsg({ ok: false, text: result.error });
    }
  };

  return (
    <div className="inline-form">
      {hasPrior && <p className="warn-text">该玻片已有结论，本次为复看：结论将作为新版本追加，必须填写修订原因，旧结论保留。</p>}
      <div className="form-grid">
        <label>
          <span>放大倍数</span>
          <select value={magnification} onChange={(e) => setMagnification(e.target.value)}>
            {["100x", "200x", "400x", "1000x"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>观察结构</span>
          <input value={structure} placeholder="如：细胞壁、细胞核" onChange={(e) => setStructure(e.target.value)} />
        </label>
      </div>
      <label>
        <span>观察结论</span>
        <textarea value={conclusion} placeholder="填写本次观察结论" onChange={(e) => setConclusion(e.target.value)} />
      </label>
      {hasPrior && (
        <label>
          <span>修订原因（复看必填）</span>
          <input value={reason} placeholder="说明本次复看/修订的原因" onChange={(e) => setReason(e.target.value)} />
        </label>
      )}
      <div className="batch-actions">
        <button className="accent" onClick={submit}>
          提交结论
        </button>
      </div>
      <FormMsg msg={msg} />
    </div>
  );
}

// ---------- 结论与修订链面板 ----------
function ObservationPanel({ store }: { store: Store }) {
  const { state } = store;
  const slidesWithObs = state.slides.filter((sl) => state.observations.some((o) => o.slideId === sl.id));
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>结论版本链</p>
          <h2>观察结论与修订（{state.observations.length} 条）</h2>
        </div>
      </div>
      {slidesWithObs.length === 0 && <p className="empty">暂无观察结论。</p>}
      <div className="batch-list">
        {slidesWithObs.map((slide) => {
          const batch = state.batches.find((b) => b.id === slide.batchId);
          const sample = state.samples.find((s) => s.id === batch?.sampleId);
          const chain = state.observations
            .filter((o) => o.slideId === slide.id)
            .sort((a, b) => a.version - b.version);
          const slideMeta = slideStatusMeta[slide.status];
          return (
            <article key={slide.id} className="batch-card">
              <header>
                <div>
                  <strong>
                    {slide.label} · {sample?.name}
                  </strong>
                  <span className="batch-sub">批次 {batch?.code}</span>
                </div>
                <Badge color={slideMeta.color}>{slideMeta.text}</Badge>
              </header>
              <div className="obs-chain">
                {chain.map((o) => (
                  <div key={o.id} className={`obs-node ${o.status}`}>
                    <div className="obs-head">
                      <strong>v{o.version}</strong>
                      {o.status === "active" ? (
                        <Badge color="#16a34a">当前结论</Badge>
                      ) : (
                        <Badge color="#94a3b8">历史版本（已被 v{o.version + 1} 取代）</Badge>
                      )}
                      <span className="obs-meta">
                        {o.magnification} · {o.structure}
                      </span>
                    </div>
                    <p>{o.conclusion}</p>
                    {o.reason && <p className="reason">修订原因：{o.reason}</p>}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------- 主应用 ----------
const tabs = [
  { key: "batches", label: "染色批次" },
  { key: "inventory", label: "试剂库存" },
  { key: "slides", label: "玻片看板" },
  { key: "reservations", label: "观察预约" },
  { key: "observations", label: "结论与修订" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function App() {
  const store = useLabStore();
  const { state } = store;
  const [tab, setTab] = useState<TabKey>("batches");

  const activeBatches = state.batches.filter((b) => b.status === "scheduled" || b.status === "staining").length;
  const availableSlides = state.slides.filter((s) => s.status === "available").length;
  const bookedReservations = state.reservations.filter((r) => r.status === "booked").length;
  const alertLots = state.lots.filter((l) => lotAlert(l) !== null).length;

  const metrics = [
    { label: "进行中批次", value: activeBatches },
    { label: "可预约玻片", value: availableSlides },
    { label: "待观察预约", value: bookedReservations },
    { label: "试剂预警", value: alertLots },
  ];

  const reset = () => {
    if (window.confirm("确认重置为演示数据？当前所有批次、预约与结论将被覆盖。")) {
      store.resetAll();
    }
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">
            {project.id} · port {project.port} · {todayStr()}
          </p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
          <span>数据持久化于浏览器 localStorage，刷新后批次、库存、预约与修订链保持一致。</span>
          <button onClick={reset}>重置演示数据</button>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((m, i) => (
          <MetricCard key={m.label} label={m.label} value={m.value} index={i} />
        ))}
      </section>

      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "batches" && <BatchPanel store={store} />}
      {tab === "inventory" && <InventoryPanel store={store} />}
      {tab === "slides" && <SlideBoard store={store} />}
      {tab === "reservations" && <ReservationPanel store={store} />}
      {tab === "observations" && <ObservationPanel store={store} />}

      <p className="footer-note">数据基准日 {todayStr()} · 演示有效期至 {addDays(todayStr(), 10)}</p>
    </main>
  );
}

export default App;
