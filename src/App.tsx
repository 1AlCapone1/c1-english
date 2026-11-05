import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Protected } from "./components/Layout";
import { Loading, ErrorBox } from "./components/ui";
import { useAuth } from "./lib/auth";
import { configError } from "./lib/supabase";
import { Landing, Login, Register, ResetPassword, UpdatePassword, ConfirmEmail } from "./pages/Auth";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Vocabulary = lazy(() => import("./pages/Vocabulary"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const Grammar = lazy(() => import("./pages/Grammar"));
const GrammarLesson = lazy(() => import("./pages/GrammarLesson"));
const UseOfEnglish = lazy(() => import("./pages/UseOfEnglish"));
const Reading = lazy(() => import("./pages/Reading"));
const Listening = lazy(() => import("./pages/Listening"));
const Writing = lazy(() => import("./pages/Writing"));
const Speaking = lazy(() => import("./pages/Speaking"));
const Tests = lazy(() => import("./pages/Tests"));
const Exam = lazy(() => import("./pages/Exam"));
const Mistakes = lazy(() => import("./pages/Mistakes"));
const ProgressPage = lazy(() => import("./pages/Progress"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/admin/Admin"));
const Daily = lazy(() => import("./pages/Daily"));

export default function App() {
  const { session, recovery, loading } = useAuth();
  if (configError) return <div className="mx-auto max-w-xl p-8"><ErrorBox error={configError} /></div>;
  return (
    <HashRouter>
      <Suspense fallback={<div className="p-8"><Loading /></div>}>
        {recovery ? <UpdatePassword /> : <Routes>
          <Route path="/" element={loading ? <Loading /> : session ? <Navigate to="/dashboard" replace /> : <Landing />} />
          <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/register" element={session ? <Navigate to="/dashboard" replace /> : <Register />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/auth/confirm" element={<ConfirmEmail />} />
          <Route element={<Protected />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/daily" element={<Daily />} />
            <Route path="/vocabulary" element={<Vocabulary />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/grammar" element={<Grammar />} />
            <Route path="/grammar/:slug" element={<GrammarLesson />} />
            <Route path="/use-of-english" element={<UseOfEnglish />} />
            <Route path="/reading" element={<Reading />} />
            <Route path="/reading/:id" element={<Reading />} />
            <Route path="/listening" element={<Listening />} />
            <Route path="/writing" element={<Writing />} />
            <Route path="/speaking" element={<Speaking />} />
            <Route path="/tests" element={<Tests />} />
            <Route path="/exam" element={<Exam />} />
            <Route path="/mistakes" element={<Mistakes />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route element={<Protected admin />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<div className="mx-auto max-w-xl p-8"><h1 className="font-display text-3xl font-extrabold">Nie ma takiej strony</h1><a className="mt-4 inline-block text-accent underline" href="#/">Wróć na stronę główną</a></div>} />
        </Routes>}
      </Suspense>
    </HashRouter>
  );
}
