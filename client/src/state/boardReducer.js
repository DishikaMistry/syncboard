// Central board state. Deliberately outside the component tree (used via useReducer
// in App.jsx) so the sync engine can dispatch server-resolved updates into it without
// reaching into individual card components.

export const initialState = { board: null, lists: [], cards: [], connection: 'offline' };

export function boardReducer(state, action) {
  switch (action.type) {
    case 'LOAD_SNAPSHOT':
      return { ...state, board: action.board, lists: action.lists, cards: action.cards };

    case 'SET_CONNECTION':
      return { ...state, connection: action.status };

    case 'OPTIMISTIC_UPDATE':
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === action.cardId ? { ...c, [action.field]: action.value, _pending: true } : c
        ),
      };

    case 'APPLY_RESOLVED': {
      const { cardId, field, value } = action;
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === cardId ? { ...c, [field]: value, _pending: false } : c
        ),
      };
    }

    case 'ADD_CARD':
      // Prevent duplicate cards with same ID
      if (state.cards.some(c => c.id === action.card.id)) {
        return state;
      }
      return {
        ...state,
        cards: [...state.cards, action.card],
      };

    case 'DELETE_CARD':
      return {
        ...state,
        cards: state.cards.filter(c => c.id !== action.cardId),
      };

    default:
      return state;
  }
}
