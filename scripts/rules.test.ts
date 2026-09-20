/**
 * 闭环业务规则冒烟测试（不依赖浏览器，直接测试 store 中的纯函数规则）。
 * 运行：npm run test:rules
 */
import assert from "node:assert/strict";
import {
  addDays,
  cancelBatchRule,
  cancelReservationRule,
  completeBatchRule,
  completeReservationRule,
  createBatchRule,
  createReservationRule,
  seedState,
  selectBookableSlides,
  startBatchRule,
  todayStr,
} from "../src/store";
import type { LabState } from "../src/types";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

type RuleResult = ReturnType<typeof createBatchRule>;

function okState(r: RuleResult): LabState {
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  return r.ok ? r.state : seedState();
}

function errOf(r: RuleResult): string {
  assert.equal(r.ok, false, "预期失败但成功了");
  return r.ok ? "" : r.error;
}

const seed = seedState();
const today = todayStr();
const lastBatchId = (s: LabState) => s.batches[s.batches.length - 1].id;
const lastResId = (s: LabState) => s.reservations[s.reservations.length - 1].id;

// ---------- 批次与染色缸 ----------
test("同一染色缸同一时段只能一批", () => {
  const r = createBatchRule(seed, {
    sampleId: "s-onion", protocolId: "p-iodine", tankId: "t-b",
    slot: `${today}|下午`, lotIds: ["lot-iodine-a"], slideCount: 2,
  });
  assert.match(errOf(r), /同一染色缸同一时段只能一批/);
});

test("创建批次成功并生成制备中玻片", () => {
  const s = okState(createBatchRule(seed, {
    sampleId: "s-liver", protocolId: "p-iodine", tankId: "t-a",
    slot: `${today}|下午`, lotIds: ["lot-iodine-a"], slideCount: 2,
  }));
  const batchId = lastBatchId(s);
  assert.equal(s.batches.find((b) => b.id === batchId)!.status, "scheduled");
  assert.equal(s.slides.filter((x) => x.batchId === batchId && x.status === "preparing").length, 2);
});

// ---------- 试剂校验 ----------
test("试剂批次过期不能开始染色", () => {
  const created = okState(createBatchRule(seed, {
    sampleId: "s-liver", protocolId: "p-he", tankId: "t-a",
    slot: `${today}|下午`, lotIds: ["lot-hema-a", "lot-eosin-a"], slideCount: 2,
  }));
  const r = startBatchRule(created, lastBatchId(created));
  assert.match(errOf(r), /过期/);
});

test("试剂余量不足不能开始染色", () => {
  const created = okState(createBatchRule(seed, {
    sampleId: "s-onion", protocolId: "p-iodine", tankId: "t-a",
    slot: `${today}|下午`, lotIds: ["lot-iodine-b"], slideCount: 2,
  }));
  const r = startBatchRule(created, lastBatchId(created));
  assert.match(errOf(r), /余量不足/);
});

test("开始染色通过后扣减库存", () => {
  const before = seed.lots.find((l) => l.id === "lot-crystal-a")!.quantity;
  const s = okState(startBatchRule(seed, "b-3"));
  assert.equal(s.lots.find((l) => l.id === "lot-crystal-a")!.quantity, before - 4);
  assert.equal(s.batches.find((b) => b.id === "b-3")!.status, "staining");
});

test("完成染色后玻片可约并写入有效期", () => {
  const s = okState(completeBatchRule(seed, "b-2"));
  const batch = s.batches.find((b) => b.id === "b-2")!;
  assert.equal(batch.status, "stained");
  assert.equal(batch.slideExpiresAt, addDays(today, 5));
  assert.ok(s.slides.filter((x) => x.batchId === "b-2").every((x) => x.status === "available"));
});

// ---------- 预约 ----------
test("预约：未染色玻片被拒", () => {
  const r = createReservationRule(seed, { slideId: "sl-5", microscopeId: "m-3", slot: `${today}|晚上`, observer: "张三" });
  assert.match(errOf(r), /不可预约/);
});

test("预约：同一显微镜同一时段不能重复占用", () => {
  const r = createReservationRule(seed, { slideId: "sl-3", microscopeId: "m-1", slot: `${today}|下午`, observer: "张三" });
  assert.match(errOf(r), /已被预约/);
});

test("预约：成功后玻片锁定且不能重复预约", () => {
  const s = okState(createReservationRule(seed, { slideId: "sl-3", microscopeId: "m-2", slot: `${today}|下午`, observer: "张三" }));
  assert.equal(s.slides.find((x) => x.id === "sl-3")!.status, "reserved");
  const again = createReservationRule(s, { slideId: "sl-3", microscopeId: "m-3", slot: `${today}|晚上`, observer: "李四" });
  assert.equal(again.ok, false);
});

