import { platformName } from '../../platform/native';

declare const __APP_VERSION__: string;

const SUPPORT_EMAIL = 'electriccatsofzeus@gmail.com';

/**
 * Opens the player's mail app with a pre-filled bug report.
 *
 * `public/support.html` already asks reporters for their device, OS, app version
 * and a description — but it asks them to assemble that by hand, in a browser,
 * after leaving the game. Almost nobody does. Pre-filling the parts a machine can
 * know is the difference between a report that can be reproduced and one that
 * can't.
 *
 * Deliberately collects nothing the player can't see: the body is visible and
 * editable in their mail client before they send it, and nothing is transmitted
 * unless they hit send. That keeps it consistent with the privacy policy, which
 * says the app collects nothing — a mailto: the player composes and sends is not
 * collection.
 *
 * The save is *not* attached. It can be huge, it belongs to them, and Export
 * sits directly above this in the same panel for when a report needs one.
 */
function reportBody(): string {
  /**
   * The UA is *not* a substitute for asking. WebKit freezes the OS version in
   * this string — an iOS 26 device still reports "iPhone OS 18_7" — and the
   * iPhone model was never in it. Verified on an iOS 26.3.1 simulator, which
   * composed `CPU iPhone OS 18_7`. So device and OS are asked for explicitly
   * below; the UA is kept only as a weak cross-check (engine build, and
   * whether the report came from the native shell or a browser).
   *
   * Getting real values would mean adding @capacitor/device — a new native
   * dependency for one diagnostic line. Not worth it while a one-line prompt
   * does the same job.
   */
  const ua = typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent;
  const screen =
    typeof window === 'undefined'
      ? 'unknown'
      : `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio ?? 1}x`;

  return [
    'What happened:',
    '',
    '',
    'What you expected instead:',
    '',
    '',
    'Steps to reproduce it:',
    '1. ',
    '2. ',
    '',
    // Asked for, not detected: see the note in reportBody() on why the UA
    // below cannot be trusted for either of these.
    'Your device and iOS version (Settings → General → About):',
    '',
    '',
    "If the game still opens, Export your save from the Ascend panel and paste it below — reports with a save attached tend to get fixed, ones without often can't be reproduced.",
    '',
    '',
    '--- please leave the lines below ---',
    `version: ${__APP_VERSION__}`,
    `platform: ${platformName()}`,
    `viewport: ${screen}`,
    `agent: ${ua}`,
  ].join('\n');
}

export function BugReport() {
  const href =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(`Electric Cats bug report (v${__APP_VERSION__})`)}` +
    `&body=${encodeURIComponent(reportBody())}`;

  return (
    <div className="mt-2 rounded border border-line bg-panel/60 p-3">
      <h3 className="text-[11px] uppercase tracking-widest text-ink-dim">Report a bug</h3>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-dim">
        Opens your mail app with your device and app version already filled in. Nothing is
        sent until you send it.
      </p>
      {/*
        A plain anchor, not window.open: Capacitor's webview hands unknown schemes
        (mailto:, tel:) to the system, and on the web this is just a link. No plugin,
        no native dependency, no behaviour to degrade.
      */}
      <a
        className="mt-2 inline-block rounded border border-line px-2.5 py-1.5 text-[11px] text-ink-dim transition-colors hover:bg-raised hover:text-ink"
        href={href}
      >
        Email a bug report
      </a>
    </div>
  );
}
