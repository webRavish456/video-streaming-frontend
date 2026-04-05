import AuthGuard from "./AuthGuard";

export default function ProtectedLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
