(function () {
  const plan = window.PLAN || [];
  const esc = v => String(v).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const badge = s => (/^\d+$/.test(s.num) ? esc(s.num) : `<i class="ti ti-${s.num}" aria-hidden="true"></i>`);
  const all = plan.flatMap(s => s.questions.map(q => ({ ...q, step: s })));
  const $ = id => document.getElementById(id);

  // Question list page
  if ($("plan-list")) {
    $("plan-jump").innerHTML = plan.map(s => `<a href="#${s.id}" class="${s.cls}"><span>${badge(s)}</span>${esc(s.title)}</a>`).join("");
    $("plan-list").innerHTML = plan.map(s => `
      <section id="${s.id}" class="stage ${s.cls}">
        <p class="stage-when">${esc(s.when)}</p>
        <h2><span class="stage-num">${badge(s)}</span>${esc(s.title)}</h2>
        <ol class="q-list">
          ${s.questions.map(q => `<li><a href="question.html?q=${q.slug}"><span>${esc(q.q)}</span><i class="ti ti-chevron-right" aria-hidden="true"></i></a></li>`).join("")}
        </ol>
        ${s.bench ? `<p class="stage-bench"><span class="diamond" aria-hidden="true"></span><span><strong>Benchmark</strong> ${esc(s.bench)}</span></p>` : ""}
      </section>`).join("");
    if (location.hash) { const t = document.querySelector(location.hash); if (t) t.scrollIntoView(); }
  }

  // Single question page
  if ($("question")) {
    const moved = { criteria: "scope", drafting: "teams", precedents: "requirements", assembly: "teams" }; // questions merged into another page
    const raw = new URLSearchParams(location.search).get("q");
    const slug = moved[raw] || raw;
    const i = all.findIndex(q => q.slug === slug);
    if (i < 0) { $("question").innerHTML = '<p>That question isn’t in the plan. <a href="plan.html">See all questions</a>.</p>'; return; }
    const q = all[i], s = q.step;
    document.title = `${q.q} · Medical Humanities`;
    $("back-link").href = `plan.html#${s.id}`;
    $("question").className = `stage ${s.cls}`;
    $("question").innerHTML = `
      <p class="stage-when"><span class="stage-num">${badge(s)}</span>${esc(s.title)} · ${esc(s.when)}</p>
      <h1 class="q-title">${esc(q.q)}</h1>
      <div class="q-body">${q.body.map(p => `<p>${esc(p)}</p>`).join("")}</div>
      ${q.decide && q.decide.length ? `<div class="q-decide"><h2>To decide</h2><ul>${q.decide.map(d => `<li>${esc(d)}</li>`).join("")}</ul></div>` : ""}
      ${q.see ? `<p><a class="section-link" href="${q.see.href}">${esc(q.see.label)} <i class="ti ti-arrow-right" aria-hidden="true"></i></a></p>` : ""}`;
    const prev = all[i - 1], next = all[i + 1];
    $("q-nav").innerHTML = `
      ${prev ? `<a class="q-prev" href="question.html?q=${prev.slug}"><small><i class="ti ti-arrow-left" aria-hidden="true"></i> Previous</small>${esc(prev.q)}</a>` : "<span></span>"}
      ${next ? `<a class="q-next" href="question.html?q=${next.slug}"><small>Next <i class="ti ti-arrow-right" aria-hidden="true"></i></small>${esc(next.q)}</a>` : "<span></span>"}`;
  }
})();
