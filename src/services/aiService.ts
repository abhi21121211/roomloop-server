import axios from "axios";
import { IRoom } from "../models/Room";
import { IMessage } from "../models/Message";
import { IUser } from "../models/User";
import dotenv from "dotenv";

dotenv.config();

interface AIResponse {
  success: boolean;
  data: any;
  error?: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ModerationResult {
  isAppropriate: boolean;
  confidence: number;
  flaggedContent?: string[];
  suggestions?: string[];
  error?: string;
}

interface RoomSuggestion {
  roomId: string;
  title: string;
  reason: string;
  confidence: number;
}

interface RoomSummary {
  summary: string;
  keyTopics: string[];
  participantCount: number;
  duration: string;
  sentiment: "positive" | "neutral" | "negative";
}

// Free LLM Provider Configuration
interface LLMProvider {
  name: string;
  baseURL: string;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

class AIService {
  private providers: LLMProvider[];
  private currentProvider!: LLMProvider;
  private isAvailable: boolean = false;

  constructor() {
    // Configure free LLM providers
    this.providers = [
      // OpenRouter (Free tier with reliable models)
      {
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        model: "mistralai/mistral-7b-instruct", // Free model
        maxTokens: 200,
        temperature: 0.7,
      },
      // Ollama (Local, completely free)
      {
        name: "ollama",
        baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: "llama2:7b", // Free local model
        maxTokens: 150,
        temperature: 0.7,
      },
      // Hugging Face Inference API (Free tier) - fallback
      {
        name: "huggingface",
        baseURL: "https://api-inference.huggingface.co/models",
        apiKey: process.env.HUGGINGFACE_API_KEY,
        model: "distilgpt2", // Free model - more reliable and faster
        maxTokens: 150,
        temperature: 0.7,
      },
    ];

    // Initialize provider immediately
    this.initializeProvider().catch((error) => {
      console.error("Failed to initialize AI provider:", error);
    });
  }

  private async initializeProvider() {
    // Try to find an available provider
    for (const provider of this.providers) {
      if (await this.testProvider(provider)) {
        this.currentProvider = provider;
        this.isAvailable = true;
        console.log(`AI Service initialized with ${provider.name}`);
        return;
      }
    }

    console.log("No AI providers available. AI features will be disabled.");
    this.isAvailable = false;
  }

  private async testProvider(provider: LLMProvider): Promise<boolean> {
    try {
      console.log(`Testing provider: ${provider.name}`);
      console.log(`Provider config:`, {
        name: provider.name,
        baseURL: provider.baseURL,
        model: provider.model,
        hasApiKey: !!provider.apiKey,
      });

      if (
        (provider.name === "huggingface" || provider.name === "openrouter") &&
        !provider.apiKey
      ) {
        console.log(`${provider.name} provider skipped - no API key`);
        return false;
      }

      // Test the provider with a simple request
      const testResponse = await this.makeLLMRequest(provider, {
        messages: [{ role: "user", content: "Hello" }],
      });

      console.log(`Provider ${provider.name} test response:`, testResponse);
      return testResponse.success;
    } catch (error: any) {
      console.log(`Provider ${provider.name} not available:`, error.message);
      console.log(`Full error:`, error);
      return false;
    }
  }

