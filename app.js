// 잠실야구장 디지털 유산 — 화면 렌더링
// 데이터는 모두 data/*.json에서 읽는다. 이 파일에는 기록 내용을 넣지 않는다.

const DATA_FILES = ["meta", "venues", "events", "people", "numbers", "places", "artifacts", "quests", "ladder", "sources"];
// 경기장 단위 — 기록 파일에는 여러 경기장이 섞일 수 있고, 이 화면은 meta.venue 한 곳만 보여 준다
const VENUE_FILES = ["events", "numbers", "places", "artifacts", "quests", "ladder"];

// 검증 링크 — data/sources.json (id → 매체·날짜·제목·url). main()에서 채운다
const SRC = new Map();
function refLinks(refs) {
  const list = (refs || []).map((id) => SRC.get(id)).filter(Boolean);
  if (!list.length) return "";
  return `<span class="refs">${list.map((r) =>
    `<a class="ref" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" title="${esc(r.title)}${r.date ? ` · ${esc(r.date)}` : ""}">${esc(r.publisher)}<span aria-hidden="true">↗</span></a>`).join("")}</span>`;
}

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function pendingBadge(r) {
  if (r.verified !== false) return "";
  return `<span class="badge pending" title="${esc(r.note || "추가 확인 필요")}">⚠️ 검증 중</span>`;
}

function noteLine(r) {
  return r.verified === false && r.note ? `<p class="note">${esc(r.note)}</p>` : "";
}

// "1982-07-15" → "07.15", 기간이면 "09.04–09.14"
function formatDate(r) {
  const md = (d) => {
    const [, m, day] = d.split("-");
    if (!m) return "";
    return day ? `${m}.${day}` : `${Number(m)}월`;
  };
  const start = md(r.date);
  if (!r.date_end) return start;
  if (r.date_end.length === 4) return `${r.date}–${r.date_end}`;
  return `${start}–${md(r.date_end)}`;
}

function personChips(r, index) {
  const people = (r.linked || []).map((id) => index.get(id)).filter((e) => e && e.type === "Person");
  if (!people.length) return "";
  return `<div class="chips">${people.map((p) => `<span class="chip person">${esc(p.title)}</span>`).join("")}</div>`;
}

// ---------- 날짜: 오늘(한국 시간)과 사건 날짜 비교 ----------
// 사건 날짜는 "2026-11-14" | "2026-12" | "2027" 세 가지 정밀도.
// 하루짜리 날짜는 그날이 지나야 '지난 일', 월·연 단위는 그 기간에 들어서면 '시작된 일'로 본다
const todayKST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const startOf = (d) => (d.length === 4 ? `${d}-01-01` : d.length === 7 ? `${d}-01` : d);
const isPast = (d, today) => (d.length === 10 ? d < today : startOf(d) <= today);
const dotted = (d) => d.replaceAll("-", ".");
function untilLabel(d, today) {
  if (d.length === 4) return `${d}년`;
  if (d.length === 7) return `${d.slice(0, 4)}년 ${Number(d.slice(5))}월`;
  const days = Math.round((Date.parse(d) - Date.parse(today)) / 86_400_000);
  return days === 0 ? "오늘" : `D-${days}`;
}

function renderHero(meta, index) {
  $("#hero-eyebrow").textContent = `디지털 유산 아카이브 · ${dotted(meta.updated || meta.research_update || "")} 업데이트`;
  // "잠실야구장 1982–2026" → 마지막 어절(연도)을 줄바꿈 단위로 분리
  const words = meta.title.split(" ");
  const tail = words.length > 1 ? words.pop() : "";
  $("#hero-title").innerHTML = `${esc(words.join(" "))}${tail ? ` <span class="years">${esc(tail)}</span>` : ""}`;
  $("#hero-sub").textContent = meta.subtitle;
  $("#hero-numbers").innerHTML = meta.hero_numbers
    .map((id) => index.get(id))
    .filter((n) => n && n.hero)
    .map((n) => `<li><span class="vu"><span class="v">${esc(n.hero.value)}</span><span class="u">${esc(n.hero.unit)}</span></span><span class="l">${esc(n.hero.label)}</span></li>`)
    .join("");
}

