export type Id = string;

export interface Sample {
  id: Id;
  name: string;
  type: string;
  source: string;
}

export interface Reagent {
  id: Id;
  name: string;
  unit: string;
}

export interface ReagentRequirement {
  reagentId: Id;
  amountPerSlide: number;
}

export interface Protocol {
  id: Id;
  name: string;
  description: string;
  validDays: number;
  requirements: ReagentRequirement[];
}

export interface ReagentLot {
  id: Id;
  reagentId: Id;
  lotNumber: string;
  expiry: string;
  initialAmount: number;
  remainingAmount: number;
  unit: string;
}

export interface Vat {
  id: Id;
  name: string;
  room: string;
}

export interface Microscope {
  id: Id;
  name: string;
  room: string;
  magnification: string;
}

export interface TimeSlot {
  id: Id;
  label: string;
}

export type BatchStatus = "planned" | "staining" | "stained" | "cancelled";
export type SlideStatus = "pending" | "stained" | "observed" | "void";
export type AppointmentStatus = "booked" | "completed" | "cancelled";

export interface Batch {
  id: Id;
  code: string;
  protocolId: Id;
  sampleIds: Id[];
  slideCountPerSample: number;
  reagentLots: Record<Id, Id>;
  vatId: Id;
  date: string;
  slotId: Id;
  operator: string;
  status: BatchStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  consumption: Record<Id, number>;
  slideIds: Id[];
}

export interface Observation {
  observer: string;
  magnification: string;
  structures: string;
  conclusion: string;
  observedAt: string;
}

export interface Revision {
  id: Id;
  previousRevisionId: Id;
  reason: string;
  observer: string;
  magnification: string;
  structures: string;
  conclusion: string;
  createdAt: string;
}

export interface Slide {
  id: Id;
  code: string;
  sampleId: Id;
  batchId: Id;
  protocolId: Id;
  status: SlideStatus;
  stainedAt?: string;
  expiresAt?: string;
  observedAt?: string;
  originalObservation?: Observation;
  revisions: Revision[];
  voidReason?: string;
}

export interface Appointment {
  id: Id;
  slideId: Id;
  microscopeId: Id;
  date: string;
  slotId: Id;
  observer: string;
  purpose: string;
  status: AppointmentStatus;
  createdAt: string;
  completedAt?: string;
  observation?: Observation;
  cancelReason?: string;
}

export interface AppState {
  version: number;
  samples: Sample[];
  reagents: Reagent[];
  protocols: Protocol[];
  lots: ReagentLot[];
  vats: Vat[];
  microscopes: Microscope[];
  slots: TimeSlot[];
  batches: Batch[];
  slides: Slide[];
  appointments: Appointment[];
}

export const STORAGE_KEY = "hxwl-06-closed-loop-v1";

export const slots: TimeSlot[] = [
  { id: "slot-1", label: "08:00–09:30" },
  { id: "slot-2", label: "10:00–11:30" },
  { id: "slot-3", label: "13:30–15:00" },
  { id: "slot-4", label: "15:30–17:00" },
];

export const vats: Vat[] = [
  { id: "vat-a", name: "染色缸 A", room: "制片室 201" },
  { id: "vat-b", name: "染色缸 B", room: "制片室 201" },
];

export const microscopes: Microscope[] = [
  { id: "scope-1", name: "Olympus BX53", room: "观察室 301", magnification: "40×–1000×" },
  { id: "scope-2", name: "Nikon E200", room: "观察室 302", magnification: "40×–400×" },
];

export const samples: Sample[] = [
  { id: "sample-onion", name: "洋葱表皮", type: "植物组织", source: "实验课材料盒 A1" },
  { id: "sample-oral", name: "人口腔上皮", type: "动物组织", source: "学生涂片样本" },
  { id: "sample-blood", name: "人血涂片", type: "血液涂片", source: "教学标准血涂片" },
  { id: "sample-paramecium", name: "草履虫", type: "微生物", source: "培养液 B3" },
  { id: "sample-pollen", name: "百合花粉", type: "植物组织", source: "温室百合样本" },
  { id: "sample-cardiac", name: "心肌切片", type: "动物组织", source: "组织学标本柜" },
];

export const reagents: Reagent[] = [
  { id: "hematoxylin", name: "苏木素", unit: "mL" },
  { id: "eosin", name: "伊红", unit: "mL" },
  { id: "wright", name: "瑞氏染液", unit: "mL" },
  { id: "iodine", name: "碘液", unit: "mL" },
];