test("预约：过期玻片被拒", () => {
  const expired: LabState = {
    ...seed,
    batches: seed.batches.map((b) => (b.id === "b-1" ? { ...b, slideExpiresAt: addDays(today, -1) } : b)),
  };
  const r = createReservationRule(expired, { slideId: "sl-3", microscopeId: "m-3", slot: `${today}|晚上`, observer: "张三" });
  assert.match(errOf(r), /过期/);
});

test("可预约玻片只含已染色未过期且未占用的玻片", () => {
  assert.deepEqual(selectBookableSlides(seed).map((s) => s.id).sort(), ["sl-1", "sl-3", "sl-4"]);
});

// ---------- 观察与修订链 ----------
test("首看生成 v1；复看必须带原因，旧结论保留为历史版本", () => {
  const s1 = okState(createReservationRule(seed, { slideId: "sl-3", microscopeId: "m-2", slot: `${today}|下午`, observer: "张三" }));
  const s2 = okState(completeReservationRule(s1, lastResId(s1), {
    magnification: "400x", structure: "红细胞", conclusion: "未见异常", reason: "",
  }));
  const v1 = s2.observations.find((o) => o.slideId === "sl-3")!;
  assert.equal(v1.version, 1);
  assert.equal(v1.status, "active");
  assert.equal(s2.slides.find((x) => x.id === "sl-3")!.status, "observed");

  // 已观察玻片可再次预约复看
  const s3 = okState(createReservationRule(s2, { slideId: "sl-3", microscopeId: "m-2", slot: `${today}|晚上`, observer: "王老师" }));
  const rejected = completeReservationRule(s3, lastResId(s3), {
    magnification: "1000x", structure: "红细胞", conclusion: "修正结论", reason: "",
  });
  assert.match(errOf(rejected), /修订原因/);

  const s4 = okState(completeReservationRule(s3, lastResId(s3), {
    magnification: "1000x", structure: "红细胞", conclusion: "修正结论", reason: "初看倍数不足",
  }));
  const chain = s4.observations.filter((o) => o.slideId === "sl-3");
  assert.equal(chain.length, 2);
  assert.equal(chain.find((o) => o.version === 1)!.status, "superseded");
  const v2 = chain.find((o) => o.version === 2)!;
  assert.equal(v2.status, "active");
  assert.equal(v2.reason, "初看倍数不足");
});

// ---------- 取消批次级联 ----------
test("取消批次：未观察玻片作废、已观察冻结、关联预约取消、结论保留", () => {
  const s = okState(cancelBatchRule(seed, "b-1"));
  assert.equal(s.batches.find((b) => b.id === "b-1")!.status, "cancelled");
  assert.equal(s.slides.find((x) => x.id === "sl-1")!.status, "frozen");
  assert.equal(s.slides.find((x) => x.id === "sl-2")!.status, "void");
  assert.equal(s.slides.find((x) => x.id === "sl-3")!.status, "void");
  assert.equal(s.reservations.find((r) => r.id === "res-1")!.status, "cancelled");
  assert.equal(s.observations.filter((o) => o.slideId === "sl-1").length, 2);
});

test("取消染色中批次后染色缸时段释放，可再排同缸同时段", () => {
  const s = okState(cancelBatchRule(seed, "b-2"));
  assert.ok(s.slides.filter((x) => x.batchId === "b-2").every((x) => x.status === "void"));
  const again = createBatchRule(s, {
    sampleId: "s-onion", protocolId: "p-iodine", tankId: "t-b",
    slot: `${today}|下午`, lotIds: ["lot-iodine-a"], slideCount: 1,
  });
  assert.equal(again.ok, true);
});

// ---------- 取消预约 ----------
test("取消预约：无结论玻片回到可约，有结论玻片回到已观察", () => {
  const s1 = okState(createReservationRule(seed, { slideId: "sl-3", microscopeId: "m-2", slot: `${today}|下午`, observer: "张三" }));
  const s2 = okState(cancelReservationRule(s1, lastResId(s1)));
  assert.equal(s2.slides.find((x) => x.id === "sl-3")!.status, "available");

  const s3 = okState(createReservationRule(seed, { slideId: "sl-1", microscopeId: "m-3", slot: `${today}|晚上`, observer: "张三" }));
  const s4 = okState(cancelReservationRule(s3, lastResId(s3)));
  assert.equal(s4.slides.find((x) => x.id === "sl-1")!.status, "observed");
});

console.log(`\n${passed} 项规则测试全部通过`);
