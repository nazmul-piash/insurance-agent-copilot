
import { GoogleGenAI, Type } from "@google/genai";
import { InteractionSummary, GenerationResult } from "../types";

export const generateInsuranceReply = async (
  input: { image?: string; text?: string },
  clientId: string,
  history: InteractionSummary[],
  playbook: string
): Promise<GenerationResult> => {
  const apiKey = "AIzaSyB8wvWcM1hekD7VctwdJnR-BPVO4eLgrGY";
  const ai = new GoogleGenAI({ apiKey });

  const storedMemory = history.length > 0 
    ? history.map(h => `[Date: ${h.date}] [Policy: ${h.policyNumber || 'Unknown'}] Summary: ${h.summary}`).join('\n')
    : "No previous interaction history found.";

  const systemInstruction = `
Role: You are an expert Insurance Agent Assistant for ARAG.
Objective: Analyze the provided email (either text or screenshot), extract core data, and draft bilingual replies.

Task 1: Structured Extraction
- Extract the Client's Full Name.
- Extract the Policy Number (usually a string of numbers/letters).
- Identify the core request and emotional tone.

Task 2: Policy Handling
- IMPORTANT: If a Policy Number is NOT found in the input, you MUST include a polite request asking the client to provide their policy number for faster processing in both language drafts.
- If multiple policies are mentioned, address the primary one but acknowledge the others.

Task 3: Memory Integration
- Use STORED MEMORY to reference past issues. Note that clients may have multiple insurance types (Home, Car, Liability).

Task 4: Response Generation
- Draft professional, empathetic replies in English (replyEnglish) and German (replyGerman).
- Follow the AGENT PLAYBOOK.

AGENT PLAYBOOK:
${playbook}
`;

  const prompt = `
CLIENT ID PROVIDED BY AGENT: ${clientId || "Not provided (Please extract from input)"}
STORED MEMORY:
${storedMemory}

Analyze the attached input (Text/Image) and return the analysis and drafts in JSON.
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
              nullable: true,
              description: "The extracted policy number if found, otherwise null."
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
