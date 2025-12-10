import { GoogleGenAI, Type } from "@google/genai";
import { DataRow, InsightData } from "../types";

const apiKey = process.env.API_KEY || '';

let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const generateInsights = async (tableName: string, data: DataRow[]): Promise<InsightData | null> => {
  if (!ai || !data || data.length === 0) return null;

  try {
    // We sample the last 30 rows to provide a meaningful financial snapshot
    const sampleData = data.slice(-30);
    const dataString = JSON.stringify(sampleData);

    const prompt = `
      You are a financial analyst. Analyze the following data from table "${tableName}".
      
      Focus on:
      1. Revenue and Profit trends.
      2. Departmental performance (expenses vs revenue).
      3. Significant outliers in orders.

      Return the response in JSON format with:
      - summary: A financial executive summary.
      - trends: List of key financial trends (e.g., "Marketing expenses up 15%").
      - anomalies: List of suspicious or notable records (e.g., "Order #123 has negative margin").
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Data: ${dataString}\n\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            trends: { type: Type.ARRAY, items: { type: Type.STRING } },
            anomalies: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as InsightData;
    }
    return null;

  } catch (error) {
    console.error("Error generating insights:", error);
    return {
      summary: "Could not generate financial insights at this time.",
      trends: [],
      anomalies: []
    };
  }
};
