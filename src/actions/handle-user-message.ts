
'use server';

import { parseUserMessage } from '@/ai/flows/parse-user-message';
import { triageUserMessage } from '@/ai/flows/triage-user-message';
import { praiseAgent } from '@/ai/flows/praise-agent';
import { conductOnboardingInterview, type Message as OnboardingMessage, type OnboardingData } from '@/ai/flows/conduct-onboarding-interview';
import { z } from 'zod'; // Import zod for schema validation

/**
 * Represents the structured onboarding data.
 */
const OnboardingDataSchema = z.object({
  name: z.string().describe('The user\'s name.'),
  goal: z.string().describe('The user\'s goal for the 30-day trial.'),
  channel: z.enum(['Chat', 'Email', 'Whatsapp']).describe('The user\'s preferred communication channel.'),
});
// Note: OnboardingData type is now imported from the flow file

// Define the specific trigger messages
const ONBOARDING_TRIGGER = 'START_ONBOARDING_INTERVIEW';
const CREATE_PRODUCT_TRIGGER = 'START_CREATE_PRODUCT'; // Placeholder for future feature

// --- State Management (Simple Example - In-memory for this request) ---
// In a real application, this state should be stored persistently (e.g., Firestore, session storage)
interface ConversationState {
  currentFlow: 'onboarding' | 'praise' | 'create_product' | null;
  history: OnboardingMessage[];
  // Add other state variables as needed, e.g., userId
}

// WARNING: This in-memory state is NOT suitable for production.
// It will be lost on server restarts and won't work across multiple users or sessions.
// Use a database or session store for real applications.
let conversationState: ConversationState = {
    currentFlow: null,
    history: [],
};

// Helper function to add messages to the state
function addMessageToHistory(sender: OnboardingMessage['sender'], text: string) {
    const newMessage: OnboardingMessage = { sender, text };
    conversationState.history.push(newMessage);
    console.log("[addMessageToHistory] Updated history:", conversationState.history);
}


/**
 * Handles incoming user messages, manages conversation state, orchestrates agent interactions,
 * and routes to the appropriate flow based on the message content and state.
 *
 * @param message The user's message content or a special trigger.
 * @param channel The channel the message was received from (currently only 'chat' is fully handled).
 * @returns A promise that resolves to the final response string for the user.
 */
