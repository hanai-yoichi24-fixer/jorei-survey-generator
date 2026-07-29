// Vercel serverless function — 生成履歴の保存(POST)・一覧(GET)・削除(DELETE)
// Supabase(jorei_history) を service_role で読み書きする。

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function H(extra) {
  return Object.assign({ apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": "application/json" }, extra || {});
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!SUPA_URL || !SUPA_KEY) { res.status(500).send(JSON.stringify({ error: "Supabase 未設定（環境変数が必要）" })); return; }

  try {
    if (req.method === "GET") {
      const u = SUPA_URL + "/rest/v1/jorei_history?select=id,name,addr,youto,keikan,senyou,madoguchi,height,total,need_apply,signs,created_at&order=created_at.desc&limit=200";
      const r = await fetch(u, { headers: H() });
      const data = await r.json();
      res.status(200).send(JSON.stringify({ items: Array.isArray(data) ? data : [] }));
      return;
    }

    if (req.method === "POST") {
      let b = {};
      try { b = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); } catch (e) { b = {}; }
      const rec = {
        name: b.name || null, addr: b.addr || null, youto: b.youto || null,
        keikan: b.keikan || null, senyou: b.senyou || null, madoguchi: b.madoguchi || null,
        height: (b.height == null || b.height === "") ? null : Number(b.height),
        total: (b.total == null || b.total === "") ? null : Number(b.total),
        need_apply: !!b.needApply,
        signs: Array.isArray(b.signs) ? b.signs : []
      };
      const r = await fetch(SUPA_URL + "/rest/v1/jorei_history", {
        method: "POST", headers: H({ Prefer: "return=representation" }), body: JSON.stringify(rec)
      });
      const data = await r.json();
      if (!r.ok) { res.status(r.status).send(JSON.stringify({ error: "保存失敗", detail: data })); return; }
      res.status(200).send(JSON.stringify({ ok: true, inserted: Array.isArray(data) ? data[0] : data }));
      return;
    }

    if (req.method === "DELETE") {
      const q = req.query || {};
      let u;
      if (q.all === "1" || q.all === "true") u = SUPA_URL + "/rest/v1/jorei_history?id=gt.0";
      else if (q.id) u = SUPA_URL + "/rest/v1/jorei_history?id=eq." + encodeURIComponent(q.id);
      else { res.status(400).send(JSON.stringify({ error: "id か all=1 が必要です" })); return; }
      const r = await fetch(u, { method: "DELETE", headers: H({ Prefer: "return=minimal" }) });
      if (!r.ok) { const t = await r.text(); res.status(r.status).send(JSON.stringify({ error: "削除失敗", detail: t })); return; }
      res.status(200).send(JSON.stringify({ ok: true }));
      return;
    }

    res.status(405).send(JSON.stringify({ error: "method not allowed" }));
  } catch (e) {
    res.status(500).send(JSON.stringify({ error: "server error" }));
  }
};
