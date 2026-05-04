// Vision-based SEO generator cho Etsy digital products.
// 1 Claude vision call → trả về JSON { title, tags } cho cả 2 cùng lúc.
//
// Title: 130-140 ký tự, Title Case, đuôi SVG/PNG, TRÁNH trademark
// Tags: đúng 13 tags, mỗi tag ≤20 ký tự, CÓ THỂ chứa trademark

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MAX_TOKENS = 800
// Sản phẩm CHỈ là PNG sublimation (không có SVG/DXF/EPS)
const FILE_FORMAT_KEYWORDS = ['PNG']
const TAG_COUNT = 13
const TAG_MAX_LEN = 20

// Hai danh sách TM khác nhau cho title và tags:
// - TITLE: cấm RỘNG (tất cả TM lớn) → AI phải mô tả bằng từ generic
// - TAGS: chỉ cấm 5 brand cụ thể → các TM khác được dùng để bắt search query
//
// Match theo word-boundary (pad space + thay -/_ thành space) để tránh
// false-positive kiểu "thor" dính "author" hay "pluto" dính "plutonium".

const BANNED_TM_TAGS = [
  'hello kitty',
  'bluey',
  'harry potter',
  'snoopy',
  'nfl'
]

const BANNED_TM_TITLE = [
  // 5 cấm tuyệt đối (cũng cấm trong tags)
  ...BANNED_TM_TAGS,
  // Sanrio family
  'sanrio', 'my melody', 'kuromi', 'cinnamoroll', 'pompompurin',
  'chococat', 'gudetama', 'pochacco', 'badtz maru', 'aggretsuko',
  // Bluey family
  'bingo heeler', 'bandit heeler', 'chilli heeler',
  // Disney
  'disney', 'mickey mouse', 'minnie mouse', 'donald duck', 'daisy duck',
  'goofy', 'pluto', 'frozen disney', 'elsa frozen', 'olaf frozen',
  'anna disney', 'stitch disney', 'lilo and stitch', 'lilo stitch',
  'lion king', 'simba', 'mufasa', 'ariel mermaid', 'little mermaid',
  'belle disney', 'jasmine disney', 'rapunzel', 'tangled',
  'snow white', 'cinderella', 'moana', 'encanto', 'mirabel',
  'mulan', 'pocahontas', 'aladdin', 'tiana', 'tinkerbell',
  'aurora disney', 'bambi', 'dumbo',
  // Pixar
  'pixar', 'toy story', 'woody pixar', 'buzz lightyear',
  'lightning mcqueen', 'finding nemo', 'finding dory', 'baymax',
  'big hero', 'monsters inc', 'mike wazowski', 'sully pixar',
  'incredibles', 'ratatouille', 'wall-e', 'walle',
  // Marvel
  'marvel', 'spider-man', 'spiderman', 'spider man', 'iron man',
  'ironman', 'captain america', 'hulk marvel', 'incredible hulk',
  'thor marvel', 'avengers', 'x-men', 'xmen', 'deadpool', 'wolverine',
  'black widow', 'black panther', 'doctor strange', 'ant-man', 'antman',
  'guardians galaxy', 'star lord', 'groot', 'thanos', 'loki marvel',
  // DC
  'batman', 'superman', 'wonder woman', 'aquaman', 'green lantern',
  'flash dc', 'justice league', 'harley quinn',
  // Pokemon
  'pokemon', 'pokémon', 'pikachu', 'charizard', 'eevee', 'bulbasaur',
  'squirtle', 'mewtwo', 'snorlax', 'jigglypuff',
  // Peanuts
  'peanuts', 'charlie brown', 'woodstock peanuts',
  // Looney Tunes
  'bugs bunny', 'daffy duck', 'looney tunes', 'tweety bird',
  'sylvester cat', 'porky pig', 'taz devil', 'roadrunner',
  // Star Wars
  'star wars', 'yoda', 'baby yoda', 'grogu', 'mandalorian',
  'darth vader', 'jedi', 'wookie', 'chewbacca', 'r2d2', 'r2-d2', 'bb-8',
  'kylo ren', 'storm trooper',
  // Nintendo
  'super mario', 'mario bros', 'luigi mario', 'princess peach',
  'donkey kong', 'legend of zelda', 'zelda link', 'kirby nintendo',
  'pacman', 'pac-man', 'pac man',
  // Sega
  'sonic hedgehog', 'sonic the hedgehog',
  // Wizarding World
  'hogwarts', 'gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff',
  'hermione', 'dumbledore', 'voldemort', 'wizarding world',
  // LOTR
  'gandalf', 'frodo', 'hobbit', 'middle earth', 'lord of the rings',
  // Cartoon Network / Nick
  'paw patrol', 'peppa pig', 'paddington bear', 'spongebob',
  'patrick star', 'garfield cat', 'smurfs', 'tom and jerry',
  'scooby doo', 'scoobydoo', 'scooby-doo', 'powerpuff',
  // Anime
  'naruto', 'sasuke', 'sailor moon', 'son goku', 'dragon ball',
  'one piece luffy', 'attack on titan', 'demon slayer', 'tanjiro',
  'jujutsu kaisen', 'gojo satoru',
  // Sport leagues
  'nba', 'mlb', 'nhl', 'super bowl',
  // Gaming / TV / Misc
  'minecraft', 'fortnite', 'roblox', 'among us', 'angry birds',
  'sesame street', 'elmo', 'cookie monster', 'barbie',
  'transformers', 'optimus prime', 'tmnt', 'ninja turtle'
]

