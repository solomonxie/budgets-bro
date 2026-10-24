// A listing link usually spells its address in the path —
// realtor.ca/real-estate/27512345/12345-148-street-surrey-fraser-heights,
// zillow.com/homedetails/123-Main-St-Austin-TX-78701/29384_zpid — so pasting
// one can fill the address without a network call.
export function addressFromListingUrl(url: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url.trim()).pathname);
  } catch {
    return null;
  }
  const words = (segment: string) =>
    segment
      .split(/[-_+]/)
      .filter((w) => w && !/^\d{7,}$/.test(w) && !/zpid|mls/i.test(w));
  const best = path
    .split('/')
    .map(words)
    .filter((w) => w.length >= 3 && w.some((x) => /[a-z]/i.test(x)))
    .sort((a, b) => b.length - a.length)[0];
  if (!best) return null;
  return best
    .map((w) =>
      /^[a-z]{2}$/i.test(w) && w === w.toUpperCase()
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(' ');
}
