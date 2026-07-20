# 릴스 커버 아카이브 수정본

## 왜 기존 단일 HTML이 실패했는가

기존 코드는 브라우저에서 AllOrigins를 거쳐 Instagram 임베드 HTML과 비공개 내부 API를 호출했습니다. Instagram 영상 주소는 임베드 HTML에 항상 포함되지 않으며, 내부 API는 인증·헤더·요청 제한 때문에 공개 CORS 프록시로 안정적으로 호출할 수 없습니다. 영상 Blob까지 공개 프록시로 다시 받는 구조는 대용량 파일에서 시간 초과와 용량 제한도 쉽게 발생합니다.

## 실행

```bash
npm install
npm run dev
```

또는 이 폴더 전체를 GitHub 저장소에 올린 뒤 Vercel에서 Import하여 배포합니다.

`index.html`만 더블클릭해서 여는 방식으로는 `/api/resolve`와 `/api/media`가 없으므로 작동하지 않습니다.

## 구성

- `index.html`: 화면과 일괄 처리
- `api/resolve.js`: Instagram URL을 미디어 URL로 해석
- `api/media.js`: Instagram CDN 파일을 같은 출처에서 스트리밍
- `package.json`: 서버 측 추출 패키지

## 주의

Instagram의 비공개·삭제·로그인 제한·지역 제한 콘텐츠는 처리되지 않습니다. Instagram이 페이지 구조나 접근 정책을 바꾸면 서버 측 추출 패키지도 업데이트가 필요할 수 있습니다. 본인 콘텐츠 또는 다운로드 권한이 있는 콘텐츠에만 사용하세요.