function tmMatches(text, list) {
  if (!text) return false
  const normalized = ` ${String(text)
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')} `
  return list.some(kw => normalized.includes(` ${kw.trim()} `))
}

export function containsTagTM(text) {
  return tmMatches(text, BANNED_TM_TAGS)
}

export function containsTitleTM(text) {
  return tmMatches(text, BANNED_TM_TITLE)
}

// Back-compat: gọi `containsTM` mặc định check theo TAG list (hành vi cũ).
export const containsTM = containsTagTM

export const BANNED_TM_TAG_DISPLAY = [
  'Hello Kitty', 'Bluey', 'Harry Potter', 'Snoopy', 'NFL'
]

export const TITLE_LENGTHS = {
  default: {
    minLen: 130,
    maxLen: 140,
    promptRange: '130-140',
    example:
      'Cute Cat Kawaii Animal PNG Bundle, Funny Cartoon Clipart Pet Designs, Birthday Party Theme Decoration, Cricut Sublimation Cut Files PNG'
  }
}

function buildSystemPrompt(spec) {
  return `Bạn là chuyên gia SEO cho Etsy store bán PNG sublimation designs (digital download cho áo, mug, tote, sticker…).
Sản phẩm CHỈ ở format PNG (KHÔNG có SVG, DXF, EPS).

Khi user gửi ảnh sản phẩm, hãy phân tích kỹ ảnh và trả về DUY NHẤT một JSON object:

{
  "title": "...",
  "tags": ["...", "...", ...]
}

================ QUY TẮC TM (RẤT QUAN TRỌNG) ================

🚫 TITLE: TUYỆT ĐỐI KHÔNG có bất kỳ tên trademark/nhân vật bản quyền nào.
Bao gồm Disney, Mickey/Minnie Mouse, Donald, Goofy, Pluto, Frozen, Elsa, Olaf, Stitch, Lilo, Lion King, Simba, Ariel, Belle, Jasmine, Rapunzel, Cinderella, Snow White, Moana, Encanto, Mirabel, Toy Story, Woody, Buzz Lightyear, Lightning McQueen, Finding Nemo, Baymax, Pixar, Marvel, Spider-Man, Iron Man, Captain America, Hulk, Thor, Avengers, X-Men, Deadpool, Black Panther, Doctor Strange, Batman, Superman, Wonder Woman, Pokemon, Pikachu, Charizard, Eevee, Snoopy, Peanuts, Charlie Brown, Bugs Bunny, Daffy Duck, Looney Tunes, Star Wars, Yoda, Baby Yoda, Grogu, Mandalorian, Darth Vader, Mario, Luigi, Princess Peach, Donkey Kong, Zelda, Kirby, Sonic, Hello Kitty, Sanrio, My Melody, Kuromi, Cinnamoroll, Bluey, Harry Potter, Hogwarts, Gandalf, Frodo, Paw Patrol, Peppa Pig, SpongeBob, Garfield, Smurfs, Tom and Jerry, Scooby Doo, Naruto, Goku, Dragon Ball, Sailor Moon, NFL, NBA, MLB, NHL, Minecraft, Fortnite, Roblox, Sesame Street, Elmo, Barbie, Transformers, Optimus Prime, TMNT...
Title PHẢI mô tả nhân vật bằng từ generic an toàn — đó là TM-safe Etsy SEO.

✅ TAGS: ĐƯỢC PHÉP chứa hầu hết TM (Disney, Mickey, Marvel, Pokemon, Star Wars, Mario, Sonic, Sanrio characters khác, SpongeBob, Peppa Pig...) vì tags hidden từ buyer-facing display, dùng để match search query.

🚫 NGOẠI LỆ — 5 TM SAU CẤM TUYỆT ĐỐI TRONG CẢ TITLE VÀ TAGS:
1. Hello Kitty
2. Bluey
3. Harry Potter
4. Snoopy
5. NFL

================ MAPPING GENERIC AN TOÀN ================

Cho TITLE (và cho cả 5 TM cấm trong tags), thay tên TM bằng generic:
  · Mickey Mouse → "Cartoon Mouse" / "Cute Mouse Ears"
  · Hello Kitty → "Cute Kitty Cat" / "Kawaii Cat" / "Pink Cat"
  · Stitch → "Blue Alien" / "Cute Monster"
  · Pokemon / Pikachu → "Cute Monster" / "Anime Creature" / "Yellow Mouse"
  · Disney Princess → "Fairytale Princess" / "Cartoon Princess"
  · Frozen / Elsa → "Ice Queen" / "Snow Princess"
  · Spider-Man → "Superhero" / "Web Hero"
  · Bluey → "Blue Cartoon Dog" / "Cute Heeler Dog" / "Blue Puppy"
  · Harry Potter → "Wizard School" / "Magic Wizard" / "Wizardry"
  · Snoopy → "Cartoon Beagle Dog" / "White Cute Dog"
  · NFL → "American Football" / "Football Team"
  · Mario → "Plumber Hero" / "Cartoon Plumber"
  · SpongeBob → "Yellow Sponge"
  · Yoda / Baby Yoda → "Tiny Green Alien" / "Galaxy Baby"

================ TITLE RULES ================
Format: [Key chính], [Key phụ 1], [Key phụ 2], ..., [Key CUỐI kết thúc bằng PNG]

⚠️ RULE QUAN TRỌNG NHẤT: cụm sau dấu phẩy CUỐI CÙNG BẮT BUỘC chứa "PNG".
Sản phẩm chỉ là PNG sublimation, KHÔNG có SVG/DXF/EPS — không được nhắc SVG/DXF/EPS ở đâu trong title.
Nếu PNG nằm ở giữa title mà không lặp lại ở cuối → SAI FORMAT. Cụm CUỐI BẮT BUỘC kết thúc bằng PNG.

❌ SAI: "Holy Bass Funny Fishing PNG, Humor Fish Clipart Cut File, Bass Fish Download" (cụm cuối không có PNG)
❌ SAI: "Holy Bass Funny Fishing SVG, Humor Fish Clipart, Bass Fishing PNG" (có SVG — sản phẩm chỉ PNG)
✅ ĐÚNG: "Holy Bass Funny Fishing Humor, Fish Clipart Cut File Designs, Bass Fishing Sublimation PNG" (cụm cuối có PNG, không có SVG)

Other rules:
- Độ dài: ${spec.promptRange} ký tự (đếm cả dấu phẩy và khoảng trắng) — BẮT BUỘC nằm trong khoảng này
- 3-5 cụm từ khoá phân cách bằng dấu phẩy
- Title Case (viết hoa chữ cái đầu mỗi từ chính)
- Có thể đưa dịp lễ/theme (Christmas, Halloween, Valentine, Birthday, 4th Of July...) vào 1 cụm
- Có thể đưa từ khoá tool/mục đích (Sublimation, Print On Demand, Iron On, Tshirt Design, Mug Design, Tote Bag, Sticker, Digital Download...) vào 1 cụm
- Không emoji, không ký tự đặc biệt (chỉ chữ, số, khoảng trắng, dấu phẩy)
- 🚫 Generic 100% — không có TM nào (trừ trong tags)
- 🚫 KHÔNG nhắc SVG, DXF, EPS — chỉ dùng PNG

================ TAGS RULES ================
- Đúng ${TAG_COUNT} tags (không thiếu, không thừa)
- Mỗi tag tối đa ${TAG_MAX_LEN} ký tự (đếm cả khoảng trắng)
- Lowercase
- Tag là cụm từ 2-3 từ (multi-word) — Etsy SEO ưu tiên long-tail
- Không trùng nhau, không stop-word đơn lẻ ("art", "cute", "png" đứng 1 mình)
- Phủ rộng: style, theme, dịp, đối tượng, mục đích sử dụng (sublimation/iron on/print on demand/sticker/mug/tshirt), từ khoá file
- 🚫 KHÔNG dùng "svg", "dxf", "eps" trong tag — sản phẩm chỉ PNG
- ✅ Được dùng tên TM (Disney, Mickey, Marvel, Pokemon, Star Wars, Mario, Sanrio characters khác...) nếu ảnh có
- 🚫 KHÔNG được chứa 5 TM cấm: Hello Kitty / Bluey / Harry Potter / Snoopy / NFL

================ OUTPUT ================
CHỈ trả về JSON object, KHÔNG markdown fence, KHÔNG giải thích.

Ví dụ với ảnh Mickey Mouse (Mickey CẤM trong title, ĐƯỢC trong tags):

{
  "title": "Cartoon Mouse Ears Bundle Cute Designs, Birthday Party Theme Clipart, Magical Castle Princess Decor, Cricut Sublimation Cut Files PNG",
  "tags": [
    "mickey mouse png",
    "disney bundle",
    "mickey ears png",
    "disney clipart",
    "mickey png file",
    "disney printable",
    "mickey birthday",
    "mouse ears png",
    "disney sublimation",
    "mickey digital",
    "mickey print art",
    "disney party png",
    "mickey iron on"
  ]
}

Ví dụ với ảnh Hello Kitty (CẤM TUYỆT ĐỐI ở cả 2 — đổi hết sang generic):

{
  "title": "Cute Kitty Cat Kawaii Bundle, Pink Flower Animal Clipart Designs, Birthday Party Theme Decoration, Cricut Sublimation Cut Files PNG",
  "tags": [
    "kawaii cat png", "cute kitty png", "kitty clipart", "pink cat png",
    "kawaii bundle", "japanese cat png", "girly stickers", "cat sublimation",
    "kitty digital", "cat png file", "cute kawaii png", "cartoon cat png", "anime cat png"
  ]
}`
}

