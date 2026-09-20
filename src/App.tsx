import { useEffect, useMemo, useReducer, useState } from "react";
import "./styles.css";
import {
  addDays,
  AppointmentDraft,
  AppState,
  Batch,
  batchSlideCount,
  batchStartIssues,
  daysUntil,
  formatDate,
  Id,
  isLotExpired,
  isSlideFreshOn,
  Observation,
  ReagentLot,
  Revision,
  Slide,
  slots,
  todayISO,
} from "./domain";
import { loadInitialState, reducer, saveState } from "./store";

type ModalState =
  | { type: "batch" }
  | { type: "appointment"; slideId?: Id }
  | { type: "observe"; appointmentId: Id }
  | { type: "revision"; slideId: Id }
  | { type: "lot" }
  | { type: "cancel-batch"; batchId: Id }
  | { type: "cancel-appointment"; appointmentId: Id }
  | null;

type Notice = { kind: "ok" | "error"; text: string } | null;

const batchStatusText: Record<Batch["status"], string> = {
  planned: "待开始",
  staining: "染色中",
  stained: "已染色",
  cancelled: "已取消",
};

const slideStatusText: Record<Slide["status"], string> = {
  pending: "待染色",
  stained: "已染色",
  observed: "已观察",
  void: "已作废",
};

