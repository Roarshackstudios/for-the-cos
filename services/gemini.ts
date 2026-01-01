
import { GoogleGenAI } from "@google/genai";

/**
 * Helper to fetch a URL and convert it to a base64 string
 */
async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({ data: base64String, mimeType: blob.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function processCosplayImage(
  sourceImage: string,
  categoryName: string,
  subcategoryName: string,
  styleIntensity: number,
  customPrompt?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let base64Data: string;
  let mimeType: string;

  // Check if the input is a URL or a base64 string
  if (sourceImage.startsWith('http')) {
    const converted = await urlToBase64(sourceImage);
    base64Data = converted.data;
    mimeType = converted.mimeType;
  } else {
    const mimeTypeMatch = sourceImage.match(/^data:(image\/[a-zA-Z0-9.+]+);base64,/);
    mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
    base64Data = sourceImage.split(',')[1] || sourceImage;
  }
  
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
5. COMPOSITION: MANDATORY framing requirement: Ensure there is a massive amount of empty vertical space (headroom) above the character's head. At least 35% of the total image height MUST be empty background space at the top of the frame. The character should be grounded in the lower two-thirds of the image. This is critical for professional cinematic portrait framing and to allow space for UI overlays.

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
