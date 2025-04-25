
'use server';

import { parseUserMessage } from '@/ai/flows/parse-user-message';
import { triageUserMessage } from '@/ai/flows/triage-user-message';
import { praiseAgent } from '@/ai/flows/praise-agent';
import { conductOnboardingInterview, type Message as OnboardingMessage, type OnboardingData } from '@/ai/flows/conduct-onboarding-interview';
import { addTask, type AddTaskInput } from '@/ai/flows/task-management/add-task'; // Import add task flow + Input type
import { getTasks, type Task } from '@/ai/flows/task-management/get-tasks'; // Import get tasks flow + Task type
import { updateTask } from '@/ai/flows/task-management/update-task'; // Import update task flow
import { z } from 'zod'; // Import zod for schema validation
import { addDays, formatISO } from 'date-fns'; // For date calculation


// Define the specific trigger messages
const ONBOARDING_TRIGGER = 'START_ONBOARDING_INTERVIEW';
const CREATE_PRODUCT_TRIGGER = 'START_CREATE_PRODUCT'; // Placeholder for future feature
const RESET_CONVERSATION_TRIGGER = 'RESET_CONVERSATION'; // Trigger for resetting
const VIEW_TASKLIST_TRIGGER = 'VIEW_TASKLIST'; // Trigger for viewing task list

// --- State Management (Simple Example - In-memory for this request) ---
// In a real application, this state should be stored persistently (e.g., Firestore, session storage)
// Keep track of conversation flow and history for the *current interaction*
interface ConversationState {
  currentFlow: 'onboarding' | 'praise' | 'create_product' | null; // Removed 'view_tasks' as it's stateless now
  history: OnboardingMessage[];
  // userId: string | null; // Example: Add userId for multi-user support
  // tasks are now managed by the dedicated task flows and their internal (mock) storage
}

// WARNING: This in-memory state is NOT suitable for production.
// It will be lost on server restarts and won't work across multiple users or sessions.
// Use a database or session store for real applications.
let conversationState: ConversationState = {
    currentFlow: null,
    history: [],
    // userId: null,
};

// Helper function to reset the state
function resetConversationState() {
    console.log("[resetConversationState] Resetting state.");
    conversationState = {
        currentFlow: null,
        history: [],
        // userId: null,
        // Tasks are managed elsewhere now
    };
    // NOTE: This does NOT reset the mock task database in the task flows.
    // A dedicated reset mechanism for tasks would be needed in a real app.
}


// Helper function to add messages to the state's history
function addMessageToHistory(sender: OnboardingMessage['sender'], text: string) {
    // Prevent adding reset/tasklist triggers to history if they just initiate the action
    if (text === RESET_CONVERSATION_TRIGGER || text === VIEW_TASKLIST_TRIGGER) {
        console.log("[addMessageToHistory] Skipping addition of internal trigger message:", text);
        return;
    }
    const newMessage: OnboardingMessage = { sender, text };
    conversationState.history.push(newMessage);
    console.log(`[addMessageToHistory] Added ${sender} message. History length: ${conversationState.history.length}`);
    // console.log("[addMessageToHistory] Current History:", JSON.stringify(conversationState.history, null, 2)); // Can be very verbose
}

// --- Task Management Helpers (Using Genkit Flows) ---

/**
 * Creates an onboarding-related task using the addTask Genkit flow.
 * @param onboardingData The collected onboarding data.
 */
