import { UAParser } from 'ua-parser-js';

/**
 * Parses a User-Agent string into a short, human-readable device label
 * we store on `refresh_tokens.device_label`. Returns null if UA is missing
 * or unparseable.
 */
export function parseDeviceLabel(userAgent: string | undefined | null): string | null {
  if (!userAgent || userAgent.trim().length === 0) return null;

  const parser = new UAParser(userAgent);
  const os = parser.getOS();
  const device = parser.getDevice();
  const browser = parser.getBrowser();

  const parts: string[] = [];
  if (device.model) parts.push(device.model);
  else if (os.name) parts.push(os.name);

  const osVersion = os.version ? ` ${os.version.split('.').slice(0, 2).join('.')}` : '';
  const osLabel = os.name ? `${os.name}${osVersion}` : null;

  if (osLabel && !parts[0]?.toLowerCase().includes(os.name?.toLowerCase() ?? '')) {
    parts.push(osLabel);
  }

  if (browser.name && parts.length < 2) parts.push(browser.name);

  const label = parts.filter(Boolean).join(' · ').trim();
  return label.length > 0 ? label.slice(0, 80) : null;
}