// ---------- 지금 잠실: 오늘 날짜로 '지금 상태'와 '다음 일정'을 고른다 (손대지 않아도 시간이 지나면 바뀐다) ----------
function renderNow(meta, index) {
  const steps = (meta.now || []).map((n) => ({ ...n, ev: index.get(n.event) })).filter((n) => n.ev?.date);
  if (!steps.length) return;
  const today = todayKST();
  const pastIdx = steps.reduce((last, s, i) => (isPast(s.ev.date, today) ? i : last), -1);
  const current = steps[pastIdx];
  const next = steps[pastIdx + 1];

  $("#now-date").textContent = `${dotted(today)} 기준`;
  $("#now-state").textContent = current ? current.state : "잠실야구장은 아직 경기를 치르고 있습니다.";
  $("#now-next").innerHTML = next
    ? `다음 — <a href="#${esc(next.ev.id)}">${esc(next.ev.title)}</a> <b>${esc(untilLabel(next.ev.date, today))}</b>`
    : "";
  $("#now-rail").innerHTML = steps.map((s, i) => {
    const cls = i < pastIdx ? "done" : i === pastIdx ? "current" : i === pastIdx + 1 ? "next" : "";
    const label = s.ev.date.length === 10 ? dotted(s.ev.date.slice(5)) : s.ev.date.length === 7 ? `${Number(s.ev.date.slice(5))}월` : s.ev.date;
    const year = s.ev.date.slice(0, 4);
    return `<li class="${cls}"><a href="#${esc(s.ev.id)}"><span class="when">${esc(year === "2026" ? label : year)}</span><span class="what">${esc(s.ev.title.split(" — ")[0])}</span></a></li>`;
  }).join("");
  $("#now").hidden = false;
}

function renderTimeline(events, index) {
  const today = todayKST();
  const byYear = new Map();
  events
    .filter((e) => e.type === "Event")
    // 연도만 기준으로 정렬하고, 같은 해 안에서는 원자료(JSON) 순서를 그대로 둔다
    .sort((a, b) => a.date.slice(0, 4).localeCompare(b.date.slice(0, 4)))
    .forEach((e) => {
      const y = e.date.slice(0, 4);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(e);
    });

  $("#timeline-list").innerHTML = [...byYear]
    .map(([year, items]) => `
      <li class="tl-year">
        <h3>${esc(year)}</h3>
        ${items.map((e) => {
          const cls = ["tl-item"];
          if (e.tags?.includes("dark-history")) cls.push("dark-history");
          // 예정 사건은 날짜가 지나면 '결과 정리 중'으로 바뀐다 (데이터에서 status를 지울 때까지)
          const planned = e.status === "planned";
          const overdue = planned && e.date.length === 10 && isPast(e.date, today);
          if (planned && !overdue) cls.push("is-planned");
          if (e.tags?.includes("last") && e.date === "2026-10-20") cls.push("is-last");
          if (e.tags?.includes("farewell")) cls.push("is-farewell");
          const date = formatDate(e);
          const plannedBadge = !planned ? ""
            : overdue ? `<span class="badge pending">결과 정리 중</span>`
            : `<span class="badge planned">예정${e.date.length === 10 ? ` · ${esc(untilLabel(e.date, today))}` : ""}</span>`;
          return `
          <article class="${cls.join(" ")}" id="${esc(e.id)}">
            ${date ? `<p class="tl-date">${esc(date)}</p>` : ""}
            <p class="tl-title">${esc(e.title)}${plannedBadge}${pendingBadge(e)}</p>
            <p class="tl-summary">${esc(e.summary)}${refLinks(e.refs)}</p>
            ${noteLine(e)}
            ${personChips(e, index)}
          </article>`;
        }).join("")}
      </li>`)
    .join("");
}

// 데이터 문장의 **숫자** 표기를 굵게 바꾼다 (이스케이프 후 적용)
const emphasize = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

function storyItem(s) {
  const badge = s.verified === false ? ` <span class="badge pending" title="${esc(s.note || "추가 확인 필요")}">⚠️ 검증 중</span>` : "";
  return `<li>${emphasize(s.text)}${badge}${refLinks(s.refs)}</li>`;
}

// ---------- 당신이 생각하는 숫자 이야기 (팬 제보) ----------
// config.js에 Supabase 값이 있으면 서버로 접수(검토 후 공개), 없으면 1단계처럼 이 기기에만 저장한다.
// 레코드 모양은 두 경우 모두 FanStory 스키마(supabase/schema.sql의 fan_stories)와 같다.
const CFG = window.JAMSIL_CONFIG || {};
const REMOTE = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey);
// 제보 창 스위치 — false면 제보 버튼을 모두 숨기고 승인된 이야기만 보여 준다
const SUBMIT_OPEN = CFG.submissions !== false;
const FAN_KEY = "jamsil-fan-stories";
const COOLDOWN_KEY = "jamsil-fan-last";
const COOLDOWN_MS = 30_000;

