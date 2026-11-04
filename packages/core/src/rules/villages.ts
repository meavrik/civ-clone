/**
 * Tribal villages (save version 67; asked for 2026-11-04: "what about settler and new settlement like in the original
 * civ"). A tribe lives in some of them and joins the civilization that finds it, four squares or more from any city: a
 * city where the land will bear one, as the original's did, else Settlers with no home city, as Civilization II's
 * nomads. Nearer a city it sends mercenaries, as the original's did. Saves before 67 load with `noTribes`.
 */
export const VILLAGES = {
  /** Of every hundred villages, so many hold a tribe: taken from the gold, which held forty before. */
  tribes: 20,
  /**
   * The site a tribe's city asks for (`siteScore`), the original asking so of its land value. Starts as drawn average
   * 109; 37% of villages stand on land as good, 48% on any land fit for a city at all.
   */
  goodLand: 100,
} as const;