const appointmentStatusText = {
  booked: "已预约",
  completed: "已完成",
  cancelled: "已取消",
};

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [scheduleDate, setScheduleDate] = useState(todayISO());

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const maps = useMemo(() => {
    const byId = <T extends { id: Id }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
    return {
      sample: byId(state.samples),
      reagent: byId(state.reagents),
      protocol: byId(state.protocols),
      lot: byId(state.lots),
      vat: byId(state.vats),
      microscope: byId(state.microscopes),
    };
  }, [state]);

  const activeBatches = state.batches.filter((batch) => batch.status !== "cancelled");
  const stainedSlides = state.slides.filter((slide) => slide.status === "stained");
  const bookedAppointments = state.appointments.filter((item) => item.status === "booked");
  const observedSlides = state.slides.filter((slide) => slide.status === "observed");
  const voidSlides = state.slides.filter((slide) => slide.status === "void");
  const cancelledBatches = state.batches.filter((batch) => batch.status === "cancelled");
  const expiredLots = state.lots.filter((lot) => isLotExpired(lot, todayISO()));
  const lowLots = state.lots.filter(
    (lot) => !isLotExpired(lot, todayISO()) && lot.remainingAmount < 1
  );

  const availableSlides = stainedSlides.filter(
    (slide) =>
      isSlideFreshOn(slide, todayISO()) &&
      !state.appointments.some(
        (appointment) => appointment.slideId === slide.id && appointment.status === "booked"
      )
  );

  const unavailableStained = stainedSlides.filter((slide) => !availableSlides.includes(slide));

  function closeModal() {
    setModal(null);
  }

  function startBatch(batch: Batch) {
    const issues = batchStartIssues(state, batch);
    if (issues.length) {
      setNotice({ kind: "error", text: issues[0] });
      return;
    }
    dispatch({ type: "start-batch", batchId: batch.id });
    setNotice({ kind: "ok", text: `批次 ${batch.code} 已开始染色，试剂库存同步扣减。` });
  }

  function completeBatch(batch: Batch) {
    dispatch({ type: "complete-batch", batchId: batch.id });
    setNotice({ kind: "ok", text: `批次 ${batch.code} 已完成，玻片进入可预约有效期。` });
  }

  const metrics = [
    { label: "执行中批次", value: activeBatches.filter((b) => b.status !== "stained").length, hint: "待开始 + 染色中" },
    { label: "可预约玻片", value: availableSlides.length, hint: "已染色且未过期" },
    { label: "占用预约", value: bookedAppointments.length, hint: "显微镜时段锁定" },
    { label: "冻结结论", value: observedSlides.length, hint: "复看以修订追加" },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-06 · 染色批次 / 观察预约闭环</p>
          <h1>玻片看板</h1>
          <p className="subtitle">
            批次绑定样本、染色方案、试剂批次与有效期；染色缸、显微镜时段互斥，库存与过期规则在操作前校验。
            数据写入本地浏览器，刷新后批次、库存、预约和修订链保持一致。
          </p>
        </div>
        <div className="hero-actions panel">
          <button className="primary-action" onClick={() => setModal({ type: "batch" })}>
            新建染色批次
          </button>
          <button onClick={() => setModal({ type: "appointment" })}>预约观察</button>
          <button onClick={() => setModal({ type: "lot" })}>登记试剂批次</button>
          <button
            className="ghost-danger"
            onClick={() => {
              if (window.confirm("恢复演示数据将覆盖当前本地数据，确定继续？")) {
                dispatch({ type: "reset-demo" });
                setNotice({ kind: "ok", text: "已恢复演示闭环数据。" });
              }
            }}
          >
            重置演示数据
          </button>
        </div>
      </section>

      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

      <section className="metrics-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.hint}</p>
          </article>
        ))}
      </section>

      <section className="board">
        <section className="kanban-column production-column">
          <div className="column-heading">
            <div>
              <p>Staining Batch</p>
              <h2>染色批次</h2>
            </div>
            <span className="count">{activeBatches.length}</span>
          </div>
          <div className="card-stack">
            {activeBatches.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                state={state}
                maps={maps}
                onStart={() => startBatch(batch)}
                onComplete={() => completeBatch(batch)}
                onCancel={() => setModal({ type: "cancel-batch", batchId: batch.id })}
              />
            ))}
          </div>
        </section>

        <section className="kanban-column">
          <div className="column-heading">
            <div>
              <p>Available Slides</p>
              <h2>可预约玻片</h2>
            </div>
            <span className="count good">{availableSlides.length}</span>
          </div>
          <div className="card-stack">
            {availableSlides.map((slide) => (
              <SlideCard
                key={slide.id}
                slide={slide}
                state={state}
                maps={maps}
                onBook={() => setModal({ type: "appointment", slideId: slide.id })}
              />
            ))}
            {unavailableStained.map((slide) => (
              <SlideCard
                key={slide.id}
                slide={slide}
                state={state}
                maps={maps}
                disabled
                onBook={() => setModal({ type: "appointment", slideId: slide.id })}
              />
            ))}
          </div>
        </section>

        <section className="kanban-column">
          <div className="column-heading">
            <div>
              <p>Microscope Booking</p>
              <h2>观察预约</h2>
            </div>
            <span className="count warn">{bookedAppointments.length}</span>
          </div>
          <div className="card-stack">
            {bookedAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointmentId={appointment.id}
                state={state}
                maps={maps}
                onObserve={() => setModal({ type: "observe", appointmentId: appointment.id })}
                onCancel={() => setModal({ type: "cancel-appointment", appointmentId: appointment.id })}
              />
            ))}
            {!bookedAppointments.length && <EmptyCard text="暂无显微镜时段被占用" />}
          </div>
        </section>

        <section className="kanban-column frozen-column">
          <div className="column-heading">
            <div>
              <p>Frozen Conclusions</p>
              <h2>冻结结论 / 修订</h2>
            </div>
            <span className="count frozen">{observedSlides.length}</span>
          </div>
          <div className="card-stack">
            {observedSlides.map((slide) => (
              <FrozenSlideCard
                key={slide.id}
                slide={slide}
                state={state}
                maps={maps}
                onRevise={() => setModal({ type: "revision", slideId: slide.id })}
              />
            ))}
            {!observedSlides.length && <EmptyCard text="暂无已观察玻片" />}
          </div>
        </section>
      </section>

      <section className="two-column-panel">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p>Resource Calendar</p>
              <h2>资源时段占用</h2>
            </div>
            <label className="compact-date">
              日期
              <input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} />
            </label>
          </div>
          <ResourceSchedule state={state} date={scheduleDate} maps={maps} />
        </section>

        <section className="panel audit-panel">
          <div className="section-heading">
            <div>
              <p>Cancellation Audit</p>
              <h2>取消、作废与过期</h2>
            </div>
          </div>
          <AuditPanel
            cancelledBatches={cancelledBatches}
            voidSlides={voidSlides}
            expiredSlides={stainedSlides.filter((slide) => slide.expiresAt && slide.expiresAt < todayISO())}
            state={state}
            maps={maps}
          />
        </section>
      </section>

      <InventoryPanel state={state} onAddLot={() => setModal({ type: "lot" })} />

      {modal?.type === "batch" && <BatchForm state={state} onClose={closeModal} dispatch={dispatch} setNotice={setNotice} />}
      {modal?.type === "appointment" && (
        <AppointmentForm
          state={state}
          initialSlideId={modal.slideId}
          onClose={closeModal}
          dispatch={dispatch}
          setNotice={setNotice}
        />
      )}
      {modal?.type === "observe" && (
        <ObservationForm
          state={state}
          appointmentId={modal.appointmentId}
          onClose={closeModal}
          dispatch={dispatch}
          setNotice={setNotice}
        />
      )}
      {modal?.type === "revision" && (
        <RevisionForm
          state={state}
          slideId={modal.slideId}
          onClose={closeModal}
          dispatch={dispatch}
          setNotice={setNotice}
        />
      )}
      {modal?.type === "lot" && <LotForm state={state} onClose={closeModal} dispatch={dispatch} setNotice={setNotice} />}
      {modal?.type === "cancel-batch" && (
        <CancelBatchForm state={state} batchId={modal.batchId} onClose={closeModal} dispatch={dispatch} setNotice={setNotice} />
      )}
      {modal?.type === "cancel-appointment" && (
        <CancelAppointmentForm
          state={state}
          appointmentId={modal.appointmentId}
          onClose={closeModal}
          dispatch={dispatch}
          setNotice={setNotice}
        />
      )}

      <footer className="footer-note">
        规则状态：库存异常 {lowLots.length + expiredLots.length} 项 · 本地持久化键 hxwl-06-closed-loop-v1
      </footer>
    </main>
  );
}

