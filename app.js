// Image quality study: guide (two examples), then every pair in random order with left/right shuffled.
// Each image is rated on its own: quality 1-5 and artifacts Yes/No. Answers of each pair are sent to the sheet on "Next".
const $ = (id) => document.getElementById(id);
const participant = Math.random().toString(36).slice(2, 10);
let pairs = [], trial = 0, answers = {}, pending = [];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function show(id) {
  for (const s of document.querySelectorAll(".page")) s.hidden = s.id !== id;
  window.scrollTo(0, 0);
}

// one rating card; fixed = {quality, artifacts} shows the answers of a guide example instead of asking
function card(title, src, fixed, onChange) {
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `<h2>${title}</h2><img src="${src}" alt="${title}">
    <div class="q"><div class="q-label">Visual quality</div><div class="opts" data-q="quality"></div>
      <div class="ends"><span>1 very poor</span><span>5 excellent</span></div></div>
    <div class="q"><div class="q-label">Visual artifacts?</div><div class="opts" data-q="artifacts"></div></div>`;
  el.querySelector("img").onclick = () => { $("zoom").querySelector("img").src = src; $("zoom").hidden = false; };
  const choices = { quality: ["1", "2", "3", "4", "5"], artifacts: ["Yes", "No"] };
  for (const box of el.querySelectorAll(".opts")) {
    const q = box.dataset.q;
    for (const v of choices[q]) {
      const b = document.createElement("button");
      b.textContent = v;
      if (fixed) { b.disabled = true; b.classList.toggle("on", String(fixed[q]) === v); }
      else b.onclick = () => {
        for (const o of box.children) o.classList.toggle("on", o === b);
        onChange(q, v);
      };
      box.appendChild(b);
    }
  }
  return el;
}

function renderGuide(guide) {
  const box = $("guide-pair");
  const notes = ["Sharp, natural detail and clean lighting: quality 5, no artifacts.",
                 "The pot and the fire do not make physical sense: quality 1, artifacts present."];
  guide.forEach((g, i) => {
    const c = card(`Example ${i + 1}`, g.src, g);
    const p = document.createElement("p"); p.className = "note"; p.textContent = notes[i];
    c.appendChild(p); box.appendChild(c);
  });
}

function renderTrial() {
  const [a, b] = pairs[trial];
  answers = { A: {}, B: {} };
  $("count").textContent = `Pair ${trial + 1} of ${pairs.length}`;
  $("bar").style.width = `${100 * trial / pairs.length}%`;
  $("next").disabled = true;
  const box = $("pair"); box.innerHTML = "";
  [["A", a], ["B", b]].forEach(([pos, src]) => box.appendChild(card(`Image ${pos}`, src, null, (q, v) => {
    answers[pos][q] = v;
    $("next").disabled = !["A", "B"].every((p) => answers[p].quality && answers[p].artifacts);
  })));
  if (trial + 1 < pairs.length) for (const src of pairs[trial + 1]) new Image().src = src;  // preload the next pair
}

function send(rows) {
  if (!SHEET_URL) { console.log("not saved (no SHEET_URL):", rows); return Promise.resolve(); }
  return fetch(SHEET_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
                            body: JSON.stringify({ rows }) });
}

function next() {
  const [a, b] = pairs[trial];
  const rows = [["A", a], ["B", b]].map(([pos, src]) => ({
    participant, trial: trial + 1, position: pos, image: src.replace(/^img\/|\.jpg$/g, ""),
    quality: Number(answers[pos].quality), artifacts: answers[pos].artifacts }));
  pending.push(send(rows).catch(() => send(rows)));  // one retry on a network error
  trial += 1;
  if (trial < pairs.length) { renderTrial(); window.scrollTo(0, 0); return; }
  $("bar").style.width = "100%";
  show("done");
  $("done-msg").textContent = "Saving your answers…";
  Promise.allSettled(pending).then((r) => {
    $("done-msg").textContent = r.every((x) => x.status === "fulfilled")
      ? "Your answers have been recorded. You can close this page."
      : "Some answers could not be sent. Please check your connection and contact the organizers.";
  });
}

fetch("study.json").then((r) => r.json()).then((s) => {
  pairs = shuffle(s.pairs.map((p) => shuffle([...p])));
  for (const el of document.querySelectorAll(".npairs")) el.textContent = pairs.length;
  renderGuide(s.guide);
  $("to-guide").onclick = () => show("guide");
  $("to-study").onclick = () => { show("study"); renderTrial(); };
  $("next").onclick = next;
  $("zoom").onclick = () => { $("zoom").hidden = true; };
});
