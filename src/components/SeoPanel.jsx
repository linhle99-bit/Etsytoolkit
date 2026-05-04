import {
  validateTitle,
  validateTags,
  containsTagTM,
  containsTitleTM,
  TITLE_LENGTHS
} from '../lib/claude'

const TAG_COUNT = 13
const TAG_MAX_LEN = 20

export default function SeoPanel({ item, lengthMode = 'default', onChange }) {
  const spec = TITLE_LENGTHS[lengthMode] || TITLE_LENGTHS.default
  const titleLen = (item.title || '').length
  const titleOK = item.title ? validateTitle(item.title, lengthMode) : null
  const inRange = titleLen >= spec.minLen && titleLen <= spec.maxLen

  const tags = Array.isArray(item.tags) ? item.tags : []
  const tagsOK = tags.length ? validateTags(tags) : null
  const titleHasTM = item.title ? containsTitleTM(item.title) : false

  function updateTag(idx, value) {
    const next = [...tags]
    next[idx] = value.toLowerCase().slice(0, TAG_MAX_LEN)
    onChange({ tags: next })
  }

  function removeTag(idx) {
    onChange({ tags: tags.filter((_, i) => i !== idx) })
  }

  function addTag() {
    if (tags.length >= TAG_COUNT) return
    onChange({ tags: [...tags, ''] })
  }

  return (
    <div className="space-y-3">
      {/* TITLE */}
      <div>
        <label className="label flex items-center gap-2 flex-wrap">
          <span>Title</span>
          <span
            className={
              !item.title
                ? 'text-slate-400'
                : inRange
                ? 'text-green-600'
                : 'text-orange-500'
            }
          >
            {titleLen}/{spec.minLen}-{spec.maxLen} ký tự
          </span>
          {item.title && (
            <span
              className={`chip ${
                titleOK
                  ? 'bg-green-100 text-green-700'
                  : titleHasTM
                  ? 'bg-red-100 text-red-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
              title={titleHasTM ? 'Title chứa trademark — phải đổi sang từ generic' : undefined}
            >
              {titleOK ? 'Format OK' : titleHasTM ? '🚫 chứa TM' : '⚠ format sai'}
            </span>
          )}
          {item.attempts > 1 && (
            <span className="chip bg-slate-100 text-slate-600">
              retry {item.attempts}x
            </span>
          )}
        </label>
        <textarea
          className="input font-mono text-sm"
          rows={2}
          value={item.title || ''}
          onChange={e => onChange({ title: e.target.value })}
          placeholder={`VD: ${spec.example}`}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Format: <code>[Key chính], [Key phụ], …</code> · đuôi SVG/PNG · TITLE phải tránh MỌI trademark
        </p>
      </div>

      {/* TAGS */}
      <div>
        <label className="label flex items-center gap-2 flex-wrap">
          <span>Tags</span>
          <span
            className={
              tags.length === 0
                ? 'text-slate-400'
                : tags.length === TAG_COUNT
                ? 'text-green-600'
                : 'text-orange-500'
            }
          >
            {tags.length}/{TAG_COUNT}
          </span>
          {tags.length > 0 && (
            <span
              className={`chip ${
                tagsOK
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              {tagsOK ? 'Tags OK' : '⚠ tags sai'}
            </span>
          )}
          <span className="text-[11px] text-slate-400">
            (≤ {TAG_MAX_LEN} ký tự · cấm: Hello Kitty, Bluey, Harry Potter, Snoopy, NFL)
          </span>
        </label>

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => {
            const tagLen = (tag || '').length
            const isOver = tagLen > TAG_MAX_LEN
            const isTM = !!tag && containsTagTM(tag)
            const cls = isTM
              ? 'bg-red-50 border-red-300'
              : isOver
              ? 'bg-orange-50 border-orange-300'
              : 'bg-slate-100 border-slate-200'
            return (
              <div
                key={i}
                className={`flex items-center rounded-full pl-2 pr-1 text-xs border ${cls}`}
                title={isTM ? '⚠ Tag chứa trademark — bị cấm' : undefined}
              >
                <input
                  className="bg-transparent outline-none w-28 py-1 font-mono"
                  value={tag}
                  onChange={e => updateTag(i, e.target.value)}
                  maxLength={TAG_MAX_LEN}
                />
                <span
                  className={`text-[10px] px-1 ${
                    isTM
                      ? 'text-red-600'
                      : isOver
                      ? 'text-orange-600'
                      : 'text-slate-400'
                  }`}
                >
                  {isTM ? 'TM' : tagLen}
                </span>
                <button
                  onClick={() => removeTag(i)}
                  className="ml-0.5 text-slate-400 hover:text-red-500 px-1"
                  type="button"
                >
                  ✕
                </button>
              </div>
            )
          })}
          {tags.length < TAG_COUNT && (
            <button
              onClick={addTag}
              type="button"
              className="chip bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3"
            >
              + Tag
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
