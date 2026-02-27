const MAX_FILE_SIZE_MB = 10
const VALID_EXTENSIONS = ['pdf', 'docx', 'txt'] as const

const READING_ERRORS = {
  unsupportedType: '[READING_UNSUPPORTED_TYPE] Unsupported file type. Please upload PDF, DOCX, or TXT.',
  fileTooLarge: `[READING_FILE_TOO_LARGE] File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
  emptyExtractedText: '[READING_EMPTY_TEXT] No readable text found in this document.',
  extractFailed: '[READING_EXTRACT_FAILED] Failed to extract text from this file.',
} as const

let pdfLoaderPromise: Promise<{ getDocument: typeof import('pdfjs-dist').getDocument }> | null = null
let docxLoaderPromise: Promise<typeof import('mammoth/mammoth.browser').default> | null = null

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

export function validateReadingFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!VALID_EXTENSIONS.includes(extension as (typeof VALID_EXTENSIONS)[number])) {
    return READING_ERRORS.unsupportedType
  }

  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024
  if (file.size > maxBytes) {
    return READING_ERRORS.fileTooLarge
  }

  return null
}

async function loadPdfEngine(): Promise<{ getDocument: typeof import('pdfjs-dist').getDocument }> {
  if (!pdfLoaderPromise) {
    pdfLoaderPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjsModule, workerModule]) => {
      pdfjsModule.GlobalWorkerOptions.workerSrc = workerModule.default
      return { getDocument: pdfjsModule.getDocument }
    })
  }
  return pdfLoaderPromise
}

async function loadDocxEngine(): Promise<typeof import('mammoth/mammoth.browser').default> {
  if (!docxLoaderPromise) {
    docxLoaderPromise = import('mammoth/mammoth.browser').then((module) => module.default)
  }
  return docxLoaderPromise
}

function ensureReadableText(rawText: string): string {
  const normalized = normalizeWhitespace(rawText)
  if (!normalized) {
    throw new Error(READING_ERRORS.emptyExtractedText)
  }
  return normalized
}

async function extractPdfText(file: File): Promise<string> {
  const { getDocument } = await loadPdfEngine()
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocument({ data }).promise
  const chunks: string[] = []

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: unknown) => {
        if (typeof item === 'object' && item !== null && 'str' in item) {
          const maybe = (item as { str?: unknown }).str
          return typeof maybe === 'string' ? maybe : ''
        }
        return ''
      })
      .join(' ')
      .trim()
    if (pageText) {
      chunks.push(pageText)
    }
  }

  return ensureReadableText(chunks.join('\n\n'))
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await loadDocxEngine()
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return ensureReadableText(result.value)
}

async function extractTxtText(file: File): Promise<string> {
  const text = await file.text()
  return ensureReadableText(text)
}

export async function extractText(file: File): Promise<string> {
  const validationError = validateReadingFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  try {
    if (extension === 'pdf') return await extractPdfText(file)
    if (extension === 'docx') return await extractDocxText(file)
    if (extension === 'txt') return await extractTxtText(file)
    throw new Error(READING_ERRORS.unsupportedType)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('[READING_')) {
      throw error
    }
    throw new Error(READING_ERRORS.extractFailed)
  }
}
