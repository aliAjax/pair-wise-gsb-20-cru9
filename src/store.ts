import { useEffect, useState } from "react";
import type {
  BatchStatus,
  LabState,
  Observation,
  ReagentLot,
  Reservation,
  ReservationStatus,
  Slide,
  SlideStatus,
  StainBatch,
} from "./types";

// ---------- 时间工具 ----------
export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 有效期是否已过（到期日当天仍可用） */
export function isExpired(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return dateStr < todayStr();
}

export const SLOT_PERIODS = ["上午", "下午", "晚上"] as const;

export function slotOptions(days = 5): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = todayStr();
  for (let i = 0; i < days; i += 1) {
    const date = addDays(today, i);
    for (const period of SLOT_PERIODS) {
      options.push({ value: `${date}|${period}`, label: `${date} ${period}` });
    }
  }
  return options;
}

export function formatSlot(slot: string): string {
  return slot.replace("|", " ");
}

// ---------- 状态文案与颜色 ----------
export const batchStatusMeta: Record<BatchStatus, { text: string; color: string }> = {
  scheduled: { text: "已排程", color: "#4338ca" },
  staining: { text: "染色中", color: "#0d9488" },
  stained: { text: "已染色", color: "#16a34a" },
  cancelled: { text: "已取消", color: "#94a3b8" },
};

export const slideStatusMeta: Record<SlideStatus, { text: string; color: string }> = {
  preparing: { text: "制备中", color: "#d97706" },
  available: { text: "可预约", color: "#16a34a" },
  reserved: { text: "已预约", color: "#4338ca" },
  observed: { text: "已观察", color: "#7c3aed" },
  void: { text: "已作废", color: "#94a3b8" },
  frozen: { text: "已冻结", color: "#475569" },
};

export const reservationStatusMeta: Record<ReservationStatus, { text: string; color: string }> = {
  booked: { text: "待观察", color: "#4338ca" },
  completed: { text: "已完成", color: "#16a34a" },
  cancelled: { text: "已取消", color: "#94a3b8" },
};

/** 试剂批次预警：已过期 / 7 天内到期 / 余量偏低 */
export function lotAlert(lot: ReagentLot): "expired" | "soon" | "low" | null {
  if (isExpired(lot.expiresAt)) return "expired";
  if (lot.expiresAt <= addDays(todayStr(), 7)) return "soon";
  if (lot.quantity < 10) return "low";
  return null;
}

// ---------- ID ----------
let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

