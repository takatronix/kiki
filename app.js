"use strict";
// Each button plays one clip: "Hello KiKi", ~2.2 s while KiKi answers, then the English command (clips/<id>.mp3).
// One <audio>, played from inside the tap (autoplay rules in the Tesla browser / iOS / Android); nothing plays on load.
// A tap while a clip plays cuts it and plays the new one. Clips are fetched once into blob: URLs (no Range requests).
// The picture at the top is a guess from the last command that played to the end (no feedback from the shade):
// shade position, light colour / mode / brightness, kept in localStorage.
const BASE = document.documentElement.dataset.base || "";   // the car copy lives under shade/
const $ = (id) => document.getElementById(id);
const audio = $("audio"), pill = $("play"), err = $("err");
const btns = [...document.querySelectorAll("button.k")];
const blobs = {};                       // id -> blob: URL
let cur = null;                         // the button whose clip is playing
const segEn = $("seg-en"), segDefault = segEn.textContent;   // under the 1–10 bar: the level being played
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

// iOS 17+: play even with the ring/silent switch on
try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}

const wave = document.createElement("span");
wave.className = "wave";
wave.innerHTML = "<i></i><i></i><i></i><i></i>";

function mark(b) {
  if (cur) cur.classList.remove("playing");
  cur = b;
  if (b) { b.classList.add("playing"); b.appendChild(wave); } else wave.remove();
  pill.classList.toggle("on", !!b);
}

function tap(b) {
  const id = b.dataset.id;
  err.textContent = "";
  audio.pause();
  audio.src = blobs[id] || `${BASE}clips/${id}.mp3`;
  mark(b);
  segEn.textContent = b.dataset.en || segDefault;
  const p = audio.play();
  if (p && p.catch) p.catch((e) => {
    if (e && e.name === "AbortError") return;          // cut by the next tap
    if (cur === b) mark(null);
    err.textContent = "音を出せませんでした。もう一度押してください。";
  });
}

btns.forEach((b) => b.addEventListener("click", () => tap(b)));
audio.addEventListener("ended", () => { const b = cur; mark(null); segEn.textContent = segDefault; if (b) apply(b.dataset.id); });
audio.addEventListener("error", () => { if (cur) { mark(null); err.textContent = "音声を読み込めませんでした。"; } });

for (const b of btns) {
  const id = b.dataset.id;
  fetch(`${BASE}clips/${id}.mp3`).then((r) => (r.ok ? r.blob() : null))
    .then((bl) => { if (bl) blobs[id] = URL.createObjectURL(bl); }).catch(() => {});
}

// ---- the guessed state ----
const TRAVEL = 7000;                    // ms for the fabric to go all the way (a guess)
const COLORS = { red: "#ff453a", green: "#30d158", blue: "#2f6bff", white: "#f2f4ff", purple: "#a35cff", cyan: "#2ad4ee",
                 yellow: "#ffd60a", orange: "#ff9500", pink: "#ff6fae" };
const CNAME = { red: "赤", green: "緑", blue: "青", white: "白", purple: "紫", cyan: "シアン", yellow: "黄", orange: "オレンジ", pink: "ピンク" };
const MODES = { rainbow: "レインボー", flowing: "流れる", breathing: "呼吸", gradual: "グラデーション", magic: "マジック", sport: "スポーツ",
                auto: "オート", grad_rb: "赤と青", grad_rg: "赤と緑", grad_bg: "青と緑", ice_flow: "水色の流れ" };
const KEY = "kiki-state-v1";
// shade: p = how far closed (0 open … 1 closed) at time t, moving dir (-1 opening, 0, +1 closing)
let st = { p: 0, dir: 0, t: 0, on: true, color: "white", mode: null, bri: null };
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

function pos(now) {
  if (!st.dir) return st.p;
  return Math.min(1, Math.max(0, st.p + st.dir * (now - st.t) / TRAVEL));
}
function move(dir) {
  const now = Date.now();
  st.p = pos(now); st.t = now; st.dir = dir;
}

function apply(id) {
  if (id === "open") move(-1);
  else if (id === "close") move(1);
  else if (id === "stop") move(0);
  else if (id === "lights_on") st.on = true;
  else if (id === "lights_off") st.on = false;
  else if (id === "bri_up") { st.on = true; st.bri = Math.min(10, (st.bri || 5) + 1); }
  else if (id === "bri_down") { st.on = true; st.bri = Math.max(1, (st.bri || 5) - 1); }
  else if (id === "bri_low") { st.on = true; st.bri = 1; }
  else if (id === "bri_high") { st.on = true; st.bri = 10; }
  else if (id.startsWith("bri_")) { st.on = true; st.bri = +id.slice(4); }
  else if (COLORS[id]) { st.on = true; st.color = id; st.mode = null; }
  else if (MODES[id]) { st.on = true; st.mode = id; }
  else return;                          // volume: nothing to show
  save();
  paint();
  kick();
}

// ---- drawing ----
const fabric = $("fabric"), hem = $("hem"), glow = $("glow"), ga = $("glow-a"), gb = $("glow-b");
const glowLine = $("glow-line"), glowSoft = $("glow-soft");
const ROOF_W = 166, ROLL_X = 262;      // roller at the front edge of the glass roof