  private async makeLLMRequest(
    provider: LLMProvider,
    requestData: any
  ): Promise<any> {
    const headers: any = {
      "Content-Type": "application/json",
    };

    if (provider.apiKey) {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    let url = "";
    let payload: any = {};

    switch (provider.name) {
      case "openrouter":
        url = `${provider.baseURL}/chat/completions`;
        payload = {
          model: provider.model,
          messages: requestData.messages,
          max_tokens: provider.maxTokens,
          temperature: provider.temperature,
        };
        break;

      case "huggingface":
        url = `${provider.baseURL}/${provider.model}`;
        payload = {
          inputs: requestData.messages[requestData.messages.length - 1].content,
          parameters: {
            max_new_tokens: provider.maxTokens,
            temperature: provider.temperature,
            return_full_text: false,
          },
        };
        break;

      case "ollama":
        url = `${provider.baseURL}/api/generate`;
        payload = {
          model: provider.model,
          prompt: requestData.messages[requestData.messages.length - 1].content,
          stream: false,
          options: {
            temperature: provider.temperature,
            num_predict: provider.maxTokens,
          },
        };
        break;

      default:
        throw new Error(`Unsupported provider: ${provider.name}`);
    }

    const response = await axios.post(url, payload, { headers });
    return this.parseProviderResponse(provider.name, response.data);
  }

  private parseProviderResponse(providerName: string, data: any): any {
    switch (providerName) {
      case "openrouter":
        return {
          success: true,
          response:
            data.choices?.[0]?.message?.content || "No response generated",
        };

      case "huggingface":
        return {
          success: true,
          response: data[0]?.generated_text || "No response generated",
        };

      case "ollama":
        return {
          success: true,
          response: data.response || "No response generated",
        };

      default:
        return {
          success: false,
          response: "Unknown provider response format",
        };
    }
  }

  /**
   * Check if AI service is available
   */
  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * AI Chat Assistant - Provides helpful responses in rooms
   */
  async chatAssistant(
    message: string,
    roomContext: string,
    conversationHistory: ChatMessage[]
  ): Promise<AIResponse> {
    try {
      if (!this.isAvailable) {
        return {
          success: false,
          data: null,
          error: "AI service not available",
        };
      }

      console.log("AI Service Debug:");
      console.log("Current Provider:", this.currentProvider.name);
      console.log("Room Context Length:", roomContext.length);
      console.log("Message:", message);

      const systemPrompt = `You are Ted, a friendly and knowledgeable AI assistant in a virtual meeting room called RoomLoop. 
      Your role is to help participants with questions, provide information, and facilitate discussions.
      
      Room Context: ${roomContext}
      
      Your personality:
      - You're named Ted and you're enthusiastic about helping people
      - You're knowledgeable about RoomLoop features and virtual meetings
      - You're friendly, supportive, and use emojis to keep conversations engaging
      - You stay focused on the room's topic and help guide discussions
      - You're a bit witty and like to make people feel comfortable
      - You remember the room context and refer to it in your responses
      - You're proactive in suggesting ways to improve the meeting experience
      
      Guidelines:
      - Keep responses under 200 words
      - Be helpful but not intrusive
      - Use emojis occasionally to keep the tone friendly
      - If asked about room features, explain them clearly
      - Don't provide personal advice or medical information
      - Always introduce yourself as Ted when appropriate
      - Stay relevant to the room's context and ongoing discussion
      - Reference the room's topic, participants, or recent messages when relevant
      - Be encouraging and supportive of the group's discussion`;

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-5), // Keep last 5 messages for context
        { role: "user", content: message },
      ];

      const result = await this.makeLLMRequest(this.currentProvider, {
        messages,
      });

      console.log("AI Response Debug:");
      console.log("Raw Response:", result.response);

      // If the response seems generic, provide a more specific response
      let finalResponse = result.response;
      if (
        result.response.includes("I'm just an AI") ||
        result.response.includes("I don't have access")
      ) {
        // Provide a more specific response based on the question
        if (
          message.toLowerCase().includes("how many people") ||
          message.toLowerCase().includes("participants")
        ) {
          finalResponse = `Based on the room information, there are currently ${
            roomContext.includes("Participants:")
              ? roomContext.split("Participants:")[1].split("people")[0].trim()
              : "0"
          } people in this room. I can see this is a ${
            roomContext.includes("Type:")
              ? roomContext.split("Type:")[1].split("(")[0].trim()
              : "meeting"
          } room. 🤖`;
        } else if (
          message.toLowerCase().includes("what") &&
          message.toLowerCase().includes("room")
        ) {
          finalResponse = `This is the "${roomContext
            .split("Room:")[1]
            .split("\n")[0]
            .trim()}" room. ${roomContext
            .split("Description:")[1]
            .split("\n")[0]
            .trim()}. It's currently ${
            roomContext.includes("Type:")
              ? roomContext.split("Type:")[1].split("(")[1].split(")")[0].trim()
              : "active"
          }. 🤖`;
        } else {
          finalResponse = `Hi! I'm Ted, your AI assistant for this room. I can see this is "${roomContext
            .split("Room:")[1]
            .split("\n")[0]
            .trim()}" with ${
            roomContext.includes("Participants:")
              ? roomContext.split("Participants:")[1].split("people")[0].trim()
              : "0"
          } participants. How can I help you today? 🤖`;
        }
      }

      return {
        success: result.success,
        data: {
          response: finalResponse,
          usage: { total_tokens: finalResponse.length },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || "Failed to get AI response",
      };
    }
  }