// ---------- 初始演示数据（基于当天日期生成） ----------
export function seedState(): LabState {
  const today = todayStr();
  const now = new Date().toISOString();
  return {
    samples: [
      { id: "s-onion", name: "洋葱表皮", type: "植物组织" },
      { id: "s-blood", name: "人血涂片", type: "血液涂片" },
      { id: "s-para", name: "草履虫", type: "微生物" },
      { id: "s-liver", name: "小鼠肝切片", type: "动物组织" },
    ],
    protocols: [
      { id: "p-iodine", name: "碘液染色", reagents: [{ reagentId: "r-iodine", amount: 5 }], slideValidityDays: 5 },
      {
        id: "p-wright",
        name: "瑞氏染色",
        reagents: [
          { reagentId: "r-wright", amount: 8 },
          { reagentId: "r-buffer", amount: 10 },
        ],
        slideValidityDays: 7,
      },
      {
        id: "p-he",
        name: "HE 染色",
        reagents: [
          { reagentId: "r-hematoxylin", amount: 6 },
          { reagentId: "r-eosin", amount: 6 },
        ],
        slideValidityDays: 10,
      },
      {
        id: "p-gram",
        name: "革兰染色",
        reagents: [
          { reagentId: "r-crystal", amount: 4 },
          { reagentId: "r-iodine", amount: 3 },
          { reagentId: "r-safranin", amount: 4 },
        ],
        slideValidityDays: 6,
      },
    ],
    reagents: [
      { id: "r-iodine", name: "碘液", unit: "ml" },
      { id: "r-wright", name: "瑞氏染液", unit: "ml" },
      { id: "r-buffer", name: "磷酸盐缓冲液", unit: "ml" },
      { id: "r-hematoxylin", name: "苏木精", unit: "ml" },
      { id: "r-eosin", name: "伊红", unit: "ml" },
      { id: "r-crystal", name: "结晶紫", unit: "ml" },
      { id: "r-safranin", name: "番红", unit: "ml" },
    ],
    lots: [
      { id: "lot-iodine-a", reagentId: "r-iodine", lotNo: "LD-2608", quantity: 120, expiresAt: addDays(today, 45) },
      { id: "lot-iodine-b", reagentId: "r-iodine", lotNo: "LD-2603", quantity: 3, expiresAt: addDays(today, 20) },
      { id: "lot-wright-a", reagentId: "r-wright", lotNo: "RS-2611", quantity: 90, expiresAt: addDays(today, 18) },
      { id: "lot-buffer-a", reagentId: "r-buffer", lotNo: "HC-2654", quantity: 200, expiresAt: addDays(today, 90) },
      { id: "lot-hema-a", reagentId: "r-hematoxylin", lotNo: "SM-2627", quantity: 80, expiresAt: addDays(today, 40) },
      { id: "lot-eosin-a", reagentId: "r-eosin", lotNo: "YH-2598", quantity: 60, expiresAt: addDays(today, -2) },
      { id: "lot-eosin-b", reagentId: "r-eosin", lotNo: "YH-2641", quantity: 75, expiresAt: addDays(today, 30) },
      { id: "lot-crystal-a", reagentId: "r-crystal", lotNo: "JJ-2666", quantity: 50, expiresAt: addDays(today, 25) },
      { id: "lot-safranin-a", reagentId: "r-safranin", lotNo: "FH-2615", quantity: 40, expiresAt: addDays(today, 5) },
    ],
    tanks: [
      { id: "t-a", name: "染色缸 A" },
      { id: "t-b", name: "染色缸 B" },
      { id: "t-c", name: "染色缸 C" },
    ],
    microscopes: [
      { id: "m-1", name: "显微镜 M1（油镜）" },
      { id: "m-2", name: "显微镜 M2" },
      { id: "m-3", name: "显微镜 M3" },
    ],
    batches: [
      {
        id: "b-1",
        code: "B001",
        sampleId: "s-blood",
        protocolId: "p-wright",
        tankId: "t-a",
        slot: `${today}|上午`,
        reagentLots: [
          { lotId: "lot-wright-a", amount: 8 },
          { lotId: "lot-buffer-a", amount: 10 },
        ],
        slideCount: 4,
        status: "stained",
        createdAt: now,
        startedAt: now,
        completedAt: now,
        slideExpiresAt: addDays(today, 7),
      },
      {
        id: "b-2",
        code: "B002",
        sampleId: "s-onion",
        protocolId: "p-iodine",
        tankId: "t-b",
        slot: `${today}|下午`,
        reagentLots: [{ lotId: "lot-iodine-a", amount: 5 }],
        slideCount: 3,
        status: "staining",
        createdAt: now,
        startedAt: now,
      },
      {
        id: "b-3",
        code: "B003",
        sampleId: "s-para",
        protocolId: "p-gram",
        tankId: "t-c",
        slot: `${addDays(today, 1)}|上午`,
        reagentLots: [
          { lotId: "lot-crystal-a", amount: 4 },
          { lotId: "lot-iodine-a", amount: 3 },
          { lotId: "lot-safranin-a", amount: 4 },
        ],
        slideCount: 3,
        status: "scheduled",
        createdAt: now,
      },
    ],
    slides: [
      { id: "sl-1", batchId: "b-1", label: "B001-01", status: "observed" },
      { id: "sl-2", batchId: "b-1", label: "B001-02", status: "reserved" },
      { id: "sl-3", batchId: "b-1", label: "B001-03", status: "available" },
      { id: "sl-4", batchId: "b-1", label: "B001-04", status: "available" },
      { id: "sl-5", batchId: "b-2", label: "B002-01", status: "preparing" },
      { id: "sl-6", batchId: "b-2", label: "B002-02", status: "preparing" },
      { id: "sl-7", batchId: "b-2", label: "B002-03", status: "preparing" },
      { id: "sl-8", batchId: "b-3", label: "B003-01", status: "preparing" },
      { id: "sl-9", batchId: "b-3", label: "B003-02", status: "preparing" },
      { id: "sl-10", batchId: "b-3", label: "B003-03", status: "preparing" },
    ],
    reservations: [
      { id: "res-0a", slideId: "sl-1", microscopeId: "m-2", slot: `${addDays(today, -1)}|下午`, observer: "王老师", status: "completed", createdAt: now },
      { id: "res-0b", slideId: "sl-1", microscopeId: "m-2", slot: `${today}|上午`, observer: "王老师", status: "completed", createdAt: now },
      { id: "res-1", slideId: "sl-2", microscopeId: "m-1", slot: `${today}|下午`, observer: "李同学", status: "booked", createdAt: now },
    ],
    observations: [
      {
        id: "ob-1",
        slideId: "sl-1",
        reservationId: "res-0a",
        magnification: "400x",
        structure: "红细胞形态",
        conclusion: "红细胞分布均匀，未见明显异常。",
        version: 1,
        status: "superseded",
        createdAt: now,
      },
      {
        id: "ob-2",
        slideId: "sl-1",
        reservationId: "res-0b",
        magnification: "1000x",
        structure: "红细胞形态、白细胞分类",
        conclusion: "红细胞分布均匀，可见少量嗜中性粒细胞，建议随访。",
        version: 2,
        reason: "初次观察倍数不足，复看确认白细胞分类",
        status: "active",
        createdAt: now,
      },
    ],
  };
}

