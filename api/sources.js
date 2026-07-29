// Vercel serverless function
// 住所から適用自治体を判定し、該当する屋外広告物・景観の資料を特定して
// 実際に Web(公開URL) へアクセスし存在を確認、出典リストを返す。
// 規制値そのものの LLM 抽出は次段階（要 ANTHROPIC_API_KEY・人的検証）。

const TOKYO_SHIORI = {
  category: "屋外広告物（都条例）",
  name: "東京都屋外広告物のしおり（2025年）",
  issuer: "東京都 都市整備局",
  url: "https://www.toshiseibi.metro.tokyo.lg.jp/documents/d/toshiseibi/pdf_kenchiku_koukoku_pdf_kou_2025siori",
  refs: "適用除外・総量規制・色彩等の共通基準、壁面/広告幕/突出等の個別基準（面積・高さ・出幅・個数）"
};

const WARD_LANDSCAPE = {
  "新宿区": {
    category: "景観（区条例）",
    name: "新宿区景観まちづくり条例に基づく届出等の手続き（屋外広告物編・R5）",
    issuer: "新宿区 都市計画部 景観・まちづくり課",
    url: "https://www.city.shinjuku.lg.jp/content/000414285.pdf",
    refs: "区域区分の判定、屋外広告物申請時の事前協議要件"
  }
};

const CORE_CITY = {
  "八王子市": {
    category: "屋外広告物（市条例）",
    name: "八王子市屋外広告物条例",
    issuer: "八王子市 まちなみ整備部 まちなみ景観課",
    url: null,
    refs: "八王子市は中核市。市条例に基づく（東京都しおりは非適用）"
  },
  "町田市": {
    category: "屋外広告物（市条例）",
    name: "町田市屋外広告物条例",
    issuer: "町田市 都市づくり部 地区街づくり課",
    url: null,
    refs: "町田市は景観行政団体。R6.10.1施行の市条例に基づく"
  }
};

const TOKYO23 = ["千代田区","中央区","港区","新宿区","文京区","台東区","墨田区","江東区","品川区","目黒区","大田区","世田谷区","渋谷区","中野区","杉並区","豊島区","北区","荒川区","板橋区","練馬区","足立区","葛飾区","江戸川区"];

function detectMuni(addr) {
  const pref = (addr.match(/^(東京都|北海道|京都府|大阪府|.{2,3}?県)/) || [])[0] || "";
  const rest = addr.replace(/^(東京都|北海道|京都府|大阪府|.{2,3}?県)/, "");
  const muni = (rest.match(/^(.+?[市区町村])/) || [])[1] || "";
  return { pref, muni };
}

function resolve(addr, youto, keikan, senyou) {
  const { pref, muni } = detectMuni(addr);
  const out = [];
  const isTokyo = /^東京都/.test(addr) || TOKYO23.includes(muni);

  if (isTokyo) {
    if (CORE_CITY[muni]) {
      out.push(CORE_CITY[muni]);
    } else {
      out.push({ ...TOKYO_SHIORI });
      if (TOKYO23.includes(muni)) {
        if (WARD_LANDSCAPE[muni]) out.push({ ...WARD_LANDSCAPE[muni] });
        else if (keikan && keikan !== "該当なし")
          out.push({ category: "景観（区条例）", name: muni + "の景観条例（屋外広告物）", issuer: muni, url: null, refs: "区域区分・事前協議（※当区の資料は未登録。要追加）" });
      }
    }
  } else if (pref) {
    out.push({ category: "屋外広告物（都道府県/市条例）", name: pref + "（または" + (muni || "市区町村") + "）の屋外広告物条例", issuer: pref, url: null, refs: "当自治体の条例・要綱（※未登録。要追加）" });
    if (keikan && keikan !== "該当なし")
      out.push({ category: "景観（条例）", name: (muni || pref) + "の景観条例", issuer: muni || pref, url: null, refs: "景観計画区域・事前協議（※未登録。要追加）" });
  } else {
    out.push({ category: "—", name: "住所から自治体を特定できません", issuer: "—", url: null, refs: "住所を『東京都新宿区…』の形式で入力してください" });
  }

  if (senyou && senyou !== "該当なし")
    out.push({ category: "道路占用", name: "道路占用許可（道路管理者）", issuer: (muni || "所管自治体") + " 道路管理担当", url: null, refs: "袖看板等が道路（上空含む）を占用する場合。窓口確認が必要" });

  return { pref, muni, sources: out };
}

module.exports = async (req, res) => {
  let body = {};
  try {
    body = req.method === "POST"
      ? (typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}))
      : (req.query || {});
  } catch (e) { body = {}; }

  const addr = body.addr || "", youto = body.youto || "", keikan = body.keikan || "", senyou = body.senyou || "";
  const { pref, muni, sources } = resolve(addr, youto, keikan, senyou);

  await Promise.all(sources.map(async (s) => {
    if (!s.url) { s.status = "未登録"; return; }
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 8000);
    try {
      const r = await fetch(s.url, { signal: c.signal, headers: { "User-Agent": "jorei-survey/1.0" } });
      s.status = r.ok ? "取得OK" : "不可(" + r.status + ")";
      s.contentType = r.headers.get("content-type") || "";
      s.size = r.headers.get("content-length") || "";
      try { if (r.body && r.body.cancel) await r.body.cancel(); } catch (_) {}
    } catch (e) {
      s.status = e.name === "AbortError" ? "タイムアウト" : "取得失敗";
    } finally { clearTimeout(t); }
  }));

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(JSON.stringify({ pref, muni, sources, fetchedAt: new Date().toISOString() }));
};
