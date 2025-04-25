
'use server';
/**
 * @fileOverview Defines the Add Task flow using Genkit.
 * This flow adds a new task to a persistent store (e.g., Firestore).
 *
 * - addTask - Function to invoke the add task flow.
 * - AddTaskInput - Input type for adding a task.
 * - AddTaskOutput - Output type confirming task addition.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { internalAddTask, type Task } from './get-tasks'; // Import internal function and Task type

// Define the input schema for adding a task
const AddTaskInputSchema = z.object({
  description: z.string().describe('The description of the task.'),
  priority: z.enum(['high', 'medium', 'low']).describe('The priority of the task.'),
  dueDate: z.string().optional().describe('Optional due date in ISO 8601 format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ).'),
});
export type AddTaskInput = z.infer<typeof AddTaskInputSchema>;

// Define the output schema for the add task flow
const AddTaskOutputSchema = z.object({
  taskId: z.string().describe('The unique ID of the newly created task.'),
  message: z.string().describe('Confirmation message.'),
});
export type AddTaskOutput = z.infer<typeof AddTaskOutputSchema>;

/**
 * Adds a new task to the task list.
 * In a real application, this would interact with a database (e.g., Firestore).
 * @param input The task details.
 * @returns Confirmation of task addition.
 */
export async function addTask(input: AddTaskInput): Promise<AddTaskOutput> {
  console.log("[addTask] Invoked with input:", input);
  // In a real app, replace this mock flow with actual database interaction.
  // This mock simulates adding a task and returning a generated ID.
  return addTaskFlow(input);
}

// Define the Genkit flow for adding a task
const addTaskFlow = ai.defineFlow<
  typeof AddTaskInputSchema,
  typeof AddTaskOutputSchema
>(
  {
    name: 'addTaskFlow',
    inputSchema: AddTaskInputSchema,
    outputSchema: AddTaskOutputSchema,
    // This flow doesn't need an LLM, it's for interacting with a service/database.
    // We might use a tool or direct service call here in a real implementation.
  },
  async (input) => {
    console.log("[addTaskFlow] Flow invoked with:", input);

    // --- Database Interaction Placeholder ---
    // In a real application:
    // 1. Connect to Firestore (or your chosen DB).
    // 2. Add a new document to the 'tasks' collection with the input data
    //    and set 'completed' to false.
    // 3. Get the generated document ID from Firestore.
    // ----------------------------------------

    // Mocking database interaction using the internal function:
    const mockTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newTask: Task = {
        id: mockTaskId,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
        completed: false, // New tasks are not completed
    };

    internalAddTask(newTask); // Add to the shared mock DB via internal function
    console.log(`[addTaskFlow] Task added via internal function. Task ID: ${mockTaskId}.`);

    // Simulate success
    const output: AddTaskOutput = {
      taskId: mockTaskId,
      message: `Task "${input.description}" added successfully with ID ${mockTaskId}.`,
    };

    console.log("[addTaskFlow] Flow successful. Returning output:", output);
    return output;
  }
);
