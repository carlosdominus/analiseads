export async function analyzeCallTranscription(transcription: string) {
  try {
    const response = await fetch("https://nen.auto-jornada.space/webhook/ads-atas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ 
        transcription,
        text: transcription,
        body: transcription
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error("Webhook error response:", responseText);
      throw new Error(`Erro ao comunicar com o webhook (${response.status}): ${responseText || response.statusText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // If not valid JSON, treat raw text as markdown
      data = { markdown: responseText };
    }
    
    // Handle cases where webhook might return an array or wrapped object
    const result = Array.isArray(data) ? data[0] : (data.data || data);
    
    let rawMarkdown = "";
    if (typeof result === 'string') {
      rawMarkdown = result;
    } else if (result?.markdown) {
      rawMarkdown = result.markdown;
    } else if (result?.output) {
      rawMarkdown = result.output;
    } else if (data?.output) {
      rawMarkdown = data.output;
    } else {
      // Check if the whole object got stringified or has {"output": ...}
      rawMarkdown = JSON.stringify(result, null, 2);
    }

    // Clean up if it starts with {"output": ...} or similar JSON wrapper
    if (typeof rawMarkdown === 'string') {
      try {
        // If it's a JSON string like {"output":"..."}
        if (rawMarkdown.trim().startsWith('{') && rawMarkdown.includes('output')) {
          const parsed = JSON.parse(rawMarkdown);
          if (parsed.output) {
            rawMarkdown = parsed.output;
          }
        }
      } catch (err) {
        // ignore parse error, keep rawMarkdown
      }

      // Unescape literal \n strings into actual newlines
      rawMarkdown = rawMarkdown
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\"/g, '"');
    }

    return {
      markdown: rawMarkdown || "Nenhum conteúdo retornado pelo webhook.",
      ads: Array.isArray(result?.ads) ? result.ads : [],
      summary: {
        insight: result?.summary?.insight || "Análise concluída via webhook.",
        nextTests: Array.isArray(result?.summary?.nextTests) ? result.summary.nextTests : [],
        pending: Array.isArray(result?.summary?.pending) ? result.summary.pending : []
      }
    };
  } catch (error) {
    console.error("Error sending transcription to webhook:", error);
    throw error;
  }
}


