import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Term, TermGroup } from '@/types/terms';
import { logger, captureError } from '@/utils/logger';

interface TermsContextType {
  termGroups: TermGroup[];
  isLoading: boolean;
  createGroup: (name: string, description?: string) => Promise<TermGroup>;
  deleteGroup: (groupId: string) => Promise<void>;
  updateGroup: (groupId: string, updates: Partial<Pick<TermGroup, 'name' | 'description'>>) => Promise<void>;
  addTerm: (groupId: string, originalText: string, correctedText: string, context?: string) => Promise<void>;
  removeTerm: (groupId: string, termId: string) => Promise<void>;
  updateTerm: (groupId: string, termId: string, updates: Partial<Pick<Term, 'originalText' | 'correctedText' | 'context'>>) => Promise<void>;
  applyGroupToBook: (groupId: string, bookId: string) => Promise<void>;
  removeGroupFromBook: (groupId: string, bookId: string) => Promise<void>;
  getGroupsForBook: (bookId: string) => TermGroup[];
  getReplacementMap: (bookId: string) => Map<string, string>;
}

const TermsContext = createContext<TermsContextType | undefined>(undefined);

const TERM_GROUPS_KEY = '@miyo/term-groups';

export function TermsProvider({ children }: { children: ReactNode }) {
  const [termGroups, setTermGroups] = useState<TermGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const json = await AsyncStorage.getItem(TERM_GROUPS_KEY);
      if (json) {
        setTermGroups(JSON.parse(json));
      }
      logger.info('Term groups loaded');
    } catch (error) {
      captureError('Load Term Groups', error);
    } finally {
      setIsLoading(false);
    }
  };

  const persist = async (groups: TermGroup[]) => {
    try {
      await AsyncStorage.setItem(TERM_GROUPS_KEY, JSON.stringify(groups));
    } catch (error) {
      captureError('Save Term Groups', error);
    }
  };

  const createGroup = useCallback(async (name: string, description?: string): Promise<TermGroup> => {
    const newGroup: TermGroup = {
      id: `tg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      terms: [],
      appliedToBooks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...termGroups, newGroup];
    setTermGroups(updated);
    await persist(updated);
    logger.info('Term group created', { name });
    return newGroup;
  }, [termGroups]);

  const deleteGroup = useCallback(async (groupId: string) => {
    const updated = termGroups.filter(g => g.id !== groupId);
    setTermGroups(updated);
    await persist(updated);
    logger.info('Term group deleted', { groupId });
  }, [termGroups]);

  const updateGroup = useCallback(async (groupId: string, updates: Partial<Pick<TermGroup, 'name' | 'description'>>) => {
    const updated = termGroups.map(g =>
      g.id === groupId ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
    );
    setTermGroups(updated);
    await persist(updated);
  }, [termGroups]);

  const addTerm = useCallback(async (groupId: string, originalText: string, correctedText: string, context?: string) => {
    const newTerm: Term = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      originalText,
      correctedText,
      context,
      createdAt: new Date().toISOString(),
    };
    const updated = termGroups.map(g =>
      g.id === groupId
        ? { ...g, terms: [...g.terms, newTerm], updatedAt: new Date().toISOString() }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
    logger.info('Term added', { groupId, originalText, correctedText });
  }, [termGroups]);

  const removeTerm = useCallback(async (groupId: string, termId: string) => {
    const updated = termGroups.map(g =>
      g.id === groupId
        ? { ...g, terms: g.terms.filter(t => t.id !== termId), updatedAt: new Date().toISOString() }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
  }, [termGroups]);

  const updateTerm = useCallback(async (
    groupId: string,
    termId: string,
    updates: Partial<Pick<Term, 'originalText' | 'correctedText' | 'context'>>
  ) => {
    const updated = termGroups.map(g =>
      g.id === groupId
        ? {
            ...g,
            terms: g.terms.map(t => (t.id === termId ? { ...t, ...updates } : t)),
            updatedAt: new Date().toISOString(),
          }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
  }, [termGroups]);

  const applyGroupToBook = useCallback(async (groupId: string, bookId: string) => {
    const updated = termGroups.map(g =>
      g.id === groupId && !g.appliedToBooks.includes(bookId)
        ? { ...g, appliedToBooks: [...g.appliedToBooks, bookId], updatedAt: new Date().toISOString() }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
    logger.info('Term group applied to book', { groupId, bookId });
  }, [termGroups]);

  const removeGroupFromBook = useCallback(async (groupId: string, bookId: string) => {
    const updated = termGroups.map(g =>
      g.id === groupId
        ? { ...g, appliedToBooks: g.appliedToBooks.filter(id => id !== bookId), updatedAt: new Date().toISOString() }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
  }, [termGroups]);

  const getGroupsForBook = useCallback((bookId: string) => {
    return termGroups.filter(g => g.appliedToBooks.includes(bookId));
  }, [termGroups]);

  const getReplacementMap = useCallback((bookId: string): Map<string, string> => {
    const map = new Map<string, string>();
    const groups = termGroups.filter(g => g.appliedToBooks.includes(bookId));
    // Later groups override earlier ones for the same original text
    for (const group of groups) {
      for (const term of group.terms) {
        map.set(term.originalText, term.correctedText);
      }
    }
    return map;
  }, [termGroups]);

  return (
    <TermsContext.Provider
      value={{
        termGroups,
        isLoading,
        createGroup,
        deleteGroup,
        updateGroup,
        addTerm,
        removeTerm,
        updateTerm,
        applyGroupToBook,
        removeGroupFromBook,
        getGroupsForBook,
        getReplacementMap,
      }}
    >
      {children}
    </TermsContext.Provider>
  );
}

export function useTerms() {
  const context = useContext(TermsContext);
  if (context === undefined) {
    throw new Error('useTerms must be used within a TermsProvider');
  }
  return context;
}
