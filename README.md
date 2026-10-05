# roader

Threads → Telegram 신청 전용 프로젝트.

## 흐름
1. Threads 프로필/게시물에서 Telegram Bot으로 유입
2. /start 파라미터로 유입경로 기록
3. 연령대 선택
4. 관심분야 선택
5. 투자경험 선택
6. 관리자 Telegram으로 신청서 전달
7. 관리자 승인/거절
8. 승인 시 정보방 입장 링크 전달

## Environment Variables
- TELEGRAM_BOT_TOKEN
- ADMIN_CHAT_ID
- WEBHOOK_SECRET
- SETUP_KEY
- INFO_ROOM_URL

## Threads 추적 예시
- ?start=threads_profile
- ?start=threads_stock_001
- ?start=threads_macro_001