const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;
const mix = (a, b, f) => {               // two #rrggbb, 0..1
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * f)).join(",")})`;
};

function glowAt(t) {                     // -> [colour a, colour b, opacity 0..1, dash offset or null]
  const base = COLORS[st.color] || COLORS.white, s = t / 1000, wave = (k) => 0.5 + 0.5 * Math.sin(s * k);
  switch (st.mode) {
    case "rainbow": return [hsl(s * 70, 95, 60), hsl(s * 70 + 140, 95, 60), 1, null];
    case "flowing": return ["#2f6bff", "#6fd0ff", 1, -s * 60];
    case "breathing": return [base, base, 0.25 + 0.75 * wave(2), null];
    case "gradual": return [hsl(s * 18, 90, 60), hsl(s * 18 + 40, 90, 60), 1, null];
    case "magic": { const h = Math.floor(s * 2.5) * 97; return [hsl(h, 95, 62), hsl(h + 160, 95, 62), 0.75 + 0.25 * wave(9), null]; }
    case "sport": return ["#ff453a", "#ff2d20", 0.45 + 0.55 * wave(8), -s * 140];
    case "auto": return [mix("#ffe8c2", "#cfe0ff", wave(0.6)), mix("#cfe0ff", "#ffe8c2", wave(0.6)), 1, null];
    case "grad_rb": return [mix("#ff453a", "#2f6bff", wave(1)), mix("#2f6bff", "#ff453a", wave(1)), 1, null];
    case "grad_rg": return [mix("#ff453a", "#30d158", wave(1)), mix("#30d158", "#ff453a", wave(1)), 1, null];
    case "grad_bg": return [mix("#2f6bff", "#30d158", wave(1)), mix("#30d158", "#2f6bff", wave(1)), 1, null];
    case "ice_flow": return ["#9be7ff", "#d9f6ff", 1, -s * 45];
    default: return [base, base, 1, null];
  }
}

function shadeText(p, dir) {
  if (dir < 0) return "開いています…";
  if (dir > 0) return "閉じています…";
  if (p <= 0.001) return "開いています";
  if (p >= 0.999) return "閉じています";
  return "途中で止まっています";
}

let lastText = "";
function draw(now) {
  const p = pos(now);
  if (st.dir && (p <= 0 || p >= 1)) { st.p = p; st.dir = 0; save(); }
  const w = ROOF_W * p;
  fabric.setAttribute("x", ROLL_X - w); fabric.setAttribute("width", w);
  hem.setAttribute("x", ROLL_X - w - 3); hem.style.opacity = p > 0.01 ? 1 : 0;
  const shown = reduced.matches && st.mode ? 1000 : now;      // reduced motion: a still frame of the mode
  const [a, b, op, dash] = glowAt(shown);
  ga.setAttribute("stop-color", a); gb.setAttribute("stop-color", b);
  const bri = st.bri || 6;
  glow.setAttribute("opacity", st.on ? ((0.35 + 0.065 * bri) * op).toFixed(3) : 0);
  for (const el of [glowLine, glowSoft]) {
    if (dash === null || reduced.matches) el.removeAttribute("stroke-dasharray");
    else { el.setAttribute("stroke-dasharray", "60 40"); el.setAttribute("stroke-dashoffset", dash.toFixed(1)); }
  }
  const txt = shadeText(p, st.dir);
  if (txt !== lastText) { $("st-shade").textContent = txt; lastText = txt; }
  $("st-shade-dot").style.background = st.dir ? "#9db5ff" : "#6b7079";
  $("st-light-dot").style.background = st.on ? a : "#33363c";
  $("st-light-dot").style.color = st.on ? a : "transparent";
}

function paint() {                       // the parts that change only with a command
  const light = !st.on ? "照明 消灯" : `照明 ${st.mode ? MODES[st.mode] : CNAME[st.color] || "白"}${st.bri ? `・明るさ ${st.bri}` : ""}`;
  $("st-light").textContent = light;
  document.querySelectorAll(".k.sw").forEach((b) => b.classList.toggle("sel", st.on && !st.mode && b.dataset.id === st.color));
  document.querySelectorAll(".k.md").forEach((b) => b.classList.toggle("sel", st.on && b.dataset.id === st.mode));
  const lc = COLORS[st.color] || COLORS.white;
  document.querySelectorAll(".k.lv").forEach((b, i) => {
    b.classList.toggle("lit", !!st.bri && st.on && i < st.bri);
    b.classList.toggle("cur", st.bri === i + 1);
    b.style.setProperty("--lc", st.mode ? "#cfd6ff" : lc);
  });
}

let raf = 0;
function frame() {
  raf = 0;
  const now = Date.now();
  draw(now);
  if (st.dir || (st.on && st.mode && !reduced.matches)) raf = requestAnimationFrame(frame);
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
reduced.addEventListener && reduced.addEventListener("change", kick);
paint(); draw(Date.now()); kick();


if (document.querySelector('link[rel="manifest"]') && "serviceWorker" in navigator) {
  const had = !!navigator.serviceWorker.controller;   // an update: show the new page once the new worker takes over
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had && !cur) location.reload(); });
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
