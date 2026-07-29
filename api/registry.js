// Vercel serverless function — 資料台帳の一覧取得(GET)と登録(POST)
// Supabase(jorei_sources) を service_role で読み書きする。

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra) {
  return Object.assign({ apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": "application/json" }, extra || {});
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!SUPA_URL || !SUPA_KEY) {
    res.status(500).send(JSON.stringify({ error: "Supabase 未設定（環境変数が必要）" }));
    return;
  }

  if (req.method === "GET") {
    try {
      const u = SUPA_URL + "/rest/v1/jorei_sources?active=eq.true&select=id,scope,pref,muni,category,name,issuer,url,refs,created_at&order=pref,muni,id";
      const r = await fetch(u, { headers: headers() });
      const data = await r.json();
      res.status(200).send(JSON.stringify({ sources: data }));
    } catch (e) {
      res.status(500).send(JSON.stringify({ error: "一覧取得に失敗" }));
    }
    return;
  }

  if (req.method === "POST") {
    let body = {};
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); } catch (e) { body = {}; }
    const rec = {
      scope: (body.scope || "muni").trim(),
      pref: (body.pref || "").trim(),
      muni: (body.muni || "").trim() || null,
      category: (body.category || "").trim(),
      name: (body.name || "").trim(),
      issuer: (body.issuer || "").trim() || null,
      url: (body.url || "").trim() || null,
      refs: (body.refs || "").trim() || null
    };
    if (!rec.pref || !rec.category || !rec.name) {
      res.status(400).send(JSON.stringify({ error: "都道府県・区分・資料名は必須です" }));
      return;
    }
    try {
      const r = await fetch(SUPA_URL + "/rest/v1/jorei_sources", {
        method: "POST",
        headers: headers({ Prefer: "return=representation" }),
        body: JSON.stringify(rec)
      });
      const data = await r.json();
      if (!r.ok) { res.status(r.status).send(JSON.stringify({ error: "登録失敗", detail: data })); return; }
      res.status(200).send(JSON.stringify({ ok: true, inserted: Array.isArray(data) ? data[0] : data }));
    } catch (e) {
      res.status(500).send(JSON.stringify({ error: "登録に失敗（サーバー）" }));
    }
    return;
  }

  res.status(405).send(JSON.stringify({ error: "method not allowed" }));
};
