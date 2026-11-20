const BIGINT_TWO = 2n;
const F = 10000n;
const PF = F * F;

const parseScaledDecimal = (v) => {
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(v.trim());
  if (!m) return null;
  const f = (m[2] ?? "").padEnd(4, "0");
  return BigInt(m[1]) * F + BigInt(f || "0");
};

const parsePos = (v) => {
  const m = /^(\d+)(?:\.(0+))?$/.exec(v.trim());
  if (!m) return null;
  const q = BigInt(m[1]);
  return q > 0n ? q : null;
};

const fmt = (v) => {
  const w = v / F;
  const f = (v % F).toString().padStart(4, "0").replace(/0+$/, "");
  return f ? `${w}.${f}` : w.toString();
};

const calc = (lines, ref, refQty) => {
  const rb = parseScaledDecimal(ref.baseQuantity);
  if (!rb || rb <= 0n) return null;
  const scale = (refQty * PF + rb / BIGINT_TWO) / rb;
  if (scale <= 0n) return null;
  const qs = [];
  for (const l of lines) {
    const b = parseScaledDecimal(l.baseQuantity);
    if (!b || b <= 0n) return null;
    const p = b * scale;
    if (p % PF !== 0n) return null;
    qs.push(p / PF);
  }
  const i = lines.findIndex((l) => l.key === ref.key);
  if (i < 0 || qs[i] !== refQty) return null;
  return { scale: fmt(scale), quantities: qs };
};

const plan = (lines, vals) => {
  if (lines.length === 0) return null;
  const qs = lines.map((l) => parsePos(vals[l.key] ?? ""));
  const r = qs[0];
  if (r === null || qs.some((q) => q === null)) return { error: "wholeNumbersOnly" };
  const c = calc(lines, lines[0], r);
  if (!c || c.quantities.some((q, i) => q !== qs[i])) return { error: "invalidRatio" };
  return {
    multiplier: c.scale,
    outputYield: lines.flatMap((l, i) =>
      l.direction === "output" ? [{ code: l.key, quantity: c.quantities[i] }] : []
    ),
  };
};

const L = (key, direction, baseQuantity) => ({ key, direction, baseQuantity });
const base = [L("input:in-1", "input", "1"), L("primary-output:out-1", "output", "25")];
const doubled = [L("input:in-1", "input", "2"), L("primary-output:out-1", "output", "50")];
const trebled = [L("input:in-1", "input", "3"), L("primary-output:out-1", "output", "75")];
const replaced = [L("input:in-9", "input", "1"), L("primary-output:out-9", "output", "25")];
const entered = { "input:in-1": "2", "primary-output:out-1": "50" };

const show = (name, p) =>
  console.log(name, JSON.stringify(p, (k, v) => (typeof v === "bigint" ? v.toString() : v)));

show("1->25 basis, entered 2/50 (expect multiplier 2):", plan(base, entered));
show("2->50 basis, entered 2/50 (expect multiplier 1):", plan(doubled, entered));
show("3->75 basis, entered 2/50 (expect invalidRatio):", plan(trebled, entered));
show("replaced keys, entered 2/50 (expect wholeNumbersOnly):", plan(replaced, entered));
show(
  "1->25 basis, entered 1/25 (expect multiplier 1):",
  plan(base, { "input:in-1": "1", "primary-output:out-1": "25" })
);
show("no lines (expect null):", plan([], {}));
