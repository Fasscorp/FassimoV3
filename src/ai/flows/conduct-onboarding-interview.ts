
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
    name: z.string().optional().describe("The user's name."), // Make optional initially
    goal: z.string().optional().describe("The user's goal for the 30-day trial."), // Make optional initially
    channel: z.enum(['Chat', 'Email', 'Whatsapp']).optional().describe("The user's preferred communication channel."), // Make optional initially
    hasStripe: z.boolean().optional().describe("Whether the user confirmed having a Stripe account."), // Added Stripe info
}).describe('The collected onboarding information.');
export type OnboardingData = z.infer<typeof OnboardingDataSchema>;

const ConductOnboardingInterviewOutputSchema = z.object({
  nextQuestion: z.string().optional().describe('The next question to ask the user. May contain [OPTIONS: ...] marker.'),
  isComplete: z.boolean().describe('Indicates if the interview is complete.'),
  onboardingData: OnboardingDataSchema.optional().describe('The final collected data when the interview is complete.'),
  // Optional flag to indicate the last answer was about Stripe
  answeredStripe: z.boolean().optional().describe('Flag indicating if the Stripe question was just answered.'),
});
export type ConductOnboardingInterviewOutput = z.infer<typeof ConductOnboardingInterviewOutputSchema>;

// Define expected questions
const QUESTIONS = {
    name: "What is your name?",
    goal: "What is your goal for the 30 day free trial?",
    channel: "What is your preferred channel of communication?", // Base question text
    channelWithOptions: "What is your preferred channel of communication? [OPTIONS: Chat, Email, Whatsapp]", // Question with marker for buttons
    stripe: "Do you have a Stripe account?", // Base question text
    stripeWithOptions: "Do you have a Stripe account? [OPTIONS: Yes, No]", // Question with marker for buttons
};

/**
 * Conducts the onboarding interview interactively based on conversation history.
 * @param input - Object containing the conversation history.
 * @returns An object containing the next question or the final onboarding data.
 */