async function createOnboardingTask(onboardingData: OnboardingData): Promise<void> {
    console.log("[createOnboardingTask] Function called with data:", onboardingData);
    let taskDescription = '';
    let taskPriority: 'high' | 'medium' | 'low' = 'medium';
    let dueDate: string | undefined = undefined;

    // Ensure hasStripe is explicitly checked (boolean)
    if (onboardingData.hasStripe === false) {
        taskDescription = 'Create a Stripe account for payment processing.';
        taskPriority = 'high';
        // Set due date 5 days from now
        const futureDate = addDays(new Date(), 5);
        dueDate = formatISO(futureDate); // Format as YYYY-MM-DDTHH:mm:ss.sssZ
        console.log(`[createOnboardingTask] Stripe task determined: Create account, Due: ${dueDate}`);
    } else if (onboardingData.hasStripe === true) {
        taskDescription = 'Connect your Stripe account in Settings > Payments.';
        taskPriority = 'medium';
        console.log(`[createOnboardingTask] Stripe task determined: Connect account`);
    } else {
        // This case should only occur if 'hasStripe' is undefined in the data
        console.warn("[createOnboardingTask] hasStripe is undefined or missing in onboardingData, skipping task creation.", onboardingData);
        return; // Don't proceed if we don't have the necessary info
    }

    try {
        console.log(`[createOnboardingTask] Adding task via Genkit flow: "${taskDescription}", Priority: ${taskPriority}, Due: ${dueDate || 'None'}`);
        const addTaskInput: AddTaskInput = {
            description: taskDescription,
            priority: taskPriority,
            dueDate: dueDate,
        };
        // We don't necessarily need the result here unless we want to confirm the ID
        await addTask(addTaskInput);
        console.log("[createOnboardingTask] Task addition requested via Genkit flow.");
        // The task is now managed within the mock DB of the task flows.
        // No need to update local conversationState.tasks anymore.

    } catch (error) {
        console.error("[createOnboardingTask] Error requesting task addition via Genkit flow:", error);
        // Handle error appropriately (e.g., notify user, log)
    }
}

/**
 * Fetches the current list of tasks using the getTasks Genkit flow and formats them for display.
 * @returns A formatted string of the task list or an error message.
 */
