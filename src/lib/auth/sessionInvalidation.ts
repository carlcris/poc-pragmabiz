export const SESSION_INVALID_EVENT = "app:session-invalid";
const INTENTIONAL_LOGOUT_KEY = "app:intentional-logout";
const SESSION_INVALID_NOTICE_KEY = "app:session-invalid-notice-shown";

export type SessionInvalidEventDetail = {
  status?: number;
};

export const isSessionInvalidStatus = (status: number): boolean => status === 401;

export const notifySessionInvalid = (detail: SessionInvalidEventDetail = {}): void => {
  if (typeof window === "undefined") return;
  if (hasIntentionalLogoutMarker()) return;
  window.dispatchEvent(
    new CustomEvent<SessionInvalidEventDetail>(SESSION_INVALID_EVENT, { detail })
  );
};

export const markIntentionalLogout = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(INTENTIONAL_LOGOUT_KEY, "1");
};

export const hasIntentionalLogoutMarker = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(INTENTIONAL_LOGOUT_KEY) === "1";
};

export const clearIntentionalLogoutMarker = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(INTENTIONAL_LOGOUT_KEY);
};

export const markSessionInvalidNoticeShown = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_INVALID_NOTICE_KEY, "1");
};

export const hasSessionInvalidNoticeShown = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SESSION_INVALID_NOTICE_KEY) === "1";
};

export const clearSessionInvalidNoticeShown = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_INVALID_NOTICE_KEY);
};
