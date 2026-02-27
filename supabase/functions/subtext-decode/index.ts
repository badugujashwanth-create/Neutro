import { corsHeaders } from '../_shared/cors.ts'

interface DecodeRequest {
  chunkText: string
  context?: {
    speakerRole?: string
    meetingType?: string
    urgencyHint?: string
  }
  model?: string
}

interface DecodeResponse {
  plainMeaning: string
  likelyIntent: string
  nextQuestion: string
  priority: 'Low' | 'Med' | 'High'
  suggestedReplies: {
    direct: string
    polite: string
    assertive: string
  }
}

const DEFAULT_RESULT: DecodeResponse = {
  plainMeaning: 'They are asking for clearer alignment.',
  likelyIntent: 'Reduce ambiguity and get a concrete commitment.',
  nextQuestion: 'What exact deliverable and deadline do you want from me?',
  priority: 'Med',
  suggestedReplies: {
    direct: 'Please confirm the exact output and due time.',
    polite: 'Happy to align. Could you confirm expected output and timing?',
    assertive: 'I can deliver once scope and deadline are explicitly confirmed.',
  },
}

const SYSTEM_PROMPT = [
  'You translate workplace subtext into clear literal meaning.',
  'Keep output short, neutral, and actionable.',
  'Never claim certainty.',
  'Return JSON only with keys:',
  'plainMeaning, likelyIntent, nextQuestion, priority, suggestedReplies{direct, polite, assertive}.',
  'priority must be one of Low, Med, High.',
].join(' ')

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function contains(text: string, ...needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle))
}

function heuristicDecode(chunkText: string): DecodeResponse {
  const text = chunkText.toLowerCase()

  if (contains(text, 'per my last email', 'as discussed', 'as mentioned')) {
    return {
      plainMeaning: 'They believe this was already communicated and want quick follow-through.',
      likelyIntent: 'Apply pressure while avoiding another long explanation.',
      nextQuestion: 'Can you confirm the final expected version so I deliver exactly that?',
      priority: 'High',
      suggestedReplies: {
        direct: 'I saw your note. Please confirm final scope and I will finish it today.',
        polite: 'Thanks for the reminder. Could you confirm the final expected output?',
        assertive: 'I will complete this once the final requirements are explicitly confirmed.',
      },
    }
  }

  if (contains(text, 'circling back', 'just checking in', 'quick follow up')) {
    return {
      plainMeaning: 'They need a status update soon.',
      likelyIntent: 'Prompt progress without sounding direct.',
      nextQuestion: 'Would a concrete update by [time] work for you?',
      priority: 'High',
      suggestedReplies: {
        direct: 'Status: in progress. I will send an update by 3 PM.',
        polite: 'Thanks for checking in. I will send a full update by 3 PM.',
        assertive: 'I can share a quality update by 3 PM; before then I am heads-down on delivery.',
      },
    }
  }

  if (contains(text, 'whenever you get a chance', 'no rush', 'when possible')) {
    return {
      plainMeaning: 'They are being polite but still expect completion.',
      likelyIntent: 'Keep moderate priority while maintaining accountability.',
      nextQuestion: 'What latest acceptable deadline should I target?',
      priority: 'Med',
      suggestedReplies: {
        direct: 'I can deliver by tomorrow noon unless you need it sooner.',
        polite: 'Happy to handle this. Is tomorrow noon acceptable?',
        assertive: 'I can fit this in the next focus block; flag if urgency is higher.',
      },
    }
  }

  return DEFAULT_RESULT
}

function normalize(parsed: unknown): DecodeResponse {
  if (!parsed || typeof parsed !== 'object') return DEFAULT_RESULT
  const candidate = parsed as Partial<DecodeResponse>
  if (!candidate.plainMeaning || !candidate.likelyIntent || !candidate.nextQuestion || !candidate.priority) {
    return DEFAULT_RESULT
  }

  const priority = candidate.priority === 'High' || candidate.priority === 'Low' || candidate.priority === 'Med'
    ? candidate.priority
    : 'Med'

  return {
    plainMeaning: candidate.plainMeaning,
    likelyIntent: candidate.likelyIntent,
    nextQuestion: candidate.nextQuestion,
    priority,
    suggestedReplies: {
      direct: candidate.suggestedReplies?.direct ?? DEFAULT_RESULT.suggestedReplies.direct,
      polite: candidate.suggestedReplies?.polite ?? DEFAULT_RESULT.suggestedReplies.polite,
      assertive: candidate.suggestedReplies?.assertive ?? DEFAULT_RESULT.suggestedReplies.assertive,
    },
  }
}

function tryParseJson(content: string): DecodeResponse | null {
  try {
    return normalize(JSON.parse(content))
  } catch {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return normalize(JSON.parse(content.slice(start, end + 1)))
    } catch {
      return null
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let payload: DecodeRequest
  try {
    payload = (await req.json()) as DecodeRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const chunkText = payload.chunkText?.trim()
  if (!chunkText) {
    return json({ error: 'chunkText is required' }, 400)
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return json(heuristicDecode(chunkText))
  }

  try {
    const model = payload.model ?? 'gpt-4.1'
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify({
              chunkText,
              context: payload.context ?? {},
            }),
          },
        ],
      }),
    })

    if (!openAiResponse.ok) {
      return json(heuristicDecode(chunkText))
    }

    const llmPayload = (await openAiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = llmPayload.choices?.[0]?.message?.content
    if (!content) {
      return json(heuristicDecode(chunkText))
    }

    const parsed = tryParseJson(content)
    if (!parsed) {
      return json(heuristicDecode(chunkText))
    }

    return json(parsed)
  } catch {
    return json(heuristicDecode(chunkText))
  }
})