type Maps = {
  sample: Map<Id, AppState["samples"][number]>;
  reagent: Map<Id, AppState["reagents"][number]>;
  protocol: Map<Id, AppState["protocols"][number]>;
  lot: Map<Id, ReagentLot>;
  vat: Map<Id, AppState["vats"][number]>;
  microscope: Map<Id, AppState["microscopes"][number]>;
};

function BatchCard({
  batch,
  state,
  maps,
  onStart,
  onComplete,
  onCancel,
}: {
  batch: Batch;
  state: AppState;
  maps: Maps;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const protocol = maps.protocol.get(batch.protocolId);
  const vat = maps.vat.get(batch.vatId);
  const slot = state.slots.find((item) => item.id === batch.slotId);
  const issues = batch.status === "planned" ? batchStartIssues(state, batch) : [];
  const totalSlides = batchSlideCount(batch);
  const observedCount = state.slides.filter(
    (slide) => slide.batchId === batch.id && slide.status === "observed"
  ).length;

  return (
    <article className={`work-card batch-${batch.status}`}>
      <div className="card-top">
        <div>
          <span className="mono">{batch.code}</span>
          <h3>{protocol?.name}</h3>
        </div>
        <span className={`badge ${batch.status}`}>{batchStatusText[batch.status]}</span>
      </div>
      <dl className="detail-list">
        <div><dt>样本玻片</dt><dd>{totalSlides} 张 · {batch.sampleIds.length} 类样本</dd></div>
        <div><dt>染色资源</dt><dd>{vat?.name} · {slot?.label}</dd></div>
        <div><dt>计划时间</dt><dd>{formatDate(batch.date)}</dd></div>
        <div><dt>负责人</dt><dd>{batch.operator}</dd></div>
      </dl>
      <div className="sample-line">
        {batch.sampleIds.map((sampleId) => (
          <span key={sampleId}>{maps.sample.get(sampleId)?.name}</span>
        ))}
      </div>
      <ReagentBinding batch={batch} state={state} maps={maps} />
      {issues.length > 0 && (
        <div className="rule-error">
          {issues.map((issue) => <p key={issue}>⛔ {issue}</p>)}
        </div>
      )}
      {batch.status !== "planned" && (
        <p className="soft-note">
          已观察 {observedCount} 张，取消时将冻结；其余未观察玻片作废。
        </p>
      )}
      <div className="card-actions">
        {batch.status === "planned" && <button className="primary-action" onClick={onStart}>开始染色</button>}
        {batch.status === "staining" && <button className="primary-action" onClick={onComplete}>染色完成</button>}
        <button className="danger-button" onClick={onCancel}>取消批次</button>
      </div>
    </article>
  );
}

function ReagentBinding({ batch, state, maps }: { batch: Batch; state: AppState; maps: Maps }) {
  const protocol = maps.protocol.get(batch.protocolId);
  if (!protocol) return null;
  return (
    <div className="reagent-binding">
      {protocol.requirements.map((requirement) => {
        const reagent = maps.reagent.get(requirement.reagentId);
        const lot = maps.lot.get(batch.reagentLots[requirement.reagentId]);
        const required = requirement.amountPerSlide * batchSlideCount(batch);
        const consumed = batch.consumption[requirement.reagentId];
        const expired = lot ? isLotExpired(lot, batch.date) : false;
        const insufficient = lot ? lot.remainingAmount < required : true;
        return (
          <div key={requirement.reagentId} className={expired || insufficient ? "bad" : "good"}>
            <strong>{reagent?.name}</strong>
            <span>{lot?.lotNumber || "未绑定"}</span>
            <small>
              效期 {lot?.expiry || "—"} · {consumed ? `已耗 ${consumed}` : `需 ${Number(required.toFixed(3))}`}
              {lot ? ` / 余 ${lot.remainingAmount}${lot.unit}` : ""}
            </small>
          </div>
        );
      })}
    </div>
  );
}

function SlideCard({
  slide,
  state,
  maps,
  disabled,
  onBook,
}: {
  slide: Slide;
  state: AppState;
  maps: Maps;
  disabled?: boolean;
  onBook: () => void;
}) {
  const sample = maps.sample.get(slide.sampleId);
  const batch = state.batches.find((item) => item.id === slide.batchId);
  const booked = state.appointments.some((item) => item.slideId === slide.id && item.status === "booked");
  const expired = Boolean(slide.expiresAt && slide.expiresAt < todayISO());
  const days = slide.expiresAt ? daysUntil(slide.expiresAt) : 0;

  return (
    <article className={`work-card slide-card ${disabled ? "disabled-card" : ""}`}>
      <div className="card-top">
        <div>
          <span className="mono">{slide.code}</span>
          <h3>{sample?.name}</h3>
        </div>
        <span className={`badge ${booked ? "staining" : expired ? "void" : "stained"}`}>
          {booked ? "已占用" : expired ? "已过期" : "可预约"}
        </span>
      </div>
      <dl className="detail-list">
        <div><dt>来源批次</dt><dd>{batch?.code}</dd></div>
        <div><dt>染色日期</dt><dd>{formatDate(slide.stainedAt)}</dd></div>
        <div><dt>有效期至</dt><dd>{formatDate(slide.expiresAt)}（{days >= 0 ? `剩 ${days} 天` : `过期 ${Math.abs(days)} 天`}）</dd></div>
      </dl>
      <button className="primary-action wide" disabled={disabled} onClick={onBook}>
        {booked ? "已有预约" : expired ? "已过期，禁止预约" : "选择玻片预约"}
      </button>
    </article>
  );
}

function AppointmentCard({
  appointmentId,
  state,
  maps,
  onObserve,
  onCancel,
}: {
  appointmentId: Id;
  state: AppState;
  maps: Maps;
  onObserve: () => void;
  onCancel: () => void;
}) {
  const appointment = state.appointments.find((item) => item.id === appointmentId);
  if (!appointment) return null;
  const slide = state.slides.find((item) => item.id === appointment.slideId);
  const sample = slide ? maps.sample.get(slide.sampleId) : undefined;
  const microscope = maps.microscope.get(appointment.microscopeId);
  const slot = state.slots.find((item) => item.id === appointment.slotId);
  const expired = Boolean(slide?.expiresAt && slide.expiresAt < appointment.date);

  return (
    <article className="work-card appointment-card">
      <div className="card-top">
        <div>
          <span className="mono">{slide?.code}</span>
          <h3>{sample?.name}</h3>
        </div>
        <span className={`badge ${expired ? "void" : "staining"}`}>
          {expired ? "玻片过期" : appointmentStatusText[appointment.status]}
        </span>
      </div>
      <dl className="detail-list">
        <div><dt>显微镜</dt><dd>{microscope?.name} · {microscope?.room}</dd></div>
        <div><dt>时段</dt><dd>{formatDate(appointment.date)} {slot?.label}</dd></div>
        <div><dt>预约人</dt><dd>{appointment.observer}</dd></div>
        <div><dt>目的</dt><dd>{appointment.purpose || "—"}</dd></div>
      </dl>
      <div className="card-actions">
        <button className="primary-action" disabled={expired} onClick={onObserve}>登记观察</button>
        <button className="danger-button" onClick={onCancel}>取消预约</button>
      </div>
    </article>
  );
}

function FrozenSlideCard({
  slide,
  state,
  maps,
  onRevise,
}: {
  slide: Slide;
  state: AppState;
  maps: Maps;
  onRevise: () => void;
}) {
  const sample = maps.sample.get(slide.sampleId);
  const batch = state.batches.find((item) => item.id === slide.batchId);
  const original = slide.originalObservation;
  const batchCancelled = batch?.status === "cancelled";

  return (
    <article className="work-card frozen-card">
      <div className="card-top">
        <div>
          <span className="mono">{slide.code}</span>
          <h3>{sample?.name}</h3>
        </div>
        <span className="badge observed">{batchCancelled ? "冻结 / 批次取消" : "冻结"}</span>
      </div>
      <div className="conclusion-chain">
        <div className="conclusion original">
          <span>原始结论 · {original?.observer} · {original?.magnification}</span>
          <strong>{original?.structures}</strong>
          <p>{original?.conclusion}</p>
        </div>
        {slide.revisions.map((revision, index) => (
          <div className="conclusion revision" key={revision.id}>
            <span>修订 #{index + 1} · {revision.observer} · {new Date(revision.createdAt).toLocaleString("zh-CN")}</span>
            <strong>原因：{revision.reason}</strong>
            <p><b>{revision.magnification} · {revision.structures}</b><br />{revision.conclusion}</p>
          </div>
        ))}
      </div>
      <button className="wide" onClick={onRevise}>新增带原因复看修订</button>
    </article>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <div className="empty-card">{text}</div>;
}

function ResourceSchedule({ state, date, maps }: { state: AppState; date: string; maps: Maps }) {
  return (
    <div className="schedule-grid">
      <div>
        <h3>染色缸</h3>
        {state.vats.map((vat) => (
          <div className="schedule-row" key={vat.id}>
            <strong>{vat.name}</strong>
            <div>
              {slots.map((slot) => {
                const batch = state.batches.find(
                  (item) => item.status !== "cancelled" && item.vatId === vat.id && item.date === date && item.slotId === slot.id
                );
                return (
                  <span key={slot.id} className={batch ? "occupied" : "free"}>
                    <b>{slot.label}</b>{batch ? `${batch.code} · ${batchStatusText[batch.status]}` : "空闲"}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div>
        <h3>显微镜</h3>
        {state.microscopes.map((microscope) => (
          <div className="schedule-row" key={microscope.id}>
            <strong>{microscope.name}</strong>
            <div>
              {slots.map((slot) => {
                const appointment = state.appointments.find(
                  (item) => item.status !== "cancelled" && item.microscopeId === microscope.id && item.date === date && item.slotId === slot.id
                );
                const slide = appointment ? state.slides.find((item) => item.id === appointment.slideId) : undefined;
                return (
                  <span key={slot.id} className={appointment ? "occupied" : "free"}>
                    <b>{slot.label}</b>{appointment ? `${slide?.code} · ${appointmentStatusText[appointment.status]}` : "空闲"}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditPanel({
  cancelledBatches,
  voidSlides,
  expiredSlides,
  state,
  maps,
}: {
  cancelledBatches: Batch[];
  voidSlides: Slide[];
  expiredSlides: Slide[];
  state: AppState;
  maps: Maps;
}) {
  return (
    <div className="audit-list">
      {cancelledBatches.map((batch) => {
        const frozen = state.slides.filter((slide) => slide.batchId === batch.id && slide.status === "observed");
        const discarded = state.slides.filter((slide) => slide.batchId === batch.id && slide.status === "void");
        return (
          <div className="audit-item" key={batch.id}>
            <strong>{batch.code} 已取消，染色缸已释放</strong>
            <p>{batch.cancelReason}</p>
            <small>冻结已观察 {frozen.length} 张 · 作废未观察 {discarded.length} 张</small>
          </div>
        );
      })}
      {[...voidSlides, ...expiredSlides.filter((slide) => slide.status !== "observed")].map((slide) => (
        <div className="audit-item muted-audit" key={slide.id}>
          <strong>{slide.code} · {maps.sample.get(slide.sampleId)?.name}</strong>
          <p>{slide.status === "void" ? slide.voidReason : `玻片已于 ${slide.expiresAt} 过期`}</p>
        </div>
      ))}
      {!cancelledBatches.length && !voidSlides.length && !expiredSlides.length && (
        <p className="soft-note">暂无取消、作废或过期记录。</p>
      )}
    </div>
  );
}

function InventoryPanel({ state, onAddLot }: { state: AppState; onAddLot: () => void }) {
  const grouped = state.reagents.map((reagent) => ({
    reagent,
    lots: state.lots.filter((lot) => lot.reagentId === reagent.id),
  }));

  return (
    <section className="panel inventory-panel">
      <div className="section-heading">
        <div>
          <p>Reagent Inventory</p>
          <h2>试剂批次库存与效期</h2>
        </div>
        <button onClick={onAddLot}>登记试剂批次</button>
      </div>
      <div className="inventory-grid">
        {grouped.map(({ reagent, lots }) => (
          <article key={reagent.id} className="inventory-card">
            <h3>{reagent.name}</h3>
            {lots.map((lot) => {
              const expired = isLotExpired(lot, todayISO());
              const low = lot.remainingAmount < 1;
              return (
                <div key={lot.id} className={`lot-row ${expired ? "expired" : low ? "low" : ""}`}>
                  <div>
                    <strong>{lot.lotNumber}</strong>
                    <span>初始 {lot.initialAmount}{lot.unit} · 已耗 {roundSub(lot)}{lot.unit}</span>
                  </div>
                  <div>
                    <b>{lot.remainingAmount}{lot.unit}</b>
                    <span>{expired ? "已过期" : `效期 ${lot.expiry}`}</span>
                  </div>
                </div>
              );
            })}
          </article>
        ))}
      </div>
    </section>
  );
}

function roundSub(lot: ReagentLot): number {
  return Math.round((lot.initialAmount - lot.remainingAmount) * 1000) / 1000;
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

type FormProps = {
  state: AppState;
  onClose: () => void;
  dispatch: React.Dispatch<any>;
  setNotice: React.Dispatch<React.SetStateAction<Notice>>;
};

function BatchForm({ state, onClose, dispatch, setNotice }: FormProps) {
  const [protocolId, setProtocolId] = useState(state.protocols[0].id);
  const [sampleIds, setSampleIds] = useState<Id[]>([state.samples[0].id]);
  const [count, setCount] = useState(1);
  const [vatId, setVatId] = useState(state.vats[0].id);
  const [date, setDate] = useState(addDays(todayISO(), 1));
  const [slotId, setSlotId] = useState(state.slots[0].id);
  const [operator, setOperator] = useState("");
  const protocol = state.protocols.find((item) => item.id === protocolId)!;
  const [reagentLots, setReagentLots] = useState<Record<Id, Id>>(() =>
    Object.fromEntries(protocol.requirements.map((req) => [req.reagentId, state.lots.find((lot) => lot.reagentId === req.reagentId)?.id || ""]))
  );

  function changeProtocol(nextId: Id) {
    setProtocolId(nextId);
    const nextProtocol = state.protocols.find((item) => item.id === nextId)!;
    setReagentLots(Object.fromEntries(nextProtocol.requirements.map((req) => [req.reagentId, state.lots.find((lot) => lot.reagentId === req.reagentId)?.id || ""])));
  }

  function toggleSample(id: Id) {
    setSampleIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const preview: Batch = {
    id: "preview",
    code: "PREVIEW",
    protocolId,
    sampleIds,
    slideCountPerSample: count,
    reagentLots,
    vatId,
    date,
    slotId,
    operator: operator || "预览",
    status: "planned",
    createdAt: "",
    consumption: {},
    slideIds: [],
  };
  const issues = batchStartIssues(state, preview);

  function submit() {
    if (issues.length) {
      setNotice({ kind: "error", text: issues[0] });
      return;
    }
    dispatch({ type: "create-batch", protocolId, sampleIds, slideCountPerSample: count, reagentLots, vatId, date, slotId, operator });
    setNotice({ kind: "ok", text: "染色批次已创建并绑定样本、方案、试剂批次和染色缸时段。" });
    onClose();
  }

  return (
    <ModalShell title="新建染色批次" onClose={onClose}>
      <div className="form-grid">
        <label>染色方案
          <select value={protocolId} onChange={(event) => changeProtocol(event.target.value)}>
            {state.protocols.map((item) => <option key={item.id} value={item.id}>{item.name}（有效期 {item.validDays} 天）</option>)}
          </select>
        </label>
        <label>负责人
          <input value={operator} onChange={(event) => setOperator(event.target.value)} placeholder="如：陈实验师" />
        </label>
        <label>染色缸
          <select value={vatId} onChange={(event) => setVatId(event.target.value)}>
            {state.vats.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.room}</option>)}
          </select>
        </label>
        <label>染色时段
          <select value={slotId} onChange={(event) => setSlotId(event.target.value)}>
            {state.slots.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>计划日期<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>每样本玻片数
          <input type="number" min={1} max={6} value={count} onChange={(event) => setCount(Math.min(6, Math.max(1, Number(event.target.value) || 1)))} />
        </label>
      </div>
      <div className="selector-block">
        <span>绑定样本（可多选）</span>
        <div className="chips">
          {state.samples.map((sample) => (
            <button type="button" key={sample.id} className={sampleIds.includes(sample.id) ? "selected" : ""} onClick={() => toggleSample(sample.id)}>
              {sample.name} · {sample.type}
            </button>
          ))}
        </div>
      </div>
      <div className="selector-block">
        <span>绑定试剂批次与有效期</span>
        <div className="lot-select-grid">
          {protocol.requirements.map((requirement) => {
            const reagent = state.reagents.find((item) => item.id === requirement.reagentId)!;
            const total = sampleIds.length * count;
            return (
              <label key={requirement.reagentId}>
                {reagent.name}（每片 {requirement.amountPerSlide}{reagent.unit}，共需 {requirement.amountPerSlide * total}{reagent.unit}）
                <select value={reagentLots[requirement.reagentId] || ""} onChange={(event) => setReagentLots({ ...reagentLots, [requirement.reagentId]: event.target.value })}>
                  <option value="">请选择试剂批次</option>
                  {state.lots.filter((lot) => lot.reagentId === requirement.reagentId).map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lotNumber} · 效期 {lot.expiry} · 余 {lot.remainingAmount}{lot.unit}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </div>
      <RuleIssues issues={issues} />
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary-action" disabled={issues.length > 0} onClick={submit}>创建批次</button>
      </div>
    </ModalShell>
  );
}

function AppointmentForm({ state, onClose, dispatch, setNotice, initialSlideId }: FormProps & { initialSlideId?: Id }) {
  const [date, setDate] = useState(todayISO());
  const [microscopeId, setMicroscopeId] = useState(state.microscopes[0].id);
  const [slotId, setSlotId] = useState(state.slots[0].id);
  const [slideId, setSlideId] = useState(initialSlideId || "");
  const [observer, setObserver] = useState("");
  const [purpose, setPurpose] = useState("");

  const bookedSlideIds = new Set(
    state.appointments.filter((item) => item.status === "booked").map((item) => item.slideId)
  );
  const eligibleSlides = state.slides.filter(
    (slide) => slide.status === "stained" && isSlideFreshOn(slide, date) && !bookedSlideIds.has(slide.id)
  );
  const effectiveSlideId = eligibleSlides.some((slide) => slide.id === slideId) ? slideId : "";
  const draft: AppointmentDraft = { slideId: effectiveSlideId, microscopeId, date, slotId, observer, purpose };
  const issues = computeAppointmentIssues(state, draft);

  function submit() {
    if (issues.length) {
      setNotice({ kind: "error", text: issues[0] });
      return;
    }
    dispatch({ type: "create-appointment", draft });
    setNotice({ kind: "ok", text: "观察预约成功，显微镜时段与玻片已占用。" });
    onClose();
  }

  return (
    <ModalShell title="预约显微镜观察" onClose={onClose}>
      <div className="form-grid">
        <label>观察日期<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>观察时段
          <select value={slotId} onChange={(event) => setSlotId(event.target.value)}>
            {slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
          </select>
        </label>
        <label>显微镜
          <select value={microscopeId} onChange={(event) => setMicroscopeId(event.target.value)}>
            {state.microscopes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.room}</option>)}
          </select>
        </label>
        <label>预约人<input value={observer} onChange={(event) => setObserver(event.target.value)} placeholder="如：王同学" /></label>
      </div>
      <label className="full-field">选择玻片（仅显示已染色、所选日期未过期、未被占用）
        <select value={effectiveSlideId} onChange={(event) => setSlideId(event.target.value)}>
          <option value="">请选择玻片</option>
          {eligibleSlides.map((slide) => {
            const sample = state.samples.find((item) => item.id === slide.sampleId);
            return <option key={slide.id} value={slide.id}>{slide.code} · {sample?.name} · 有效期至 {slide.expiresAt}</option>;
          })}
        </select>
      </label>
      <label className="full-field">观察目的<input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="如：课堂细胞壁观察" /></label>
      <RuleIssues issues={issues} />
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary-action" disabled={issues.length > 0} onClick={submit}>确认预约</button>
      </div>
    </ModalShell>
  );
}

function computeAppointmentIssues(state: AppState, draft: AppointmentDraft) {
  // Kept in the component layer to provide form-time feedback before dispatching.
  const issues: string[] = [];
  const slide = state.slides.find((item) => item.id === draft.slideId);
  if (!slide) issues.push("请选择已染色且未过期、未被占用的玻片。");
  if (!draft.observer.trim()) issues.push("请填写预约人。");
  if (draft.date < todayISO()) issues.push("不能预约过去日期。");
  if (slide && !isSlideFreshOn(slide, draft.date)) issues.push("玻片未染色或已过期。");
  const conflict = state.appointments.find(
    (item) => item.status !== "cancelled" && item.microscopeId === draft.microscopeId && item.date === draft.date && item.slotId === draft.slotId
  );
  if (conflict) issues.push("同一显微镜同一时段已有预约，不能重复占用。");
  return issues;
}

function ObservationForm({ state, onClose, dispatch, setNotice, appointmentId }: FormProps & { appointmentId: Id }) {
  const appointment = state.appointments.find((item) => item.id === appointmentId)!;
  const [observer, setObserver] = useState(appointment.observer);
  const [magnification, setMagnification] = useState("400×");
  const [structures, setStructures] = useState("");
  const [conclusion, setConclusion] = useState("");

  function submit() {
    if (!structures.trim() || !conclusion.trim()) {
      setNotice({ kind: "error", text: "请填写观察结构和结论。" });
      return;
    }
    dispatch({
      type: "complete-appointment",
      appointmentId,
      observation: { observer, magnification, structures, conclusion },
    });
    setNotice({ kind: "ok", text: "观察已登记，玻片结论冻结；后续复看只能追加修订。" });
    onClose();
  }

  return (
    <ModalShell title="登记观察结论" onClose={onClose}>
      <div className="form-grid">
        <label>观察者<input value={observer} onChange={(event) => setObserver(event.target.value)} /></label>
        <label>放大倍数
          <select value={magnification} onChange={(event) => setMagnification(event.target.value)}>
            {["100×", "200×", "400×", "1000×"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <label className="full-field">重点结构<input value={structures} onChange={(event) => setStructures(event.target.value)} placeholder="如：细胞壁、细胞核" /></label>
      <label className="full-field">观察结论<textarea value={conclusion} onChange={(event) => setConclusion(event.target.value)} rows={4} /></label>
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary-action" onClick={submit}>冻结结论</button>
      </div>
    </ModalShell>
  );
}

function RevisionForm({ state, onClose, dispatch, setNotice, slideId }: FormProps & { slideId: Id }) {
  const slide = state.slides.find((item) => item.id === slideId)!;
  const [observer, setObserver] = useState(slide.originalObservation?.observer || "");
  const [magnification, setMagnification] = useState(slide.originalObservation?.magnification || "400×");
  const [structures, setStructures] = useState(slide.originalObservation?.structures || "");
  const [reason, setReason] = useState("");
  const [conclusion, setConclusion] = useState("");
  const revisionCount = slide.revisions.length;

  function submit() {
    if (!reason.trim() || !conclusion.trim()) {
      setNotice({ kind: "error", text: "复看修订必须填写原因和新结论。" });
      return;
    }
    dispatch({
      type: "add-revision",
      slideId,
      revision: { observer, magnification, structures, reason, conclusion },
    });
    setNotice({ kind: "ok", text: `已追加第 ${revisionCount + 1} 条修订，旧结论保持可见。` });
    onClose();
  }

  return (
    <ModalShell title="新增复看修订" onClose={onClose}>
      <div className="original-mini">
        <span>旧结论已保留</span>
        <p>{slide.originalObservation?.conclusion}</p>
      </div>
      <label className="full-field required">复看原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="请说明为何复看，如结构争议、倍率调整" /></label>
      <div className="form-grid">
        <label>复看人<input value={observer} onChange={(event) => setObserver(event.target.value)} /></label>
        <label>放大倍数
          <select value={magnification} onChange={(event) => setMagnification(event.target.value)}>
            {["100×", "200×", "400×", "1000×"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <label className="full-field">复核结构<input value={structures} onChange={(event) => setStructures(event.target.value)} /></label>
      <label className="full-field required">修订结论<textarea value={conclusion} onChange={(event) => setConclusion(event.target.value)} rows={4} /></label>
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary-action" onClick={submit}>追加修订链</button>
      </div>
    </ModalShell>
  );
}

function LotForm({ state, onClose, dispatch, setNotice }: FormProps) {
  const [reagentId, setReagentId] = useState(state.reagents[0].id);
  const [lotNumber, setLotNumber] = useState("");
  const [expiry, setExpiry] = useState(addDays(todayISO(), 30));
  const [amount, setAmount] = useState(10);
  const reagent = state.reagents.find((item) => item.id === reagentId)!;
  const duplicate = state.lots.some((lot) => lot.lotNumber === lotNumber.trim());

  function submit() {
    if (!lotNumber.trim() || duplicate || amount < 0) {
      setNotice({ kind: "error", text: duplicate ? "试剂批号已存在。" : "请完整填写试剂批次。" });
      return;
    }
    dispatch({ type: "add-lot", lot: { reagentId, lotNumber, expiry, remainingAmount: amount, unit: reagent.unit } });
    setNotice({ kind: "ok", text: "试剂批次已入库，可在新建批次时绑定。" });
    onClose();
  }

  return (
    <ModalShell title="登记试剂批次" onClose={onClose}>
      <div className="form-grid">
        <label>试剂
          <select value={reagentId} onChange={(event) => setReagentId(event.target.value)}>
            {state.reagents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>批号<input value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} placeholder="如 HX20260920" /></label>
        <label>有效期<input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></label>
        <label>入库数量（{reagent.unit}）<input type="number" min={0} step={0.1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
      </div>
      {duplicate && <div className="rule-error"><p>批号不能重复。</p></div>}
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary-action" onClick={submit}>入库</button>
      </div>
    </ModalShell>
  );
}

function CancelBatchForm({ state, onClose, dispatch, setNotice, batchId }: FormProps & { batchId: Id }) {
  const batch = state.batches.find((item) => item.id === batchId)!;
  const slides = state.slides.filter((slide) => slide.batchId === batchId);
  const observed = slides.filter((slide) => slide.status === "observed").length;
  const discarded = slides.filter((slide) => slide.status !== "observed").length;
  const booked = state.appointments.filter(
    (appointment) => appointment.status === "booked" && batch.slideIds.includes(appointment.slideId)
  ).length;
  const [reason, setReason] = useState("");

  function submit() {
    if (!reason.trim()) {
      setNotice({ kind: "error", text: "取消批次必须填写原因。" });
      return;
    }
    dispatch({ type: "cancel-batch", batchId, reason });
    setNotice({ kind: "ok", text: "批次已取消：染色缸释放，预约撤回，未观察玻片作废，已观察结论冻结。" });
    onClose();
  }

  return (
    <ModalShell title={`取消批次 ${batch.code}`} onClose={onClose}>
      <div className="cancel-warning">
        <p>染色缸时段将立即释放。</p>
        <p>未观察玻片 {discarded} 张将作废；已观察 {observed} 张冻结并保留修订链。</p>
        <p>未完成预约 {booked} 条将同步取消。已扣减试剂不会自动回库，需按实验室盘点流程处理。</p>
      </div>
      <label className="full-field required">取消原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} /></label>
      <div className="modal-actions">
        <button onClick={onClose}>保留批次</button>
        <button className="danger-button" onClick={submit}>确认取消</button>
      </div>
    </ModalShell>
  );
}

function CancelAppointmentForm({ state, onClose, dispatch, setNotice, appointmentId }: FormProps & { appointmentId: Id }) {
  const appointment = state.appointments.find((item) => item.id === appointmentId)!;
  const [reason, setReason] = useState("");
  function submit() {
    if (!reason.trim()) {
      setNotice({ kind: "error", text: "取消预约必须填写原因。" });
      return;
    }
    dispatch({ type: "cancel-appointment", appointmentId, reason });
    setNotice({ kind: "ok", text: "预约已取消，玻片和显微镜时段重新开放。" });
    onClose();
  }
  return (
    <ModalShell title="取消观察预约" onClose={onClose}>
      <p className="soft-note">取消后，同一玻片与显微镜时段可重新预约。</p>
      <label className="full-field required">取消原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} /></label>
      <div className="modal-actions">
        <button onClick={onClose}>返回</button>
        <button className="danger-button" onClick={submit}>确认取消</button>
      </div>
    </ModalShell>
  );
}

function RuleIssues({ issues }: { issues: string[] }) {
  if (!issues.length) return <div className="rule-ok">✓ 当前配置通过染色缸、试剂库存与效期校验。</div>;
  return (
    <div className="rule-error">
      {issues.map((issue) => <p key={issue}>⛔ {issue}</p>)}
    </div>
  );
}

export default App;
