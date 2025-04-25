'use server';

import { parseUserMessage } from '@/ai/flows/parse-user-message';
import { triageUserMessage } from '@/ai/flows/triage-user-message';
import { praiseAgent } from '@/ai/flows/praise-agent';
import { conductOnboardingInterview } from '@/ai/flows/conduct-onboarding-interview'; // Import the new onboarding flow
import { z } from 'zod'; // Import zod for schema validation

/**
 * Represents the structured onboarding data.
 */
const OnboardingDataSchema = z.object({
  name: z.string().describe('The user\'s name.'),
  goal: z.string().describe('The user\'s goal for the 30-day trial.'),
  channel: z.enum(['Chat', 'Email', 'Whatsapp']).describe('The user\'s preferred communication channel.'),
});
type OnboardingData = z.infer<typeof OnboardingDataSchema>;


// Define the specific trigger message for onboarding
const ONBOARDING_TRIGGER = 'START_ONBOARDING_INTERVIEW';

/**
 * Handles incoming user messages, orchestrates agent interactions,
 * and routes to the appropriate flow based on the message content.
 *
 * @param message The user's message content or a special trigger like 'START_ONBOARDING_INTERVIEW'.
 * @param channel The channel the message was received from (e.g., 'chat', 'email', 'whatsapp', 'voice').
 * @returns A promise that resolves to the final response string for the user.
 */
export async function handleUserMessage(message: string, channel: 'email' | 'whatsapp' | 'voice' | 'chat'): Promise<string> {
  console.log(`[handleUserMessage] Handling message from ${channel}: "${message}"`);

  try {
    // Check if the message is the trigger for the onboarding interview
    if (message === ONBOARDING_TRIGGER && channel === 'chat') {
      console.log("[handleUserMessage] Triggering onboarding interview...");
      const onboardingResult = await conductOnboardingInterview({}); // Call the onboarding flow
      console.log("[handleUserMessage] Onboarding interview completed. Result:", onboardingResult);

      // Validate the structure (optional but recommended)
       try {
          // Attempt to parse the result against the schema
          OnboardingDataSchema.parse(onboardingResult.onboardingData);
          // Format the result as a JSON string for display
          const jsonResponse = JSON.stringify(onboardingResult.onboardingData, null, 2);
          console.log("[handleUserMessage] Returning formatted onboarding data:", jsonResponse);
          return `Onboarding complete! Here's the collected information:\n\`\`\`json\n${jsonResponse}\n\`\`\``;
        } catch (validationError) {
           console.error("[handleUserMessage] Error validating onboarding result schema:", validationError);
           // Provide a user-friendly error message if validation fails
           return "Sorry, there was an issue processing the onboarding information format. Please try again.";
        }

    } else {
      // --- Existing Message Handling (Simplified Praise Agent Flow for testing) ---

      // 1. Communication Agent (Initial Parsing) -> Executive Agent (Simplified)
      console.log("[handleUserMessage] Step 1: Calling parseUserMessage...");
      const parsedMessage = await parseUserMessage({ message, channel });
      console.log("[handleUserMessage] Step 1: parseUserMessage successful. Result:", parsedMessage);

      // 2. Executive Agent (Triage - Simplified)
      console.log("[handleUserMessage] Step 2: Calling triageUserMessage...");
      const triageResult = await triageUserMessage({ message, channel });
      console.log("[handleUserMessage] Step 2: triageUserMessage successful. Result:", triageResult);

      // If marked as spam, respond appropriately and exit.
      if (triageResult.isSpam) {
        console.log("[handleUserMessage] Message identified as spam.");
        return "This message appears to be spam and has been discarded.";
      }

      // 3. Executive Agent (Direct Delegation to Praise Agent for testing)
      console.log("[handleUserMessage] Step 3: Calling praiseAgent...");
      const praiseResult = await praiseAgent({ message: message });
      console.log("[handleUserMessage] Step 3: praiseAgent successful. Result:", praiseResult);

      // Check if the Praise Agent returned a valid result and the praised message
      if (!praiseResult || typeof praiseResult.praisedMessage !== 'string') {
          console.error("[handleUserMessage] Error: Praise Agent did not return a valid praised message. Result:", praiseResult);
          return "Sorry, the Praise Agent couldn't process the message correctly due to an invalid response structure.";
      }

      // 4. Return Praise Agent's Response
      console.log("[handleUserMessage] Step 4: Returning praised message to user:", praiseResult.praisedMessage);
      return praiseResult.praisedMessage;
    }

  } catch (error: any) {
    console.error("[handleUserMessage] Error caught in top-level try-catch:", error);
    // Check if the error object has a message property
    const errorMessage = error?.message || 'Unknown error';
    return `Sorry, I encountered an internal error while processing your request. Please try again later. (Details: ${errorMessage})`;
  }
}

// TODO: Restore the full multi-agent workflow (decomposition, sub-agent execution, verification, summarization, final response generation) when needed.
// TODO: Implement actual sub-agent execution logic (`executeSubAgentTask`)
// TODO: Integrate ModelContextProtocol SDK for tool usage within sub-agents
// TODO: Implement actual channel integrations (Email, WhatsApp, Voice) - these would likely trigger this action.
// TODO: Implement multi-turn state management for the onboarding interview if required later.