// 내가 남긴 이야기 — 이 기기 기록 (서버 접수분도 '검토 대기'로 함께 남긴다)
const fanStories = {
  all() {
    try { return JSON.parse(localStorage.getItem(FAN_KEY) || "[]"); } catch (e) { return []; }
  },
  add(rec) {
    const list = this.all();
    list.push(rec);
    try { localStorage.setItem(FAN_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  },
  byTarget(target) { return this.all().filter((r) => r.target === target); },
  remove(id) {
    const rest = this.all().filter((r) => r.id !== id);
    try { localStorage.setItem(FAN_KEY, JSON.stringify(rest)); return true; } catch (e) { return false; }
  },
};

// Supabase REST — 라이브러리 없이 fetch만 쓴다
const supa = {
  headers(extra = {}) {
    return { apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${CFG.supabaseAnonKey}`, ...extra };
  },
  async approved() {
    const url = `${CFG.supabaseUrl}/rest/v1/fan_stories_public?select=id,created_at,target,number,text,nickname,verified&order=created_at.asc`;
    const r = await fetch(url, { headers: this.headers() });
    if (!r.ok) throw new Error(`승인 목록 ${r.status}`);
    return r.json();
  },
  async uploadPhoto(file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `pending/${crypto.randomUUID()}.${ext}`;
    const r = await fetch(`${CFG.supabaseUrl}/storage/v1/object/evidence/${path}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }),
      body: file,
    });
    if (!r.ok) throw new Error(`사진 업로드 ${r.status}`);
    return path;
  },
  async submit(row) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/fan_stories`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error(`접수 ${r.status}`);
  },
};

// target: 이야기가 붙는 자리(계단 칸 id, "gap", "free"), number: 화면에 미리 채울 숫자
const storyButton = (target, number, label = "나의 숫자 이야기") => !SUBMIT_OPEN ? "" :
  `<button class="story-btn" type="button" data-story-target="${esc(target)}" data-story-number="${esc(number)}">✍ ${esc(label)}</button>`;

// 칸 아래 두 목록: 승인된 팬 이야기(모두에게 보임) + 내가 남긴 이야기(이 기기에만)
function mineList(target) {
  return `<ul class="fan-public" data-public="${esc(target)}"></ul>
    <ul class="mine" data-mine="${esc(target)}">${fanStories.byTarget(target).map(mineItem).join("")}</ul>`;
}
function mineItem(r) {
  const state = r.status === "pending" ? "검토 대기" : "이 기기에만 저장";
  return `<li data-mine-id="${esc(r.id)}"><span class="mine-tag">내 이야기 · ${esc(r.number)} · ${state}<button type="button" class="mine-del" data-mine-del="${esc(r.id)}" aria-label="내 이야기 지우기">지우기</button></span>${esc(r.text)}${r.nickname ? ` <span class="mine-by">— ${esc(r.nickname)}</span>` : ""}</li>`;
}
function publicItem(r) {
  const badge = r.verified ? "" : ` <span class="badge pending" title="팬 제보 — 사실 확인 전">⚠️ 검증 중</span>`;
  return `<li><span class="fan-tag">팬 이야기 · ${esc(r.number)}</span>${esc(r.text)}${r.nickname ? ` <span class="mine-by">— ${esc(r.nickname)}</span>` : ""}${badge}</li>`;
}

async function loadApprovedStories() {
  if (!REMOTE) return;
  try {
    const rows = await supa.approved();
    for (const r of rows) {
      const list = document.querySelector(`[data-public="${CSS.escape(r.target)}"]`);
      if (list) list.insertAdjacentHTML("beforeend", publicItem(r));
    }
  } catch (err) {
    console.warn("팬 이야기 불러오기 실패:", err.message);
  }
}

function setupStoryDialog() {
  const dlg = $("#story-dialog");
  const form = $("#story-form");
  $("#story-mode-note").textContent = REMOTE
    ? "보내 주신 이야기는 운영자 검토 후 이 숫자 칸에 공개됩니다. 사진은 확인용으로만 쓰고 공개하지 않습니다."
    : "지금은 이 기기 브라우저에만 저장됩니다. 공식 접수는 준비 중입니다.";
  $("#story-photo-field").hidden = !REMOTE;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-story-target]");
    if (!btn) return;
    form.reset();
    form.elements.target.value = btn.dataset.storyTarget;
    form.elements.number.value = btn.dataset.storyNumber || "";
    $("#story-dialog-title").textContent = btn.dataset.storyNumber ? `${btn.dataset.storyNumber} — 당신이 생각하는 숫자 이야기` : "당신이 생각하는 숫자 이야기";
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    (btn.dataset.storyNumber ? form.elements.text : form.elements.number).focus();
  });
  $("#story-cancel").addEventListener("click", () => dlg.close());

  // 내 이야기 지우기 — 브라우저 확인창 없이 두 번 눌러 지운다 (첫 번째: '한 번 더 누르면 지워요')
  document.addEventListener("click", (e) => {
    const del = e.target.closest("[data-mine-del]");
    if (!del) return;
    if (!del.classList.contains("armed")) {
      del.classList.add("armed");
      del.textContent = "한 번 더 누르면 지워요";
      setTimeout(() => { if (del.isConnected) { del.classList.remove("armed"); del.textContent = "지우기"; } }, 4000);
      return;
    }
    const id = del.dataset.mineDel;
    const rec = fanStories.all().find((r) => r.id === id);
    if (!fanStories.remove(id)) { toast("이 브라우저에서는 지울 수 없습니다."); return; }
    del.closest("li")?.remove();
    // 서버로 접수된 글은 이 기기 사본만 지워진다. 서버 쪽은 운영자가 지운다
    toast(rec?.status === "pending"
      ? "이 기기에서 지웠습니다. 이미 접수된 글의 삭제는 운영자에게 요청해 주세요."
      : "지웠습니다.");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = form.elements;
    const row = {
      target: f.target.value,
      number: f.number.value.trim(),
      text: f.text.value.trim(),
      nickname: f.nickname.value.trim() || null,
      evidence: f.evidence.value,
      age14: f.age14.checked,
      consent: f.consent.checked,
    };
    if (!row.number || row.text.length < 5) { toast("숫자와 이야기(5자 이상)를 적어 주세요."); return; }

    // 스팸 방지: 사람에게 안 보이는 칸이 채워졌으면 조용히 무시, 같은 기기 30초 안 연속 제보 제한
    if (f.website.value) { dlg.close(); toast("고맙습니다."); return; }
    let last = 0;
    try { last = Number(localStorage.getItem(COOLDOWN_KEY) || 0); } catch (err) {}
    if (Date.now() - last < COOLDOWN_MS) { toast("잠시 후 다시 남겨 주세요."); return; }

    const submitBtn = form.querySelector("[type=submit]");
    submitBtn.disabled = true;
    let status = "local";
    try {
      if (REMOTE) {
        const file = f.photo.files[0];
        if (file && file.size > 5 * 1024 * 1024) throw new Error("사진은 5MB 이하만 올릴 수 있습니다");
        if (file) row.photo_path = await supa.uploadPhoto(file);
        await supa.submit(row);
        status = "pending";
      }
    } catch (err) {
      submitBtn.disabled = false;
      const reason = err instanceof TypeError ? "인터넷 연결을 확인해 주세요" : err.message;
      toast(`보내지 못했습니다 — ${reason}. 쓴 내용은 그대로 있으니 잠시 후 다시 눌러 주세요.`);
      return;
    }
    submitBtn.disabled = false;

    const rec = {
      id: `FS-${Date.now()}`, type: "FanStory", ...row, photo_path: undefined,
      source: REMOTE ? "팬 제보 (서버 접수)" : "팬 제보 (이 기기 저장)",
      status, verified: false, contributor: "fan", created_at: new Date().toISOString(),
    };
    const saved = fanStories.add(rec);
    try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (err) {}
    dlg.close();
    const list = document.querySelector(`[data-mine="${CSS.escape(rec.target)}"]`);
    if (saved && list) list.insertAdjacentHTML("beforeend", mineItem(rec));
    toast(REMOTE ? "접수됐습니다. 검토 후 이 칸에 공개됩니다." : (saved ? "이 기기에 저장했습니다." : "이 브라우저에서는 저장할 수 없습니다."));
  });
}

// 이야기 패널 한 장. 숫자판에서 고른 칸만 보이고 나머지는 hidden (팬 이야기 목록·주소 #id가 그대로 살아 있도록 모두 그려 둔다)
function stepCard(s, chapter, prev, next) {
  const cls = ["step", `ch-${s.chapter}`];
  if (s.retired) cls.push("is-retired");
  const teamTag = s.team ? `<span class="team-tag${s.retired ? " retired" : ""}">${s.retired ? "영구결번 · " : ""}${esc(s.team)}</span>` : "";
  const nav = (x, dir) => x
    ? `<button type="button" class="step-go ${dir}" data-step="${esc(x.id)}" aria-label="${dir === "prev" ? "이전" : "다음"} 숫자 ${esc(x.title)}">${dir === "prev" ? `← ${esc(x.title)}` : `${esc(x.title)} →`}</button>`
    : `<span></span>`;
  return `
    <article class="${cls.join(" ")}" id="${esc(s.id)}" data-layer="${layerOf(s.chapter)}" role="region" aria-label="숫자 ${esc(s.title)}" hidden>
      <div class="step-head">
        ${chapter ? `<p class="kicker">${esc(chapter.kicker)}${chapter.title ? ` · ${esc(chapter.title)}` : ""}</p>` : ""}
        <p class="step-num${s.title.length > 8 ? " long" : ""}">${esc(s.title)}</p>
        ${teamTag}
      </div>
      <div class="step-body">
        <ul class="stories">${s.stories.map(storyItem).join("")}</ul>
        ${s.bridge ? `<p class="bridge">→ ${esc(s.bridge)}</p>` : ""}
        ${mineList(s.id)}
        ${storyButton(s.id, s.title)}
      </div>
      <nav class="step-nav" aria-label="숫자 이동">${nav(prev, "prev")}<a class="step-up" href="#numbers">숫자판 ↑</a>${nav(next, "next")}</nav>
    </article>`;
}

// 숫자판의 층: 숫자 계단(장별 줄) · 등번호 · 날짜
const LAYERS = [
  { id: "main", label: "숫자 계단", lede: "작은 수부터 큰 수까지. 자릿수가 늘수록 이야기의 단위도 커집니다.", has: (c) => c.id !== "jersey" && c.id !== "dates" },
  { id: "jersey", label: "등번호", has: (c) => c.id === "jersey" },
  { id: "dates", label: "날짜", has: (c) => c.id === "dates" },
];
const layerOf = (chapterId) => LAYERS.find((l) => l.has({ id: chapterId }))?.id || "main";

// 장(chapter) 안 정렬: value 오름차순, 같은 값이면 데이터 순서 유지. 등번호 장은 영구결번을 앞에 둔다
function chapterSteps(steps, id) {
  return steps.filter((s) => s.chapter === id).sort((a, b) =>
    id === "jersey" ? (b.retired - a.retired) || (a.value - b.value) : a.value - b.value);
}
// 화면에 보이는 순서 그대로의 계단 칸 목록 (사람 섹션의 '등장 순서' 기준)
const ladderOrder = (steps, chapters) => chapters.flatMap((c) => chapterSteps(steps, c.id));

function renderLadder(steps, config) {
  const chapters = config.chapters || [];
  const of = (id) => steps.filter((s) => s.chapter === id);
  const sorted = (id) => chapterSteps(steps, id);

  // 위: 숫자판(층 탭 + 장별 숫자 줄) / 아래: 고른 숫자의 이야기 패널
  const chip = (s) => {
    const cls = ["nb-chip"];
    if (s.retired) cls.push("is-retired");
    if (s.verified === false) cls.push("is-pending");
    if (s.title.length > 5) cls.push("wide");
    return `<li><button type="button" class="${cls.join(" ")}" data-step="${esc(s.id)}" aria-controls="${esc(s.id)}" aria-pressed="false"
      title="${esc(s.stories[0]?.text.replace(/\*\*/g, "") || "")}">${esc(s.title)}</button></li>`;
  };
  const layers = LAYERS.map((l) => {
    const cs = chapters.filter(l.has).map((c) => ({ c, items: sorted(c.id) })).filter((x) => x.items.length);
    return { ...l, cs, steps: cs.flatMap((x) => x.items) };
  }).filter((l) => l.steps.length);

  const tabs = `<div class="nb-tabs" role="tablist" aria-label="숫자판 종류">${layers.map((l) => `
    <button type="button" role="tab" class="nb-tab" data-layer="${l.id}" aria-selected="false">${esc(l.label)} <span>${l.steps.length}</span></button>`).join("")}</div>`;
  const boards = layers.map((l) => `
    <div class="nb-board" data-board="${l.id}" hidden>
      ${l.lede ? `<p class="nb-lede">${esc(l.lede)}</p>` : l.cs[0]?.c.lede ? `<p class="nb-lede">${esc(l.cs[0].c.lede)}</p>` : ""}
      ${l.cs.map(({ c, items }) => `
        <div class="nb-row">
          ${l.cs.length > 1 ? `<p class="nb-label">${esc(c.kicker)}</p>` : ""}
          <ul class="nb-chips">${items.map(chip).join("")}</ul>
        </div>`).join("")}
    </div>`).join("");
  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const panels = layers.flatMap((l) => l.steps.map((s, i) =>
    stepCard(s, chapterById.get(s.chapter), l.steps[i - 1], l.steps[i + 1]))).join("");

  $("#ladder").innerHTML = `
    <div class="numboard">${tabs}${boards}</div>
    <div class="nb-stage" id="ladder-stage" aria-live="polite">${panels}</div>`;
  selectStep(layers[0]?.steps[0]?.id);

  // 빈 번호: gap_range 안의 정수 중 어떤 칸의 covers에도 없는 수 — 데이터가 늘면 자동으로 줄어든다
  const covered = new Set(steps.flatMap((s) => s.covers || []));
  const [lo, hi] = config.gap_range || [1, 50];
  const gaps = [];
  for (let n = lo; n <= hi; n++) if (!covered.has(n)) gaps.push(n);

  const count = (id) => of(id).length;
  const mainSteps = steps.filter((s) => s.chapter !== "dates" && s.chapter !== "jersey");
  const pending = steps.filter((s) => s.verified === false).length;
  const retired = steps.filter((s) => s.retired).length;
  $("#ladder-stats").textContent =
    `계단 ${mainSteps.length}칸 · 등번호 ${count("jersey")}칸(영구결번 ${retired}) · 날짜 ${count("dates")}칸 · 검증 중 ${pending}칸 · ${lo}~${hi} 중 빈 번호 ${gaps.length}개`;
  $("#ladder-cta").innerHTML = storyButton("free", "", "어떤 숫자든, 당신의 숫자 이야기 남기기");

  $("#ladder-gaps").innerHTML = !gaps.length ? `
    <h3>빈 번호 없음</h3>
    <p class="chapter-lede">${lo}부터 ${hi}까지, 모든 숫자에 잠실의 이야기가 하나 이상 생겼습니다.${SUBMIT_OPEN ? " 어떤 숫자든 당신의 이야기를 더해 주세요." : ""}</p>
    ${mineList("gap")}${mineList("free")}
    ${storyButton("free", "", "당신의 숫자 이야기 남기기")}` : `
    <h3>빈 번호</h3>
    <p class="chapter-lede">${lo}부터 ${hi}까지, 아직 이야기를 찾지 못한 숫자입니다.${SUBMIT_OPEN ? " 숫자를 눌러 당신의 이야기를 남겨 주세요." : " 팬 이야기 접수는 곧 열립니다."}</p>
    <ul class="gap-chips">${gaps.map((n) => SUBMIT_OPEN
      ? `<li><button type="button" data-story-target="gap" data-story-number="${n}" aria-label="${n}번 이야기 남기기">${n}</button></li>`
      : `<li><span>${n}</span></li>`).join("")}</ul>
    ${mineList("gap")}
    ${SUBMIT_OPEN ? `<h3 class="free-head">목록에 없는 숫자</h3>` : ""}
    ${mineList("free")}
    ${storyButton("free", "", "다른 숫자로 이야기 남기기")}`;
}

// 숫자판 층 바꾸기 — 탭만 바꾸고 이야기 패널은 그대로 둔다
function showLayer(layer) {
  document.querySelectorAll(".nb-tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.layer === layer)));
  document.querySelectorAll(".nb-board").forEach((b) => { b.hidden = b.dataset.board !== layer; });
}

// 숫자 하나 고르기: 그 칸의 패널만 보이고, 숫자판도 그 칸의 층으로 맞춘다
function selectStep(id, { scroll = false, updateHash = false } = {}) {
  const panel = id && document.getElementById(id);
  if (!panel || !panel.matches(".nb-stage > .step")) return false;
  document.querySelectorAll(".nb-stage > .step").forEach((p) => { p.hidden = p !== panel; });
  document.querySelectorAll(".nb-chip").forEach((c) => {
    const on = c.dataset.step === id;
    c.setAttribute("aria-pressed", String(on));
    c.classList.toggle("is-on", on);
  });
  showLayer(panel.dataset.layer);
  if (updateHash) history.replaceState(null, "", `#${id}`);
  if (scroll) {
    const top = panel.getBoundingClientRect().top;
    // 패널이 화면 위쪽에 이미 보이면 움직이지 않는다 (휴대폰에서 숫자판 아래로 내려 줄 때만)
    if (top < 0 || top > window.innerHeight * 0.6) panel.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  return true;
}