// ---------- 持久化 ----------
const STORAGE_KEY = "hxwl06-lab-v1";

function loadState(): LabState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LabState;
      if (parsed && Array.isArray(parsed.batches) && Array.isArray(parsed.observations)) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回退到演示数据
  }
  return seedState();
}

// ---------- 业务规则（纯函数，可独立测试） ----------
export type RuleResult = { ok: true; state: LabState } | { ok: false; error: string };
const ruleFail = (error: string): RuleResult => ({ ok: false, error });

export interface CreateBatchInput {
  sampleId: string;
  protocolId: string;
  tankId: string;
  slot: string;
  lotIds: string[]; // 与方案所需试剂一一对应
  slideCount: number;
}

export interface CreateReservationInput {
  slideId: string;
  microscopeId: string;
  slot: string;
  observer: string;
}

export interface CompleteReservationInput {
  magnification: string;
  structure: string;
  conclusion: string;
  reason: string;
}

/** 可预约玻片：已染色、未过期、当前未被占用（可约/已观察可复看） */
export function selectBookableSlides(state: LabState): Slide[] {
  return state.slides.filter((s) => {
    if (s.status !== "available" && s.status !== "observed") return false;
    const batch = state.batches.find((b) => b.id === s.batchId);
    return !!batch && batch.status === "stained" && !isExpired(batch.slideExpiresAt);
  });
}

/** 创建染色批次：绑定样本、方案、试剂批次；同缸同时段互斥 */
export function createBatchRule(state: LabState, input: CreateBatchInput): RuleResult {
  const protocol = state.protocols.find((p) => p.id === input.protocolId);
  if (!protocol) return ruleFail("请选择染色方案");
  if (!state.samples.some((s) => s.id === input.sampleId)) return ruleFail("请选择样本");
  const tank = state.tanks.find((t) => t.id === input.tankId);
  if (!tank) return ruleFail("请选择染色缸");
  if (!input.slot) return ruleFail("请选择染色时段");
  if (!Number.isFinite(input.slideCount) || input.slideCount < 1 || input.slideCount > 24) {
    return ruleFail("玻片数量需在 1-24 之间");
  }
  if (input.lotIds.length !== protocol.reagents.length || input.lotIds.some((id) => !id)) {
    return ruleFail("请为方案中的每种试剂选择试剂批次");
  }
  for (const lotId of input.lotIds) {
    if (!state.lots.some((l) => l.id === lotId)) return ruleFail("所选试剂批次不存在");
  }
  const clash = state.batches.find(
    (b) =>
      b.tankId === input.tankId &&
      b.slot === input.slot &&
      (b.status === "scheduled" || b.status === "staining"),
  );
  if (clash) {
    return ruleFail(`${tank.name} 在 ${formatSlot(input.slot)} 已被批次 ${clash.code} 占用，同一染色缸同一时段只能一批`);
  }

  const batchId = uid("batch");
  const code = `B${String(state.batches.length + 1).padStart(3, "0")}`;
  const batch: StainBatch = {
    id: batchId,
    code,
    sampleId: input.sampleId,
    protocolId: input.protocolId,
    tankId: input.tankId,
    slot: input.slot,
    reagentLots: protocol.reagents.map((r, i) => ({ lotId: input.lotIds[i], amount: r.amount })),
    slideCount: input.slideCount,
    status: "scheduled",
    createdAt: new Date().toISOString(),
  };
  const slides: Slide[] = Array.from({ length: input.slideCount }, (_, i) => ({
    id: uid("slide"),
    batchId,
    label: `${code}-${String(i + 1).padStart(2, "0")}`,
    status: "preparing",
  }));
  return { ok: true, state: { ...state, batches: [...state.batches, batch], slides: [...state.slides, ...slides] } };
}

