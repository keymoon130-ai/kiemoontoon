// 최기문웹툰 - 카카오톡/디스코드 등 링크 미리보기 카드용 Worker
// /w/<작품번호>, /e/<회차번호> 로 들어오면 미리보기 정보(og 태그)를 담은 페이지를 주고 사이트로 바로 이동시켜요.
const SUPA = 'https://nogwawurgnbqbcwyqcno.supabase.co';
const KEY = 'sb_publishable_uMekmd5oK_EmsYsu1WwfZA_z5Jqu2Kb';
const SITE = '최기문웹툰';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pub = p => p ? `${SUPA}/storage/v1/object/public/toon/${p.split('/').map(encodeURIComponent).join('/')}` : '';
const ogOf = p => p ? p.replace(/\.(webp|jpg)$/, '_og.jpg') : '';

async function q(path) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: { apikey: KEY, Accept: 'application/json' }, cf: { cacheTtl: 60 } });
  if (!r.ok) return null;
  const j = await r.json();
  return j && j[0];
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/(w|e)\/(\d+)\/?$/);
    if (!m) return env.ASSETS.fetch(req);

    const [, kind, id] = m;
    const target = `/#${kind === 'w' ? 'work' : 'view'}-${id}`;
    let title = SITE, desc = '친구들이 직접 그리고 연재하는 웹툰', image = '';
    try {
      if (kind === 'w') {
        const w = await q(`works?id=eq.${id}&status=eq.approved&select=title,description,thumb_path,profiles!works_author_id_fkey(display_name,pen_name)`);
        if (w) {
          title = `${w.title} - ${SITE}`;
          desc = `${w.profiles ? (w.profiles.pen_name || w.profiles.display_name) + ' 작가 · ' : ''}${(w.description || '').slice(0, 80)}`;
          image = pub(ogOf(w.thumb_path));
        }
      } else {
        const e = await q(`episodes?id=eq.${id}&status=eq.approved&select=title,no,works(title,thumb_path,profiles!works_author_id_fkey(display_name,pen_name))`);
        if (e && e.works) {
          title = `${e.works.title} ${e.title} - ${SITE}`;
          desc = `${e.works.profiles ? (e.works.profiles.pen_name || e.works.profiles.display_name) + ' 작가의 ' : ''}「${e.works.title}」 ${e.no}화를 보러 오세요!`;
          image = pub(ogOf(e.works.thumb_path));
        }
      }
    } catch (_) {}

    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url.origin + url.pathname)}">
${image ? `<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(image)}">` : ''}
<meta name="description" content="${esc(desc)}">
<meta http-equiv="refresh" content="0;url=${target}">
<script>location.replace(${JSON.stringify(target)})</script>
</head><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
<p>${esc(title)}</p><p><a href="${target}">작품 보러 가기</a></p></body></html>`;
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });
  }
};