function buildRetryInstruction() {
  return `JSON vừa rồi không hợp lệ. Có thể vì 1 trong các lý do:
1. Title không có PNG ở cụm CUỐI (sau dấu phẩy cuối). Phải có dạng "..., [Cụm cuối kết thúc PNG]"
2. Title nhắc SVG/DXF/EPS — sản phẩm CHỈ PNG sublimation, không được nhắc các format khác
3. Title sai length (cần 130-140 ký tự)
4. Title chứa tên trademark
5. Tags không đủ 13 / có tag > 20 ký tự / chứa 5 TM cấm / có "svg" trong tag

Trả lại JSON đúng:
- "title": 130-140 ký tự. CỤM CUỐI sau dấu phẩy cuối BẮT BUỘC kết thúc bằng PNG. KHÔNG nhắc SVG/DXF/EPS bất cứ đâu. KHÔNG có TM. Generic 100%.
- "tags": ĐÚNG 13 tags, mỗi ≤20 ký tự, lowercase, KHÔNG có "svg"/"dxf"/"eps". TM khác (Disney/Mickey/Marvel/Pokemon) được phép. KHÔNG có 5 TM cấm.

VD đúng cụm cuối: "..., Cricut Cut Files PNG" hoặc "..., Bass Fishing Sublimation PNG".
VD sai cụm cuối: "..., Bass Fish Download" (không có PNG).
VD sai có SVG: "..., Sublimation SVG" (sản phẩm chỉ PNG, không được có SVG).

Chỉ trả về JSON, không giải thích.`
}

