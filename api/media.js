import { Readable } from 'node:stream';

const ALLOWED_HOST_SUFFIXES = [
  'cdninstagram.com',
  'fbcdn.net',
  'instagram.com',
];

function isAllowedRemoteUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

function sanitizeFilename(value, fallback) {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return raw.replace(/[\r\n"\\/]/g, '_').slice(0, 160);
}

function sendError(res, status, message) {
  res.status(status);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(message);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 405, 'GET 요청만 지원합니다.');
  }

  const remoteUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!isAllowedRemoteUrl(remoteUrl)) {
    return sendError(res, 400, '허용되지 않은 미디어 주소입니다.');
  }

  const inline = req.query.inline === '1';
  const fallbackName = inline ? 'instagram-media' : 'instagram-download.mp4';
  const filename = sanitizeFilename(req.query.filename, fallbackName);

  const upstreamHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    Accept: '*/*',
    Referer: 'https://www.instagram.com/',
  };

  if (typeof req.headers.range === 'string') {
    upstreamHeaders.Range = req.headers.range;
  }

  try {
    const upstream = await fetch(remoteUrl, {
      method: 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    if (!upstream.ok && upstream.status !== 206) {
      return sendError(
        res,
        upstream.status === 403 ? 403 : 502,
        `Instagram CDN 파일 요청 실패 (${upstream.status})`,
      );
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.startsWith('video/') && !contentType.startsWith('image/')) {
      return sendError(res, 502, '미디어 파일 대신 다른 응답을 받았습니다.');
    }

    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );

    for (const headerName of [
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
    ]) {
      const value = upstream.headers.get(headerName);
      if (value) res.setHeader(headerName, value);
    }

    if (!upstream.body) {
      return res.end();
    }

    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', (error) => {
      console.error('Media stream failed:', error);
      if (!res.headersSent) sendError(res, 502, '미디어 전송 중 오류가 발생했습니다.');
      else res.destroy(error);
    });
    req.on('aborted', () => stream.destroy());
    res.on('close', () => {
      if (!res.writableEnded) stream.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Media proxy failed:', error);
    return sendError(res, 502, '미디어 파일을 전송하지 못했습니다.');
  }
}
