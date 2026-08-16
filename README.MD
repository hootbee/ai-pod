
# 🛠 Git 협업 규칙

## 📌 프로젝트 개요

> 본 프로젝트는 협업을 통해 효율적으로 개발하기 위해 Git과 GitHub를 활용합니다. 아래는 원활한 협업을 위한 규칙과 가이드를 정리한 문서입니다.

---

## 📂 Git 브랜치 전략

```plaintext
main        : 최종 제품 릴리스를 위한 안정된 브랜치
dev         : 개발 중인 기능이 병합되는 브랜치
feature/*   : 개별 기능 개발을 위한 브랜치
hotfix/*    : 배포 후 급한 버그 수정용 브랜치
```

* **main 브랜치**는 오직 PR(Pull Request)을 통해서만 병합됩니다.
* **개발자는 feature 브랜치에서 작업 후 dev로 PR을 보냅니다.**
* 기능이 완료되면 `dev` → `main` 순서로 병합합니다.

---

## 💬 커밋 컨벤션

형식: `타입: 작업 내용`

### 커밋 타입 예시

* `feat` : 새로운 기능 추가
* `fix` : 버그 수정
* `docs` : 문서 수정
* `style` : 코드 포맷팅, 세미콜론 누락 등
* `refactor` : 코드 리팩토링
* `test` : 테스트 코드 추가/수정
* `chore` : 기타 변경사항 (빌드 설정, 패키지 매니저 등)

### 예시

```bash
git commit -m "feat: 로그인 기능 구현"
git commit -m "fix: 로그인 시 비밀번호 오류 수정"
```

---

## 🔄 작업 순서

1. `main`과 `dev` 브랜치를 최신 상태로 유지

   ```bash
   git checkout main
   git pull origin main
   git checkout dev
   git pull origin dev
   ```

2. 기능 브랜치 생성

   ```bash
   git checkout -b feature/기능이름
   ```

3. 작업 후 커밋 및 푸시

   ```bash
   git add .
   git commit -m "feat: 기능 설명"
   git push origin feature/기능이름
   ```

4. GitHub에서 Pull Request 생성 (base: dev ← compare: feature/기능이름)

5. 코드 리뷰 후 병합

---

## 🔍 코드 리뷰 가이드

* PR은 되도록 작고 명확하게 나누어 작성
* 리뷰어는 `Approve` 또는 `Comment`로 피드백 제공
* 리뷰를 반영한 후 `Re-request review` 요청

---

## 🧪 Flutter 검증 명령어

```bash
cd frontend
flutter pub get
flutter analyze
flutter test
flutter test integration_test/auth_refresh_test.dart
```

`auth_refresh_test.dart`는 실제 토큰을 사용하지 않고 `401 → refresh` 성공과
실패 흐름을 디바이스 환경에서 검증합니다.

---

## 🚀 백엔드 프로덕션 CD

`.github/workflows/deploy-production.yml`은 `main` 브랜치에 병합된 커밋을
기준으로 백엔드를 프로덕션 서버에 배포합니다.

배포 순서:

1. 백엔드 build, test, architecture 검증
2. `linux/amd64` Docker 이미지 빌드
3. `hootbee/aipod-backend:<commit-sha>` 이미지 푸시
4. 프로덕션 서버에서 해당 이미지 pull 및 backend 컨테이너 재생성
5. `http://127.0.0.1:3000/` health check
6. 실패 시 직전 이미지로 롤백 시도

GitHub 저장소의 `Settings > Environments > production`에 아래 Secrets를
등록해야 합니다.

```text
DOCKERHUB_USERNAME  Docker Hub 사용자명
DOCKERHUB_TOKEN     Docker Hub 접근 토큰
PROD_HOST           프로덕션 서버 호스트명 또는 IP
PROD_USER           SSH 사용자명
PROD_SSH_KEY        프로덕션 서버 접속용 SSH private key
PROD_PATH           원격 docker-compose.yml 디렉터리
```

`production` Environment에 Required reviewers를 지정하면 검증은 자동으로
진행하고, 실제 서버 배포는 승인 후 실행할 수 있습니다. 프로덕션 서버의
`docker-compose.yml`은 backend 서비스에 `build` 없이 Docker Hub 이미지의
`image` 항목을 사용해야 합니다.

---

## ⚠️ 주의사항

* `main` 브랜치에서 직접 작업하거나 push 금지
* 충돌 발생 시 직접 해결 후 PR
* 커밋 메시지와 PR 제목은 명확하게 작성
