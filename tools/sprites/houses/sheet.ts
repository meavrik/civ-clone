/** The user's sheet of houses, row by row: its cells' side, and the pixels kept round each house's bounds. */
export const HOUSE_CELL = 256;
export const HOUSE_MARGIN = 2;
export const HOUSE_ROWS = [
  ["round_hut", "adobe_house", "white_cottage", "courtyard_house", "fishers_hut", "stone_cottage"],
  ["timber_house", "mossy_cottage", "bakery", "potters_yard", "carpenters_shed", "inn"],
  ["town_house", "brick_terrace", "greengrocer", "stair_house", "warehouse", "tenement"],
  ["bungalow", "flats", "corner_cafe", "garage", "solar_house", "garden_house"],
] as const;