  /**
   * Content Moderation - Simple keyword-based moderation (free alternative)
   */
  async moderateContent(content: string): Promise<ModerationResult> {
    try {
      // Simple keyword-based moderation (free alternative to OpenAI moderation)
      const inappropriateKeywords = [
        "hate",
        "harassment",
        "abuse",
        "violence",
        "threat",
        "discrimination",
        "bullying",
        "spam",
        "scam",
      ];

      const contentLower = content.toLowerCase();
      const flaggedWords = inappropriateKeywords.filter((word) =>
        contentLower.includes(word)
      );

      const confidence = flaggedWords.length > 0 ? 0.8 : 0.9;

      return {
        isAppropriate: flaggedWords.length === 0,
        confidence,
        flaggedContent: flaggedWords.length > 0 ? [content] : undefined,
        suggestions:
          flaggedWords.length > 0
            ? ["Please keep the conversation respectful and appropriate"]
            : undefined,
      };
    } catch (error: any) {
      return {
        isAppropriate: true, // Default to allowing if moderation fails
        confidence: 0.5,
        error: error.message,
      };
    }
  }

  /**
   * Generate Room Suggestions based on user preferences
   */
  async suggestRooms(
    user: IUser,
    availableRooms: IRoom[],
    userHistory: IRoom[]
  ): Promise<RoomSuggestion[]> {
    try {
      if (!this.isAvailable || availableRooms.length === 0) {
        return this.fallbackRoomSuggestions(user, availableRooms, userHistory);
      }

      // Create user profile based on history
      const userInterests = this.extractUserInterests(userHistory);

      const prompt = `Based on the user's interests and room history, suggest the best rooms for them to join.
      
      User Interests: ${userInterests.join(", ")}
      Available Rooms: ${availableRooms
        .map((r) => `${r.title} (${r.tags.join(", ")})`)
        .join("; ")}
      
      Return suggestions in JSON format with roomId, reason, and confidence (0-1).`;

      const messages = [{ role: "user", content: prompt }];
      const result = await this.makeLLMRequest(this.currentProvider, {
        messages,
      });

      if (result.success) {
        try {
          const suggestions = JSON.parse(result.response);
          return suggestions.slice(0, 3); // Return top 3 suggestions
        } catch (parseError) {
          // Fallback if JSON parsing fails
          return this.fallbackRoomSuggestions(
            user,
            availableRooms,
            userHistory
          );
        }
      } else {
        return this.fallbackRoomSuggestions(user, availableRooms, userHistory);
      }
    } catch (error: any) {
      return this.fallbackRoomSuggestions(user, availableRooms, userHistory);
    }
  }

