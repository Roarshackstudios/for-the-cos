import { GoogleGenAI } from "@google/genai";

export async function processCosplayImage(
  sourceBase64: string,
  categoryName: string,
  subcategoryName: string,
  styleIntensity: number,
  customPrompt?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const mimeTypeMatch = sourceBase64.match(/^data:(image\/[a-zA-Z0-9.+]+);base64,/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
  const base64Data = sourceBase64.split(',')[1] || sourceBase64;
  
  let sceneDescription = "";
  if (customPrompt) {
    sceneDescription = customPrompt;
  } else if (subcategoryName === "Auto Detect") {
    sceneDescription = `a breathtaking cinematic backdrop matching the character's aesthetic in a ${categoryName} theme`;
  } else {
    sceneDescription = `a highly detailed ${subcategoryName} environment in a ${categoryName} style`;
  }

  let aestheticGuide = "";
  if (styleIntensity < 30) {
    aestheticGuide = "stylized 2D anime cel-shaded illustrative";
  } else if (styleIntensity < 70) {
    aestheticGuide = "cinematic digital painterly with dramatic lighting";
  } else {
    aestheticGuide = "high-fidelity realistic digital art with professional cinematic color grading";
  }

  const prompt = `Task: Professional Background Replacement.

Instructions:
1. BACKGROUND: Replace the entire background with: ${sceneDescription}. 
2. STYLE: Use a ${aestheticGuide} aesthetic for the new environment.
3. SUBJECT PRESERVATION: Keep the person, their costume, and their props from the original image PERFECTLY identical. Do not alter their face, body structure, or clothing.
4. INTEGRATION: Seamlessly blend the original subject into the new scenery using matching atmospheric lighting, shadows, and depth of field.
5. COMPOSITION: Center the subject vertically. Ensure there is generous space above the head and below the feet for a professional portrait look.

Output ONLY the final processed image.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4" 
        }
      }
    });

    const candidate = response.candidates?.[0];
    
    if (candidate?.finishReason === 'SAFETY') {
      throw new Error("The image was blocked by safety filters. Try a different scene or photo.");
    }

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image was generated. This may be due to safety filters or input processing limits.");
  } catch (error: any) {
    console.error("Gemini processing error details:", error);
    throw error;
  }
}