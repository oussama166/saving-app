import AdminNav from "../components/AdminNav";

export const metadata = {
  title: "Wealth OS — Admin",
};

// Shell propre à l'espace admin — délibérément indépendant du layout
// utilisateur (TopNav/EmailVerificationBanner se masquent eux-mêmes sur
// /admin, voir leurs gardes de pathname). Pas de LanguageProvider ici :
// l'admin est un outil interne, pas la peine du multi-langue.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <AdminNav />
      {children}
    </div>
  );
}
