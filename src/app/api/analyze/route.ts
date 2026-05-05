import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI with the API key from environment variables
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(request: NextRequest) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured.' },
        { status: 500 }
      );
    }

    const { image, referenceAllowed, referenceRejected } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build the multimodal prompt
    const promptParts: (string | { inlineData: { data: string; mimeType: string } })[] = [
      `You are an AI study supervisor. Your job is to determine if the "Current Image" shows the student studying or working.
      
      Criteria for STUDYING:
      - Student is present in the frame.
      - Student is looking at a computer screen, books, or writing.
      - Student appears focused and engaged with study materials.
      
      Criteria for NOT STUDYING:
      - Student is missing from the frame (empty chair).
      - Student is sleeping or has eyes closed.
      - Student is clearly using a phone for entertainment (not as a tool).
      - Student is looking away from their work for an extended period.
      
      Use your general knowledge of study behavior to decide.`,
    ];

    if (referenceAllowed) {
      promptParts.push('The student previously provided this as an example of their ACTIVE study posture:');
      promptParts.push({
        inlineData: {
          data: referenceAllowed.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/jpeg',
        },
      });
    }

    if (referenceRejected) {
      promptParts.push('The student previously provided this as an example of what they look like when DISTRACTED:');
      promptParts.push({
        inlineData: {
          data: referenceRejected.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/jpeg',
        },
      });
    }

    promptParts.push('Now, analyze this "Current Image" and decide if they are studying right now:');
    promptParts.push({
      inlineData: {
        data: image.replace(/^data:image\/\w+;base64,/, ''),
        mimeType: 'image/jpeg',
      },
    });

    promptParts.push('Respond ONLY with a JSON object: {"isStudying": boolean, "reason": "short explanation"}.');

    const result = await model.generateContent(promptParts);
    const responseText = result.response.text();
    
    // Parse the JSON response
    // Sometimes the model wraps JSON in markdown block like ```json ... ```
    let parsedResponse = { isStudying: false, reason: "Could not analyze the image properly." };
    try {
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Failed to parse AI response:", responseText, parseError);
      // Fallback: simple text match
      if (responseText.toLowerCase().includes('"isstudying": true') || responseText.toLowerCase().includes('true')) {
        parsedResponse.isStudying = true;
      }
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: 'Failed to analyze the image.' },
      { status: 500 }
    );
  }
}
