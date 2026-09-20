import {
  addDays,
  AppointmentDraft,
  appointmentIssues,
  AppState,
  Batch,
  batchSlideCount,
  batchStartIssues,
  createInitialState,
  Id,
  nowStamp,
  Observation,
  ReagentLot,
  Revision,
  roundAmount,
  Slide,
  STORAGE_KEY,
  uid,
} from "./domain";

export type StoreAction =
  | { type: "reset-demo" }
  | {
      type: "create-batch";
      protocolId: Id;
      sampleIds: Id[];
      slideCountPerSample: number;
      reagentLots: Record<Id, Id>;
      vatId: Id;
      date: string;
      slotId: Id;
      operator: string;
    }
  | { type: "start-batch"; batchId: Id }
  | { type: "complete-batch"; batchId: Id }
  | { type: "cancel-batch"; batchId: Id; reason: string }
  | { type: "create-appointment"; draft: AppointmentDraft }
  | { type: "cancel-appointment"; appointmentId: Id; reason: string }
  | {
      type: "complete-appointment";
      appointmentId: Id;
      observation: Omit<Observation, "observedAt">;
    }
  | {
      type: "add-revision";
      slideId: Id;
      revision: Omit<Revision, "id" | "previousRevisionId" | "createdAt">;
    }
  | { type: "add-lot"; lot: Omit<ReagentLot, "id" | "initialAmount"> };

function cloneState(state: AppState): AppState {
  return {
    ...state,
    samples: [...state.samples],
    reagents: [...state.reagents],
    protocols: [...state.protocols],
    vats: [...state.vats],
    microscopes: [...state.microscopes],
    slots: [...state.slots],
    lots: state.lots.map((lot) => ({ ...lot })),
    batches: state.batches.map((batch) => ({
      ...batch,
      sampleIds: [...batch.sampleIds],
      slideIds: [...batch.slideIds],
      reagentLots: { ...batch.reagentLots },
      consumption: { ...batch.consumption },
    })),
    slides: state.slides.map((slide) => ({
      ...slide,
      revisions: slide.revisions.map((revision) => ({ ...revision })),
      originalObservation: slide.originalObservation ? { ...slide.originalObservation } : undefined,
    })),
    appointments: state.appointments.map((appointment) => ({
      ...appointment,
      observation: appointment.observation ? { ...appointment.observation } : undefined,
    })),
  };
}

function createPendingSlides(batch: Batch): Slide[] {
  return batch.sampleIds.flatMap((sampleId, sampleIndex) =>
    Array.from({ length: batch.slideCountPerSample }, (_, slideIndex) => {
      const sequence = sampleIndex * batch.slideCountPerSample + slideIndex + 1;
      return {
        id: uid("slide"),
        code: `${batch.code}-${String(sequence).padStart(2, "0")}`,
        sampleId,
        batchId: batch.id,
        protocolId: batch.protocolId,
        status: "pending" as const,
        revisions: [],
      };
    })
  );
}

