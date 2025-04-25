
'use server';
/**
 * @fileOverview Defines the Onboarding Interviewer Agent flow.
 * This agent asks onboarding questions interactively based on conversation history.
 *
 * - conductOnboardingInterview - Function to invoke the onboarding interview flow.
 * - ConductOnboardingInterviewInput - Input type containing conversation history.
 * - ConductOnboardingInterviewOutput - Output type containing the next question or final data.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// Define the structure for a single message in the history
const MessageSchema = z.object({
  sender: z.enum(['user', 'ai', 'system', 'action']), // Include 'action' if button clicks are part of history
  text: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

// Input schema: Takes the conversation history
const ConductOnboardingInterviewInputSchema = z.object({
  conversationHistory: z.array(MessageSchema).describe('The history of the conversation so far.'),
});
export type ConductOnboardingInterviewInput = z.infer<typeof ConductOnboardingInterviewInputSchema>;

// Output schema: Provides the next question or the final collected data
const OnboardingDataSchema = z.object({
    name: z.string().describe("The user's name."),
    goal: z.string().describe("The user's goal for the 30-day trial."),
    channel: z.enum(['Chat', 'Email', 'Whatsapp']).describe("The user's preferred communication channel."),
}).describe('The collected onboarding information.');
export type OnboardingData = z.infer<typeof OnboardingDataSchema>;

const ConductOnboardingInterviewOutputSchema = z.object({
  nextQuestion: z.string().optional().describe('The next question to ask the user. May contain [OPTIONS: ...] marker.'),
  isComplete: z.boolean().describe('Indicates if the interview is complete.'),
  onboardingData: OnboardingDataSchema.optional().describe('The final collected data when the interview is complete.'),
});
export type ConductOnboardingInterviewOutput = z.infer<typeof ConductOnboardingInterviewOutputSchema>;

// Define expected questions
const QUESTIONS = {
    name: "What is your name?",
    goal: "What is your goal for the 30 day free trial?",
    channel: "What is your preferred channel of communication?", // Base question text
    channelWithOptions: "What is your preferred channel of communication? [OPTIONS: Chat, Email, Whatsapp]", // Question with marker for buttons
};

/**
 * Conducts the onboarding interview interactively based on conversation history.
 * @param input - Object containing the conversation history.
 * @returns An object containing the next question or the final onboarding data.
 */
export async function conductOnboardingInterview(input: ConductOnboardingInterviewInput): Promise<ConductOnboardingInterviewOutput> {
  console.log("[conductOnboardingInterview] Invoked with history:", JSON.stringify(input.conversationHistory, null, 2));
  try {
    const result = await conductOnboardingInterviewFlow(input);
    console.log("[conductOnboardingInterview] Flow completed successfully. Result:", result);
    return result;
  } catch (error) {
    console.error("[conductOnboardingInterview] Error executing flow:", error);
    // Return a default error state if the flow fails
    return {
        nextQuestion: "Sorry, I encountered an issue during the interview. Let's try starting the onboarding again.",
        isComplete: true, // Treat as complete to stop the interview loop on error
        onboardingData: undefined,
    }
  }
}

// Define the prompt for the Onboarding Interviewer Agent
const onboardingInterviewPrompt = ai.definePrompt({
  name: 'onboardingInterviewPrompt',
  input: {
    schema: ConductOnboardingInterviewInputSchema, // Takes conversation history
  },
  output: {
    schema: ConductOnboardingInterviewOutputSchema, // Expects the structured output (next question or final data)
  },
  prompt: `You are an Onboarding Interviewer AI. Your task is to conduct a simple onboarding interview based on the provided conversation history. Ask the questions one by one.

Conversation History:
{{#each conversationHistory}}
{{sender}}: {{text}}
{{/each}}

Analyze the history to determine which questions have been answered:
1. Name: "${QUESTIONS.name}"
2. Goal: "${QUESTIONS.goal}"
3. Channel: "${QUESTIONS.channel}" (Must be one of Chat, Email, or Whatsapp)

If the user has not yet answered the 'name' question, ask: "${QUESTIONS.name}". Set 'isComplete' to false.
If the user has answered 'name' but not 'goal', ask: "${QUESTIONS.goal}". Set 'isComplete' to false.
If the user has answered 'name' and 'goal' but not 'channel', ask: "${QUESTIONS.channelWithOptions}". Set 'isComplete' to false. VERY IMPORTANT: Include the "[OPTIONS: Chat, Email, Whatsapp]" marker exactly as written in the question.

If the user has answered all three questions:
- Extract the name, goal, and channel (ensure channel is exactly 'Chat', 'Email', or 'Whatsapp' based on their response to the channel question).
- Set 'isComplete' to true.
- Set 'nextQuestion' to null or omit it.
- Populate the 'onboardingData' object with the extracted values.
- Do not ask any more questions.

Return ONLY a valid JSON object conforming to the output schema. Do not include any other text, explanation, or conversational elements.
`,
});

