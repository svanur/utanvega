// Derives the reply mailto subject's host from the submitting page's URL so multi-brand
// feedback (hlaupadagskra.is / 360runs.com) reads correctly, falling back to the original
// hardcoded literal when pageUrl is empty or fails to parse. Mirrors the backend's
// SubmitFeedbackCommand.GetHostOrFallback.
export function getHostOrFallback(pageUrl: string): string {
  try {
    const host = new URL(pageUrl).host;
    return host === '' ? 'hlaupadagskra.is' : host;
  } catch {
    return 'hlaupadagskra.is';
  }
}

export function replySubject(pageUrl: string): string {
  return encodeURIComponent(`Re: your feedback on ${getHostOrFallback(pageUrl)}`);
}
