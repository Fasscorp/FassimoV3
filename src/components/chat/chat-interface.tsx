
"use client";

import * as React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Plus, Clipboard, RefreshCw } from "lucide-react"; // Added RefreshCw icon
import { handleUserMessage } from '@/actions/handle-user-message'; // Action to handle user message

interface Message {
  id: string;
  sender: "user" | "ai" | "system" | "action"; // Added 'system' and 'action' sender types
  text: string;
  actions?: Array<{ label: string; trigger: string }>; // Optional actions (buttons)
}

// Define the specific trigger messages
const ONBOARDING_TRIGGER = 'START_ONBOARDING_INTERVIEW';
const CREATE_PRODUCT_TRIGGER = 'START_CREATE_PRODUCT'; // Placeholder for future feature
const RESET_CONVERSATION_TRIGGER = 'RESET_CONVERSATION'; // Trigger for resetting

// Initial message definition
const initialMessage: Message = {
  id: "initial-greeting",
  sender: "system",
  text: "Hello! What would you like to work on today?",
  actions: [
    { label: "Onboarding", trigger: ONBOARDING_TRIGGER },
    { label: "Create Product", trigger: CREATE_PRODUCT_TRIGGER },
  ],
};

export function ChatInterface() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([initialMessage]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showInput, setShowInput] = React.useState(false); // Initially hide input until a choice is made
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Function to reset the chat
  const resetChat = async () => {
    console.log("[resetChat] Resetting conversation...");
    setIsLoading(true); // Show loading indicator during reset
    try {
      // Call the server action with the reset trigger
      const resetResponse = await handleUserMessage(RESET_CONVERSATION_TRIGGER, 'chat');
      // Reset local state
      setMessages([
          // Optionally display the response from the reset action, or just the initial message
          // { id: 'reset-confirm', sender: 'system', text: resetResponse },
          initialMessage // Reset to the initial greeting and options
      ]);
      setInput("");
      setShowInput(false); // Hide input again
    } catch (error) {
       console.error("Error resetting chat:", error);
       // Keep existing messages but show an error toast/message if preferred
       setMessages(prev => [...prev, { id: 'reset-error', sender: 'system', text: 'Failed to reset the conversation. Please try again.'}]);
    } finally {
        setIsLoading(false);
    }
  };


  // Function to send a regular text message
  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return; // Prevent sending while loading or empty

    const userMessage: Message = { id: Date.now().toString(), sender: "user", text: trimmedInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput(""); // Clear input immediately

    await processMessage(trimmedInput, "user");
  };

  // Function to handle button clicks (actions)
  const handleActionClick = async (trigger: string) => {
     if (isLoading) return; // Prevent action clicks while loading

    // Find the message with the action to remove buttons after click
    const actionMessageIndex = messages.findIndex(msg => msg.actions?.some(a => a.trigger === trigger));

    if (actionMessageIndex !== -1) {
        setMessages(prevMessages =>
            prevMessages.map((msg, index) =>
                index === actionMessageIndex ? { ...msg, actions: undefined } : msg
            )
        );
    }

    // Get the label for the clicked button to display as user message (optional, but good UX)
    const actionLabel = messages[actionMessageIndex]?.actions?.find(a => a.trigger === trigger)?.label || trigger;

    // Add the user's choice as a message (use 'action' sender type for clarity in history)
    const userChoiceMessage: Message = { id: Date.now().toString(), sender: "action", text: actionLabel };
    setMessages((prev) => [...prev, userChoiceMessage]);

    // Process the trigger associated with the button
    await processMessage(trigger, "action"); // Pass trigger and 'action' type

    // Show the input field after the initial choice is made
    setShowInput(true);
  };

  // Central function to process messages (user input or action triggers)
  const processMessage = async (content: string, type: "user" | "action") => {
    // Note: User/Action message is added *before* calling this function
    setIsLoading(true);

    try {
      // Call the server action to handle the message/trigger
      // Use 'chat' channel for all interactions originating from the web UI
      const aiResponseText = await handleUserMessage(content, 'chat');

      // Add the AI's response message
      const aiMessage: Message = { id: (Date.now() + 1).toString(), sender: "ai", text: aiResponseText };
      setMessages((prev) => [...prev, aiMessage]);

      // Check if the response suggests the flow is ongoing or requires more input
      const lowerResponse = aiResponseText.toLowerCase();
      const requiresMoreInput = !(lowerResponse.includes("complete") || lowerResponse.includes("error") || lowerResponse.includes("sorry") || lowerResponse.startsWith("onboarding complete!"));

      if (requiresMoreInput) {
        setShowInput(true);
      } else {
        // Optionally hide input if the flow seems finished or hit an error state
        // setShowInput(false); // Uncomment if you want to hide input on completion/error
      }


    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessageText = `Sorry, I encountered an error processing your request. Details: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const errorMessage: Message = { id: (Date.now() + 1).toString(), sender: "ai", text: errorMessageText };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };


  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  React.useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
        // Use querySelector to find the viewport element
        const viewport = scrollAreaRef.current.querySelector('div[style*="overflow: hidden scroll;"]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);


  return (
    <div className="flex justify-center items-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl shadow-lg rounded-lg">
        <CardHeader className="border-b flex flex-row justify-between items-center"> {/* Use flexbox for alignment */}
          <CardTitle className="text-lg font-semibold text-foreground">FASSIMO v3.0</CardTitle>
          {/* Changed variant to destructive */}
          <Button variant="destructive" size="icon" onClick={resetChat} disabled={isLoading} aria-label="Reset chat">
            <RefreshCw className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px] p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  <div
                    className={`flex items-start gap-3 ${
                      message.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* AI and System messages aligned left */}
                    {(message.sender === "ai" || message.sender === "system") && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="https://picsum.photos/32/32?grayscale" alt="AI Avatar" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    )}
                    {/* Add placeholder for action messages if needed, or style them like system messages */}
                    {message.sender === "action" && <div className="w-8 h-8 shrink-0"></div> }


                    <div
                      className={`rounded-lg p-3 max-w-[75%] whitespace-pre-wrap ${
                        message.sender === "user"
                          ? "bg-primary text-primary-foreground"
                           : message.sender === "ai"
                           ? "bg-secondary text-secondary-foreground"
                           : "bg-muted text-muted-foreground" // Style for system and action messages
                      }`}
                    >
                      {message.text}
                    </div>
                    {message.sender === "user" && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="https://picsum.photos/32/32" alt="User Avatar" />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                   {/* Render action buttons below the message */}
                   {message.actions && (
                     <div className="flex justify-start gap-2 mt-2 pl-11"> {/* Adjusted padding */}
                       {message.actions.map((action) => (
                         <Button
                           key={action.trigger}
                           variant="outline"
                           size="sm"
                           onClick={() => handleActionClick(action.trigger)}
                           disabled={isLoading}
                         >
                            {/* Add icons based on action label - extend as needed */}
                            {action.label === "Onboarding" && <Clipboard className="mr-2 h-4 w-4" />}
                            {action.label === "Create Product" && <Plus className="mr-2 h-4 w-4" />}
                            {action.label}
                         </Button>
                       ))}
                     </div>
                   )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3 justify-start">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://picsum.photos/32/32?grayscale" alt="AI Avatar" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg p-3 bg-secondary text-secondary-foreground animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
         {/* Conditionally render the input area - show if showInput is true */}
         {showInput && (
          <CardFooter className="p-4 border-t">
            <div className="flex w-full items-center space-x-2">
              <Textarea
                placeholder="Type your message here..."
                className="flex-1 resize-none min-h-[40px] max-h-[150px]"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                aria-label="Chat input"
              />
              <Button type="submit" size="icon" onClick={sendMessage} disabled={isLoading || !input.trim()} aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
         )}
      </Card>
    </div>
  );
}