function setupNumboard() {
  document.addEventListener("click", (e) => {
    const tab = e.target.closest(".nb-tab");
    if (tab) { showLayer(tab.dataset.layer); return; }
    const go = e.target.closest("[data-step]");
    if (go) { selectStep(go.dataset.step, { scroll: true, updateHash: true }); return; }
    // 사람 섹션 '등장하는 숫자' 등 #LD-… 링크
    const a = e.target.closest('a[href^="#LD-"]');
    if (a && selectStep(decodeURIComponent(a.getAttribute("href").slice(1)), { updateHash: true })) {
      e.preventDefault();
      document.getElementById("numbers").scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
  window.addEventListener("hashchange", () => selectStep(decodeURIComponent(location.hash.slice(1)), { scroll: true }));
}

// ---------- 사람: 숫자 계단에 이름이 나온 사람을 등장 순서대로 ----------
// 연결 기준은 이름 그 자체다. 계단 문장에 people.json의 이름이 들어 있으면 그 칸과 이어진다.
function renderPeople(people, steps, config) {
  const ordered = ladderOrder(steps, config.chapters || []);
  // 연결 문장(bridge)은 다음 칸 예고라 빼고, 그 칸의 이야기 문장만 본다
  const plain = (s) => s.stories.map((x) => x.text).join(" ").replace(/\*\*/g, "");
  const texts = ordered.map(plain);

  const withSteps = people.map((p) => {
    const hits = ordered.filter((s, i) => texts[i].includes(p.title));
    const first = ordered.indexOf(hits[0]);
    return { p, hits, first };
  });
  const mentioned = withSteps.filter((x) => x.hits.length).sort((a, b) => a.first - b.first);
  const others = withSteps.filter((x) => !x.hits.length);

  const card = ({ p, hits }) => {
    const tag = p.retired_number
      ? `<span class="team-tag retired">영구결번 · ${esc(p.team || "")}</span>`
      : p.team ? `<span class="team-tag">${esc(p.team)}</span>` : "";
    return `
      <article class="person-card${p.retired_number ? " is-retired" : ""}" id="${esc(p.id)}">
        <div class="p-head">
          ${p.back_number != null ? `<span class="p-no" aria-label="등번호">${esc(p.back_number)}</span>` : ""}
          <div>
            <h3>${esc(p.title)}</h3>
            ${tag}
          </div>
        </div>
        <p class="p-role">${esc(p.role || "")}</p>
        ${p.summary ? `<p class="p-summary">${esc(p.summary)}${pendingBadge(p)}${refLinks(p.refs)}</p>` : ""}
        <div class="p-nums"><span>등장하는 숫자</span>
          ${hits.map((s) => `<a href="#${esc(s.id)}">${esc(s.title)}</a>`).join("")}
        </div>
      </article>`;
  };

  const retired = mentioned.filter((x) => x.p.retired_number).length;
  const links = mentioned.reduce((n, x) => n + x.hits.length, 0);
  $("#people-stats").textContent = `${mentioned.length}명 · 영구결번 ${retired}명 · 숫자 연결 ${links}곳`;
  $("#people-grid").innerHTML = mentioned.map(card).join("");
  $("#people-more").innerHTML = others.length ? `
    <h3>아직 숫자 계단에 오르지 않은 잠실 사람들</h3>
    <ul class="chips">${others.map(({ p }) => `<li class="chip person" title="${esc(p.role || "")}">${esc(p.title)}${p.verified === false ? " ⚠️" : ""}</li>`).join("")}</ul>` : "";
}

function renderLast(meta, events, index) {
  const game = index.get(meta.last_game_event);
  if (!game) return;
  const records = events.filter((e) => e.type === "Record" && e.tags?.includes("last-record"));
  const rows = records.map((r) => {
    const person = (r.linked || []).map((id) => index.get(id)).find((e) => e && e.type === "Person");
    return `
      <li>
        <span class="k">${esc(r.title)}</span>
        <div>
          ${person ? `<p class="who">${esc(person.title)}</p>` : ""}
          <p class="d">${esc(r.summary)}${refLinks(r.refs)}</p>
          ${pendingBadge(r)}
        </div>
      </li>`;
  }).join("");

  $("#last-card").innerHTML = `
    <div class="last-head">
      <p class="last-date">${esc(game.date.replaceAll("-", "."))}</p>
      <h3>${esc(game.title)}</h3>
      <p>${esc(game.summary)}${refLinks(game.refs)}</p>
    </div>
    <ol class="last-list">${rows}</ol>
    ${meta.last_game_note ? `<p class="last-foot">${esc(meta.last_game_note)}</p>` : ""}`;
}

// ---------- 유물: 물건 한 점 = 분류 · 행방 · 소장자 · 이력 · 연결된 사람/사건/숫자/질문 ----------
// 이미지는 언론 사진을 쓰지 않는다. 자체 촬영·소장자 제공분이 생기기 전까지는 분류 이름만 자리표시로 둔다
function renderArtifacts(items, cfg, index) {
  const label = (list, id) => (list || []).find((x) => x.id === id)?.label || id;
  const linkLabel = (e) =>
    e.type === "Person" ? e.title
      : e.type === "Quest" ? `${e.id} 질문`
        : e.type === "Ladder" ? `숫자 ${e.title}`
          : e.title;
  const holderLine = (a) => {
    if (a.whereabouts === "unknown") return `<b>행방 미상</b>`;
    const h = a.holder || {};
    const who = [h.name, label(cfg.holder_kinds, h.kind)].filter(Boolean).join(" · ");
    return `<b>${esc(label(cfg.whereabouts, a.whereabouts))}</b> — ${esc(who)}${h.confirmed ? "" : " <span class=\"muted\">(소장자 확인 전)</span>"}`;
  };

  $("#artifact-stats").textContent = items.length
    ? `${items.length}점 · 행방 미상 ${items.filter((a) => a.whereabouts === "unknown").length}점`
    : "";
  $("#artifact-grid").innerHTML = !items.length
    ? `<p class="no-clue">아직 등록된 유물이 없습니다.</p>`
    : items.map((a) => {
      const links = (a.linked || []).map((id) => index.get(id)).filter(Boolean);
      return `
      <article class="artifact w-${esc(a.whereabouts)}" id="${esc(a.id)}">
        <div class="ar-ph" aria-hidden="true"><span>${esc(label(cfg.categories, a.category))}</span></div>
        <div class="ar-body">
          <p class="ar-meta">${esc(label(cfg.categories, a.category))}${a.date ? ` · ${esc(dotted(a.date))}` : ""}</p>
          <h3>${esc(a.title)}</h3>
          <p class="ar-where">${holderLine(a)}</p>
          <p class="ar-summary">${esc(a.summary)}${pendingBadge(a)}${refLinks(a.refs)}</p>
          ${a.note ? `<p class="note">${esc(a.note)}</p>` : ""}
          ${(a.provenance || []).length ? `
            <details class="ar-prov">
              <summary>이력 ${a.provenance.length}건</summary>
              <ol>${a.provenance.map((p) => `<li>${p.date ? `<span class="d">${esc(dotted(p.date))}</span>` : ""}${esc(p.text)}${refLinks(p.refs)}</li>`).join("")}</ol>
            </details>` : ""}
          ${links.length ? `<div class="chips">${links.map((e) => `<a class="chip${e.type === "Person" ? " person" : ""}" href="#${esc(e.id)}">${esc(linkLabel(e))}</a>`).join("")}</div>` : ""}
        </div>
      </article>`;
    }).join("");
}

function renderQuests(quests, stages) {
  const stageById = new Map(stages.map((s, i) => [s.id, { ...s, step: i + 1 }]));
  $("#quest-grid").innerHTML = quests.map((q) => {
    const clues = q.clues || [];
    const st = stageById.get(q.stage);
    return `
      <article class="quest" id="${esc(q.id)}">
        <div>
          <p class="quest-id">${esc(q.id)}</p>
          <h3>${esc(q.question)}</h3>
          <div class="chips">${(q.layers || []).map((l) => `<span class="chip">${esc(l)}</span>`).join("")}</div>
        </div>
        <div class="progress" aria-label="진행률 ${q.progress}%">
          <span class="bar"><i style="width:${Math.max(0, Math.min(100, q.progress))}%"></i></span>
          <span>${q.progress}% · 단서 ${clues.length}개</span>
        </div>
        ${st ? `<p class="stage" title="${esc(st.criteria)}"><b>${st.step}/${stages.length}</b> ${esc(st.label)}<span> — ${esc(st.criteria)}</span></p>` : ""}
        ${q.hypothesis ? `<p class="hypo">가설 — <b>${esc(q.hypothesis)}</b></p>` : ""}
        ${clues.length
          ? `<details>
              <summary>단서 보기</summary>
              <ul class="clues">${clues.map((c) => `<li>${esc(c.text)}${c.verified === false ? ` ${pendingBadge(c)}` : ""}${refLinks(c.refs)}<span class="src">${esc(c.source)}</span></li>`).join("")}</ul>
            </details>`
          : `<p class="no-clue">아직 단서가 없습니다. 필요한 자료: ${esc((q.data_sources || []).join(", "))}</p>`}
        <div class="quest-actions">
          <button class="btn" type="button" data-report="${esc(q.id)}">제보하기</button>
        </div>
      </article>`;
  }).join("");

  $("#quest-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-report]");
    if (btn) toast(`${btn.dataset.report} 제보 접수는 2단계에서 열립니다.`);
  });
}

function renderFooter(meta) {
  $("#footer").innerHTML = `
    <div class="footer-inner">
      <div>
        <h2>안내</h2>
        <p class="notice">${esc(meta.notice)}</p>
        <p class="meta">v${esc(meta.version)} · 최종 업데이트 ${esc(meta.updated || meta.research_update)} · 기초 조사 ${esc(meta.research_date)} · 주식회사 앵커</p>
      </div>
      <div>
        <h2>출처</h2>
        <ul>${meta.sources.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      </div>
    </div>`;
}

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function setupTheme() {
  const root = document.documentElement;
  $("#theme-toggle").addEventListener("click", () => {
    const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("jamsil-theme", next); } catch (e) {}
  });
}

