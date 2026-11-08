// Deterministic synthetic image-reuse benchmark generator (no network, no deps).
//
// 100 pairs of 64x64 8-bit grey PNGs, four categories of 25:
//   duplicate    b replays one 16x16 textured block of a at another grid cell
//   flip         b replays a horizontally or vertically mirrored block of a
//   unrelated    b is an independent random texture, nothing should match
//   hard-negative a/b share the same flat frame and background, but the textured
//                 interior cells are independent, so a detector must stay quiet
//
// Every pixel comes from a seeded PRNG in this file; the PNG encoder is local
// too, so the generator does not import the plugin it scores. Repeated runs
// must be byte-identical: no timestamps, no randomness from the clock, and a
// hand-written stored-block zlib stream rather than a zlib build whose output
// could change between Node releases.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'images')
const casesDir = path.join(outDir, 'cases')

const WIDTH = 64
const HEIGHT = 64
const BLOCK = 16
const GRID = WIDTH / BLOCK
const PER_CATEGORY = 25
const CATEGORIES = ['duplicate', 'flip', 'unrelated', 'hard-negative']
const BASE_SEED = 0x5eed1a6e
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// ── local PNG encoder ───────────────────────────────────────────────────────
// 8-bit grey, no interlace, filter 0. Keeping this local (instead of importing
// encodeGreyPng from the plugin) is deliberate: the benchmark data must not
// depend on the code under test.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC32 of a byte range. */
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Build one PNG chunk. */
function chunk(type, body) {
  const typeBytes = Buffer.from(type, 'latin1')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(body)])), 0)
  return Buffer.concat([length, typeBytes, Buffer.from(body), crc])
}

/** Adler-32 of a byte range, as required by the zlib stream trailer. */
function adler32(bytes) {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

/**
 * Wrap bytes in a zlib stream made of stored (uncompressed) deflate blocks.
 * This is valid zlib that every PNG decoder accepts, and its bytes depend only
 * on the input pixels — not on the zlib version or CPU. The benchmark benefits
 * from reproducibility more than from a few kilobytes of compression.
 */
function storedZlib(raw) {
  const parts = [Buffer.from([0x78, 0x01])]
  let offset = 0
  do {
    const length = Math.min(65535, raw.length - offset)
    const final = offset + length === raw.length ? 1 : 0
    const header = Buffer.alloc(5)
    header[0] = final
    header.writeUInt16LE(length, 1)
    header.writeUInt16LE(~length & 0xffff, 3)
    parts.push(header, Buffer.from(raw.subarray(offset, offset + length)))
    offset += length
  } while (offset < raw.length)
  const trailer = Buffer.alloc(4)
  trailer.writeUInt32BE(adler32(raw), 0)
  parts.push(trailer)
  return Buffer.concat(parts)
}

/** Encode a 64x64 8-bit greyscale PNG, filter 0, deterministic stored zlib. */
function encodeGreyPng(pixels, width, height) {
  if (pixels.length !== width * height) throw new Error('pixel count does not match the dimensions')
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 0
  header[10] = 0
  header[11] = 0
  header[12] = 0
  const raw = Buffer.alloc((width + 1) * height)
  for (let row = 0; row < height; row += 1) {
    raw[row * (width + 1)] = 0
    Buffer.from(pixels.subarray(row * width, (row + 1) * width)).copy(raw, row * (width + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk('IHDR', header),
    chunk('IDAT', storedZlib(raw)),
    chunk('IEND', new Uint8Array(0)),
  ])
}

// ── seeded PRNG ─────────────────────────────────────────────────────────────
// mulberry32. Streams are derived per case and role so adding a case does not
// perturb the images of earlier cases.

/** mulberry32 PRNG. */
function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Independent stream for one (case, role) pair. */
function rngFor(caseNumber, role) {
  let seed = BASE_SEED >>> 0
  seed = (seed ^ Math.imul(caseNumber + 1, 0x9e3779b1)) >>> 0
  seed = (seed ^ Math.imul(role + 1, 0x85ebca6b)) >>> 0
  seed = Math.imul(seed ^ (seed >>> 16), 0x7feb352d) >>> 0
  seed = Math.imul(seed ^ (seed >>> 15), 0x846ca68b) >>> 0
  return mulberry32((seed ^ (seed >>> 16)) >>> 0)
}

// ── image helpers ───────────────────────────────────────────────────────────

/** One 16x16 texture block drawn from `rng`. */
function textureBlock(rng) {
  const block = new Uint8Array(BLOCK * BLOCK)
  for (let index = 0; index < block.length; index += 1) block[index] = 16 + Math.floor(rng() * 224)
  return block
}

/** Paste a block into an image at pixel coordinates. */
function pasteBlock(pixels, originX, originY, block) {
  for (let y = 0; y < BLOCK; y += 1) {
    for (let x = 0; x < BLOCK; x += 1) {
      pixels[(originY + y) * WIDTH + originX + x] = block[y * BLOCK + x]
    }
  }
}

/** Read a block out of an image. */
function readBlock(pixels, originX, originY) {
  const block = new Uint8Array(BLOCK * BLOCK)
  for (let y = 0; y < BLOCK; y += 1) {
    for (let x = 0; x < BLOCK; x += 1) {
      block[y * BLOCK + x] = pixels[(originY + y) * WIDTH + originX + x]
    }
  }
  return block
}

/** Return a mirrored copy of a block. */
function mirrorBlock(block, axis) {
  const mirrored = new Uint8Array(block.length)
  for (let y = 0; y < BLOCK; y += 1) {
    for (let x = 0; x < BLOCK; x += 1) {
      const sourceX = axis === 'horizontal' ? BLOCK - 1 - x : x
      const sourceY = axis === 'vertical' ? BLOCK - 1 - y : y
      mirrored[y * BLOCK + x] = block[sourceY * BLOCK + sourceX]
    }
  }
  return mirrored
}

/** Cell index -> top-left pixel coordinates. */
function cellOrigin(cell) {
  return { x: (cell % GRID) * BLOCK, y: Math.floor(cell / GRID) * BLOCK }
}

/** A 64x64 image made of 16 independent texture blocks. */
function textureImage(caseNumber, role) {
  const pixels = new Uint8Array(WIDTH * HEIGHT)
  const rng = rngFor(caseNumber, role)
  for (let cell = 0; cell < GRID * GRID; cell += 1) {
    const { x, y } = cellOrigin(cell)
    pasteBlock(pixels, x, y, textureBlock(rng))
  }
  return pixels
}

/**
 * A 64x64 image with a flat 16px frame and flat background. Only two interior
 * cells carry texture; the other two interior cells are plain background. The
 * frame is exactly one block thick, so every flat block really is uniform and
 * the detector's variance floor can skip it.
 */
function framedImage(caseNumber, role, frameTone, backgroundTone) {
  const pixels = new Uint8Array(WIDTH * HEIGHT).fill(backgroundTone)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (x < BLOCK || x >= WIDTH - BLOCK || y < BLOCK || y >= HEIGHT - BLOCK) pixels[y * WIDTH + x] = frameTone
    }
  }
  const rng = rngFor(caseNumber, role)
  for (const cell of [GRID + 1, 2 * GRID + 2]) {
    const { x, y } = cellOrigin(cell)
    pasteBlock(pixels, x, y, textureBlock(rng))
  }
  return pixels
}

