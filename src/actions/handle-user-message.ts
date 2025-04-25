
'use server';

import { parseUserMessage } from '@/ai/flows/parse-user-message';
import { triageUserMessage } from '@/ai/flows/triage-user-message';
import { praiseAgent } from '@/ai/flows/praise-agent';
import { conductOnboardingInterview, type Message as OnboardingMessage, type OnboardingData } from '@/ai/flows/conduct-onboarding-interview';
import { addTask } from '@/ai/flows/task-management/add-task'; // Import add task flow
import { getTasks } from '@/ai/flows/task-management/get-tasks'; // Import get tasks flow
import { z } from 'zod'; // Import zod for schema validation
import { addDays, formatISO } from 'date-fns'; // For date calculation


// Define the specific trigger messages
const ONBOARDING_TRIGGER = 'START_ONBOARDING_INTERVIEW';
const CREATE_PRODUCT_TRIGGER = 'START_CREATE_PRODUCT'; // Placeholder for future feature
const RESET_CONVERSATION_TRIGGER = 'RESET_CONVERSATION'; // Trigger for resetting
const VIEW_TASKLIST_TRIGGER = 'VIEW_TASKLIST'; // Trigger for viewing task list

// --- State Management (Simple Example - In-memory for this request) ---
// In a real application, this state should be stored persistently (e.g., Firestore, session storage)
interface ConversationState {
  currentFlow: 'onboarding' | 'praise' | 'create_product' | 'view_tasks' | null; // Added 'view_tasks'
  history: OnboardingMessage[];
  tasks: Array<{ id: string; description: string; priority: 'high' | 'medium' | 'low'; dueDate?: string; completed: boolean }>; // Add tasks to state
  // Add other state variables as needed, e.g., userId
}

// WARNING: This in-memory state is NOT suitable for production.
// It will be lost on server restarts and won't work across multiple users or sessions.
// Use a database or session store for real applications.
let conversationState: ConversationState = {
    currentFlow: null,
    history: [],
    tasks: [], // Initialize tasks array
};

// Helper function to reset the state
function resetConversationState() {
    console.log("[resetConversationState] Resetting state.");
    conversationState = {
        currentFlow: null,
        history: [],
        tasks: [], // Reset tasks too
    };
}


// Helper function to add messages to the state
function addMessageToHistory(sender: OnboardingMessage['sender'], text: string) {
    // Prevent adding reset/tasklist triggers to history if they just initiate the action
    if (text === RESET_CONVERSATION_TRIGGER || text === VIEW_TASKLIST_TRIGGER) {
        console.log("[addMessageToHistory] Skipping addition of trigger message:", text);
        return;
    }
    const newMessage: OnboardingMessage = { sender, text };
    conversationState.history.push(newMessage);
    console.log(`[addMessageToHistory] Added ${sender} message. History length: ${conversationState.history.length}`);
    // console.log("[addMessageToHistory] Updated history:", JSON.stringify(conversationState.history, null, 2)); // Log history clearly - potentially too verbose
}

// --- Task Management Helpers (Using Genkit Flows) ---

async function createOnboardingTask(onboardingData: OnboardingData) {
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
        // Optionally set a shorter due date or none
        // dueDate = formatISO(addDays(new Date(), 2));
    } else {
        // This case should only occur if 'hasStripe' is undefined in the data
        console.warn("[createOnboardingTask] hasStripe is undefined in onboardingData, skipping task creation.", onboardingData);
        return;
    }

    try {
        console.log(`[createOnboardingTask] Adding task via Genkit: "${taskDescription}", Priority: ${taskPriority}, Due: ${dueDate || 'None'}`);
        const addTaskInput = {
            description: taskDescription,
            priority: taskPriority,
            dueDate: dueDate,
        };
        const addedTask = await addTask(addTaskInput); // Assuming addTask returns the created task with an ID
        console.log("[createOnboardingTask] Task added successfully via Genkit flow. Result:", addedTask);

        // Update local state (replace with persistent storage update in real app)
        const newTask = {
            id: addedTask.taskId || `temp-${Date.now()}`, // Use returned ID or mock
            description: taskDescription,
            priority: taskPriority,
            dueDate: dueDate,
            completed: false,
        };
        conversationState.tasks.push(newTask);
        console.log("[createOnboardingTask] Updated local tasks state. Total tasks:", conversationState.tasks.length);


    } catch (error) {
        console.error("[createOnboardingTask] Error adding task via Genkit flow:", error);
        // Handle error appropriately (e.g., notify user, log)
    }
}

