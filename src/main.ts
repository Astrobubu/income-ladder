import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { faceSVG, flagSVG, goalSVG, personSVG } from "./art";
import {
  crossedMilestones,
  formatAmount,
  goalPercent,
  nextMilestone,
  parseLadder,
  position,
  shortAmount,
  type Ladder,
  type Milestone,
} from "./ladder";
import { burst } from "./confetti";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const card = $("card");
const rail = $("rail");
const amountEl = $("amount");
const amountNum = $("amount-num");
const amountCur = $("amount-cur");
const form = $<HTMLFormElement>("amount-form");
const input = $<HTMLInputElement>("amount-input");
const errorEl = $("error");
const tooltip = $("tooltip");
const pin = $("you-pin");

let ladder: Ladder | null = null;
let lastText = "";
let shownAmount = 0;
let structureKey = "";

// ---------- stars ----------
for (let i = 0; i < 26; i++) {
  const s = document.createElement("div");
  s.className = "star";
  s.style.left = `${Math.random() * 100}%`;
  s.style.top = `${Math.random() * 100}%`;
  const size = Math.random() < 0.2 ? 4 : 2;
  s.style.width = s.style.height = `${size}px`;
  s.style.setProperty("--d", `${2 + Math.random() * 3}s`);
  s.style.setProperty("--delay", `${-Math.random() * 4}s`);
  $("sky").appendChild(s);
}

// ---------- building the ladder (only when milestones/looks change) ----------
function build(l: Ladder) {
  const stage = $("stage");
  const notches = $("notches");
  const labels = $("labels");
  stage.innerHTML = notches.innerHTML = labels.innerHTML = "";

  l.milestones.forEach((m, i) => {
    const x = `${position(m.amount, l.scaleMax) * 100}%`;

    const el = document.createElement("div");
    el.className = `ms ${m.kind}`;
    el.dataset.amount = String(m.amount);
    el.style.left = x;
    el.style.setProperty("--delay", `${-i * 0.7}s`);
    el.style.setProperty("--blink", `${-i * 1.3}s`);
    const art =
      m.kind === "person" && m.look ? personSVG(m.look)
      : m.kind === "goal" ? goalSVG(m.color ?? "#ffd23f")
      : flagSVG(m.color ?? "#2ec4b6");
    el.innerHTML = art; // no name tags: names show in the hover tooltip only
    el.addEventListener("mouseenter", () => showTip(el, m));
    el.addEventListener("mouseleave", () => (tooltip.hidden = true));
    stage.appendChild(el);

    const n = document.createElement("div");
    n.className = `notch ${m.kind === "goal" ? "goal" : ""}`;
    n.style.left = x;
    notches.appendChild(n);

    const lbl = document.createElement("div");
    lbl.className = `lbl ${m.kind === "goal" ? "goal" : ""}`;
    lbl.dataset.amount = String(m.amount);
    lbl.style.left = x;
    lbl.textContent = shortAmount(m.amount);
    labels.appendChild(lbl);
  });

  pin.querySelector(".badge")!.innerHTML = faceSVG(l.you.look);
  amountCur.textContent = `${l.currency}/mo`;
}