const USER_INSTRUCTION =
  'Phân tích ảnh và sinh JSON {title, tags} theo đúng quy định.'

function buildDedupInstruction(priorTitles) {
  const list = priorTitles.map(t => `- ${t}`).join('\n')
  return `\n\nĐã dùng các title sau cho sản phẩm NÀY rồi (tránh trùng):\n${list}\n\nViết title MỚI khác hẳn (đổi thứ tự cụm, đổi synonym Bundle↔Collection↔Pack…). Tags có thể giữ tương tự nhưng đảo thứ tự.`
}

// --- Normalize / validate ----------------------------------------------

const QUOTE_PAIRS = [
  ['"', '"'],
  ["'", "'"],
  ['`', '`'],
  ['“', '”'],
  ['‘', '’']
]

function normalizeTitle(raw) {
  let s = (raw || '').trim().replace(/\.+$/, '')
  for (const [open, close] of QUOTE_PAIRS) {
    if (s.length >= 2 && s.startsWith(open) && s.endsWith(close)) {
      s = s.slice(1, -1).trim().replace(/\.+$/, '')
      break
    }
  }
  return s.split(/\s+/).join(' ')
}

function normalizeTag(t) {
  return String(t || '')
    .trim()
    .replace(/[^\w\s-]/g, '') // bỏ ký tự đặc biệt, giữ chữ/số/space/dash
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, TAG_MAX_LEN)
}

