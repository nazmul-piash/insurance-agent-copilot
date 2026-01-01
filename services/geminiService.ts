
import { GoogleGenAI, Type } from "@google/genai";
import { InteractionSummary, GenerationResult } from "../types";

export const generateInsuranceReply = async (
  input: { image?: string; text?: string },
  clientId: string,
  history: InteractionSummary[],
  playbookText: string,
  playbookPdf?: string // Base64 string of the PDF
): Promise<GenerationResult> => {
  // Use the environment variable for security
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const storedMemory = history.length > 0 
    ? history.map(h => `[Date: ${h.date}] [Policy: ${h.policyNumber || 'Unknown'}] Summary: ${h.summary}`).join('\n')
    : "No previous interaction history found.";

  const systemInstruction = `
Role: You are an expert Insurance Agent Assistant for ARAG.
Objective: Analyze the provided email, extract core data, and draft bilingual replies strictly following the provided AGENT PLAYBOOK.

KNOWLEDGE SOURCES:
1. ATTACHED PDF: This is your primary source of truth for business rules, policy details, and tone.
2. MANUAL PLAYBOOK: Supplementary rules provided by the agent.
3. STORED MEMORY: Historical context for this specific client.

Task 1: Structured Extraction
- Extract the Client's Full Name and Policy Number.
- Identify the core request and emotional tone.

Task 2: Knowledge Synthesis
- Use the attached PDF and Manual Playbook to determine the correct insurance response.
- If a Policy Number is NOT found, politely ask for it in both language drafts.

Task 3: Response Generation
- Draft professional, empathetic replies in English (replyEnglish) and German (replyGerman).
- Ensure the German translation is natural and uses formal "Sie" address.

MANUAL PLAYBOOK RULES:
${playbookText}
`;

  const prompt = `
CLIENT ID PROVIDED BY AGENT: ${clientId || "Not provided"}
STORED MEMORY:
${storedMemory}

Analyze the email input and generate the JSON response.
`;

  const parts: any[] = [{ text: prompt }];
  
  if (input.image) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: input.image.split(',')[1] || input.image,
      },
    });
  }
  
  if (input.text) {
    parts.push({ text: `EMAIL TEXT CONTENT: \n${input.text}` });
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
            summary: { type: Type.STRING },
            replyEnglish: { type: Type.STRING },
            replyGerman: { type: Type.STRING },
            extractedClientName: { type: Type.STRING },
            extractedPolicyNumber: { 
              type: Type.STRING, 
              nullable: true
            },
          },
          required: ["summary", "replyEnglish", "replyGerman", "extractedClientName"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("The AI returned an empty response.");
    
    return JSON.parse(text) as GenerationResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
