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

    const { image, mode, goal, referenceAllowed, referenceRejected } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    // Build the multimodal prompt
    const isScreen = mode === 'screen';
    const promptParts: (string | { inlineData: { data: string; mimeType: string } })[] = [
      `You are an AI study supervisor acting as a "Digital Body Double" for a student with ADHD. 
      Your job is to determine if the "Current Image" shows the student successfully working on their specific goal.
      
      STUDENT'S STATED GOAL: "${goal || 'General Studying'}"
      
      ${isScreen ? `
      CONTEXT: This is a screenshot of the student's COMPUTER SCREEN.
      
      Criteria for STUDYING (Screen):
      - The content on the screen MUST be related to: "${goal || 'General Studying'}".
      - Educational websites, programming tools, or document editors showing active work on this goal.
      - Specifically look for indicators that match the goal text.
      
      Criteria for NOT STUDYING (Screen):
      - Clear distractions: Video games, social media (Instagram, Twitter), shopping, or general entertainment.
      - YouTube is generally REJECTED unless the video title/content is EXPLICITLY educational and matches the goal: "${goal}".
      - Any browsing content that has NO direct relation to the stated goal.
      ` : `
      CONTEXT: This is a photo of the student from their WEBCAM.
      
      Criteria for STUDYING (Webcam):
      - Student is present and focused on the screen or paper.
      - Their posture and activity suggest they are working on: "${goal || 'General Studying'}".
      
      Criteria for NOT STUDYING (Webcam):
      - Student is missing, sleeping, or playing on a phone.
      - Student looks completely disengaged from the task.
      `}
      
      BEHAVIORAL NUDGE:
      If they are NOT studying, your "reason" should be a supportive but firm ADHD-friendly nudge (e.g., "It looks like you got distracted by YouTube. Let's get back to [Goal]!").
      
      Respond ONLY with a JSON object: {"isStudying": boolean, "reason": "short explanation/nudge"}.`,
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

    console.log(`[AI Analyze] Mode: ${mode}, Goal: ${goal || 'None'}`);
    const result = await model.generateContent(promptParts);
    const responseText = result.response.text();
    
    // Parse the JSON response
    let parsedResponse = { isStudying: false, reason: "Could not analyze the image properly." };
    try {
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanJson);
      console.log(`[AI Decision] Studying: ${parsedResponse.isStudying}, Reason: ${parsedResponse.reason}`);
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
