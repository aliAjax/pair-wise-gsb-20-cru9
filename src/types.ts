export type BatchStatus = "scheduled" | "staining" | "stained" | "cancelled";
export type SlideStatus = "preparing" | "available" | "reserved" | "observed" | "void" | "frozen";
export type ReservationStatus = "booked" | "completed" | "cancelled";
export type ObservationStatus = "active" | "superseded";

export interface Sample {
  id: string;
  name: string;
  type: string;
}

export interface ProtocolReagent {
  reagentId: string;
  amount: number; // 每批用量
}

export interface StainProtocol {
  id: string;
  name: string;
  reagents: ProtocolReagent[];
  slideValidityDays: number; // 染色完成后玻片有效天数
}

export interface Reagent {
  id: string;
  name: string;
  unit: string;
}

export interface ReagentLot {
  id: string;
  reagentId: string;
  lotNo: string;
  quantity: number; // 剩余量
  expiresAt: string; // YYYY-MM-DD
}

export interface Tank {
  id: string;
  name: string;
}

export interface Microscope {
  id: string;
  name: string;
}

export interface BatchReagentLot {
  lotId: string;
  amount: number;
}

export interface StainBatch {
  id: string;
  code: string;
  sampleId: string;
  protocolId: string;
  tankId: string;
  slot: string; // "YYYY-MM-DD|上午"
  reagentLots: BatchReagentLot[];
  slideCount: number;
  status: BatchStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  slideExpiresAt?: string; // 玻片有效期截止日
  cancelledAt?: string;
}

export interface Slide {
  id: string;
  batchId: string;
  label: string;
  status: SlideStatus;
}

export interface Reservation {
  id: string;
  slideId: string;
  microscopeId: string;
  slot: string;
  observer: string;
  status: ReservationStatus;
  createdAt: string;
}

export interface Observation {
  id: string;
  slideId: string;
  reservationId: string;
  magnification: string;
  structure: string;
  conclusion: string;
  version: number;
  reason?: string; // 复看修订原因
  status: ObservationStatus;
  createdAt: string;
}

export interface LabState {
  samples: Sample[];
  protocols: StainProtocol[];
  reagents: Reagent[];
  lots: ReagentLot[];
  tanks: Tank[];
  microscopes: Microscope[];
  batches: StainBatch[];
  slides: Slide[];
  reservations: Reservation[];
  observations: Observation[];
}
