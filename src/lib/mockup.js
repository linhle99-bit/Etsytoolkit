// Ghép design PNG vào mockup bằng 4-point perspective warp.
// Port từ image_compositor.py (PIL.Image.PERSPECTIVE) sang Canvas thuần JS.
//
// Quy ước corners: [TL, TR, BR, BL] mỗi điểm là [x, y] trong toạ độ pixel
// của mockup (không phải toạ độ canvas đã scale).

export async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src instanceof Blob ? URL.createObjectURL(src) : src
  })
}

// --- Public API --------------------------------------------------------

export async function compositeDesignOnMockup({
  designSrc,
  mockupSrc,
  corners,
  fitMode = 'fit',
  outputType = 'image/jpeg',
  jpegQuality = 0.92
}) {
  validateCorners(corners)
  if (fitMode !== 'fit' && fitMode !== 'stretch') {
    throw new Error(`fitMode must be 'fit' or 'stretch', got ${fitMode}`)
  }

  const [mockup, designRaw] = await Promise.all([
    loadImage(mockupSrc),
    loadImage(designSrc)
  ])

  // Tight-crop alpha của design để bỏ padding trong suốt
  const design = await tightCropAlpha(designRaw)

  const adjCorners =
    fitMode === 'fit'
      ? fitQuadToAspect(corners, design.width, design.height)
      : corners

  // Canvas size = mockup size
  const canvas = document.createElement('canvas')
  canvas.width = mockup.naturalWidth
  canvas.height = mockup.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(mockup, 0, 0)

  // Render design lên 1 canvas RGBA cùng kích thước, perspective warp
  const warped = perspectiveWarp(design, canvas.width, canvas.height, adjCorners)

  // Composite warped lên mockup
  ctx.drawImage(warped, 0, 0)

  return new Promise(resolve =>
    canvas.toBlob(resolve, outputType, jpegQuality)
  )
}

// Resize blob xuống max dim — dùng trước khi upload
export async function resizeBlob(blob, maxDim = 2000) {
  const img = await loadImage(blob)
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (w <= maxDim && h <= maxDim) return blob
  const ratio = Math.min(maxDim / w, maxDim / h)
  const c = document.createElement('canvas')
  c.width = Math.round(w * ratio)
  c.height = Math.round(h * ratio)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return new Promise(r => c.toBlob(r, blob.type || 'image/jpeg', 0.92))
}

// --- Validation --------------------------------------------------------

function validateCorners(corners) {
  if (!Array.isArray(corners) || corners.length !== 4) {
    throw new Error(`Expected 4 corners, got ${corners?.length}`)
  }
  for (let i = 0; i < 4; i++) {
    const p = corners[i]
    if (!p || p.length !== 2) {
      throw new Error(`Corner ${i} must be [x, y]`)
    }
  }
}

// --- Tight crop alpha --------------------------------------------------

async function tightCropAlpha(img, minPaddingRatio = 0.02) {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, w, h)
  const px = imageData.data

  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = px[(y * w + x) * 4 + 3]
      if (a > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) {
    // fully transparent
    return { canvas: c, width: w, height: h }
  }

  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  const padRatio = 1 - (bw * bh) / (w * h)
  if (padRatio < minPaddingRatio) {
    return { canvas: c, width: w, height: h }
  }

  const cropped = document.createElement('canvas')
  cropped.width = bw
  cropped.height = bh
  cropped
    .getContext('2d')
    .drawImage(c, minX, minY, bw, bh, 0, 0, bw, bh)
  return { canvas: cropped, width: bw, height: bh }
}

// --- Fit quad to design aspect (port _fit_quad_to_aspect) --------------

function fitQuadToAspect(corners, designW, designH, tolerance = 0.02) {
  const [tl, tr, br, bl] = corners
  const quadW = (dist(tl, tr) + dist(bl, br)) / 2
  const quadH = (dist(tl, bl) + dist(tr, br)) / 2
  if (quadW < 1 || quadH < 1 || designW < 1 || designH < 1) return corners

  const designRatio = designW / designH
  const quadRatio = quadW / quadH
  if (Math.abs(designRatio - quadRatio) < tolerance) return corners

  let scaleU, scaleV
  if (designRatio > quadRatio) {
    scaleU = 1
    scaleV = quadRatio / designRatio
  } else {
    scaleU = designRatio / quadRatio
    scaleV = 1
  }
  const offU = (1 - scaleU) / 2
  const offV = (1 - scaleV) / 2

  return [
    bilinear(tl, tr, br, bl, offU, offV),
    bilinear(tl, tr, br, bl, offU + scaleU, offV),
    bilinear(tl, tr, br, bl, offU + scaleU, offV + scaleV),
    bilinear(tl, tr, br, bl, offU, offV + scaleV)
  ]
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function bilinear(tl, tr, br, bl, u, v) {
  const tx = tl[0] + (tr[0] - tl[0]) * u
  const ty = tl[1] + (tr[1] - tl[1]) * u
  const bx = bl[0] + (br[0] - bl[0]) * u
  const by = bl[1] + (br[1] - bl[1]) * u
  return [tx + (bx - tx) * v, ty + (by - ty) * v]
}

// --- Perspective coefficients (8x8 linear solve) -----------------------
// PIL: ix = (a*ox + b*oy + c) / (g*ox + h*oy + 1)
//      iy = (d*ox + e*oy + f) / (g*ox + h*oy + 1)
// 4 cặp output→input cho 8 phương trình tuyến tính trong [a..h].

function findPerspectiveCoeffs(outputCorners, inputCorners) {
  const A = []
  const b = []
  for (let i = 0; i < 4; i++) {
    const [ox, oy] = outputCorners[i]
    const [ix, iy] = inputCorners[i]
    A.push([ox, oy, 1, 0, 0, 0, -ix * ox, -ix * oy])
    A.push([0, 0, 0, ox, oy, 1, -iy * ox, -iy * oy])
    b.push(ix)
    b.push(iy)
  }
  return solve8x8(A, b)
}

// Gaussian elimination với partial pivoting cho 8x8
function solve8x8(A, b) {
  const n = 8
  const M = A.map((row, i) => [...row, b[i]])
  for (let i = 0; i < n; i++) {
    // Pivot
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k
    }
    if (Math.abs(M[maxRow][i]) < 1e-12) {
      throw new Error('Perspective corners are degenerate (collinear or duplicated)')
    }
    if (maxRow !== i) {
      const tmp = M[i]
      M[i] = M[maxRow]
      M[maxRow] = tmp
    }
    // Eliminate
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i]
      for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j]
    }
  }
  // Back-substitution
  const x = new Array(n)
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n]
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]
    x[i] = s / M[i][i]
  }
  return x // [a, b, c, d, e, f, g, h]
}

