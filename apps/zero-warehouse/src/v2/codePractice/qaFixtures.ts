import { JAVA_LOGIC_REFERENCE, composeLogicBody } from './logicReference'

// QA uses the same structured source as the visible reference, so the two cannot drift.
export const CORRECT_JAVA_BODY = composeLogicBody(JAVA_LOGIC_REFERENCE)
