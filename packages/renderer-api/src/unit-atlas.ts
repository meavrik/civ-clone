// Written by tools/sprites/units/anim.ts from the user's sheets of units' moves (tools/sprites/units/<unit>-anim.png):
// each atlas (apps/web/src/units/<unit>-anim.png) is its frames side by side on canvases of one size, unscaled, each
// frame's anchor (its front foot on the ground) on the canvas's `anchor`. Per frame: its name, its rectangle on the
// sheet (`source`: x, y, w, h), its anchor on the sheet, and the box its drawing fills on its canvas.
export interface UnitAtlasFrame {
  name: string;
  source: readonly [x: number, y: number, w: number, h: number];
  anchor: readonly [x: number, y: number];
  box: readonly [x: number, y: number, w: number, h: number];
}

export interface UnitAtlas {
  /** One frame's canvas, in the sheet's pixels; frame `n` is at x = n * size[0] in the atlas. */
  size: readonly [w: number, h: number];
  anchor: readonly [x: number, y: number];
  frames: readonly UnitAtlasFrame[];
}

export const UNIT_ATLASES: Record<string, UnitAtlas> = {
  militia: {
    size: [324, 320],
    anchor: [174, 318],
    frames: [
      { name: "ready", source: [41, 91, 253, 239], anchor: [191, 328], box: [26, 83, 249, 235] },
      { name: "anticipation", source: [352, 67, 201, 263], anchor: [526, 328], box: [2, 59, 197, 259] },
      { name: "wind-up", source: [646, 10, 186, 320], anchor: [801, 328], box: [21, 2, 182, 316] },
      { name: "strike", source: [899, 110, 316, 220], anchor: [1065, 328], box: [10, 102, 312, 216] },
      { name: "follow-through", source: [1213, 93, 257, 237], anchor: [1370, 328], box: [19, 85, 253, 233] },
      { name: "recovery", source: [1480, 91, 253, 239], anchor: [1629, 328], box: [27, 83, 249, 235] },
      { name: "sentry-1", source: [77, 353, 170, 248], anchor: [199, 599], box: [54, 74, 166, 244] },
      { name: "sentry-2", source: [386, 353, 157, 248], anchor: [497, 599], box: [65, 74, 153, 244] },
      { name: "sentry-3", source: [673, 361, 155, 240], anchor: [784, 599], box: [65, 82, 151, 236] },
      { name: "sentry-4", source: [956, 353, 165, 248], anchor: [1075, 599], box: [57, 74, 161, 244] },
      { name: "standing", source: [60, 615, 223, 257], anchor: [208, 870], box: [28, 65, 219, 253] },
      { name: "lowering", source: [347, 647, 239, 225], anchor: [501, 870], box: [22, 97, 235, 221] },
      { name: "kneeling", source: [636, 627, 238, 245], anchor: [798, 870], box: [14, 77, 234, 241] },
      { name: "defensive-hold", source: [922, 649, 238, 223], anchor: [1089, 870], box: [9, 99, 234, 219] },
    ],
  },
  "militia-travel": {
    size: [394, 433],
    anchor: [150, 431],
    frames: [
      { name: "travel-1", source: [108, 94, 392, 412], anchor: [256, 504], box: [4, 23, 388, 408] },
      { name: "travel-2", source: [618, 106, 378, 398], anchor: [768, 504], box: [2, 35, 374, 394] },
      { name: "travel-3", source: [1152, 73, 314, 430], anchor: [1280, 504], box: [24, 2, 310, 426] },
      { name: "travel-4", source: [108, 574, 392, 410], anchor: [256, 982], box: [4, 25, 388, 406] },
      { name: "travel-5", source: [618, 586, 378, 398], anchor: [768, 982], box: [2, 37, 374, 394] },
      { name: "travel-6", source: [1149, 553, 317, 430], anchor: [1280, 982], box: [21, 4, 313, 426] },
    ],
  },
  "militia-won": {
    size: [373, 483],
    anchor: [169, 481],
    frames: [
      { name: "won-1", source: [93, 128, 367, 346], anchor: [256, 472], box: [8, 139, 363, 342] },
      { name: "won-2", source: [644, 102, 244, 372], anchor: [768, 472], box: [47, 113, 240, 368] },
      { name: "won-3", source: [1137, 13, 253, 461], anchor: [1280, 472], box: [28, 24, 249, 457] },
      { name: "won-4", source: [87, 503, 261, 483], anchor: [256, 984], box: [2, 2, 257, 479] },
      { name: "won-5", source: [619, 503, 254, 483], anchor: [768, 984], box: [22, 2, 250, 479] },
      { name: "won-6", source: [1158, 560, 235, 426], anchor: [1280, 984], box: [49, 59, 231, 422] },
    ],
  },
  settlers: {
    size: [265, 254],
    anchor: [124, 252],
    frames: [
      { name: "travel-1", source: [22, 50, 229, 197], anchor: [128, 245], box: [20, 59, 225, 193] },
      { name: "travel-2", source: [278, 49, 223, 198], anchor: [384, 245], box: [20, 58, 219, 194] },
      { name: "travel-3", source: [532, 50, 225, 197], anchor: [640, 245], box: [18, 59, 221, 193] },
      { name: "travel-4", source: [788, 50, 229, 197], anchor: [896, 245], box: [18, 59, 225, 193] },
      { name: "travel-5", source: [1043, 50, 224, 197], anchor: [1152, 245], box: [17, 59, 220, 193] },
      { name: "travel-6", source: [1299, 49, 223, 198], anchor: [1408, 245], box: [17, 58, 219, 194] },
      { name: "road-1", source: [12, 319, 235, 183], anchor: [128, 501], box: [10, 72, 231, 179] },
      { name: "road-2", source: [266, 318, 243, 185], anchor: [384, 501], box: [8, 71, 239, 181] },
      { name: "road-3", source: [523, 249, 229, 253], anchor: [640, 501], box: [9, 2, 225, 249] },
      { name: "road-4", source: [777, 322, 246, 181], anchor: [896, 501], box: [7, 75, 242, 177] },
      { name: "road-5", source: [1034, 325, 240, 178], anchor: [1152, 501], box: [8, 78, 236, 174] },
      { name: "road-6", source: [1290, 319, 240, 184], anchor: [1408, 501], box: [8, 72, 236, 180] },
      { name: "irrigate-1", source: [11, 567, 243, 176], anchor: [128, 741], box: [9, 80, 239, 172] },
      { name: "irrigate-2", source: [268, 570, 241, 173], anchor: [384, 741], box: [10, 83, 237, 169] },
      { name: "irrigate-3", source: [518, 587, 245, 156], anchor: [640, 741], box: [4, 100, 241, 152] },
      { name: "irrigate-4", source: [777, 569, 253, 174], anchor: [896, 741], box: [7, 82, 249, 170] },
      { name: "irrigate-5", source: [1034, 574, 254, 169], anchor: [1152, 741], box: [8, 87, 250, 165] },
      { name: "irrigate-6", source: [1290, 569, 232, 174], anchor: [1408, 741], box: [8, 82, 228, 170] },
      { name: "mine-1", source: [11, 825, 245, 174], anchor: [128, 997], box: [9, 82, 241, 170] },
      { name: "mine-2", source: [266, 804, 245, 195], anchor: [384, 997], box: [8, 61, 241, 191] },
      { name: "mine-3", source: [516, 762, 249, 237], anchor: [640, 997], box: [2, 19, 245, 233] },
      { name: "mine-4", source: [777, 838, 253, 161], anchor: [896, 997], box: [7, 95, 249, 157] },
      { name: "mine-5", source: [1033, 854, 260, 145], anchor: [1152, 997], box: [7, 111, 256, 141] },
      { name: "mine-6", source: [1297, 818, 234, 181], anchor: [1408, 997], box: [15, 75, 230, 177] },
    ],
  },
  "settlers-found": {
    size: [533, 491],
    anchor: [274, 489],
    frames: [
      { name: "lift", source: [17, 139, 498, 366], anchor: [256, 503], box: [37, 127, 494, 362] },
      { name: "raise", source: [547, 18, 437, 487], anchor: [768, 503], box: [55, 6, 433, 483] },
      { name: "plant", source: [1042, 14, 367, 491], anchor: [1280, 503], box: [38, 2, 363, 487] },
      { name: "unfurl", source: [18, 521, 467, 481], anchor: [256, 1002], box: [38, 10, 463, 477] },
      { name: "fly", source: [494, 521, 518, 483], anchor: [768, 1002], box: [2, 10, 514, 479] },
      { name: "cheer", source: [1043, 521, 475, 483], anchor: [1280, 1002], box: [39, 10, 471, 479] },
    ],
  },
};