export async function handleUserMessage(message: string, channel: 'email' | 'whatsapp' | 'voice' | 'chat'): Promise<string> {
  console.log(`[handleUserMessage] Handling message from ${channel}: "${message}"`);
  console.log("[handleUserMessage] Current state before processing:", conversationState);


  // Determine the message sender type based on whether it's a trigger
  const senderType: OnboardingMessage['sender'] = [ONBOARDING_TRIGGER, CREATE_PRODUCT_TRIGGER].includes(message) ? 'action' : 'user';

  // Add user message/action to history *unless* it's the initial trigger for a flow
  // (The trigger itself doesn't need to be in the history passed to the flow)
  if (message !== ONBOARDING_TRIGGER && message !== CREATE_PRODUCT_TRIGGER) {
     addMessageToHistory(senderType, message);
  }


  try {
    // --- Onboarding Flow ---
    if (message === ONBOARDING_TRIGGER || conversationState.currentFlow === 'onboarding') {
      // Start or continue onboarding
      if (message === ONBOARDING_TRIGGER) {
        console.log("[handleUserMessage] Triggering onboarding interview...");
        conversationState.currentFlow = 'onboarding';
        // Clear history specific to onboarding if restarting
        // conversationState.history = []; // Decide if history should reset on explicit trigger
      } else {
          console.log("[handleUserMessage] Continuing onboarding interview...");
      }


      // Call the onboarding flow with the current history
      const onboardingResult = await conductOnboardingInterview({ conversationHistory: conversationState.history });
      console.log("[handleUserMessage] Onboarding flow returned:", onboardingResult);

      // Add AI response (question or completion message) to history
      if (onboardingResult.nextQuestion) {
          addMessageToHistory('ai', onboardingResult.nextQuestion);
      }

      // Check if the interview is complete
      if (onboardingResult.isComplete) {
        conversationState.currentFlow = null; // Reset flow state

        if (onboardingResult.onboardingData) {
          try {
            // Validate the structure (optional but recommended)
            OnboardingDataSchema.parse(onboardingResult.onboardingData);
            const jsonResponse = JSON.stringify(onboardingResult.onboardingData, null, 2);
            const finalMessage = `Onboarding complete! Here's the collected information:\n\`\`\`json\n${jsonResponse}\n\`\`\``;
            addMessageToHistory('ai', finalMessage); // Add final summary to history
            console.log("[handleUserMessage] Returning formatted onboarding data:", finalMessage);
            return finalMessage;
          } catch (validationError) {
            console.error("[handleUserMessage] Error validating onboarding result schema:", validationError);
            const errorMsg = "Sorry, there was an issue processing the final onboarding information format.";
             addMessageToHistory('ai', errorMsg);
            return errorMsg;
          }
        } else {
            // Should ideally not happen if isComplete is true based on the flow logic
            console.error("[handleUserMessage] Onboarding complete but no data returned.");
             const errorMsg = "Onboarding seems complete, but I couldn't retrieve the final data.";
             addMessageToHistory('ai', errorMsg);
             return errorMsg;
        }
      } else if (onboardingResult.nextQuestion) {
        // Ask the next question
        console.log("[handleUserMessage] Asking next onboarding question:", onboardingResult.nextQuestion);
        return onboardingResult.nextQuestion;
      } else {
         // Handle unexpected case where interview is not complete but no question is provided
         console.error("[handleUserMessage] Onboarding flow error: Not complete, but no next question.");
         const errorMsg = "Sorry, I got stuck during the onboarding process. Could you try starting again?";
         addMessageToHistory('ai', errorMsg);
         conversationState.currentFlow = null; // Reset flow
         return errorMsg;
      }

    // --- Placeholder for Create Product Flow ---
    } else if (message === CREATE_PRODUCT_TRIGGER) {
        console.log("[handleUserMessage] Placeholder for Create Product flow.");
         conversationState.currentFlow = 'create_product'; // Set state if needed later
         const response = "The 'Create Product' feature is not implemented yet.";
         addMessageToHistory('ai', response);
         conversationState.currentFlow = null; // Reset immediately for this placeholder
         return response;

    // --- Default/Praise Agent Flow ---
    } else {
        // If no specific flow is active, default to parsing and potentially praise
        console.log("[handleUserMessage] No active flow, proceeding with default handling.");
        conversationState.currentFlow = 'praise'; // Set state for clarity

        // 1. Communication Agent (Initial Parsing) -> Executive Agent (Simplified)
        console.log("[handleUserMessage] Step 1: Calling parseUserMessage...");
        const parsedMessage = await parseUserMessage({ message, channel }); // Assuming parse doesn't need full history for now
        console.log("[handleUserMessage] Step 1: parseUserMessage successful. Result:", parsedMessage);
        // We might add parsedMessage details to history if needed later

        // 2. Executive Agent (Triage - Simplified)
        console.log("[handleUserMessage] Step 2: Calling triageUserMessage...");
        const triageResult = await triageUserMessage({ message, channel }); // Assuming triage doesn't need full history
        console.log("[handleUserMessage] Step 2: triageUserMessage successful. Result:", triageResult);

        // If marked as spam, respond appropriately and exit.
        if (triageResult.isSpam) {
            console.log("[handleUserMessage] Message identified as spam.");
            const spamResponse = "This message appears to be spam and has been discarded.";
            addMessageToHistory('ai', spamResponse);
            conversationState.currentFlow = null; // Reset flow
            return spamResponse;
        }

        // 3. Executive Agent (Direct Delegation to Praise Agent for testing)
        console.log("[handleUserMessage] Step 3: Calling praiseAgent...");
        // Praise agent likely only needs the current message, not full history
        const praiseResult = await praiseAgent({ message: message });
        console.log("[handleUserMessage] Step 3: praiseAgent successful. Result:", praiseResult);

        // Check if the Praise Agent returned a valid result
        if (!praiseResult || typeof praiseResult.praisedMessage !== 'string') {
            console.error("[handleUserMessage] Error: Praise Agent did not return a valid praised message. Result:", praiseResult);
            const errorResponse = "Sorry, the Praise Agent couldn't process the message correctly.";
             addMessageToHistory('ai', errorResponse);
             conversationState.currentFlow = null; // Reset flow
             return errorResponse;
        }

        // 4. Return Praise Agent's Response
        console.log("[handleUserMessage] Step 4: Returning praised message to user:", praiseResult.praisedMessage);
        addMessageToHistory('ai', praiseResult.praisedMessage);
        conversationState.currentFlow = null; // Reset flow
        return praiseResult.praisedMessage;
    }

  } catch (error: any) {
    console.error("[handleUserMessage] Error caught in top-level try-catch:", error);
    const errorMessage = error?.message || 'Unknown error';
    const finalErrorMsg = `Sorry, I encountered an internal error while processing your request. Please try again later. (Details: ${errorMessage})`;
    addMessageToHistory('ai', finalErrorMsg); // Log error response to history
    conversationState.currentFlow = null; // Reset flow state on error
    return finalErrorMsg;
  } finally {
       console.log("[handleUserMessage] Final state after processing:", conversationState);
  }
}

// TODO: Replace in-memory state with a persistent solution (Firestore, session storage, etc.)
// TODO: Implement actual sub-agent execution logic (`executeSubAgentTask`) when needed for other flows.
// TODO: Integrate ModelContextProtocol SDK for tool usage within sub-agents.
// TODO: Implement actual channel integrations (Email, WhatsApp, Voice) - these would likely trigger this action.

    