/** 开始染色：试剂批次过期或余量不足则不能开始；通过后扣减库存 */
export function startBatchRule(state: LabState, batchId: string): RuleResult {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch || batch.status !== "scheduled") return ruleFail("批次不在待开始状态");
  for (const br of batch.reagentLots) {
    const lot = state.lots.find((l) => l.id === br.lotId);
    if (!lot) return ruleFail("绑定的试剂批次不存在");
    const reagent = state.reagents.find((r) => r.id === lot.reagentId);
    const name = `${reagent?.name ?? "试剂"}（批号 ${lot.lotNo}）`;
    if (isExpired(lot.expiresAt)) {
      return ruleFail(`试剂批次 ${name} 已于 ${lot.expiresAt} 过期，不能开始染色`);
    }
    if (lot.quantity < br.amount) {
      return ruleFail(`试剂 ${name} 余量不足：需要 ${br.amount}${reagent?.unit ?? ""}，仅剩 ${lot.quantity}${reagent?.unit ?? ""}`);
    }
  }
  return {
    ok: true,
    state: {
      ...state,
      lots: state.lots.map((l) => {
        const br = batch.reagentLots.find((x) => x.lotId === l.id);
        return br ? { ...l, quantity: l.quantity - br.amount } : l;
      }),
      batches: state.batches.map((b) =>
        b.id === batchId ? { ...b, status: "staining", startedAt: new Date().toISOString() } : b,
      ),
    },
  };
}

/** 完成染色：释放染色缸，玻片转为可预约并写入有效期 */
export function completeBatchRule(state: LabState, batchId: string): RuleResult {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch || batch.status !== "staining") return ruleFail("批次不在染色中状态");
  const protocol = state.protocols.find((p) => p.id === batch.protocolId);
  const slideExpiresAt = addDays(todayStr(), protocol?.slideValidityDays ?? 7);
  return {
    ok: true,
    state: {
      ...state,
      batches: state.batches.map((b) =>
        b.id === batchId
          ? { ...b, status: "stained", completedAt: new Date().toISOString(), slideExpiresAt }
          : b,
      ),
      slides: state.slides.map((sl) =>
        sl.batchId === batchId && sl.status === "preparing" ? { ...sl, status: "available" } : sl,
      ),
    },
  };
}

/** 取消批次：释放染色缸；未观察玻片作废、已观察玻片冻结；关联待观察预约取消 */
export function cancelBatchRule(state: LabState, batchId: string): RuleResult {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) return ruleFail("批次不存在");
  if (batch.status === "cancelled") return ruleFail("批次已取消");
  const slideIds = new Set(state.slides.filter((sl) => sl.batchId === batchId).map((sl) => sl.id));
  return {
    ok: true,
    state: {
      ...state,
      batches: state.batches.map((b) =>
        b.id === batchId ? { ...b, status: "cancelled", cancelledAt: new Date().toISOString() } : b,
      ),
      slides: state.slides.map((sl) => {
        if (sl.batchId !== batchId) return sl;
        return sl.status === "observed" ? { ...sl, status: "frozen" } : { ...sl, status: "void" };
      }),
      reservations: state.reservations.map((r) =>
        r.status === "booked" && slideIds.has(r.slideId) ? { ...r, status: "cancelled" } : r,
      ),
    },
  };
}

/** 创建预约：仅已染色未过期玻片；同一显微镜同一时段不可重复占用 */
export function createReservationRule(state: LabState, input: CreateReservationInput): RuleResult {
  const slide = state.slides.find((s) => s.id === input.slideId);
  if (!slide) return ruleFail("请选择玻片");
  if (slide.status !== "available" && slide.status !== "observed") {
    return ruleFail("该玻片当前不可预约（仅可预约已染色且未被占用的玻片）");
  }
  const batch = state.batches.find((b) => b.id === slide.batchId);
  if (!batch || batch.status !== "stained") return ruleFail("该玻片尚未完成染色，不能预约");
  if (isExpired(batch.slideExpiresAt)) {
    return ruleFail(`玻片已于 ${batch.slideExpiresAt} 过期，不能预约`);
  }
  const scope = state.microscopes.find((m) => m.id === input.microscopeId);
  if (!scope) return ruleFail("请选择显微镜");
  if (!input.slot) return ruleFail("请选择观察时段");
  if (!input.observer.trim()) return ruleFail("请填写观察人");
  const clash = state.reservations.find(
    (r) => r.microscopeId === input.microscopeId && r.slot === input.slot && r.status === "booked",
  );
  if (clash) {
    return ruleFail(`${scope.name} 在 ${formatSlot(input.slot)} 已被预约，同一时段不能重复占用`);
  }
  const reservation: Reservation = {
    id: uid("res"),
    slideId: slide.id,
    microscopeId: input.microscopeId,
    slot: input.slot,
    observer: input.observer.trim(),
    status: "booked",
    createdAt: new Date().toISOString(),
  };
  return {
    ok: true,
    state: {
      ...state,
      reservations: [...state.reservations, reservation],
      slides: state.slides.map((sl) => (sl.id === slide.id ? { ...sl, status: "reserved" } : sl)),
    },
  };
}

