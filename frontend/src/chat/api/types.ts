export type ChatParticipant = {
  id: number;
  username: string;
  profile_image?: string | null;
};

export type ChatMessageSender = {
  id?: number;
  username: string;
};

export type ChatMessage = {
  id: number;
  content: string;
  sender: ChatMessageSender;
  created_at: string;
};

export type ChatListItem = {
  id: number;
  participants: ChatParticipant[];
  last_message?: ChatMessage | null;
  unread_count?: number;
};

export type CreateChatPayload = {
  username: string;
  message?: string;
};

export type SendMessagePayload = {
  content: string;
};

export type MessagesPage = {
  results: ChatMessage[];
  next_before: number | null;
};

export type ChatUserSearchHit = {
  id: number;
  username: string;
  profile_username: string | null;
  profile_image: string | null;
};
