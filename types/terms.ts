/**
 * Term Management types for MTL translation correction.
 *
 * A Term represents a single translation correction (original → corrected).
 * A TermGroup collects related terms and can be applied to multiple books,
 * enabling automatic text replacement in the reader.
 */

export interface Term {
  id: string;
  /** The word or phrase as it appears in the MTL / original text */
  originalText: string;
  /** The user's preferred / corrected translation */
  correctedText: string;
  /** Optional example sentence for context */
  context?: string;
  createdAt: string;
}

export interface TermGroup {
  id: string;
  /** User-given name, e.g. "Solo Leveling Terms" */
  name: string;
  description?: string;
  terms: Term[];
  /** Book IDs this group is applied to */
  appliedToBooks: string[];
  createdAt: string;
  updatedAt: string;
}