/** 取消预约：释放显微镜时段，玻片回到可约/已观察状态 */
export function cancelReservationRule(state: LabState, reservationId: string): RuleResult {
  const res = state.reservations.find((r) => r.id === reservationId);
  if (!res || res.status !== "booked") return ruleFail("预约不存在或已结束");
  return {
    ok: true,
    state: {
      ...state,
      reservations: state.reservations.map((r) =>
        r.id === reservationId ? { ...r, status: "cancelled" } : r,
      ),
      slides: state.slides.map((sl) => {
        if (sl.id !== res.slideId || sl.status !== "reserved") return sl;
        const batch = state.batches.find((b) => b.id === sl.batchId);
        if (!batch || batch.status !== "stained") return sl;
        const hasObservation = state.observations.some((o) => o.slideId === sl.id);
        return { ...sl, status: hasObservation ? "observed" : "available" };
      }),
    },
  };
}

/** 完成观察：首看生成 v1；复看必须填写修订原因，旧结论保留为历史版本 */
export function completeReservationRule(
  state: LabState,
  reservationId: string,
  input: CompleteReservationInput,
): RuleResult {
  const res = state.reservations.find((r) => r.id === reservationId);
  if (!res || res.status !== "booked") return ruleFail("预约不存在或已结束");
  if (!input.magnification) return ruleFail("请选择放大倍数");
  if (!input.structure.trim()) return ruleFail("请填写观察结构");
  if (!input.conclusion.trim()) return ruleFail("请填写观察结论");
  const priorVersions = state.observations.filter((o) => o.slideId === res.slideId);
  const currentActive = priorVersions.find((o) => o.status === "active");
  if (currentActive && !input.reason.trim()) {
    return ruleFail("该玻片已有结论，复看必须填写修订原因");
  }
  const observation: Observation = {
    id: uid("obs"),
    slideId: res.slideId,
    reservationId: res.id,
    magnification: input.magnification,
    structure: input.structure.trim(),
    conclusion: input.conclusion.trim(),
    version: priorVersions.length + 1,
    reason: currentActive ? input.reason.trim() : undefined,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  return {
    ok: true,
    state: {
      ...state,
      observations: [
        ...state.observations.map((o) =>
          o.slideId === res.slideId && o.status === "active" ? { ...o, status: "superseded" as const } : o,
        ),
        observation,
      ],
      reservations: state.reservations.map((r) =>
        r.id === reservationId ? { ...r, status: "completed" } : r,
      ),
      slides: state.slides.map((sl) => (sl.id === res.slideId ? { ...sl, status: "observed" } : sl)),
    },
  };
}

// ---------- Store（React 包装：应用规则并持久化） ----------
export type Result = { ok: true } | { ok: false; error: string };
const OK: Result = { ok: true };

export function useLabStore() {
  const [state, setState] = useState<LabState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const apply = (result: RuleResult): Result => {
    if (!result.ok) return { ok: false, error: result.error };
    setState(result.state);
    return OK;
  };

  return {
    state,
    bookableSlides: selectBookableSlides(state),
    createBatch: (input: CreateBatchInput) => apply(createBatchRule(state, input)),
    startBatch: (batchId: string) => apply(startBatchRule(state, batchId)),
    completeBatch: (batchId: string) => apply(completeBatchRule(state, batchId)),
    cancelBatch: (batchId: string) => apply(cancelBatchRule(state, batchId)),
    createReservation: (input: CreateReservationInput) => apply(createReservationRule(state, input)),
    cancelReservation: (reservationId: string) => apply(cancelReservationRule(state, reservationId)),
    completeReservation: (reservationId: string, input: CompleteReservationInput) =>
      apply(completeReservationRule(state, reservationId, input)),
    resetAll: () => setState(seedState()),
  };
}

export type Store = ReturnType<typeof useLabStore>;
