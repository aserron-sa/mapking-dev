

# Marrowback

**Live mode (intake automation)**

* Status: configured but currently PAUSED
* Interval: every 60 minutes (FREQ=MINUTELY;INTERVAL=60)
* Timezone: America/Caracas
* Delivery: reports posted to Slack channel #context-agent
* What each tick does (per the system prompt): sweep clients whose deal_notes or Attio notes changed since context_summary was last refreshed, and re-run the intake (pull Attio notes → overwrite deal_notes backup → rewrite context_summary) one client at a time.
* Note: writes during unattended live runs are subject to the platform's integration-writes setting for live runs (read-only / allow / ask-before-writes, configured in the Live dialog, not in agent config).
