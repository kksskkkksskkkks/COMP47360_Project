import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Login from "./pages/Login";
import Recommendations from "./pages/Recommendations";
import AttractionList from "./pages/AttractionList";
import AttractionDetail from "./pages/AttractionDetail";

// Leaflet pulls in extra weight that most visitors never need, so it's
// only loaded when someone actually visits the heat map route.
const HeatMap = lazy(() => import("./pages/HeatMap"));

function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-background pt-[80px]">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

function LazyPage({ children }) {
  return <Suspense fallback={<p className="p-lg text-secondary">Loading…</p>}>{children}</Suspense>;
}

// Per the backend SecurityConfig: except for /api/auth/register and /api/auth/login,
// every other endpoint requires authentication (anyRequest().authenticated()).
// So every page below is wrapped in ProtectedRoute, not treated as public.
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Recommendations />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gems"
            element={
              <ProtectedRoute>
                <Layout>
                  <AttractionList />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gems/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <AttractionDetail />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/heatmap"
            element={
              <ProtectedRoute>
                <Layout>
                  <LazyPage>
                    <HeatMap />
                  </LazyPage>
                </Layout>
              </ProtectedRoute>
            }
          />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