// Define the Genkit flow for the Onboarding Interviewer Agent
const conductOnboardingInterviewFlow = ai.defineFlow<
  typeof ConductOnboardingInterviewInputSchema,
  typeof ConductOnboardingInterviewOutputSchema
>(
  {
    name: 'conductOnboardingInterviewFlow',
    inputSchema: ConductOnboardingInterviewInputSchema,
    outputSchema: ConductOnboardingInterviewOutputSchema,
  },
  async (input) => {
    console.log("[conductOnboardingInterviewFlow] Flow invoked with history:", JSON.stringify(input.conversationHistory, null, 2));
    try {
        console.log("[conductOnboardingInterviewFlow] Calling onboardingInterviewPrompt...");
        const { output } = await onboardingInterviewPrompt(input);
        console.log("[conductOnboardingInterviewFlow] Prompt returned output:", JSON.stringify(output, null, 2));

        if (!output) {
            console.error("[conductOnboardingInterviewFlow] Error: Prompt did not return an output.");
            throw new Error("Onboarding Interview prompt did not return an output.");
        }

        // Validate output structure based on completion status
        if (output.isComplete) {
          if (!output.onboardingData || typeof output.onboardingData.name !== 'string' || typeof output.onboardingData.goal !== 'string' || !['Chat', 'Email', 'Whatsapp'].includes(output.onboardingData.channel)) {
            console.error("[conductOnboardingInterviewFlow] Error: Interview marked complete but onboardingData is invalid or missing. Output:", output);
            // Attempt to recover if possible, otherwise throw
             if (output.onboardingData && !['Chat', 'Email', 'Whatsapp'].includes(output.onboardingData.channel)) {
                 console.warn("[conductOnboardingInterviewFlow] Warning: Invalid channel detected in completed data. Attempting to fix or request again might be needed.");
                 // For now, throw error, but could add logic to re-ask the channel question
             }
            throw new Error("Interview marked complete but onboardingData is invalid or missing.");
          }
          if (output.nextQuestion) {
             console.warn("[conductOnboardingInterviewFlow] Warning: Interview complete but nextQuestion is present. Clearing it. Output:", output);
             // Clear nextQuestion if it shouldn't be there
             output.nextQuestion = undefined;
          }
        } else {
          if (!output.nextQuestion || typeof output.nextQuestion !== 'string') {
            console.error("[conductOnboardingInterviewFlow] Error: Interview not complete but nextQuestion is invalid or missing. Output:", output);
            throw new Error("Interview not complete but nextQuestion is invalid or missing.");
          }
          if (output.onboardingData) {
              console.warn("[conductOnboardingInterviewFlow] Warning: Interview not complete but onboardingData is present. Clearing it. Output:", output);
              // Clear onboardingData if it shouldn't be there
              output.onboardingData = undefined;
          }
        }

        console.log("[conductOnboardingInterviewFlow] Flow successful. Returning output:", output);
        return output;
    } catch (error) {
        console.error("[conductOnboardingInterviewFlow] Error during prompt execution:", error);
        if (error instanceof Error) {
             throw new Error(`Error in conductOnboardingInterviewFlow calling prompt: ${error.message}`);
        }
       throw new Error("Unknown error occurred within conductOnboardingInterviewFlow.");
    }
  }
);
