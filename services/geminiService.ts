
import { GoogleGenAI, Type } from "@google/genai";
import { InteractionSummary, GenerationResult } from "../types";

export const generateInsuranceReply = async (
  input: { image?: string; text?: string },
  clientId: string,
  history: InteractionSummary[],
  playbookText: string,
  playbookPdf?: string,
  apiKeyOverride?: string
): Promise<GenerationResult> => {
  // Use the manually provided key or fallback to the system environment variable.
  const apiKey = apiKeyOverride || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("KEY_RESET_REQUIRED");
  }

  const ai = new GoogleGenAI({ apiKey });

  const storedMemory = history.length > 0 
    ? history.map(h => `[Date: ${h.date}] [Policy: ${h.policyNumber || 'Unknown'}] Summary: ${h.summary}`).join('\n')
    : "No previous interaction history found.";

  const systemInstruction = `
ROLE: You are "InsurBot", an expert Insurance Agent Assistant for ARAG.
OBJECTIVE: Analyze the provided email screenshot or text, extract core data, and draft bilingual replies strictly following the provided AGENT PLAYBOOK and attached knowledge.

MISSION:
- Simplify complex insurance jargon into clear, actionable advice.
- Assist agents in drafting high-quality, compliant responses.
- Analyze client sentiments and provide tailored recommendations.

KNOWLEDGE BASES:
1. ATTACHED PDF: Primary source for official policy terms and conditions.
2. AGENT PLAYBOOK (Text): Custom rules and specific instructions provided by the human agent.
3. CLIENT HISTORY: Contextual data from previous interactions.

OPERATIONAL GUIDELINES:
- TONE: Professional, warm, and reassuring.
- ACCURACY: Stick strictly to the provided knowledge bases. If information is missing (like a policy number), ask for it politely.
- BILINGUAL: Always provide drafts in both English and German (using formal "Sie").

OUTPUT FORMAT (JSON):
{
  "analysis": "Brief analysis of the client's needs and emotional state.",
  "recommendation": "The specific policy-based advice or action suggested.",
  "nextSteps": "Bulleted list of actions for the agent to take.",
  "replyEnglish": "Full professional draft in English.",
  "replyGerman": "Full professional draft in German (Formal).",
  "extractedClientName": "Name of the client.",
  "extractedPolicyNumber": "Policy number if found, otherwise null."
}

AGENT PLAYBOOK INPUT:
${playbookText}`;

  const prompt = `
CLIENT ID PROVIDED: ${clientId || "Not provided"}
STORED MEMORY:
${storedMemory}

INPUT DATA:
${input.text ? `EMAIL CONTENT: ${input.text}` : "IMAGE CONTENT ATTACHED"}

Analyze and generate the response following the InsurBot v4.2 protocol.`;

  const parts: any[] = [{ text: prompt }];
  
  if (input.image) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: input.image.split(',')[1] || input.image,
      },
    });
  }
  
  if (playbookPdf) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: playbookPdf.split(',')[1] || playbookPdf,
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            recommendation: { type: Type.STRING },
            nextSteps: { type: Type.STRING },
            replyEnglish: { type: Type.STRING },
            replyGerman: { type: Type.STRING },
            extractedClientName: { type: Type.STRING },
            extractedPolicyNumber: { type: Type.STRING, nullable: true },
          },
          required: ["analysis", "recommendation", "nextSteps", "replyEnglish", "replyGerman", "extractedClientName"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI.");
    
    return JSON.parse(text) as GenerationResult;
  } catch (error: any) {
    console.error("API Error:", error);
    if (error.message?.includes("Requested entity was not found") || error.message?.includes("403") || error.message?.includes("401")) {
      throw new Error("KEY_RESET_REQUIRED");
    }
    throw error;
  }
};
