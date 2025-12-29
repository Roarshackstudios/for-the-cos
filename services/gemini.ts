import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

export async function processCosplayImage(
  sourceBase64: string,
  categoryName: string,
  subcategoryName: string,
  styleIntensity: number,
  customPrompt?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const mimeTypeMatch = sourceBase64.match(/^data:(image\/[a-zA-Z0-9.+]+);base64,/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
  const base64Data = sourceBase64.split(',')[1] || sourceBase64;
  
  let sceneDescription = "";
  if (customPrompt) {
    sceneDescription = customPrompt;
  } else if (subcategoryName === "Auto Detect") {
    sceneDescription = `a cinematic digital art backdrop that perfectly matches the character's costume in the style of ${categoryName}`;
  } else {
    sceneDescription = `a highly detailed ${subcategoryName} digital art environment in the style of ${categoryName}`;
  }

  let aestheticGuide = "";
  if (styleIntensity < 30) {
    aestheticGuide = "Use a stylized 2D anime cel-shaded illustrative aesthetic with bold graphic outlines for the background.";
  } else if (styleIntensity < 70) {
    aestheticGuide = "Use a cinematic digital painterly style with dramatic volumetric lighting and soft textures for the environment.";
  } else {
    aestheticGuide = "Use a high-fidelity digital art style with cinematic lighting, complex atmospheric effects, and professional color grading for the backdrop.";
  }

  const prompt = `Task: Background Replacement and Scene Integration.
Input: A reference image of a person in a cosplay costume.

CRITICAL REQUIREMENT: SUBJECT INTEGRITY
1. PRESERVE IDENTITY: You MUST keep the exact face, features, and likeness of the person in the input image. DO NOT generate a different person or alter their facial structure.
2. PRESERVE COSTUME: Keep the costume, props, and clothing details exactly as they appear in the source. Do not simplify or radically redesign the cosplay.
3. BLEND LIGHTING: The only change to the subject should be the lighting and color grading to ensure they look naturally integrated into the new environment.

Action: Generate a new environment: ${sceneDescription}.
Aesthetic: ${aestheticGuide}

Key Composition Requirements:
1. PORTRAIT FULL-BODY SHOT: Show the subject head-to-toe in a vertical frame.
2. PERFECT VERTICAL CENTERING: Position the subject exactly in the center of the vertical axis.
3. EQUAL TOP & BOTTOM MARGINS: Add large, equal amounts of empty space (padding) above the head and below the feet. 
4. 55% SUBJECT HEIGHT: The subject should occupy approximately 55% of the total frame height.
5. GENEROUS NEGATIVE SPACE: Maintain wide margins on all sides for cropping.
6. CINEMATIC INTEGRATION: Ensure the subject is seamlessly blended into the generated scenery with matching depth of field and atmospheric lighting.
7. Output ONLY the image data. No text, watermark, or labels.`;

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
        },
        safetySettings: [
          { 
            category: HarmCategory.HARM_CATEGORY_IMAGE_HARASSMENT as any, 
            threshold: HarmBlockThreshold.BLOCK_NONE as any
          },
          { 
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH as any, 
            threshold: HarmBlockThreshold.BLOCK_NONE as any
          },
          { 
            category: HarmCategory.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT as any, 
            threshold: HarmBlockThreshold.BLOCK_NONE as any
          },
          { 
            category: HarmCategory.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT as any, 
            threshold: HarmBlockThreshold.BLOCK_NONE as any
          },
        ]
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image was generated. This may be due to safety filters or input processing limits.");
  } catch (error: any) {
    console.error("Gemini processing error details:", error);
    const message = error.message || "";
    if (message.includes("safety")) throw new Error("The image was blocked by safety filters. Try a different scene or photo.");
    throw error;
  }
}