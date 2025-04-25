
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
const RESET_CONVERSATION_TRIGGER = 'RESET_CONVERSATION'; // Trigger for resetting

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

// Helper function to reset the state
function resetConversationState() {
    console.log("[resetConversationState] Resetting state.");
    conversationState = {
        currentFlow: null,
        history: [],
    };
}


// Helper function to add messages to the state
function addMessageToHistory(sender: OnboardingMessage['sender'], text: string) {
    // Prevent adding reset trigger to history
    if (text === RESET_CONVERSATION_TRIGGER) return;
    const newMessage: OnboardingMessage = { sender, text };
    conversationState.history.push(newMessage);
    console.log("[addMessageToHistory] Updated history:", conversationState.history);
}

// Interface for the response sent back to the UI
interface HandleUserMessageResponse {
    responseText: string;
    actions?: Array<{ label: string; trigger: string }>;
}


/**
 * Handles incoming user messages, manages conversation state, orchestrates agent interactions,
 * and routes to the appropriate flow based on the message content and state.
 *
 * @param message The user's message content or a special trigger.
 * @param channel The channel the message was received from (currently only 'chat' is fully handled).
 * @returns A promise that resolves to the final response object for the UI.
 */
export async function handleUserMessage(message: string, channel: 'email' | 'whatsapp' | 'voice' | 'chat'): Promise<HandleUserMessageResponse> {
  console.log(`[handleUserMessage] Handling message from ${channel}: "${message}"`);
  console.log("[handleUserMessage] Current state before processing:", conversationState);

  // --- Reset Flow ---
  if (message === RESET_CONVERSATION_TRIGGER) {
    console.log("[handleUserMessage] Received reset trigger.");
    resetConversationState();
    // Optionally return a confirmation message, or let the UI handle resetting the display
    return { responseText: "Conversation reset." };
  }


  // Determine the message sender type based on whether it's a trigger or a button response
  // Treat button responses (like Chat, Email, Whatsapp) as 'user' input for the LLM history.
  const senderType: OnboardingMessage['sender'] =
    (message === ONBOARDING_TRIGGER || message === CREATE_PRODUCT_TRIGGER) ? 'action' : 'user';


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
        // Ensure history is clean for a new onboarding session triggered explicitly
        // Note: history might contain the 'START_ONBOARDING_INTERVIEW' action message if added above,
        // which is fine for the LLM context. Resetting here would remove that context.
        // conversationState.history = []; // Reconsider if a full reset is needed here
      } else {
          console.log("[handleUserMessage] Continuing onboarding interview...");
      }


      // Call the onboarding flow with the current history
      const onboardingResult = await conductOnboardingInterview({ conversationHistory: conversationState.history });
      console.log("[handleUserMessage] Onboarding flow returned:", onboardingResult);

      // Add AI response (question or completion message) to history
      if (onboardingResult.nextQuestion) {
          // Don't add the [OPTIONS] marker to history
          const questionText = onboardingResult.nextQuestion.replace(/ \[OPTIONS:.*?\]$/, '');
          addMessageToHistory('ai', questionText);
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
            return { responseText: finalMessage };
          } catch (validationError) {
            console.error("[handleUserMessage] Error validating onboarding result schema:", validationError);
            const errorMsg = "Sorry, there was an issue processing the final onboarding information format.";
             addMessageToHistory('ai', errorMsg);
            return { responseText: errorMsg };
          }
        } else {
            // Should ideally not happen if isComplete is true based on the flow logic
            console.error("[handleUserMessage] Onboarding complete but no data returned.");
             const errorMsg = "Onboarding seems complete, but I couldn't retrieve the final data.";
             addMessageToHistory('ai', errorMsg);
             return { responseText: errorMsg };
        }
      } else if (onboardingResult.nextQuestion) {
        // Check for the [OPTIONS] marker to generate buttons
        const optionsMatch = onboardingResult.nextQuestion.match(/ \[OPTIONS: (.*?)\]$/);
        let actions: Array<{ label: string; trigger: string }> | undefined = undefined;
        let questionText = onboardingResult.nextQuestion;

        if (optionsMatch) {
          const options = optionsMatch[1].split(',').map(opt => opt.trim());
          actions = options.map(opt => ({ label: opt, trigger: opt })); // Use option text as trigger
          questionText = onboardingResult.nextQuestion.replace(/ \[OPTIONS:.*?\]$/, ''); // Remove marker from text shown to user
          console.log(`[handleUserMessage] Found options: ${options.join(', ')}. Generating actions.`);
        }

        // Ask the next question, potentially with actions (buttons)
        console.log("[handleUserMessage] Asking next onboarding question:", questionText);
        return { responseText: questionText, actions: actions };

      } else {
         // Handle unexpected case where interview is not complete but no question is provided
         console.error("[handleUserMessage] Onboarding flow error: Not complete, but no next question.");
         const errorMsg = "Sorry, I got stuck during the onboarding process. Could you try starting again?";
         addMessageToHistory('ai', errorMsg);
         conversationState.currentFlow = null; // Reset flow
         return { responseText: errorMsg };
      }

    // --- Placeholder for Create Product Flow ---
    } else if (message === CREATE_PRODUCT_TRIGGER) {
        console.log("[handleUserMessage] Placeholder for Create Product flow.");
         conversationState.currentFlow = 'create_product'; // Set state if needed later
         const response = "The 'Create Product' feature is not implemented yet.";
         addMessageToHistory('ai', response);
         conversationState.currentFlow = null; // Reset immediately for this placeholder
         return { responseText: response };

    // --- Default/Praise Agent Flow ---
    } else {
        // If no specific flow is active, default to parsing and potentially praise
        console.log("[handleUserMessage] No active flow, proceeding with default handling.");
        // Keep track that we're in a general interaction, could be praise or something else
        // conversationState.currentFlow = 'praise'; // Setting this might be too specific if it's not always praise

        // 1. Communication Agent (Initial Parsing) -> Executive Agent (Simplified)
        console.log("[handleUserMessage] Step 1: Calling parseUserMessage...");
        // Parse needs only the current message and channel
        const parsedMessage = await parseUserMessage({ message, channel });
        console.log("[handleUserMessage] Step 1: parseUserMessage successful. Result:", parsedMessage);
        // Potentially add parsed info to history if useful for future context
        // addMessageToHistory('system', `Parsed Intent: ${parsedMessage.intent}`);

        // 2. Executive Agent (Triage - Simplified)
        console.log("[handleUserMessage] Step 2: Calling triageUserMessage...");
        // Triage also likely only needs current message and channel
        const triageResult = await triageUserMessage({ message, channel });
        console.log("[handleUserMessage] Step 2: triageUserMessage successful. Result:", triageResult);

        // If marked as spam, respond appropriately and exit.
        if (triageResult.isSpam) {
            console.log("[handleUserMessage] Message identified as spam.");
            const spamResponse = "This message appears to be spam and has been discarded.";
            addMessageToHistory('ai', spamResponse);
            // conversationState.currentFlow = null; // Ensure flow state is cleared
            return { responseText: spamResponse };
        }

        // 3. Executive Agent (Direct Delegation to Praise Agent FOR TESTING)
        // For the test requirement: Always delegate to praise agent if not onboarding/create product
        console.log("[handleUserMessage] Step 3: Delegating to praiseAgent (testing)...");
        // Praise agent only needs the current message
        const praiseResult = await praiseAgent({ message: message });
        console.log("[handleUserMessage] Step 3: praiseAgent successful. Result:", praiseResult);

        // Check if the Praise Agent returned a valid result
        if (!praiseResult || typeof praiseResult.praisedMessage !== 'string') {
            console.error("[handleUserMessage] Error: Praise Agent did not return a valid praised message. Result:", praiseResult);
            const errorResponse = "Sorry, the Praise Agent couldn't process the message correctly.";
             addMessageToHistory('ai', errorResponse);
             // conversationState.currentFlow = null; // Reset flow
             return { responseText: errorResponse };
        }

        // 4. Return Praise Agent's Response
        console.log("[handleUserMessage] Step 4: Returning praised message to user:", praiseResult.praisedMessage);
        addMessageToHistory('ai', praiseResult.praisedMessage);
        // conversationState.currentFlow = null; // Reset flow
        return { responseText: praiseResult.praisedMessage };
    }

  } catch (error: any) {
    console.error("[handleUserMessage] Error caught in top-level try-catch:", error);
    const errorMessage = error?.message || 'Unknown error';
    const finalErrorMsg = `Sorry, I encountered an internal error while processing your request. Please try again later. (Details: ${errorMessage})`;
    addMessageToHistory('ai', finalErrorMsg); // Log error response to history
    conversationState.currentFlow = null; // Reset flow state on error
    return { responseText: finalErrorMsg };
  } finally {
       console.log("[handleUserMessage] Final state after processing:", conversationState);
  }
}

// TODO: Replace in-memory state with a persistent solution (Firestore, session storage, etc.)
// TODO: Implement actual sub-agent execution logic based on triage/intent when not testing praise agent.
// TODO: Integrate ModelContextProtocol SDK for tool usage within sub-agents.
// TODO: Implement actual channel integrations (Email, WhatsApp, Voice) - these would likely trigger this action.