// --- Perspective warp (inverse mapping + bilinear sample) --------------

function perspectiveWarp(design, canvasW, canvasH, outputCorners) {
  const dw = design.width
  const dh = design.height
  const inputCorners = [
    [0, 0],
    [dw, 0],
    [dw, dh],
    [0, dh]
  ]
  const [a, b, c, d, e, f, g, h] = findPerspectiveCoeffs(outputCorners, inputCorners)

  // Bounding box của output quad — chỉ warp trong vùng này
  const xs = outputCorners.map(p => p[0])
  const ys = outputCorners.map(p => p[1])
  const minX = Math.max(0, Math.floor(Math.min(...xs)))
  const maxX = Math.min(canvasW - 1, Math.ceil(Math.max(...xs)))
  const minY = Math.max(0, Math.floor(Math.min(...ys)))
  const maxY = Math.min(canvasH - 1, Math.ceil(Math.max(...ys)))

  // Lấy pixel data của design
  const srcCanvas = design.canvas || (() => {
    const sc = document.createElement('canvas')
    sc.width = dw
    sc.height = dh
    sc.getContext('2d').drawImage(design, 0, 0)
    return sc
  })()
  const srcCtx = srcCanvas.getContext('2d')
  const srcData = srcCtx.getImageData(0, 0, dw, dh).data

  // Output canvas (RGBA, ban đầu trong suốt)
  const outCanvas = document.createElement('canvas')
  outCanvas.width = canvasW
  outCanvas.height = canvasH
  const outCtx = outCanvas.getContext('2d')
  const outImage = outCtx.createImageData(canvasW, canvasH)
  const outData = outImage.data

  for (let oy = minY; oy <= maxY; oy++) {
    for (let ox = minX; ox <= maxX; ox++) {
      const denom = g * ox + h * oy + 1
      if (Math.abs(denom) < 1e-12) continue
      const ix = (a * ox + b * oy + c) / denom
      const iy = (d * ox + e * oy + f) / denom
      if (ix < 0 || iy < 0 || ix > dw - 1 || iy > dh - 1) continue

      // Bilinear sample
      const x0 = Math.floor(ix)
      const y0 = Math.floor(iy)
      const x1 = Math.min(x0 + 1, dw - 1)
      const y1 = Math.min(y0 + 1, dh - 1)
      const fx = ix - x0
      const fy = iy - y0
      const w00 = (1 - fx) * (1 - fy)
      const w10 = fx * (1 - fy)
      const w01 = (1 - fx) * fy
      const w11 = fx * fy

      const i00 = (y0 * dw + x0) * 4
      const i10 = (y0 * dw + x1) * 4
      const i01 = (y1 * dw + x0) * 4
      const i11 = (y1 * dw + x1) * 4

      const r =
        srcData[i00] * w00 + srcData[i10] * w10 + srcData[i01] * w01 + srcData[i11] * w11
      const gC =
        srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11
      const bC =
        srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11
      const aC =
        srcData[i00 + 3] * w00 + srcData[i10 + 3] * w10 + srcData[i01 + 3] * w01 + srcData[i11 + 3] * w11

      const outIdx = (oy * canvasW + ox) * 4
      outData[outIdx] = r
      outData[outIdx + 1] = gC
      outData[outIdx + 2] = bC
      outData[outIdx + 3] = aC
    }
  }

  outCtx.putImageData(outImage, 0, 0)
  return outCanvas
}

// --- Helpers cho UI ----------------------------------------------------

// Dựng quad chữ nhật từ 2 điểm TL và BR (với option ép vuông)
export function rectFrom(tl, br, forceSquare = false) {
  let dx = br[0] - tl[0]
  let dy = br[1] - tl[1]
  if (forceSquare) {
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    dx = Math.sign(dx || 1) * side
    dy = Math.sign(dy || 1) * side
  }
  return [
    [tl[0], tl[1]],
    [tl[0] + dx, tl[1]],
    [tl[0] + dx, tl[1] + dy],
    [tl[0], tl[1] + dy]
  ]
}
