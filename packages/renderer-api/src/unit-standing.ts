import { unitType, type Unit } from "@civ/core";
import { WORK_NAME } from "./icons.js";
import { rankedName } from "./ranks.js";

/**
 * What a unit in a city screen's units box is doing (asked for 2026-11-02: "distinct on the units view when unit is
 * fortified or sentry", and the units woken there shown so): asleep (fortified, fortifying, on sentry, camped to heal),
 * each told by a token in the corner of its picture; `ready` awaiting orders this turn, lit as the unit in play is on
 * the map; `spent` with no moves left; `busy` on a goto or a settler's job.
 */
export type CityUnitStanding = "fortified" | "fortifying" | "sentry" | "camp" | "ready" | "spent" | "busy";

export function cityUnitStanding(u: Pick<Unit, "order" | "movesLeft">): CityUnitStanding {
  switch (u.order.kind) {
    case "fortified": case "fortifying": case "sentry": case "camp": return u.order.kind;
    case "goto": case "work": return "busy";
    case "none": return u.movesLeft > 0 ? "ready" : "spent";
  }
}

/** Whether a unit of this standing sleeps until woken (a click on it in the units box wakes it). */
export function sleepsUntilWoken(standing: CityUnitStanding): boolean {
  return standing === "fortified" || standing === "fortifying" || standing === "sentry" || standing === "camp";
}

/**
 * The unit under the pointer in the units box, told of beside the citizens: "Veteran Legion: fortified, click to
 * wake", "Militia: ready for orders", "Settlers: building a road". `here`: standing in the city, else supported there
 * and away.
 */
export function cityUnitNote(u: Pick<Unit, "type" | "xp" | "order" | "movesLeft">, here: boolean): string {
  const name = rankedName(u);
  const standing = cityUnitStanding(u);
  const away = here ? "" : ", away";
  if (u.movesLeft === 0) {
    const doing = standing === "spent" ? "" : `${doingWords(u)}, `;
    return `${name}${away}: ${doing}no moves left`;
  }
  if (sleepsUntilWoken(standing)) return `${name}${away}: ${doingWords(u)}, click to wake`;
  if (standing === "busy") return `${name}${away}: ${doingWords(u)}, click to stop`;
  return `${name}${away}: ready for orders`;
}

function doingWords(u: Pick<Unit, "type" | "order">): string {
  switch (u.order.kind) {
    case "fortified": return "fortified";
    case "fortifying": return "fortifying";
    case "sentry": return "on sentry";
    case "camp": return unitType(u.type).domain === "sea" ? "resting" : "camped";
    case "goto": return "on its way";
    case "work": return WORK_NAME[u.order.work];
    case "none": return "awake";
  }
}