export const protocols: Protocol[] = [
  {
    id: "protocol-he",
    name: "HE 染色",
    description: "苏木素-伊红常规组织染色",
    validDays: 7,
    requirements: [
      { reagentId: "hematoxylin", amountPerSlide: 0.2 },
      { reagentId: "eosin", amountPerSlide: 0.15 },
    ],
  },
  {
    id: "protocol-wright",
    name: "瑞氏染色",
    description: "血细胞涂片常规染色",
    validDays: 5,
    requirements: [{ reagentId: "wright", amountPerSlide: 0.3 }],
  },
  {
    id: "protocol-iodine",
    name: "碘液染色",
    description: "植物表皮与微生物临时染色",
    validDays: 3,
    requirements: [{ reagentId: "iodine", amountPerSlide: 0.1 }],
  },
];

export function uid(prefix: string): Id {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function nowStamp(): string {
  return new Date().toISOString();
}

export function todayISO(): string {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(isoDate?: string): string {
  if (!isoDate) return "—";
  const date = new Date(`${isoDate}T00:00:00`);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${isoDate} 周${weekdays[date.getDay()]}`;
}

export function daysUntil(isoDate: string): number {
  const today = new Date(`${todayISO()}T12:00:00Z`).getTime();
  const target = new Date(`${isoDate}T12:00:00Z`).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function roundAmount(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function batchSlideCount(batch: Batch): number {
  return batch.sampleIds.length * batch.slideCountPerSample;
}

export function isLotExpired(lot: ReagentLot, onDate: string): boolean {
  return lot.expiry < onDate;
}

export function findBatchVatBlocker(state: AppState, batch: Pick<Batch, "id" | "vatId" | "date" | "slotId">): Batch | undefined {
  return state.batches.find(
    (item) =>
      item.id !== batch.id &&
      item.status !== "cancelled" &&
      item.vatId === batch.vatId &&
      item.date === batch.date &&
      item.slotId === batch.slotId
  );
}

export function batchStartIssues(state: AppState, batch: Batch): string[] {
  const issues: string[] = [];
  if (batch.status !== "planned") {
    issues.push("只有待开始批次才能执行开始染色。");
    return issues;
  }

  if (batch.date < todayISO()) {
    issues.push("不能在已经过去的日期安排或开始染色。");
  }

  const blocker = findBatchVatBlocker(state, batch);
  if (blocker) {
    issues.push(`染色缸时段已被 ${blocker.code} 占用。`);
  }

  const protocol = state.protocols.find((item) => item.id === batch.protocolId);
  if (!protocol) {
    issues.push("染色方案不存在。");
    return issues;
  }

  const totalSlides = batchSlideCount(batch);
  if (totalSlides <= 0) {
    issues.push("批次没有绑定样本玻片。");
  }

  protocol.requirements.forEach((requirement) => {
    const reagent = state.reagents.find((item) => item.id === requirement.reagentId);
    const lotId = batch.reagentLots[requirement.reagentId];
    const lot = state.lots.find((item) => item.id === lotId);
    const requiredAmount = roundAmount(requirement.amountPerSlide * totalSlides);

    if (!reagent) return;
    if (!lotId || !lot) {
      issues.push(`${reagent.name}未绑定试剂批次。`);
      return;
    }
    if (lot.reagentId !== requirement.reagentId) {
      issues.push(`${reagent.name}绑定了错误的试剂批次。`);
      return;
    }
    if (isLotExpired(lot, batch.date)) {
      issues.push(`${reagent.name}批次 ${lot.lotNumber} 已于 ${lot.expiry} 过期。`);
    }
    if (lot.remainingAmount < requiredAmount) {
      issues.push(
        `${reagent.name}库存不足：需要 ${requiredAmount}${lot.unit}，仅剩 ${lot.remainingAmount}${lot.unit}。`
      );
    }
  });

  return issues;
}

export function isSlideFreshOn(slide: Slide, date: string): boolean {
  return (
    slide.status === "stained" &&
    Boolean(slide.stainedAt) &&
    Boolean(slide.expiresAt) &&
    date >= slide.stainedAt! &&
    date <= slide.expiresAt!
  );
}

export function hasBookedAppointment(state: AppState, slideId: Id): boolean {
  return state.appointments.some(
    (appointment) => appointment.slideId === slideId && appointment.status === "booked"
  );
}

export interface AppointmentDraft {
  slideId: Id;
  microscopeId: Id;
  date: string;
  slotId: Id;
  observer: string;
  purpose: string;
}

export function appointmentIssues(state: AppState, draft: AppointmentDraft): string[] {
  const issues: string[] = [];
  const slide = state.slides.find((item) => item.id === draft.slideId);
  const microscope = state.microscopes.find((item) => item.id === draft.microscopeId);
  const slot = state.slots.find((item) => item.id === draft.slotId);

  if (!slide) issues.push("请选择需要观察的玻片。");
  if (!microscope) issues.push("请选择显微镜。");
  if (!slot) issues.push("请选择观察时段。");
  if (!draft.observer.trim()) issues.push("请填写预约人。");
  if (draft.date < todayISO()) issues.push("不能预约已经过去的日期。");

  if (slide) {
    if (slide.status !== "stained") issues.push("只有已染色玻片才能预约。");
    if (slide.status === "stained" && slide.stainedAt && draft.date < slide.stainedAt) {
      issues.push("预约时间早于玻片染色完成时间。");
    }
    if (slide.status === "stained" && slide.expiresAt && draft.date > slide.expiresAt) {
      issues.push(`玻片已于 ${slide.expiresAt} 到期，不能预约。`);
    }
    if (hasBookedAppointment(state, slide.id)) issues.push("该玻片已有未完成预约。");
  }

  const conflict = state.appointments.find(
    (appointment) =>
      appointment.status !== "cancelled" &&
      appointment.microscopeId === draft.microscopeId &&
      appointment.date === draft.date &&
      appointment.slotId === draft.slotId
  );
  if (conflict) {
    issues.push(`该显微镜时段已被玻片 ${conflict.slideId} 的预约占用。`);
  }

  return issues;
}

export function createInitialState(): AppState {
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const fourDaysAgo = addDays(today, -4);
  const tenDaysAgo = addDays(today, -10);
  const tomorrow = addDays(today, 1);

  const doneExpiry = addDays(yesterday, protocols[0].validDays);
  const oldExpiry = addDays(tenDaysAgo, protocols[2].validDays);
  const cancelledExpiry = addDays(fourDaysAgo, protocols[2].validDays);

  const batches: Batch[] = [
    {
      id: "bat-done",
      code: "ST-0919-01",
      protocolId: "protocol-he",
      sampleIds: ["sample-onion", "sample-oral", "sample-blood"],
      slideCountPerSample: 1,
      reagentLots: { hematoxylin: "lot-hx-valid", eosin: "lot-eo-valid" },
      vatId: "vat-a",
      date: yesterday,
      slotId: "slot-1",
      operator: "陈实验师",
      status: "stained",
      createdAt: `${yesterday}T01:00:00.000Z`,
      startedAt: `${yesterday}T01:05:00.000Z`,
      completedAt: `${yesterday}T02:00:00.000Z`,
      consumption: { hematoxylin: 0.6, eosin: 0.45 },
      slideIds: ["slide-done-1", "slide-done-2", "slide-done-3"],
    },
    {
      id: "bat-run",
      code: "ST-0920-02",
      protocolId: "protocol-wright",
      sampleIds: ["sample-blood", "sample-paramecium"],
      slideCountPerSample: 1,
      reagentLots: { wright: "lot-wr-valid" },
      vatId: "vat-b",
      date: today,
      slotId: "slot-1",
      operator: "陈实验师",
      status: "staining",
      createdAt: `${today}T00:30:00.000Z`,
      startedAt: `${today}T00:35:00.000Z`,
      consumption: { wright: 0.6 },
      slideIds: ["slide-run-1", "slide-run-2"],
    },
    {
      id: "bat-plan",
      code: "ST-0921-03",
      protocolId: "protocol-he",
      sampleIds: ["sample-onion", "sample-pollen"],
      slideCountPerSample: 1,
      reagentLots: { hematoxylin: "lot-hx-valid", eosin: "lot-eo-valid" },
      vatId: "vat-a",
      date: tomorrow,
      slotId: "slot-1",
      operator: "李管理员",
      status: "planned",
      createdAt: `${today}T01:10:00.000Z`,
      consumption: {},
      slideIds: ["slide-plan-1", "slide-plan-2"],
    },
    {
      id: "bat-old",
      code: "ST-0910-04",
      protocolId: "protocol-iodine",
      sampleIds: ["sample-paramecium"],
      slideCountPerSample: 1,
      reagentLots: { iodine: "lot-io-valid" },
      vatId: "vat-a",
      date: tenDaysAgo,
      slotId: "slot-4",
      operator: "陈实验师",
      status: "stained",
      createdAt: `${tenDaysAgo}T06:00:00.000Z`,
      startedAt: `${tenDaysAgo}T06:05:00.000Z`,
      completedAt: `${tenDaysAgo}T06:40:00.000Z`,
      consumption: { iodine: 0.1 },
      slideIds: ["slide-old-1"],
    },
    {
      id: "bat-cancelled",
      code: "ST-0916-05",
      protocolId: "protocol-iodine",
      sampleIds: ["sample-cardiac", "sample-pollen"],
      slideCountPerSample: 1,
      reagentLots: { iodine: "lot-io-valid" },
      vatId: "vat-b",
      date: fourDaysAgo,
      slotId: "slot-2",
      operator: "李管理员",
      status: "cancelled",
      createdAt: `${fourDaysAgo}T02:00:00.000Z`,
      startedAt: `${fourDaysAgo}T02:05:00.000Z`,
      completedAt: `${fourDaysAgo}T02:40:00.000Z`,
      cancelledAt: `${fourDaysAgo}T05:00:00.000Z`,
      cancelReason: "教学计划调整，取消批次并释放染色缸。",
      consumption: { iodine: 0.2 },
      slideIds: ["slide-cancel-1", "slide-cancel-2"],
    },
  ];

  const slides: Slide[] = [
    {
      id: "slide-done-1",
      code: "SL-0919-A1",
      sampleId: "sample-onion",
      batchId: "bat-done",
      protocolId: "protocol-he",
      status: "stained",
      stainedAt: yesterday,
      expiresAt: doneExpiry,
      revisions: [],
    },
    {
      id: "slide-done-2",
      code: "SL-0919-A2",
      sampleId: "sample-oral",
      batchId: "bat-done",
      protocolId: "protocol-he",
      status: "observed",
      stainedAt: yesterday,
      expiresAt: doneExpiry,
      observedAt: `${yesterday}T07:10:00.000Z`,
      originalObservation: {
        observer: "周教授",
        magnification: "400×",
        structures: "细胞膜、细胞核、细胞质",
        conclusion: "细胞核呈蓝紫色，细胞边界完整，上皮细胞形态正常。",
        observedAt: `${yesterday}T07:10:00.000Z`,
      },
      revisions: [
        {
          id: "revision-seed-1",
          previousRevisionId: "original",
          reason: "学生对细胞核染色深浅提出疑问，申请复看。",
          observer: "陈助教",
          magnification: "400×",
          structures: "细胞核、染色质颗粒",
          conclusion: "复核确认核形态规则，染色质分布均匀，维持原结论。",
          createdAt: `${today}T01:20:00.000Z`,
        },
      ],
    },
    {
      id: "slide-done-3",
      code: "SL-0919-A3",
      sampleId: "sample-blood",
      batchId: "bat-done",
      protocolId: "protocol-he",
      status: "stained",
      stainedAt: yesterday,
      expiresAt: doneExpiry,
      revisions: [],
    },
    {
      id: "slide-run-1",
      code: "SL-0920-B1",
      sampleId: "sample-blood",
      batchId: "bat-run",
      protocolId: "protocol-wright",
      status: "pending",
      revisions: [],
    },
    {
      id: "slide-run-2",
      code: "SL-0920-B2",
      sampleId: "sample-paramecium",
      batchId: "bat-run",
      protocolId: "protocol-wright",
      status: "pending",
      revisions: [],
    },
    {
      id: "slide-plan-1",
      code: "SL-0921-C1",
      sampleId: "sample-onion",
      batchId: "bat-plan",
      protocolId: "protocol-he",
      status: "pending",
      revisions: [],
    },
    {
      id: "slide-plan-2",
      code: "SL-0921-C2",
      sampleId: "sample-pollen",
      batchId: "bat-plan",
      protocolId: "protocol-he",
      status: "pending",
      revisions: [],
    },
    {
      id: "slide-old-1",
      code: "SL-0910-D1",
      sampleId: "sample-paramecium",
      batchId: "bat-old",
      protocolId: "protocol-iodine",
      status: "stained",
      stainedAt: tenDaysAgo,
      expiresAt: oldExpiry,
      revisions: [],
    },
    {
      id: "slide-cancel-1",
      code: "SL-0916-E1",
      sampleId: "sample-cardiac",
      batchId: "bat-cancelled",
      protocolId: "protocol-iodine",
      status: "observed",
      stainedAt: fourDaysAgo,
      expiresAt: cancelledExpiry,
      observedAt: `${fourDaysAgo}T07:00:00.000Z`,
      originalObservation: {
        observer: "林老师",
        magnification: "1000×",
        structures: "横纹、细胞核、肌纤维",
        conclusion: "可见清晰横纹，细胞核呈长椭圆形，肌纤维排列整齐。",
        observedAt: `${fourDaysAgo}T07:00:00.000Z`,
      },
      revisions: [],
    },
    {
      id: "slide-cancel-2",
      code: "SL-0916-E2",
      sampleId: "sample-pollen",
      batchId: "bat-cancelled",
      protocolId: "protocol-iodine",
      status: "void",
      stainedAt: fourDaysAgo,
      expiresAt: cancelledExpiry,
      voidReason: "批次取消，未观察玻片随批次作废。",
      revisions: [],
    },
  ];

  const appointments: Appointment[] = [
    {
      id: "appt-booked-1",
      slideId: "slide-done-1",
      microscopeId: "scope-1",
      date: today,
      slotId: "slot-2",
      observer: "王同学",
      purpose: "课堂细胞壁观察",
      status: "booked",
      createdAt: `${today}T01:30:00.000Z`,
    },
    {
      id: "appt-done-1",
      slideId: "slide-done-2",
      microscopeId: "scope-1",
      date: yesterday,
      slotId: "slot-3",
      observer: "周教授",
      purpose: "上皮细胞形态判读",
      status: "completed",
      createdAt: `${yesterday}T03:00:00.000Z`,
      completedAt: `${yesterday}T07:10:00.000Z`,
      observation: {
        observer: "周教授",
        magnification: "400×",
        structures: "细胞膜、细胞核、细胞质",
        conclusion: "细胞核呈蓝紫色，细胞边界完整，上皮细胞形态正常。",
        observedAt: `${yesterday}T07:10:00.000Z`,
      },
    },
    {
      id: "appt-done-2",
      slideId: "slide-cancel-1",
      microscopeId: "scope-2",
      date: fourDaysAgo,
      slotId: "slot-4",
      observer: "林老师",
      purpose: "心肌横纹复核",
      status: "completed",
      createdAt: `${fourDaysAgo}T03:00:00.000Z`,
      completedAt: `${fourDaysAgo}T07:00:00.000Z`,
      observation: {
        observer: "林老师",
        magnification: "1000×",
        structures: "横纹、细胞核、肌纤维",
        conclusion: "可见清晰横纹，细胞核呈长椭圆形，肌纤维排列整齐。",
        observedAt: `${fourDaysAgo}T07:00:00.000Z`,
      },
    },
  ];

  return {
    version: 1,
    samples,
    reagents,
    protocols,
    vats,
    microscopes,
    slots,
    batches,
    slides,
    appointments,
    lots: [
      {
        id: "lot-hx-valid",
        reagentId: "hematoxylin",
        lotNumber: "HX20260901",
        expiry: addDays(today, 30),
        initialAmount: 13.2,
        remainingAmount: 12,
        unit: "mL",
      },
      {
        id: "lot-hx-low",
        reagentId: "hematoxylin",
        lotNumber: "HX20260818",
        expiry: addDays(today, 10),
        initialAmount: 0.8,
        remainingAmount: 0.4,
        unit: "mL",
      },
      {
        id: "lot-eo-valid",
        reagentId: "eosin",
        lotNumber: "EO20260903",
        expiry: addDays(today, 45),
        initialAmount: 10.9,
        remainingAmount: 10,
        unit: "mL",
      },
      {
        id: "lot-wr-valid",
        reagentId: "wright",
        lotNumber: "WR20260906",
        expiry: addDays(today, 20),
        initialAmount: 8.6,
        remainingAmount: 8,
        unit: "mL",
      },
      {
        id: "lot-wr-expired",
        reagentId: "wright",
        lotNumber: "WR20260801",
        expiry: addDays(today, -5),
        initialAmount: 18,
        remainingAmount: 18,
        unit: "mL",
      },
      {
        id: "lot-io-valid",
        reagentId: "iodine",
        lotNumber: "IO20260908",
        expiry: addDays(today, 15),
        initialAmount: 5.3,
        remainingAmount: 5,
        unit: "mL",
      },
    ],
  };
}
