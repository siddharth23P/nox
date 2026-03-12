#!/bin/bash

# Array of issue titles
ISSUES=(
  "Block 2 Sub-Feature: Rich Text Editor (Markdown + WYSIWYG)"
  "Block 2 Sub-Feature: Threaded Conversations (Recursive Nesting)"
  "Block 2 Sub-Feature: Real-time Presence (Mutual Discovery)"
  "Block 2 Sub-Feature: Message Lifecycle (Audit-Trailed Edits)"
  "Block 2 Sub-Feature: Reaction Engine (Atomic Multi-User)"
  "Block 2 Sub-Feature: Pinning/Bookmarking (Global vs Personal)"
  "Block 2 Sub-Feature: Read Management (Per-user Receipts)"
  "Block 2 Sub-Feature: Real-time Indicators (Typing/AI-Thinking)"
  "Block 2 Sub-Feature: Contextual Reply (Quoting/Line-linking)"
  "Block 2 Sub-Feature: Message Forwarding (Chain Attribution)"
  "Block 2 Sub-Feature: Code Support (50+ Languages)"
  "Block 2 Sub-Feature: Smart Outbox (Ephemeral Transmissions)"
  "Block 2 Sub-Feature: Mutual Friends & Stealth Presence"
)

# Parent Issue Number
PARENT_ISSUE=4

for title in "${ISSUES[@]}"; do
  echo "Creating issue: $title"
  gh issue create --title "$title" --body "Sub-task for Block 2 (Issue #$PARENT_ISSUE). Implementing the core messaging and interaction feature as per Universal SSoT."
done

echo "All issues created."
