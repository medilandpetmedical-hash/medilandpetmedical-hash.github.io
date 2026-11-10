/* Reads the site data embedded by build.py; renders live hours and the small pet touches. */
const CONFIG = JSON.parse(document.getElementById("site-data").textContent);
const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
const fmt = t => { const m = toMin(t), h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + ":" + String(mm).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM"); };
const nowLocal = () => {
  const p = new Intl.DateTimeFormat("en-GB",{timeZone:CONFIG.timezone,weekday:"short",hour:"numeric",minute:"numeric",hour12:false}).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value;
  return {day:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(g("weekday")), mins:(+g("hour") % 24) * 60 + +g("minute")};
};
const year = +new Intl.DateTimeFormat("en",{timeZone:CONFIG.timezone,year:"numeric"}).format(new Date());
document.querySelectorAll("[data-years]").forEach(e => e.textContent = year - CONFIG.since);
const yr = document.getElementById("yr"); if (yr) yr.textContent = year;

(function hours() {
  const {day, mins} = nowLocal(), ul = document.getElementById("hours");
  if (!ul) return;
  ul.textContent = "";
  const order = [1,2,3,4,5,6,0], short = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const groups = [];
  order.forEach(d => {
    const h = CONFIG.hours[d], key = h ? h.join("-") : "closed", g = groups[groups.length - 1];
    if (g && g.key === key) g.days.push(d); else groups.push({key, h, days:[d]});
  });
  groups.forEach(g => {
    const li = document.createElement("li"), a = document.createElement("span"), b = document.createElement("span");
    if (g.days.includes(day)) li.className = "today";
    a.textContent = g.days.length > 1 ? short[g.days[0]] + " – " + short[g.days[g.days.length - 1]] : dayNames[g.days[0]];
    b.textContent = g.h ? fmt(g.h[0]) + " – " + fmt(g.h[1]) : "Call to confirm";
    li.append(a, b); ul.appendChild(li);
  });
  const t = CONFIG.hours[day];
  let cls = "badge", text;
  if (t && mins >= toMin(t[0]) && mins < toMin(t[1])) { cls = "badge open"; text = "Open now · closes " + fmt(t[1]); }
  else if (t) text = mins < toMin(t[0]) ? "Closed · opens " + fmt(t[0]) : "Closed for today";
  else text = "Please call to confirm today's hours";
  ["openBadge", "openBadge2"].forEach(id => { const el = document.getElementById(id); el.className = cls; el.lastChild.textContent = text; });
})();

/* Pet touches: mouse-only, off for touch and reduced motion. */
const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
const still = matchMedia("(prefers-reduced-motion:reduce)").matches;
if (!still) {
  const w = document.getElementById("walker"); let timer, ticking = false;
  const place = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    w.style.transform = "translateX(" + ((innerWidth - w.offsetWidth - 16) * p + 8) + "px)";
    ticking = false;
  };
  addEventListener("scroll", () => {
    w.classList.add("walking"); clearTimeout(timer); timer = setTimeout(() => w.classList.remove("walking"), 180);
    if (!ticking) { ticking = true; requestAnimationFrame(place); }
  }, {passive:true});
  addEventListener("resize", place); place();
}
if (fine && !still) {
  let lx = 0, ly = 0, flip = 1;
  addEventListener("pointermove", e => {
    const dx = e.clientX - lx, dy = e.clientY - ly;
    if (Math.hypot(dx, dy) < 80) return;
    lx = e.clientX; ly = e.clientY; flip = -flip;
    const s = document.createElement("span"); s.className = "trail";
    s.style.setProperty("--r", (Math.atan2(dy, dx) * 180 / Math.PI + 90) + "deg");
    s.style.left = (e.clientX - 10 + flip * 8) + "px"; s.style.top = (e.clientY - 10) + "px";
    document.body.appendChild(s); setTimeout(() => s.remove(), 1200);
  }, {passive:true});
}

/* ---- Analytics events: clicks on contact actions and which sections people reach. No personal data is sent. ---- */
(function () {
  const provider = CONFIG.analytics || "";
  const send = (name, props) => {
    try {
      if (provider === "ga4" && window.gtag) window.gtag("event", name, Object.assign({transport_type: "beacon"}, props));
      else if (provider === "umami" && window.umami) window.umami.track(name, props);
      else if (provider === "goatcounter" && window.goatcounter) window.goatcounter.count({path: "event/" + name, title: name, event: true});
    } catch (e) { /* analytics must never break the page */ }
  };
  const classify = a => {
    const h = a.getAttribute("href") || "";
    if (h.indexOf("wa.me/") > -1) {
      let t = ""; try { t = decodeURIComponent((h.split("text=")[1] || "")); } catch (e) {}
      return ["whatsapp_click", {msg_type: /groom|book/i.test(t) ? "grooming" : (t ? "stock" : "general")}];
    }
    if (h.indexOf("tel:") === 0) return ["call_click", {}];
    if (h.indexOf("mailto:") === 0) return ["email_click", {}];
    if (h.indexOf("g.page/r/") > -1) return ["review_click", {}];
    if (h.indexOf("google.com/maps/place") > -1) return ["reviews_read_click", {}];
    if (h.indexOf("google.com/maps") > -1) return ["directions_click", {}];
    if (/facebook|instagram|linkedin|pinterest/.test(h)) return ["social_click", {}];
    return null;
  };
  document.addEventListener("click", ev => {
    const a = ev.target.closest && ev.target.closest("a[href]");
    if (!a) return;
    const c = classify(a);
    if (!c) return;
    const sec = a.closest("section,header,footer,.mbar,.strip,.hero");
    const loc = a.closest(".mbar") ? "sticky_bar" : (sec && (sec.id || sec.className.split(" ")[0])) || "page";
    send(c[0], Object.assign({link_location: loc}, c[1]));
  }, {passive: true});
  if ("IntersectionObserver" in window) {
    const seen = new Set();
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting && !seen.has(e.target.id)) { seen.add(e.target.id); send("section_view", {section: e.target.id}); }
    }), {threshold: 0.4});
    ["services", "story", "reviews", "visit"].forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
})();

/* ---- Cookie notice (only when Google Analytics is on). Choice is remembered on this device. ---- */
(function () {
  if (CONFIG.analytics !== "ga4" || !window.gtag) return;
  let choice = null;
  try { choice = localStorage.getItem("mediland-analytics"); } catch (e) {}
  const grant = on => gtag("consent", "update", {analytics_storage: on ? "granted" : "denied"});
  if (choice === "granted") { grant(true); return; }
  if (choice === "denied") return;
  const box = document.createElement("div");
  box.className = "cookie";
  box.setAttribute("role", "region");
  box.setAttribute("aria-label", "Cookie notice");
  box.innerHTML = '<p>We use a cookie to count visits and see which buttons are used, so we can improve this site. No ads, nothing personal is collected.</p><div><button type="button" data-v="granted" class="btn btn-primary">Accept</button><button type="button" data-v="denied" class="btn btn-line">No thanks</button></div>';
  box.addEventListener("click", e => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    try { localStorage.setItem("mediland-analytics", b.dataset.v); } catch (err) {}
    grant(b.dataset.v === "granted");
    box.remove();
  });
  document.body.appendChild(box);
})();