function dedupTags(tags) {
  const seen = new Set()
  const out = []
  for (const t of tags) {
    if (!t) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export function validateTitle(title, lengthMode = 'default') {
  const spec = TITLE_LENGTHS[lengthMode] || TITLE_LENGTHS.default
  if (!title) return false
  if (containsTitleTM(title)) return false
  const commaCount = (title.match(/,/g) || []).length
  if (commaCount < 2 || commaCount > 5) return false
  if (title.length < spec.minLen || title.length > spec.maxLen) return false
  const lastPart = title.split(',').pop().trim().toUpperCase()
  return FILE_FORMAT_KEYWORDS.some(kw => lastPart.includes(kw))
}

export function validateTags(tags) {
  if (!Array.isArray(tags)) return false
  if (tags.length !== TAG_COUNT) return false
  const seen = new Set()
  for (const t of tags) {
    if (!t || typeof t !== 'string') return false
    if (t.length === 0 || t.length > TAG_MAX_LEN) return false
    if (seen.has(t)) return false
    if (containsTagTM(t)) return false
    seen.add(t)
  }
  return true
}

// Loại bỏ tags chứa 5 TM cấm — dùng trước khi validate để cho retry chance
export function stripTMTags(tags) {
  return (tags || []).filter(t => !containsTagTM(t))
}

// --- Extract JSON from raw model output --------------------------------

function extractJSON(text) {
  if (!text) throw new Error('Empty response')
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fence ? fence[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found')
  return JSON.parse(candidate.slice(start, end + 1))
}

// --- Image → base64 ----------------------------------------------------

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function imageBlobForVision(blob, maxDim = 1024) {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = reject
      im.src = url
    })
    const w = img.naturalWidth
    const h = img.naturalHeight
    const ratio = Math.min(1, maxDim / Math.max(w, h))
    const cw = Math.max(1, Math.round(w * ratio))
    const ch = Math.max(1, Math.round(h * ratio))
    const c = document.createElement('canvas')
    c.width = cw
    c.height = ch
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, cw, ch)
    const out = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

// --- Claude vision call -----------------------------------------------

async function callClaudeVision({
  apiKey,
  model,
  imageB64,
  mediaType,
  systemPrompt,
  userText
}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageB64
              }
            },
            { type: 'text', text: userText }
          ]
        }
      ]
    })
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Claude ${res.status}: ${text || res.statusText}`)
  }
  const data = await res.json()
  let text = ''
  for (const block of data.content || []) {
    if (block.type === 'text') {
      text = (block.text || '').trim()
      break
    }
  }
  return {
    text,
    usage: data.usage || {},
    model: data.model || model
  }
}

// --- Public entrypoint -------------------------------------------------

export async function generateSEO({
  apiKey,
  imageBlob,
  model = 'claude-sonnet-4-5',
  lengthMode = 'default',
  priorTitles = [],
  maxRetries = 2,
  onUsage // callback(model, usage) sau mỗi API call để track cost
}) {
  if (!apiKey) throw new Error('Missing Claude API key')
  if (!imageBlob) throw new Error('Missing imageBlob')

  const spec = TITLE_LENGTHS[lengthMode] || TITLE_LENGTHS.default
  const systemPrompt = buildSystemPrompt(spec)
  const retryInstruction = buildRetryInstruction()

  const small = await imageBlobForVision(imageBlob, 1024)
  const imageB64 = await blobToBase64(small)
  const mediaType = small.type || 'image/jpeg'

  const dedupSuffix =
    priorTitles && priorTitles.length ? buildDedupInstruction(priorTitles) : ''
  const priorSet = new Set(priorTitles || [])

  let lastTitle = ''
  let lastTags = []
  let lastRaw = ''
  let attempts = 0
  const usages = []

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1
    const base = attempt === 0 ? USER_INSTRUCTION : retryInstruction
    const userText = base + dedupSuffix
    const { text: raw, usage, model: actualModel } = await callClaudeVision({
      apiKey,
      model,
      imageB64,
      mediaType,
      systemPrompt,
      userText
    })
    lastRaw = raw
    usages.push({ usage, model: actualModel })
    if (onUsage) {
      try {
        onUsage({ usage, model: actualModel })
      } catch {}
    }

    let parsed
    try {
      parsed = extractJSON(raw)
    } catch {
      continue // try retry
    }

    const title = normalizeTitle(parsed.title || '')
    const rawTags = Array.isArray(parsed.tags)
      ? parsed.tags.map(normalizeTag).filter(Boolean)
      : []
    // Strip tags chứa TM trước khi dedup — nếu count < 13 sẽ trigger retry
    const tags = dedupTags(stripTMTags(rawTags)).slice(0, TAG_COUNT)

    lastTitle = title
    lastTags = tags

    const titleOK = validateTitle(title, lengthMode) && !priorSet.has(title)
    const tagsOK = validateTags(tags)

    if (titleOK && tagsOK) {
      return {
        title,
        tags,
        raw,
        attempts,
        titleValid: true,
        tagsValid: true,
        valid: true,
        model,
        usages
      }
    }
  }

  return {
    title: lastTitle,
    tags: lastTags,
    raw: lastRaw,
    attempts,
    titleValid: validateTitle(lastTitle, lengthMode) && !priorSet.has(lastTitle),
    tagsValid: validateTags(lastTags),
    valid: false,
    model,
    usages
  }
}

// Back-compat alias
export const generateSEOTitle = generateSEO

export const sleep = ms => new Promise(r => setTimeout(r, ms))