async function main() {
  setupTheme();
  setupStoryDialog();
  setupNumboard();
  let data;
  try {
    const loaded = await Promise.all(DATA_FILES.map((f) => fetch(`data/${f}.json`).then((r) => {
      if (!r.ok) throw new Error(`${f}.json ${r.status}`);
      return r.json();
    })));
    data = Object.fromEntries(DATA_FILES.map((f, i) => [f, loaded[i]]));
  } catch (err) {
    $("main").innerHTML = `<div class="load-error">데이터를 불러오지 못했습니다 (${esc(err.message)}).<br>파일을 직접 열지 말고 로컬 서버로 열어 주세요: <code>node tools/serve.mjs</code></div>`;
    return;
  }

  for (const s of data.sources) SRC.set(s.id, s);
  // 참조(linked)는 경기장을 넘나들 수 있으니 색인은 전체로, 화면 목록은 이 경기장 것만
  const index = new Map();
  for (const f of DATA_FILES.slice(1)) if (f !== "sources") for (const r of data[f]) index.set(r.id, r);
  const venue = data.meta.venue;
  for (const f of VENUE_FILES) data[f] = data[f].filter((r) => r.venue === venue);
  data.people = data.people.filter((p) => (p.venues || []).includes(venue));

  renderHero(data.meta, index);
  renderNow(data.meta, index);
  renderTimeline(data.events, index);
  renderLadder(data.ladder, data.meta.ladder || {});
  renderPeople(data.people, data.ladder, data.meta.ladder || {});
  renderLast(data.meta, data.events, index);
  renderArtifacts(data.artifacts, data.meta.artifacts || {}, index);
  renderQuests(data.quests, data.meta.quest_stages || []);
  renderFooter(data.meta);
  loadApprovedStories();

  // 데이터가 늦게 그려지므로, 주소에 #섹션이 있으면 렌더 후 다시 맞춰 준다
  // (웹폰트 로딩으로 레이아웃이 밀리지 않도록 폰트 준비 후, 부드러운 스크롤 없이 이동)
  if (location.hash) {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = selectStep(id) ? document.getElementById("numbers") : document.getElementById(id);
    if (target) document.fonts.ready.then(() => target.scrollIntoView({ behavior: "instant" }));
  }
}

main();