  /**
   * Generate Room Summary
   */
  async generateRoomSummary(
    messages: IMessage[],
    room: IRoom,
    participants: IUser[]
  ): Promise<RoomSummary> {
    try {
      if (!this.isAvailable || messages.length === 0) {
        return {
          summary: "No messages to summarize",
          keyTopics: [],
          participantCount: participants.length,
          duration: "0 minutes",
          sentiment: "neutral",
        };
      }

      const messageContent = messages
        .map((m) => {
          const senderName =
            typeof m.sender === "object" && "username" in m.sender
              ? (m.sender as any).username
              : "Unknown";
          return `${senderName}: ${m.content}`;
        })
        .join("\n")
        .slice(0, 1500); // Limit content length

      const prompt = `Summarize this room discussion in a concise way:
      
      Room: ${room.title}
      Messages: ${messageContent}
      
      Provide a JSON response with:
      - summary: brief overview of the discussion
      - keyTopics: main topics discussed
      - sentiment: overall sentiment (positive/neutral/negative)`;

      const messages_data = [{ role: "user", content: prompt }];
      const result = await this.makeLLMRequest(this.currentProvider, {
        messages: messages_data,
      });

      if (result.success) {
        try {
          const summaryData = JSON.parse(result.response);
          return {
            ...summaryData,
            participantCount: participants.length,
            duration: this.calculateRoomDuration(room),
          };
        } catch (parseError) {
          // Fallback summary
          return {
            summary: "Discussion summary generated successfully",
            keyTopics: ["General discussion"],
            participantCount: participants.length,
            duration: this.calculateRoomDuration(room),
            sentiment: "neutral",
          };
        }
      } else {
        return {
          summary: "Unable to generate summary at this time",
          keyTopics: [],
          participantCount: participants.length,
          duration: this.calculateRoomDuration(room),
          sentiment: "neutral",
        };
      }
    } catch (error: any) {
      return {
        summary: "Unable to generate summary at this time",
        keyTopics: [],
        participantCount: participants.length,
        duration: this.calculateRoomDuration(room),
        sentiment: "neutral",
      };
    }
  }

  /**
   * Generate Smart Notifications
   */
  async generateSmartNotification(
    user: IUser,
    event:
      | "room_starting"
      | "room_ending"
      | "new_invitation"
      | "activity_reminder",
    context: any
  ): Promise<string> {
    try {
      if (!this.isAvailable) {
        return this.getDefaultNotification(event, context);
      }

      const prompts = {
        room_starting: `Generate a friendly notification for ${user.username} about a room starting soon. Room: ${context.roomTitle}`,
        room_ending: `Generate a gentle reminder for ${user.username} that a room is ending soon. Room: ${context.roomTitle}`,
        new_invitation: `Generate an exciting notification for ${user.username} about a new room invitation. Room: ${context.roomTitle}`,
        activity_reminder: `Generate a motivational notification for ${user.username} to check out new rooms or activities.`,
      };

      const messages = [{ role: "user", content: prompts[event] }];
      const result = await this.makeLLMRequest(this.currentProvider, {
        messages,
      });

      if (result.success) {
        return result.response;
      } else {
        return this.getDefaultNotification(event, context);
      }
    } catch (error: any) {
      return this.getDefaultNotification(event, context);
    }
  }

  // Helper methods
  private extractUserInterests(roomHistory: IRoom[]): string[] {
    const interests = new Set<string>();
    roomHistory.forEach((room) => {
      room.tags.forEach((tag: string) => interests.add(tag));
    });
    return Array.from(interests);
  }

  private fallbackRoomSuggestions(
    user: IUser,
    availableRooms: IRoom[],
    userHistory: IRoom[]
  ): RoomSuggestion[] {
    const userInterests = this.extractUserInterests(userHistory);

    return availableRooms
      .map((room) => {
        const matchingTags = room.tags.filter((tag: string) =>
          userInterests.includes(tag)
        ).length;
        const confidence = matchingTags / Math.max(room.tags.length, 1);

        return {
          roomId: room._id.toString(),
          title: room.title,
          reason: `Matches your interests in ${
            matchingTags > 0 ? room.tags.slice(0, 2).join(", ") : "new topics"
          }`,
          confidence,
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  private calculateRoomDuration(room: IRoom): string {
    const start = new Date(room.startTime);
    const end = new Date(room.endTime);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / (1000 * 60));
    return `${minutes} minutes`;
  }

  private getDefaultNotification(event: string, context: any): string {
    const notifications = {
      room_starting: `🚀 "${context.roomTitle}" is starting soon!`,
      room_ending: `⏰ "${context.roomTitle}" will end in 5 minutes.`,
      new_invitation: `📧 You've been invited to "${context.roomTitle}"!`,
      activity_reminder: `💡 Check out new rooms and activities!`,
    };
    return (
      notifications[event as keyof typeof notifications] || "New notification"
    );
  }
}

export default new AIService();
