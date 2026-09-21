# 개발 기록 (2026-09-21)

> 팀장(권순오)이 Claude Code와 함께 진행한 작업 기록. 기능 기준은 `docs/product-spec.md`, 절차는 `docs/team-guide.md`.
> 이 문서는 "지금까지 무엇을 했고, 왜 그렇게 했고, 무엇이 남았는지"만 적는다.

---

## 1. 현재 범위 결정

**지금은 컴퓨터 브라우저 + 웹캠에서 돌아가는 것까지만 완성한다. 폰(세로 화면·iOS·인앱 브라우저) 지원은 나중에 한다.**

- 스펙(`product-spec.md`)은 폰 1순위로 쓰여 있지만, 폰 관련 요구사항은 이번 범위에서 제외한다.
- 코드에서 뺀 것: 세로 회전 안내(S-R), 카카오톡 등 인앱 브라우저 안내, 폰 해상도·품질 기본값, 폰 LAN HTTPS 개발 모드(`dev:phone`), 화면 꺼짐 방지(Wake Lock).
- 리플레이·녹화(F-16의 `?replay=`, `?record=`)도 폰 녹화 전제라 이번에는 넣지 않았다. `?debug=1` 디버그 패널은 있다.

## 2. 진행 순서

| 순서 | 내용 | PR |
|---|---|---|
| 1 | docs 확인 → 팀장(A) 역할 파악, 레포 상태 점검 (Day 0 미착수 확인) | — |
| 2 | B 파트 담당 결정 → **F-07 부기 렌더러** 구현 (WebGL2 거울 비디오 + 부기 셰이더, 로컬 좌표 저장·병합·32개 상한·애니메이션, F-12 `capture()`) | #5 |
| 3 | A의 얼굴 인식에 부기를 붙인 실얼굴 데모 + WebGL 컨텍스트 손실 복구 | #6 |
| 4 | 렌더링 파트 Cursor 규칙 | #7 |
| 5 | 팀장이 **F-06 모기 무는 동작** 담당 → 상태 머신(APPROACH→LANDED→BITE→FLY_OFF→COOLDOWN, SPAWNING) + `BiteEvent` 출력. main에 직접 push된 C의 스프라이트 커밋과 충돌 → 둘 다 살려 병합 | #8 |
| 6 | README에 배포 정보 추가 | #9 |
| 7 | 원래 A 담당자가 작업하지 않아 팀장이 **A 작업** 인수. Day 0 기반: `src/shared/types.ts`(스펙 5.2, 3인 동의 생략), strict, Vite·Vercel 설정, 모델·WASM 로컬화, Vitest, PR 템플릿, Cursor 규칙 | #10 |
| 8 | **게임 연결**: 인식 모듈(`src/perception/`)을 스펙 형식으로 재구성, `src/main.ts` 루프로 카메라 → 인식 → 모기 → 부기 → HUD → 결과 연결. 폰 관련 코드 삭제 | #11 |
| 9 | **F-08 잡기**: 스윙(선분 판정)·박수·움켜쥐기·마우스 클릭. 분열(F-10) 전까지는 다 잡으면 1마리 보충 | #12 |
| 10 | **F-09 피 튀김**: 방울 12~20개(중력, 400 ms) + 바닥 자국(1.5 s 페이드) + "찰싹" 효과음(화이트노이즈 60 ms). 객체 풀, 동시 500개 상한 | #13 |
| 11 | **분열 추가 규칙** (팀장 결정: 모기가 너무 쉽게 죽어서 재미없음): 분열로 생긴 모기 중 절반은 평생 무적. `immortal` 플래그 + `makeHalfImmortal()`을 먼저 넣어두고 F-10이 호출 | #14 |

## 3. 주요 결정과 이유

