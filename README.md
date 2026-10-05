# ROADER

Threads multi-account content & lead automation platform.

## Product goal
ROADER manages multiple Threads accounts with separate personas, sectors, posting rules, quality thresholds, schedules, and Telegram lead attribution.

## Current MVP
- Dashboard matching the approved ROADER concept
- Threads account management UI
- Per-account content/persona settings
- AI-post creation workspace
- Text-only and image+text modes
- Content quality scoring engine
- Hard blockers for low-quality/duplicate/unsafe posts
- Scheduler UI with quality state
- Existing Telegram application webhook preserved

## Quality policy
Automation must not lower editorial quality.

Scoring dimensions:
- Hook
- Mobile readability
- Substance / explanation
- Engagement potential
- Naturalness
- Recent-post duplication risk
- Visual completeness
- Unsafe/overclaim language

Publishing policy:
- 90+: ready to schedule
- 80–89: manual review
- Below threshold or blocker hit: publishing blocked

Image posts cannot pass if the selected media mode is image and no image is attached.

## Run locally
```bash
npm install
npm run dev
```

## Telegram environment variables
- TELEGRAM_BOT_TOKEN
- ADMIN_CHAT_ID
- WEBHOOK_SECRET
- SETUP_KEY
- INFO_ROOM_URL