export async function conductOnboardingInterview(input: ConductOnboardingInterviewInput): Promise<ConductOnboardingInterviewOutput> {
  console.log("[conductOnboardingInterview] Invoked with history length:", input.conversationHistory?.length ?? 0);
  // console.log("[conductOnboardingInterview] Full history:", JSON.stringify(input.conversationHistory, null, 2)); // Uncomment for deep debugging
  try {
    const result = await conductOnboardingInterviewFlow(input);
    console.log("[conductOnboardingInterview] Flow completed successfully. Result:", JSON.stringify(result, null, 2)); // Log result clearly
    return result;
  } catch (error) {
    console.error("[conductOnboardingInterview] Error executing flow:", error);
    // Return a default error state if the flow fails
    return {
        nextQuestion: "Sorry, I encountered an issue during the interview. Let's try starting the onboarding again.",
        isComplete: true, // Treat as complete to stop the interview loop on error
        onboardingData: undefined,
        answeredStripe: false, // Explicitly set on error
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
  // Refined prompt logic for clarity and sequence
  prompt: `You are an Onboarding Interviewer AI. Your task is to conduct a simple onboarding interview by asking questions ONE BY ONE based on the provided conversation history.

Conversation History (most recent message last):
{{#each conversationHistory}}
{{sender}}: {{text}}
{{/each}}

Interview Questions & Required Answers:
1. Name: "${QUESTIONS.name}" (Answer: Any non-empty string)
2. Goal: "${QUESTIONS.goal}" (Answer: Any non-empty string)
3. Channel: "${QUESTIONS.channel}" (Answer: Must be one of Chat, Email, or Whatsapp)
4. Stripe: "${QUESTIONS.stripe}" (Answer: Must be Yes or No)

Your Goal: Determine the *next* question to ask, or if the interview is complete.

Follow these steps STRICTLY:
1.  Analyze the history to see which questions have already been asked and answered correctly. Pay close attention to the *last* few messages to understand the current context. Look for both the AI asking the question and a subsequent user/action response.
2.  Extract any valid answers already provided (name, goal, channel, stripe status). Store them temporarily.
3.  Determine which question is NEXT in the sequence (Name -> Goal -> Channel -> Stripe).
4.  Has the 'Name' question ("${QUESTIONS.name}") been asked by the AI and answered by the user/action in the history? If NO, ask "${QUESTIONS.name}". Set 'isComplete' to false, 'onboardingData' to null, 'answeredStripe' to false. STOP HERE.
5.  Has the 'Goal' question ("${QUESTIONS.goal}") been asked by the AI *after* the name was answered, and answered by the user/action? If NO, ask "${QUESTIONS.goal}". Set 'isComplete' to false, 'onboardingData' to null, 'answeredStripe' to false. STOP HERE.
6.  Has the 'Channel' question ("${QUESTIONS.channelWithOptions}") been asked by the AI *after* the goal was answered, and answered VALIDLY (Chat, Email, or Whatsapp) by the user/action? If NO, ask "${QUESTIONS.channelWithOptions}". Set 'isComplete' to false, 'onboardingData' to null, 'answeredStripe' to false. VERY IMPORTANT: Include the "[OPTIONS: Chat, Email, Whatsapp]" marker exactly as written. STOP HERE.
7.  Has the 'Stripe' question ("${QUESTIONS.stripeWithOptions}") been asked by the AI *after* the channel was answered, and answered VALIDLY (Yes or No) by the user/action? If NO, ask "${QUESTIONS.stripeWithOptions}". Set 'isComplete' to false, 'onboardingData' to null, 'answeredStripe' to false. VERY IMPORTANT: Include the "[OPTIONS: Yes, No]" marker exactly as written. STOP HERE.

8.  Check for Interview Completion:
    a.  If you just asked the Stripe question in step 7, the interview is NOT complete yet. Go back to step 7 output.
    b.  Did the user *just* answer the Stripe question? Check if the last AI message asked "${QUESTIONS.stripeWithOptions}" AND the user's/action's latest response is 'Yes' or 'No'.
    c.  If YES (Stripe was just answered):
        - Extract name, goal, channel from history.
        - Determine 'hasStripe' (true for 'Yes', false for 'No').
        - Set 'isComplete' to true.
        - Set 'nextQuestion' to null.
        - Set 'answeredStripe' to true. // VERY IMPORTANT flag for the calling system
        - Populate 'onboardingData' with name, goal, channel, and hasStripe.
        - STOP. Output the final JSON.
    d.  If NO (Stripe wasn't just answered, maybe the history was already complete), but ALL answers (name, goal, channel, stripe) ARE present and valid in the history:
        - Extract name, goal, channel, and stripe answer from history.
        - Determine 'hasStripe'.
        - Set 'isComplete' to true.
        - Set 'nextQuestion' to null.
        - Set 'answeredStripe' to false. // It wasn't answered *this* turn
        - Populate 'onboardingData' with all extracted values.
        - STOP. Output the final JSON.

Output Format: Return ONLY a valid JSON object conforming to the output schema. Do not include any other text, explanation, or conversational elements. Ensure all required fields in the schema are present based on whether the interview is complete or not. If not complete, 'onboardingData' should be null or omitted. If complete, 'nextQuestion' should be null or omitted.
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
    console.log("[conductOnboardingInterviewFlow] ===== START FLOW =====");
    console.log("[conductOnboardingInterviewFlow] History length received:", input.conversationHistory?.length ?? 0);
    // console.log("[conductOnboardingInterviewFlow] Full history:", JSON.stringify(input.conversationHistory, null, 2)); // Verbose - uncomment if needed

    // Basic validation of history
    if (!input.conversationHistory) { // Removed length check, prompt handles empty history case
        console.warn("[conductOnboardingInterviewFlow] Warning: Null conversation history received. Prompt should handle asking the first question.");
        // Let the prompt handle asking the first question based on empty history
    }

    try {
        console.log("[conductOnboardingInterviewFlow] Calling onboardingInterviewPrompt...");
        const { output } = await onboardingInterviewPrompt(input);
        console.log("[conductOnboardingInterviewFlow] Raw prompt output:", JSON.stringify(output, null, 2)); // Log raw output

        if (!output) {
            console.error("[conductOnboardingInterviewFlow] Error: Prompt did not return an output.");
            throw new Error("Onboarding Interview prompt did not return an output.");
        }

        // --- Detailed Validation and Logging ---
        if (output.isComplete) {
          console.log("[conductOnboardingInterviewFlow] Output indicates interview IS COMPLETE.");
          if (!output.onboardingData) {
            console.error("[conductOnboardingInterviewFlow] Validation Error: isComplete=true but onboardingData is missing.");
            // Attempt to recover or provide minimal data if possible, or throw
             throw new Error("Interview marked complete but onboardingData is missing.");
          } else {
             console.log("[conductOnboardingInterviewFlow] Completed onboarding data received:", JSON.stringify(output.onboardingData));
             // Check required fields for completion (allow optional if that's intended)
             // Simplified checks - rely more on the prompt's structure
             if (typeof output.onboardingData.name !== 'string' || output.onboardingData.name === '') {
                 console.warn("[conductOnboardingInterviewFlow] Validation Warning: Completed data missing 'name'.");
             }
             if (typeof output.onboardingData.goal !== 'string' || output.onboardingData.goal === '') {
                 console.warn("[conductOnboardingInterviewFlow] Validation Warning: Completed data missing 'goal'.");
             }
             if (!output.onboardingData.channel || !['Chat', 'Email', 'Whatsapp'].includes(output.onboardingData.channel)) {
                 console.warn(`[conductOnboardingInterviewFlow] Validation Warning: Completed data has invalid 'channel': ${output.onboardingData.channel}`);
             }
             // Check hasStripe presence *only* if answeredStripe is true (critical for task creation logic)
             if (output.answeredStripe === true && typeof output.onboardingData.hasStripe !== 'boolean') {
                  console.error("[conductOnboardingInterviewFlow] Validation Error: answeredStripe=true but onboardingData.hasStripe is not boolean.");
                  throw new Error("Stripe answered but hasStripe boolean is missing in completed data.");
             } else if (output.answeredStripe !== true && typeof output.onboardingData.hasStripe !== 'boolean') {
                 // If not just answered, hasStripe might be missing if history was already complete before call
                 console.warn("[conductOnboardingInterviewFlow] Validation Warning: Interview complete, answeredStripe=false, and hasStripe is missing/not boolean. This might be ok if data was already complete.");
             }
          }

           if (output.nextQuestion) {
              console.warn("[conductOnboardingInterviewFlow] Validation Warning: Interview complete but nextQuestion is present. Clearing it.");
              output.nextQuestion = undefined; // Clean up inconsistent state
           }
           // Ensure answeredStripe is correctly set (true only if stripe was the last question answered)
           if (output.answeredStripe !== true) {
                console.log("[conductOnboardingInterviewFlow] Ensuring answeredStripe is false for completion (as it wasn't the last interaction).");
                output.answeredStripe = false; // Ensure it's false if not explicitly set to true by prompt logic
           } else {
               console.log("[conductOnboardingInterviewFlow] answeredStripe flag is TRUE, indicating Stripe was just answered.");
           }
           console.log("[conductOnboardingInterviewFlow] Completed data looks valid (or warnings noted).");

        } else { // Interview is NOT complete
           console.log("[conductOnboardingInterviewFlow] Output indicates interview IS NOT COMPLETE.");
           if (!output.nextQuestion || typeof output.nextQuestion !== 'string' || output.nextQuestion.trim() === '') {
              console.error("[conductOnboardingInterviewFlow] Validation Error: Interview not complete but nextQuestion is invalid or missing.");
              // Attempt to ask the first question again as fallback?
               throw new Error("Interview not complete but nextQuestion is invalid or missing.");
           }
            if (output.onboardingData) {
                console.warn("[conductOnboardingInterviewFlow] Validation Warning: Interview not complete but onboardingData is present. Clearing it.");
                output.onboardingData = undefined; // Clean up inconsistent state
            }
            // Ensure answeredStripe is false or undefined when not complete
            if (output.answeredStripe === true) {
                 console.warn("[conductOnboardingInterviewFlow] Validation Warning: Interview not complete but answeredStripe is true. Setting to false.");
                 output.answeredStripe = false;
            } else {
                 output.answeredStripe = false; // Ensure it's false if not set
            }
            console.log("[conductOnboardingInterviewFlow] Next question validated successfully:", output.nextQuestion);
        }

        console.log("[conductOnboardingInterviewFlow] Flow logic successful. Returning validated/cleaned output:", JSON.stringify(output, null, 2));
        console.log("[conductOnboardingInterviewFlow] ===== END FLOW =====");
        return output;

    } catch (error) {
        console.error("[conductOnboardingInterviewFlow] Error during prompt execution or validation:", error);
        console.log("[conductOnboardingInterviewFlow] ===== END FLOW (with error) =====");
        if (error instanceof Error) {
             // Throwing the error to be caught by the outer function for consistent error handling
             throw new Error(`Error in conductOnboardingInterviewFlow calling prompt: ${error.message}`);
        }
       throw new Error("Unknown error occurred within conductOnboardingInterviewFlow.");
    }
  }
);
