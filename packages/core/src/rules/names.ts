/** Default city-name list for the player's civilization until civs are data-driven (phase 5). */
export const CITY_NAMES: string[] = [
  "Capital", "Riverton", "Hillfort", "Seagate", "Oakhaven", "Stonebridge", "Ashford", "Northwatch",
  "Goldmere", "Ironvale", "Thornhill", "Westmarch", "Eastbrook", "Kingsport", "Fairhollow", "Greywater",
  "Highcliff", "Lowmoor", "Redmarsh", "Silverlake", "Summerfield", "Winterhold", "Coldharbour", "Brightwater",
];

export function nextCityName(used: Set<string>): string {
  for (const n of CITY_NAMES) if (!used.has(n)) return n;
  let i = 1;
  while (used.has(`New Town ${i}`)) i++;
  return `New Town ${i}`;
}