function showTip(el: HTMLElement, m: Milestone) {
  if (!ladder) return;
  const gap = m.amount - ladder.current;
  const status = gap <= 0 ? "Reached ✓" : `${formatAmount(gap)} ${ladder.currency} to go`;
  tooltip.innerHTML = `<b>${esc(m.name)} · ${formatAmount(m.amount)} ${ladder.currency}</b>${esc(m.note)}<br><i>${status}</i>`;
  tooltip.hidden = false;
  const c = card.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const t = tooltip.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left - c.left + r.width / 2 - t.width / 2), c.width - t.width - 8);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(6, r.top - c.top - t.height - 6)}px`;
}

// ---------- updating the values ----------
function update(l: Ladder, prev: number | null) {
  const p = position(l.current, l.scaleMax);
  const railW = rail.clientWidth;
  $("fill").style.width = `${6 + p * railW}px`;
  pin.style.left = `${p * 100}%`;

  $("pct").textContent = `${goalPercent(l.current, l.goal)}%`;

  document.querySelectorAll<HTMLElement>(".ms").forEach((el) => {
    el.classList.toggle("reached", Number(el.dataset.amount) <= l.current);
  });
  // hide amount labels the pin would sit on top of
  document.querySelectorAll<HTMLElement>(".lbl").forEach((el) => {
    const dx = Math.abs(position(Number(el.dataset.amount), l.scaleMax) - p) * railW;
    el.classList.toggle("hidden", dx < 26);
  });

  const crossed = prev === null ? [] : crossedMilestones(prev, l.current, l.milestones);
  setNextText(l, crossed[crossed.length - 1]);
  countTo(l.current);
  if (crossed.length) celebrate(crossed);
}

function setNextText(l: Ladder, justPassed?: Milestone) {
  const next = $("next");
  if (justPassed) {
    next.classList.add("party");
    next.textContent = `You passed ${justPassed.name}! 🎉`;
    setTimeout(() => {
      next.classList.remove("party");
      if (ladder) setNextText(ladder);
    }, 4000);
    return;
  }
  const n = nextMilestone(l.current, l.milestones);
  next.innerHTML = n
    ? `Next: <b>${esc(n.name)}</b> · ${formatAmount(n.amount - l.current)} to go`
    : `<b>Past everything.</b> Add a new milestone!`;
}

function countTo(target: number) {
  const from = shownAmount;
  const start = performance.now();
  const dur = 1200;
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / dur);
    shownAmount = from + (target - from) * (1 - Math.pow(1 - k, 3));
    amountNum.textContent = formatAmount(shownAmount);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function celebrate(crossed: Milestone[]) {
  const c = card.getBoundingClientRect();
  crossed.forEach((m, i) => {
    const el = document.querySelector<HTMLElement>(`.ms[data-amount="${m.amount}"]`);
    if (!el) return;
    setTimeout(() => {
      el.classList.remove("cheer");
      void el.offsetWidth; // restart the animation
      el.classList.add("cheer");
      setTimeout(() => el.classList.remove("cheer"), 1800);
      const r = el.getBoundingClientRect();
      burst(r.left - c.left + r.width / 2, r.top - c.top + 10, m.kind === "goal" ? 140 : 70);
    }, 700 + i * 450); // wait for the bar to arrive first
  });
  pin.classList.remove("cheer");
  void pin.offsetWidth;
  pin.classList.add("cheer");
}

// ---------- loading / polling ladder.json ----------
async function refresh() {
  let text: string;
  try {
    text = await invoke<string>("read_ladder");
  } catch (e) {
    return showError(String(e));
  }
  if (text === lastText) return;
  let next: Ladder;
  try {
    next = parseLadder(text);
  } catch (e) {
    return showError((e as Error).message);
  }
  lastText = text;
  errorEl.hidden = true;
  const key = JSON.stringify([next.milestones, next.you, next.scaleMax, next.currency]);
  if (key !== structureKey) {
    build(next);
    structureKey = key;
  }
  const prev = ladder ? ladder.current : null;
  ladder = next;
  update(next, prev);
}

function showError(msg: string) {
  errorEl.textContent = `⚠ ${msg}. Keeping the last good values.`;
  errorEl.hidden = false;
}

// ---------- editing ----------
function openEditor() {
  if (!ladder) return;
  amountEl.hidden = true;
  form.hidden = false;
  input.value = String(ladder.current);
  input.focus();
  input.select();
}
function closeEditor() {
  form.hidden = true;
  amountEl.hidden = false;
}
amountEl.addEventListener("dblclick", openEditor);
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = Number(input.value.replace(/[,\s]/g, ""));
  if (!Number.isFinite(value) || value < 0) {
    input.animate([{ transform: "translateX(-4px)" }, { transform: "translateX(4px)" }], { duration: 80, iterations: 3 });
    return;
  }
  closeEditor();
  try {
    await invoke("set_current", { amount: Math.round(value) });
  } catch (err) {
    return showError(String(err));
  }
  await refresh();
});
input.addEventListener("keydown", (e) => e.key === "Escape" && closeEditor());
input.addEventListener("blur", () => setTimeout(closeEditor, 100));

// ---------- dragging the widget (manual, so double-click never maximises) ----------
card.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || (e.target as HTMLElement).closest("[data-nodrag]")) return;
  getCurrentWindow().startDragging();
});

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

listen("edit-amount", openEditor);
document.fonts.ready.then(refresh);
setInterval(refresh, 2500); // picks up hand edits to ladder.json
