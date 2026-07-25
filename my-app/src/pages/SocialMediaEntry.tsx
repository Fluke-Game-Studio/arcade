import { useAuth } from "../auth/AuthContext";
import SocialMediaOrgHub from "./SocialMediaOrgHub";
import LinkedInQuickPostTest from "./LinkedInQuickPostTest";

// Temporary role switch for the LinkedIn API review demo: a "test" role
// account sees the minimal LinkedInQuickPostTest page instead of the full
// Social Media hub. Remove this wrapper (and go back to rendering
// SocialMediaOrgHub directly in main.tsx) once the review is done.
export default function SocialMediaEntry() {
  const { user } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  if (role === "test") return <LinkedInQuickPostTest />;
  return <SocialMediaOrgHub />;
}
