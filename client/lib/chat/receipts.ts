export type ReceiptMessage = {
  id: string;
  authorId: string;
  createdAt: string;
  deletedAt?: string | null;
};

export type ReceiptState = {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
};

function hasReadMessage(
  message: ReceiptMessage,
  messageIndex: number,
  messages: ReceiptMessage[],
  state: ReceiptState,
) {
  if (!state.lastReadMessageId) return false;
  if (state.lastReadMessageId === message.id) return true;

  const readIndex = messages.findIndex(
    (item) => item.id === state.lastReadMessageId,
  );
  if (readIndex >= 0) return readIndex >= messageIndex;

  // The read marker can point at a newer message outside the loaded page.
  if (!state.lastReadAt) return false;
  return Date.parse(state.lastReadAt) >= Date.parse(message.createdAt);
}

/**
 * A conversation shows receipts only on its newest own message, so the reader
 * gets one unambiguous "Read" line instead of a badge on every bubble.
 */
export function readReceiptForLastOwnMessage(
  messages: ReceiptMessage[],
  currentUserId: string,
  states: ReceiptState[],
) {
  let lastOwnIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (
      messages[index].authorId === currentUserId &&
      !messages[index].deletedAt
    ) {
      lastOwnIndex = index;
      break;
    }
  }
  if (lastOwnIndex < 0) return null;

  const message = messages[lastOwnIndex];
  const readerCount = states.filter(
    (state) =>
      state.userId !== currentUserId &&
      hasReadMessage(message, lastOwnIndex, messages, state),
  ).length;
  if (readerCount === 0) return null;

  return { messageId: message.id, readerCount };
}
