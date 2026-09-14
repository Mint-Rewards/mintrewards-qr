/**
 * Social sharing for a freshly-minted Mint Ambassador card.
 *
 * Platform reality check (this shapes both functions below):
 *
 *  - LinkedIn deprecated caption/summary prefill years ago. Its share intent
 *    (`linkedin.com/sharing/share-offsite/?url=...`) accepts only a URL; LinkedIn's
 *    crawler then reads THAT page's Open Graph tags for the preview shown in the
 *    composer. So "pre-filling a caption" here means: share a public page (the
 *    ambassador's own card page) whose og:title/og:description carry the caption
 *    text, not the tracking-url style redirect used elsewhere in this app. The
 *    student still types their own words in the post body -- LinkedIn does not
 *    expose any way around that to a third-party site.
 *  - Instagram has no web share intent at all for feed posts (no caption, no image).
 *    The achievable pattern is: copy the caption to the clipboard, download the
 *    image, then hand off to the Instagram app/site so the student pastes the
 *    caption and picks the already-downloaded image themselves.
 */

export function ambassadorShareCaption(campaignCaption: string | null, fullName: string): string {
  if (campaignCaption && campaignCaption.trim()) return campaignCaption;
  return (
    `I'm officially a Mint Ambassador! 🌱 ${fullName} joining the MintRewards team for ` +
    `World Cleanup Day. #MintRewards #MintAmbassador #WorldCleanupDay`
  );
}

/** LinkedIn reads the caption from the shared page's Open Graph tags, not from this URL. */
export function linkedInShareUrl(publicCardPageUrl: string): string {
  const params = new URLSearchParams({ url: publicCardPageUrl });
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
}