- **공유 타입 먼저**: A·B·C가 각자 다른 타입(`FaceState`, 임시 `render/types.ts`)을 쓰고 있어서 통합 전에 스펙 5.2를 `src/shared/types.ts`로 확정했다.
- **모델 파일 로컬화**: CDN(jsdelivr, googleapis)은 학교·회사 Wi-Fi에서 막힐 수 있어서 `public/models/*.task`를 git에 넣고, WASM은 `postinstall`이 `public/wasm`으로 복사한다.
- **CSS `scaleX(-1)` 제거**: 거울 반전은 `perception/mapper.ts`(오버레이 좌표)와 셰이더(GL 영상)에서 각각 한 번씩만 한다. 화면은 GL 캔버스가 그리고 `<video>`는 1px 투명으로 숨긴다.
- **MediaPipe 타임스탬프**: 로딩 끝의 warm-up 시각보다 첫 rAF 시각이 앞서서 `Packet timestamp mismatch`로 루프가 멈추는 버그를 발견 → 공급원 안에서 얼굴·손 각각 단조 증가를 보장하고, 인식 오류가 나도 루프는 계속 돌게 했다.
- **품질 단계(F-15)**: 스펙의 3단계 "glScale 0.75 → 0.5"를 두 단계로 나눠 총 8단계. 8단계(손 인식 끔)에서는 복귀하지 않는다.

## 4. 현재 코드 구조

```
src/
├─ main.ts              메인 루프: S-1 → 카메라 → S-3 로딩 → S-4 게임 → S-5 결과
├─ shared/types.ts      계약서 (스펙 5.2)
├─ perception/          얼굴·손 인식 → FrameInput (mapper, One Euro, 속도, 성능 자동 조절)
├─ platform/            카메라, 화면(S-1/S-2/S-3), 지원 검사, 오류 토스트·버전, 디버그 패널, 스타일
├─ render/              부기 렌더러 (gl.ts, bites.ts, shaders.ts) + 격자 데모(demo.html)
├─ game/                모기(F-04, F-06), Game 구현(index.ts), 스프라이트
└─ ui/                  HUD·소리(F-11), 결과 화면(result.ts)
```

## 5. 실행 방법

```bash
npm install        # public/wasm 생성 (postinstall)
npm run dev        # http://localhost:5173  (?debug=1 또는 D 키로 디버그 패널)
npm test           # Vitest 42개
npm run build      # tsc(strict) + vite build
```

개발용 페이지: `/mosquito-test.html`(마우스로 모기 확인), `/src/render/demo.html?src=grid`(부기 렌더러 단독).

## 6. 검증한 것 / 못 한 것

- ✅ 타입 체크(strict)·빌드·테스트 42개 통과 (F-08 판정 10개, F-09 5개 포함)
- ✅ F-09 피 튀김 모양을 브라우저에서 시점별(60 ms / 250 ms / 1 s)로 그려 확인
- ✅ 브라우저에서 가짜 카메라 스트림으로 전체 흐름 확인: 모델 로딩(로컬, GPU) → 게임 화면(거울 영상·HUD·모기) → 그만하기 → 결과 이미지 → 다시 하기. 콘솔 에러 없음
- ⏳ **실제 얼굴로는 아직 확인 못 함** (자동화 환경에서 카메라 권한을 줄 수 없음). 확인 항목:
  - 모기가 얼굴로 날아와 앉고 무는지, 물린 자리가 붉게 붓는지
  - 고개를 돌려도 부기가 같은 피부 자리에 남는지
  - `?debug=1`에서 코끝 점이 실제 코 위에 있고, 부기 중심 원이 볼록한 곳과 겹치는지
  - 손바닥으로 모기를 빠르게 치면 죽고, 천천히 올려두면 안 죽는지 / 박수·움켜쥐기·클릭으로 잡히는지
  - 손 판정 수치(스윙 속도 1.5 faceW/s, grip 1.8/1.1)는 실측 후 `src/game/config.ts`에서 조정

## 7. 남은 일

| 기능 | 내용 | 담당 |
|---|---|---|
| F-10 | 분열 (`feat/F-10-split`에서 진행 중). **최신 main을 merge 필요** — 그 브랜치의 `swat.ts`·`fullDemoMain.ts`·`handTracking.ts` 수정은 main에서 이미 대체/삭제됨. `GameImpl.kill()`에서 `removeById` 대신 분열 → 새 두 마리에 `makeHalfImmortal(children)` → `GameImpl.cap` 준수 → `refillIfEmpty()` 임시 보충 삭제 | C (jayden000h) |
| F-05 | 4 s 접근 보장, 거리 비례 가속 | C |
| F-04 | 얼굴이 안 보일 때 화면 중앙 배회 (지금은 제자리 대기) | C |
| F-11 | "얼굴 어디 갔어?" 표시 | C |
| F-13 | 링크 미리보기 이미지 `public/og.jpg` (실제 게임 캡처로 제작) | A |
| 나중 | 폰 지원(세로 화면, iOS, 인앱 브라우저), 리플레이·녹화 | — |
