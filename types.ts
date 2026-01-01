
export interface InteractionSummary {
  date: string;
  summary: string;
  policyNumber?: string;
}

export interface ClientData {
  id: string;
  history: InteractionSummary[];
}

export interface GenerationResult {
  analysis: string;
  recommendation: string;
  nextSteps: string;
  replyEnglish: string;
  replyGerman: string;
  extractedClientName: string;
  extractedPolicyNumber: string | null;
}

export interface AnalysisState {
  loading: boolean;
  error: string | null;
  result: GenerationResult | null;
}

export interface CloudSettings {
  supabaseUrl: string;
  supabaseKey: string;
  enabled: boolean;
}