async function fetchAndFormatTasks(): Promise<string> {
    try {
        console.log("[fetchAndFormatTasks] Fetching tasks via Genkit flow...");
        // Assuming getTasks takes no input for fetching all tasks for the current context.
        // In a real app, you'd pass userId or similar identifier.
        const tasksResult = await getTasks({}); // Modify input if getTasks requires it (e.g., { userId: conversationState.userId })
        console.log("[fetchAndFormatTasks] Tasks received from Genkit flow:", tasksResult);

        // The tasks list now comes directly from the (mock) task service
        const tasks = tasksResult.tasks;

        if (!tasks || tasks.length === 0) {
            console.log("[fetchAndFormatTasks] No tasks found from the task service.");
            return "You have no pending tasks.";
        }

        // Format the tasks for display
        console.log(`[fetchAndFormatTasks] Formatting ${tasks.length} tasks for display.`);
        let taskListString = "Here is your current task list:\n\n";
        tasks.forEach((task, index) => {
            taskListString += `${index + 1}. ${task.description}`;
            taskListString += `\n   - Priority: ${task.priority}`;
            if (task.dueDate) {
                try {
                 // Attempt to format the date nicely
                 const date = new Date(task.dueDate);
                 // Format date and time separately for clarity
                 const formattedDate = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                 // Check if time part is meaningful (not midnight)
                 const isMidnight = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
                 const formattedTime = isMidnight ? '' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                 taskListString += `\n   - Due: ${formattedDate}${formattedTime ? ' ' + formattedTime : ''}`;
                } catch (e) {
                 taskListString += `\n   - Due: ${task.dueDate}`; // Fallback to raw string if parsing fails
                 console.warn(`[fetchAndFormatTasks] Failed to parse date: ${task.dueDate}`, e);
                }
            }
            taskListString += `\n   - Status: ${task.completed ? 'Completed' : 'Pending'}`;
            // TODO: Add actions (buttons) to mark as complete later (would need updateTask flow)
            taskListString += `\n\n`;
        });

        console.log("[fetchAndFormatTasks] Task list formatted successfully.");
        return taskListString.trim();

    } catch (error) {
        console.error("[fetchAndFormatTasks] Error fetching or formatting tasks:", error);
        return "Sorry, I couldn't retrieve your task list at the moment.";
    }
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
  console.log(`\n[handleUserMessage] ===== START MESSAGE HANDLING (${new Date().toISOString()}) =====`);
  console.log(`[handleUserMessage] Channel: ${channel}, Input Message/Trigger: "${message}"`);
  console.log("[handleUserMessage] State BEFORE processing:", JSON.stringify(conversationState));

  // --- Reset Flow ---
  if (message === RESET_CONVERSATION_TRIGGER) {
    console.log("[handleUserMessage] Received reset trigger.");
    resetConversationState();
    console.log("[handleUserMessage] State reset. Returning reset confirmation.");
    console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Reset) =====");
    // Provide initial options again after reset
    return {
        responseText: "Conversation reset. Hello! What would you like to work on today?",
        actions: [
            { label: "Onboarding", trigger: ONBOARDING_TRIGGER },
            { label: "Create Product", trigger: CREATE_PRODUCT_TRIGGER },
        ]
     };
  }

  // --- View Tasklist Flow (Stateless Action) ---
   if (message === VIEW_TASKLIST_TRIGGER) {
       console.log("[handleUserMessage] Received view tasklist trigger.");
       const taskListText = await fetchAndFormatTasks();
       addMessageToHistory('ai', taskListText); // Add task list to history for context
       console.log("[handleUserMessage] Task list fetched and formatted. Returning task list.");
       console.log("[handleUserMessage] Current flow state remains:", conversationState.currentFlow);
       console.log("[handleUserMessage] ===== END MESSAGE HANDLING (View Tasks) =====");
       // Return task list but don't provide default actions, let user continue previous flow or type.
       return { responseText: taskListText };
   }

  // Determine the message sender type based on whether it's a trigger or a user typing
  const senderType: OnboardingMessage['sender'] =
    (message === ONBOARDING_TRIGGER || message === CREATE_PRODUCT_TRIGGER || message === 'Yes' || message === 'No' || message === 'Chat' || message === 'Email' || message === 'Whatsapp')
    ? 'action' // Treat known button/trigger inputs as 'action'
    : 'user'; // Treat free text as 'user'
   console.log(`[handleUserMessage] Determined senderType: ${senderType}`);


  // Add user message/action to history *before* calling the flow that needs it
  // Skip adding the *initial* trigger if no flow is active yet.
  let shouldAddToHistory = true;
   if (message === ONBOARDING_TRIGGER && conversationState.currentFlow !== 'onboarding') {
      shouldAddToHistory = false;
      console.log("[handleUserMessage] Skipping adding initial onboarding trigger to history.");
   }
    if (message === CREATE_PRODUCT_TRIGGER && conversationState.currentFlow !== 'create_product') {
      shouldAddToHistory = false;
      console.log("[handleUserMessage] Skipping adding initial create product trigger to history.");
    }
    // View tasklist trigger is handled above and not added here

  if (shouldAddToHistory) {
     addMessageToHistory(senderType, message);
  }


  try {
    // --- Determine Flow ---
    // Prioritize active flow state. If none, check message for triggers.
    let activeFlow = conversationState.currentFlow;
     console.log(`[handleUserMessage] Checking for active flow: ${activeFlow}`);

    if (!activeFlow) {
        console.log("[handleUserMessage] No active flow. Checking message for triggers.");
        if (message === ONBOARDING_TRIGGER) {
            console.log("[handleUserMessage] Triggering NEW onboarding interview...");
            activeFlow = 'onboarding';
            conversationState.currentFlow = 'onboarding';
            // Clear history *only* when starting a new onboarding flow
            conversationState.history = [];
            console.log("[handleUserMessage] Onboarding history cleared for new session.");
            // *** Add system message to start the interview ***
             addMessageToHistory('system', 'Starting onboarding interview.');
        } else if (message === CREATE_PRODUCT_TRIGGER) {
            console.log("[handleUserMessage] Triggering NEW create product flow...");
            activeFlow = 'create_product';
            conversationState.currentFlow = 'create_product';
             addMessageToHistory('system', 'Starting create product flow.');
        } else {
             console.log("[handleUserMessage] No trigger match, will proceed to default handling.");
             activeFlow = null; // Explicitly null if no trigger matched
        }
    } else {
        console.log(`[handleUserMessage] Continuing active flow: ${activeFlow}`);
    }

    console.log(`[handleUserMessage] Determined final activeFlow for this turn = ${activeFlow}`);

    // --- Execute Flow ---
    switch (activeFlow) {
      case 'onboarding':
        console.log("[handleUserMessage] Entering ONBOARDING flow execution.");
        // IMPORTANT: The history *must* include the latest user/action message.
        // We added it above *before* this switch statement.
        console.log(`[handleUserMessage] Calling conductOnboardingInterview with history (length ${conversationState.history.length}).`);
        // console.log("[handleUserMessage] Full history being passed:", JSON.stringify(conversationState.history, null, 2)); // Uncomment for deep debugging

        // Call the onboarding flow Genkit function
        const onboardingResult = await conductOnboardingInterview({ conversationHistory: conversationState.history });

        console.log("[handleUserMessage] Onboarding flow returned:", JSON.stringify(onboardingResult, null, 2)); // Log result clearly

        // Add AI response (question or completion message) to history
        if (onboardingResult.nextQuestion) {
            // Don't add the [OPTIONS] marker to history if present
            const questionText = onboardingResult.nextQuestion.replace(/ \[OPTIONS:.*?\]$/, '');
            console.log("[handleUserMessage] Adding AI question to history:", questionText);
            addMessageToHistory('ai', questionText);
        } else if (onboardingResult.isComplete && onboardingResult.onboardingData) {
             console.log("[handleUserMessage] Onboarding is complete according to flow result. Processing final data...");
             // Final summary message will be constructed and added below *after* potential task creation
        } else if (onboardingResult.isComplete && !onboardingResult.onboardingData) {
             console.warn("[handleUserMessage] Onboarding complete but no data returned by flow.");
             // Handle this case below
        } else {
             console.warn("[handleUserMessage] Onboarding not complete and no next question returned by flow.");
             // Handle this case below
        }


        // --- Process Onboarding Result ---
        if (onboardingResult.isComplete) {
          console.log("[handleUserMessage] Processing Onboarding COMPLETE state.");

          if (onboardingResult.onboardingData) {
             console.log("[handleUserMessage] Onboarding data received:", onboardingResult.onboardingData);

             // --- Task Creation Logic ---
             // Crucially, check the answeredStripe flag from the flow result
             // This indicates the user *just* answered the Stripe question in the *previous* turn,
             // and the flow is now confirming completion based on that answer.
             if (onboardingResult.answeredStripe === true) {
                 console.log("[handleUserMessage] Onboarding result indicates Stripe question was processed by the flow. Calling createOnboardingTask...");
                 // Create task based on the final collected data (which includes the Stripe answer)
                 await createOnboardingTask(onboardingResult.onboardingData);
             } else {
                 console.log("[handleUserMessage] Onboarding complete, but answeredStripe flag is false or missing. No task created this turn.");
             }

             // --- Format Final Response ---
             console.log("[handleUserMessage] Formatting final completion message.");
             const jsonResponse = JSON.stringify(onboardingResult.onboardingData, null, 2);
             let finalMessage = `Onboarding complete! Here's the collected information:\n\`\`\`json\n${jsonResponse}\n\`\`\``;

             // Add task-related info to the final message if the Stripe question was just processed
             if (onboardingResult.answeredStripe === true) {
                  console.log("[handleUserMessage] Adding task info to final message based on answeredStripe=true.");
                  // Use the final onboardingData to determine which task message to show
                  if (onboardingData.hasStripe === false) {
                      finalMessage += "\n\nA task has been added to your list to create a Stripe account.";
                  } else if (onboardingData.hasStripe === true) {
                      finalMessage += "\n\nA task has been added to your list to connect your Stripe account.";
                  } else {
                       // Should not happen if answeredStripe is true and validation passed, but log just in case
                       console.warn("[handleUserMessage] answeredStripe=true but hasStripe is not boolean in final data.");
                  }
             } else {
                  console.log("[handleUserMessage] answeredStripe is false, not adding task info to final message.");
             }
             finalMessage += "\nYou can view your tasks anytime using the Tasklist button.";

             console.log("[handleUserMessage] Final completion message constructed:", finalMessage);
             addMessageToHistory('ai', finalMessage); // Add final summary to history

             console.log("[handleUserMessage] Resetting current flow state to null (Onboarding Complete).");
             conversationState.currentFlow = null; // Reset flow state AFTER processing completion

             console.log("[handleUserMessage] Returning final onboarding completion response.");
             console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Onboarding Complete) =====");
             // No further actions/buttons needed here, flow is done.
             return { responseText: finalMessage };

          } else { // isComplete is true, but no data returned
              console.error("[handleUserMessage] Onboarding complete but no onboardingData returned by the flow.");
              const errorMsg = "Onboarding seems complete, but I couldn't retrieve the final data. Let's stop here. You can try again using the 'Onboarding' button.";
              addMessageToHistory('ai', errorMsg);
              console.log("[handleUserMessage] Resetting current flow state to null due to missing completion data.");
              conversationState.currentFlow = null; // Reset flow state
              console.log("[handleUserMessage] Returning onboarding missing data error response.");
              console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Onboarding Missing Data Error) =====");
              return { responseText: errorMsg }; // Return error, no buttons
          }

        } else if (onboardingResult.nextQuestion) { // Interview is NOT complete, ask next question
          console.log("[handleUserMessage] Onboarding asking next question:", onboardingResult.nextQuestion);
          // Check for the [OPTIONS] marker to generate buttons
          const optionsMatch = onboardingResult.nextQuestion.match(/ \[OPTIONS: (.*?)\]$/);
          let actions: Array<{ label: string; trigger: string }> | undefined = undefined;
          let questionText = onboardingResult.nextQuestion;

          if (optionsMatch) {
            const options = optionsMatch[1].split(',').map(opt => opt.trim());
            actions = options.map(opt => ({ label: opt, trigger: opt })); // Use option text as trigger
            questionText = onboardingResult.nextQuestion.replace(/ \[OPTIONS:.*?\]$/, ''); // Remove marker from text shown to user
            console.log(`[handleUserMessage] Found options: ${options.join(', ')}. Generating actions.`);
          } else {
              console.log("[handleUserMessage] No options marker found in next question.");
          }

          // Ask the next question, potentially with actions (buttons)
          console.log("[handleUserMessage] Returning next question response.");
          console.log("[handleUserMessage] Keeping current flow state: 'onboarding'.");
          console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Onboarding Next Question) =====");
          // Return the question and any actions (buttons)
          return { responseText: questionText, actions: actions };

        } else {
           // Handle unexpected case: interview is not complete AND no question is provided
           console.error("[handleUserMessage] Onboarding flow error: Not complete, but no next question provided.");
           const errorMsg = "Sorry, I got stuck during the onboarding process. Let's stop here. You can try starting again using the 'Onboarding' button.";
           addMessageToHistory('ai', errorMsg);
           console.log("[handleUserMessage] Resetting current flow state to null due to stuck error.");
           conversationState.currentFlow = null; // Reset flow
           console.log("[handleUserMessage] Returning onboarding stuck error response.");
           console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Onboarding Stuck Error) =====");
           return { responseText: errorMsg }; // Return error, no buttons
        }

      case 'create_product':
         console.log("[handleUserMessage] Entering Create Product flow execution (Placeholder).");
         const response = "The 'Create Product' feature is not implemented yet. Please select another option.";
         addMessageToHistory('ai', response);
         conversationState.currentFlow = null; // Reset immediately for this placeholder
         console.log("[handleUserMessage] Resetting current flow state to null (create_product placeholder).");
         console.log("[handleUserMessage] Returning create product placeholder response.");
         console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Create Product Placeholder) =====");
         // Offer initial options again
         return {
             responseText: response,
             actions: [
                { label: "Onboarding", trigger: ONBOARDING_TRIGGER },
                // Add other top-level actions here if available
             ]
         };

      // Note: 'view_tasks' case is handled directly before the switch as a stateless action

      default:
        // --- Default/Praise Agent Flow (when no specific flow is active) ---
        console.log("[handleUserMessage] No active flow, proceeding with default handling (parse/triage/praise test).");

        // 1. Communication Agent (Initial Parsing) -> Executive Agent (Simplified)
        console.log("[handleUserMessage] Step 1: Calling parseUserMessage...");
        const parsedMessage = await parseUserMessage({ message, channel });
        console.log("[handleUserMessage] Step 1: parseUserMessage result:", parsedMessage);

        // 2. Executive Agent (Triage - Simplified)
        console.log("[handleUserMessage] Step 2: Calling triageUserMessage...");
        const triageResult = await triageUserMessage({ message, channel });
        console.log("[handleUserMessage] Step 2: triageUserMessage result:", triageResult);

        // If marked as spam, respond appropriately and exit.
        if (triageResult.isSpam) {
            console.log("[handleUserMessage] Message identified as spam.");
            const spamResponse = "This message appears to be spam and has been discarded.";
            addMessageToHistory('ai', spamResponse);
            console.log("[handleUserMessage] Returning spam response.");
            console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Spam Detected) =====");
            return { responseText: spamResponse }; // No further actions
        }

        // 3. Executive Agent (Direct Delegation to Praise Agent FOR TESTING)
        console.log("[handleUserMessage] Step 3: Delegating to praiseAgent (testing)...");
        const praiseResult = await praiseAgent({ message: message });
        console.log("[handleUserMessage] Step 3: praiseAgent result:", praiseResult);

        if (!praiseResult || typeof praiseResult.praisedMessage !== 'string') {
            console.error("[handleUserMessage] Error: Praise Agent did not return a valid praised message. Result:", praiseResult);
            const errorResponse = "Sorry, the Praise Agent couldn't process the message correctly.";
             addMessageToHistory('ai', errorResponse);
             console.log("[handleUserMessage] Returning praise agent error response.");
             console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Praise Agent Error) =====");
             return { responseText: errorResponse }; // No further actions
        }

        // 4. Return Praise Agent's Response
        console.log("[handleUserMessage] Step 4: Returning praised message to user:", praiseResult.praisedMessage);
        addMessageToHistory('ai', praiseResult.praisedMessage);
        console.log("[handleUserMessage] Returning default praise response.");
        console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Default Praise Response) =====");
        // After default praise, offer initial options again? Or expect user to type?
        return {
            responseText: praiseResult.praisedMessage,
            // Optionally add initial actions back if desired after a default interaction
            // actions: [
            //    { label: "Onboarding", trigger: ONBOARDING_TRIGGER },
            //    { label: "Create Product", trigger: CREATE_PRODUCT_TRIGGER },
            // ]
        };
    }

  } catch (error: any) {
    console.error("[handleUserMessage] Error caught in top-level try-catch:", error);
    const errorMessage = error?.message || 'Unknown error';
    const finalErrorMsg = `Sorry, I encountered an internal error while processing your request. Please try again later. (Details: ${errorMessage})`;
    addMessageToHistory('ai', finalErrorMsg); // Log error response to history

    console.log("[handleUserMessage] Resetting current flow state to null due to top-level error.");
    conversationState.currentFlow = null; // Reset flow state on major error

    console.log("[handleUserMessage] Returning top-level error response.");
    console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Top-Level Error) =====");
     // Offer initial options again after a major error
     return {
         responseText: finalErrorMsg,
         actions: [
            { label: "Onboarding", trigger: ONBOARDING_TRIGGER },
            { label: "Create Product", trigger: CREATE_PRODUCT_TRIGGER },
         ]
     };
  } finally {
       console.log("[handleUserMessage] Final state AFTER processing:", JSON.stringify(conversationState)); // Log final state for this turn
       console.log(`[handleUserMessage] ===== FINISHED MESSAGE HANDLING (${new Date().toISOString()}) =====\n`);
  }
}

// TODO: Replace in-memory state with Firestore for conversation history and user context.
// TODO: Replace mock task storage in task flows with Firestore.
// TODO: Implement task completion logic (e.g., buttons in task list triggering updateTask flow).
// TODO: Implement updateTask flow usage.
// TODO: Refine getTasks flow to handle user context (userId).
// TODO: Implement actual sub-agent execution logic based on triage/intent when not testing praise agent.
// TODO: Integrate ModelContextProtocol SDK for tool usage within sub-agents.
// TODO: Implement actual channel integrations (Email, WhatsApp, Voice) - these would likely trigger this action.
