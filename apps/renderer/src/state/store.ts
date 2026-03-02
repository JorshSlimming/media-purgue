import create from 'zustand'

type ProgressMsg = {
  ts: string
  payload: any
}

type State = {
  messages: ProgressMsg[]
  addMessage: (payload: any) => void
  clear: () => void
}

export const useProgressStore = create<State>(set => ({
  messages: [],
  addMessage: payload => set(s => ({ messages: [...s.messages, { ts: new Date().toISOString(), payload }].slice(-200) })),
  clear: () => set({ messages: [] })
}))
