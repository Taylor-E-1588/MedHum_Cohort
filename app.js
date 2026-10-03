(function () {
  const G = window.GENED || { modes: [], integrations: [] };
  const NONE = "Not yet identified";
  const UNKNOWN = "Not recorded";

  const sortKey = title => title.replace(/^The\s+/i, "");
  // Order by course prefix, then number (provisional digits like 2xxx sort after real numbers), then title
  const numKey = c => {
    const m = /^([A-Z]+)\s*([0-9x]*)/i.exec(c.number || "");
    return m ? [m[1].toUpperCase(), (m[2] || "").toLowerCase().replace(/x/g, "9").padEnd(4, "9")] : ["~", "9999"];
  };
  const courses = (window.COURSES || []).slice().sort((a, b) => {
    const [pa, na] = numKey(a), [pb, nb] = numKey(b);
    return pa.localeCompare(pb) || na.localeCompare(nb) || sortKey(a.title).localeCompare(sortKey(b.title));
  });

  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  // ---------- derived values ----------

  function seasons(c) {
    const t = c.term || "";
    const found = ["Fall", "Winter", "Spring"].filter(s => new RegExp(s, "i").test(t));
    return found.length ? found : [UNKNOWN];
  }
  const departments = c => (c.department ? c.department.split(" / ").map(d => d.trim()) : [UNKNOWN]);
  const programsOf = c => (c.program ? c.program.split(" / ").map(d => d.trim()) : ["None"]);
  const levelDigit = c => { const m = /\b([1-4])(?:\d{3}|xxx)\b/i.exec(c.number || ""); return m ? +m[1] : null; };
  const levelOf = c => (levelDigit(c) ? levelDigit(c) * 1000 + "-level" : UNKNOWN);
  const FYS = "First Year Seminar";
  const moiOf = c => [c.fys ? FYS : c.mode || NONE];
  function pilotOf(c) {
    if (!c.pilot) return null;
    const m = /(fall|winter|spring)\s+(20\d\d)/i.exec(c.pilot);
    return { kind: /pre-?pilot/i.test(c.pilot) ? "Pre-pilot" : "Pilot", when: m ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}` : "" };
  }

  // Gen Ed colors follow the Compass Curriculum graphic: Modes of Inquiry blue,
  // Integrations orange-gold, First Year Seminar green. Each category has its own icon.
  const CBL_COLOR = "#b8325f";
  const MOI_BLUE = "#006db5", INTEG_GOLD = "#d0710f", FYS_GREEN = "#3d8f4f";
  const GE_STYLE = {
    "First Year Seminar": ["door-enter", FYS_GREEN],
    "Creative Making": ["palette", MOI_BLUE],
    "Ethical Reasoning": ["scale", MOI_BLUE],
    "Humanistic Inquiry and Analysis": ["book", MOI_BLUE],
    "Quantitative Reasoning": ["chart-bar", MOI_BLUE],
    "Social Scientific Inquiry and Analysis": ["users-group", MOI_BLUE],
    "Scientific Inquiry and Analysis": ["flask", MOI_BLUE],
    "Intercultural Communication": ["language", MOI_BLUE],
    "Physical Education and Wellness": ["heartbeat", MOI_BLUE],
    "Additional Writing Intensive": ["pencil", INTEG_GOLD],
    "Cultures and Contexts": ["world", INTEG_GOLD],
    "Historical Perspectives": ["hourglass", INTEG_GOLD],
    "Signature Experience": ["star", INTEG_GOLD]
  };
  const geIcon = name => (GE_STYLE[name] ? `<i class="ti ti-${GE_STYLE[name][0]}" aria-hidden="true"></i>` : "");

  // Frequency as a four-year pie: one quadrant per academic year, starting with the
  // current academic year at the top right and going clockwise. Filled = offered that
  // year; light = offered this often, but which years isn't known.
  const today = new Date();
  const FIRST_YEAR = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1; // academic year starts in August
  function academicYearIndex(text) {
    // Fall 2026 → 2026–27; Winter or Spring 2027 → 2026–27. Returns years relative to 2026–27.
    const found = [];
    for (const m of text.matchAll(/(fall|winter|spring)\s+(20\d\d)/gi)) {
      const y = +m[2];
      found.push((/fall/i.test(m[1]) ? y : y - 1) - FIRST_YEAR);
    }
    return found;
  }
  function rhythm(c) {
    const f = (c.frequency || "").toLowerCase();
    let key = UNKNOWN, cycle = 0, half = false;
    if (/every one to two|1.2 years/.test(f)) { key = "Every 1–2 years"; cycle = 2; half = true; }
    else if (/every other|every two|biennial/.test(f)) { key = "Every other year"; cycle = 2; }
    else if (/every year|annual|each year|yearly/.test(f)) { key = "Every year"; cycle = 1; }
    if (!cycle) return { key, quads: null };
    const years = academicYearIndex([c.term, c.pilot].filter(Boolean).join(" "));
    const known = years.length > 0;
    const phase = known ? ((years.find(i => i >= 0) ?? years[years.length - 1]) % cycle + cycle) % cycle : 0;
    const quads = [0, 1, 2, 3].map(i => {
      if (!known) return cycle === 1 ? "on" : (i % cycle === 0 ? "soft" : half ? "soft-half" : "off");
      if (i % cycle === phase) return "on";
      return half ? "half" : "off";
    });
    const title = key;
    return { key, quads, title };
  }
  function pie(r) {
    const paths = ["M12 12V2A10 10 0 0 1 22 12Z", "M12 12H22A10 10 0 0 1 12 22Z", "M12 12V22A10 10 0 0 1 2 12Z", "M12 12H2A10 10 0 0 1 12 2Z"];
    return `<span class="tip" tabindex="0" data-tip="${esc(r.title)}"><svg class="pie" viewBox="0 0 24 24" role="img" aria-label="${esc(r.title)}">${r.quads.map((q, i) => `<path class="q ${q}" d="${paths[i]}"/>`).join("")}<circle cx="12" cy="12" r="10" class="rim"/><path d="M12 2v20M2 12h20" class="cross"/></svg></span>`;
  }

  // Each facet: how to read a course's values, and the full list of options (so gaps show as zero).
  const facets = [
    { key: "mode", title: "FYS or MOI", values: moiOf, options: () => [FYS, ...G.modes, NONE] },
    { key: "integration", title: "Integrations", values: c => (c.integrations && c.integrations.length ? c.integrations : [NONE]), options: () => [...G.integrations, NONE] },
    { key: "term", title: "When taught", values: seasons, options: () => ["Fall", "Winter", "Spring", UNKNOWN] },
    { key: "cbl", title: "CBL", values: c => [c.cbl ? "Yes" : "Not indicated"], options: () => ["Yes", "Not indicated"] },
    { key: "pilot", title: "Pilot", values: c => [pilotOf(c) ? `${pilotOf(c).kind} ${pilotOf(c).when}`.trim() : "Not piloted"], options: () => [...new Set(courses.map(pilotOf).filter(Boolean).map(p => `${p.kind} ${p.when}`.trim()))].sort().concat("Not piloted") },
    { key: "freq", title: "How often", values: c => [rhythm(c).key], options: () => ["Every year", "Every other year", "Every 1–2 years", UNKNOWN] },
    { key: "level", title: "Level", values: c => [levelOf(c)], options: () => ["1000-level", "2000-level", "3000-level", UNKNOWN] },
    { key: "department", title: "Department", values: departments, options: () => { const all = [...new Set(courses.flatMap(departments))]; return all.filter(d => d !== UNKNOWN).sort().concat(all.includes(UNKNOWN) ? [UNKNOWN] : []); } },
    { key: "program", title: "Interdisciplinary program", values: programsOf, options: () => [...new Set(courses.flatMap(programsOf))].filter(d => d !== "None").sort().concat("None") },
    { key: "syllabus", title: "Syllabus", values: c => [c.syllabus ? "Posted" : "Not posted"], options: () => ["Posted", "Not posted"] }
  ];

  // ---------- state ----------

  const state = { q: "", view: "cards", sel: Object.fromEntries(facets.map(f => [f.key, new Set()])) };
  try { const v = localStorage.getItem("mh-view"); if (v === "grid" || v === "cards") state.view = v; } catch (e) {}
  const urlView = new URLSearchParams(location.search).get("view");
  if (urlView === "grid" || urlView === "cards") state.view = urlView;

  function matchesSearch(c) {
    if (!state.q) return true;
    return [c.title, c.faculty, c.department || "", c.program || "", c.number, c.formerNumber, c.previousTitle].join(" ").toLowerCase().includes(state.q);
  }
  function matchesFacets(c, skipKey) {
    return facets.every(f => {
      if (f.key === skipKey) return true;
      const s = state.sel[f.key];
      return !s.size || f.values(c).some(v => s.has(v));
    });
  }

  // ---------- rendering: filters with coverage bars ----------

  const filterBox = $("filters");

  // A course listed under more than one option in the same filter (e.g., two departments) is "shared":
  // its part of each bar is drawn lighter, so repeated counts don't look like extra courses.
  const realValues = (f, c) => f.values(c).filter(v => v !== NONE && v !== UNKNOWN && v !== "None");
  const isShared = (f, c) => realValues(f, c).length > 1;
  const nouns = { department: ["department", "departments"], program: ["program", "programs"], integration: ["Integration", "Integrations"], term: ["term", "terms"] };

  function renderFilters() {
    filterBox.innerHTML = facets.map(f => {
      const pool = courses.filter(c => matchesSearch(c) && matchesFacets(c, f.key));
      const max = Math.max(1, pool.length);
      const pct = n => `${(n / max) * 100}%`;
      const rows = f.options().map(opt => {
        const hits = pool.filter(c => f.values(c).includes(opt));
        const seg = (lead, shared) => hits.filter(c => (c.commitment === "lead") === lead && isShared(f, c) === shared).length;
        const cs = seg(false, false), cx = seg(false, true), ls = seg(true, false), lx = seg(true, true);
        const conf = cs + cx, lead = ls + lx, shared = cx + lx;
        const on = state.sel[f.key].has(opt);
        const lines = [];
        if (conf) lines.push(`Blue: ${conf} requested by instructor${conf === 1 ? "" : "s"}` + (cx ? ` (lighter: ${cx} also counted elsewhere)` : ""));
        if (lead) lines.push(`Stripes: ${lead} suggested` + (lx ? ` (lighter: ${lx} also counted elsewhere)` : ""));
        const tip = lines.length ? lines.join("\n") : "No courses";
        return `<button type="button" class="opt${on ? " on" : ""}${hits.length ? "" : " zero"}${opt === NONE || opt === UNKNOWN ? " gap" : ""}"
            data-facet="${f.key}" data-value="${esc(opt)}" aria-pressed="${on}" data-bar-tip="${esc(tip)}">
            <span class="opt-label">${GE_STYLE[opt] ? `<span class="opt-ic" style="color:${GE_STYLE[opt][1]}">${geIcon(opt)}</span>` : ""}${esc(opt)}</span>
            <span class="opt-count">${hits.length}</span>
            <span class="bar" aria-hidden="true"><span class="bar-conf" style="width:${pct(cs)}"></span><span class="bar-conf shared" style="width:${pct(cx)}"></span><span class="bar-lead" style="width:${pct(ls)}"></span><span class="bar-lead shared" style="width:${pct(lx)}"></span></span>
          </button>`;
      }).join("");
      const multi = pool.filter(c => isShared(f, c)).length;
      const [one, many] = nouns[f.key] || ["option", "options"];
      const note = multi ? `<p class="facet-note"><span class="k-shared"></span>${multi} course${multi === 1 ? " is" : "s are"} counted under more than one ${one}, so these numbers add up to more than ${pool.length}.</p>` : "";
      const n = state.sel[f.key].size;
      return `<details class="facet" data-key="${f.key}" ${["mode", "integration", "term", "freq", "level"].includes(f.key) ? "open" : ""}>
          <summary>${esc(f.title)}${n ? `<span class="facet-n">${n}</span>` : ""}</summary>
          <div class="opts">${rows}</div>${note}
        </details>`;
    }).join("");
  }

  // Keep open/closed state of facet groups across re-renders.
  function preserveOpen(fn) {
    const open = {};
    filterBox.querySelectorAll(".facet").forEach(d => (open[d.dataset.key] = d.open));
    fn();
    filterBox.querySelectorAll(".facet").forEach(d => { if (d.dataset.key in open) d.open = open[d.dataset.key]; });
  }

  filterBox.addEventListener("click", e => {
    const b = e.target.closest(".opt");
    if (!b) return;
    const s = state.sel[b.dataset.facet];
    s.has(b.dataset.value) ? s.delete(b.dataset.value) : s.add(b.dataset.value);
    update();
  });

  // ---------- rendering: active filter chips ----------

  function renderActive(count) {
    const chips = facets.flatMap(f => [...state.sel[f.key]].map(v =>
      `<button type="button" class="chip" data-facet="${f.key}" data-value="${esc(v)}" aria-label="Remove filter ${esc(f.title)}: ${esc(v)}">${esc(v)}<span aria-hidden="true">×</span></button>`));
    $("result-count").textContent = `${count} of ${courses.length} courses`;
    $("active").innerHTML = chips.length ? chips.join("") + '<button type="button" class="clear" id="clear">Clear all</button>' : "";
  }
  $("active").addEventListener("click", e => {
    if (e.target.id === "clear") { facets.forEach(f => state.sel[f.key].clear()); update(); return; }
    const b = e.target.closest(".chip");
    if (b) { state.sel[b.dataset.facet].delete(b.dataset.value); update(); }
  });

  // ---------- rendering: course cards ----------

  const arm = '<path d="M12 12V2.6"/><path d="M12 5.4 10.3 3.9M12 5.4l1.7-1.5M12 8.3l-2.1-1.8M12 8.3l2.1-1.8" stroke-width="1"/>';
  const seasonIcons = {
    Winter: `<g fill="none" stroke="url(#g-snow)" stroke-width="1.35" stroke-linecap="round">${[0, 60, 120, 180, 240, 300].map(r => `<g transform="rotate(${r} 12 12)">${arm}</g>`).join("")}</g><path d="M12 9.9l1.8 1.05v2.1L12 14.1l-1.8-1.05v-2.1z" fill="#dfe9f3" stroke="#6f9cc6" stroke-width=".6"/>`,
    Fall: '<path d="M12 1.8l1.7 4.3 2.7-1.5-.6 4.4 4-1.3-1.3 3.5 3.4.9-4.6 3.3.8 2.3-4.9-1-.4 4.5h-1.6l-.4-4.5-4.9 1 .8-2.3-4.6-3.3 3.4-.9-1.3-3.5 4 1.3-.6-4.4 2.7 1.5z" fill="url(#g-leaf)" stroke="#b5451f" stroke-width=".6" stroke-linejoin="round"/><path d="M12 6.5v12M12 13l3.4-2.3M12 13 8.6 10.7M12 16.2l2.4-1.2M12 16.2l-2.4-1.2" fill="none" stroke="#fde3ae" stroke-width=".7" stroke-linecap="round" opacity=".8"/><path d="M12 19.8v3" stroke="#8a3a1c" stroke-width="1.1" stroke-linecap="round"/>',
    Spring: '<path d="M12 13.2v9.3" stroke="url(#g-stem)" stroke-width="1.5" stroke-linecap="round"/><path d="M12 21c-3.6-.4-5.3-3.4-5-5.9 2.6.8 4.4 2.9 5 5.9z" fill="url(#g-stem)"/><path d="M12 2.6c2.3 1.6 3 4.4 2.6 7-.4 2.7-1.4 4.2-2.6 4.6-1.2-.4-2.2-1.9-2.6-4.6-.4-2.6.3-5.4 2.6-7z" fill="url(#g-tulip-back)"/><path d="M6.6 5.2c2.8.4 4.8 2.8 5.2 5.6.3 2.2-.8 3.5-1.6 3.6-2.2-.1-3.6-1.7-3.9-4.1-.2-1.9-.1-3.7.3-5.1z" fill="url(#g-tulip)" stroke="#c23565" stroke-width=".35"/><path d="M17.4 5.2c-2.8.4-4.8 2.8-5.2 5.6-.3 2.2.8 3.5 1.6 3.6 2.2-.1 3.6-1.7 3.9-4.1.2-1.9.1-3.7-.3-5.1z" fill="url(#g-tulip)" stroke="#c23565" stroke-width=".35"/><path d="M8.3 7.4c.9.9 1.4 2 1.6 3.2" stroke="#ffd3e2" stroke-width=".6" stroke-linecap="round" fill="none"/>'
  };
  const icons = {
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'
  };
  function termIcons(term) {
    const s = seasons({ term }).filter(x => x !== UNKNOWN);
    if (!s.length) return `<svg class="cal" viewBox="0 0 24 24" aria-hidden="true">${icons.calendar}</svg>`;
    return `<span class="season-icons">${s.map(x => `<span class="tip" tabindex="0" data-tip="${x}"><svg class="season" viewBox="0 0 24 24" role="img" aria-label="${x}">${seasonIcons[x]}</svg></span>`).join("")}</span>`;
  }
  const row = (label, value) => (value ? `<div><dt>${label}</dt><dd>${value}</dd></div>` : "");

  // Icons carry the specific category; the text beside them names only the kind of category.
  const geBadge = name => `<span class="tip" tabindex="0" data-tip="${esc(name)}"><span class="ge-ic" style="--ge:${GE_STYLE[name][1]}" role="img" aria-label="${esc(name)}">${geIcon(name)}</span></span>`;
  // Summary facts: category label first, then its badges. Unknown values stay blank.
  function facts(c, r) {
    const season = seasons(c).filter(x => x !== UNKNOWN);
    const WI = "Additional Writing Intensive";
    const writing = c.fys || (c.integrations || []).includes(WI);
    const integ = (c.integrations || []).filter(x => x !== WI);
    const p = pilotOf(c);
    const fact = (label, badges) => `<div class="fact"><dt>${label}</dt><dd>${badges}</dd></div>`;
    return `<dl class="facts">
      ${fact(season.length > 1 ? "Terms" : "Term", season.length ? termIcons(c.term) : "")}
      ${fact("Frequency", r.quads ? pie(r) : "")}
      ${c.fys ? fact("First Year Seminar", geBadge(FYS)) : fact("MOI", c.mode ? geBadge(c.mode) : "")}
      ${writing ? fact("Writing Intensive", `<span class="tip" tabindex="0" data-tip="Writing Intensive"><span class="ge-ic" style="--ge:${INTEG_GOLD}" role="img" aria-label="Writing Intensive">${geIcon(WI)}</span></span>`) : ""}
      ${fact(integ.length > 1 ? "Integrations" : "Integration", integ.map(geBadge).join(""))}
      ${c.cbl ? fact("CBL", `<span class="tip" tabindex="0" data-tip="Community-based learning"><span class="ge-ic" style="--ge:${CBL_COLOR}" role="img" aria-label="Community-based learning"><i class="ti ti-heart-handshake" aria-hidden="true"></i></span></span>`) : ""}
      ${p ? fact(p.kind, `<span class="tip" tabindex="0" data-tip="${p.kind}${p.when ? " · " + p.when : ""}"><span class="pilot-ic" role="img" aria-label="${p.kind}"><i class="ti ti-rocket" aria-hidden="true"></i></span></span>${p.when ? `<span class="pilot-when">${p.when}</span>` : ""}`) : ""}
    </dl>`;
  }

  function card(c) {
    const lead = c.commitment === "lead";
    const tag = c.number ? `<span class="num">${esc(c.number)}</span>` : "";
    const r = rhythm(c);
    const syl = c.syllabus ? `<a class="syl" href="${esc(c.syllabus)}" target="_blank" rel="noopener" title="Opens in Box; sign in with your W&amp;L account"><svg viewBox="0 0 24 24" aria-hidden="true">${icons.doc}</svg>Syllabus</a>` : "";
    return `
      <details class="course${lead ? " lead" : ""}" id="${esc(c.id)}">
        <summary>
          ${tag ? `<p class="tag">${tag}</p>` : ""}
          <h3>${esc(c.title)}</h3>
          <p class="who">${esc(c.faculty)}</p>
          ${facts(c, r)}
          <span class="toggle" aria-hidden="true"></span>
        </summary>
        <div class="detail">
          <p class="description">${esc(c.description)}</p>
          <dl>
            ${row("Number note", c.numberNote && esc(c.numberNote))}
            ${row("Former number", c.formerNumber && esc(c.formerNumber))}
            ${row("Frequency", c.frequency && esc(c.frequency))}
            ${row("Credits", c.credits && String(c.credits))}
            ${row("Capacity", c.capacity && esc(c.capacity))}
            ${c.fys ? row("Gen Ed", "First Year Seminar") : row("MOI", c.mode && esc(c.mode))}
            ${row("Integrations", c.integrations && c.integrations.length && esc(c.integrations.join(", ")))}
            ${row("Earlier title", c.previousTitle && esc(c.previousTitle))}
          </dl>
          ${syl ? `<p class="syl-row">${syl}</p>` : ""}
        </div>
      </details>`;
  }

  // ---------- rendering: coverage grid ----------

  function grid(list, groups) {
    const cell = (v, cls = "") => `<td class="${cls}">${v || '<span class="nil">—</span>'}</td>`;
    const rowOf = c => `
      <tr class="${c.commitment === "lead" ? "lead" : ""}">
        <th scope="row"><a href="#${esc(c.id)}" data-open="${esc(c.id)}">${esc(c.title)}</a><span class="gi">${esc(c.faculty)}</span>${c.number ? `<span class="gi gnum">${esc(c.number)}</span>` : ""}</th>
        ${cell(c.department ? esc(c.department) : "")}
        ${cell(c.program ? esc(c.program) : "")}
        ${cell(seasons(c).filter(s => s !== UNKNOWN).join(", "))}
        ${cell(rhythm(c).quads ? pie(rhythm(c)) + `<span class="gi">${esc(rhythm(c).key)}</span>` : "")}
        ${cell(pilotOf(c) ? `<span class="gm" style="color:var(--red)"><i class="ti ti-rocket" aria-hidden="true"></i></span>${pilotOf(c).kind} ${pilotOf(c).when}` : "")}
        ${cell(c.fys || c.mode ? `<span class="gm" style="color:${GE_STYLE[moiOf(c)[0]][1]}">${geIcon(moiOf(c)[0])}</span>` + esc(moiOf(c)[0]) : "")}
        ${cell((c.integrations || []).map(x => `<span class="gm" style="color:${INTEG_GOLD}">${geIcon(x)}</span>${esc(x)}`).join("<br>"))}
        ${cell(c.cbl ? `<span class="gm" style="color:${CBL_COLOR}"><i class="ti ti-heart-handshake" aria-hidden="true"></i></span>Yes` : "")}
        ${cell(c.syllabus ? `<a href="${esc(c.syllabus)}" target="_blank" rel="noopener">View</a>` : "")}
      </tr>`;
    const ncols = 10;
    const body = groups ? groups.map(([name, cs]) => `<tr class="group-row"><th colspan="${ncols}">${esc(name)}</th></tr>` + cs.map(rowOf).join("")).join("") : list.map(rowOf).join("");
    return `<div class="table-wrap"><table class="grid">
      <thead><tr><th scope="col">Course</th><th scope="col">Department</th><th scope="col">Program</th><th scope="col">Term</th><th scope="col">How often</th><th scope="col">Pilot</th><th scope="col">FYS or MOI</th><th scope="col">Integrations</th><th scope="col">CBL</th><th scope="col">Syllabus</th></tr></thead>
      <tbody>${body}</tbody></table></div>`;
  }

  $("course-list").addEventListener("click", e => {
    const a = e.target.closest("a[data-open]");
    if (!a) return;
    e.preventDefault();
    setView("cards");
    const d = document.getElementById(a.dataset.open);
    if (d) { d.open = true; d.scrollIntoView({ block: "start" }); }
  });

  // ---------- CSV export of the current selection ----------

  let current = courses;
  $("download").addEventListener("click", () => {
    const cols = [["Title", c => c.title], ["Instructor", c => c.faculty], ["Department", c => c.department || ""], ["Interdisciplinary program", c => c.program || ""], ["Number", c => c.number || ""], ["Former number", c => c.formerNumber || ""],
      ["Level", c => (levelDigit(c) ? levelDigit(c) * 1000 : "")], ["Term", c => seasons(c).filter(x => x !== UNKNOWN).join(", ")], ["Frequency", c => c.frequency || ""], ["Pilot", c => (pilotOf(c) ? `${pilotOf(c).kind} ${pilotOf(c).when}`.trim() : "")], ["First Year Seminar", c => (c.fys ? "Yes" : "")], ["MOI", c => c.mode || ""],
      ["Integrations", c => (c.integrations || []).join("; ")], ["CBL", c => (c.cbl ? "Yes" : "")],
      ["Brought by", c => (c.commitment === "lead" ? "Suggested" : "Instructor")],
      ["Syllabus", c => c.syllabus || ""]];
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols.map(c => q(c[0])).join(","), ...current.map(c => cols.map(([, f]) => q(f(c))).join(","))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = "medical-humanities-courses.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ---------- view toggle ----------

  function setView(v) {
    state.view = v;
    try { localStorage.setItem("mh-view", v); } catch (e) {}
    document.querySelectorAll(".view-btn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
    renderList();
  }
  document.querySelectorAll(".view-btn").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

  // ---------- update ----------

  function renderList() {
    const list = $("course-list");
    list.className = state.view === "grid" ? "course-grid" : "course-list";
    // Courses are always grouped by department (first-listed, if cross-listed), then by course number
    let groups = null;
    {
      const NOT = "Department not recorded";
      const by = new Map();
      for (const c of current) {
        const d = c.department ? c.department.split(" / ")[0].trim() : NOT;
        if (!by.has(d)) by.set(d, []);
        by.get(d).push(c);
      }
      groups = [...by.entries()].sort((a, b) => (a[0] === NOT) - (b[0] === NOT) || a[0].localeCompare(b[0]));
    }
    if (state.view === "grid") list.innerHTML = current.length ? grid(current, groups) : "";
    else list.innerHTML = groups ? groups.map(([name, cs]) => `<h3 class="group-head">${esc(name)}<span>${cs.length}</span></h3>` + cs.map(card).join("")).join("") : current.map(card).join("");
    $("empty").hidden = current.length > 0;
    $("empty").textContent = current.length ? "" : "No courses match these filters.";
  }

  function update() {
    current = courses.filter(c => matchesSearch(c) && matchesFacets(c));
    preserveOpen(renderFilters);
    renderActive(current.length);
    renderList();
  }

  $("search").addEventListener("input", e => { state.q = e.target.value.trim().toLowerCase(); update(); });

  const confirmed = courses.filter(c => c.commitment === "confirmed").length;
  $("stats").innerHTML = `
    <div><dt>Courses</dt><dd>${courses.length}</dd></div>
    <div><dt>Requested by instructors</dt><dd>${confirmed}</dd></div>
    <div><dt>Suggested</dt><dd>${courses.length - confirmed}</dd></div>`;

  if (window.matchMedia("(max-width: 960px)").matches) $("filters-wrap").open = false;

  // Links from the plan pages: ?select=facet:value|value (or facet:* for every known value)
  // preselects filters; ?facet=key opens that filter group and brings it into view.
  const params = new URLSearchParams(location.search);
  const sel = params.get("select");
  if (sel) {
    const [key, vals] = sel.split(":");
    const f = facets.find(x => x.key === key);
    if (f) (vals === "*" ? f.options().filter(o => o !== NONE && o !== UNKNOWN && !/^Not /.test(o)) : vals.split("|")).forEach(v => state.sel[key].add(v));
  }

  setView(state.view);
  update();

  const focusFacet = params.get("facet") || (sel && sel.split(":")[0]);
  if (focusFacet) {
    const d = filterBox.querySelector(`.facet[data-key="${focusFacet}"]`);
    if (d) {
      d.open = true;
      $("filters-wrap").open = true;
      d.classList.add("flash");
      setTimeout(() => {
        document.documentElement.style.scrollBehavior = "auto";
        $("courses").scrollIntoView();
        const panel = document.querySelector(".filter-panel");
        if (panel.scrollHeight > panel.clientHeight) panel.scrollTop += d.getBoundingClientRect().top - panel.getBoundingClientRect().top - 20;
        else d.scrollIntoView({ block: "center" });
        document.documentElement.style.scrollBehavior = "";
      }, 60);
    }
  }

  // Cohort links: show a card only when its address is filled in (links.js)
  (function cohortLinks() {
    const L = window.LINKS || {};
    const pairs = [["link-meetings", L.meetingNotes]];
    let any = false;
    for (const [id, url] of pairs) {
      const a = $(id);
      if (a && url) { a.href = url; a.hidden = false; any = true; }
    }
    if (any) { $("cohort").hidden = false; $("nav-cohort").hidden = false; }
  })();

  // "Today" line on the proposal calendar (September through May of the current academic year)
  (function placeToday() {
    const g = $("gantt"), line = $("g-today");
    if (!g || !line) return;
    const start = new Date(FIRST_YEAR, 8, 1), end = new Date(FIRST_YEAR + 1, 5, 1);
    const now = new Date();
    if (now < start || now >= end) return;
    const monthIdx = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - 8;
    const frac = (monthIdx + (now.getDate() - 1) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) / 9;
    const place = () => {
      const first = g.querySelector(".g-month");
      const left = first.offsetLeft, width = g.offsetWidth - left;
      line.style.left = `${left + frac * width}px`;
    };
    line.hidden = false; place(); window.addEventListener("resize", place);
  })();

  if (location.hash) {
    const t = document.getElementById(location.hash.slice(1));
    if (t && t.tagName === "DETAILS") { t.open = true; t.scrollIntoView(); }
  }
})();