async function fetchAndFormatTasks(): Promise<string> {
    try {
        console.log("[fetchAndFormatTasks] Fetching tasks via Genkit flow...");
        // Assuming getTasks takes no input for fetching all tasks for the user context
        // In a real app, you'd pass userId or similar identifier.
        const tasksResult = await getTasks({}); // Modify input if getTasks requires it
        console.log("[fetchAndFormatTasks] Tasks received from Genkit flow:", tasksResult);

        // Update local state (replace with persistent storage logic)
        // This ensures the local state matches what the flow *thinks* is in the DB (mocked or real)
        conversationState.tasks = tasksResult.tasks.map(t => ({
             id: t.id,
             description: t.description,
             priority: t.priority,
             dueDate: t.dueDate,
             completed: t.completed,
        }));
        console.log("[fetchAndFormatTasks] Local task state synchronized. Total tasks:", conversationState.tasks.length);


        if (!conversationState.tasks || conversationState.tasks.length === 0) {
            console.log("[fetchAndFormatTasks] No tasks found.");
            return "You have no pending tasks.";
        }

        // Format the tasks for display
        console.log("[fetchAndFormatTasks] Formatting task list for display.");
        let taskListString = "Here is your current task list:\n\n";
        conversationState.tasks.forEach((task, index) => {
            taskListString += `${index + 1}. ${task.description}`;
            taskListString += `\n   - Priority: ${task.priority}`;
            if (task.dueDate) {
                try {
                 // Attempt to format the date nicely
                 const date = new Date(task.dueDate);
                 // Format date and time separately for clarity
                 const formattedDate = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                 const formattedTime = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                 taskListString += `\n   - Due: ${formattedDate} ${formattedTime}`;
                } catch (e) {
                 taskListString += `\n   - Due: ${task.dueDate}`; // Fallback to raw string if parsing fails
                 console.warn(`[fetchAndFormatTasks] Failed to parse date: ${task.dueDate}`, e);
                }
            }
            taskListString += `\n   - Status: ${task.completed ? 'Completed' : 'Pending'}`;
            // TODO: Add actions (buttons) to mark as complete later
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
  console.log(`[handleUserMessage] ===== START MESSAGE HANDLING =====`);
  console.log(`[handleUserMessage] Channel: ${channel}, Message/Trigger: "${message}"`);
  console.log("[handleUserMessage] Current state BEFORE processing:", JSON.stringify(conversationState, null, 2));

  // --- Reset Flow ---
  if (message === RESET_CONVERSATION_TRIGGER) {
    console.log("[handleUserMessage] Received reset trigger.");
    resetConversationState();
    console.log("[handleUserMessage] State reset. Returning reset confirmation.");
    console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Reset) =====");
    return { responseText: "Conversation reset. Feel free to start over." }; // Updated message
  }

  // --- View Tasklist Flow ---
   if (message === VIEW_TASKLIST_TRIGGER) {
       console.log("[handleUserMessage] Received view tasklist trigger.");
       // It's okay if another flow was active, viewing tasks shouldn't disrupt it severely
       // conversationState.currentFlow = 'view_tasks'; // No need to set flow state, it's a one-off action
       const taskListText = await fetchAndFormatTasks();
       addMessageToHistory('ai', taskListText); // Add task list to history
       // conversationState.currentFlow = null; // Don't reset flow state, let the original flow potentially continue
       console.log("[handleUserMessage] Task list fetched and formatted. Returning task list.");
       console.log("[handleUserMessage] ===== END MESSAGE HANDLING (View Tasks) =====");
       return { responseText: taskListText };
   }


  // Determine the message sender type based on whether it's a trigger or a button response
  const senderType: OnboardingMessage['sender'] =
    (message === ONBOARDING_TRIGGER || message === CREATE_PRODUCT_TRIGGER || message === 'Yes' || message === 'No' || message === 'Chat' || message === 'Email' || message === 'Whatsapp')
    ? 'action' // Treat known button/trigger inputs as 'action'
    : 'user'; // Treat free text as 'user'
   console.log(`[handleUserMessage] Determined senderType: ${senderType}`);


  // Add user message/action to history *unless* it's the initial trigger for a flow *and* no flow is active
  let shouldAddToHistory = true;
   if (message === ONBOARDING_TRIGGER && conversationState.currentFlow !== 'onboarding') {
      shouldAddToHistory = false; // Don't add the "START_ONBOARDING_INTERVIEW" trigger itself to history
      console.log("[handleUserMessage] Skipping adding initial onboarding trigger to history.");
   }
    if (message === CREATE_PRODUCT_TRIGGER && conversationState.currentFlow !== 'create_product') {
      shouldAddToHistory = false; // Don't add the "START_CREATE_PRODUCT" trigger itself
      console.log("[handleUserMessage] Skipping adding initial create product trigger to history.");
    }
    // View tasklist trigger is handled above and not added here

  if (shouldAddToHistory) {
     addMessageToHistory(senderType, message);
  }


  try {
    // --- Determine Flow ---
    // Prioritize active flow state over the incoming message trigger if a flow is already running.
    let activeFlow = conversationState.currentFlow;
     console.log(`[handleUserMessage] Initial check for activeFlow: ${activeFlow}`);

    // If no flow is active, check if the message triggers a new flow.
    if (!activeFlow) {
        console.log("[handleUserMessage] No active flow detected. Checking message for triggers.");
        if (message === ONBOARDING_TRIGGER) {
            console.log("[handleUserMessage] Triggering NEW onboarding interview...");
            activeFlow = 'onboarding';
            conversationState.currentFlow = 'onboarding';
            // Clear history only when starting a new onboarding flow
            conversationState.history = [];
            console.log("[handleUserMessage] Onboarding history cleared for new session.");
        } else if (message === CREATE_PRODUCT_TRIGGER) {
            console.log("[handleUserMessage] Triggering NEW create product flow...");
            activeFlow = 'create_product';
            conversationState.currentFlow = 'create_product';
        }
        // Note: VIEW_TASKLIST is handled directly above
    } else {
        console.log(`[handleUserMessage] Continuing active flow: ${activeFlow}`);
    }

    console.log(`[handleUserMessage] Determined final activeFlow = ${activeFlow}`);

    // --- Execute Flow ---
    switch (activeFlow) {
      case 'onboarding':
        console.log("[handleUserMessage] Entering ONBOARDING flow block.");
        // Call the onboarding flow with the current history
        // Ensure history isn't accidentally cleared mid-flow
        console.log("[handleUserMessage] Calling conductOnboardingInterview with history (length):", conversationState.history.length);
        // console.log("[handleUserMessage] Full history being passed:", JSON.stringify(conversationState.history, null, 2)); // Uncomment for deep debugging

        const onboardingResult = await conductOnboardingInterview({ conversationHistory: conversationState.history });

        console.log("[handleUserMessage] Onboarding flow RETURNED:", JSON.stringify(onboardingResult, null, 2)); // Log result clearly

        // Add AI response (question or completion message) to history
        if (onboardingResult.nextQuestion) {
            // Don't add the [OPTIONS] marker to history
            const questionText = onboardingResult.nextQuestion.replace(/ \[OPTIONS:.*?\]$/, '');
            console.log("[handleUserMessage] Adding AI question to history:", questionText);
            addMessageToHistory('ai', questionText);
        } else if (onboardingResult.isComplete && onboardingResult.onboardingData) {
             // Add final summary message below *after* processing data and tasks
             console.log("[handleUserMessage] Onboarding is complete according to result. Processing final data...");
        }


        // Check if the interview is complete
        if (onboardingResult.isComplete) {
          console.log("[handleUserMessage] Onboarding marked as COMPLETE in the result.");

          if (onboardingResult.onboardingData) {
             console.log("[handleUserMessage] Onboarding data received:", onboardingResult.onboardingData);
            try {
              // Validate the structure (optional but recommended - schema handles basic validation)
              // OnboardingDataSchema.parse(onboardingResult.onboardingData); // Zod schema in flow handles this
              console.log("[handleUserMessage] Onboarding data seems valid (basic check).");

              // --- Task Creation Logic ---
               // Crucially, check the answeredStripe flag from the flow result
               if (onboardingResult.answeredStripe === true) {
                   console.log("[handleUserMessage] Onboarding result indicates Stripe question was just answered. Calling createOnboardingTask...");
                   await createOnboardingTask(onboardingResult.onboardingData); // Create task based on the answer
               } else {
                   console.log("[handleUserMessage] Onboarding complete, but answeredStripe flag is false or missing. No task created this turn.");
               }

              // --- Format Final Response ---
              console.log("[handleUserMessage] Formatting final completion message.");
              const jsonResponse = JSON.stringify(onboardingResult.onboardingData, null, 2);
              let finalMessage = `Onboarding complete! Here's the collected information:\n\`\`\`json\n${jsonResponse}\n\`\`\``;

              // Add task-related info to the final message if a task was potentially created
              if (onboardingResult.answeredStripe === true) {
                   console.log("[handleUserMessage] Adding task info to final message based on answeredStripe=true.");
                   if (onboardingResult.onboardingData.hasStripe === false) {
                       finalMessage += "\n\nA task has been added to your list to create a Stripe account.";
                   } else if (onboardingResult.onboardingData.hasStripe === true) {
                       finalMessage += "\n\nA task has been added to your list to connect your Stripe account.";
                   } else {
                        // Should not happen if answeredStripe is true and validation passed, but log just in case
                        console.warn("[handleUserMessage] answeredStripe=true but hasStripe is not boolean in final data.");
                   }
               } else {
                   console.log("[handleUserMessage] answeredStripe is false, not adding task info to final message.");
               }
               finalMessage += "\nYou can view your tasks using the Tasklist button.";

              console.log("[handleUserMessage] Final message constructed:", finalMessage);
              addMessageToHistory('ai', finalMessage); // Add final summary to history
              console.log("[handleUserMessage] Resetting current flow state to null.");
              conversationState.currentFlow = null; // Reset flow state AFTER processing completion
              console.log("[handleUserMessage] Returning final onboarding completion response.");
              console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Onboarding Complete) =====");
              return { responseText: finalMessage };

            } catch (processingError) {
              console.error("[handleUserMessage] Error processing completed onboarding data:", processingError);
              const errorMsg = "Sorry, there was an issue processing the final onboarding information.";
               addMessageToHistory('ai', errorMsg);
               console.log("[handleUserMessage] Resetting current flow state to null due to processing error.");
               conversationState.currentFlow = null; // Reset flow state on error
               console.log("[handleUserMessage] Returning onboarding processing error response.");
               console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Onboarding Processing Error) =====");
               return { responseText: errorMsg };
            }
          } else {
              // Should ideally not happen if isComplete is true based on the flow logic
              console.error("[handleUserMessage] Onboarding complete but no onboardingData returned.");
               const errorMsg = "Onboarding seems complete, but I couldn't retrieve the final data.";
               addMessageToHistory('ai', errorMsg);
               console.log("[handleUserMessage] Resetting current flow state to null due to missing data error.");
               conversationState.currentFlow = null; // Reset flow state
               console.log("[handleUserMessage] Returning onboarding missing data error response.");
               console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Onboarding Missing Data Error) =====");
               return { responseText: errorMsg };
          }
        } else if (onboardingResult.nextQuestion) {
          console.log("[handleUserMessage] Onboarding asking next question.");
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
          console.log("[handleUserMessage] Asking next onboarding question:", questionText);
          console.log("[handleUserMessage] Keeping current flow state: 'onboarding'.");
          // Keep conversationState.currentFlow = 'onboarding'
          console.log("[handleUserMessage] Returning next question response.");
          console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Onboarding Next Question) =====");
          return { responseText: questionText, actions: actions };

        } else {
           // Handle unexpected case where interview is not complete but no question is provided
           console.error("[handleUserMessage] Onboarding flow error: Not complete, but no next question provided.");
           const errorMsg = "Sorry, I got stuck during the onboarding process. Could you try starting again?";
           addMessageToHistory('ai', errorMsg);
           console.log("[handleUserMessage] Resetting current flow state to null due to stuck error.");
           conversationState.currentFlow = null; // Reset flow
           console.log("[handleUserMessage] Returning onboarding stuck error response.");
           console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Onboarding Stuck Error) =====");
           return { responseText: errorMsg };
        }

      case 'create_product':
         console.log("[handleUserMessage] Placeholder for Create Product flow.");
         const response = "The 'Create Product' feature is not implemented yet.";
         addMessageToHistory('ai', response);
         conversationState.currentFlow = null; // Reset immediately for this placeholder
         console.log("[handleUserMessage] Resetting current flow state to null (placeholder).");
         console.log("[handleUserMessage] Returning create product placeholder response.");
         console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Create Product Placeholder) =====");
         return { responseText: response };

      // Note: 'view_tasks' case is handled directly before the switch

      default:
        // --- Default/Praise Agent Flow (when no specific flow is active) ---
        console.log("[handleUserMessage] No active flow, proceeding with default handling (parse/triage/praise test).");

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
            const spamResponse = "This message appears to be spam and has been discarded.";
            addMessageToHistory('ai', spamResponse);
            console.log("[handleUserMessage] Returning spam response.");
            console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Spam Detected) =====");
            return { responseText: spamResponse };
        }

        // 3. Executive Agent (Direct Delegation to Praise Agent FOR TESTING)
        console.log("[handleUserMessage] Step 3: Delegating to praiseAgent (testing)...");
        const praiseResult = await praiseAgent({ message: message });
        console.log("[handleUserMessage] Step 3: praiseAgent successful. Result:", praiseResult);

        if (!praiseResult || typeof praiseResult.praisedMessage !== 'string') {
            console.error("[handleUserMessage] Error: Praise Agent did not return a valid praised message. Result:", praiseResult);
            const errorResponse = "Sorry, the Praise Agent couldn't process the message correctly.";
             addMessageToHistory('ai', errorResponse);
             console.log("[handleUserMessage] Returning praise agent error response.");
             console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Praise Agent Error) =====");
             return { responseText: errorResponse };
        }

        // 4. Return Praise Agent's Response
        console.log("[handleUserMessage] Step 4: Returning praised message to user:", praiseResult.praisedMessage);
        addMessageToHistory('ai', praiseResult.praisedMessage);
        console.log("[handleUserMessage] Returning default praise response.");
        console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Default Praise Response) =====");
        return { responseText: praiseResult.praisedMessage };
    }

  } catch (error: any) {
    console.error("[handleUserMessage] Error caught in top-level try-catch:", error);
    const errorMessage = error?.message || 'Unknown error';
    const finalErrorMsg = `Sorry, I encountered an internal error while processing your request. Please try again later. (Details: ${errorMessage})`;
    addMessageToHistory('ai', finalErrorMsg); // Log error response to history
    console.log("[handleUserMessage] Resetting current flow state to null due to top-level error.");
    conversationState.currentFlow = null; // Reset flow state on error
    console.log("[handleUserMessage] Returning top-level error response.");
    console.log("[handleUserMessage] ===== END MESSAGE HANDLING (Top-Level Error) =====");
    return { responseText: finalErrorMsg };
  } finally {
       console.log("[handleUserMessage] Final state AFTER processing:", JSON.stringify(conversationState, null, 2)); // Log final state
       console.log(`[handleUserMessage] ===== FINISHED MESSAGE HANDLING =====`);
  }
}

// TODO: Replace in-memory state and task storage with Firestore.
// TODO: Implement task completion logic (e.g., buttons in task list).
// TODO: Implement updateTask flow usage.
// TODO: Refine getTasks flow to handle user context (userId).
// TODO: Implement actual sub-agent execution logic based on triage/intent when not testing praise agent.
// TODO: Integrate ModelContextProtocol SDK for tool usage within sub-agents.
// TODO: Implement actual channel integrations (Email, WhatsApp, Voice) - these would likely trigger this action.