export function reducer(input: AppState, action: StoreAction): AppState {
  switch (action.type) {
    case "reset-demo":
      return createInitialState();

    case "create-batch": {
      if (!action.protocolId || !action.vatId || !action.date || !action.slotId) return input;
      if (!action.sampleIds.length || action.slideCountPerSample < 1) return input;
      if (!action.operator.trim()) return input;

      const protocol = input.protocols.find((item) => item.id === action.protocolId);
      if (!protocol) return input;
      const missingLot = protocol.requirements.some(
        (requirement) => !action.reagentLots[requirement.reagentId]
      );
      if (missingLot) return input;

      const vatBlocker = input.batches.find(
        (batch) =>
          batch.status !== "cancelled" &&
          batch.vatId === action.vatId &&
          batch.date === action.date &&
          batch.slotId === action.slotId
      );
      if (vatBlocker) return input;

      const state = cloneState(input);
      const id = uid("bat");
      const datePart = action.date.slice(5).replace("-", "");
      const serial = state.batches.length + 1;
      const batch: Batch = {
        id,
        code: `ST-${datePart}-${String(serial).padStart(2, "0")}`,
        protocolId: protocol.id,
        sampleIds: [...new Set(action.sampleIds)],
        slideCountPerSample: action.slideCountPerSample,
        reagentLots: { ...action.reagentLots },
        vatId: action.vatId,
        date: action.date,
        slotId: action.slotId,
        operator: action.operator.trim(),
        status: "planned",
        createdAt: nowStamp(),
        consumption: {},
        slideIds: [],
      };
      const slides = createPendingSlides(batch);
      batch.slideIds = slides.map((slide) => slide.id);
      state.batches.push(batch);
      state.slides.push(...slides);
      return state;
    }

    case "start-batch": {
      const batch = input.batches.find((item) => item.id === action.batchId);
      if (!batch || batchStartIssues(input, batch).length) return input;
      const state = cloneState(input);
      const target = state.batches.find((item) => item.id === action.batchId)!;
      const targetProtocol = state.protocols.find((item) => item.id === target.protocolId)!;
      const totalSlides = batchSlideCount(target);
      const consumption: Record<Id, number> = {};

      targetProtocol.requirements.forEach((requirement) => {
        const amount = roundAmount(requirement.amountPerSlide * totalSlides);
        const lotId = target.reagentLots[requirement.reagentId];
        const lot = state.lots.find((item) => item.id === lotId)!;
        lot.remainingAmount = roundAmount(lot.remainingAmount - amount);
        consumption[requirement.reagentId] = amount;
      });

      target.status = "staining";
      target.startedAt = nowStamp();
      target.consumption = consumption;
      return state;
    }

    case "complete-batch": {
      const batch = input.batches.find((item) => item.id === action.batchId);
      if (!batch || batch.status !== "staining") return input;
      const protocol = input.protocols.find((item) => item.id === batch.protocolId);
      if (!protocol) return input;

      const expiresAt = addDays(batch.date, protocol.validDays);
      const completedAt = nowStamp();
      return {
        ...input,
        batches: input.batches.map((item) =>
          item.id === action.batchId ? { ...item, status: "stained", completedAt } : item
        ),
        slides: input.slides.map((slide) =>
          slide.batchId === action.batchId && slide.status === "pending"
            ? { ...slide, status: "stained", stainedAt: batch.date, expiresAt }
            : slide
        ),
      };
    }

    case "cancel-batch": {
      const batch = input.batches.find((item) => item.id === action.batchId);
      if (!batch || batch.status === "cancelled" || !action.reason.trim()) return input;

      const state = cloneState(input);
      const target = state.batches.find((item) => item.id === action.batchId)!;
      target.status = "cancelled";
      target.cancelledAt = nowStamp();
      target.cancelReason = action.reason.trim();

      state.slides = state.slides.map((slide) => {
        if (slide.batchId !== action.batchId || slide.status === "observed") return slide;
        return {
          ...slide,
          status: "void",
          voidReason: "取消批次：释放染色缸，未观察玻片作废。",
        };
      });

      state.appointments = state.appointments.map((appointment) =>
        appointment.status === "booked" && target.slideIds.includes(appointment.slideId)
          ? { ...appointment, status: "cancelled", cancelReason: "所属染色批次已取消。" }
          : appointment
      );
      return state;
    }

    case "create-appointment": {
      if (appointmentIssues(input, action.draft).length) return input;
      const state = cloneState(input);
      state.appointments.push({
        id: uid("appt"),
        ...action.draft,
        observer: action.draft.observer.trim(),
        purpose: action.draft.purpose.trim(),
        status: "booked",
        createdAt: nowStamp(),
      });
      return state;
    }

    case "cancel-appointment": {
      const appointment = input.appointments.find((item) => item.id === action.appointmentId);
      if (!appointment || appointment.status !== "booked" || !action.reason.trim()) return input;
      const state = cloneState(input);
      const target = state.appointments.find((item) => item.id === action.appointmentId)!;
      target.status = "cancelled";
      target.cancelReason = action.reason.trim();
      return state;
    }

    case "complete-appointment": {
      const appointment = input.appointments.find((item) => item.id === action.appointmentId);
      if (!appointment || appointment.status !== "booked") return input;
      const slide = input.slides.find((item) => item.id === appointment.slideId);
      if (!slide || slide.status !== "stained" || !slide.expiresAt || appointment.date > slide.expiresAt) {
        return input;
      }
      if (!action.observation.observer.trim() || !action.observation.conclusion.trim()) return input;

      const state = cloneState(input);
      const observedAt = nowStamp();
      const observation: Observation = { ...action.observation, observedAt };
      const targetAppointment = state.appointments.find((item) => item.id === action.appointmentId)!;
      targetAppointment.status = "completed";
      targetAppointment.completedAt = observedAt;
      targetAppointment.observation = observation;
      state.slides = state.slides.map((item) =>
        item.id === slide.id
          ? { ...item, status: "observed", observedAt, originalObservation: observation }
          : item
      );
      return state;
    }

    case "add-revision": {
      const slide = input.slides.find((item) => item.id === action.slideId);
      if (!slide || slide.status !== "observed" || !slide.originalObservation) return input;
      if (!action.revision.reason.trim() || !action.revision.conclusion.trim()) return input;

      const state = cloneState(input);
      const target = state.slides.find((item) => item.id === action.slideId)!;
      const revision: Revision = {
        ...action.revision,
        reason: action.revision.reason.trim(),
        id: uid("rev"),
        previousRevisionId: target.revisions.length
          ? target.revisions[target.revisions.length - 1].id
          : "original",
        createdAt: nowStamp(),
      };
      target.revisions.push(revision);
      return state;
    }

    case "add-lot": {
      if (!action.lot.reagentId || !action.lot.lotNumber.trim() || action.lot.remainingAmount < 0) {
        return input;
      }
      const reagent = input.reagents.find((item) => item.id === action.lot.reagentId);
      if (!reagent) return input;
      const lotNumber = action.lot.lotNumber.trim();
      if (input.lots.some((lot) => lot.lotNumber === lotNumber)) return input;

      const state = cloneState(input);
      const amount = roundAmount(action.lot.remainingAmount);
      state.lots.push({
        ...action.lot,
        reagentId: reagent.id,
        lotNumber,
        unit: reagent.unit,
        id: uid("lot"),
        initialAmount: amount,
        remainingAmount: amount,
      });
      return state;
    }
  }
}

export function loadInitialState(): AppState {
  const fallback = createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== fallback.version || !parsed.batches || !parsed.slides) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable in private or restricted browser modes.
  }
}
