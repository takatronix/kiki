"use strict";
// Each button plays one clip: "Hello KiKi", ~2.3 s while KiKi answers, then the English command (clips/<id>.mp3).
// One <audio>, played from inside the tap (autoplay rules in the Tesla browser / iOS / Android); nothing plays on load.
// A tap while a clip plays cuts it and plays the new one. Clips are fetched once into blob: URLs.
const audio = document.getElementById("audio"), play = document.getElementById("play"), err = document.getElementById("err");
const btns = [...document.querySelectorAll("button.b")];
const blobs = {};                       // id -> blob: URL
let cur = null;                         // the button whose clip is playing

// iOS 17+: play even with the ring/silent switch on
try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}

function mark(b) {
  if (cur) cur.classList.remove("playing");
  cur = b;
  if (b) b.classList.add("playing");
  play.classList.toggle("on", !!b);
}

function tap(b) {
  const id = b.dataset.id;
  err.textContent = "";
  audio.pause();
  audio.src = blobs[id] || `clips/${id}.mp3`;
  mark(b);
  const p = audio.play();
  if (p && p.catch) p.catch((e) => {
    if (e && e.name === "AbortError") return;          // cut by the next tap
    if (cur === b) mark(null);
    err.textContent = "音を出せませんでした。もう一度押してください。";
  });
}

btns.forEach((b) => b.addEventListener("click", () => tap(b)));
audio.addEventListener("ended", () => mark(null));
audio.addEventListener("error", () => { if (cur) { mark(null); err.textContent = "音声を読み込めませんでした。"; } });

for (const b of btns) {
  const id = b.dataset.id;
  fetch(`clips/${id}.mp3`).then((r) => (r.ok ? r.blob() : null))
    .then((bl) => { if (bl) blobs[id] = URL.createObjectURL(bl); }).catch(() => {});
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