/** Pick two distinct grid cells. */
function pickCells(rng) {
  const source = Math.floor(rng() * GRID * GRID)
  let destination = Math.floor(rng() * GRID * GRID)
  while (destination === source) destination = Math.floor(rng() * GRID * GRID)
  return { source, destination }
}

// ── case construction ───────────────────────────────────────────────────────

const cases = []
let sequence = 0
const push = (category, description, aPixels, bPixels, expected) => {
  sequence += 1
  cases.push({
    id: `img-${String(sequence).padStart(4, '0')}`,
    category,
    expected,
    description,
    aPixels,
    bPixels,
  })
}

// duplicate: one aligned block of a is copied to a different aligned cell of b.
for (let index = 0; index < PER_CATEGORY; index += 1) {
  const caseNumber = sequence
  const a = textureImage(caseNumber, 1)
  const b = textureImage(caseNumber, 2)
  const { source, destination } = pickCells(rngFor(caseNumber, 3))
  const from = cellOrigin(source)
  const to = cellOrigin(destination)
  pasteBlock(b, to.x, to.y, readBlock(a, from.x, from.y))
  const description =
    `b contains a 16x16 copy of a's textured block at grid cell (${from.x / BLOCK},${from.y / BLOCK}) ` +
    `pasted at grid cell (${to.x / BLOCK},${to.y / BLOCK}); every other block is independent texture.`
  push('duplicate', description, a, b, { manipulated: true, kind: 'duplicate' })
}

// flip: one aligned block of a is mirrored and pasted into b elsewhere.
for (let index = 0; index < PER_CATEGORY; index += 1) {
  const caseNumber = sequence
  const axis = index % 2 === 0 ? 'horizontal' : 'vertical'
  const a = textureImage(caseNumber, 1)
  const b = textureImage(caseNumber, 2)
  const { source, destination } = pickCells(rngFor(caseNumber, 3))
  const from = cellOrigin(source)
  const to = cellOrigin(destination)
  pasteBlock(b, to.x, to.y, mirrorBlock(readBlock(a, from.x, from.y), axis))
  const description =
    `b contains a ${axis}ly mirrored copy of a's textured block at grid cell ` +
    `(${from.x / BLOCK},${from.y / BLOCK}) pasted at grid cell (${to.x / BLOCK},${to.y / BLOCK}); ` +
    'every other block is independent texture.'
  push('flip', description, a, b, { manipulated: true, kind: `${axis}-flip` })
}

