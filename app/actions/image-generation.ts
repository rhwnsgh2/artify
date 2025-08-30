"use server";

import { getGeminiModel } from "@/lib/gemini";
import { compressImage } from "@/lib/image-utils";

export async function generateImageFromText(prompt: string) {
  try {
    const model = getGeminiModel();

    // Generate image with Gemini 2.5 Flash Image Preview
    const result = await model.generateContent(prompt);

    const response = result.response;
    // Check for generated image in the response
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          // Check if this part contains image data
          if (part.inlineData && part.inlineData.data) {
            return {
              success: true,
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType || "image/png",
            };
          }
        }
      }
    }

    // If no image was generated, return text response
    const textResponse = response.text();
    return {
      success: true,
      data: textResponse,
      isDescription: true,
    };
  } catch (error) {
    console.error("Error generating image:", error);
    return { success: false, error: "Failed to generate image" };
  }
}

export async function combineImages(image1: string, image2: string, combinePrompt: string) {
  try {
    // Compress images before sending to API
    const compressedImage1 = await compressImage(image1);
    const compressedImage2 = await compressImage(image2);
    
    const model = getGeminiModel();

    // Gemini 2.5 Flash Image는 이미지를 분석하고 설명을 생성하는 모델이므로
    // 새 이미지 생성을 명시적으로 요청
    const enhancedPrompt = `Generate a new image based on these requirements:

${combinePrompt}

Use the two provided reference images as inspiration:
- Reference Image 1: [First uploaded image]
- Reference Image 2: [Second uploaded image]

IMPORTANT: Create a completely NEW generated image that incorporates elements, styles, or concepts from both reference images while fulfilling the prompt: "${combinePrompt}"

This should be a newly generated image, not a copy or slight modification of the input images.`;

    // 프롬프트를 먼저 보내고 이미지를 나중에
    const result = await model.generateContent([
      enhancedPrompt,
      { inlineData: { mimeType: "image/jpeg", data: compressedImage1 } },
      { inlineData: { mimeType: "image/jpeg", data: compressedImage2 } },
    ]);

    const response = result.response;
    
    // 디버깅: 응답 확인
    console.log("Combine response:", {
      hasCandidate: (response.candidates?.length ?? 0) > 0,
      partsCount: response.candidates?.[0]?.content?.parts?.length,
    });

    // Check for generated image in the response
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            // 입력 이미지와 비교
            const isFirstImage = part.inlineData.data === compressedImage1;
            const isSecondImage = part.inlineData.data === compressedImage2;
            
            if (isFirstImage || isSecondImage) {
              console.warn(`WARNING: Output matches ${isFirstImage ? 'first' : 'second'} input image!`);
              // 입력 이미지와 같다면 재시도
              break;
            } else {
              console.log("New image generated successfully");
              return {
                success: true,
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType || "image/png",
              };
            }
          }
        }
      }
    }

    // 다른 방법 시도 - 이미지 편집 방식으로 접근
    console.log("Trying edit-based approach...");
    
    const editPrompt = `Take the first image and modify it by incorporating elements from the second image to: ${combinePrompt}

Specific instructions:
1. Use the first image as the base
2. Add elements, styles, or concepts from the second image
3. Create a result that: ${combinePrompt}
4. The output must be a newly generated/edited image

Generate the edited image now.`;

    const editResult = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: compressedImage1 } },
      { inlineData: { mimeType: "image/jpeg", data: compressedImage2 } },
      editPrompt,
    ]);

    const editResponse = editResult.response;
    
    if (editResponse.candidates && editResponse.candidates.length > 0) {
      const candidate = editResponse.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            // 입력 이미지와 다른지 확인
            if (part.inlineData.data !== compressedImage1 && part.inlineData.data !== compressedImage2) {
              return {
                success: true,
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType || "image/png",
              };
            }
          }
        }
      }
    }
    
    // 마지막 시도 - 텍스트 기반 생성
    console.log("Trying text-based generation...");
    
    const textGenPrompt = `Based on analyzing two reference images, generate a new image that: ${combinePrompt}

The new image should be inspired by the visual elements, styles, and concepts from both reference images but be a completely new creation.`;

    const textGenResult = await model.generateContent(textGenPrompt);
    const textGenResponse = textGenResult.response;
    
    if (textGenResponse.candidates && textGenResponse.candidates.length > 0) {
      const candidate = textGenResponse.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return {
              success: true,
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType || "image/png",
            };
          }
        }
      }
    }
    
    // 이미지 생성이 안 되는 경우 텍스트 응답 반환
    return { 
      success: true, 
      data: textGenResponse.text() || editResponse.text() || response.text(), 
      isDescription: true,
      message: "현재 Gemini 2.5 Flash Image는 이미지 분석은 가능하지만 새 이미지 생성에 제한이 있습니다. 이미지 생성을 위해서는 Stable Diffusion, DALL-E 등의 전용 이미지 생성 API가 필요합니다."
    };
  } catch (error) {
    console.error("Error combining images:", error);
    return { success: false, error: "Failed to combine images" };
  }
}

export async function editImage(imageData: string, editPrompt: string) {
  try {
    // Compress image before sending to API
    const compressedImage = await compressImage(imageData);
    
    const model = getGeminiModel();

    // 편집된 이미지를 확실히 생성하도록 프롬프트 강화
    const enhancedPrompt = `Generate an edited version of this image with the following modifications: ${editPrompt}

IMPORTANT INSTRUCTIONS:
- You MUST generate and return a modified image based on the input image
- Apply the requested edits while preserving the overall structure and context
- Maintain the original image's quality and resolution
- Make the edits clearly visible and noticeable
- Return the edited image, not a description

Specific edit request: ${editPrompt}`;

    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: compressedImage } },
      enhancedPrompt,
    ]);

    const response = result.response;

    // Check for generated image in the response
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return {
              success: true,
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType || "image/png",
            };
          }
        }
      }
    }

    // 이미지가 반환되지 않았을 경우, 더 명확한 프롬프트로 재시도
    console.log("No image returned, retrying with enhanced prompt...");
    
    const retryPrompt = `EDIT THIS IMAGE: ${editPrompt}
    
You are an image editing AI. You must:
1. Take the provided image
2. Apply the following edits: ${editPrompt}
3. Generate and return the edited image
4. DO NOT return text descriptions - return the actual edited image

The user wants to see the edited image with these changes: ${editPrompt}`;

    const retryResult = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: compressedImage } },
      retryPrompt,
    ]);

    const retryResponse = retryResult.response;
    
    if (retryResponse.candidates && retryResponse.candidates.length > 0) {
      const candidate = retryResponse.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return {
              success: true,
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType || "image/png",
            };
          }
        }
      }
    }
    
    // 그래도 이미지가 없으면 텍스트 응답 반환
    return { 
      success: true, 
      data: retryResponse.text() || response.text(), 
      isDescription: true,
      message: "이미지 편집을 생성할 수 없습니다. 다른 편집 지시를 시도해보세요."
    };
  } catch (error) {
    console.error("Error editing image:", error);
    return { success: false, error: "Failed to edit image" };
  }
}

