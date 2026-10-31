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
  "settlers-travel": {
    size: [485, 345],
    anchor: [217, 343],
    frames: [
      { name: "travel-1", source: [39, 113, 471, 344], anchor: [256, 456], box: [2, 2, 467, 340] },
      { name: "travel-2", source: [546, 113, 466, 345], anchor: [763, 456], box: [2, 2, 462, 341] },
      { name: "travel-3", source: [1051, 113, 445, 345], anchor: [1258, 456], box: [12, 2, 441, 341] },
      { name: "travel-4", source: [40, 583, 485, 344], anchor: [257, 925], box: [2, 3, 481, 340] },
      { name: "travel-5", source: [553, 583, 471, 344], anchor: [764, 925], box: [8, 3, 467, 340] },
      { name: "travel-6", source: [1055, 583, 449, 344], anchor: [1258, 925], box: [16, 3, 445, 340] },
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
  phalanx: {
    size: [385, 258],
    anchor: [172, 256],
    frames: [
      { name: "travel-1", source: [50, 5, 152, 242], anchor: [150, 246], box: [74, 17, 148, 238] },
      { name: "travel-2", source: [305, 5, 140, 243], anchor: [393, 246], box: [86, 17, 136, 239] },
      { name: "travel-3", source: [549, 5, 154, 242], anchor: [652, 246], box: [71, 17, 150, 238] },
      { name: "travel-4", source: [815, 5, 137, 243], anchor: [901, 246], box: [88, 17, 133, 239] },
      { name: "travel-5", source: [1061, 5, 148, 243], anchor: [1156, 246], box: [79, 17, 144, 239] },
      { name: "travel-6", source: [1321, 5, 134, 243], anchor: [1403, 246], box: [92, 17, 130, 239] },
      { name: "ready", source: [30, 282, 171, 219], anchor: [134, 499], box: [70, 41, 167, 215] },
      { name: "anticipation", source: [252, 268, 217, 232], anchor: [389, 499], box: [37, 27, 213, 228] },
      { name: "wind-up", source: [481, 278, 233, 222], anchor: [653, 499], box: [2, 37, 229, 218] },
      { name: "strike", source: [758, 306, 319, 194], anchor: [864, 499], box: [68, 65, 315, 190] },
      { name: "follow-through", source: [1076, 278, 195, 222], anchor: [1193, 499], box: [57, 37, 191, 218] },
      { name: "recovery", source: [1321, 294, 170, 207], anchor: [1426, 499], box: [69, 53, 166, 203] },
      { name: "won-1", source: [50, 518, 139, 246], anchor: [131, 763], box: [93, 13, 135, 242] },
      { name: "won-2", source: [296, 508, 153, 256], anchor: [382, 763], box: [88, 3, 149, 252] },
      { name: "won-3", source: [521, 507, 189, 257], anchor: [651, 763], box: [44, 2, 185, 253] },
      { name: "won-4", source: [775, 507, 218, 256], anchor: [896, 763], box: [53, 2, 214, 252] },
      { name: "won-5", source: [1030, 507, 237, 258], anchor: [1159, 763], box: [45, 2, 233, 254] },
      { name: "won-6", source: [1312, 508, 206, 257], anchor: [1426, 763], box: [60, 3, 202, 253] },
      { name: "sentry-1", source: [53, 771, 135, 242], anchor: [128, 1015], box: [99, 14, 131, 238] },
      { name: "sentry-2", source: [305, 771, 138, 242], anchor: [383, 1015], box: [96, 14, 134, 238] },
      { name: "sentry-3", source: [567, 771, 138, 242], anchor: [644, 1015], box: [97, 14, 134, 238] },
      { name: "lowering", source: [784, 783, 175, 231], anchor: [896, 1015], box: [62, 26, 171, 227] },
      { name: "kneeling", source: [1031, 840, 238, 177], anchor: [1152, 1015], box: [53, 83, 234, 173] },
      { name: "shield-wall", source: [1292, 849, 235, 168], anchor: [1408, 1015], box: [58, 92, 231, 164] },
    ],
  },
  catapult: {
    size: [273, 236],
    anchor: [127, 234],
    frames: [
      { name: "travel-1", source: [6, 50, 247, 163], anchor: [127, 211], box: [8, 75, 243, 159] },
      { name: "travel-2", source: [261, 50, 249, 163], anchor: [385, 211], box: [5, 75, 245, 159] },
      { name: "travel-3", source: [516, 50, 250, 163], anchor: [642, 211], box: [3, 75, 246, 159] },
      { name: "travel-4", source: [774, 45, 249, 168], anchor: [898, 211], box: [5, 70, 245, 164] },
      { name: "travel-5", source: [1035, 45, 240, 168], anchor: [1156, 211], box: [8, 70, 236, 164] },
      { name: "travel-6", source: [1284, 50, 249, 163], anchor: [1408, 211], box: [5, 75, 245, 159] },
      { name: "ready", source: [16, 251, 235, 233], anchor: [128, 485], box: [17, 2, 231, 229] },
      { name: "anticipation", source: [268, 306, 247, 181], anchor: [389, 485], box: [8, 57, 243, 177] },
      { name: "wind-up", source: [536, 334, 238, 153], anchor: [653, 485], box: [12, 85, 234, 149] },
      { name: "strike", source: [784, 328, 241, 159], anchor: [903, 485], box: [10, 79, 237, 155] },
      { name: "follow-through", source: [1027, 274, 273, 208], anchor: [1154, 485], box: [2, 25, 269, 204] },
      { name: "recovery", source: [1277, 309, 250, 173], anchor: [1394, 485], box: [12, 60, 246, 169] },
      { name: "won-1", source: [6, 565, 247, 166], anchor: [128, 729], box: [7, 72, 243, 162] },
      { name: "won-2", source: [281, 563, 229, 168], anchor: [386, 729], box: [24, 70, 225, 164] },
      { name: "won-3", source: [536, 565, 230, 166], anchor: [643, 729], box: [22, 72, 226, 162] },
      { name: "won-4", source: [777, 565, 241, 166], anchor: [899, 729], box: [7, 72, 237, 162] },
      { name: "won-5", source: [1056, 565, 220, 166], anchor: [1146, 729], box: [39, 72, 216, 162] },
      { name: "won-6", source: [1302, 565, 232, 166], anchor: [1397, 729], box: [34, 72, 228, 162] },
      { name: "sentry-1", source: [13, 792, 240, 176], anchor: [128, 966], box: [14, 62, 236, 172] },
      { name: "sentry-2", source: [268, 792, 242, 175], anchor: [383, 966], box: [14, 62, 238, 171] },
      { name: "sentry-3", source: [519, 792, 247, 176], anchor: [640, 966], box: [8, 62, 243, 172] },
      { name: "fortify-1", source: [779, 792, 242, 176], anchor: [894, 966], box: [14, 62, 238, 172] },
      { name: "fortify-2", source: [1036, 792, 240, 175], anchor: [1150, 966], box: [15, 62, 236, 171] },
      { name: "fortify-3", source: [1294, 792, 238, 175], anchor: [1407, 966], box: [16, 62, 234, 171] },
    ],
  },
};
