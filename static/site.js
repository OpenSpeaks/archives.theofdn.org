// paper grain, drawn at the band's own size so it never tiles
function paper(el) {
  var w = Math.min(el.offsetWidth, 2400), h = el.offsetHeight;
  if (!w || !h) return;
  var cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  var cx = cv.getContext("2d");
  var dark = getComputedStyle(document.body).color !== "rgb(0, 0, 0)";
  var img = cx.createImageData(w, h), d = img.data;
  var base = dark ? [34, 31, 26] : [230, 226, 218];
  for (var i = 0; i < d.length; i += 4) {
    var n = (Math.random() - .5) * (dark ? 14 : 18);
    d[i] = base[0] + n; d[i + 1] = base[1] + n; d[i + 2] = base[2] + n * 1.1; d[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  var r = Math.random;
  var ink = dark ? "255,240,220" : "40,32,24";
  // soft toner dot, blurred at the edge like a photocopy
  function dot(x, y, size, alpha) {
    var g = cx.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, "rgba(" + ink + "," + alpha + ")");
    g.addColorStop(.5, "rgba(" + ink + "," + alpha * .55 + ")");
    g.addColorStop(1, "rgba(" + ink + ",0)");
    cx.fillStyle = g;
    cx.fillRect(x - size, y - size, size * 2, size * 2);
  }
  // uneven toner , darker and lighter patches
  for (var m = 0; m < 6; m++) dot(r() * w, r() * h, 80 + r() * 260, dark ? .02 : .035);
  // loose specks
  for (var s = 0; s < w * h / 2600; s++) dot(r() * w, r() * h, .6 + r() * r() * 2.4, (dark ? .1 : .18) + r() * .3);
  // clumps where the toner gathered
  for (var c = 0; c < w * h / 60000 + 2; c++) {
    var x = r() * w, y = r() * h, spread = 4 + r() * 14;
    for (var k = 0; k < 6 + r() * 18; k++) dot(x + (r() - .5) * spread * 2, y + (r() - .5) * spread, .5 + r() * 1.6, .15 + r() * .35);
  }
  // a faint drum streak now and then
  if (r() < .6) {
    var sy = r() * h;
    cx.fillStyle = "rgba(" + ink + "," + (dark ? .04 : .06) + ")";
    cx.fillRect(0, sy, w, .6 + r() * 1.2);
  }
  el.style.backgroundImage = "url(" + cv.toDataURL("image/png") + ")";
}

function texture() {
  document.querySelectorAll(".paper").forEach(paper);
}

function drawMap() {
  var asia = L.latLngBounds([[5, 61], [37.5, 98]]);
  var map = L.map("atlas", { maxZoom: 12, zoomSnap: .25, maxBounds: asia, maxBoundsViscosity: 1, scrollWheelZoom: false });
  map.fitBounds(asia, { animate: false });
  map.setMinZoom(map.getBoundsZoom(asia));
  // north tip of Pakistan to the south tip of Sri Lanka
  map.fitBounds([[5.9, 68], [37.1, 94]], { animate: false });
  map.on("zoomend", function () { map.getContainer().classList.toggle("near", map.getZoom() >= 6); });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  places.forEach(function (p) {
    var size = 26 + Math.min(p.items, 8) * 2;
    var label = document.createElement("span");
    label.className = "pin-label";
    label.textContent = p.name;
    var icon = L.divIcon({
      className: "", iconSize: [size, size],
      html: '<div class="pin" style="width:' + size + "px;height:" + size + 'px">' + p.items + label.outerHTML + "</div>"
    });
    L.marker(p.at, { icon: icon, title: p.name, keyboard: true }).addTo(map)
      .on("click", function () { location.href = p.iso + "/"; });
  });
}

// CC button with one choice per subtitle track, inside the frame so it stays in full screen
function ccMenu(v, frame, tracks) {
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cc";
  btn.textContent = "CC";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", STRINGS.subtitles);
  var menu = document.createElement("ul");
  menu.className = "cc-menu";
  menu.hidden = true;
  var choices = tracks.map(function (t) { return t.label; }).concat(STRINGS.subtitlesOff);
  choices.forEach(function (label, i) {
    var li = document.createElement("li");
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.onclick = function () {
      for (var k = 0; k < v.textTracks.length; k++) v.textTracks[k].mode = k === i ? "showing" : "disabled";
      menu.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };
    li.appendChild(b);
    menu.appendChild(li);
  });
  btn.onclick = function () {
    menu.hidden = !menu.hidden;
    btn.setAttribute("aria-expanded", String(!menu.hidden));
  };
  frame.appendChild(btn);
  frame.appendChild(menu);
}

function play(b) {
  var frame = b.parentNode;
  var tracks = JSON.parse(b.dataset.tracks || "[]");
  var v = document.createElement("video");
  v.controls = true;
  v.preload = "metadata";
  v.src = b.dataset.src;
  tracks.forEach(function (t, i) {
    var tr = document.createElement("track");
    tr.kind = "subtitles";
    tr.src = t.src;
    tr.srclang = t.lang;
    tr.label = t.label;
    if (i === 0) tr.default = true;
    v.appendChild(tr);
  });
  var full = frame.parentNode.querySelector(".full");
  frame.replaceChildren(v);
  if (tracks.length) ccMenu(v, frame, tracks);
  if (full) {
    full.hidden = false;
    full.onclick = function () {
      if (frame.requestFullscreen) frame.requestFullscreen();
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    };
  }
  v.play();
}

function copy(text, done, fallback) {
  navigator.clipboard.writeText(text).then(done, fallback);
}

document.addEventListener("click", function (e) {
  var b = e.target.closest(".play");
  if (b) return play(b);
  var p = e.target.closest(".pid");
  if (p) {
    var note = p.querySelector(".pid-done");
    return copy(p.dataset.url, function () {
      note.textContent = STRINGS.linkCopied;
      setTimeout(function () { note.textContent = ""; }, 2000);
    }, function () {
      note.textContent = p.dataset.url;
    });
  }
  var cp = e.target.closest(".copy");
  if (cp) {
    copy(cp.dataset.cite, function () {
      cp.textContent = STRINGS.copied;
    }, function () {
      getSelection().selectAllChildren(cp.previousElementSibling);
    });
  }
});

// word lists: search, 100 a page, one shared player
function wordlist(box) {
  var rows = box.querySelector(".wordrows"), note = box.querySelector(".words-count");
  var prev = box.querySelector(".prev"), next = box.querySelector(".next");
  var sayer = box.querySelector(".sayer"), find = box.querySelector("#find");
  var all = [], shown = [], page = 0, size = 100;
  var wanted = parseInt(location.hash.slice(1), 10);
  var base = "https://upload.wikimedia.org/wikipedia/commons/";
  function pad(n) { return ("0000" + n).slice(-5); }
  function render() {
    var start = page * size;
    rows.replaceChildren();
    shown.slice(start, start + size).forEach(function (w) {
      var li = document.createElement("li");
      var id = box.dataset.id + "-" + pad(w[0]);
      var word = document.createElement("span");
      word.className = "word";
      word.textContent = w[1];
      word.lang = "or";
      var say = document.createElement("button");
      say.type = "button";
      say.className = "say";
      say.textContent = STRINGS.play;
      say.setAttribute("aria-label", STRINGS.playWord.replace("{word}", w[1]));
      say.dataset.src = base + w[3][0] + "/" + w[3] + "/" + encodeURIComponent(w[2].replace(/ /g, "_"));
      var pid = document.createElement("button");
      pid.type = "button";
      pid.className = "pid";
      pid.dataset.url = box.dataset.url + "-" + pad(w[0]);
      pid.setAttribute("aria-label", STRINGS.copyLink.replace("{id}", id));
      pid.innerHTML = "<code></code><span class=\"pid-done\" aria-live=\"polite\"></span>";
      pid.firstChild.textContent = id;
      li.id = String(w[0]);
      if (w[0] === wanted) li.className = "hit";
      li.append(say, word, pid);
      rows.appendChild(li);
    });
    var end = Math.min(start + size, shown.length);
    note.textContent = shown.length ? STRINGS.wordsShown.replace("{from}", start + 1).replace("{to}", end).replace("{n}", shown.length.toLocaleString("en-IN")) : STRINGS.wordsNone;
    prev.disabled = page === 0;
    next.disabled = end >= shown.length;
  }
  function filter() {
    var q = find.value.trim();
    shown = q ? all.filter(function (w) { return w[1].indexOf(q) !== -1; }) : all;
    page = 0;
    render();
  }
  fetch(box.dataset.src).then(function (r) { return r.json(); }).then(function (data) {
    all = data;
    filter();
    var at = all.findIndex(function (w) { return w[0] === wanted; });
    if (at > 0) {
      page = Math.floor(at / size);
      render();
    }
    var hit = rows.querySelector(".hit");
    if (hit) hit.scrollIntoView({ block: "center" });
  }, function () {
    note.textContent = STRINGS.wordsFailed;
  });
  find.addEventListener("input", filter);
  prev.onclick = function () { page--; render(); rows.scrollIntoView(); };
  next.onclick = function () { page++; render(); rows.scrollIntoView(); };
  rows.addEventListener("click", function (e) {
    var b = e.target.closest(".say");
    if (!b) return;
    sayer.src = b.dataset.src;
    sayer.play();
  });
}

var sized;
window.addEventListener("resize", function () {
  clearTimeout(sized);
  sized = setTimeout(texture, 300);
});

if (window.places) drawMap();
document.querySelectorAll(".words").forEach(wordlist);
texture();
