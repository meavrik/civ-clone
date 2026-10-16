import { deflateSync, inflateSync } from "node:zlib";

/**
 * Minimal PNG reader and writer for sprite sheets: 8-bit RGB, RGBA, grey,
 * grey+alpha and palette images, non-interlaced, every filter type. Enough
 * for what Aseprite, Piskel, GIMP and Photoshop save for pixel art.
 */
export interface Image {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(bytes: Uint8Array): Image {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new Error("not a PNG file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let palette: Uint8Array | null = null;
  let alpha: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (pos < bytes.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === "IHDR") {
      width = view.getUint32(pos - 12 - len + 8);
      height = view.getUint32(pos - 12 - len + 12);
      depth = body[8]!;
      colorType = body[9]!;
      if (body[12] !== 0) throw new Error("interlaced PNGs are not supported; save without interlacing");
    } else if (type === "PLTE") palette = body.slice();
    else if (type === "tRNS") alpha = body.slice();
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
  }
  if (depth !== 8) throw new Error(`only 8-bit PNGs are supported (this one is ${depth}-bit)`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType as 0 | 2 | 3 | 4 | 6];
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`);
  const total = idat.reduce((n, c) => n + c.length, 0);
  const joined = new Uint8Array(total);
  let off = 0;
  for (const c of idat) { joined.set(c, off); off += c.length; }
  const raw = inflateSync(joined);
  const stride = width * channels;
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[dst + x - channels]! : 0;
      const b = y > 0 ? px[dst - stride + x]! : 0;
      const c = x >= channels && y > 0 ? px[dst - stride + x - channels]! : 0;
      const v = raw[src + x]!;
      px[dst + x] = (filter === 0 ? v : filter === 1 ? v + a : filter === 2 ? v + b : filter === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 0xff;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (colorType === 6) data.set(px.subarray(i * 4, i * 4 + 4), o);
    else if (colorType === 2) { data.set(px.subarray(i * 3, i * 3 + 3), o); data[o + 3] = 255; }
    else if (colorType === 0) { data[o] = data[o + 1] = data[o + 2] = px[i]!; data[o + 3] = 255; }
    else if (colorType === 4) { data[o] = data[o + 1] = data[o + 2] = px[i * 2]!; data[o + 3] = px[i * 2 + 1]!; }
    else {
      const k = px[i]!;
      if (!palette || k * 3 + 2 >= palette.length) throw new Error("palette PNG without a matching palette");
      data[o] = palette[k * 3]!;
      data[o + 1] = palette[k * 3 + 1]!;
      data[o + 2] = palette[k * 3 + 2]!;
      data[o + 3] = alpha && k < alpha.length ? alpha[k]! : 255;
    }
  }
  return { width, height, data };
}

/** RGBA PNG; `filter` picks one row filter for every row (tests use it to exercise the reader). */
export function encodePng(img: Image, filter: 0 | 1 | 2 | 3 | 4 = 0): Uint8Array {
  const { width, height, data } = img;
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = filter;
    for (let x = 0; x < stride; x++) {
      const v = data[y * stride + x]!;
      const a = x >= 4 ? data[y * stride + x - 4]! : 0;
      const b = y > 0 ? data[(y - 1) * stride + x]! : 0;
      const c = x >= 4 && y > 0 ? data[(y - 1) * stride + x - 4]! : 0;
      const p = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
      raw[y * (stride + 1) + 1 + x] = (v - p) & 0xff;
    }
  }
  const chunk = (type: string, body: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + body.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, body.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(body, 8);
    dv.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [new Uint8Array(SIGNATURE), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
