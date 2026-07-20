import { instagramGetUrl } from 'instagram-url-direct';

function json(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function normalizeInstagramUrl(value) {
  if (typeof value !== 'string') return null;

  try {
    const parsed = new URL(value.trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname !== 'instagram.com') return null;

    const match = parsed.pathname.match(
      /\/(?:[^/]+\/)?(reel|p|tv)\/([A-Za-z0-9_-]+)/i,
    );
    if (!match) return null;

    return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`;
  } catch {
    return null;
  }
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isLikelyVideoUrl(value) {
  return typeof value === 'string' && /\.mp4(?:[?#]|$)/i.test(value);
}

function pickMedia(data) {
  const details = Array.isArray(data?.media_details) ? data.media_details : [];
  const urlList = Array.isArray(data?.url_list) ? data.url_list : [];

  const videoDetail = details.find(
    (entry) => entry?.type === 'video' && isHttpUrl(entry?.url),
  );
  const anyVideoUrl = urlList.find(isLikelyVideoUrl);

  const imageDetail = details.find(
    (entry) => entry?.type === 'image' && isHttpUrl(entry?.url),
  );

  const videoUrl = videoDetail?.url || anyVideoUrl || null;
  const thumbUrl =
    (isHttpUrl(videoDetail?.thumbnail) && videoDetail.thumbnail) ||
    (isHttpUrl(imageDetail?.url) && imageDetail.url) ||
    (isHttpUrl(details[0]?.thumbnail) && details[0].thumbnail) ||
    null;

  return { videoUrl, thumbUrl };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'POST 요청만 지원합니다.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: '요청 본문이 올바른 JSON이 아닙니다.' });
    }
  }

  const normalizedUrl = normalizeInstagramUrl(body?.url);
  if (!normalizedUrl) {
    return json(res, 400, { error: '올바른 Instagram 게시물 또는 릴스 URL이 아닙니다.' });
  }

  try {
    const data = await instagramGetUrl(normalizedUrl);
    const { videoUrl, thumbUrl } = pickMedia(data);

    if (!videoUrl && !thumbUrl) {
      return json(res, 422, {
        error: '공개 미디어 주소를 찾지 못했습니다. 비공개·삭제된 게시물이거나 Instagram 요청 제한일 수 있습니다.',
      });
    }

    return json(res, 200, {
      sourceUrl: normalizedUrl,
      videoUrl,
      thumbUrl,
    });
  } catch (error) {
    console.error('Instagram resolve failed:', error);
    return json(res, 502, {
      error: 'Instagram에서 미디어 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
}
