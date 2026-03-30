import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `Você é um assistente especializado em análise de performance de ads.

Quando o usuário enviar uma transcrição de call de análise de equipe (Copy, Editor e Gestor), você deve extrair as informações e gerar uma resposta em formato JSON contendo a ATA em Markdown e os dados estruturados dos ads para gráficos.

REGRAS OBRIGATÓRIAS:
- Nunca invente informações. Se algo não foi mencionado, deixe o campo como null ou "—".
- Use as palavras dos participantes, mas resuma com clareza e objetividade.
- Identifique cada participante pela função (Gestor, Editor, Copy).
- Classifique o resultado de cada ad como exatamente um destes: ✅ Validou, ❌ Não validou, 🚀 Escalou ou 💀 Morreu.
- Gere o JSON de forma concisa e direta.

FORMATO DA ATA (campo "markdown"):
ATA — Call de Análise de Ads
Data: [data da call]
Participantes: [nomes]

AD 1 — [nome/ID do ad]

Resultado: [validou / não validou / escalou / morreu]
Métricas principais: Gasto, Vendas, ROAS, IC, CPI (Custo por IC), CPC, CTR, CPM, Conversão
Análise do Gestor: [o que ele apontou]
Análise do Editor: [o que ele apontou]
Análise do Copy: [o que ele apontou]
Consenso: [conclusão do grupo sobre por que performou assim]
Hipótese pro próximo teste: [o que vai ser testado com base nesse aprendizado]

AD 2 — [repetir estrutura para cada ad]

Resumo da call

Principal aprendizado do período
Próximos testes definidos
Pendências ou dúvidas a resolver

ESTRUTURA DO JSON:
{
  "markdown": "string (a ATA completa seguindo EXATAMENTE o formato acima)",
  "ads": [
    {
      "name": "string",
      "status": "✅ Validou | ❌ Não validou | 🚀 Escalou | 💀 Morreu",
      "metrics": {
        "gasto": number,
        "vendas": number,
        "roas": number,
        "ic": number,
        "cpi": number,
        "cpc": number,
        "ctr": number,
        "cpm": number,
        "conversao": number
      }
    }
  ],
  "summary": {
    "insight": "string",
    "nextTests": ["string"],
    "pending": ["string"]
  }
}`;

export async function analyzeCallTranscription(transcription: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = "gemini-3-flash-preview";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: transcription,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + "\n\nIMPORTANTE: Gere o JSON completo, sem truncar. Se houver muitos ads, seja mais conciso nas descrições para garantir que tudo caiba na resposta.",
        temperature: 0,
        responseMimeType: "application/json",
        maxOutputTokens: 16384, // Increased limit for longer outputs
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            markdown: { type: Type.STRING },
            ads: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  status: { 
                    type: Type.STRING,
                    enum: ["✅ Validou", "❌ Não validou", "🚀 Escalou", "💀 Morreu"]
                  },
                  metrics: {
                    type: Type.OBJECT,
                    properties: {
                      gasto: { type: Type.NUMBER },
                      vendas: { type: Type.NUMBER },
                      roas: { type: Type.NUMBER },
                      ic: { type: Type.NUMBER },
                      cpi: { type: Type.NUMBER },
                      cpc: { type: Type.NUMBER },
                      ctr: { type: Type.NUMBER },
                      cpm: { type: Type.NUMBER },
                      conversao: { type: Type.NUMBER }
                    },
                    required: ["gasto", "vendas", "roas", "ic", "cpi", "cpc", "ctr", "cpm", "conversao"]
                  }
                },
                required: ["name", "status", "metrics"]
              }
            },
            summary: {
              type: Type.OBJECT,
              properties: {
                insight: { type: Type.STRING },
                nextTests: { type: Type.ARRAY, items: { type: Type.STRING } },
                pending: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["insight", "nextTests", "pending"]
            }
          },
          required: ["markdown", "ads", "summary"]
        }
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from AI");
    }

    try {
      // Try to extract JSON from markdown blocks if present
      const markdownMatch = text.match(/```json\n([\s\S]*?)\n```/);
      const jsonMatch = text.match(/{[\s\S]*}/);
      const jsonToParse = markdownMatch ? markdownMatch[1] : (jsonMatch ? jsonMatch[0] : text);
      return JSON.parse(jsonToParse);
    } catch (e) {
      console.error("Failed to parse JSON response:", text);
      // Try to fix common truncation issues if possible
      if (text.endsWith('"}') || text.endsWith(']}') || text.endsWith('}')) {
         // It might be almost complete, but missing something
      }
      throw new Error("A resposta da IA foi truncada ou é inválida. Tente uma transcrição menor ou com menos ads.");
    }
  } catch (error) {
    console.error("Error analyzing call:", error);
    throw error;
  }
}