// unrelated: both images are independent full textures.
for (let index = 0; index < PER_CATEGORY; index += 1) {
  const caseNumber = sequence
  push(
    'unrelated',
    'a and b are independent random textures; no textured block of a occurs in b.',
    textureImage(caseNumber, 1),
    textureImage(caseNumber, 2),
    { manipulated: false, kind: null },
  )
}

// hard-negative: identical flat frame/background, independent textured cells.
for (let index = 0; index < PER_CATEGORY; index += 1) {
  const caseNumber = sequence
  const tones = rngFor(caseNumber, 4)
  const frameTone = 24 + Math.floor(tones() * 72)
  const backgroundTone = 200 + Math.floor(tones() * 48)
  push(
    'hard-negative',
    'a and b share the same flat frame colour and flat background; their two textured interior cells are independent, so no textured block repeats.',
    framedImage(caseNumber, 1, frameTone, backgroundTone),
    framedImage(caseNumber, 2, frameTone, backgroundTone),
    { manipulated: false, kind: null },
  )
}

// ── write ───────────────────────────────────────────────────────────────────

if (cases.length !== CATEGORIES.length * PER_CATEGORY) throw new Error(`expected 100 cases, got ${cases.length}`)

// Rebuild the case tree from scratch. `casesDir` is a literal child of
// `outDir`, checked before the recursive removal so stale directories from an
// older run cannot survive and unrelated files cannot be touched.
const resolvedOut = path.resolve(outDir)
const resolvedCases = path.resolve(casesDir)
if (path.dirname(resolvedCases) !== resolvedOut || path.basename(resolvedCases) !== 'cases') {
  throw new Error(`refusing to clear unexpected case directory ${resolvedCases}`)
}
rmSync(resolvedCases, { recursive: true, force: true })
mkdirSync(resolvedCases, { recursive: true })

const byCategory = {}
const byExpectedKind = {}
for (const item of cases) {
  const directory = path.join(resolvedCases, item.id)
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'a.png'), encodeGreyPng(item.aPixels, WIDTH, HEIGHT))
  writeFileSync(path.join(directory, 'b.png'), encodeGreyPng(item.bPixels, WIDTH, HEIGHT))
  byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
  const kindKey = item.expected.kind ?? 'none'
  byExpectedKind[kindKey] = (byExpectedKind[kindKey] ?? 0) + 1
}

const summary = {
  dataset: 'images',
  version: '0.1.0',
  total: cases.length,
  byCategory,
  byExpectedKind,
  image: {
    width: WIDTH,
    height: HEIGHT,
    format: '8-bit greyscale PNG',
    blockSize: BLOCK,
    grid: `${GRID}x${GRID}`,
    colors: 256,
  },
  labelSpace: {
    manipulated: [true, false],
    kind: ['duplicate', 'horizontal-flip', 'vertical-flip', null],
  },
  synthetic: true,
  groundTruth:
    'Category and expected kind are assigned by this generator at construction time; a detector output is never used as a label.',
  schema: 'data/images/schema.json',
}

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://raw.githubusercontent.com/PerryLink/dsh-research-bench/main/data/images/schema.json',
  title: 'Synthetic image-reuse benchmark case',
  description:
    'One line of data/images/cases.jsonl. The image files are data/images/cases/<id>/a.png and b.png (64x64, 8-bit grey). Labels come from the generator, never from a plugin.',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'category', 'expected', 'description'],
  properties: {
    id: { type: 'string', pattern: '^img-[0-9]{4}$' },
    category: { enum: CATEGORIES },
    description: { type: 'string', minLength: 1, maxLength: 500 },
    expected: {
      type: 'object',
      additionalProperties: false,
      required: ['manipulated', 'kind'],
      properties: {
        manipulated: { type: 'boolean' },
        kind: { enum: ['duplicate', 'horizontal-flip', 'vertical-flip', null] },
      },
    },
  },
  allOf: [
    {
      if: { properties: { category: { const: 'duplicate' } }, required: ['category'] },
      then: {
        properties: {
          expected: { properties: { manipulated: { const: true }, kind: { const: 'duplicate' } } },
        },
      },
    },
    {
      if: { properties: { category: { const: 'flip' } }, required: ['category'] },
      then: {
        properties: {
          expected: {
            properties: { manipulated: { const: true }, kind: { enum: ['horizontal-flip', 'vertical-flip'] } },
          },
        },
      },
    },
    {
      if: { properties: { category: { enum: ['unrelated', 'hard-negative'] } }, required: ['category'] },
      then: {
        properties: {
          expected: { properties: { manipulated: { const: false }, kind: { const: null } } },
        },
      },
    },
  ],
}

const records = cases.map(({ id, category, expected, description }) => ({ id, category, expected, description }))
writeFileSync(path.join(outDir, 'cases.jsonl'), `${records.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8')
writeFileSync(path.join(outDir, 'SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
writeFileSync(path.join(outDir, 'schema.json'), `${JSON.stringify(schema, null, 2)}\n`, 'utf8')
console.log(`images: ${records.length} cases -> ${path.relative(root, path.join(outDir, 'cases.jsonl'))}`)
console.log(JSON.stringify(byCategory))
