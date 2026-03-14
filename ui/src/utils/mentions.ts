/**
 * Mention utilities for parsing, storing, and rendering @mentions.
 *
 * Storage format: @[username](user_id) for user mentions
 *                 @[here]()           for @here
 *                 @[channel]()        for @channel
 *
 * The markdown content stores the raw format above; the HTML renderer
 * converts them into styled <span> badges before sanitization.
 */

export interface MentionUser {
  user_id: string;
  username: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  role?: string;
}

/** Special mention targets that notify groups rather than individuals. */
export const SPECIAL_MENTIONS: MentionUser[] = [
  { user_id: '', username: 'here', full_name: 'Notify all online members', display_name: 'here' },
  { user_id: '', username: 'channel', full_name: 'Notify all channel members', display_name: 'channel' },
];

/**
 * Encode a mention into the storage format used in content_md.
 */
export function encodeMention(user: MentionUser): string {
  return `@[${user.username}](${user.user_id})`;
}

/**
 * Regex that matches the stored mention format: @[username](user_id)
 * Captures: [1] = username, [2] = user_id (may be empty for special mentions)
 */
export const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]*)\)/g;

/**
 * Convert stored mentions in markdown text into styled HTML spans.
 * Call on the final HTML string so that mention markup is rendered as badges.
 */
export function renderMentionsInHTML(html: string): string {
  return html.replace(MENTION_REGEX, (_match, username: string, _userId: string) => {
    const isSpecial = username === 'here' || username === 'channel';
    const cls = isSpecial
      ? 'mention-badge mention-special'
      : 'mention-badge';
    return `<span class="${cls}" data-mention="${username}">@${username}</span>`;
  });
}

/**
 * Strip mention markup from text, leaving only the readable @username form.
 * Useful for plain-text previews.
 */
export function stripMentionMarkup(text: string): string {
  return text.replace(MENTION_REGEX, (_match, username: string) => `@${username}`);
}
