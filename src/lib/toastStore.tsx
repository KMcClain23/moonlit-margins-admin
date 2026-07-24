import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Toast, { type ToastVariant } from "../components/Toast";

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Wraps the whole app (above NavigationContainer, in App.tsx) so
 * showToast() is callable from any screen and the toast itself survives
 * screen transitions (e.g. a "Task updated" toast fired right before
 * navigation.goBack() still finishes its animation on the screen behind
 * it). Only one toast is shown at a time -- a new call while one is
 * already visible replaces it outright (remounted via a fresh `key`,
 * restarting its entrance animation) rather than queuing. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; variant: ToastVariant } | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    idRef.current += 1;
    setToast({ id: idRef.current, message, variant });
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {toast ? (
          <Toast key={toast.id} message={toast.message} variant={toast.variant} onDone={() => setToast(null)} />
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
